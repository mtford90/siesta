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
	  CollectionRegistry = __webpack_require__(2).CollectionRegistry,
	  Collection = __webpack_require__(3),
	  cache = __webpack_require__(4),
	  Model = __webpack_require__(5),
	  error = __webpack_require__(6),
	  events = __webpack_require__(7),
	  RelationshipType = __webpack_require__(8),
	  ReactiveQuery = __webpack_require__(9),
	  ManyToManyProxy = __webpack_require__(10),
	  OneToOneProxy = __webpack_require__(11),
	  OneToManyProxy = __webpack_require__(12),
	  RelationshipProxy = __webpack_require__(13),
	  modelEvents = __webpack_require__(14),
	  Query = __webpack_require__(15),
	  querySet = __webpack_require__(16),
	  log = __webpack_require__(17);
	
	util._patchBind();
	
	// Initialise siesta object. Strange format facilities using submodules with requireJS (eventually)
	var siesta = function(ext) {
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
	    ModelInstance: __webpack_require__(18),
	    extend: __webpack_require__(21),
	    MappingOperation: __webpack_require__(19),
	    events: events,
	    ProxyEventEmitter: events.ProxyEventEmitter,
	    cache: __webpack_require__(4),
	    modelEvents: modelEvents,
	    CollectionRegistry: __webpack_require__(2).CollectionRegistry,
	    Collection: Collection,
	    utils: util,
	    util: util,
	    querySet: querySet,
	    observe: __webpack_require__(22),
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
	  reset: function(cb, resetStorage) {
	    installed = false;
	    installing = false;
	    delete this.queuedTasks;
	    cache.reset();
	    CollectionRegistry.reset();
	    events.removeAllListeners();
	    if (siesta.ext.storageEnabled) {
	      resetStorage = resetStorage === undefined ? true : resetStorage;
	      if (resetStorage) siesta.ext.storage._reset(cb);
	      else cb();
	    }
	    else {
	      cb();
	    }
	  },
	  /**
	   * Creates and registers a new Collection.
	   * @param  {String} name
	   * @param  {Object} [opts]
	   * @return {Collection}
	   */
	  collection: function(name, opts) {
	    var c = new Collection(name, opts);
	    if (installed) c.installed = true; // TODO: Remove
	    return c;
	  },
	  /**
	   * Install all collections.
	   * @param {Function} [cb]
	   * @returns {q.Promise}
	   */
	  install: function(cb) {
	    if (!installing && !installed) {
	      return util.promise(cb, function(cb) {
	        installing = true;
	        var collectionNames = CollectionRegistry.collectionNames,
	          tasks = collectionNames.map(function(n) {
	            var collection = CollectionRegistry[n];
	            return collection.install.bind(collection);
	          }),
	          storageEnabled = siesta.ext.storageEnabled;
	        if (storageEnabled) tasks = tasks.concat([siesta.ext.storage.ensureIndexesForAll, siesta.ext.storage._load]);
	        tasks.push(function(done) {
	          installed = true;
	          if (this.queuedTasks) this.queuedTasks.execute();
	          done();
	        }.bind(this));
	        util.series(tasks, cb);
	      }.bind(this));
	    }
	    else cb(error('already installing'));
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
	  _afterInstall: function(task) {
	    if (!installed) {
	      if (!installing) {
	        this.install(function(err) {
	          if (err) {
	            console.error('Error setting up siesta', err);
	          }
	          delete this.queuedTasks;
	        }.bind(this));
	      }
	      // In case installed straight away e.g. if storage extension not installed.
	      if (!installed) this._pushTask(task);
	      else task();
	    }
	    else {
	      task();
	    }
	  },
	  setLogLevel: function(loggerName, level) {
	    var Logger = log.loggerWithName(loggerName);
	    Logger.setLevel(level);
	  },
	  graph: function(data, opts, cb) {
	    if (typeof opts == 'function') cb = opts;
	    opts = opts || {};
	    return util.promise(cb, function(cb) {
	      var tasks = [], err;
	      for (var collectionName in data) {
	        if (data.hasOwnProperty(collectionName)) {
	          var collection = CollectionRegistry[collectionName];
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
	  notify: util.next,
	  registerComparator: Query.registerComparator.bind(Query),
	  count: function() {
	    return cache.count();
	  },
	  get: function(id, cb) {
	    return util.promise(cb, function(cb) {
	      this._afterInstall(function() {
	        cb(null, cache._localCache()[id]);
	      });
	    }.bind(this));
	  },
	  removeAll: function(cb) {
	    return util.promise(cb, function(cb) {
	      util.Promise.all(
	        CollectionRegistry.collectionNames.map(function(collectionName) {
	          return CollectionRegistry[collectionName].removeAll();
	        }.bind(this))
	      ).then(function() {
	          cb(null);
	        }).catch(cb)
	    }.bind(this));
	  }
	});
	
	Object.defineProperties(siesta, {
	  _canChange: {
	    get: function() {
	      return !(installing || installed);
	    }
	  },
	  installed: {
	    get: function() {
	      return installed;
	    }
	  }
	});
	
	if (typeof window != 'undefined') {
	  window['siesta'] = siesta;
	}
	
	siesta.log = __webpack_require__(27);
	
	module.exports = siesta;
	
	(function loadExtensions() {
	  __webpack_require__(20);
	})();

/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	var observe = __webpack_require__(22).Platform,
	  Promise = __webpack_require__(31),
	  argsarray = __webpack_require__(28),
	  InternalSiestaError = __webpack_require__(6).InternalSiestaError;
	
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

	var util = __webpack_require__(1);
	
	function CollectionRegistry() {
	  if (!this) return new CollectionRegistry();
	  this.collectionNames = [];
	}
	
	util.extend(CollectionRegistry.prototype, {
	  register: function(collection) {
	    var name = collection.name;
	    this[name] = collection;
	    this.collectionNames.push(name);
	  },
	  reset: function() {
	    var self = this;
	    this.collectionNames.forEach(function(name) {
	      delete self[name];
	    });
	    this.collectionNames = [];
	  }
	});
	
	exports.CollectionRegistry = new CollectionRegistry();

/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	var log = __webpack_require__(17)('collection'),
	  CollectionRegistry = __webpack_require__(2).CollectionRegistry,
	  InternalSiestaError = __webpack_require__(6).InternalSiestaError,
	  Model = __webpack_require__(5),
	  extend = __webpack_require__(21),
	  observe = __webpack_require__(22).Platform,
	  events = __webpack_require__(7),
	  util = __webpack_require__(1),
	  error = __webpack_require__(6),
	  argsarray = __webpack_require__(28),
	  cache = __webpack_require__(4);
	
	
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
	
	  Object.defineProperties(this, {
	    dirty: {
	      get: function() {
	        if (siesta.ext.storageEnabled) {
	          var unsavedObjectsByCollection = siesta.ext.storage._unsavedObjectsByCollection,
	            hash = unsavedObjectsByCollection[self.name] || {};
	          return !!Object.keys(hash).length;
	        }
	        else return undefined;
	      },
	      enumerable: true
	    }
	  });
	
	  CollectionRegistry.register(this);
	  this._makeAvailableOnRoot();
	  events.ProxyEventEmitter.call(this, this.name);
	}
	
	Collection.prototype = Object.create(events.ProxyEventEmitter.prototype);
	
	util.extend(Collection.prototype, {
	  _getModelsToInstall: function() {
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
	  _makeAvailableOnRoot: function() {
	    siesta[this.name] = this;
	  },
	  /**
	   * Ensure mappings are installed.
	   * @param [cb]
	   * @class Collection
	   */
	  install: function(cb) {
	    var modelsToInstall = this._getModelsToInstall();
	    return util.promise(cb, function(cb) {
	      if (!this.installed) {
	        this.installed = true;
	        var errors = [];
	        modelsToInstall.forEach(function(m) {
	          log('Installing relationships for mapping with name "' + m.name + '"');
	          var err = m.installRelationships();
	          if (err) errors.push(err);
	        });
	        if (!errors.length) {
	          modelsToInstall.forEach(function(m) {
	            log('Installing reverse relationships for mapping with name "' + m.name + '"');
	            var err = m.installReverseRelationships();
	            if (err) errors.push(err);
	          });
	          if (!errors.length) {
	            this.installed = true;
	            this._makeAvailableOnRoot();
	          }
	        }
	        cb(errors.length ? error('Errors were encountered whilst setting up the collection', {errors: errors}) : null);
	      } else {
	        throw new InternalSiestaError('Collection "' + this.name + '" has already been installed');
	      }
	    }.bind(this));
	  },
	
	  _model: function(name, opts) {
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
	        if (error)  throw error;
	      }
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
/* 4 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * This is an in-memory cache for models. Models are cached by local id (_id) and remote id (defined by the mapping).
	 * Lookups are performed against the cache when mapping.
	 * @module cache
	 */
	var log = __webpack_require__(17)('cache'),
	  InternalSiestaError = __webpack_require__(6).InternalSiestaError,
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
	
	module.exports = new Cache();

/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(setImmediate) {var log = __webpack_require__(17)('model'),
	  CollectionRegistry = __webpack_require__(2).CollectionRegistry,
	  InternalSiestaError = __webpack_require__(6).InternalSiestaError,
	  RelationshipType = __webpack_require__(8),
	  Query = __webpack_require__(15),
	  MappingOperation = __webpack_require__(19),
	  ModelInstance = __webpack_require__(18),
	  util = __webpack_require__(1),
	  cache = __webpack_require__(4),
	  argsarray = __webpack_require__(28),
	  error = __webpack_require__(6),
	  extend = __webpack_require__(21),
	  modelEvents = __webpack_require__(14),
	  Condition = __webpack_require__(23),
	  events = __webpack_require__(7),
	  Placeholder = __webpack_require__(24),
	  ReactiveQuery = __webpack_require__(9),
	  InstanceFactory = __webpack_require__(25);
	
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
	    collection: function(c) {
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
	    this.parseAttribute = function(attrName, value) {
	      return value;
	    }
	  }
	
	  if (!this.serialiseField) {
	    this.serialiseField = function(attrName, value) {
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
	        if (siesta.ext.storageEnabled) {
	          var unsavedObjectsByCollection = siesta.ext.storage._unsavedObjectsByCollection,
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
	    }
	  });
	  var globalEventName = this.collectionName + ':' + this.name,
	    proxied = {
	      query: this.query.bind(this)
	    };
	
	  events.ProxyEventEmitter.call(this, globalEventName, proxied);
	
	  this._indexIsInstalled = new Condition(function(done) {
	    if (siesta.ext.storageEnabled) siesta.ext.storage.ensureIndexInstalled(this, done);
	    else done();
	  }.bind(this));
	
	  this._modelLoadedFromStorage = new Condition(function(done) {
	    if (siesta.ext.storageEnabled) siesta.ext.storage.loadModel({model: this}, done);
	    else done();
	  });
	
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
	  }
	
	});
	
	Model.prototype = Object.create(events.ProxyEventEmitter.prototype);
	
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
	    if (this.singleton && relationship.type == RelationshipType.ManyToMany) {
	      return 'Singleton model cannot use ManyToMany relationship.';
	    }
	    if (Object.keys(RelationshipType).indexOf(relationship.type) < 0)
	      return 'Relationship type ' + relationship.type + ' does not exist';
	    return null;
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
	        var otherCollection = CollectionRegistry[collectionName];
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
	        Object.keys(existingReverseInstances).forEach(function(localId) {
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
	  _installReversePlaceholders: function() {
	    for (var forwardName in this.relationships) {
	      if (this.relationships.hasOwnProperty(forwardName)) {
	        var relationship = this.relationships[forwardName];
	        if (relationship.reverseModel.isPlaceholder) this._installReverse(relationship);
	      }
	    }
	  },
	  installReverseRelationships: function() {
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
	    }
	    else {
	      throw new InternalSiestaError('Reverse relationships for "' + this.name + '" have already been installed.');
	    }
	    return err;
	  },
	  _query: function(query) {
	    return new Query(this, query || {});
	  },
	  query: function(query, cb) {
	    var queryInstance;
	    var promise = util.promise(cb, function(cb) {
	      if (!this.singleton) {
	        queryInstance = this._query(query);
	        return queryInstance.execute(cb);
	      }
	      else {
	        queryInstance = this._query({__ignoreInstalled: true});
	        queryInstance.execute(function(err, objs) {
	          if (err) cb(err);
	          else {
	            // Cache a new singleton and then reexecute the query
	            query = util.extend({}, query);
	            query.__ignoreInstalled = true;
	            if (!objs.length) {
	              this.graph({}, function(err) {
	                if (!err) {
	                  queryInstance = this._query(query);
	                  queryInstance.execute(cb);
	                }
	                else {
	                  cb(err);
	                }
	              }.bind(this));
	            }
	            else {
	              queryInstance = this._query(query);
	              queryInstance.execute(cb);
	            }
	          }
	        }.bind(this));
	      }
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
	        var rq = new ReactiveQuery(this._query(query));
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
	  _reactiveQuery: function(query) {
	    return new ReactiveQuery(new Query(this, query || {}));
	  },
	  one: function(opts, cb) {
	    if (typeof opts == 'function') {
	      cb = opts;
	      opts = {};
	    }
	    return util.promise(cb, function(cb) {
	      this.query(opts, function(err, res) {
	        if (err) cb(err);
	        else {
	          if (res.length > 1) {
	            cb(error('More than one instance returned when executing get query!'));
	          }
	          else {
	            res = res.length ? res[0] : null;
	            cb(null, res);
	          }
	        }
	      });
	    }.bind(this));
	  },
	  all: function(q, cb) {
	    if (typeof q == 'function') {
	      cb = q;
	      q = {};
	    }
	    q = q || {};
	    var query = {};
	    if (q.__order) query.__order = q.__order;
	    return this.query(q, cb);
	  },
	  _attributeDefinitionWithName: function(name) {
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
	  graph: function(data, opts, cb) {
	    if (typeof opts == 'function') cb = opts;
	    opts = opts || {};
	    return util.promise(cb, function(cb) {
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
	      if (opts._ignoreInstalled) {
	        _map();
	      }
	      else siesta._afterInstall(_map);
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
	    var collCache = cache._localCacheByType[this.collectionName] || {};
	    var modelCache = collCache[this.name] || {};
	    return Object.keys(modelCache).reduce(function(m, localId) {
	      m[localId] = {};
	      return m;
	    }, {});
	  },
	  count: function(cb) {
	    return util.promise(cb, function(cb) {
	      cb(null, Object.keys(this._countCache()).length);
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
	
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(29).setImmediate))

/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

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
/* 7 */
/***/ function(module, exports, __webpack_require__) {

	var EventEmitter = __webpack_require__(30).EventEmitter,
	  ArrayObserver = __webpack_require__(22).ArrayObserver,
	  util = __webpack_require__(1),
	  argsarray = __webpack_require__(28),
	  modelEvents = __webpack_require__(14),
	  Chain = __webpack_require__(26);
	
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
	    eventEmitter.on(this.event, fn);
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
	            eventEmitter.removeListener(event, fn);
	            _fn(e);
	          }
	        }
	        else {
	          _fn(e);
	        }
	      }
	    }
	    if (type) return eventEmitter.on(event, fn);
	    else return eventEmitter.once(event, fn);
	  },
	  _removeListener: function(fn, type) {
	    if (type) {
	      var listeners = this.listeners[type],
	        idx = listeners.indexOf(fn);
	      listeners.splice(idx, 1);
	    }
	    return eventEmitter.removeListener(this.event, fn);
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
	    eventEmitter.emit.call(eventEmitter, this.event, payload);
	  },
	  _removeAllListeners: function(type) {
	    (this.listeners[type] || []).forEach(function(fn) {
	      eventEmitter.removeListener(this.event, fn);
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
	
	util.extend(eventEmitter, {
	  ProxyEventEmitter: ProxyEventEmitter,
	  wrapArray: function(array, field, modelInstance) {
	    if (!array.observer) {
	      array.observer = new ArrayObserver(array);
	      array.observer.open(function(splices) {
	        var fieldIsAttribute = modelInstance._attributeNames.indexOf(field) > -1;
	        if (fieldIsAttribute) {
	          splices.forEach(function(splice) {
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
	eventEmitter.emit = function(event, payload) {
	  try {
	    oldEmit.call(eventEmitter, event, payload);
	  }
	  catch (e) {
	    console.error(e);
	  }
	};
	
	module.exports = eventEmitter;

/***/ },
/* 8 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = {
	  OneToMany: 'OneToMany',
	  OneToOne: 'OneToOne',
	  ManyToMany: 'ManyToMany'
	};

/***/ },
/* 9 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * For those familiar with Apple's Cocoa library, reactive queries roughly map onto NSFetchedResultsController.
	 *
	 * They present a query set that 'reacts' to changes in the underlying data.
	 * @module reactiveQuery
	 */
	
	var log = __webpack_require__(17)('query:reactive'),
	  Query = __webpack_require__(15),
	  EventEmitter = __webpack_require__(30).EventEmitter,
	  events = __webpack_require__(7),
	  Chain = __webpack_require__(26),
	  modelEvents = __webpack_require__(14),
	  InternalSiestaError = __webpack_require__(6).InternalSiestaError,
	  constructQuerySet = __webpack_require__(16),
	  util = __webpack_require__(1);
	
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
	    get: function() {
	      return this._query
	    },
	    set: function(v) {
	      if (v) {
	        this._query = v;
	        this.results = constructQuerySet([], v.model);
	      }
	      else {
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
	        var query = self._query;
	        if (query) {
	          return query.model
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
	  init: function(cb, _ignoreInit) {
	    if (this._query) {
	      var name = this._constructNotificationName();
	      var handler = function(n) {
	        this._handleNotif(n);
	      }.bind(this);
	      this.handler = handler;
	      events.on(name, handler);
	      return util.promise(cb, function(cb) {
	        if ((!this.initialised) || _ignoreInit) {
	          this._query.execute(function(err, results) {
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
	    else throw new InternalSiestaError('No _query defined');
	  },
	  _applyResults: function(results) {
	    this.results = results;
	    this.initialised = true;
	    return this.results;
	  },
	  insert: function(newObj) {
	    var results = this.results.mutableCopy();
	    if (this.insertionPolicy == ReactiveQuery.InsertionPolicy.Back) var idx = results.push(newObj);
	    else idx = results.unshift(newObj);
	    this.results = results.asModelQuerySet(this.model);
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
	      if (this._query.objectMatchesQuery(newObj)) {
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
	      }
	      else if (!matches && alreadyContains) {
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
	        this.results = constructQuerySet(results, this.model);
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
	    this.results = constructQuerySet(this._query._sortResults(this.results), this.model);
	  },
	  _constructNotificationName: function() {
	    return this.model.collectionName + ':' + this.model.name;
	  },
	  terminate: function() {
	    if (this.handler) {
	      events.removeListener(this._constructNotificationName(), this.handler);
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
	
	module.exports = ReactiveQuery;

/***/ },
/* 10 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * @module relationships
	 */
	
	var RelationshipProxy = __webpack_require__(13),
	  util = __webpack_require__(1),
	  modelEvents = __webpack_require__(14),
	  events = __webpack_require__(7),
	  wrapArrayForAttributes = events.wrapArray,
	  ArrayObserver = __webpack_require__(22).ArrayObserver,
	  ModelEventType = __webpack_require__(14).ModelEventType;
	
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
/* 11 */
/***/ function(module, exports, __webpack_require__) {

	var RelationshipProxy = __webpack_require__(13),
	  util = __webpack_require__(1),
	  SiestaModel = __webpack_require__(18);
	
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
/* 12 */
/***/ function(module, exports, __webpack_require__) {

	var RelationshipProxy = __webpack_require__(13),
	  util = __webpack_require__(1),
	  modelEvents = __webpack_require__(14),
	  events = __webpack_require__(7),
	  wrapArrayForAttributes = events.wrapArray,
	  ArrayObserver = __webpack_require__(22).ArrayObserver,
	  ModelEventType = __webpack_require__(14).ModelEventType;
	
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
/* 13 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Base functionality for relationships.
	 * @module relationships
	 */
	var InternalSiestaError = __webpack_require__(6).InternalSiestaError,
	  util = __webpack_require__(1),
	  Query = __webpack_require__(15),
	  log = __webpack_require__(17),
	  cache = __webpack_require__(4),
	  events = __webpack_require__(7),
	  wrapArrayForAttributes = events.wrapArray,
	  ArrayObserver = __webpack_require__(22).ArrayObserver,
	  modelEvents = __webpack_require__(14),
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
	    return oldValue;
	  },
	  registerSetChange: function(newValue, oldValue) {
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
	
	  _getRemovedForSpliceChangeEvent: function(idx, numRemove) {
	    var removed = this.related ? this.related.slice(idx, idx + numRemove) : null;
	    return removed;
	  },
	
	  _getAddedForSpliceChangeEvent: function(args) {
	    var add = Array.prototype.slice.call(args, 2),
	      added = add.length ? add : [];
	    return added;
	  },
	
	  registerSpliceChange: function(idx, added, removed) {
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
	  wrapArray: function(arr) {
	    var self = this;
	    wrapArrayForAttributes(arr, this.reverseName, this.object);
	    if (!arr.arrayObserver) {
	      arr.arrayObserver = new ArrayObserver(arr);
	      var observerFunction = function(splices) {
	        splices.forEach(function(splice) {
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
	  splice: function() {
	    this.splicer({}).apply(this, arguments);
	  }
	
	});
	
	module.exports = RelationshipProxy;

/***/ },
/* 14 */
/***/ function(module, exports, __webpack_require__) {

	var events = __webpack_require__(7),
	  InternalSiestaError = __webpack_require__(6).InternalSiestaError,
	  log = __webpack_require__(17)('events'),
	  extend = __webpack_require__(1).extend,
	  collectionRegistry = __webpack_require__(2).CollectionRegistry;
	
	
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
	    }
	    else {
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
/* 15 */
/***/ function(module, exports, __webpack_require__) {

	var log = __webpack_require__(17)('query'),
	  cache = __webpack_require__(4),
	  util = __webpack_require__(1),
	  error = __webpack_require__(6),
	  ModelInstance = __webpack_require__(18),
	  constructQuerySet = __webpack_require__(16);
	
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
	    var fieldValue = opts.object[opts.field];
	    if (log.enabled) {
	      log(opts.field + ': ' + valueAsString(fieldValue) + ' == ' + valueAsString(opts.value), {opts: opts});
	    }
	    return fieldValue == opts.value;
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
	
	util.extend(Query, {
	  comparators: comparators,
	  registerComparator: function(symbol, fn) {
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
	    var _executeInMemory = function() {
	      this.model
	        ._indexIsInstalled
	        .then(function() {
	          var cacheByLocalId = this._getCacheByLocalId();
	          var keys = Object.keys(cacheByLocalId);
	          var self = this;
	          var res = [];
	          var err;
	          for (var i = 0; i < keys.length; i++) {
	            var k = keys[i];
	            var obj = cacheByLocalId[k];
	            var matches = self.objectMatchesQuery(obj);
	            if (typeof(matches) == 'string') {
	              err = error(matches);
	              break;
	            } else {
	              if (matches) res.push(obj);
	            }
	          }
	          res = this._sortResults(res);
	          if (err) log('Error executing query', err);
	          callback(err, err ? null : constructQuerySet(res, this.model));
	        }.bind(this))
	        .catch(function(err) {
	          var _err = 'Unable to execute query due to failed index installation on Model "' +
	            this.model.name + '"';
	          console.error(_err, err);
	          callback(_err);
	        }.bind(this));
	    }.bind(this);
	    if (this.opts.ignoreInstalled) {
	      _executeInMemory();
	    }
	    else {
	      siesta._afterInstall(_executeInMemory);
	    }
	  },
	  clearOrdering: function() {
	    this.opts.order = null;
	  },
	  objectMatchesOrQuery: function(obj, orQuery) {
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
	  objectMatchesAndQuery: function(obj, andQuery) {
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
	    // not match the query.
	    var notNullOrUndefined = obj != undefined;
	    if (notNullOrUndefined) {
	      if (util.isArray(obj)) {
	      }
	      else {
	        var val = obj[field];
	        var invalid = util.isArray(val) ? false : val === null || val === undefined;
	      }
	      var comparator = Query.comparators[op],
	        opts = {object: obj, field: field, value: value, invalid: invalid};
	      if (!comparator) {
	        return 'No comparator registered for query operation "' + op + '"';
	      }
	      return comparator(opts);
	    }
	    return false;
	  },
	  objectMatches: function(obj, unprocessedField, value, query) {
	    if (unprocessedField == '$or') {
	      var $or = query['$or'];
	      if (!util.isArray($or)) {
	        $or = Object.keys($or).map(function(k) {
	          var normalised = {};
	          normalised[k] = $or[k];
	          return normalised;
	        });
	      }
	      if (!this.objectMatchesOrQuery(obj, $or)) return false;
	    }
	    else if (unprocessedField == '$and') {
	      if (!this.objectMatchesAndQuery(obj, query['$and'])) return false;
	    }
	    else {
	      var matches = this.splitMatches(obj, unprocessedField, value);
	      if (typeof matches != 'boolean') return matches;
	      if (!matches) return false;
	    }
	    return true;
	  },
	  objectMatchesBaseQuery: function(obj, query) {
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
	  objectMatchesQuery: function(obj) {
	    return this.objectMatchesBaseQuery(obj, this.query);
	  }
	});
	
	module.exports = Query;

/***/ },
/* 16 */
/***/ function(module, exports, __webpack_require__) {

	var util = __webpack_require__(1),
	  Promise = util.Promise,
	  error = __webpack_require__(6),
	  ModelInstance = __webpack_require__(18);
	
	/*
	 TODO: Use ES6 Proxy instead.
	 Eventually query sets should use ES6 Proxies which will be much more natural and robust. E.g. no need for the below
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
	        return querySet(util.pluck(arr, prop));
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
	    propertyNames.forEach(function(prop) {
	      if (typeof referenceObject[prop] == 'function') defineMethod(arr, prop, arguments);
	      else defineAttribute(arr, prop);
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
	  ARRAY_METHODS.forEach(function(p) {
	    arr[p] = throwImmutableError;
	  });
	  arr.immutable = true;
	  arr.mutableCopy = arr.asArray = function() {
	    var mutableArr = this.map(function(x) {return x});
	    mutableArr.asQuerySet = function() {
	      return querySet(this);
	    };
	    mutableArr.asModelQuerySet = function(model) {
	      return modelQuerySet(this, model);
	    };
	    return mutableArr;
	  };
	  return arr;
	}
	
	module.exports = modelQuerySet;

/***/ },
/* 17 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Dead simple logging service based on visionmedia/debug
	 * @module log
	 */
	
	var debug = __webpack_require__(27),
	  argsarray = __webpack_require__(28);
	
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
/* 18 */
/***/ function(module, exports, __webpack_require__) {

	var log = __webpack_require__(17),
	  util = __webpack_require__(1),
	  error = __webpack_require__(6),
	  modelEvents = __webpack_require__(14),
	  ModelEventType = modelEvents.ModelEventType,
	  events = __webpack_require__(7),
	  cache = __webpack_require__(4);
	
	function ModelInstance(model) {
	  var self = this;
	  this.model = model;
	
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
	
	  events.ProxyEventEmitter.call(this);
	
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
	        if (siesta.ext.storageEnabled) {
	          return self.localId in siesta.ext.storage._unsavedObjectsHash;
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
	    modelEvents.emit(opts);
	  },
	  remove: function(cb, notification) {
	    _.each(this._relationshipNames, function (name) {
	      if (util.isArray(this[name])) {
	        this[name] = [];
	      }
	      else {
	        this[name] = null;
	      }
	    }.bind(this));
	    notification = notification == null ? true : notification;
	    return util.promise(cb, function(cb) {
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
	        cache.insert(this);
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
	        else serialiser = this.model.serialiseField.bind(this, attrName);
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
	        if (util.isArray(val)) {
	          val = util.pluck(val, this.model.id);
	        }
	        else if (val) {
	          val = val[this.model.id];
	        }
	        if (rel && !rel.isReverse) {
	          var serialiser;
	          if (rel.serialise) serialiser = rel.serialise.bind(this);
	          else serialiser = this.model.serialiseField.bind(this, relName);
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
	  /**
	   * Emit an event indicating that this instance has just been created.
	   * @private
	   */
	  _emitNew: function() {
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
/* 19 */
/***/ function(module, exports, __webpack_require__) {

	var ModelInstance = __webpack_require__(18),
	  log = __webpack_require__(17)('graph'),
	  cache = __webpack_require__(4),
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
	                object[f] = datum[f];
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
	            err = object.__proxies[f].set(related, {disableevents: self.disableevents});
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
	    var singleton = cache.getSingleton(this.model) || this._instance(localId);
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
	  }
	  ,
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
/* 20 */
/***/ function(module, exports, __webpack_require__) {

	if (typeof siesta == 'undefined' && typeof module == 'undefined') {
	  throw new Error('Could not find window.siesta. Make sure you include siesta.core.js first.');
	}
	
	var _i = siesta._internal,
	  cache = _i.cache,
	  CollectionRegistry = _i.CollectionRegistry,
	  log = _i.log('storage'),
	  error = _i.error,
	  util = _i.util,
	  events = _i.events;
	
	var unsavedObjects = [],
	  unsavedObjectsHash = {},
	  unsavedObjectsByCollection = {};
	
	var storage = {};
	
	// Variables beginning with underscore are treated as special by PouchDB/CouchDB so when serialising we need to
	// replace with something else.
	var UNDERSCORE = /_/g,
	  UNDERSCORE_REPLACEMENT = /@/g;
	
	function _initMeta() {
	  return {dateFields: []};
	}
	
	function fullyQualifiedModelName(collectionName, modelName) {
	  return collectionName + '.' + modelName;
	}
	
	if (typeof PouchDB == 'undefined') {
	  siesta.ext.storageEnabled = false;
	  console.log('PouchDB is not present therefore storage is disabled.');
	}
	else {
	  var DB_NAME = 'siesta',
	    pouch = new PouchDB(DB_NAME, {auto_compaction: true});
	
	  /**
	   * Sometimes siesta needs to store some extra information about the model instance.
	   * @param serialised
	   * @private
	   */
	  function _addMeta(serialised) {
	    // PouchDB <= 3.2.1 has a bug whereby date fields are not deserialised properly if you use db.query
	    // therefore we need to add extra info to the object for deserialising dates manually.
	    serialised.siesta_meta = _initMeta();
	    for (var prop in serialised) {
	      if (serialised.hasOwnProperty(prop)) {
	        if (serialised[prop] instanceof Date) {
	          serialised.siesta_meta.dateFields.push(prop);
	          serialised[prop] = serialised[prop].getTime();
	        }
	      }
	    }
	  }
	
	  function _processMeta(datum) {
	    var meta = datum.siesta_meta || _initMeta();
	    meta.dateFields.forEach(function(dateField) {
	      var value = datum[dateField];
	      if (!(value instanceof Date)) {
	        datum[dateField] = new Date(value);
	      }
	    });
	    delete datum.siesta_meta;
	  }
	
	  function constructIndexDesignDoc(collectionName, modelName) {
	    var fullyQualifiedName = fullyQualifiedModelName(collectionName, modelName);
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
	  }
	
	  /**
	   * Ensure that the PouchDB index for the given model exists, creating it if not.
	   * @param model
	   * @param cb
	   */
	  function ensureIndexInstalled(model, cb) {
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
	
	    pouch
	      .put(constructIndexDesignDoc(model.collectionName, model.name))
	      .then(fn)
	      .catch(fn);
	  }
	
	  function getAllModels() {
	    var allModels = [];
	    var registry = siesta._internal.CollectionRegistry;
	    registry.collectionNames.forEach(function(collectionName) {
	      var coll = registry[collectionName];
	      var models = coll._models;
	      for (var modelName in models) {
	        if (models.hasOwnProperty(modelName)) {
	          var model = coll[modelName];
	          allModels.push(model);
	        }
	      }
	    });
	    return allModels;
	  }
	
	  function constructIndexesForAllModels(models) {
	    return models.map(function(model) {
	      return constructIndexDesignDoc(model.collectionName, model.name);
	    });
	  }
	
	  function __ensureIndexes(indexes, cb) {
	    function fn(resp) {
	      var errors = [];
	      for (var i = 0; i < resp.length; i++) {
	        var response = resp[i];
	        if (!response.ok) {
	          // Conflict means already exists, and this is fine!
	          var isConflict = response.status == 409;
	          if (!isConflict) errors.push(response);
	        }
	      }
	      cb(errors.length ? error('multiple errors', {errors: errors}) : null);
	    }
	
	    pouch
	      .bulkDocs(indexes)
	      .then(fn)
	      .catch(fn);
	  }
	
	  function ensureIndexesForAll(cb) {
	    var models = getAllModels();
	    var indexes = constructIndexesForAllModels(models);
	    __ensureIndexes(indexes, cb);
	  }
	
	  /**
	   * Serialise a model into a format that PouchDB bulkDocs API can process
	   * @param {ModelInstance} modelInstance
	   */
	  function _serialise(modelInstance) {
	    var serialised = {};
	    var __values = modelInstance.__values;
	    serialised = util.extend(serialised, __values);
	    Object.keys(serialised).forEach(function(k) {
	      serialised[k.replace(UNDERSCORE, '@')] = __values[k];
	    });
	    _addMeta(serialised);
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
	  }
	
	  function _prepareDatum(rawDatum, model) {
	    _processMeta(rawDatum);
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
	  }
	
	  /**
	   *
	   * @param opts
	   * @param [opts.collectionName]
	   * @param [opts.modelName]
	   * @param [opts.model]
	   * @param callback
	   * @private
	   */
	  function loadModel(opts, callback) {
	    var loaded = {};
	    var collectionName = opts.collectionName,
	      modelName = opts.modelName,
	      model = opts.model;
	    if (model) {
	      collectionName = model.collectionName;
	      modelName = model.name;
	    }
	    var fullyQualifiedName = fullyQualifiedModelName(collectionName, modelName);
	    var Model = CollectionRegistry[collectionName][modelName];
	    pouch.query(fullyQualifiedName)
	      .then(function(resp) {
	        log('Queried pouch successfully');
	        var rows = resp.rows;
	        var data = util.pluck(rows, 'value').map(function(datum) {
	          return _prepareDatum(datum, Model);
	        });
	
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
	
	        log('Mapping data', data);
	
	        Model.graph(data, {
	          _ignoreInstalled: true,
	          fromStorage: true
	        }, function(err, instances) {
	          if (!err) {
	            if (log.enabled)
	              log(true ? instances.length.toString() : 0 + ' instances for ' + fullyQualifiedName);
	          }
	          else {
	            log('Error loading models', err);
	          }
	          callback(err, instances);
	        });
	      })
	      .catch(function(err) {
	        callback(err);
	      });
	
	  }
	
	  /**
	   * Load all data from PouchDB.
	   */
	  function _load(cb) {
	    if (saving) throw new Error('not loaded yet how can i save');
	    return util.promise(cb, function(cb) {
	      if (siesta.ext.storageEnabled) {
	        var collectionNames = CollectionRegistry.collectionNames;
	        var tasks = [];
	        collectionNames.forEach(function(collectionName) {
	          var collection = CollectionRegistry[collectionName],
	            modelNames = Object.keys(collection._models);
	          modelNames.forEach(function(modelName) {
	            tasks.push(function(cb) {
	              // We call from storage to allow for replacement of _loadModel for performance extension.
	              storage.loadModel({
	                collectionName: collectionName,
	                modelName: modelName
	              }, cb);
	            });
	          });
	        });
	        util.series(tasks, function(err, results) {
	          var n;
	          if (!err) {
	            var instances = [];
	            results.forEach(function(r) {
	              instances = instances.concat(r)
	            });
	            n = instances.length;
	            if (log) {
	              log('Loaded ' + n.toString() + ' instances. Cache size is ' + cache.count(), {
	                remote: cache._remoteCache(),
	                localCache: cache._localCache()
	              });
	            }
	            siesta.on('Siesta', listener);
	          }
	          cb(err, n);
	        });
	      }
	      else {
	        cb();
	      }
	    }.bind(this));
	  }
	
	  function saveConflicts(objects, cb) {
	    pouch.allDocs({keys: util.pluck(objects, 'localId')})
	      .then(function(resp) {
	        for (var i = 0; i < resp.rows.length; i++) {
	          objects[i]._rev = resp.rows[i].value.rev;
	        }
	        saveToPouch(objects, cb);
	      })
	      .catch(function(err) {
	        cb(err);
	      })
	  }
	
	  function saveToPouch(objects, cb) {
	    var conflicts = [];
	    var serialisedDocs = objects.map(_serialise);
	    pouch.bulkDocs(serialisedDocs).then(function(resp) {
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
	        saveConflicts(conflicts, cb);
	      }
	      else {
	        cb();
	      }
	    }, function(err) {
	      cb(err);
	    });
	  }
	
	
	  /**
	   * Save all modelEvents down to PouchDB.
	   */
	  function save(cb) {
	    return util.promise(cb, function(cb) {
	      siesta._afterInstall(function() {
	        var instances = unsavedObjects;
	        unsavedObjects = [];
	        unsavedObjectsHash = {};
	        unsavedObjectsByCollection = {};
	        saveToPouch(instances, cb);
	      });
	    }.bind(this));
	  }
	
	  function listener(n) {
	    var changedObject = n.obj,
	      ident = changedObject.localId;
	    if (!changedObject) {
	      throw new _i.error.InternalSiestaError('No obj field in notification received by storage extension');
	    }
	    if (!(ident in unsavedObjectsHash)) {
	      unsavedObjectsHash[ident] = changedObject;
	      unsavedObjects.push(changedObject);
	      var collectionName = changedObject.collectionName;
	      if (!unsavedObjectsByCollection[collectionName]) {
	        unsavedObjectsByCollection[collectionName] = {};
	      }
	      var modelName = changedObject.model.name;
	      if (!unsavedObjectsByCollection[collectionName][modelName]) {
	        unsavedObjectsByCollection[collectionName][modelName] = {};
	      }
	      unsavedObjectsByCollection[collectionName][modelName][ident] = changedObject;
	    }
	  }
	
	  util.extend(storage, {
	    _load: _load,
	    loadModel: loadModel,
	    save: save,
	    _serialise: _serialise,
	    ensureIndexesForAll: ensureIndexesForAll,
	    ensureIndexInstalled: ensureIndexInstalled,
	    _reset: function(cb) {
	      siesta.removeListener('Siesta', listener);
	      unsavedObjects = [];
	      unsavedObjectsHash = {};
	      pouch.destroy(function(err) {
	        if (!err) {
	          pouch = new PouchDB(DB_NAME);
	        }
	        log('Reset complete');
	        cb(err);
	      })
	    }
	
	  });
	
	  Object.defineProperties(storage, {
	    _unsavedObjects: {
	      get: function() {
	        return unsavedObjects
	      }
	    },
	    _unsavedObjectsHash: {
	      get: function() {
	        return unsavedObjectsHash
	      }
	    },
	    _unsavedObjectsByCollection: {
	      get: function() {
	        return unsavedObjectsByCollection
	      }
	    },
	    _pouch: {
	      get: function() {
	        return pouch
	      }
	    }
	  });
	
	  if (!siesta.ext) siesta.ext = {};
	  siesta.ext.storage = storage;
	
	  Object.defineProperties(siesta.ext, {
	    storageEnabled: {
	      get: function() {
	        if (siesta.ext._storageEnabled !== undefined) {
	          return siesta.ext._storageEnabled;
	        }
	        return !!siesta.ext.storage;
	      },
	      set: function(v) {
	        siesta.ext._storageEnabled = v;
	      },
	      enumerable: true
	    }
	  });
	
	  var interval, saving, autosaveInterval = 1000;
	
	  Object.defineProperties(siesta, {
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
	                siesta.save(function(err) {
	                  if (!err) {
	                    events.emit('saved');
	                  }
	                  saving = false;
	                });
	              }
	            }, siesta.autosaveInterval);
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
	    autosaveInterval: {
	      get: function() {
	        return autosaveInterval;
	      },
	      set: function(_autosaveInterval) {
	        autosaveInterval = _autosaveInterval;
	        if (interval) {
	          // Reset interval
	          siesta.autosave = false;
	          siesta.autosave = true;
	        }
	      }
	    },
	    dirty: {
	      get: function() {
	        var unsavedObjectsByCollection = siesta.ext.storage._unsavedObjectsByCollection;
	        return !!Object.keys(unsavedObjectsByCollection).length;
	      },
	      enumerable: true
	    }
	  });
	
	  util.extend(siesta, {
	    save: save,
	    setPouch: function(_p) {
	      if (siesta._canChange) pouch = _p;
	      else throw new Error('Cannot change PouchDB instance when an object graph exists.');
	    }
	  });
	
	}
	
	module.exports = storage;

/***/ },
/* 21 */
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
/* 22 */
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
	
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }()), __webpack_require__(33)(module)))

/***/ },
/* 23 */
/***/ function(module, exports, __webpack_require__) {

	var util = __webpack_require__(1);
	
	function Condition(fn, lazy) {
	  if (lazy === undefined || lazy === null) {
	    lazy = true;
	  }
	  fn = fn || function(done) {
	    done();
	  };
	
	  this._promise = new util.Promise(function(resolve, reject) {
	    this.fn = function() {
	      this.executed = true;
	      var numComplete = 0;
	      var results = [];
	      var errors = [];
	      if (util.isArray(fn)) {
	        var checkComplete = function() {
	          if (numComplete.length == fn.length) {
	            if (errors.length) this._promise.reject(errors);
	            else this._promise.resolve(null, results);
	          }
	        }.bind(this);
	
	        fn.forEach(function(cond, idx) {
	          cond.then(function(res) {
	            results[idx] = res;
	            numComplete++;
	            checkComplete();
	          }).catch(function(err) {
	            errors[idx] = err;
	            numComplete++;
	          });
	        });
	      }
	      else {
	        fn(function(err, res) {
	          if (err) reject(err);
	          else resolve(res);
	        }.bind(this))
	      }
	    }
	  }.bind(this));
	
	  if (!lazy) this._execute();
	  this.executed = false;
	}
	
	Condition.prototype = {
	  _execute: function() {
	    if (!this.executed) this.fn();
	  },
	  then: function(success, fail) {
	    this._execute();
	    return this._promise.then(success, fail);
	  },
	  catch: function(fail) {
	    this._execute();
	    return this._promise.catch(fail);
	  },
	  resolve: function (res) {
	    this.executed = true;
	    this._promise.resolve(res);
	  },
	  reject: function (err) {
	    this.executed = true;
	    this._promise.reject(err);
	  }
	};
	
	module.exports = Condition;

/***/ },
/* 24 */
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
/* 25 */
/***/ function(module, exports, __webpack_require__) {

	var log = __webpack_require__(17)('model'),
	  InternalSiestaError = __webpack_require__(6).InternalSiestaError,
	  RelationshipType = __webpack_require__(8),
	  Query = __webpack_require__(15),
	  ModelInstance = __webpack_require__(18),
	  util = __webpack_require__(1),
	  guid = util.guid,
	  cache = __webpack_require__(4),
	  extend = __webpack_require__(21),
	  modelEvents = __webpack_require__(14),
	  wrapArray = __webpack_require__(7).wrapArray,
	  OneToManyProxy = __webpack_require__(12),
	  OneToOneProxy = __webpack_require__(11),
	  ManyToManyProxy = __webpack_require__(10),
	  ReactiveQuery = __webpack_require__(9),
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
	            return {
	              prop: dependant,
	              old: this[dependant]
	            }
	          }.bind(this));
	
	          modelInstance.__values[attributeName] = v;
	          propertyDependencies.forEach(function(dep) {
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
	    var idField = Model.id;
	    Object.defineProperty(modelInstance, idField, {
	      get: function() {
	        return modelInstance.__values[Model.id] || null;
	      },
	      set: function(v) {
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
/* 26 */
/***/ function(module, exports, __webpack_require__) {

	var argsarray = __webpack_require__(28);
	
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
/* 27 */
/***/ function(module, exports, __webpack_require__) {

	
	/**
	 * This is the web browser implementation of `debug()`.
	 *
	 * Expose `debug()` as the module.
	 */
	
	exports = module.exports = __webpack_require__(32);
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
/* 29 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(setImmediate, clearImmediate) {var nextTick = __webpack_require__(34).nextTick;
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
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(29).setImmediate, __webpack_require__(29).clearImmediate))

/***/ },
/* 30 */
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
/* 31 */
/***/ function(module, exports, __webpack_require__) {

	var require;var require;/* WEBPACK VAR INJECTION */(function(global) {!function(e){if(true)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.Promise=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return require(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
	'use strict';
	
	module.exports = INTERNAL;
	
	function INTERNAL() {}
	},{}],2:[function(_dereq_,module,exports){
	'use strict';
	var Promise = _dereq_('./promise');
	var reject = _dereq_('./reject');
	var resolve = _dereq_('./resolve');
	var INTERNAL = _dereq_('./INTERNAL');
	var handlers = _dereq_('./handlers');
	module.exports = all;
	function all(iterable) {
	  if (Object.prototype.toString.call(iterable) !== '[object Array]') {
	    return reject(new TypeError('must be an array'));
	  }
	
	  var len = iterable.length;
	  var called = false;
	  if (!len) {
	    return resolve([]);
	  }
	
	  var values = new Array(len);
	  var resolved = 0;
	  var i = -1;
	  var promise = new Promise(INTERNAL);
	  
	  while (++i < len) {
	    allResolver(iterable[i], i);
	  }
	  return promise;
	  function allResolver(value, i) {
	    resolve(value).then(resolveFromAll, function (error) {
	      if (!called) {
	        called = true;
	        handlers.reject(promise, error);
	      }
	    });
	    function resolveFromAll(outValue) {
	      values[i] = outValue;
	      if (++resolved === len & !called) {
	        called = true;
	        handlers.resolve(promise, values);
	      }
	    }
	  }
	}
	},{"./INTERNAL":1,"./handlers":3,"./promise":5,"./reject":8,"./resolve":9}],3:[function(_dereq_,module,exports){
	'use strict';
	var tryCatch = _dereq_('./tryCatch');
	var resolveThenable = _dereq_('./resolveThenable');
	var states = _dereq_('./states');
	
	exports.resolve = function (self, value) {
	  var result = tryCatch(getThen, value);
	  if (result.status === 'error') {
	    return exports.reject(self, result.value);
	  }
	  var thenable = result.value;
	
	  if (thenable) {
	    resolveThenable.safely(self, thenable);
	  } else {
	    self.state = states.FULFILLED;
	    self.outcome = value;
	    var i = -1;
	    var len = self.queue.length;
	    while (++i < len) {
	      self.queue[i].callFulfilled(value);
	    }
	  }
	  return self;
	};
	exports.reject = function (self, error) {
	  self.state = states.REJECTED;
	  self.outcome = error;
	  var i = -1;
	  var len = self.queue.length;
	  while (++i < len) {
	    self.queue[i].callRejected(error);
	  }
	  return self;
	};
	
	function getThen(obj) {
	  // Make sure we only access the accessor once as required by the spec
	  var then = obj && obj.then;
	  if (obj && typeof obj === 'object' && typeof then === 'function') {
	    return function appyThen() {
	      then.apply(obj, arguments);
	    };
	  }
	}
	},{"./resolveThenable":10,"./states":11,"./tryCatch":12}],4:[function(_dereq_,module,exports){
	module.exports = exports = _dereq_('./promise');
	
	exports.resolve = _dereq_('./resolve');
	exports.reject = _dereq_('./reject');
	exports.all = _dereq_('./all');
	exports.race = _dereq_('./race');
	},{"./all":2,"./promise":5,"./race":7,"./reject":8,"./resolve":9}],5:[function(_dereq_,module,exports){
	'use strict';
	
	var unwrap = _dereq_('./unwrap');
	var INTERNAL = _dereq_('./INTERNAL');
	var resolveThenable = _dereq_('./resolveThenable');
	var states = _dereq_('./states');
	var QueueItem = _dereq_('./queueItem');
	
	module.exports = Promise;
	function Promise(resolver) {
	  if (!(this instanceof Promise)) {
	    return new Promise(resolver);
	  }
	  if (typeof resolver !== 'function') {
	    throw new TypeError('resolver must be a function');
	  }
	  this.state = states.PENDING;
	  this.queue = [];
	  this.outcome = void 0;
	  if (resolver !== INTERNAL) {
	    resolveThenable.safely(this, resolver);
	  }
	}
	
	Promise.prototype['catch'] = function (onRejected) {
	  return this.then(null, onRejected);
	};
	Promise.prototype.then = function (onFulfilled, onRejected) {
	  if (typeof onFulfilled !== 'function' && this.state === states.FULFILLED ||
	    typeof onRejected !== 'function' && this.state === states.REJECTED) {
	    return this;
	  }
	  var promise = new Promise(INTERNAL);
	
	  
	  if (this.state !== states.PENDING) {
	    var resolver = this.state === states.FULFILLED ? onFulfilled: onRejected;
	    unwrap(promise, resolver, this.outcome);
	  } else {
	    this.queue.push(new QueueItem(promise, onFulfilled, onRejected));
	  }
	
	  return promise;
	};
	
	},{"./INTERNAL":1,"./queueItem":6,"./resolveThenable":10,"./states":11,"./unwrap":13}],6:[function(_dereq_,module,exports){
	'use strict';
	var handlers = _dereq_('./handlers');
	var unwrap = _dereq_('./unwrap');
	
	module.exports = QueueItem;
	function QueueItem(promise, onFulfilled, onRejected) {
	  this.promise = promise;
	  if (typeof onFulfilled === 'function') {
	    this.onFulfilled = onFulfilled;
	    this.callFulfilled = this.otherCallFulfilled;
	  }
	  if (typeof onRejected === 'function') {
	    this.onRejected = onRejected;
	    this.callRejected = this.otherCallRejected;
	  }
	}
	QueueItem.prototype.callFulfilled = function (value) {
	  handlers.resolve(this.promise, value);
	};
	QueueItem.prototype.otherCallFulfilled = function (value) {
	  unwrap(this.promise, this.onFulfilled, value);
	};
	QueueItem.prototype.callRejected = function (value) {
	  handlers.reject(this.promise, value);
	};
	QueueItem.prototype.otherCallRejected = function (value) {
	  unwrap(this.promise, this.onRejected, value);
	};
	},{"./handlers":3,"./unwrap":13}],7:[function(_dereq_,module,exports){
	'use strict';
	var Promise = _dereq_('./promise');
	var reject = _dereq_('./reject');
	var resolve = _dereq_('./resolve');
	var INTERNAL = _dereq_('./INTERNAL');
	var handlers = _dereq_('./handlers');
	module.exports = race;
	function race(iterable) {
	  if (Object.prototype.toString.call(iterable) !== '[object Array]') {
	    return reject(new TypeError('must be an array'));
	  }
	
	  var len = iterable.length;
	  var called = false;
	  if (!len) {
	    return resolve([]);
	  }
	
	  var resolved = 0;
	  var i = -1;
	  var promise = new Promise(INTERNAL);
	  
	  while (++i < len) {
	    resolver(iterable[i]);
	  }
	  return promise;
	  function resolver(value) {
	    resolve(value).then(function (response) {
	      if (!called) {
	        called = true;
	        handlers.resolve(promise, response);
	      }
	    }, function (error) {
	      if (!called) {
	        called = true;
	        handlers.reject(promise, error);
	      }
	    });
	  }
	}
	},{"./INTERNAL":1,"./handlers":3,"./promise":5,"./reject":8,"./resolve":9}],8:[function(_dereq_,module,exports){
	'use strict';
	
	var Promise = _dereq_('./promise');
	var INTERNAL = _dereq_('./INTERNAL');
	var handlers = _dereq_('./handlers');
	module.exports = reject;
	
	function reject(reason) {
		var promise = new Promise(INTERNAL);
		return handlers.reject(promise, reason);
	}
	},{"./INTERNAL":1,"./handlers":3,"./promise":5}],9:[function(_dereq_,module,exports){
	'use strict';
	
	var Promise = _dereq_('./promise');
	var INTERNAL = _dereq_('./INTERNAL');
	var handlers = _dereq_('./handlers');
	module.exports = resolve;
	
	var FALSE = handlers.resolve(new Promise(INTERNAL), false);
	var NULL = handlers.resolve(new Promise(INTERNAL), null);
	var UNDEFINED = handlers.resolve(new Promise(INTERNAL), void 0);
	var ZERO = handlers.resolve(new Promise(INTERNAL), 0);
	var EMPTYSTRING = handlers.resolve(new Promise(INTERNAL), '');
	
	function resolve(value) {
	  if (value) {
	    if (value instanceof Promise) {
	      return value;
	    }
	    return handlers.resolve(new Promise(INTERNAL), value);
	  }
	  var valueType = typeof value;
	  switch (valueType) {
	    case 'boolean':
	      return FALSE;
	    case 'undefined':
	      return UNDEFINED;
	    case 'object':
	      return NULL;
	    case 'number':
	      return ZERO;
	    case 'string':
	      return EMPTYSTRING;
	  }
	}
	},{"./INTERNAL":1,"./handlers":3,"./promise":5}],10:[function(_dereq_,module,exports){
	'use strict';
	var handlers = _dereq_('./handlers');
	var tryCatch = _dereq_('./tryCatch');
	function safelyResolveThenable(self, thenable) {
	  // Either fulfill, reject or reject with error
	  var called = false;
	  function onError(value) {
	    if (called) {
	      return;
	    }
	    called = true;
	    handlers.reject(self, value);
	  }
	
	  function onSuccess(value) {
	    if (called) {
	      return;
	    }
	    called = true;
	    handlers.resolve(self, value);
	  }
	
	  function tryToUnwrap() {
	    thenable(onSuccess, onError);
	  }
	  
	  var result = tryCatch(tryToUnwrap);
	  if (result.status === 'error') {
	    onError(result.value);
	  }
	}
	exports.safely = safelyResolveThenable;
	},{"./handlers":3,"./tryCatch":12}],11:[function(_dereq_,module,exports){
	// Lazy man's symbols for states
	
	exports.REJECTED = ['REJECTED'];
	exports.FULFILLED = ['FULFILLED'];
	exports.PENDING = ['PENDING'];
	},{}],12:[function(_dereq_,module,exports){
	'use strict';
	
	module.exports = tryCatch;
	
	function tryCatch(func, value) {
	  var out = {};
	  try {
	    out.value = func(value);
	    out.status = 'success';
	  } catch (e) {
	    out.status = 'error';
	    out.value = e;
	  }
	  return out;
	}
	},{}],13:[function(_dereq_,module,exports){
	'use strict';
	
	var immediate = _dereq_('immediate');
	var handlers = _dereq_('./handlers');
	module.exports = unwrap;
	
	function unwrap(promise, func, value) {
	  immediate(function () {
	    var returnValue;
	    try {
	      returnValue = func(value);
	    } catch (e) {
	      return handlers.reject(promise, e);
	    }
	    if (returnValue === promise) {
	      handlers.reject(promise, new TypeError('Cannot resolve promise with itself'));
	    } else {
	      handlers.resolve(promise, returnValue);
	    }
	  });
	}
	},{"./handlers":3,"immediate":15}],14:[function(_dereq_,module,exports){
	
	},{}],15:[function(_dereq_,module,exports){
	'use strict';
	var types = [
	  _dereq_('./nextTick'),
	  _dereq_('./mutation.js'),
	  _dereq_('./messageChannel'),
	  _dereq_('./stateChange'),
	  _dereq_('./timeout')
	];
	var draining;
	var queue = [];
	function drainQueue() {
	  draining = true;
	  var i, oldQueue;
	  var len = queue.length;
	  while (len) {
	    oldQueue = queue;
	    queue = [];
	    i = -1;
	    while (++i < len) {
	      oldQueue[i]();
	    }
	    len = queue.length;
	  }
	  draining = false;
	}
	var scheduleDrain;
	var i = -1;
	var len = types.length;
	while (++ i < len) {
	  if (types[i] && types[i].test && types[i].test()) {
	    scheduleDrain = types[i].install(drainQueue);
	    break;
	  }
	}
	module.exports = immediate;
	function immediate(task) {
	  if (queue.push(task) === 1 && !draining) {
	    scheduleDrain();
	  }
	}
	},{"./messageChannel":16,"./mutation.js":17,"./nextTick":14,"./stateChange":18,"./timeout":19}],16:[function(_dereq_,module,exports){
	(function (global){
	'use strict';
	
	exports.test = function () {
	  if (global.setImmediate) {
	    // we can only get here in IE10
	    // which doesn't handel postMessage well
	    return false;
	  }
	  return typeof global.MessageChannel !== 'undefined';
	};
	
	exports.install = function (func) {
	  var channel = new global.MessageChannel();
	  channel.port1.onmessage = func;
	  return function () {
	    channel.port2.postMessage(0);
	  };
	};
	}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
	},{}],17:[function(_dereq_,module,exports){
	(function (global){
	'use strict';
	//based off rsvp https://github.com/tildeio/rsvp.js
	//license https://github.com/tildeio/rsvp.js/blob/master/LICENSE
	//https://github.com/tildeio/rsvp.js/blob/master/lib/rsvp/asap.js
	
	var Mutation = global.MutationObserver || global.WebKitMutationObserver;
	
	exports.test = function () {
	  return Mutation;
	};
	
	exports.install = function (handle) {
	  var called = 0;
	  var observer = new Mutation(handle);
	  var element = global.document.createTextNode('');
	  observer.observe(element, {
	    characterData: true
	  });
	  return function () {
	    element.data = (called = ++called % 2);
	  };
	};
	}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
	},{}],18:[function(_dereq_,module,exports){
	(function (global){
	'use strict';
	
	exports.test = function () {
	  return 'document' in global && 'onreadystatechange' in global.document.createElement('script');
	};
	
	exports.install = function (handle) {
	  return function () {
	
	    // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
	    // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
	    var scriptEl = global.document.createElement('script');
	    scriptEl.onreadystatechange = function () {
	      handle();
	
	      scriptEl.onreadystatechange = null;
	      scriptEl.parentNode.removeChild(scriptEl);
	      scriptEl = null;
	    };
	    global.document.documentElement.appendChild(scriptEl);
	
	    return handle;
	  };
	};
	}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
	},{}],19:[function(_dereq_,module,exports){
	'use strict';
	exports.test = function () {
	  return true;
	};
	
	exports.install = function (t) {
	  return function () {
	    setTimeout(t, 0);
	  };
	};
	},{}]},{},[4])(4)
	});
	
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 32 */
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
	exports.humanize = __webpack_require__(35);
	
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
/* 33 */
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
/* 34 */
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
/* 35 */
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vd2VicGFjay9ib290c3RyYXAgYTk2OTc3MTA0NWQ2N2RhMDk5MjgiLCJ3ZWJwYWNrOi8vLy4vY29yZS9pbmRleC5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL3V0aWwuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9jb2xsZWN0aW9uUmVnaXN0cnkuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9jb2xsZWN0aW9uLmpzIiwid2VicGFjazovLy8uL2NvcmUvY2FjaGUuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9tb2RlbC5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL2Vycm9yLmpzIiwid2VicGFjazovLy8uL2NvcmUvZXZlbnRzLmpzIiwid2VicGFjazovLy8uL2NvcmUvUmVsYXRpb25zaGlwVHlwZS5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL1JlYWN0aXZlUXVlcnkuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9NYW55VG9NYW55UHJveHkuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9PbmVUb09uZVByb3h5LmpzIiwid2VicGFjazovLy8uL2NvcmUvT25lVG9NYW55UHJveHkuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9SZWxhdGlvbnNoaXBQcm94eS5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL21vZGVsRXZlbnRzLmpzIiwid2VicGFjazovLy8uL2NvcmUvUXVlcnkuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9RdWVyeVNldC5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL2xvZy5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL01vZGVsSW5zdGFuY2UuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9tYXBwaW5nT3BlcmF0aW9uLmpzIiwid2VicGFjazovLy8uL3N0b3JhZ2UvaW5kZXguanMiLCJ3ZWJwYWNrOi8vLy4vfi9leHRlbmQvaW5kZXguanMiLCJ3ZWJwYWNrOi8vLy4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9Db25kaXRpb24uanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9QbGFjZWhvbGRlci5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL2luc3RhbmNlRmFjdG9yeS5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL0NoYWluLmpzIiwid2VicGFjazovLy8uL34vZGVidWcvYnJvd3Nlci5qcyIsIndlYnBhY2s6Ly8vLi9+L2FyZ3NhcnJheS9pbmRleC5qcyIsIndlYnBhY2s6Ly8vKHdlYnBhY2spL34vbm9kZS1saWJzLWJyb3dzZXIvfi90aW1lcnMtYnJvd3NlcmlmeS9tYWluLmpzIiwid2VicGFjazovLy8od2VicGFjaykvfi9ub2RlLWxpYnMtYnJvd3Nlci9+L2V2ZW50cy9ldmVudHMuanMiLCJ3ZWJwYWNrOi8vLy4vfi9saWUvZGlzdC9saWUuanMiLCJ3ZWJwYWNrOi8vLy4vfi9kZWJ1Zy9kZWJ1Zy5qcyIsIndlYnBhY2s6Ly8vKHdlYnBhY2spL2J1aWxkaW4vbW9kdWxlLmpzIiwid2VicGFjazovLy8od2VicGFjaykvfi9ub2RlLWxpYnMtYnJvd3Nlci9+L3Byb2Nlc3MvYnJvd3Nlci5qcyIsIndlYnBhY2s6Ly8vLi9+L2RlYnVnL34vbXMvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLHVCQUFlO0FBQ2Y7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7OztBQUdBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0Esd0M7Ozs7Ozs7QUN0Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxvQ0FBbUM7QUFDbkM7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFDO0FBQ0Q7QUFDQTtBQUNBO0FBQ0EsRUFBQzs7QUFFRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQSxFQUFDOztBQUVEOztBQUVBO0FBQ0E7OztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQSxlQUFjLE9BQU87QUFDckIsZUFBYyxPQUFPO0FBQ3JCLGVBQWM7QUFDZDtBQUNBO0FBQ0E7QUFDQSx1Q0FBc0M7QUFDdEM7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBLGNBQWEsU0FBUztBQUN0QixnQkFBZTtBQUNmO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQVc7QUFDWDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7QUFDQSxRQUFPO0FBQ1A7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQVc7QUFDWDtBQUNBLFVBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esa0JBQWlCO0FBQ2pCLGdCQUFlO0FBQ2YsY0FBYTtBQUNiO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxjQUFhLElBQUk7QUFDakIsWUFBVztBQUNYO0FBQ0EsVUFBUztBQUNUO0FBQ0EsMkJBQTBCLGtEQUFrRDtBQUM1RSxNQUFLO0FBQ0wsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQLE1BQUs7QUFDTCxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBO0FBQ0EsVUFBUztBQUNULE1BQUs7QUFDTDtBQUNBLEVBQUM7O0FBRUQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBQzs7QUFFRDtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7O0FBRUE7QUFDQTtBQUNBLEVBQUMsSTs7Ozs7O0FDblFEO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQSxrQ0FBaUMsY0FBYztBQUMvQyxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQOztBQUVBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBO0FBQ0EsTUFBSztBQUNMLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHVEQUFzRDtBQUN0RDtBQUNBLFFBQU87QUFDUDtBQUNBLE1BQUs7QUFDTCxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esb0JBQW1CLHVCQUF1QjtBQUMxQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxZQUFXO0FBQ1g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQSxvQkFBbUIscUJBQXFCO0FBQ3hDO0FBQ0E7QUFDQTtBQUNBLHdCQUF1Qix3QkFBd0I7QUFDL0M7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUM7O0FBRUQ7QUFDQTtBQUNBO0FBQ0EsY0FBYTtBQUNiO0FBQ0E7QUFDQTtBQUNBLGtDQUFpQyxTQUFTO0FBQzFDOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsY0FBYTtBQUNiO0FBQ0E7QUFDQSxRQUFPO0FBQ1AsTUFBSztBQUNMLElBQUc7QUFDSDs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGNBQWE7QUFDYjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUEsSUFBRztBQUNIOzs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUM7O0FBRUQ7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQLE1BQUs7QUFDTDtBQUNBO0FBQ0EsRUFBQyxFOzs7Ozs7QUNoVkQ7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0EsRUFBQzs7QUFFRCx1RDs7Ozs7O0FDdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVE7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EscUNBQW9DOztBQUVwQztBQUNBO0FBQ0EsbUJBQWtCO0FBQ2xCLGdCQUFlO0FBQ2Y7QUFDQTtBQUNBLElBQUc7O0FBRUg7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQSxJQUFHOztBQUVIO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsWUFBVztBQUNYO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSwrRkFBOEYsZUFBZTtBQUM3RyxRQUFPO0FBQ1A7QUFDQTtBQUNBLE1BQUs7QUFDTCxJQUFHOztBQUVIO0FBQ0E7QUFDQTtBQUNBLDZCQUE0QjtBQUM1QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHOztBQUVIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQVc7QUFDWCxVQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUDtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0E7QUFDQSxZQUFXO0FBQ1g7QUFDQTtBQUNBOztBQUVBO0FBQ0EsSUFBRzs7QUFFSDtBQUNBO0FBQ0EsZUFBYyxRQUFRO0FBQ3RCLGVBQWM7QUFDZDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRzs7QUFFSDtBQUNBO0FBQ0E7QUFDQTtBQUNBLGdCQUFlO0FBQ2Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxZQUFXO0FBQ1g7QUFDQTtBQUNBLFFBQU87QUFDUCxNQUFLO0FBQ0wsSUFBRzs7QUFFSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esa0JBQWlCO0FBQ2pCLGdCQUFlO0FBQ2YsY0FBYTtBQUNiO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsaURBQWdEO0FBQ2hELGNBQWEsSUFBSTtBQUNqQixZQUFXO0FBQ1g7QUFDQSxVQUFTO0FBQ1Q7QUFDQSwyQkFBMEIsd0NBQXdDO0FBQ2xFLE1BQUs7QUFDTCxJQUFHOztBQUVIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0EsTUFBSztBQUNMO0FBQ0EsRUFBQzs7QUFFRCw2Qjs7Ozs7O0FDOVFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQSxlQUFjLGFBQWE7QUFDM0IsZUFBYztBQUNkO0FBQ0E7QUFDQSxnRUFBK0QseUJBQXlCO0FBQ3hGO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBLGVBQWMsYUFBYTtBQUMzQixlQUFjLE9BQU87QUFDckIsZUFBYyxPQUFPO0FBQ3JCLGVBQWM7QUFDZDtBQUNBO0FBQ0EsMERBQXlEO0FBQ3pELCtEQUE4RCxZQUFZO0FBQzFFLElBQUc7QUFDSDtBQUNBO0FBQ0EsZUFBYyxNQUFNO0FBQ3BCLGVBQWM7QUFDZDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQSxlQUFjLGNBQWM7QUFDNUIsZUFBYyxPQUFPO0FBQ3JCLGVBQWMsT0FBTztBQUNyQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsWUFBVztBQUNYO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxnQkFBZTtBQUNmO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQSxZQUFXO0FBQ1g7QUFDQSxRQUFPO0FBQ1A7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQSxlQUFjLE9BQU87QUFDckIsZUFBYztBQUNkO0FBQ0E7QUFDQSxpQkFBZ0IsU0FBUyxFQUFFO0FBQzNCLGlCQUFnQixrQ0FBa0MsRUFBRTtBQUNwRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUDtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBLGVBQWMsY0FBYztBQUM1QixlQUFjLG9CQUFvQjtBQUNsQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBLGVBQWMsY0FBYztBQUM1QixlQUFjO0FBQ2Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHOztBQUVIO0FBQ0E7QUFDQSxlQUFjLGNBQWM7QUFDNUIsZUFBYyxvQkFBb0I7QUFDbEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRzs7QUFFSDtBQUNBO0FBQ0E7QUFDQTs7QUFFQSw4Qjs7Ozs7O0FDdFFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsWUFBVyxPQUFPO0FBQ2xCO0FBQ0E7QUFDQTtBQUNBLHFDQUFvQzs7QUFFcEM7QUFDQSxnQkFBZTtBQUNmO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxtQkFBa0I7QUFDbEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRzs7QUFFSDtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7O0FBRUg7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQSxNQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBLFFBQU87QUFDUDtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUDtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNULFFBQU87QUFDUDtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBLDBFQUF5RTtBQUN6RTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQSxNQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsSUFBRzs7QUFFSDtBQUNBLGtFQUFpRSxZQUFZO0FBQzdFO0FBQ0EsSUFBRzs7QUFFSDtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZ0JBQWU7QUFDZjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMOztBQUVBLEVBQUM7O0FBRUQ7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0EseUJBQXdCO0FBQ3hCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZ0JBQWU7QUFDZjtBQUNBO0FBQ0E7QUFDQTtBQUNBLDZDQUE0Qyx1REFBdUQ7QUFDbkcsSUFBRztBQUNIO0FBQ0E7QUFDQSxlQUFjO0FBQ2Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esa0JBQWlCO0FBQ2pCO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsbUdBQWtHO0FBQ2xHO0FBQ0E7QUFDQSxpQ0FBZ0M7QUFDaEM7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHlDQUF3QztBQUN4QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBLHVDQUFzQztBQUN0QyxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHNDQUFxQyx3QkFBd0I7QUFDN0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQSxtQ0FBa0M7QUFDbEM7QUFDQTtBQUNBLDRCQUEyQjtBQUMzQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGdCQUFlO0FBQ2Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0EsTUFBSzs7QUFFTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1QsUUFBTztBQUNQO0FBQ0E7QUFDQSxVQUFTO0FBQ1QsUUFBTztBQUNQLE1BQUs7O0FBRUw7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1AsTUFBSztBQUNMLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQSxnQkFBZTtBQUNmO0FBQ0E7QUFDQSx5REFBd0Q7QUFDeEQsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1AsTUFBSztBQUNMLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQSxvQkFBbUIsNEJBQTRCO0FBQy9DO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBLGNBQWEsZ0JBQWdCO0FBQzdCLGNBQWEsUUFBUTtBQUNyQixjQUFhLFFBQVE7QUFDckIsY0FBYSxTQUFTO0FBQ3RCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsWUFBVztBQUNYO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMLElBQUc7QUFDSDtBQUNBLHdCQUF1Qix3QkFBd0I7QUFDL0M7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQTtBQUNBLE1BQUs7QUFDTCxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSyxJQUFJO0FBQ1QsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTCxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBLE1BQUs7QUFDTDs7QUFFQSxFQUFDOztBQUVEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQSwwREFBeUQ7QUFDekQsMENBQXlDLDJCQUEyQjtBQUNwRSwwQ0FBeUMsMkJBQTJCO0FBQ3BFLDZDQUE0Qyw4QkFBOEI7QUFDMUU7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSzs7QUFFTDtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0EsRUFBQzs7O0FBR0Q7Ozs7Ozs7O0FDamxCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSwrQkFBOEI7QUFDOUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsMEQ7Ozs7OztBQzdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7O0FBRUE7QUFDQTs7QUFFQSxpRUFBZ0U7QUFDaEU7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0wsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBQzs7QUFFRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGNBQWE7QUFDYixZQUFXO0FBQ1g7QUFDQSxRQUFPO0FBQ1A7QUFDQTtBQUNBLEVBQUM7O0FBRUQ7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLCtCOzs7Ozs7QUN0S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHOzs7Ozs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxZQUFXLE1BQU07QUFDakI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRzs7QUFFSDtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQSxJQUFHOztBQUVIO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7OztBQUdIOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUM7O0FBRUQ7QUFDQTtBQUNBO0FBQ0E7QUFDQSxjQUFhLEtBQUs7QUFDbEIsZ0JBQWU7QUFDZjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQVc7QUFDWDtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUDtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsWUFBVztBQUNYO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQLElBQUc7QUFDSDtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBLEVBQUM7O0FBRUQsZ0M7Ozs7OztBQ3pRQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLFlBQVcsT0FBTztBQUNsQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsWUFBVztBQUNYO0FBQ0EsUUFBTztBQUNQO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUCxNQUFLO0FBQ0wsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUCxNQUFLO0FBQ0wsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsWUFBVztBQUNYLFVBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7O0FBRUEsTUFBSztBQUNMO0FBQ0EsRUFBQzs7QUFFRCxrQzs7Ozs7O0FDeklBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsWUFBVyxPQUFPO0FBQ2xCO0FBQ0E7QUFDQTtBQUNBOzs7QUFHQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGdCQUFlLFlBQVk7QUFDM0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQSxFQUFDOztBQUVELGdDOzs7Ozs7QUN2REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsWUFBVyxPQUFPO0FBQ2xCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQVc7QUFDWDtBQUNBLFFBQU87QUFDUDtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTCxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTCxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxZQUFXO0FBQ1gsVUFBUztBQUNUO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0wsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBLGdCQUFlLFlBQVk7QUFDM0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsRUFBQzs7QUFFRCxpQzs7Ozs7O0FDOUlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLFlBQVcsT0FBTztBQUNsQjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLElBQUc7O0FBRUg7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQTtBQUNBLFFBQU87QUFDUDtBQUNBO0FBQ0EsSUFBRzs7QUFFSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7O0FBRUg7QUFDQTs7QUFFQSxrQ0FBaUM7O0FBRWpDO0FBQ0E7QUFDQTtBQUNBLGNBQWEsY0FBYztBQUMzQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQVc7QUFDWDtBQUNBO0FBQ0EsWUFBVztBQUNYO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQTtBQUNBOztBQUVBLEVBQUM7O0FBRUQ7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0EsRUFBQzs7QUFFRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1AsTUFBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBLGNBQWEsT0FBTztBQUNwQixjQUFhLFFBQVE7QUFDckIsZ0JBQWUsaUJBQWlCO0FBQ2hDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTCxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQVc7QUFDWCxVQUFTO0FBQ1Q7QUFDQTtBQUNBLFFBQU87QUFDUDtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNULFFBQU87QUFDUDtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0wsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQSxnQkFBZTtBQUNmO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMLElBQUc7O0FBRUg7QUFDQTtBQUNBO0FBQ0EsSUFBRzs7QUFFSDtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7O0FBRUg7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0wsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQVc7QUFDWCxVQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0Esb0JBQW1CO0FBQ25COztBQUVBLEVBQUM7O0FBRUQsb0M7Ozs7OztBQ2pUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFdBQVU7QUFDVjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDhEQUE2RCxpQkFBaUI7QUFDOUUsb0VBQW1FLGlCQUFpQjtBQUNwRjtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBQyxFOzs7Ozs7QUNwR0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxZQUFXLE1BQU07QUFDakIsWUFBVyxPQUFPO0FBQ2xCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZ0dBQStGLFdBQVc7QUFDMUc7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBQzs7QUFFRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMLElBQUc7QUFDSDtBQUNBLHdCQUF1QjtBQUN2QixJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG9CQUFtQixtQkFBbUI7QUFDdEM7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGlCQUFnQjtBQUNoQixRQUFPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUssZ0JBQWdCO0FBQ3JCLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDBCQUF5QixpQkFBaUI7QUFDMUM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsY0FBYTtBQUNiO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNULE1BQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsaUJBQWdCO0FBQ2hCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0Esb0JBQW1CLG1CQUFtQjtBQUN0QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQSxFQUFDOztBQUVELHdCOzs7Ozs7QUN2VEE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsY0FBYTtBQUNiO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esd0JBQXVCO0FBQ3ZCO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUDtBQUNBO0FBQ0EscURBQW9ELCtCQUErQjtBQUNuRiwwQkFBeUIsY0FBYztBQUN2QztBQUNBO0FBQ0E7QUFDQTtBQUNBLHNCQUFxQixpQkFBaUI7QUFDdEM7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSx3QkFBdUI7QUFDdkI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBLDRDQUEyQyxTQUFTO0FBQ3BEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLGdDOzs7Ozs7QUN2SkE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBLEc7Ozs7OztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSx1REFBc0Q7QUFDdEQ7QUFDQSxVQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0EsWUFBVztBQUNYO0FBQ0E7QUFDQSxVQUFTO0FBQ1QsUUFBTztBQUNQO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7O0FBRUg7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGFBQVk7QUFDWjtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTCxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQVc7QUFDWDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0wsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQVc7QUFDWDtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0EsRUFBQzs7QUFFRDtBQUNBO0FBQ0E7QUFDQSwwQkFBeUI7QUFDekIsSUFB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QjtBQUN0QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG9EQUFtRCxlQUFlO0FBQ2xFOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsY0FBYSxjQUFjO0FBQzNCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSzs7QUFFTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxxQkFBb0I7QUFDcEIsWUFBVztBQUNYO0FBQ0E7QUFDQSx1QkFBc0I7QUFDdEI7QUFDQTs7QUFFQSxNQUFLO0FBQ0w7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBUzs7QUFFVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7O0FBRVQ7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1QsUUFBTztBQUNQO0FBQ0E7QUFDQSxRQUFPOztBQUVQOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGdCQUFlO0FBQ2YsY0FBYTtBQUNiLFlBQVc7QUFDWCxVQUFT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Q0E7QUFDQTtBQUNBLE1BQUs7O0FBRUw7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsOEJBQTZCO0FBQzdCO0FBQ0EsOEJBQTZCO0FBQzdCLE1BQUs7QUFDTDtBQUNBO0FBQ0EsOEJBQTZCO0FBQzdCO0FBQ0EsOEJBQTZCO0FBQzdCO0FBQ0E7O0FBRUE7O0FBRUE7O0FBRUE7QUFDQTs7QUFFQSxvQkFBbUIsb0JBQW9CO0FBQ3ZDO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQOztBQUVBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQSxvQkFBbUIsMEJBQTBCO0FBQzdDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLE1BQUs7O0FBRUw7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxzREFBcUQ7QUFDckQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUM7Ozs7Ozs7O0FDNW5DRDs7QUFFQTtBQUNB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UTtBQUNSO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsMERBQXlEO0FBQ3pELE1BQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1AsTUFBSztBQUNMO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0EsY0FBYSxTQUFTO0FBQ3RCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZ0RBQStDO0FBQy9DLE1BQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDhEQUE2RDtBQUM3RDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQLE1BQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBLHdCOzs7Ozs7O0FDN0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7O0FBR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHOztBQUVIO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsWUFBVyxPQUFPO0FBQ2xCO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQTtBQUNBLElBQUc7QUFDSDs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxhQUFZLE9BQU87QUFDbkI7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTs7Ozs7OztBQzdKQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQSxFOzs7Ozs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDRDQUEyQyxpQkFBaUI7O0FBRTVEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7O0FBRUg7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsRzs7Ozs7OztBQzNFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxrQkFBaUI7QUFDakI7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG9CQUFtQixTQUFTO0FBQzVCO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0EsZ0JBQWUsU0FBUztBQUN4Qjs7QUFFQTtBQUNBO0FBQ0EsZ0JBQWUsU0FBUztBQUN4QjtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSxJQUFHO0FBQ0gscUJBQW9CLFNBQVM7QUFDN0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOzs7Ozs7O3lCQzVTQSwyREFBYSwyQkFBMkUsMkRBQTJELEtBQUssTUFBTSwwSEFBMEgsWUFBWSwwQkFBMEIsMEJBQTBCLGdCQUFnQixVQUFVLFVBQVUsMENBQTBDLDhCQUF3QixvQkFBb0IsOENBQThDLGtDQUFrQyxZQUFZLFlBQVksbUNBQW1DLGlCQUFpQixnQkFBZ0Isc0JBQXNCLG9CQUFvQiwwQ0FBMEMsWUFBWSxXQUFXLFlBQVksU0FBUyxHQUFHO0FBQ2p3Qjs7QUFFQTs7QUFFQTtBQUNBLEVBQUMsR0FBRztBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFDLEVBQUUsdUVBQXVFO0FBQzFFO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBQyxFQUFFLHFEQUFxRDtBQUN4RDs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUMsRUFBRSw4REFBOEQ7QUFDakU7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFHQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTs7QUFFQTtBQUNBOztBQUVBLEVBQUMsRUFBRSxrRkFBa0Y7QUFDckY7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUMsRUFBRSw2QkFBNkI7QUFDaEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0EsRUFBQyxFQUFFLHVFQUF1RTtBQUMxRTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUMsRUFBRSw0Q0FBNEM7QUFDL0M7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFDLEVBQUUsNENBQTRDO0FBQy9DO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFDLEVBQUUsK0JBQStCO0FBQ2xDOztBQUVBO0FBQ0E7QUFDQTtBQUNBLEVBQUMsR0FBRztBQUNKOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUMsR0FBRztBQUNKOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQSxFQUFDLEVBQUUsOEJBQThCOztBQUVqQyxFQUFDLEdBQUc7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUMsRUFBRSwyRkFBMkY7QUFDOUY7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNB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QTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQVcsY0FBYztBQUN6QixZQUFXLE9BQU87QUFDbEIsYUFBWTtBQUNaO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsWUFBVyxPQUFPO0FBQ2xCLGFBQVk7QUFDWjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxZQUFXLE9BQU87QUFDbEIsYUFBWTtBQUNaO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsWUFBVyxPQUFPO0FBQ2xCLGFBQVk7QUFDWjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwic291cmNlc0NvbnRlbnQiOlsiIFx0Ly8gVGhlIG1vZHVsZSBjYWNoZVxuIFx0dmFyIGluc3RhbGxlZE1vZHVsZXMgPSB7fTtcblxuIFx0Ly8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbiBcdGZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblxuIFx0XHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcbiBcdFx0aWYoaW5zdGFsbGVkTW9kdWxlc1ttb2R1bGVJZF0pXG4gXHRcdFx0cmV0dXJuIGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdLmV4cG9ydHM7XG5cbiBcdFx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcbiBcdFx0dmFyIG1vZHVsZSA9IGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdID0ge1xuIFx0XHRcdGV4cG9ydHM6IHt9LFxuIFx0XHRcdGlkOiBtb2R1bGVJZCxcbiBcdFx0XHRsb2FkZWQ6IGZhbHNlXG4gXHRcdH07XG5cbiBcdFx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG4gXHRcdG1vZHVsZXNbbW9kdWxlSWRdLmNhbGwobW9kdWxlLmV4cG9ydHMsIG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG4gXHRcdC8vIEZsYWcgdGhlIG1vZHVsZSBhcyBsb2FkZWRcbiBcdFx0bW9kdWxlLmxvYWRlZCA9IHRydWU7XG5cbiBcdFx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcbiBcdFx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xuIFx0fVxuXG5cbiBcdC8vIGV4cG9zZSB0aGUgbW9kdWxlcyBvYmplY3QgKF9fd2VicGFja19tb2R1bGVzX18pXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLm0gPSBtb2R1bGVzO1xuXG4gXHQvLyBleHBvc2UgdGhlIG1vZHVsZSBjYWNoZVxuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5jID0gaW5zdGFsbGVkTW9kdWxlcztcblxuIFx0Ly8gX193ZWJwYWNrX3B1YmxpY19wYXRoX19cbiBcdF9fd2VicGFja19yZXF1aXJlX18ucCA9IFwiXCI7XG5cbiBcdC8vIExvYWQgZW50cnkgbW9kdWxlIGFuZCByZXR1cm4gZXhwb3J0c1xuIFx0cmV0dXJuIF9fd2VicGFja19yZXF1aXJlX18oMCk7XG5cblxuLyoqIFdFQlBBQ0sgRk9PVEVSICoqXG4gKiogd2VicGFjay9ib290c3RyYXAgYTk2OTc3MTA0NWQ2N2RhMDk5MjhcbiAqKi8iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICBDb2xsZWN0aW9uUmVnaXN0cnkgPSByZXF1aXJlKCcuL2NvbGxlY3Rpb25SZWdpc3RyeScpLkNvbGxlY3Rpb25SZWdpc3RyeSxcbiAgQ29sbGVjdGlvbiA9IHJlcXVpcmUoJy4vY29sbGVjdGlvbicpLFxuICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKSxcbiAgTW9kZWwgPSByZXF1aXJlKCcuL21vZGVsJyksXG4gIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICBSZWxhdGlvbnNoaXBUeXBlID0gcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBUeXBlJyksXG4gIFJlYWN0aXZlUXVlcnkgPSByZXF1aXJlKCcuL1JlYWN0aXZlUXVlcnknKSxcbiAgTWFueVRvTWFueVByb3h5ID0gcmVxdWlyZSgnLi9NYW55VG9NYW55UHJveHknKSxcbiAgT25lVG9PbmVQcm94eSA9IHJlcXVpcmUoJy4vT25lVG9PbmVQcm94eScpLFxuICBPbmVUb01hbnlQcm94eSA9IHJlcXVpcmUoJy4vT25lVG9NYW55UHJveHknKSxcbiAgUmVsYXRpb25zaGlwUHJveHkgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFByb3h5JyksXG4gIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICBRdWVyeSA9IHJlcXVpcmUoJy4vUXVlcnknKSxcbiAgcXVlcnlTZXQgPSByZXF1aXJlKCcuL1F1ZXJ5U2V0JyksXG4gIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyk7XG5cbnV0aWwuX3BhdGNoQmluZCgpO1xuXG4vLyBJbml0aWFsaXNlIHNpZXN0YSBvYmplY3QuIFN0cmFuZ2UgZm9ybWF0IGZhY2lsaXRpZXMgdXNpbmcgc3VibW9kdWxlcyB3aXRoIHJlcXVpcmVKUyAoZXZlbnR1YWxseSlcbnZhciBzaWVzdGEgPSBmdW5jdGlvbihleHQpIHtcbiAgaWYgKCFzaWVzdGEuZXh0KSBzaWVzdGEuZXh0ID0ge307XG4gIHV0aWwuZXh0ZW5kKHNpZXN0YS5leHQsIGV4dCB8fCB7fSk7XG4gIHJldHVybiBzaWVzdGE7XG59O1xuXG4vLyBOb3RpZmljYXRpb25zXG51dGlsLmV4dGVuZChzaWVzdGEsIHtcbiAgb246IGV2ZW50cy5vbi5iaW5kKGV2ZW50cyksXG4gIG9mZjogZXZlbnRzLnJlbW92ZUxpc3RlbmVyLmJpbmQoZXZlbnRzKSxcbiAgb25jZTogZXZlbnRzLm9uY2UuYmluZChldmVudHMpLFxuICByZW1vdmVBbGxMaXN0ZW5lcnM6IGV2ZW50cy5yZW1vdmVBbGxMaXN0ZW5lcnMuYmluZChldmVudHMpXG59KTtcbnV0aWwuZXh0ZW5kKHNpZXN0YSwge1xuICByZW1vdmVMaXN0ZW5lcjogc2llc3RhLm9mZixcbiAgYWRkTGlzdGVuZXI6IHNpZXN0YS5vblxufSk7XG5cbi8vIEV4cG9zZSBzb21lIHN0dWZmIGZvciB1c2FnZSBieSBleHRlbnNpb25zIGFuZC9vciB1c2Vyc1xudXRpbC5leHRlbmQoc2llc3RhLCB7XG4gIFJlbGF0aW9uc2hpcFR5cGU6IFJlbGF0aW9uc2hpcFR5cGUsXG4gIE1vZGVsRXZlbnRUeXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZSxcbiAgbG9nOiBsb2cuTGV2ZWwsXG4gIEluc2VydGlvblBvbGljeTogUmVhY3RpdmVRdWVyeS5JbnNlcnRpb25Qb2xpY3ksXG4gIF9pbnRlcm5hbDoge1xuICAgIGxvZzogbG9nLFxuICAgIE1vZGVsOiBNb2RlbCxcbiAgICBlcnJvcjogZXJyb3IsXG4gICAgTW9kZWxFdmVudFR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLFxuICAgIE1vZGVsSW5zdGFuY2U6IHJlcXVpcmUoJy4vTW9kZWxJbnN0YW5jZScpLFxuICAgIGV4dGVuZDogcmVxdWlyZSgnZXh0ZW5kJyksXG4gICAgTWFwcGluZ09wZXJhdGlvbjogcmVxdWlyZSgnLi9tYXBwaW5nT3BlcmF0aW9uJyksXG4gICAgZXZlbnRzOiBldmVudHMsXG4gICAgUHJveHlFdmVudEVtaXR0ZXI6IGV2ZW50cy5Qcm94eUV2ZW50RW1pdHRlcixcbiAgICBjYWNoZTogcmVxdWlyZSgnLi9jYWNoZScpLFxuICAgIG1vZGVsRXZlbnRzOiBtb2RlbEV2ZW50cyxcbiAgICBDb2xsZWN0aW9uUmVnaXN0cnk6IHJlcXVpcmUoJy4vY29sbGVjdGlvblJlZ2lzdHJ5JykuQ29sbGVjdGlvblJlZ2lzdHJ5LFxuICAgIENvbGxlY3Rpb246IENvbGxlY3Rpb24sXG4gICAgdXRpbHM6IHV0aWwsXG4gICAgdXRpbDogdXRpbCxcbiAgICBxdWVyeVNldDogcXVlcnlTZXQsXG4gICAgb2JzZXJ2ZTogcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKSxcbiAgICBRdWVyeTogUXVlcnksXG4gICAgTWFueVRvTWFueVByb3h5OiBNYW55VG9NYW55UHJveHksXG4gICAgT25lVG9NYW55UHJveHk6IE9uZVRvTWFueVByb3h5LFxuICAgIE9uZVRvT25lUHJveHk6IE9uZVRvT25lUHJveHksXG4gICAgUmVsYXRpb25zaGlwUHJveHk6IFJlbGF0aW9uc2hpcFByb3h5XG4gIH0sXG4gIGlzQXJyYXk6IHV0aWwuaXNBcnJheSxcbiAgaXNTdHJpbmc6IHV0aWwuaXNTdHJpbmdcbn0pO1xuXG5zaWVzdGEuZXh0ID0ge307XG5cbnZhciBpbnN0YWxsZWQgPSBmYWxzZSxcbiAgaW5zdGFsbGluZyA9IGZhbHNlO1xuXG5cbnV0aWwuZXh0ZW5kKHNpZXN0YSwge1xuICAvKipcbiAgICogV2lwZSBldmVyeXRoaW5nLiBVc2VkIGR1cmluZyB0ZXN0IGdlbmVyYWxseS5cbiAgICovXG4gIHJlc2V0OiBmdW5jdGlvbihjYiwgcmVzZXRTdG9yYWdlKSB7XG4gICAgaW5zdGFsbGVkID0gZmFsc2U7XG4gICAgaW5zdGFsbGluZyA9IGZhbHNlO1xuICAgIGRlbGV0ZSB0aGlzLnF1ZXVlZFRhc2tzO1xuICAgIGNhY2hlLnJlc2V0KCk7XG4gICAgQ29sbGVjdGlvblJlZ2lzdHJ5LnJlc2V0KCk7XG4gICAgZXZlbnRzLnJlbW92ZUFsbExpc3RlbmVycygpO1xuICAgIGlmIChzaWVzdGEuZXh0LnN0b3JhZ2VFbmFibGVkKSB7XG4gICAgICByZXNldFN0b3JhZ2UgPSByZXNldFN0b3JhZ2UgPT09IHVuZGVmaW5lZCA/IHRydWUgOiByZXNldFN0b3JhZ2U7XG4gICAgICBpZiAocmVzZXRTdG9yYWdlKSBzaWVzdGEuZXh0LnN0b3JhZ2UuX3Jlc2V0KGNiKTtcbiAgICAgIGVsc2UgY2IoKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBjYigpO1xuICAgIH1cbiAgfSxcbiAgLyoqXG4gICAqIENyZWF0ZXMgYW5kIHJlZ2lzdGVycyBhIG5ldyBDb2xsZWN0aW9uLlxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBbb3B0c11cbiAgICogQHJldHVybiB7Q29sbGVjdGlvbn1cbiAgICovXG4gIGNvbGxlY3Rpb246IGZ1bmN0aW9uKG5hbWUsIG9wdHMpIHtcbiAgICB2YXIgYyA9IG5ldyBDb2xsZWN0aW9uKG5hbWUsIG9wdHMpO1xuICAgIGlmIChpbnN0YWxsZWQpIGMuaW5zdGFsbGVkID0gdHJ1ZTsgLy8gVE9ETzogUmVtb3ZlXG4gICAgcmV0dXJuIGM7XG4gIH0sXG4gIC8qKlxuICAgKiBJbnN0YWxsIGFsbCBjb2xsZWN0aW9ucy5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NiXVxuICAgKiBAcmV0dXJucyB7cS5Qcm9taXNlfVxuICAgKi9cbiAgaW5zdGFsbDogZnVuY3Rpb24oY2IpIHtcbiAgICBpZiAoIWluc3RhbGxpbmcgJiYgIWluc3RhbGxlZCkge1xuICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgaW5zdGFsbGluZyA9IHRydWU7XG4gICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZXMgPSBDb2xsZWN0aW9uUmVnaXN0cnkuY29sbGVjdGlvbk5hbWVzLFxuICAgICAgICAgIHRhc2tzID0gY29sbGVjdGlvbk5hbWVzLm1hcChmdW5jdGlvbihuKSB7XG4gICAgICAgICAgICB2YXIgY29sbGVjdGlvbiA9IENvbGxlY3Rpb25SZWdpc3RyeVtuXTtcbiAgICAgICAgICAgIHJldHVybiBjb2xsZWN0aW9uLmluc3RhbGwuYmluZChjb2xsZWN0aW9uKTtcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBzdG9yYWdlRW5hYmxlZCA9IHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQ7XG4gICAgICAgIGlmIChzdG9yYWdlRW5hYmxlZCkgdGFza3MgPSB0YXNrcy5jb25jYXQoW3NpZXN0YS5leHQuc3RvcmFnZS5lbnN1cmVJbmRleGVzRm9yQWxsLCBzaWVzdGEuZXh0LnN0b3JhZ2UuX2xvYWRdKTtcbiAgICAgICAgdGFza3MucHVzaChmdW5jdGlvbihkb25lKSB7XG4gICAgICAgICAgaW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgICBpZiAodGhpcy5xdWV1ZWRUYXNrcykgdGhpcy5xdWV1ZWRUYXNrcy5leGVjdXRlKCk7XG4gICAgICAgICAgZG9uZSgpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB1dGlsLnNlcmllcyh0YXNrcywgY2IpO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG4gICAgZWxzZSBjYihlcnJvcignYWxyZWFkeSBpbnN0YWxsaW5nJykpO1xuICB9LFxuICBfcHVzaFRhc2s6IGZ1bmN0aW9uKHRhc2spIHtcbiAgICBpZiAoIXRoaXMucXVldWVkVGFza3MpIHtcbiAgICAgIHRoaXMucXVldWVkVGFza3MgPSBuZXcgZnVuY3Rpb24gUXVldWUoKSB7XG4gICAgICAgIHRoaXMudGFza3MgPSBbXTtcbiAgICAgICAgdGhpcy5leGVjdXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdGhpcy50YXNrcy5mb3JFYWNoKGZ1bmN0aW9uKGYpIHtcbiAgICAgICAgICAgIGYoKVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHRoaXMudGFza3MgPSBbXTtcbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgfTtcbiAgICB9XG4gICAgdGhpcy5xdWV1ZWRUYXNrcy50YXNrcy5wdXNoKHRhc2spO1xuICB9LFxuICBfYWZ0ZXJJbnN0YWxsOiBmdW5jdGlvbih0YXNrKSB7XG4gICAgaWYgKCFpbnN0YWxsZWQpIHtcbiAgICAgIGlmICghaW5zdGFsbGluZykge1xuICAgICAgICB0aGlzLmluc3RhbGwoZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3Igc2V0dGluZyB1cCBzaWVzdGEnLCBlcnIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBkZWxldGUgdGhpcy5xdWV1ZWRUYXNrcztcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgIH1cbiAgICAgIC8vIEluIGNhc2UgaW5zdGFsbGVkIHN0cmFpZ2h0IGF3YXkgZS5nLiBpZiBzdG9yYWdlIGV4dGVuc2lvbiBub3QgaW5zdGFsbGVkLlxuICAgICAgaWYgKCFpbnN0YWxsZWQpIHRoaXMuX3B1c2hUYXNrKHRhc2spO1xuICAgICAgZWxzZSB0YXNrKCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGFzaygpO1xuICAgIH1cbiAgfSxcbiAgc2V0TG9nTGV2ZWw6IGZ1bmN0aW9uKGxvZ2dlck5hbWUsIGxldmVsKSB7XG4gICAgdmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZShsb2dnZXJOYW1lKTtcbiAgICBMb2dnZXIuc2V0TGV2ZWwobGV2ZWwpO1xuICB9LFxuICBncmFwaDogZnVuY3Rpb24oZGF0YSwgb3B0cywgY2IpIHtcbiAgICBpZiAodHlwZW9mIG9wdHMgPT0gJ2Z1bmN0aW9uJykgY2IgPSBvcHRzO1xuICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICB2YXIgdGFza3MgPSBbXSwgZXJyO1xuICAgICAgZm9yICh2YXIgY29sbGVjdGlvbk5hbWUgaW4gZGF0YSkge1xuICAgICAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eShjb2xsZWN0aW9uTmFtZSkpIHtcbiAgICAgICAgICB2YXIgY29sbGVjdGlvbiA9IENvbGxlY3Rpb25SZWdpc3RyeVtjb2xsZWN0aW9uTmFtZV07XG4gICAgICAgICAgaWYgKGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgIChmdW5jdGlvbihjb2xsZWN0aW9uLCBkYXRhKSB7XG4gICAgICAgICAgICAgIHRhc2tzLnB1c2goZnVuY3Rpb24oZG9uZSkge1xuICAgICAgICAgICAgICAgIGNvbGxlY3Rpb24uZ3JhcGgoZGF0YSwgZnVuY3Rpb24oZXJyLCByZXMpIHtcbiAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciByZXN1bHRzID0ge307XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHNbY29sbGVjdGlvbi5uYW1lXSA9IHJlcztcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGRvbmUoZXJyLCByZXN1bHRzKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KShjb2xsZWN0aW9uLCBkYXRhW2NvbGxlY3Rpb25OYW1lXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgZXJyID0gJ05vIHN1Y2ggY29sbGVjdGlvbiBcIicgKyBjb2xsZWN0aW9uTmFtZSArICdcIic7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoIWVycikge1xuICAgICAgICB1dGlsLnNlcmllcyh0YXNrcywgZnVuY3Rpb24oZXJyLCByZXN1bHRzKSB7XG4gICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLnJlZHVjZShmdW5jdGlvbihtZW1vLCByZXMpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHV0aWwuZXh0ZW5kKG1lbW8sIHJlcyk7XG4gICAgICAgICAgICB9LCB7fSlcbiAgICAgICAgICB9IGVsc2UgcmVzdWx0cyA9IG51bGw7XG4gICAgICAgICAgY2IoZXJyLCByZXN1bHRzKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIGNiKGVycm9yKGVyciwge2RhdGE6IGRhdGEsIGludmFsaWRDb2xsZWN0aW9uTmFtZTogY29sbGVjdGlvbk5hbWV9KSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgbm90aWZ5OiB1dGlsLm5leHQsXG4gIHJlZ2lzdGVyQ29tcGFyYXRvcjogUXVlcnkucmVnaXN0ZXJDb21wYXJhdG9yLmJpbmQoUXVlcnkpLFxuICBjb3VudDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIGNhY2hlLmNvdW50KCk7XG4gIH0sXG4gIGdldDogZnVuY3Rpb24oaWQsIGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIHRoaXMuX2FmdGVySW5zdGFsbChmdW5jdGlvbigpIHtcbiAgICAgICAgY2IobnVsbCwgY2FjaGUuX2xvY2FsQ2FjaGUoKVtpZF0pO1xuICAgICAgfSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgcmVtb3ZlQWxsOiBmdW5jdGlvbihjYikge1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICB1dGlsLlByb21pc2UuYWxsKFxuICAgICAgICBDb2xsZWN0aW9uUmVnaXN0cnkuY29sbGVjdGlvbk5hbWVzLm1hcChmdW5jdGlvbihjb2xsZWN0aW9uTmFtZSkge1xuICAgICAgICAgIHJldHVybiBDb2xsZWN0aW9uUmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdLnJlbW92ZUFsbCgpO1xuICAgICAgICB9LmJpbmQodGhpcykpXG4gICAgICApLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgY2IobnVsbCk7XG4gICAgICAgIH0pLmNhdGNoKGNiKVxuICAgIH0uYmluZCh0aGlzKSk7XG4gIH1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydGllcyhzaWVzdGEsIHtcbiAgX2NhbkNoYW5nZToge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gIShpbnN0YWxsaW5nIHx8IGluc3RhbGxlZCk7XG4gICAgfVxuICB9LFxuICBpbnN0YWxsZWQ6IHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGluc3RhbGxlZDtcbiAgICB9XG4gIH1cbn0pO1xuXG5pZiAodHlwZW9mIHdpbmRvdyAhPSAndW5kZWZpbmVkJykge1xuICB3aW5kb3dbJ3NpZXN0YSddID0gc2llc3RhO1xufVxuXG5zaWVzdGEubG9nID0gcmVxdWlyZSgnZGVidWcnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBzaWVzdGE7XG5cbihmdW5jdGlvbiBsb2FkRXh0ZW5zaW9ucygpIHtcbiAgcmVxdWlyZSgnLi4vc3RvcmFnZScpO1xufSkoKTtcblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9pbmRleC5qc1xuICoqIG1vZHVsZSBpZCA9IDBcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciBvYnNlcnZlID0gcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5QbGF0Zm9ybSxcbiAgUHJvbWlzZSA9IHJlcXVpcmUoJ2xpZScpLFxuICBhcmdzYXJyYXkgPSByZXF1aXJlKCdhcmdzYXJyYXknKSxcbiAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yO1xuXG52YXIgZXh0ZW5kID0gZnVuY3Rpb24obGVmdCwgcmlnaHQpIHtcbiAgZm9yICh2YXIgcHJvcCBpbiByaWdodCkge1xuICAgIGlmIChyaWdodC5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgbGVmdFtwcm9wXSA9IHJpZ2h0W3Byb3BdO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbGVmdDtcbn07XG5cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSxcbiAgaXNTdHJpbmcgPSBmdW5jdGlvbihvKSB7XG4gICAgcmV0dXJuIHR5cGVvZiBvID09ICdzdHJpbmcnIHx8IG8gaW5zdGFuY2VvZiBTdHJpbmdcbiAgfTtcblxuZXh0ZW5kKG1vZHVsZS5leHBvcnRzLCB7XG4gIGFyZ3NhcnJheTogYXJnc2FycmF5LFxuICAvKipcbiAgICogUGVyZm9ybXMgZGlydHkgY2hlY2svT2JqZWN0Lm9ic2VydmUgY2FsbGJhY2tzIGRlcGVuZGluZyBvbiB0aGUgYnJvd3Nlci5cbiAgICpcbiAgICogSWYgT2JqZWN0Lm9ic2VydmUgaXMgcHJlc2VudCxcbiAgICogQHBhcmFtIGNhbGxiYWNrXG4gICAqL1xuICBuZXh0OiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgIG9ic2VydmUucGVyZm9ybU1pY3JvdGFza0NoZWNrcG9pbnQoKTtcbiAgICBzZXRUaW1lb3V0KGNhbGxiYWNrKTtcbiAgfSxcbiAgZXh0ZW5kOiBleHRlbmQsXG4gIGd1aWQ6IChmdW5jdGlvbigpIHtcbiAgICBmdW5jdGlvbiBzNCgpIHtcbiAgICAgIHJldHVybiBNYXRoLmZsb29yKCgxICsgTWF0aC5yYW5kb20oKSkgKiAweDEwMDAwKVxuICAgICAgICAudG9TdHJpbmcoMTYpXG4gICAgICAgIC5zdWJzdHJpbmcoMSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHM0KCkgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyAnLScgK1xuICAgICAgICBzNCgpICsgJy0nICsgczQoKSArIHM0KCkgKyBzNCgpO1xuICAgIH07XG4gIH0pKCksXG4gIGFzc2VydDogZnVuY3Rpb24oY29uZGl0aW9uLCBtZXNzYWdlLCBjb250ZXh0KSB7XG4gICAgaWYgKCFjb25kaXRpb24pIHtcbiAgICAgIG1lc3NhZ2UgPSBtZXNzYWdlIHx8IFwiQXNzZXJ0aW9uIGZhaWxlZFwiO1xuICAgICAgY29udGV4dCA9IGNvbnRleHQgfHwge307XG4gICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihtZXNzYWdlLCBjb250ZXh0KTtcbiAgICB9XG4gIH0sXG4gIHBsdWNrOiBmdW5jdGlvbihjb2xsLCBrZXkpIHtcbiAgICByZXR1cm4gY29sbC5tYXAoZnVuY3Rpb24obykge3JldHVybiBvW2tleV19KTtcbiAgfSxcbiAgdGhlbkJ5OiAoZnVuY3Rpb24oKSB7XG4gICAgLyogbWl4aW4gZm9yIHRoZSBgdGhlbkJ5YCBwcm9wZXJ0eSAqL1xuICAgIGZ1bmN0aW9uIGV4dGVuZChmKSB7XG4gICAgICBmLnRoZW5CeSA9IHRiO1xuICAgICAgcmV0dXJuIGY7XG4gICAgfVxuXG4gICAgLyogYWRkcyBhIHNlY29uZGFyeSBjb21wYXJlIGZ1bmN0aW9uIHRvIHRoZSB0YXJnZXQgZnVuY3Rpb24gKGB0aGlzYCBjb250ZXh0KVxuICAgICB3aGljaCBpcyBhcHBsaWVkIGluIGNhc2UgdGhlIGZpcnN0IG9uZSByZXR1cm5zIDAgKGVxdWFsKVxuICAgICByZXR1cm5zIGEgbmV3IGNvbXBhcmUgZnVuY3Rpb24sIHdoaWNoIGhhcyBhIGB0aGVuQnlgIG1ldGhvZCBhcyB3ZWxsICovXG4gICAgZnVuY3Rpb24gdGIoeSkge1xuICAgICAgdmFyIHggPSB0aGlzO1xuICAgICAgcmV0dXJuIGV4dGVuZChmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgIHJldHVybiB4KGEsIGIpIHx8IHkoYSwgYik7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gZXh0ZW5kO1xuICB9KSgpLFxuICAvKipcbiAgICogVE9ETzogVGhpcyBpcyBibG9vZHkgdWdseS5cbiAgICogUHJldHR5IGRhbW4gdXNlZnVsIHRvIGJlIGFibGUgdG8gYWNjZXNzIHRoZSBib3VuZCBvYmplY3Qgb24gYSBmdW5jdGlvbiB0aG8uXG4gICAqIFNlZTogaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8xNDMwNzI2NC93aGF0LW9iamVjdC1qYXZhc2NyaXB0LWZ1bmN0aW9uLWlzLWJvdW5kLXRvLXdoYXQtaXMtaXRzLXRoaXNcbiAgICovXG4gIF9wYXRjaEJpbmQ6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBfYmluZCA9IEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseS5iaW5kKEZ1bmN0aW9uLnByb3RvdHlwZS5iaW5kKTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoRnVuY3Rpb24ucHJvdG90eXBlLCAnYmluZCcsIHtcbiAgICAgIHZhbHVlOiBmdW5jdGlvbihvYmopIHtcbiAgICAgICAgdmFyIGJvdW5kRnVuY3Rpb24gPSBfYmluZCh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoYm91bmRGdW5jdGlvbiwgJ19fc2llc3RhX2JvdW5kX29iamVjdCcsIHtcbiAgICAgICAgICB2YWx1ZTogb2JqLFxuICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGJvdW5kRnVuY3Rpb247XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG4gIFByb21pc2U6IFByb21pc2UsXG4gIHByb21pc2U6IGZ1bmN0aW9uKGNiLCBmbikge1xuICAgIGNiID0gY2IgfHwgZnVuY3Rpb24oKSB7fTtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICB2YXIgX2NiID0gYXJnc2FycmF5KGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICAgICAgdmFyIGVyciA9IGFyZ3NbMF0sXG4gICAgICAgICAgcmVzdCA9IGFyZ3Muc2xpY2UoMSk7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdVbmNhdWdodCBlcnJvciBkdXJpbmcgcHJvbWlzZSByZWplY3Rpb24nLCBlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJlc29sdmUocmVzdFswXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICByZWplY3QoZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdVbmNhdWdodCBlcnJvciBkdXJpbmcgcHJvbWlzZSByZWplY3Rpb24nLCBlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGJvdW5kID0gY2JbJ19fc2llc3RhX2JvdW5kX29iamVjdCddIHx8IGNiOyAvLyBQcmVzZXJ2ZSBib3VuZCBvYmplY3QuXG4gICAgICAgIGNiLmFwcGx5KGJvdW5kLCBhcmdzKTtcbiAgICAgIH0pO1xuICAgICAgZm4oX2NiKTtcbiAgICB9KVxuICB9LFxuICBkZWZlcjogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHJlc29sdmUsIHJlamVjdDtcbiAgICB2YXIgcCA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKF9yZXNvbHZlLCBfcmVqZWN0KSB7XG4gICAgICByZXNvbHZlID0gX3Jlc29sdmU7XG4gICAgICByZWplY3QgPSBfcmVqZWN0O1xuICAgIH0pO1xuICAgIC8vbm9pbnNwZWN0aW9uIEpTVW51c2VkQXNzaWdubWVudFxuICAgIHAucmVzb2x2ZSA9IHJlc29sdmU7XG4gICAgLy9ub2luc3BlY3Rpb24gSlNVbnVzZWRBc3NpZ25tZW50XG4gICAgcC5yZWplY3QgPSByZWplY3Q7XG4gICAgcmV0dXJuIHA7XG4gIH0sXG4gIHN1YlByb3BlcnRpZXM6IGZ1bmN0aW9uKG9iaiwgc3ViT2JqLCBwcm9wZXJ0aWVzKSB7XG4gICAgaWYgKCFpc0FycmF5KHByb3BlcnRpZXMpKSB7XG4gICAgICBwcm9wZXJ0aWVzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICB9XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm9wZXJ0aWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAoZnVuY3Rpb24ocHJvcGVydHkpIHtcbiAgICAgICAgdmFyIG9wdHMgPSB7XG4gICAgICAgICAgc2V0OiBmYWxzZSxcbiAgICAgICAgICBuYW1lOiBwcm9wZXJ0eSxcbiAgICAgICAgICBwcm9wZXJ0eTogcHJvcGVydHlcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKCFpc1N0cmluZyhwcm9wZXJ0eSkpIHtcbiAgICAgICAgICBleHRlbmQob3B0cywgcHJvcGVydHkpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBkZXNjID0ge1xuICAgICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gc3ViT2JqW29wdHMucHJvcGVydHldO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKG9wdHMuc2V0KSB7XG4gICAgICAgICAgZGVzYy5zZXQgPSBmdW5jdGlvbih2KSB7XG4gICAgICAgICAgICBzdWJPYmpbb3B0cy5wcm9wZXJ0eV0gPSB2O1xuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgb3B0cy5uYW1lLCBkZXNjKTtcbiAgICAgIH0pKHByb3BlcnRpZXNbaV0pO1xuICAgIH1cbiAgfSxcbiAgY2FwaXRhbGlzZUZpcnN0TGV0dGVyOiBmdW5jdGlvbihzdHJpbmcpIHtcbiAgICByZXR1cm4gc3RyaW5nLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgc3RyaW5nLnNsaWNlKDEpO1xuICB9LFxuICBleHRlbmRGcm9tT3B0czogZnVuY3Rpb24ob2JqLCBvcHRzLCBkZWZhdWx0cywgZXJyb3JPblVua25vd24pIHtcbiAgICBlcnJvck9uVW5rbm93biA9IGVycm9yT25Vbmtub3duID09IHVuZGVmaW5lZCA/IHRydWUgOiBlcnJvck9uVW5rbm93bjtcbiAgICBpZiAoZXJyb3JPblVua25vd24pIHtcbiAgICAgIHZhciBkZWZhdWx0S2V5cyA9IE9iamVjdC5rZXlzKGRlZmF1bHRzKSxcbiAgICAgICAgb3B0c0tleXMgPSBPYmplY3Qua2V5cyhvcHRzKTtcbiAgICAgIHZhciB1bmtub3duS2V5cyA9IG9wdHNLZXlzLmZpbHRlcihmdW5jdGlvbihuKSB7XG4gICAgICAgIHJldHVybiBkZWZhdWx0S2V5cy5pbmRleE9mKG4pID09IC0xXG4gICAgICB9KTtcbiAgICAgIGlmICh1bmtub3duS2V5cy5sZW5ndGgpIHRocm93IEVycm9yKCdVbmtub3duIG9wdGlvbnM6ICcgKyB1bmtub3duS2V5cy50b1N0cmluZygpKTtcbiAgICB9XG4gICAgLy8gQXBwbHkgYW55IGZ1bmN0aW9ucyBzcGVjaWZpZWQgaW4gdGhlIGRlZmF1bHRzLlxuICAgIE9iamVjdC5rZXlzKGRlZmF1bHRzKS5mb3JFYWNoKGZ1bmN0aW9uKGspIHtcbiAgICAgIHZhciBkID0gZGVmYXVsdHNba107XG4gICAgICBpZiAodHlwZW9mIGQgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBkZWZhdWx0c1trXSA9IGQob3B0c1trXSk7XG4gICAgICAgIGRlbGV0ZSBvcHRzW2tdO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGV4dGVuZChkZWZhdWx0cywgb3B0cyk7XG4gICAgZXh0ZW5kKG9iaiwgZGVmYXVsdHMpO1xuICB9LFxuICBpc1N0cmluZzogaXNTdHJpbmcsXG4gIGlzQXJyYXk6IGlzQXJyYXksXG4gIHByZXR0eVByaW50OiBmdW5jdGlvbihvKSB7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KG8sIG51bGwsIDQpO1xuICB9LFxuICBmbGF0dGVuQXJyYXk6IGZ1bmN0aW9uKGFycikge1xuICAgIHJldHVybiBhcnIucmVkdWNlKGZ1bmN0aW9uKG1lbW8sIGUpIHtcbiAgICAgIGlmIChpc0FycmF5KGUpKSB7XG4gICAgICAgIG1lbW8gPSBtZW1vLmNvbmNhdChlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1lbW8ucHVzaChlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtZW1vO1xuICAgIH0sIFtdKTtcbiAgfSxcbiAgdW5mbGF0dGVuQXJyYXk6IGZ1bmN0aW9uKGFyciwgbW9kZWxBcnIpIHtcbiAgICB2YXIgbiA9IDA7XG4gICAgdmFyIHVuZmxhdHRlbmVkID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBtb2RlbEFyci5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGlzQXJyYXkobW9kZWxBcnJbaV0pKSB7XG4gICAgICAgIHZhciBuZXdBcnIgPSBbXTtcbiAgICAgICAgdW5mbGF0dGVuZWRbaV0gPSBuZXdBcnI7XG4gICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgbW9kZWxBcnJbaV0ubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICBuZXdBcnIucHVzaChhcnJbbl0pO1xuICAgICAgICAgIG4rKztcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdW5mbGF0dGVuZWRbaV0gPSBhcnJbbl07XG4gICAgICAgIG4rKztcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHVuZmxhdHRlbmVkO1xuICB9XG59KTtcblxuLyoqXG4gKiBDb21wYWN0IGEgc3BhcnNlIGFycmF5XG4gKiBAcGFyYW0gYXJyXG4gKiBAcmV0dXJucyB7QXJyYXl9XG4gKi9cbmZ1bmN0aW9uIGNvbXBhY3QoYXJyKSB7XG4gIGFyciA9IGFyciB8fCBbXTtcbiAgcmV0dXJuIGFyci5maWx0ZXIoZnVuY3Rpb24oeCkge3JldHVybiB4fSk7XG59XG5cbi8qKlxuICogRXhlY3V0ZSB0YXNrcyBpbiBwYXJhbGxlbFxuICogQHBhcmFtIHRhc2tzXG4gKiBAcGFyYW0gY2JcbiAqL1xuZnVuY3Rpb24gcGFyYWxsZWwodGFza3MsIGNiKSB7XG4gIGNiID0gY2IgfHwgZnVuY3Rpb24oKSB7fTtcbiAgaWYgKHRhc2tzICYmIHRhc2tzLmxlbmd0aCkge1xuICAgIHZhciByZXN1bHRzID0gW10sIGVycm9ycyA9IFtdLCBudW1GaW5pc2hlZCA9IDA7XG4gICAgdGFza3MuZm9yRWFjaChmdW5jdGlvbihmbiwgaWR4KSB7XG4gICAgICByZXN1bHRzW2lkeF0gPSBmYWxzZTtcbiAgICAgIGZuKGZ1bmN0aW9uKGVyciwgcmVzKSB7XG4gICAgICAgIG51bUZpbmlzaGVkKys7XG4gICAgICAgIGlmIChlcnIpIGVycm9yc1tpZHhdID0gZXJyO1xuICAgICAgICByZXN1bHRzW2lkeF0gPSByZXM7XG4gICAgICAgIGlmIChudW1GaW5pc2hlZCA9PSB0YXNrcy5sZW5ndGgpIHtcbiAgICAgICAgICBjYihcbiAgICAgICAgICAgIGVycm9ycy5sZW5ndGggPyBjb21wYWN0KGVycm9ycykgOiBudWxsLFxuICAgICAgICAgICAgY29tcGFjdChyZXN1bHRzKSxcbiAgICAgICAgICAgIHtyZXN1bHRzOiByZXN1bHRzLCBlcnJvcnM6IGVycm9yc31cbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSBlbHNlIGNiKCk7XG59XG5cbi8qKlxuICogRXhlY3V0ZSB0YXNrcyBvbmUgYWZ0ZXIgYW5vdGhlclxuICogQHBhcmFtIHRhc2tzXG4gKiBAcGFyYW0gY2JcbiAqL1xuZnVuY3Rpb24gc2VyaWVzKHRhc2tzLCBjYikge1xuICBjYiA9IGNiIHx8IGZ1bmN0aW9uKCkge307XG4gIGlmICh0YXNrcyAmJiB0YXNrcy5sZW5ndGgpIHtcbiAgICB2YXIgcmVzdWx0cyA9IFtdLCBlcnJvcnMgPSBbXSwgaWR4ID0gMDtcblxuICAgIGZ1bmN0aW9uIGV4ZWN1dGVUYXNrKHRhc2spIHtcbiAgICAgIHRhc2soZnVuY3Rpb24oZXJyLCByZXMpIHtcbiAgICAgICAgaWYgKGVycikgZXJyb3JzW2lkeF0gPSBlcnI7XG4gICAgICAgIHJlc3VsdHNbaWR4XSA9IHJlcztcbiAgICAgICAgaWYgKCF0YXNrcy5sZW5ndGgpIHtcbiAgICAgICAgICBjYihcbiAgICAgICAgICAgIGVycm9ycy5sZW5ndGggPyBjb21wYWN0KGVycm9ycykgOiBudWxsLFxuICAgICAgICAgICAgY29tcGFjdChyZXN1bHRzKSxcbiAgICAgICAgICAgIHtyZXN1bHRzOiByZXN1bHRzLCBlcnJvcnM6IGVycm9yc31cbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGlkeCsrO1xuICAgICAgICAgIG5leHRUYXNrKCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG5leHRUYXNrKCkge1xuICAgICAgdmFyIG5leHRUYXNrID0gdGFza3Muc2hpZnQoKTtcbiAgICAgIGV4ZWN1dGVUYXNrKG5leHRUYXNrKTtcbiAgICB9XG5cbiAgICBuZXh0VGFzaygpO1xuXG4gIH0gZWxzZSBjYigpO1xufVxuXG5cbmV4dGVuZChtb2R1bGUuZXhwb3J0cywge1xuICBjb21wYWN0OiBjb21wYWN0LFxuICBwYXJhbGxlbDogcGFyYWxsZWwsXG4gIHNlcmllczogc2VyaWVzXG59KTtcblxudmFyIEZOX0FSR1MgPSAvXmZ1bmN0aW9uXFxzKlteXFwoXSpcXChcXHMqKFteXFwpXSopXFwpL20sXG4gIEZOX0FSR19TUExJVCA9IC8sLyxcbiAgRk5fQVJHID0gL15cXHMqKF8/KSguKz8pXFwxXFxzKiQvLFxuICBTVFJJUF9DT01NRU5UUyA9IC8oKFxcL1xcLy4qJCl8KFxcL1xcKltcXHNcXFNdKj9cXCpcXC8pKS9tZztcblxuZXh0ZW5kKG1vZHVsZS5leHBvcnRzLCB7XG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIHBhcmFtZXRlciBuYW1lcyBvZiBhIGZ1bmN0aW9uLlxuICAgKiBOb3RlOiBhZGFwdGVkIGZyb20gQW5ndWxhckpTIGRlcGVuZGVuY3kgaW5qZWN0aW9uIDopXG4gICAqIEBwYXJhbSBmblxuICAgKi9cbiAgcGFyYW1OYW1lczogZnVuY3Rpb24oZm4pIHtcbiAgICAvLyBUT0RPOiBJcyB0aGVyZSBhIG1vcmUgcm9idXN0IHdheSBvZiBkb2luZyB0aGlzP1xuICAgIHZhciBwYXJhbXMgPSBbXSxcbiAgICAgIGZuVGV4dCxcbiAgICAgIGFyZ0RlY2w7XG4gICAgZm5UZXh0ID0gZm4udG9TdHJpbmcoKS5yZXBsYWNlKFNUUklQX0NPTU1FTlRTLCAnJyk7XG4gICAgYXJnRGVjbCA9IGZuVGV4dC5tYXRjaChGTl9BUkdTKTtcblxuICAgIGFyZ0RlY2xbMV0uc3BsaXQoRk5fQVJHX1NQTElUKS5mb3JFYWNoKGZ1bmN0aW9uKGFyZykge1xuICAgICAgYXJnLnJlcGxhY2UoRk5fQVJHLCBmdW5jdGlvbihhbGwsIHVuZGVyc2NvcmUsIG5hbWUpIHtcbiAgICAgICAgcGFyYW1zLnB1c2gobmFtZSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICByZXR1cm4gcGFyYW1zO1xuICB9XG59KTtcblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS91dGlsLmpzXG4gKiogbW9kdWxlIGlkID0gMVxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuZnVuY3Rpb24gQ29sbGVjdGlvblJlZ2lzdHJ5KCkge1xuICBpZiAoIXRoaXMpIHJldHVybiBuZXcgQ29sbGVjdGlvblJlZ2lzdHJ5KCk7XG4gIHRoaXMuY29sbGVjdGlvbk5hbWVzID0gW107XG59XG5cbnV0aWwuZXh0ZW5kKENvbGxlY3Rpb25SZWdpc3RyeS5wcm90b3R5cGUsIHtcbiAgcmVnaXN0ZXI6IGZ1bmN0aW9uKGNvbGxlY3Rpb24pIHtcbiAgICB2YXIgbmFtZSA9IGNvbGxlY3Rpb24ubmFtZTtcbiAgICB0aGlzW25hbWVdID0gY29sbGVjdGlvbjtcbiAgICB0aGlzLmNvbGxlY3Rpb25OYW1lcy5wdXNoKG5hbWUpO1xuICB9LFxuICByZXNldDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMuY29sbGVjdGlvbk5hbWVzLmZvckVhY2goZnVuY3Rpb24obmFtZSkge1xuICAgICAgZGVsZXRlIHNlbGZbbmFtZV07XG4gICAgfSk7XG4gICAgdGhpcy5jb2xsZWN0aW9uTmFtZXMgPSBbXTtcbiAgfVxufSk7XG5cbmV4cG9ydHMuQ29sbGVjdGlvblJlZ2lzdHJ5ID0gbmV3IENvbGxlY3Rpb25SZWdpc3RyeSgpO1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL2NvbGxlY3Rpb25SZWdpc3RyeS5qc1xuICoqIG1vZHVsZSBpZCA9IDJcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdjb2xsZWN0aW9uJyksXG4gIENvbGxlY3Rpb25SZWdpc3RyeSA9IHJlcXVpcmUoJy4vY29sbGVjdGlvblJlZ2lzdHJ5JykuQ29sbGVjdGlvblJlZ2lzdHJ5LFxuICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gIE1vZGVsID0gcmVxdWlyZSgnLi9tb2RlbCcpLFxuICBleHRlbmQgPSByZXF1aXJlKCdleHRlbmQnKSxcbiAgb2JzZXJ2ZSA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuUGxhdGZvcm0sXG4gIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgZXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJyksXG4gIGFyZ3NhcnJheSA9IHJlcXVpcmUoJ2FyZ3NhcnJheScpLFxuICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKTtcblxuXG4vKipcbiAqIEEgY29sbGVjdGlvbiBkZXNjcmliZXMgYSBzZXQgb2YgbW9kZWxzIGFuZCBvcHRpb25hbGx5IGEgUkVTVCBBUEkgd2hpY2ggd2Ugd291bGRcbiAqIGxpa2UgdG8gbW9kZWwuXG4gKlxuICogQHBhcmFtIG5hbWVcbiAqIEBwYXJhbSBvcHRzXG4gKiBAY29uc3RydWN0b3JcbiAqXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYGpzXG4gKiB2YXIgR2l0SHViID0gbmV3IHNpZXN0YSgnR2l0SHViJylcbiAqIC8vIC4uLiBjb25maWd1cmUgbWFwcGluZ3MsIGRlc2NyaXB0b3JzIGV0YyAuLi5cbiAqIEdpdEh1Yi5pbnN0YWxsKGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgLy8gLi4uIGNhcnJ5IG9uLlxuICAgICAqIH0pO1xuICogYGBgXG4gKi9cbmZ1bmN0aW9uIENvbGxlY3Rpb24obmFtZSwgb3B0cykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIGlmICghbmFtZSkgdGhyb3cgbmV3IEVycm9yKCdDb2xsZWN0aW9uIG11c3QgaGF2ZSBhIG5hbWUnKTtcblxuICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgdXRpbC5leHRlbmRGcm9tT3B0cyh0aGlzLCBvcHRzLCB7fSk7XG5cbiAgdXRpbC5leHRlbmQodGhpcywge1xuICAgIG5hbWU6IG5hbWUsXG4gICAgX3Jhd01vZGVsczoge30sXG4gICAgX21vZGVsczoge30sXG4gICAgX29wdHM6IG9wdHMsXG4gICAgaW5zdGFsbGVkOiBmYWxzZVxuICB9KTtcblxuICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0aGlzLCB7XG4gICAgZGlydHk6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmIChzaWVzdGEuZXh0LnN0b3JhZ2VFbmFibGVkKSB7XG4gICAgICAgICAgdmFyIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uID0gc2llc3RhLmV4dC5zdG9yYWdlLl91bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbixcbiAgICAgICAgICAgIGhhc2ggPSB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltzZWxmLm5hbWVdIHx8IHt9O1xuICAgICAgICAgIHJldHVybiAhIU9iamVjdC5rZXlzKGhhc2gpLmxlbmd0aDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH1cbiAgfSk7XG5cbiAgQ29sbGVjdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyKHRoaXMpO1xuICB0aGlzLl9tYWtlQXZhaWxhYmxlT25Sb290KCk7XG4gIGV2ZW50cy5Qcm94eUV2ZW50RW1pdHRlci5jYWxsKHRoaXMsIHRoaXMubmFtZSk7XG59XG5cbkNvbGxlY3Rpb24ucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShldmVudHMuUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlKTtcblxudXRpbC5leHRlbmQoQ29sbGVjdGlvbi5wcm90b3R5cGUsIHtcbiAgX2dldE1vZGVsc1RvSW5zdGFsbDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIG1vZGVsc1RvSW5zdGFsbCA9IFtdO1xuICAgIGZvciAodmFyIG5hbWUgaW4gdGhpcy5fbW9kZWxzKSB7XG4gICAgICBpZiAodGhpcy5fbW9kZWxzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgIHZhciBtb2RlbCA9IHRoaXMuX21vZGVsc1tuYW1lXTtcbiAgICAgICAgbW9kZWxzVG9JbnN0YWxsLnB1c2gobW9kZWwpO1xuICAgICAgfVxuICAgIH1cbiAgICBsb2coJ1RoZXJlIGFyZSAnICsgbW9kZWxzVG9JbnN0YWxsLmxlbmd0aC50b1N0cmluZygpICsgJyBtYXBwaW5ncyB0byBpbnN0YWxsJyk7XG4gICAgcmV0dXJuIG1vZGVsc1RvSW5zdGFsbDtcbiAgfSxcbiAgLyoqXG4gICAqIE1lYW5zIHRoYXQgd2UgY2FuIGFjY2VzcyB0aGUgY29sbGVjdGlvbiBvbiB0aGUgc2llc3RhIG9iamVjdC5cbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9tYWtlQXZhaWxhYmxlT25Sb290OiBmdW5jdGlvbigpIHtcbiAgICBzaWVzdGFbdGhpcy5uYW1lXSA9IHRoaXM7XG4gIH0sXG4gIC8qKlxuICAgKiBFbnN1cmUgbWFwcGluZ3MgYXJlIGluc3RhbGxlZC5cbiAgICogQHBhcmFtIFtjYl1cbiAgICogQGNsYXNzIENvbGxlY3Rpb25cbiAgICovXG4gIGluc3RhbGw6IGZ1bmN0aW9uKGNiKSB7XG4gICAgdmFyIG1vZGVsc1RvSW5zdGFsbCA9IHRoaXMuX2dldE1vZGVsc1RvSW5zdGFsbCgpO1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICBpZiAoIXRoaXMuaW5zdGFsbGVkKSB7XG4gICAgICAgIHRoaXMuaW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgdmFyIGVycm9ycyA9IFtdO1xuICAgICAgICBtb2RlbHNUb0luc3RhbGwuZm9yRWFjaChmdW5jdGlvbihtKSB7XG4gICAgICAgICAgbG9nKCdJbnN0YWxsaW5nIHJlbGF0aW9uc2hpcHMgZm9yIG1hcHBpbmcgd2l0aCBuYW1lIFwiJyArIG0ubmFtZSArICdcIicpO1xuICAgICAgICAgIHZhciBlcnIgPSBtLmluc3RhbGxSZWxhdGlvbnNoaXBzKCk7XG4gICAgICAgICAgaWYgKGVycikgZXJyb3JzLnB1c2goZXJyKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGlmICghZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgIG1vZGVsc1RvSW5zdGFsbC5mb3JFYWNoKGZ1bmN0aW9uKG0pIHtcbiAgICAgICAgICAgIGxvZygnSW5zdGFsbGluZyByZXZlcnNlIHJlbGF0aW9uc2hpcHMgZm9yIG1hcHBpbmcgd2l0aCBuYW1lIFwiJyArIG0ubmFtZSArICdcIicpO1xuICAgICAgICAgICAgdmFyIGVyciA9IG0uaW5zdGFsbFJldmVyc2VSZWxhdGlvbnNoaXBzKCk7XG4gICAgICAgICAgICBpZiAoZXJyKSBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGlmICghZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhpcy5pbnN0YWxsZWQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5fbWFrZUF2YWlsYWJsZU9uUm9vdCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjYihlcnJvcnMubGVuZ3RoID8gZXJyb3IoJ0Vycm9ycyB3ZXJlIGVuY291bnRlcmVkIHdoaWxzdCBzZXR0aW5nIHVwIHRoZSBjb2xsZWN0aW9uJywge2Vycm9yczogZXJyb3JzfSkgOiBudWxsKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdDb2xsZWN0aW9uIFwiJyArIHRoaXMubmFtZSArICdcIiBoYXMgYWxyZWFkeSBiZWVuIGluc3RhbGxlZCcpO1xuICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG5cbiAgX21vZGVsOiBmdW5jdGlvbihuYW1lLCBvcHRzKSB7XG4gICAgaWYgKG5hbWUpIHtcbiAgICAgIHRoaXMuX3Jhd01vZGVsc1tuYW1lXSA9IG9wdHM7XG4gICAgICBvcHRzID0gZXh0ZW5kKHRydWUsIHt9LCBvcHRzKTtcbiAgICAgIG9wdHMubmFtZSA9IG5hbWU7XG4gICAgICBvcHRzLmNvbGxlY3Rpb24gPSB0aGlzO1xuICAgICAgdmFyIG1vZGVsID0gbmV3IE1vZGVsKG9wdHMpO1xuICAgICAgdGhpcy5fbW9kZWxzW25hbWVdID0gbW9kZWw7XG4gICAgICB0aGlzW25hbWVdID0gbW9kZWw7XG4gICAgICBpZiAodGhpcy5pbnN0YWxsZWQpIHtcbiAgICAgICAgdmFyIGVycm9yID0gbW9kZWwuaW5zdGFsbFJlbGF0aW9uc2hpcHMoKTtcbiAgICAgICAgaWYgKCFlcnJvcikgZXJyb3IgPSBtb2RlbC5pbnN0YWxsUmV2ZXJzZVJlbGF0aW9uc2hpcHMoKTtcbiAgICAgICAgaWYgKGVycm9yKSAgdGhyb3cgZXJyb3I7XG4gICAgICB9XG4gICAgICByZXR1cm4gbW9kZWw7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBuYW1lIHNwZWNpZmllZCB3aGVuIGNyZWF0aW5nIG1hcHBpbmcnKTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVycyBhIG1vZGVsIHdpdGggdGhpcyBjb2xsZWN0aW9uLlxuICAgKi9cbiAgbW9kZWw6IGFyZ3NhcnJheShmdW5jdGlvbihhcmdzKSB7XG4gICAgaWYgKGFyZ3MubGVuZ3RoKSB7XG4gICAgICBpZiAoYXJncy5sZW5ndGggPT0gMSkge1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KGFyZ3NbMF0pKSB7XG4gICAgICAgICAgcmV0dXJuIGFyZ3NbMF0ubWFwKGZ1bmN0aW9uKG0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9tb2RlbChtLm5hbWUsIG0pO1xuICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIG5hbWUsIG9wdHM7XG4gICAgICAgICAgaWYgKHV0aWwuaXNTdHJpbmcoYXJnc1swXSkpIHtcbiAgICAgICAgICAgIG5hbWUgPSBhcmdzWzBdO1xuICAgICAgICAgICAgb3B0cyA9IHt9O1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIG9wdHMgPSBhcmdzWzBdO1xuICAgICAgICAgICAgbmFtZSA9IG9wdHMubmFtZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHRoaXMuX21vZGVsKG5hbWUsIG9wdHMpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAodHlwZW9mIGFyZ3NbMF0gPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5fbW9kZWwoYXJnc1swXSwgYXJnc1sxXSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIGFyZ3MubWFwKGZ1bmN0aW9uKG0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9tb2RlbChtLm5hbWUsIG0pO1xuICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfSksXG5cbiAgLyoqXG4gICAqIER1bXAgdGhpcyBjb2xsZWN0aW9uIGFzIEpTT05cbiAgICogQHBhcmFtICB7Qm9vbGVhbn0gYXNKc29uIFdoZXRoZXIgb3Igbm90IHRvIGFwcGx5IEpTT04uc3RyaW5naWZ5XG4gICAqIEByZXR1cm4ge1N0cmluZ3xPYmplY3R9XG4gICAqIEBjbGFzcyBDb2xsZWN0aW9uXG4gICAqL1xuICBfZHVtcDogZnVuY3Rpb24oYXNKc29uKSB7XG4gICAgdmFyIG9iaiA9IHt9O1xuICAgIG9iai5pbnN0YWxsZWQgPSB0aGlzLmluc3RhbGxlZDtcbiAgICBvYmouZG9jSWQgPSB0aGlzLl9kb2NJZDtcbiAgICBvYmoubmFtZSA9IHRoaXMubmFtZTtcbiAgICByZXR1cm4gYXNKc29uID8gdXRpbC5wcmV0dHlQcmludChvYmopIDogb2JqO1xuICB9LFxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBudW1iZXIgb2Ygb2JqZWN0cyBpbiB0aGlzIGNvbGxlY3Rpb24uXG4gICAqXG4gICAqIEBwYXJhbSBjYlxuICAgKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAgICovXG4gIGNvdW50OiBmdW5jdGlvbihjYikge1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICB2YXIgdGFza3MgPSBPYmplY3Qua2V5cyh0aGlzLl9tb2RlbHMpLm1hcChmdW5jdGlvbihtb2RlbE5hbWUpIHtcbiAgICAgICAgdmFyIG0gPSB0aGlzLl9tb2RlbHNbbW9kZWxOYW1lXTtcbiAgICAgICAgcmV0dXJuIG0uY291bnQuYmluZChtKTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICB1dGlsLnBhcmFsbGVsKHRhc2tzLCBmdW5jdGlvbihlcnIsIG5zKSB7XG4gICAgICAgIHZhciBuO1xuICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgIG4gPSBucy5yZWR1Y2UoZnVuY3Rpb24obSwgcikge1xuICAgICAgICAgICAgcmV0dXJuIG0gKyByXG4gICAgICAgICAgfSwgMCk7XG4gICAgICAgIH1cbiAgICAgICAgY2IoZXJyLCBuKTtcbiAgICAgIH0pO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG5cbiAgZ3JhcGg6IGZ1bmN0aW9uKGRhdGEsIG9wdHMsIGNiKSB7XG4gICAgaWYgKHR5cGVvZiBvcHRzID09ICdmdW5jdGlvbicpIGNiID0gb3B0cztcbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgdmFyIHRhc2tzID0gW10sIGVycjtcbiAgICAgIGZvciAodmFyIG1vZGVsTmFtZSBpbiBkYXRhKSB7XG4gICAgICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KG1vZGVsTmFtZSkpIHtcbiAgICAgICAgICB2YXIgbW9kZWwgPSB0aGlzLl9tb2RlbHNbbW9kZWxOYW1lXTtcbiAgICAgICAgICBpZiAobW9kZWwpIHtcbiAgICAgICAgICAgIChmdW5jdGlvbihtb2RlbCwgZGF0YSkge1xuICAgICAgICAgICAgICB0YXNrcy5wdXNoKGZ1bmN0aW9uKGRvbmUpIHtcbiAgICAgICAgICAgICAgICBtb2RlbC5ncmFwaChkYXRhLCBmdW5jdGlvbihlcnIsIG1vZGVscykge1xuICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3VsdHMgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0c1ttb2RlbC5uYW1lXSA9IG1vZGVscztcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGRvbmUoZXJyLCByZXN1bHRzKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KShtb2RlbCwgZGF0YVttb2RlbE5hbWVdKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBlcnIgPSAnTm8gc3VjaCBtb2RlbCBcIicgKyBtb2RlbE5hbWUgKyAnXCInO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgdXRpbC5zZXJpZXModGFza3MsIGZ1bmN0aW9uKGVyciwgcmVzdWx0cykge1xuICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICByZXN1bHRzID0gcmVzdWx0cy5yZWR1Y2UoZnVuY3Rpb24obWVtbywgcmVzKSB7XG4gICAgICAgICAgICAgIHJldHVybiB1dGlsLmV4dGVuZChtZW1vLCByZXMgfHwge30pO1xuICAgICAgICAgICAgfSwge30pXG4gICAgICAgICAgfSBlbHNlIHJlc3VsdHMgPSBudWxsO1xuICAgICAgICAgIGNiKGVyciwgcmVzdWx0cyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgZWxzZSBjYihlcnJvcihlcnIsIHtkYXRhOiBkYXRhLCBpbnZhbGlkTW9kZWxOYW1lOiBtb2RlbE5hbWV9KSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcblxuICByZW1vdmVBbGw6IGZ1bmN0aW9uKGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIHV0aWwuUHJvbWlzZS5hbGwoXG4gICAgICAgIE9iamVjdC5rZXlzKHRoaXMuX21vZGVscykubWFwKGZ1bmN0aW9uKG1vZGVsTmFtZSkge1xuICAgICAgICAgIHZhciBtb2RlbCA9IHRoaXMuX21vZGVsc1ttb2RlbE5hbWVdO1xuICAgICAgICAgIHJldHVybiBtb2RlbC5yZW1vdmVBbGwoKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKVxuICAgICAgKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGNiKG51bGwpO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goY2IpXG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gQ29sbGVjdGlvbjtcblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9jb2xsZWN0aW9uLmpzXG4gKiogbW9kdWxlIGlkID0gM1xuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiLyoqXG4gKiBUaGlzIGlzIGFuIGluLW1lbW9yeSBjYWNoZSBmb3IgbW9kZWxzLiBNb2RlbHMgYXJlIGNhY2hlZCBieSBsb2NhbCBpZCAoX2lkKSBhbmQgcmVtb3RlIGlkIChkZWZpbmVkIGJ5IHRoZSBtYXBwaW5nKS5cbiAqIExvb2t1cHMgYXJlIHBlcmZvcm1lZCBhZ2FpbnN0IHRoZSBjYWNoZSB3aGVuIG1hcHBpbmcuXG4gKiBAbW9kdWxlIGNhY2hlXG4gKi9cbnZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdjYWNoZScpLFxuICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuXG5mdW5jdGlvbiBDYWNoZSgpIHtcbiAgdGhpcy5yZXNldCgpO1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ19sb2NhbENhY2hlQnlUeXBlJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5sb2NhbDtcbiAgICB9XG4gIH0pO1xufVxuXG5DYWNoZS5wcm90b3R5cGUgPSB7XG4gIHJlc2V0OiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnJlbW90ZSA9IHt9O1xuICAgIHRoaXMubG9jYWxCeUlkID0ge307XG4gICAgdGhpcy5sb2NhbCA9IHt9O1xuICB9LFxuICAvKipcbiAgICogUmV0dXJuIHRoZSBvYmplY3QgaW4gdGhlIGNhY2hlIGdpdmVuIGEgbG9jYWwgaWQgKF9pZClcbiAgICogQHBhcmFtICB7U3RyaW5nfEFycmF5fSBsb2NhbElkXG4gICAqIEByZXR1cm4ge01vZGVsSW5zdGFuY2V9XG4gICAqL1xuICBnZXRWaWFMb2NhbElkOiBmdW5jdGlvbiBnZXRWaWFMb2NhbElkKGxvY2FsSWQpIHtcbiAgICBpZiAodXRpbC5pc0FycmF5KGxvY2FsSWQpKSByZXR1cm4gbG9jYWxJZC5tYXAoZnVuY3Rpb24oeCkge3JldHVybiB0aGlzLmxvY2FsQnlJZFt4XX0uYmluZCh0aGlzKSk7XG4gICAgZWxzZSByZXR1cm4gdGhpcy5sb2NhbEJ5SWRbbG9jYWxJZF07XG4gIH0sXG4gIC8qKlxuICAgKiBHaXZlbiBhIHJlbW90ZSBpZGVudGlmaWVyIGFuZCBhbiBvcHRpb25zIG9iamVjdCB0aGF0IGRlc2NyaWJlcyBtYXBwaW5nL2NvbGxlY3Rpb24sXG4gICAqIHJldHVybiB0aGUgbW9kZWwgaWYgY2FjaGVkLlxuICAgKiBAcGFyYW0gIHtTdHJpbmd8QXJyYXl9IHJlbW90ZUlkXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0c1xuICAgKiBAcGFyYW0gIHtPYmplY3R9IG9wdHMubW9kZWxcbiAgICogQHJldHVybiB7TW9kZWxJbnN0YW5jZX1cbiAgICovXG4gIGdldFZpYVJlbW90ZUlkOiBmdW5jdGlvbihyZW1vdGVJZCwgb3B0cykge1xuICAgIHZhciBjID0gKHRoaXMucmVtb3RlW29wdHMubW9kZWwuY29sbGVjdGlvbk5hbWVdIHx8IHt9KVtvcHRzLm1vZGVsLm5hbWVdIHx8IHt9O1xuICAgIHJldHVybiB1dGlsLmlzQXJyYXkocmVtb3RlSWQpID8gcmVtb3RlSWQubWFwKGZ1bmN0aW9uKHgpIHtyZXR1cm4gY1t4XX0pIDogY1tyZW1vdGVJZF07XG4gIH0sXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIHNpbmdsZXRvbiBvYmplY3QgZ2l2ZW4gYSBzaW5nbGV0b24gbW9kZWwuXG4gICAqIEBwYXJhbSAge01vZGVsfSBtb2RlbFxuICAgKiBAcmV0dXJuIHtNb2RlbEluc3RhbmNlfVxuICAgKi9cbiAgZ2V0U2luZ2xldG9uOiBmdW5jdGlvbihtb2RlbCkge1xuICAgIHZhciBtb2RlbE5hbWUgPSBtb2RlbC5uYW1lO1xuICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG1vZGVsLmNvbGxlY3Rpb25OYW1lO1xuICAgIHZhciBjb2xsZWN0aW9uQ2FjaGUgPSB0aGlzLmxvY2FsW2NvbGxlY3Rpb25OYW1lXTtcbiAgICBpZiAoY29sbGVjdGlvbkNhY2hlKSB7XG4gICAgICB2YXIgdHlwZUNhY2hlID0gY29sbGVjdGlvbkNhY2hlW21vZGVsTmFtZV07XG4gICAgICBpZiAodHlwZUNhY2hlKSB7XG4gICAgICAgIHZhciBvYmpzID0gW107XG4gICAgICAgIGZvciAodmFyIHByb3AgaW4gdHlwZUNhY2hlKSB7XG4gICAgICAgICAgaWYgKHR5cGVDYWNoZS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgb2Jqcy5wdXNoKHR5cGVDYWNoZVtwcm9wXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChvYmpzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICB2YXIgZXJyU3RyID0gJ0Egc2luZ2xldG9uIG1vZGVsIGhhcyBtb3JlIHRoYW4gMSBvYmplY3QgaW4gdGhlIGNhY2hlISBUaGlzIGlzIGEgc2VyaW91cyBlcnJvci4gJyArXG4gICAgICAgICAgICAnRWl0aGVyIGEgbW9kZWwgaGFzIGJlZW4gbW9kaWZpZWQgYWZ0ZXIgb2JqZWN0cyBoYXZlIGFscmVhZHkgYmVlbiBjcmVhdGVkLCBvciBzb21ldGhpbmcgaGFzIGdvbmUnICtcbiAgICAgICAgICAgICd2ZXJ5IHdyb25nLiBQbGVhc2UgZmlsZSBhIGJ1ZyByZXBvcnQgaWYgdGhlIGxhdHRlci4nO1xuICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKGVyclN0cik7XG4gICAgICAgIH0gZWxzZSBpZiAob2Jqcy5sZW5ndGgpIHtcbiAgICAgICAgICByZXR1cm4gb2Jqc1swXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcbiAgLyoqXG4gICAqIEluc2VydCBhbiBvYmplY3QgaW50byB0aGUgY2FjaGUgdXNpbmcgYSByZW1vdGUgaWRlbnRpZmllciBkZWZpbmVkIGJ5IHRoZSBtYXBwaW5nLlxuICAgKiBAcGFyYW0gIHtNb2RlbEluc3RhbmNlfSBvYmpcbiAgICogQHBhcmFtICB7U3RyaW5nfSByZW1vdGVJZFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IFtwcmV2aW91c1JlbW90ZUlkXSBJZiByZW1vdGUgaWQgaGFzIGJlZW4gY2hhbmdlZCwgdGhpcyBpcyB0aGUgb2xkIHJlbW90ZSBpZGVudGlmaWVyXG4gICAqL1xuICByZW1vdGVJbnNlcnQ6IGZ1bmN0aW9uKG9iaiwgcmVtb3RlSWQsIHByZXZpb3VzUmVtb3RlSWQpIHtcbiAgICBpZiAob2JqKSB7XG4gICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBvYmoubW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgICBpZiAoY29sbGVjdGlvbk5hbWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLnJlbW90ZVtjb2xsZWN0aW9uTmFtZV0pIHtcbiAgICAgICAgICB0aGlzLnJlbW90ZVtjb2xsZWN0aW9uTmFtZV0gPSB7fTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgdHlwZSA9IG9iai5tb2RlbC5uYW1lO1xuICAgICAgICBpZiAodHlwZSkge1xuICAgICAgICAgIGlmICghdGhpcy5yZW1vdGVbY29sbGVjdGlvbk5hbWVdW3R5cGVdKSB7XG4gICAgICAgICAgICB0aGlzLnJlbW90ZVtjb2xsZWN0aW9uTmFtZV1bdHlwZV0gPSB7fTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHByZXZpb3VzUmVtb3RlSWQpIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3RlW2NvbGxlY3Rpb25OYW1lXVt0eXBlXVtwcmV2aW91c1JlbW90ZUlkXSA9IG51bGw7XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhciBjYWNoZWRPYmplY3QgPSB0aGlzLnJlbW90ZVtjb2xsZWN0aW9uTmFtZV1bdHlwZV1bcmVtb3RlSWRdO1xuICAgICAgICAgIGlmICghY2FjaGVkT2JqZWN0KSB7XG4gICAgICAgICAgICB0aGlzLnJlbW90ZVtjb2xsZWN0aW9uTmFtZV1bdHlwZV1bcmVtb3RlSWRdID0gb2JqO1xuICAgICAgICAgICAgbG9nKCdSZW1vdGUgY2FjaGUgaW5zZXJ0OiAnICsgb2JqLl9kdW1wKHRydWUpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gU29tZXRoaW5nIGhhcyBnb25lIHJlYWxseSB3cm9uZy4gT25seSBvbmUgb2JqZWN0IGZvciBhIHBhcnRpY3VsYXIgY29sbGVjdGlvbi90eXBlL3JlbW90ZWlkIGNvbWJvXG4gICAgICAgICAgICAvLyBzaG91bGQgZXZlciBleGlzdC5cbiAgICAgICAgICAgIGlmIChvYmogIT0gY2FjaGVkT2JqZWN0KSB7XG4gICAgICAgICAgICAgIHZhciBtZXNzYWdlID0gJ09iamVjdCAnICsgY29sbGVjdGlvbk5hbWUudG9TdHJpbmcoKSArICc6JyArIHR5cGUudG9TdHJpbmcoKSArICdbJyArIG9iai5tb2RlbC5pZCArICc9XCInICsgcmVtb3RlSWQgKyAnXCJdIGFscmVhZHkgZXhpc3RzIGluIHRoZSBjYWNoZS4nICtcbiAgICAgICAgICAgICAgICAnIFRoaXMgaXMgYSBzZXJpb3VzIGVycm9yLCBwbGVhc2UgZmlsZSBhIGJ1ZyByZXBvcnQgaWYgeW91IGFyZSBleHBlcmllbmNpbmcgdGhpcyBvdXQgaW4gdGhlIHdpbGQnO1xuICAgICAgICAgICAgICBsb2cobWVzc2FnZSwge1xuICAgICAgICAgICAgICAgIG9iajogb2JqLFxuICAgICAgICAgICAgICAgIGNhY2hlZE9iamVjdDogY2FjaGVkT2JqZWN0XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihtZXNzYWdlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ01vZGVsIGhhcyBubyB0eXBlJywge1xuICAgICAgICAgICAgbW9kZWw6IG9iai5tb2RlbCxcbiAgICAgICAgICAgIG9iajogb2JqXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNb2RlbCBoYXMgbm8gY29sbGVjdGlvbicsIHtcbiAgICAgICAgICBtb2RlbDogb2JqLm1vZGVsLFxuICAgICAgICAgIG9iajogb2JqXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgbXNnID0gJ011c3QgcGFzcyBhbiBvYmplY3Qgd2hlbiBpbnNlcnRpbmcgdG8gY2FjaGUnO1xuICAgICAgbG9nKG1zZyk7XG4gICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihtc2cpO1xuICAgIH1cbiAgfSxcbiAgLyoqXG4gICAqIFF1ZXJ5IHRoZSBjYWNoZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG9wdHMgT2JqZWN0IGRlc2NyaWJpbmcgdGhlIHF1ZXJ5XG4gICAqIEByZXR1cm4ge01vZGVsSW5zdGFuY2V9XG4gICAqIEBleGFtcGxlXG4gICAqIGBgYGpzXG4gICAqIGNhY2hlLmdldCh7X2lkOiAnNSd9KTsgLy8gUXVlcnkgYnkgbG9jYWwgaWRcbiAgICogY2FjaGUuZ2V0KHtyZW1vdGVJZDogJzUnLCBtYXBwaW5nOiBteU1hcHBpbmd9KTsgLy8gUXVlcnkgYnkgcmVtb3RlIGlkXG4gICAqIGBgYFxuICAgKi9cbiAgZ2V0OiBmdW5jdGlvbihvcHRzKSB7XG4gICAgbG9nKCdnZXQnLCBvcHRzKTtcbiAgICB2YXIgb2JqLCBpZEZpZWxkLCByZW1vdGVJZDtcbiAgICB2YXIgbG9jYWxJZCA9IG9wdHMubG9jYWxJZDtcbiAgICBpZiAobG9jYWxJZCkge1xuICAgICAgb2JqID0gdGhpcy5nZXRWaWFMb2NhbElkKGxvY2FsSWQpO1xuICAgICAgaWYgKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKG9wdHMubW9kZWwpIHtcbiAgICAgICAgICBpZEZpZWxkID0gb3B0cy5tb2RlbC5pZDtcbiAgICAgICAgICByZW1vdGVJZCA9IG9wdHNbaWRGaWVsZF07XG4gICAgICAgICAgbG9nKGlkRmllbGQgKyAnPScgKyByZW1vdGVJZCk7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuZ2V0VmlhUmVtb3RlSWQocmVtb3RlSWQsIG9wdHMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChvcHRzLm1vZGVsKSB7XG4gICAgICBpZEZpZWxkID0gb3B0cy5tb2RlbC5pZDtcbiAgICAgIHJlbW90ZUlkID0gb3B0c1tpZEZpZWxkXTtcbiAgICAgIGlmIChyZW1vdGVJZCkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRWaWFSZW1vdGVJZChyZW1vdGVJZCwgb3B0cyk7XG4gICAgICB9IGVsc2UgaWYgKG9wdHMubW9kZWwuc2luZ2xldG9uKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldFNpbmdsZXRvbihvcHRzLm1vZGVsKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbG9nKCdJbnZhbGlkIG9wdHMgdG8gY2FjaGUnLCB7XG4gICAgICAgIG9wdHM6IG9wdHNcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcbiAgX3JlbW90ZUNhY2hlOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5yZW1vdGVcbiAgfSxcbiAgX2xvY2FsQ2FjaGU6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmxvY2FsQnlJZDtcbiAgfSxcbiAgLyoqXG4gICAqIEluc2VydCBhbiBvYmplY3QgaW50byB0aGUgY2FjaGUuXG4gICAqIEBwYXJhbSAge01vZGVsSW5zdGFuY2V9IG9ialxuICAgKiBAdGhyb3dzIHtJbnRlcm5hbFNpZXN0YUVycm9yfSBBbiBvYmplY3Qgd2l0aCBfaWQvcmVtb3RlSWQgYWxyZWFkeSBleGlzdHMuIE5vdCB0aHJvd24gaWYgc2FtZSBvYmhlY3QuXG4gICAqL1xuICBpbnNlcnQ6IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBsb2NhbElkID0gb2JqLmxvY2FsSWQ7XG4gICAgaWYgKGxvY2FsSWQpIHtcbiAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG9iai5tb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgIHZhciBtb2RlbE5hbWUgPSBvYmoubW9kZWwubmFtZTtcbiAgICAgIGlmICghdGhpcy5sb2NhbEJ5SWRbbG9jYWxJZF0pIHtcbiAgICAgICAgdGhpcy5sb2NhbEJ5SWRbbG9jYWxJZF0gPSBvYmo7XG4gICAgICAgIGlmICghdGhpcy5sb2NhbFtjb2xsZWN0aW9uTmFtZV0pIHRoaXMubG9jYWxbY29sbGVjdGlvbk5hbWVdID0ge307XG4gICAgICAgIGlmICghdGhpcy5sb2NhbFtjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXSkgdGhpcy5sb2NhbFtjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXSA9IHt9O1xuICAgICAgICB0aGlzLmxvY2FsW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdW2xvY2FsSWRdID0gb2JqO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gU29tZXRoaW5nIGhhcyBnb25lIGJhZGx5IHdyb25nIGhlcmUuIFR3byBvYmplY3RzIHNob3VsZCBuZXZlciBleGlzdCB3aXRoIHRoZSBzYW1lIF9pZFxuICAgICAgICBpZiAodGhpcy5sb2NhbEJ5SWRbbG9jYWxJZF0gIT0gb2JqKSB7XG4gICAgICAgICAgdmFyIG1lc3NhZ2UgPSAnT2JqZWN0IHdpdGggbG9jYWxJZD1cIicgKyBsb2NhbElkLnRvU3RyaW5nKCkgKyAnXCIgaXMgYWxyZWFkeSBpbiB0aGUgY2FjaGUuICcgK1xuICAgICAgICAgICAgJ1RoaXMgaXMgYSBzZXJpb3VzIGVycm9yLiBQbGVhc2UgZmlsZSBhIGJ1ZyByZXBvcnQgaWYgeW91IGFyZSBleHBlcmllbmNpbmcgdGhpcyBvdXQgaW4gdGhlIHdpbGQnO1xuICAgICAgICAgIGxvZyhtZXNzYWdlKTtcbiAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihtZXNzYWdlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB2YXIgaWRGaWVsZCA9IG9iai5pZEZpZWxkO1xuICAgIHZhciByZW1vdGVJZCA9IG9ialtpZEZpZWxkXTtcbiAgICBpZiAocmVtb3RlSWQpIHtcbiAgICAgIHRoaXMucmVtb3RlSW5zZXJ0KG9iaiwgcmVtb3RlSWQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2coJ05vIHJlbW90ZSBpZCAoXCInICsgaWRGaWVsZCArICdcIikgc28gd29udCBiZSBwbGFjaW5nIGluIHRoZSByZW1vdGUgY2FjaGUnLCBvYmopO1xuICAgIH1cbiAgfSxcbiAgLyoqXG4gICAqIFJldHVybnMgdHJ1ZSBpZiBvYmplY3QgaXMgaW4gdGhlIGNhY2hlXG4gICAqIEBwYXJhbSAge01vZGVsSW5zdGFuY2V9IG9ialxuICAgKiBAcmV0dXJuIHtib29sZWFufVxuICAgKi9cbiAgY29udGFpbnM6IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBxID0ge1xuICAgICAgbG9jYWxJZDogb2JqLmxvY2FsSWRcbiAgICB9O1xuICAgIHZhciBtb2RlbCA9IG9iai5tb2RlbDtcbiAgICBpZiAobW9kZWwuaWQpIHtcbiAgICAgIGlmIChvYmpbbW9kZWwuaWRdKSB7XG4gICAgICAgIHEubW9kZWwgPSBtb2RlbDtcbiAgICAgICAgcVttb2RlbC5pZF0gPSBvYmpbbW9kZWwuaWRdO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gISF0aGlzLmdldChxKTtcbiAgfSxcblxuICAvKipcbiAgICogUmVtb3ZlcyB0aGUgb2JqZWN0IGZyb20gdGhlIGNhY2hlIChpZiBpdCdzIGFjdHVhbGx5IGluIHRoZSBjYWNoZSkgb3RoZXJ3aXNlcyB0aHJvd3MgYW4gZXJyb3IuXG4gICAqIEBwYXJhbSAge01vZGVsSW5zdGFuY2V9IG9ialxuICAgKiBAdGhyb3dzIHtJbnRlcm5hbFNpZXN0YUVycm9yfSBJZiBvYmplY3QgYWxyZWFkeSBpbiB0aGUgY2FjaGUuXG4gICAqL1xuICByZW1vdmU6IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmICh0aGlzLmNvbnRhaW5zKG9iaikpIHtcbiAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG9iai5tb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgIHZhciBtb2RlbE5hbWUgPSBvYmoubW9kZWwubmFtZTtcbiAgICAgIHZhciBsb2NhbElkID0gb2JqLmxvY2FsSWQ7XG4gICAgICBpZiAoIW1vZGVsTmFtZSkgdGhyb3cgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gbWFwcGluZyBuYW1lJyk7XG4gICAgICBpZiAoIWNvbGxlY3Rpb25OYW1lKSB0aHJvdyBJbnRlcm5hbFNpZXN0YUVycm9yKCdObyBjb2xsZWN0aW9uIG5hbWUnKTtcbiAgICAgIGlmICghbG9jYWxJZCkgdGhyb3cgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gbG9jYWxJZCcpO1xuICAgICAgZGVsZXRlIHRoaXMubG9jYWxbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV1bbG9jYWxJZF07XG4gICAgICBkZWxldGUgdGhpcy5sb2NhbEJ5SWRbbG9jYWxJZF07XG4gICAgICBpZiAob2JqLm1vZGVsLmlkKSB7XG4gICAgICAgIHZhciByZW1vdGVJZCA9IG9ialtvYmoubW9kZWwuaWRdO1xuICAgICAgICBpZiAocmVtb3RlSWQpIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5yZW1vdGVbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV1bcmVtb3RlSWRdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIGNvdW50OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5sb2NhbEJ5SWQpLmxlbmd0aDtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBuZXcgQ2FjaGUoKTtcblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9jYWNoZS5qc1xuICoqIG1vZHVsZSBpZCA9IDRcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdtb2RlbCcpLFxuICBDb2xsZWN0aW9uUmVnaXN0cnkgPSByZXF1aXJlKCcuL2NvbGxlY3Rpb25SZWdpc3RyeScpLkNvbGxlY3Rpb25SZWdpc3RyeSxcbiAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICBSZWxhdGlvbnNoaXBUeXBlID0gcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBUeXBlJyksXG4gIFF1ZXJ5ID0gcmVxdWlyZSgnLi9RdWVyeScpLFxuICBNYXBwaW5nT3BlcmF0aW9uID0gcmVxdWlyZSgnLi9tYXBwaW5nT3BlcmF0aW9uJyksXG4gIE1vZGVsSW5zdGFuY2UgPSByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKSxcbiAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKSxcbiAgYXJnc2FycmF5ID0gcmVxdWlyZSgnYXJnc2FycmF5JyksXG4gIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICBleHRlbmQgPSByZXF1aXJlKCdleHRlbmQnKSxcbiAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gIENvbmRpdGlvbiA9IHJlcXVpcmUoJy4vQ29uZGl0aW9uJyksXG4gIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gIFBsYWNlaG9sZGVyID0gcmVxdWlyZSgnLi9QbGFjZWhvbGRlcicpLFxuICBSZWFjdGl2ZVF1ZXJ5ID0gcmVxdWlyZSgnLi9SZWFjdGl2ZVF1ZXJ5JyksXG4gIEluc3RhbmNlRmFjdG9yeSA9IHJlcXVpcmUoJy4vaW5zdGFuY2VGYWN0b3J5Jyk7XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKi9cbmZ1bmN0aW9uIE1vZGVsKG9wdHMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB0aGlzLl9vcHRzID0gb3B0cyA/IHV0aWwuZXh0ZW5kKHt9LCBvcHRzKSA6IHt9O1xuXG4gIHV0aWwuZXh0ZW5kRnJvbU9wdHModGhpcywgb3B0cywge1xuICAgIG1ldGhvZHM6IHt9LFxuICAgIGF0dHJpYnV0ZXM6IFtdLFxuICAgIGNvbGxlY3Rpb246IGZ1bmN0aW9uKGMpIHtcbiAgICAgIGlmICh1dGlsLmlzU3RyaW5nKGMpKSB7XG4gICAgICAgIGMgPSBDb2xsZWN0aW9uUmVnaXN0cnlbY107XG4gICAgICB9XG4gICAgICByZXR1cm4gYztcbiAgICB9LFxuICAgIGlkOiAnaWQnLFxuICAgIHJlbGF0aW9uc2hpcHM6IFtdLFxuICAgIG5hbWU6IG51bGwsXG4gICAgaW5kZXhlczogW10sXG4gICAgc2luZ2xldG9uOiBmYWxzZSxcbiAgICBzdGF0aWNzOiB0aGlzLmluc3RhbGxTdGF0aWNzLmJpbmQodGhpcyksXG4gICAgcHJvcGVydGllczoge30sXG4gICAgaW5pdDogbnVsbCxcbiAgICBzZXJpYWxpc2U6IG51bGwsXG4gICAgc2VyaWFsaXNlRmllbGQ6IG51bGwsXG4gICAgc2VyaWFsaXNhYmxlRmllbGRzOiBudWxsLFxuICAgIHJlbW92ZTogbnVsbCxcbiAgICBwYXJzZUF0dHJpYnV0ZTogbnVsbFxuICB9LCBmYWxzZSk7XG5cbiAgaWYgKCF0aGlzLnBhcnNlQXR0cmlidXRlKSB7XG4gICAgdGhpcy5wYXJzZUF0dHJpYnV0ZSA9IGZ1bmN0aW9uKGF0dHJOYW1lLCB2YWx1ZSkge1xuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIGlmICghdGhpcy5zZXJpYWxpc2VGaWVsZCkge1xuICAgIHRoaXMuc2VyaWFsaXNlRmllbGQgPSBmdW5jdGlvbihhdHRyTmFtZSwgdmFsdWUpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9O1xuICB9XG5cbiAgdGhpcy5hdHRyaWJ1dGVzID0gTW9kZWwuX3Byb2Nlc3NBdHRyaWJ1dGVzKHRoaXMuYXR0cmlidXRlcyk7XG5cbiAgdGhpcy5fZmFjdG9yeSA9IG5ldyBJbnN0YW5jZUZhY3RvcnkodGhpcyk7XG4gIHRoaXMuX2luc3RhbmNlID0gdGhpcy5fZmFjdG9yeS5faW5zdGFuY2UuYmluZCh0aGlzLl9mYWN0b3J5KTtcblxuICB1dGlsLmV4dGVuZCh0aGlzLCB7XG4gICAgX3JlbGF0aW9uc2hpcHNJbnN0YWxsZWQ6IGZhbHNlLFxuICAgIF9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZDogZmFsc2UsXG4gICAgY2hpbGRyZW46IFtdXG4gIH0pO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICBfcmVsYXRpb25zaGlwTmFtZXM6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhzZWxmLnJlbGF0aW9uc2hpcHMpO1xuICAgICAgfSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9LFxuICAgIF9hdHRyaWJ1dGVOYW1lczoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIG5hbWVzID0gW107XG4gICAgICAgIGlmIChzZWxmLmlkKSB7XG4gICAgICAgICAgbmFtZXMucHVzaChzZWxmLmlkKTtcbiAgICAgICAgfVxuICAgICAgICBzZWxmLmF0dHJpYnV0ZXMuZm9yRWFjaChmdW5jdGlvbih4KSB7XG4gICAgICAgICAgbmFtZXMucHVzaCh4Lm5hbWUpXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gbmFtZXM7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0sXG4gICAgaW5zdGFsbGVkOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gc2VsZi5fcmVsYXRpb25zaGlwc0luc3RhbGxlZCAmJiBzZWxmLl9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZDtcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSxcbiAgICBkZXNjZW5kYW50czoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHNlbGYuY2hpbGRyZW4ucmVkdWNlKGZ1bmN0aW9uKG1lbW8sIGRlc2NlbmRhbnQpIHtcbiAgICAgICAgICByZXR1cm4gQXJyYXkucHJvdG90eXBlLmNvbmNhdC5jYWxsKG1lbW8sIGRlc2NlbmRhbnQuZGVzY2VuZGFudHMpO1xuICAgICAgICB9LmJpbmQoc2VsZiksIHV0aWwuZXh0ZW5kKFtdLCBzZWxmLmNoaWxkcmVuKSk7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0sXG4gICAgZGlydHk6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmIChzaWVzdGEuZXh0LnN0b3JhZ2VFbmFibGVkKSB7XG4gICAgICAgICAgdmFyIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uID0gc2llc3RhLmV4dC5zdG9yYWdlLl91bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbixcbiAgICAgICAgICAgIGhhc2ggPSAodW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bdGhpcy5jb2xsZWN0aW9uTmFtZV0gfHwge30pW3RoaXMubmFtZV0gfHwge307XG4gICAgICAgICAgcmV0dXJuICEhT2JqZWN0LmtleXMoaGFzaCkubGVuZ3RoO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSxcbiAgICBjb2xsZWN0aW9uTmFtZToge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29sbGVjdGlvbi5uYW1lO1xuICAgICAgfSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9XG4gIH0pO1xuICB2YXIgZ2xvYmFsRXZlbnROYW1lID0gdGhpcy5jb2xsZWN0aW9uTmFtZSArICc6JyArIHRoaXMubmFtZSxcbiAgICBwcm94aWVkID0ge1xuICAgICAgcXVlcnk6IHRoaXMucXVlcnkuYmluZCh0aGlzKVxuICAgIH07XG5cbiAgZXZlbnRzLlByb3h5RXZlbnRFbWl0dGVyLmNhbGwodGhpcywgZ2xvYmFsRXZlbnROYW1lLCBwcm94aWVkKTtcblxuICB0aGlzLl9pbmRleElzSW5zdGFsbGVkID0gbmV3IENvbmRpdGlvbihmdW5jdGlvbihkb25lKSB7XG4gICAgaWYgKHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQpIHNpZXN0YS5leHQuc3RvcmFnZS5lbnN1cmVJbmRleEluc3RhbGxlZCh0aGlzLCBkb25lKTtcbiAgICBlbHNlIGRvbmUoKTtcbiAgfS5iaW5kKHRoaXMpKTtcblxuICB0aGlzLl9tb2RlbExvYWRlZEZyb21TdG9yYWdlID0gbmV3IENvbmRpdGlvbihmdW5jdGlvbihkb25lKSB7XG4gICAgaWYgKHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQpIHNpZXN0YS5leHQuc3RvcmFnZS5sb2FkTW9kZWwoe21vZGVsOiB0aGlzfSwgZG9uZSk7XG4gICAgZWxzZSBkb25lKCk7XG4gIH0pO1xuXG4gIHRoaXMuX3N0b3JhZ2VFbmFibGVkID0gbmV3IENvbmRpdGlvbihbdGhpcy5faW5kZXhJc0luc3RhbGxlZCwgdGhpcy5fbW9kZWxMb2FkZWRGcm9tU3RvcmFnZV0pO1xufVxuXG51dGlsLmV4dGVuZChNb2RlbCwge1xuICAvKipcbiAgICogTm9ybWFsaXNlIGF0dHJpYnV0ZXMgcGFzc2VkIHZpYSB0aGUgb3B0aW9ucyBkaWN0aW9uYXJ5LlxuICAgKiBAcGFyYW0gYXR0cmlidXRlc1xuICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfcHJvY2Vzc0F0dHJpYnV0ZXM6IGZ1bmN0aW9uKGF0dHJpYnV0ZXMpIHtcbiAgICByZXR1cm4gYXR0cmlidXRlcy5yZWR1Y2UoZnVuY3Rpb24obSwgYSkge1xuICAgICAgaWYgKHR5cGVvZiBhID09ICdzdHJpbmcnKSB7XG4gICAgICAgIG0ucHVzaCh7XG4gICAgICAgICAgbmFtZTogYVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBtLnB1c2goYSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbTtcbiAgICB9LCBbXSlcbiAgfVxuXG59KTtcblxuTW9kZWwucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShldmVudHMuUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlKTtcblxudXRpbC5leHRlbmQoTW9kZWwucHJvdG90eXBlLCB7XG4gIGluc3RhbGxTdGF0aWNzOiBmdW5jdGlvbihzdGF0aWNzKSB7XG4gICAgaWYgKHN0YXRpY3MpIHtcbiAgICAgIE9iamVjdC5rZXlzKHN0YXRpY3MpLmZvckVhY2goZnVuY3Rpb24oc3RhdGljTmFtZSkge1xuICAgICAgICBpZiAodGhpc1tzdGF0aWNOYW1lXSkge1xuICAgICAgICAgIGxvZygnU3RhdGljIG1ldGhvZCB3aXRoIG5hbWUgXCInICsgc3RhdGljTmFtZSArICdcIiBhbHJlYWR5IGV4aXN0cy4gSWdub3JpbmcgaXQuJyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgdGhpc1tzdGF0aWNOYW1lXSA9IHN0YXRpY3Nbc3RhdGljTmFtZV0uYmluZCh0aGlzKTtcbiAgICAgICAgfVxuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG4gICAgcmV0dXJuIHN0YXRpY3M7XG4gIH0sXG4gIF92YWxpZGF0ZVJlbGF0aW9uc2hpcFR5cGU6IGZ1bmN0aW9uKHJlbGF0aW9uc2hpcCkge1xuICAgIGlmICghcmVsYXRpb25zaGlwLnR5cGUpIHtcbiAgICAgIGlmICh0aGlzLnNpbmdsZXRvbikgcmVsYXRpb25zaGlwLnR5cGUgPSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvT25lO1xuICAgICAgZWxzZSByZWxhdGlvbnNoaXAudHlwZSA9IFJlbGF0aW9uc2hpcFR5cGUuT25lVG9NYW55O1xuICAgIH1cbiAgICBpZiAodGhpcy5zaW5nbGV0b24gJiYgcmVsYXRpb25zaGlwLnR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5NYW55VG9NYW55KSB7XG4gICAgICByZXR1cm4gJ1NpbmdsZXRvbiBtb2RlbCBjYW5ub3QgdXNlIE1hbnlUb01hbnkgcmVsYXRpb25zaGlwLic7XG4gICAgfVxuICAgIGlmIChPYmplY3Qua2V5cyhSZWxhdGlvbnNoaXBUeXBlKS5pbmRleE9mKHJlbGF0aW9uc2hpcC50eXBlKSA8IDApXG4gICAgICByZXR1cm4gJ1JlbGF0aW9uc2hpcCB0eXBlICcgKyByZWxhdGlvbnNoaXAudHlwZSArICcgZG9lcyBub3QgZXhpc3QnO1xuICAgIHJldHVybiBudWxsO1xuICB9LFxuICBfZ2V0UmV2ZXJzZU1vZGVsOiBmdW5jdGlvbihyZXZlcnNlTmFtZSkge1xuICAgIHZhciByZXZlcnNlTW9kZWw7XG4gICAgaWYgKHJldmVyc2VOYW1lIGluc3RhbmNlb2YgTW9kZWwpIHJldmVyc2VNb2RlbCA9IHJldmVyc2VOYW1lO1xuICAgIGVsc2UgcmV2ZXJzZU1vZGVsID0gdGhpcy5jb2xsZWN0aW9uW3JldmVyc2VOYW1lXTtcbiAgICBpZiAoIXJldmVyc2VNb2RlbCkgeyAvLyBNYXkgaGF2ZSB1c2VkIENvbGxlY3Rpb24uTW9kZWwgZm9ybWF0LlxuICAgICAgdmFyIGFyciA9IHJldmVyc2VOYW1lLnNwbGl0KCcuJyk7XG4gICAgICBpZiAoYXJyLmxlbmd0aCA9PSAyKSB7XG4gICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IGFyclswXTtcbiAgICAgICAgcmV2ZXJzZU5hbWUgPSBhcnJbMV07XG4gICAgICAgIHZhciBvdGhlckNvbGxlY3Rpb24gPSBDb2xsZWN0aW9uUmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdO1xuICAgICAgICBpZiAob3RoZXJDb2xsZWN0aW9uKVxuICAgICAgICAgIHJldmVyc2VNb2RlbCA9IG90aGVyQ29sbGVjdGlvbltyZXZlcnNlTmFtZV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXZlcnNlTW9kZWw7XG4gIH0sXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIHJldmVyc2UgbW9kZWwgb3IgYSBwbGFjZWhvbGRlciB0aGF0IHdpbGwgYmUgcmVzb2x2ZWQgbGF0ZXIuXG4gICAqIEBwYXJhbSBmb3J3YXJkTmFtZVxuICAgKiBAcGFyYW0gcmV2ZXJzZU5hbWVcbiAgICogQHJldHVybnMgeyp9XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfZ2V0UmV2ZXJzZU1vZGVsT3JQbGFjZWhvbGRlcjogZnVuY3Rpb24oZm9yd2FyZE5hbWUsIHJldmVyc2VOYW1lKSB7XG4gICAgdmFyIHJldmVyc2VNb2RlbCA9IHRoaXMuX2dldFJldmVyc2VNb2RlbChyZXZlcnNlTmFtZSk7XG4gICAgcmV0dXJuIHJldmVyc2VNb2RlbCB8fCBuZXcgUGxhY2Vob2xkZXIoe25hbWU6IHJldmVyc2VOYW1lLCByZWY6IHRoaXMsIGZvcndhcmROYW1lOiBmb3J3YXJkTmFtZX0pO1xuICB9LFxuICAvKipcbiAgICogSW5zdGFsbCByZWxhdGlvbnNoaXBzLiBSZXR1cm5zIGVycm9yIGluIGZvcm0gb2Ygc3RyaW5nIGlmIGZhaWxzLlxuICAgKiBAcmV0dXJuIHtTdHJpbmd8bnVsbH1cbiAgICovXG4gIGluc3RhbGxSZWxhdGlvbnNoaXBzOiBmdW5jdGlvbigpIHtcbiAgICBpZiAoIXRoaXMuX3JlbGF0aW9uc2hpcHNJbnN0YWxsZWQpIHtcbiAgICAgIHZhciBlcnIgPSBudWxsO1xuICAgICAgZm9yICh2YXIgbmFtZSBpbiB0aGlzLl9vcHRzLnJlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgaWYgKHRoaXMuX29wdHMucmVsYXRpb25zaGlwcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgIHZhciByZWxhdGlvbnNoaXAgPSB0aGlzLl9vcHRzLnJlbGF0aW9uc2hpcHNbbmFtZV07XG4gICAgICAgICAgLy8gSWYgYSByZXZlcnNlIHJlbGF0aW9uc2hpcCBpcyBpbnN0YWxsZWQgYmVmb3JlaGFuZCwgd2UgZG8gbm90IHdhbnQgdG8gcHJvY2VzcyB0aGVtLlxuICAgICAgICAgIHZhciBpc0ZvcndhcmQgPSAhcmVsYXRpb25zaGlwLmlzUmV2ZXJzZTtcbiAgICAgICAgICBpZiAoaXNGb3J3YXJkKSB7XG4gICAgICAgICAgICBsb2codGhpcy5uYW1lICsgJzogY29uZmlndXJpbmcgcmVsYXRpb25zaGlwICcgKyBuYW1lLCByZWxhdGlvbnNoaXApO1xuICAgICAgICAgICAgaWYgKCEoZXJyID0gdGhpcy5fdmFsaWRhdGVSZWxhdGlvbnNoaXBUeXBlKHJlbGF0aW9uc2hpcCkpKSB7XG4gICAgICAgICAgICAgIHZhciByZXZlcnNlTW9kZWxOYW1lID0gcmVsYXRpb25zaGlwLm1vZGVsO1xuICAgICAgICAgICAgICBpZiAocmV2ZXJzZU1vZGVsTmFtZSkge1xuICAgICAgICAgICAgICAgIHZhciByZXZlcnNlTW9kZWwgPSB0aGlzLl9nZXRSZXZlcnNlTW9kZWxPclBsYWNlaG9sZGVyKG5hbWUsIHJldmVyc2VNb2RlbE5hbWUpO1xuICAgICAgICAgICAgICAgIHV0aWwuZXh0ZW5kKHJlbGF0aW9uc2hpcCwge1xuICAgICAgICAgICAgICAgICAgcmV2ZXJzZU1vZGVsOiByZXZlcnNlTW9kZWwsXG4gICAgICAgICAgICAgICAgICBmb3J3YXJkTW9kZWw6IHRoaXMsXG4gICAgICAgICAgICAgICAgICBmb3J3YXJkTmFtZTogbmFtZSxcbiAgICAgICAgICAgICAgICAgIHJldmVyc2VOYW1lOiByZWxhdGlvbnNoaXAucmV2ZXJzZSB8fCAncmV2ZXJzZV8nICsgbmFtZSxcbiAgICAgICAgICAgICAgICAgIGlzUmV2ZXJzZTogZmFsc2VcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBkZWxldGUgcmVsYXRpb25zaGlwLm1vZGVsO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSByZWxhdGlvbnNoaXAucmV2ZXJzZTtcblxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGVsc2UgcmV0dXJuICdNdXN0IHBhc3MgbW9kZWwnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignUmVsYXRpb25zaGlwcyBmb3IgXCInICsgdGhpcy5uYW1lICsgJ1wiIGhhdmUgYWxyZWFkeSBiZWVuIGluc3RhbGxlZCcpO1xuICAgIH1cbiAgICBpZiAoIWVycikgdGhpcy5fcmVsYXRpb25zaGlwc0luc3RhbGxlZCA9IHRydWU7XG4gICAgcmV0dXJuIGVycjtcbiAgfSxcbiAgX2luc3RhbGxSZXZlcnNlOiBmdW5jdGlvbihyZWxhdGlvbnNoaXApIHtcbiAgICB2YXIgcmV2ZXJzZU1vZGVsID0gcmVsYXRpb25zaGlwLnJldmVyc2VNb2RlbDtcbiAgICB2YXIgaXNQbGFjZWhvbGRlciA9IHJldmVyc2VNb2RlbC5pc1BsYWNlaG9sZGVyO1xuICAgIGlmIChpc1BsYWNlaG9sZGVyKSB7XG4gICAgICB2YXIgbW9kZWxOYW1lID0gcmVsYXRpb25zaGlwLnJldmVyc2VNb2RlbC5uYW1lO1xuICAgICAgcmV2ZXJzZU1vZGVsID0gdGhpcy5fZ2V0UmV2ZXJzZU1vZGVsKG1vZGVsTmFtZSk7XG4gICAgICBpZiAocmV2ZXJzZU1vZGVsKSB7XG4gICAgICAgIHJlbGF0aW9uc2hpcC5yZXZlcnNlTW9kZWwgPSByZXZlcnNlTW9kZWw7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChyZXZlcnNlTW9kZWwpIHtcbiAgICAgIHZhciBlcnI7XG4gICAgICB2YXIgcmV2ZXJzZU5hbWUgPSByZWxhdGlvbnNoaXAucmV2ZXJzZU5hbWUsXG4gICAgICAgIGZvcndhcmRNb2RlbCA9IHJlbGF0aW9uc2hpcC5mb3J3YXJkTW9kZWw7XG5cbiAgICAgIGlmIChyZXZlcnNlTW9kZWwgIT0gdGhpcyB8fCByZXZlcnNlTW9kZWwgPT0gZm9yd2FyZE1vZGVsKSB7XG4gICAgICAgIGlmIChyZXZlcnNlTW9kZWwuc2luZ2xldG9uKSB7XG4gICAgICAgICAgaWYgKHJlbGF0aW9uc2hpcC50eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuTWFueVRvTWFueSkgZXJyID0gJ1NpbmdsZXRvbiBtb2RlbCBjYW5ub3QgYmUgcmVsYXRlZCB2aWEgcmV2ZXJzZSBNYW55VG9NYW55JztcbiAgICAgICAgICBpZiAocmVsYXRpb25zaGlwLnR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5PbmVUb01hbnkpIGVyciA9ICdTaW5nbGV0b24gbW9kZWwgY2Fubm90IGJlIHJlbGF0ZWQgdmlhIHJldmVyc2UgT25lVG9NYW55JztcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgIGxvZyh0aGlzLm5hbWUgKyAnOiBjb25maWd1cmluZyAgcmV2ZXJzZSByZWxhdGlvbnNoaXAgJyArIHJldmVyc2VOYW1lKTtcbiAgICAgICAgICBpZiAocmV2ZXJzZU1vZGVsLnJlbGF0aW9uc2hpcHNbcmV2ZXJzZU5hbWVdKSB7XG4gICAgICAgICAgICAvLyBXZSBhcmUgb2sgdG8gcmVkZWZpbmUgcmV2ZXJzZSByZWxhdGlvbnNoaXBzIHdoZXJlYnkgdGhlIG1vZGVscyBhcmUgaW4gdGhlIHNhbWUgaGllcmFyY2h5XG4gICAgICAgICAgICB2YXIgaXNBbmNlc3Rvck1vZGVsID0gcmV2ZXJzZU1vZGVsLnJlbGF0aW9uc2hpcHNbcmV2ZXJzZU5hbWVdLmZvcndhcmRNb2RlbC5pc0FuY2VzdG9yT2YodGhpcyk7XG4gICAgICAgICAgICB2YXIgaXNEZXNjZW5kZW50TW9kZWwgPSByZXZlcnNlTW9kZWwucmVsYXRpb25zaGlwc1tyZXZlcnNlTmFtZV0uZm9yd2FyZE1vZGVsLmlzRGVzY2VuZGFudE9mKHRoaXMpO1xuICAgICAgICAgICAgaWYgKCFpc0FuY2VzdG9yTW9kZWwgJiYgIWlzRGVzY2VuZGVudE1vZGVsKSB7XG4gICAgICAgICAgICAgIGVyciA9ICdSZXZlcnNlIHJlbGF0aW9uc2hpcCBcIicgKyByZXZlcnNlTmFtZSArICdcIiBhbHJlYWR5IGV4aXN0cyBvbiBtb2RlbCBcIicgKyByZXZlcnNlTW9kZWwubmFtZSArICdcIic7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICByZXZlcnNlTW9kZWwucmVsYXRpb25zaGlwc1tyZXZlcnNlTmFtZV0gPSByZWxhdGlvbnNoaXA7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoaXNQbGFjZWhvbGRlcikge1xuICAgICAgICB2YXIgZXhpc3RpbmdSZXZlcnNlSW5zdGFuY2VzID0gKGNhY2hlLl9sb2NhbENhY2hlQnlUeXBlW3JldmVyc2VNb2RlbC5jb2xsZWN0aW9uTmFtZV0gfHwge30pW3JldmVyc2VNb2RlbC5uYW1lXSB8fCB7fTtcbiAgICAgICAgT2JqZWN0LmtleXMoZXhpc3RpbmdSZXZlcnNlSW5zdGFuY2VzKS5mb3JFYWNoKGZ1bmN0aW9uKGxvY2FsSWQpIHtcbiAgICAgICAgICB2YXIgaW5zdGFuY2NlID0gZXhpc3RpbmdSZXZlcnNlSW5zdGFuY2VzW2xvY2FsSWRdO1xuICAgICAgICAgIHZhciByID0gdXRpbC5leHRlbmQoe30sIHJlbGF0aW9uc2hpcCk7XG4gICAgICAgICAgci5pc1JldmVyc2UgPSB0cnVlO1xuICAgICAgICAgIHRoaXMuX2ZhY3RvcnkuX2luc3RhbGxSZWxhdGlvbnNoaXAociwgaW5zdGFuY2NlKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGVycjtcbiAgfSxcbiAgLyoqXG4gICAqIEN5Y2xlIHRocm91Z2ggcmVsYXRpb25zaGlwcyBhbmQgcmVwbGFjZSBhbnkgcGxhY2Vob2xkZXJzIHdpdGggdGhlIGFjdHVhbCBtb2RlbHMgd2hlcmUgcG9zc2libGUuXG4gICAqL1xuICBfaW5zdGFsbFJldmVyc2VQbGFjZWhvbGRlcnM6IGZ1bmN0aW9uKCkge1xuICAgIGZvciAodmFyIGZvcndhcmROYW1lIGluIHRoaXMucmVsYXRpb25zaGlwcykge1xuICAgICAgaWYgKHRoaXMucmVsYXRpb25zaGlwcy5oYXNPd25Qcm9wZXJ0eShmb3J3YXJkTmFtZSkpIHtcbiAgICAgICAgdmFyIHJlbGF0aW9uc2hpcCA9IHRoaXMucmVsYXRpb25zaGlwc1tmb3J3YXJkTmFtZV07XG4gICAgICAgIGlmIChyZWxhdGlvbnNoaXAucmV2ZXJzZU1vZGVsLmlzUGxhY2Vob2xkZXIpIHRoaXMuX2luc3RhbGxSZXZlcnNlKHJlbGF0aW9uc2hpcCk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICBpbnN0YWxsUmV2ZXJzZVJlbGF0aW9uc2hpcHM6IGZ1bmN0aW9uKCkge1xuICAgIGlmICghdGhpcy5fcmV2ZXJzZVJlbGF0aW9uc2hpcHNJbnN0YWxsZWQpIHtcbiAgICAgIGZvciAodmFyIGZvcndhcmROYW1lIGluIHRoaXMucmVsYXRpb25zaGlwcykge1xuICAgICAgICBpZiAodGhpcy5yZWxhdGlvbnNoaXBzLmhhc093blByb3BlcnR5KGZvcndhcmROYW1lKSkge1xuICAgICAgICAgIHZhciByZWxhdGlvbnNoaXAgPSB0aGlzLnJlbGF0aW9uc2hpcHNbZm9yd2FyZE5hbWVdO1xuICAgICAgICAgIHJlbGF0aW9uc2hpcCA9IGV4dGVuZCh0cnVlLCB7fSwgcmVsYXRpb25zaGlwKTtcbiAgICAgICAgICByZWxhdGlvbnNoaXAuaXNSZXZlcnNlID0gdHJ1ZTtcbiAgICAgICAgICB2YXIgZXJyID0gdGhpcy5faW5zdGFsbFJldmVyc2UocmVsYXRpb25zaGlwKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5fcmV2ZXJzZVJlbGF0aW9uc2hpcHNJbnN0YWxsZWQgPSB0cnVlO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdSZXZlcnNlIHJlbGF0aW9uc2hpcHMgZm9yIFwiJyArIHRoaXMubmFtZSArICdcIiBoYXZlIGFscmVhZHkgYmVlbiBpbnN0YWxsZWQuJyk7XG4gICAgfVxuICAgIHJldHVybiBlcnI7XG4gIH0sXG4gIF9xdWVyeTogZnVuY3Rpb24ocXVlcnkpIHtcbiAgICByZXR1cm4gbmV3IFF1ZXJ5KHRoaXMsIHF1ZXJ5IHx8IHt9KTtcbiAgfSxcbiAgcXVlcnk6IGZ1bmN0aW9uKHF1ZXJ5LCBjYikge1xuICAgIHZhciBxdWVyeUluc3RhbmNlO1xuICAgIHZhciBwcm9taXNlID0gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgaWYgKCF0aGlzLnNpbmdsZXRvbikge1xuICAgICAgICBxdWVyeUluc3RhbmNlID0gdGhpcy5fcXVlcnkocXVlcnkpO1xuICAgICAgICByZXR1cm4gcXVlcnlJbnN0YW5jZS5leGVjdXRlKGNiKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBxdWVyeUluc3RhbmNlID0gdGhpcy5fcXVlcnkoe19faWdub3JlSW5zdGFsbGVkOiB0cnVlfSk7XG4gICAgICAgIHF1ZXJ5SW5zdGFuY2UuZXhlY3V0ZShmdW5jdGlvbihlcnIsIG9ianMpIHtcbiAgICAgICAgICBpZiAoZXJyKSBjYihlcnIpO1xuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgLy8gQ2FjaGUgYSBuZXcgc2luZ2xldG9uIGFuZCB0aGVuIHJlZXhlY3V0ZSB0aGUgcXVlcnlcbiAgICAgICAgICAgIHF1ZXJ5ID0gdXRpbC5leHRlbmQoe30sIHF1ZXJ5KTtcbiAgICAgICAgICAgIHF1ZXJ5Ll9faWdub3JlSW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIGlmICghb2Jqcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgdGhpcy5ncmFwaCh7fSwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgIHF1ZXJ5SW5zdGFuY2UgPSB0aGlzLl9xdWVyeShxdWVyeSk7XG4gICAgICAgICAgICAgICAgICBxdWVyeUluc3RhbmNlLmV4ZWN1dGUoY2IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIGNiKGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIHF1ZXJ5SW5zdGFuY2UgPSB0aGlzLl9xdWVyeShxdWVyeSk7XG4gICAgICAgICAgICAgIHF1ZXJ5SW5zdGFuY2UuZXhlY3V0ZShjYik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICAvLyBCeSB3cmFwcGluZyB0aGUgcHJvbWlzZSBpbiBhbm90aGVyIHByb21pc2Ugd2UgY2FuIHB1c2ggdGhlIGludm9jYXRpb25zIHRvIHRoZSBib3R0b20gb2YgdGhlIGV2ZW50IGxvb3Agc28gdGhhdFxuICAgIC8vIGFueSBldmVudCBoYW5kbGVycyBhZGRlZCB0byB0aGUgY2hhaW4gYXJlIGhvbm91cmVkIHN0cmFpZ2h0IGF3YXkuXG4gICAgdmFyIGxpbmtQcm9taXNlID0gbmV3IHV0aWwuUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgIHByb21pc2UudGhlbihhcmdzYXJyYXkoZnVuY3Rpb24oYXJncykge1xuICAgICAgICBzZXRJbW1lZGlhdGUoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmVzb2x2ZS5hcHBseShudWxsLCBhcmdzKTtcbiAgICAgICAgfSk7XG4gICAgICB9KSwgYXJnc2FycmF5KGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICAgICAgc2V0SW1tZWRpYXRlKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJlamVjdC5hcHBseShudWxsLCBhcmdzKTtcbiAgICAgICAgfSlcbiAgICAgIH0pKTtcbiAgICB9KTtcblxuICAgIHJldHVybiB0aGlzLl9saW5rKHtcbiAgICAgIHRoZW46IGxpbmtQcm9taXNlLnRoZW4uYmluZChsaW5rUHJvbWlzZSksXG4gICAgICBjYXRjaDogbGlua1Byb21pc2UuY2F0Y2guYmluZChsaW5rUHJvbWlzZSksXG4gICAgICBvbjogYXJnc2FycmF5KGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICAgICAgdmFyIHJxID0gbmV3IFJlYWN0aXZlUXVlcnkodGhpcy5fcXVlcnkocXVlcnkpKTtcbiAgICAgICAgcnEuaW5pdCgpO1xuICAgICAgICBycS5vbi5hcHBseShycSwgYXJncyk7XG4gICAgICB9LmJpbmQodGhpcykpXG4gICAgfSk7XG4gIH0sXG4gIC8qKlxuICAgKiBPbmx5IHVzZWQgaW4gdGVzdGluZyBhdCB0aGUgbW9tZW50LlxuICAgKiBAcGFyYW0gcXVlcnlcbiAgICogQHJldHVybnMge1JlYWN0aXZlUXVlcnl9XG4gICAqL1xuICBfcmVhY3RpdmVRdWVyeTogZnVuY3Rpb24ocXVlcnkpIHtcbiAgICByZXR1cm4gbmV3IFJlYWN0aXZlUXVlcnkobmV3IFF1ZXJ5KHRoaXMsIHF1ZXJ5IHx8IHt9KSk7XG4gIH0sXG4gIG9uZTogZnVuY3Rpb24ob3B0cywgY2IpIHtcbiAgICBpZiAodHlwZW9mIG9wdHMgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2IgPSBvcHRzO1xuICAgICAgb3B0cyA9IHt9O1xuICAgIH1cbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgdGhpcy5xdWVyeShvcHRzLCBmdW5jdGlvbihlcnIsIHJlcykge1xuICAgICAgICBpZiAoZXJyKSBjYihlcnIpO1xuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBpZiAocmVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgIGNiKGVycm9yKCdNb3JlIHRoYW4gb25lIGluc3RhbmNlIHJldHVybmVkIHdoZW4gZXhlY3V0aW5nIGdldCBxdWVyeSEnKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmVzID0gcmVzLmxlbmd0aCA/IHJlc1swXSA6IG51bGw7XG4gICAgICAgICAgICBjYihudWxsLCByZXMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgYWxsOiBmdW5jdGlvbihxLCBjYikge1xuICAgIGlmICh0eXBlb2YgcSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYiA9IHE7XG4gICAgICBxID0ge307XG4gICAgfVxuICAgIHEgPSBxIHx8IHt9O1xuICAgIHZhciBxdWVyeSA9IHt9O1xuICAgIGlmIChxLl9fb3JkZXIpIHF1ZXJ5Ll9fb3JkZXIgPSBxLl9fb3JkZXI7XG4gICAgcmV0dXJuIHRoaXMucXVlcnkocSwgY2IpO1xuICB9LFxuICBfYXR0cmlidXRlRGVmaW5pdGlvbldpdGhOYW1lOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmF0dHJpYnV0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBhdHRyaWJ1dGVEZWZpbml0aW9uID0gdGhpcy5hdHRyaWJ1dGVzW2ldO1xuICAgICAgaWYgKGF0dHJpYnV0ZURlZmluaXRpb24ubmFtZSA9PSBuYW1lKSByZXR1cm4gYXR0cmlidXRlRGVmaW5pdGlvbjtcbiAgICB9XG4gIH0sXG4gIC8qKlxuICAgKiBNYXAgZGF0YSBpbnRvIFNpZXN0YS5cbiAgICpcbiAgICogQHBhcmFtIGRhdGEgUmF3IGRhdGEgcmVjZWl2ZWQgcmVtb3RlbHkgb3Igb3RoZXJ3aXNlXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb258b2JqZWN0fSBbb3B0c11cbiAgICogQHBhcmFtIHtib29sZWFufSBvcHRzLm92ZXJyaWRlXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gb3B0cy5faWdub3JlSW5zdGFsbGVkIC0gQSBoYWNrIHRoYXQgYWxsb3dzIG1hcHBpbmcgb250byBNb2RlbHMgZXZlbiBpZiBpbnN0YWxsIHByb2Nlc3MgaGFzIG5vdCBmaW5pc2hlZC5cbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gW2NiXSBDYWxsZWQgb25jZSBwb3VjaCBwZXJzaXN0ZW5jZSByZXR1cm5zLlxuICAgKi9cbiAgZ3JhcGg6IGZ1bmN0aW9uKGRhdGEsIG9wdHMsIGNiKSB7XG4gICAgaWYgKHR5cGVvZiBvcHRzID09ICdmdW5jdGlvbicpIGNiID0gb3B0cztcbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgdmFyIF9tYXAgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIG92ZXJyaWRlcyA9IG9wdHMub3ZlcnJpZGU7XG4gICAgICAgIGlmIChvdmVycmlkZXMpIHtcbiAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KG92ZXJyaWRlcykpIG9wdHMub2JqZWN0cyA9IG92ZXJyaWRlcztcbiAgICAgICAgICBlbHNlIG9wdHMub2JqZWN0cyA9IFtvdmVycmlkZXNdO1xuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZSBvcHRzLm92ZXJyaWRlO1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KGRhdGEpKSB7XG4gICAgICAgICAgdGhpcy5fbWFwQnVsayhkYXRhLCBvcHRzLCBjYik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5fbWFwQnVsayhbZGF0YV0sIG9wdHMsIGZ1bmN0aW9uKGVyciwgb2JqZWN0cykge1xuICAgICAgICAgICAgdmFyIG9iajtcbiAgICAgICAgICAgIGlmIChvYmplY3RzKSB7XG4gICAgICAgICAgICAgIGlmIChvYmplY3RzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIG9iaiA9IG9iamVjdHNbMF07XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVyciA9IGVyciA/ICh1dGlsLmlzQXJyYXkoZGF0YSkgPyBlcnIgOiAodXRpbC5pc0FycmF5KGVycikgPyBlcnJbMF0gOiBlcnIpKSA6IG51bGw7XG4gICAgICAgICAgICBjYihlcnIsIG9iaik7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgIGlmIChvcHRzLl9pZ25vcmVJbnN0YWxsZWQpIHtcbiAgICAgICAgX21hcCgpO1xuICAgICAgfVxuICAgICAgZWxzZSBzaWVzdGEuX2FmdGVySW5zdGFsbChfbWFwKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuICBfbWFwQnVsazogZnVuY3Rpb24oZGF0YSwgb3B0cywgY2FsbGJhY2spIHtcbiAgICB1dGlsLmV4dGVuZChvcHRzLCB7bW9kZWw6IHRoaXMsIGRhdGE6IGRhdGF9KTtcbiAgICB2YXIgb3AgPSBuZXcgTWFwcGluZ09wZXJhdGlvbihvcHRzKTtcbiAgICBvcC5zdGFydChmdW5jdGlvbihlcnIsIG9iamVjdHMpIHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgb2JqZWN0cyB8fCBbXSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG4gIF9jb3VudENhY2hlOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgY29sbENhY2hlID0gY2FjaGUuX2xvY2FsQ2FjaGVCeVR5cGVbdGhpcy5jb2xsZWN0aW9uTmFtZV0gfHwge307XG4gICAgdmFyIG1vZGVsQ2FjaGUgPSBjb2xsQ2FjaGVbdGhpcy5uYW1lXSB8fCB7fTtcbiAgICByZXR1cm4gT2JqZWN0LmtleXMobW9kZWxDYWNoZSkucmVkdWNlKGZ1bmN0aW9uKG0sIGxvY2FsSWQpIHtcbiAgICAgIG1bbG9jYWxJZF0gPSB7fTtcbiAgICAgIHJldHVybiBtO1xuICAgIH0sIHt9KTtcbiAgfSxcbiAgY291bnQ6IGZ1bmN0aW9uKGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIGNiKG51bGwsIE9iamVjdC5rZXlzKHRoaXMuX2NvdW50Q2FjaGUoKSkubGVuZ3RoKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuICBfZHVtcDogZnVuY3Rpb24oYXNKU09OKSB7XG4gICAgdmFyIGR1bXBlZCA9IHt9O1xuICAgIGR1bXBlZC5uYW1lID0gdGhpcy5uYW1lO1xuICAgIGR1bXBlZC5hdHRyaWJ1dGVzID0gdGhpcy5hdHRyaWJ1dGVzO1xuICAgIGR1bXBlZC5pZCA9IHRoaXMuaWQ7XG4gICAgZHVtcGVkLmNvbGxlY3Rpb24gPSB0aGlzLmNvbGxlY3Rpb25OYW1lO1xuICAgIGR1bXBlZC5yZWxhdGlvbnNoaXBzID0gdGhpcy5yZWxhdGlvbnNoaXBzLm1hcChmdW5jdGlvbihyKSB7XG4gICAgICByZXR1cm4gci5pc0ZvcndhcmQgPyByLmZvcndhcmROYW1lIDogci5yZXZlcnNlTmFtZTtcbiAgICB9KTtcbiAgICByZXR1cm4gYXNKU09OID8gdXRpbC5wcmV0dHlQcmludChkdW1wZWQpIDogZHVtcGVkO1xuICB9LFxuICB0b1N0cmluZzogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuICdNb2RlbFsnICsgdGhpcy5uYW1lICsgJ10nO1xuICB9LFxuICByZW1vdmVBbGw6IGZ1bmN0aW9uKGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIHRoaXMuYWxsKClcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24oaW5zdGFuY2VzKSB7XG4gICAgICAgICAgaW5zdGFuY2VzLnJlbW92ZSgpO1xuICAgICAgICAgIGNiKCk7XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChjYik7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfVxuXG59KTtcblxuLy8gU3ViY2xhc3NpbmdcbnV0aWwuZXh0ZW5kKE1vZGVsLnByb3RvdHlwZSwge1xuICBjaGlsZDogZnVuY3Rpb24obmFtZU9yT3B0cywgb3B0cykge1xuICAgIGlmICh0eXBlb2YgbmFtZU9yT3B0cyA9PSAnc3RyaW5nJykge1xuICAgICAgb3B0cy5uYW1lID0gbmFtZU9yT3B0cztcbiAgICB9IGVsc2Uge1xuICAgICAgb3B0cyA9IG5hbWU7XG4gICAgfVxuICAgIHV0aWwuZXh0ZW5kKG9wdHMsIHtcbiAgICAgIGF0dHJpYnV0ZXM6IEFycmF5LnByb3RvdHlwZS5jb25jYXQuY2FsbChvcHRzLmF0dHJpYnV0ZXMgfHwgW10sIHRoaXMuX29wdHMuYXR0cmlidXRlcyksXG4gICAgICByZWxhdGlvbnNoaXBzOiB1dGlsLmV4dGVuZChvcHRzLnJlbGF0aW9uc2hpcHMgfHwge30sIHRoaXMuX29wdHMucmVsYXRpb25zaGlwcyksXG4gICAgICBtZXRob2RzOiB1dGlsLmV4dGVuZCh1dGlsLmV4dGVuZCh7fSwgdGhpcy5fb3B0cy5tZXRob2RzKSB8fCB7fSwgb3B0cy5tZXRob2RzKSxcbiAgICAgIHN0YXRpY3M6IHV0aWwuZXh0ZW5kKHV0aWwuZXh0ZW5kKHt9LCB0aGlzLl9vcHRzLnN0YXRpY3MpIHx8IHt9LCBvcHRzLnN0YXRpY3MpLFxuICAgICAgcHJvcGVydGllczogdXRpbC5leHRlbmQodXRpbC5leHRlbmQoe30sIHRoaXMuX29wdHMucHJvcGVydGllcykgfHwge30sIG9wdHMucHJvcGVydGllcyksXG4gICAgICBpZDogb3B0cy5pZCB8fCB0aGlzLl9vcHRzLmlkLFxuICAgICAgaW5pdDogb3B0cy5pbml0IHx8IHRoaXMuX29wdHMuaW5pdCxcbiAgICAgIHJlbW92ZTogb3B0cy5yZW1vdmUgfHwgdGhpcy5fb3B0cy5yZW1vdmUsXG4gICAgICBzZXJpYWxpc2U6IG9wdHMuc2VyaWFsaXNlIHx8IHRoaXMuX29wdHMuc2VyaWFsaXNlLFxuICAgICAgc2VyaWFsaXNlRmllbGQ6IG9wdHMuc2VyaWFsaXNlRmllbGQgfHwgdGhpcy5fb3B0cy5zZXJpYWxpc2VGaWVsZCxcbiAgICAgIHBhcnNlQXR0cmlidXRlOiBvcHRzLnBhcnNlQXR0cmlidXRlIHx8IHRoaXMuX29wdHMucGFyc2VBdHRyaWJ1dGVcbiAgICB9KTtcblxuICAgIGlmICh0aGlzLl9vcHRzLnNlcmlhbGlzYWJsZUZpZWxkcykge1xuICAgICAgb3B0cy5zZXJpYWxpc2FibGVGaWVsZHMgPSBBcnJheS5wcm90b3R5cGUuY29uY2F0LmFwcGx5KG9wdHMuc2VyaWFsaXNhYmxlRmllbGRzIHx8IFtdLCB0aGlzLl9vcHRzLnNlcmlhbGlzYWJsZUZpZWxkcyk7XG4gICAgfVxuXG4gICAgdmFyIG1vZGVsID0gdGhpcy5jb2xsZWN0aW9uLm1vZGVsKG9wdHMubmFtZSwgb3B0cyk7XG4gICAgbW9kZWwucGFyZW50ID0gdGhpcztcbiAgICB0aGlzLmNoaWxkcmVuLnB1c2gobW9kZWwpO1xuICAgIHJldHVybiBtb2RlbDtcbiAgfSxcbiAgaXNDaGlsZE9mOiBmdW5jdGlvbihwYXJlbnQpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnQgPT0gcGFyZW50O1xuICB9LFxuICBpc1BhcmVudE9mOiBmdW5jdGlvbihjaGlsZCkge1xuICAgIHJldHVybiB0aGlzLmNoaWxkcmVuLmluZGV4T2YoY2hpbGQpID4gLTE7XG4gIH0sXG4gIGlzRGVzY2VuZGFudE9mOiBmdW5jdGlvbihhbmNlc3Rvcikge1xuICAgIHZhciBwYXJlbnQgPSB0aGlzLnBhcmVudDtcbiAgICB3aGlsZSAocGFyZW50KSB7XG4gICAgICBpZiAocGFyZW50ID09IGFuY2VzdG9yKSByZXR1cm4gdHJ1ZTtcbiAgICAgIHBhcmVudCA9IHBhcmVudC5wYXJlbnQ7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfSxcbiAgaXNBbmNlc3Rvck9mOiBmdW5jdGlvbihkZXNjZW5kYW50KSB7XG4gICAgcmV0dXJuIHRoaXMuZGVzY2VuZGFudHMuaW5kZXhPZihkZXNjZW5kYW50KSA+IC0xO1xuICB9LFxuICBoYXNBdHRyaWJ1dGVOYW1lZDogZnVuY3Rpb24oYXR0cmlidXRlTmFtZSkge1xuICAgIHJldHVybiB0aGlzLl9hdHRyaWJ1dGVOYW1lcy5pbmRleE9mKGF0dHJpYnV0ZU5hbWUpID4gLTE7XG4gIH1cbn0pO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gTW9kZWw7XG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9tb2RlbC5qc1xuICoqIG1vZHVsZSBpZCA9IDVcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIi8qKlxuICogVXNlcnMgc2hvdWxkIG5ldmVyIHNlZSB0aGVzZSB0aHJvd24uIEEgYnVnIHJlcG9ydCBzaG91bGQgYmUgZmlsZWQgaWYgc28gYXMgaXQgbWVhbnMgc29tZSBhc3NlcnRpb24gaGFzIGZhaWxlZC5cbiAqIEBwYXJhbSBtZXNzYWdlXG4gKiBAcGFyYW0gY29udGV4dFxuICogQHBhcmFtIHNzZlxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIEludGVybmFsU2llc3RhRXJyb3IobWVzc2FnZSwgY29udGV4dCwgc3NmKSB7XG4gIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG4gIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gIC8vIGNhcHR1cmUgc3RhY2sgdHJhY2VcbiAgaWYgKHNzZiAmJiBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSkge1xuICAgIEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKHRoaXMsIHNzZik7XG4gIH1cbn1cblxuSW50ZXJuYWxTaWVzdGFFcnJvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEVycm9yLnByb3RvdHlwZSk7XG5JbnRlcm5hbFNpZXN0YUVycm9yLnByb3RvdHlwZS5uYW1lID0gJ0ludGVybmFsU2llc3RhRXJyb3InO1xuSW50ZXJuYWxTaWVzdGFFcnJvci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBJbnRlcm5hbFNpZXN0YUVycm9yO1xuXG5mdW5jdGlvbiBpc1NpZXN0YUVycm9yKGVycikge1xuICBpZiAodHlwZW9mIGVyciA9PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiAnZXJyb3InIGluIGVyciAmJiAnb2snIGluIGVyciAmJiAncmVhc29uJyBpbiBlcnI7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGVyck1lc3NhZ2UsIGV4dHJhKSB7XG4gIGlmIChpc1NpZXN0YUVycm9yKGVyck1lc3NhZ2UpKSB7XG4gICAgcmV0dXJuIGVyck1lc3NhZ2U7XG4gIH1cbiAgdmFyIGVyciA9IHtcbiAgICByZWFzb246IGVyck1lc3NhZ2UsXG4gICAgZXJyb3I6IHRydWUsXG4gICAgb2s6IGZhbHNlXG4gIH07XG4gIGZvciAodmFyIHByb3AgaW4gZXh0cmEgfHwge30pIHtcbiAgICBpZiAoZXh0cmEuaGFzT3duUHJvcGVydHkocHJvcCkpIGVycltwcm9wXSA9IGV4dHJhW3Byb3BdO1xuICB9XG4gIGVyci50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh0aGlzKTtcbiAgfTtcbiAgcmV0dXJuIGVycjtcbn07XG5cbm1vZHVsZS5leHBvcnRzLkludGVybmFsU2llc3RhRXJyb3IgPSBJbnRlcm5hbFNpZXN0YUVycm9yO1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL2Vycm9yLmpzXG4gKiogbW9kdWxlIGlkID0gNlxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcixcbiAgQXJyYXlPYnNlcnZlciA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuQXJyYXlPYnNlcnZlcixcbiAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICBhcmdzYXJyYXkgPSByZXF1aXJlKCdhcmdzYXJyYXknKSxcbiAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gIENoYWluID0gcmVxdWlyZSgnLi9DaGFpbicpO1xuXG52YXIgZXZlbnRFbWl0dGVyID0gbmV3IEV2ZW50RW1pdHRlcigpO1xuZXZlbnRFbWl0dGVyLnNldE1heExpc3RlbmVycygxMDApO1xuXG4vKipcbiAqIExpc3RlbiB0byBhIHBhcnRpY3VsYXIgZXZlbnQgZnJvbSB0aGUgU2llc3RhIGdsb2JhbCBFdmVudEVtaXR0ZXIuXG4gKiBNYW5hZ2VzIGl0cyBvd24gc2V0IG9mIGxpc3RlbmVycy5cbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBQcm94eUV2ZW50RW1pdHRlcihldmVudCwgY2hhaW5PcHRzKSB7XG4gIHV0aWwuZXh0ZW5kKHRoaXMsIHtcbiAgICBldmVudDogZXZlbnQsXG4gICAgbGlzdGVuZXJzOiB7fVxuICB9KTtcbiAgdmFyIGRlZmF1bHRDaGFpbk9wdHMgPSB7fTtcblxuICBkZWZhdWx0Q2hhaW5PcHRzLm9uID0gdGhpcy5vbi5iaW5kKHRoaXMpO1xuICBkZWZhdWx0Q2hhaW5PcHRzLm9uY2UgPSB0aGlzLm9uY2UuYmluZCh0aGlzKTtcblxuICBDaGFpbi5jYWxsKHRoaXMsIHV0aWwuZXh0ZW5kKGRlZmF1bHRDaGFpbk9wdHMsIGNoYWluT3B0cyB8fCB7fSkpO1xufVxuXG5Qcm94eUV2ZW50RW1pdHRlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKENoYWluLnByb3RvdHlwZSk7XG5cbnV0aWwuZXh0ZW5kKFByb3h5RXZlbnRFbWl0dGVyLnByb3RvdHlwZSwge1xuICBvbjogZnVuY3Rpb24odHlwZSwgZm4pIHtcbiAgICBpZiAodHlwZW9mIHR5cGUgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgZm4gPSB0eXBlO1xuICAgICAgdHlwZSA9IG51bGw7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgaWYgKHR5cGUudHJpbSgpID09ICcqJykgdHlwZSA9IG51bGw7XG4gICAgICB2YXIgX2ZuID0gZm47XG4gICAgICBmbiA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgZSA9IGUgfHwge307XG4gICAgICAgIGlmICh0eXBlKSB7XG4gICAgICAgICAgaWYgKGUudHlwZSA9PSB0eXBlKSB7XG4gICAgICAgICAgICBfZm4oZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIF9mbihlKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIHZhciBsaXN0ZW5lcnMgPSB0aGlzLmxpc3RlbmVycztcbiAgICAgIGlmICh0eXBlKSB7XG4gICAgICAgIGlmICghbGlzdGVuZXJzW3R5cGVdKSBsaXN0ZW5lcnNbdHlwZV0gPSBbXTtcbiAgICAgICAgbGlzdGVuZXJzW3R5cGVdLnB1c2goZm4pO1xuICAgICAgfVxuICAgIH1cbiAgICBldmVudEVtaXR0ZXIub24odGhpcy5ldmVudCwgZm4pO1xuICAgIHJldHVybiB0aGlzLl9oYW5kbGVyTGluayh7XG4gICAgICBmbjogZm4sXG4gICAgICB0eXBlOiB0eXBlLFxuICAgICAgZXh0ZW5kOiB0aGlzLnByb3h5Q2hhaW5PcHRzXG4gICAgfSk7XG4gIH0sXG4gIG9uY2U6IGZ1bmN0aW9uKHR5cGUsIGZuKSB7XG4gICAgdmFyIGV2ZW50ID0gdGhpcy5ldmVudDtcbiAgICBpZiAodHlwZW9mIHR5cGUgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgZm4gPSB0eXBlO1xuICAgICAgdHlwZSA9IG51bGw7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgaWYgKHR5cGUudHJpbSgpID09ICcqJykgdHlwZSA9IG51bGw7XG4gICAgICB2YXIgX2ZuID0gZm47XG4gICAgICBmbiA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgZSA9IGUgfHwge307XG4gICAgICAgIGlmICh0eXBlKSB7XG4gICAgICAgICAgaWYgKGUudHlwZSA9PSB0eXBlKSB7XG4gICAgICAgICAgICBldmVudEVtaXR0ZXIucmVtb3ZlTGlzdGVuZXIoZXZlbnQsIGZuKTtcbiAgICAgICAgICAgIF9mbihlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgX2ZuKGUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0eXBlKSByZXR1cm4gZXZlbnRFbWl0dGVyLm9uKGV2ZW50LCBmbik7XG4gICAgZWxzZSByZXR1cm4gZXZlbnRFbWl0dGVyLm9uY2UoZXZlbnQsIGZuKTtcbiAgfSxcbiAgX3JlbW92ZUxpc3RlbmVyOiBmdW5jdGlvbihmbiwgdHlwZSkge1xuICAgIGlmICh0eXBlKSB7XG4gICAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5saXN0ZW5lcnNbdHlwZV0sXG4gICAgICAgIGlkeCA9IGxpc3RlbmVycy5pbmRleE9mKGZuKTtcbiAgICAgIGxpc3RlbmVycy5zcGxpY2UoaWR4LCAxKTtcbiAgICB9XG4gICAgcmV0dXJuIGV2ZW50RW1pdHRlci5yZW1vdmVMaXN0ZW5lcih0aGlzLmV2ZW50LCBmbik7XG4gIH0sXG4gIGVtaXQ6IGZ1bmN0aW9uKHR5cGUsIHBheWxvYWQpIHtcbiAgICBpZiAodHlwZW9mIHR5cGUgPT0gJ29iamVjdCcpIHtcbiAgICAgIHBheWxvYWQgPSB0eXBlO1xuICAgICAgdHlwZSA9IG51bGw7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgcGF5bG9hZCA9IHBheWxvYWQgfHwge307XG4gICAgICBwYXlsb2FkLnR5cGUgPSB0eXBlO1xuICAgIH1cbiAgICBldmVudEVtaXR0ZXIuZW1pdC5jYWxsKGV2ZW50RW1pdHRlciwgdGhpcy5ldmVudCwgcGF5bG9hZCk7XG4gIH0sXG4gIF9yZW1vdmVBbGxMaXN0ZW5lcnM6IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICAodGhpcy5saXN0ZW5lcnNbdHlwZV0gfHwgW10pLmZvckVhY2goZnVuY3Rpb24oZm4pIHtcbiAgICAgIGV2ZW50RW1pdHRlci5yZW1vdmVMaXN0ZW5lcih0aGlzLmV2ZW50LCBmbik7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLmxpc3RlbmVyc1t0eXBlXSA9IFtdO1xuICB9LFxuICByZW1vdmVBbGxMaXN0ZW5lcnM6IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICBpZiAodHlwZSkge1xuICAgICAgdGhpcy5fcmVtb3ZlQWxsTGlzdGVuZXJzKHR5cGUpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGZvciAodHlwZSBpbiB0aGlzLmxpc3RlbmVycykge1xuICAgICAgICBpZiAodGhpcy5saXN0ZW5lcnMuaGFzT3duUHJvcGVydHkodHlwZSkpIHtcbiAgICAgICAgICB0aGlzLl9yZW1vdmVBbGxMaXN0ZW5lcnModHlwZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn0pO1xuXG51dGlsLmV4dGVuZChldmVudEVtaXR0ZXIsIHtcbiAgUHJveHlFdmVudEVtaXR0ZXI6IFByb3h5RXZlbnRFbWl0dGVyLFxuICB3cmFwQXJyYXk6IGZ1bmN0aW9uKGFycmF5LCBmaWVsZCwgbW9kZWxJbnN0YW5jZSkge1xuICAgIGlmICghYXJyYXkub2JzZXJ2ZXIpIHtcbiAgICAgIGFycmF5Lm9ic2VydmVyID0gbmV3IEFycmF5T2JzZXJ2ZXIoYXJyYXkpO1xuICAgICAgYXJyYXkub2JzZXJ2ZXIub3BlbihmdW5jdGlvbihzcGxpY2VzKSB7XG4gICAgICAgIHZhciBmaWVsZElzQXR0cmlidXRlID0gbW9kZWxJbnN0YW5jZS5fYXR0cmlidXRlTmFtZXMuaW5kZXhPZihmaWVsZCkgPiAtMTtcbiAgICAgICAgaWYgKGZpZWxkSXNBdHRyaWJ1dGUpIHtcbiAgICAgICAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24oc3BsaWNlKSB7XG4gICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgICAgY29sbGVjdGlvbjogbW9kZWxJbnN0YW5jZS5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgbW9kZWw6IG1vZGVsSW5zdGFuY2UubW9kZWwubmFtZSxcbiAgICAgICAgICAgICAgbG9jYWxJZDogbW9kZWxJbnN0YW5jZS5sb2NhbElkLFxuICAgICAgICAgICAgICBpbmRleDogc3BsaWNlLmluZGV4LFxuICAgICAgICAgICAgICByZW1vdmVkOiBzcGxpY2UucmVtb3ZlZCxcbiAgICAgICAgICAgICAgYWRkZWQ6IHNwbGljZS5hZGRlZENvdW50ID8gYXJyYXkuc2xpY2Uoc3BsaWNlLmluZGV4LCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkgOiBbXSxcbiAgICAgICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgICBmaWVsZDogZmllbGQsXG4gICAgICAgICAgICAgIG9iajogbW9kZWxJbnN0YW5jZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufSk7XG5cbnZhciBvbGRFbWl0ID0gZXZlbnRFbWl0dGVyLmVtaXQ7XG5cbi8vIEVuc3VyZSB0aGF0IGVycm9ycyBpbiBldmVudCBoYW5kbGVycyBkbyBub3Qgc3RhbGwgU2llc3RhLlxuZXZlbnRFbWl0dGVyLmVtaXQgPSBmdW5jdGlvbihldmVudCwgcGF5bG9hZCkge1xuICB0cnkge1xuICAgIG9sZEVtaXQuY2FsbChldmVudEVtaXR0ZXIsIGV2ZW50LCBwYXlsb2FkKTtcbiAgfVxuICBjYXRjaCAoZSkge1xuICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZXZlbnRFbWl0dGVyO1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL2V2ZW50cy5qc1xuICoqIG1vZHVsZSBpZCA9IDdcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIm1vZHVsZS5leHBvcnRzID0ge1xuICBPbmVUb01hbnk6ICdPbmVUb01hbnknLFxuICBPbmVUb09uZTogJ09uZVRvT25lJyxcbiAgTWFueVRvTWFueTogJ01hbnlUb01hbnknXG59O1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL1JlbGF0aW9uc2hpcFR5cGUuanNcbiAqKiBtb2R1bGUgaWQgPSA4XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCIvKipcbiAqIEZvciB0aG9zZSBmYW1pbGlhciB3aXRoIEFwcGxlJ3MgQ29jb2EgbGlicmFyeSwgcmVhY3RpdmUgcXVlcmllcyByb3VnaGx5IG1hcCBvbnRvIE5TRmV0Y2hlZFJlc3VsdHNDb250cm9sbGVyLlxuICpcbiAqIFRoZXkgcHJlc2VudCBhIHF1ZXJ5IHNldCB0aGF0ICdyZWFjdHMnIHRvIGNoYW5nZXMgaW4gdGhlIHVuZGVybHlpbmcgZGF0YS5cbiAqIEBtb2R1bGUgcmVhY3RpdmVRdWVyeVxuICovXG5cbnZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdxdWVyeTpyZWFjdGl2ZScpLFxuICBRdWVyeSA9IHJlcXVpcmUoJy4vUXVlcnknKSxcbiAgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyLFxuICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICBDaGFpbiA9IHJlcXVpcmUoJy4vQ2hhaW4nKSxcbiAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgY29uc3RydWN0UXVlcnlTZXQgPSByZXF1aXJlKCcuL1F1ZXJ5U2V0JyksXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuLyoqXG4gKlxuICogQHBhcmFtIHtRdWVyeX0gcXVlcnkgLSBUaGUgdW5kZXJseWluZyBxdWVyeVxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIFJlYWN0aXZlUXVlcnkocXVlcnkpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcbiAgQ2hhaW4uY2FsbCh0aGlzKTtcbiAgdXRpbC5leHRlbmQodGhpcywge1xuICAgIGluc2VydGlvblBvbGljeTogUmVhY3RpdmVRdWVyeS5JbnNlcnRpb25Qb2xpY3kuQmFjayxcbiAgICBpbml0aWFsaXNlZDogZmFsc2VcbiAgfSk7XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdxdWVyeScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3F1ZXJ5XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKHYpIHtcbiAgICAgIGlmICh2KSB7XG4gICAgICAgIHRoaXMuX3F1ZXJ5ID0gdjtcbiAgICAgICAgdGhpcy5yZXN1bHRzID0gY29uc3RydWN0UXVlcnlTZXQoW10sIHYubW9kZWwpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHRoaXMuX3F1ZXJ5ID0gbnVsbDtcbiAgICAgICAgdGhpcy5yZXN1bHRzID0gbnVsbDtcbiAgICAgIH1cbiAgICB9LFxuICAgIGNvbmZpZ3VyYWJsZTogZmFsc2UsXG4gICAgZW51bWVyYWJsZTogdHJ1ZVxuICB9KTtcblxuICBpZiAocXVlcnkpIHtcbiAgICB1dGlsLmV4dGVuZCh0aGlzLCB7XG4gICAgICBfcXVlcnk6IHF1ZXJ5LFxuICAgICAgcmVzdWx0czogY29uc3RydWN0UXVlcnlTZXQoW10sIHF1ZXJ5Lm1vZGVsKVxuICAgIH0pXG4gIH1cblxuICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0aGlzLCB7XG4gICAgaW5pdGlhbGl6ZWQ6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmluaXRpYWxpc2VkXG4gICAgICB9XG4gICAgfSxcbiAgICBtb2RlbDoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHF1ZXJ5ID0gc2VsZi5fcXVlcnk7XG4gICAgICAgIGlmIChxdWVyeSkge1xuICAgICAgICAgIHJldHVybiBxdWVyeS5tb2RlbFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgICBjb2xsZWN0aW9uOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gc2VsZi5tb2RlbC5jb2xsZWN0aW9uTmFtZVxuICAgICAgfVxuICAgIH1cbiAgfSk7XG5cblxufVxuXG5SZWFjdGl2ZVF1ZXJ5LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRXZlbnRFbWl0dGVyLnByb3RvdHlwZSk7XG51dGlsLmV4dGVuZChSZWFjdGl2ZVF1ZXJ5LnByb3RvdHlwZSwgQ2hhaW4ucHJvdG90eXBlKTtcblxudXRpbC5leHRlbmQoUmVhY3RpdmVRdWVyeSwge1xuICBJbnNlcnRpb25Qb2xpY3k6IHtcbiAgICBGcm9udDogJ0Zyb250JyxcbiAgICBCYWNrOiAnQmFjaydcbiAgfVxufSk7XG5cbnV0aWwuZXh0ZW5kKFJlYWN0aXZlUXVlcnkucHJvdG90eXBlLCB7XG4gIC8qKlxuICAgKlxuICAgKiBAcGFyYW0gY2JcbiAgICogQHBhcmFtIHtib29sfSBfaWdub3JlSW5pdCAtIGV4ZWN1dGUgcXVlcnkgYWdhaW4sIGluaXRpYWxpc2VkIG9yIG5vdC5cbiAgICogQHJldHVybnMgeyp9XG4gICAqL1xuICBpbml0OiBmdW5jdGlvbihjYiwgX2lnbm9yZUluaXQpIHtcbiAgICBpZiAodGhpcy5fcXVlcnkpIHtcbiAgICAgIHZhciBuYW1lID0gdGhpcy5fY29uc3RydWN0Tm90aWZpY2F0aW9uTmFtZSgpO1xuICAgICAgdmFyIGhhbmRsZXIgPSBmdW5jdGlvbihuKSB7XG4gICAgICAgIHRoaXMuX2hhbmRsZU5vdGlmKG4pO1xuICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgdGhpcy5oYW5kbGVyID0gaGFuZGxlcjtcbiAgICAgIGV2ZW50cy5vbihuYW1lLCBoYW5kbGVyKTtcbiAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgIGlmICgoIXRoaXMuaW5pdGlhbGlzZWQpIHx8IF9pZ25vcmVJbml0KSB7XG4gICAgICAgICAgdGhpcy5fcXVlcnkuZXhlY3V0ZShmdW5jdGlvbihlcnIsIHJlc3VsdHMpIHtcbiAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgIGNiKG51bGwsIHRoaXMuX2FwcGx5UmVzdWx0cyhyZXN1bHRzKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGNiKG51bGwsIHRoaXMucmVzdWx0cyk7XG4gICAgICAgIH1cbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuICAgIGVsc2UgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ05vIF9xdWVyeSBkZWZpbmVkJyk7XG4gIH0sXG4gIF9hcHBseVJlc3VsdHM6IGZ1bmN0aW9uKHJlc3VsdHMpIHtcbiAgICB0aGlzLnJlc3VsdHMgPSByZXN1bHRzO1xuICAgIHRoaXMuaW5pdGlhbGlzZWQgPSB0cnVlO1xuICAgIHJldHVybiB0aGlzLnJlc3VsdHM7XG4gIH0sXG4gIGluc2VydDogZnVuY3Rpb24obmV3T2JqKSB7XG4gICAgdmFyIHJlc3VsdHMgPSB0aGlzLnJlc3VsdHMubXV0YWJsZUNvcHkoKTtcbiAgICBpZiAodGhpcy5pbnNlcnRpb25Qb2xpY3kgPT0gUmVhY3RpdmVRdWVyeS5JbnNlcnRpb25Qb2xpY3kuQmFjaykgdmFyIGlkeCA9IHJlc3VsdHMucHVzaChuZXdPYmopO1xuICAgIGVsc2UgaWR4ID0gcmVzdWx0cy51bnNoaWZ0KG5ld09iaik7XG4gICAgdGhpcy5yZXN1bHRzID0gcmVzdWx0cy5hc01vZGVsUXVlcnlTZXQodGhpcy5tb2RlbCk7XG4gICAgcmV0dXJuIGlkeDtcbiAgfSxcbiAgLyoqXG4gICAqIEV4ZWN1dGUgdGhlIHVuZGVybHlpbmcgcXVlcnkgYWdhaW4uXG4gICAqIEBwYXJhbSBjYlxuICAgKi9cbiAgdXBkYXRlOiBmdW5jdGlvbihjYikge1xuICAgIHJldHVybiB0aGlzLmluaXQoY2IsIHRydWUpXG4gIH0sXG4gIF9oYW5kbGVOb3RpZjogZnVuY3Rpb24obikge1xuICAgIGlmIChuLnR5cGUgPT0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuTmV3KSB7XG4gICAgICB2YXIgbmV3T2JqID0gbi5uZXc7XG4gICAgICBpZiAodGhpcy5fcXVlcnkub2JqZWN0TWF0Y2hlc1F1ZXJ5KG5ld09iaikpIHtcbiAgICAgICAgbG9nKCdOZXcgb2JqZWN0IG1hdGNoZXMnLCBuZXdPYmopO1xuICAgICAgICB2YXIgaWR4ID0gdGhpcy5pbnNlcnQobmV3T2JqKTtcbiAgICAgICAgdGhpcy5lbWl0KG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSwge1xuICAgICAgICAgIGluZGV4OiBpZHgsXG4gICAgICAgICAgYWRkZWQ6IFtuZXdPYmpdLFxuICAgICAgICAgIHR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICBvYmo6IHRoaXNcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgbG9nKCdOZXcgb2JqZWN0IGRvZXMgbm90IG1hdGNoJywgbmV3T2JqKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSBpZiAobi50eXBlID09IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNldCkge1xuICAgICAgbmV3T2JqID0gbi5vYmo7XG4gICAgICB2YXIgaW5kZXggPSB0aGlzLnJlc3VsdHMuaW5kZXhPZihuZXdPYmopLFxuICAgICAgICBhbHJlYWR5Q29udGFpbnMgPSBpbmRleCA+IC0xLFxuICAgICAgICBtYXRjaGVzID0gdGhpcy5fcXVlcnkub2JqZWN0TWF0Y2hlc1F1ZXJ5KG5ld09iaik7XG4gICAgICBpZiAobWF0Y2hlcyAmJiAhYWxyZWFkeUNvbnRhaW5zKSB7XG4gICAgICAgIGxvZygnVXBkYXRlZCBvYmplY3Qgbm93IG1hdGNoZXMhJywgbmV3T2JqKTtcbiAgICAgICAgaWR4ID0gdGhpcy5pbnNlcnQobmV3T2JqKTtcbiAgICAgICAgdGhpcy5lbWl0KG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSwge1xuICAgICAgICAgIGluZGV4OiBpZHgsXG4gICAgICAgICAgYWRkZWQ6IFtuZXdPYmpdLFxuICAgICAgICAgIHR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICBvYmo6IHRoaXNcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIGlmICghbWF0Y2hlcyAmJiBhbHJlYWR5Q29udGFpbnMpIHtcbiAgICAgICAgbG9nKCdVcGRhdGVkIG9iamVjdCBubyBsb25nZXIgbWF0Y2hlcyEnLCBuZXdPYmopO1xuICAgICAgICByZXN1bHRzID0gdGhpcy5yZXN1bHRzLm11dGFibGVDb3B5KCk7XG4gICAgICAgIHZhciByZW1vdmVkID0gcmVzdWx0cy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB0aGlzLnJlc3VsdHMgPSByZXN1bHRzLmFzTW9kZWxRdWVyeVNldCh0aGlzLm1vZGVsKTtcbiAgICAgICAgdGhpcy5lbWl0KG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSwge1xuICAgICAgICAgIGluZGV4OiBpbmRleCxcbiAgICAgICAgICBvYmo6IHRoaXMsXG4gICAgICAgICAgbmV3OiBuZXdPYmosXG4gICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgIHJlbW92ZWQ6IHJlbW92ZWRcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIGlmICghbWF0Y2hlcyAmJiAhYWxyZWFkeUNvbnRhaW5zKSB7XG4gICAgICAgIGxvZygnRG9lcyBub3QgY29udGFpbiwgYnV0IGRvZXNudCBtYXRjaCBzbyBub3QgaW5zZXJ0aW5nJywgbmV3T2JqKTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKG1hdGNoZXMgJiYgYWxyZWFkeUNvbnRhaW5zKSB7XG4gICAgICAgIGxvZygnTWF0Y2hlcyBidXQgYWxyZWFkeSBjb250YWlucycsIG5ld09iaik7XG4gICAgICAgIC8vIFNlbmQgdGhlIG5vdGlmaWNhdGlvbiBvdmVyLlxuICAgICAgICB0aGlzLmVtaXQobi50eXBlLCBuKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSBpZiAobi50eXBlID09IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlJlbW92ZSkge1xuICAgICAgbmV3T2JqID0gbi5vYmo7XG4gICAgICB2YXIgcmVzdWx0cyA9IHRoaXMucmVzdWx0cy5tdXRhYmxlQ29weSgpO1xuICAgICAgaW5kZXggPSByZXN1bHRzLmluZGV4T2YobmV3T2JqKTtcbiAgICAgIGlmIChpbmRleCA+IC0xKSB7XG4gICAgICAgIGxvZygnUmVtb3Zpbmcgb2JqZWN0JywgbmV3T2JqKTtcbiAgICAgICAgcmVtb3ZlZCA9IHJlc3VsdHMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgdGhpcy5yZXN1bHRzID0gY29uc3RydWN0UXVlcnlTZXQocmVzdWx0cywgdGhpcy5tb2RlbCk7XG4gICAgICAgIHRoaXMuZW1pdChtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5TcGxpY2UsIHtcbiAgICAgICAgICBpbmRleDogaW5kZXgsXG4gICAgICAgICAgb2JqOiB0aGlzLFxuICAgICAgICAgIHR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICByZW1vdmVkOiByZW1vdmVkXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGxvZygnTm8gbW9kZWxFdmVudHMgbmVjY2Vzc2FyeS4nLCBuZXdPYmopO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdVbmtub3duIGNoYW5nZSB0eXBlIFwiJyArIG4udHlwZS50b1N0cmluZygpICsgJ1wiJylcbiAgICB9XG4gICAgdGhpcy5yZXN1bHRzID0gY29uc3RydWN0UXVlcnlTZXQodGhpcy5fcXVlcnkuX3NvcnRSZXN1bHRzKHRoaXMucmVzdWx0cyksIHRoaXMubW9kZWwpO1xuICB9LFxuICBfY29uc3RydWN0Tm90aWZpY2F0aW9uTmFtZTogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY29sbGVjdGlvbk5hbWUgKyAnOicgKyB0aGlzLm1vZGVsLm5hbWU7XG4gIH0sXG4gIHRlcm1pbmF0ZTogZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMuaGFuZGxlcikge1xuICAgICAgZXZlbnRzLnJlbW92ZUxpc3RlbmVyKHRoaXMuX2NvbnN0cnVjdE5vdGlmaWNhdGlvbk5hbWUoKSwgdGhpcy5oYW5kbGVyKTtcbiAgICB9XG4gICAgdGhpcy5yZXN1bHRzID0gbnVsbDtcbiAgICB0aGlzLmhhbmRsZXIgPSBudWxsO1xuICB9LFxuICBfcmVnaXN0ZXJFdmVudEhhbmRsZXI6IGZ1bmN0aW9uKG9uLCBuYW1lLCBmbikge1xuICAgIHZhciByZW1vdmVMaXN0ZW5lciA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXI7XG4gICAgaWYgKG5hbWUudHJpbSgpID09ICcqJykge1xuICAgICAgT2JqZWN0LmtleXMobW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUpLmZvckVhY2goZnVuY3Rpb24oaykge1xuICAgICAgICBvbi5jYWxsKHRoaXMsIG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlW2tdLCBmbik7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIG9uLmNhbGwodGhpcywgbmFtZSwgZm4pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fbGluayh7XG4gICAgICAgIG9uOiB0aGlzLm9uLmJpbmQodGhpcyksXG4gICAgICAgIG9uY2U6IHRoaXMub25jZS5iaW5kKHRoaXMpLFxuICAgICAgICB1cGRhdGU6IHRoaXMudXBkYXRlLmJpbmQodGhpcyksXG4gICAgICAgIGluc2VydDogdGhpcy5pbnNlcnQuYmluZCh0aGlzKVxuICAgICAgfSxcbiAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAobmFtZS50cmltKCkgPT0gJyonKSB7XG4gICAgICAgICAgT2JqZWN0LmtleXMobW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUpLmZvckVhY2goZnVuY3Rpb24oaykge1xuICAgICAgICAgICAgcmVtb3ZlTGlzdGVuZXIuY2FsbCh0aGlzLCBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZVtrXSwgZm4pO1xuICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgcmVtb3ZlTGlzdGVuZXIuY2FsbCh0aGlzLCBuYW1lLCBmbik7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gIH0sXG4gIG9uOiBmdW5jdGlvbihuYW1lLCBmbikge1xuICAgIHJldHVybiB0aGlzLl9yZWdpc3RlckV2ZW50SGFuZGxlcihFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uLCBuYW1lLCBmbik7XG4gIH0sXG4gIG9uY2U6IGZ1bmN0aW9uKG5hbWUsIGZuKSB7XG4gICAgcmV0dXJuIHRoaXMuX3JlZ2lzdGVyRXZlbnRIYW5kbGVyKEV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSwgbmFtZSwgZm4pO1xuICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBSZWFjdGl2ZVF1ZXJ5O1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL1JlYWN0aXZlUXVlcnkuanNcbiAqKiBtb2R1bGUgaWQgPSA5XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCIvKipcbiAqIEBtb2R1bGUgcmVsYXRpb25zaGlwc1xuICovXG5cbnZhciBSZWxhdGlvbnNoaXBQcm94eSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwUHJveHknKSxcbiAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyA9IGV2ZW50cy53cmFwQXJyYXksXG4gIEFycmF5T2JzZXJ2ZXIgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLkFycmF5T2JzZXJ2ZXIsXG4gIE1vZGVsRXZlbnRUeXBlID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLk1vZGVsRXZlbnRUeXBlO1xuXG4vKipcbiAqIFtNYW55VG9NYW55UHJveHkgZGVzY3JpcHRpb25dXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICovXG5mdW5jdGlvbiBNYW55VG9NYW55UHJveHkob3B0cykge1xuICBSZWxhdGlvbnNoaXBQcm94eS5jYWxsKHRoaXMsIG9wdHMpO1xuICB0aGlzLnJlbGF0ZWQgPSBbXTtcbiAgdGhpcy5yZWxhdGVkQ2FuY2VsTGlzdGVuZXJzID0ge307XG4gIGlmICh0aGlzLmlzUmV2ZXJzZSkge1xuICAgIHRoaXMucmVsYXRlZCA9IFtdO1xuICAgIC8vdGhpcy5mb3J3YXJkTW9kZWwub24obW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuUmVtb3ZlLCBmdW5jdGlvbihlKSB7XG4gICAgLy8gIGlmIChlLmZpZWxkID09IGUuZm9yd2FyZE5hbWUpIHtcbiAgICAvLyAgICB2YXIgaWR4ID0gdGhpcy5yZWxhdGVkLmluZGV4T2YoZS5vYmopO1xuICAgIC8vICAgIGlmIChpZHggPiAtMSkge1xuICAgIC8vICAgICAgdmFyIHJlbW92ZWQgPSB0aGlzLnJlbGF0ZWQuc3BsaWNlKGlkeCwgMSk7XG4gICAgLy8gICAgfVxuICAgIC8vICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgIC8vICAgICAgY29sbGVjdGlvbjogdGhpcy5yZXZlcnNlTW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgLy8gICAgICBtb2RlbDogdGhpcy5yZXZlcnNlTW9kZWwubmFtZSxcbiAgICAvLyAgICAgIGxvY2FsSWQ6IHRoaXMub2JqZWN0LmxvY2FsSWQsXG4gICAgLy8gICAgICBmaWVsZDogdGhpcy5yZXZlcnNlTmFtZSxcbiAgICAvLyAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgLy8gICAgICBhZGRlZDogW10sXG4gICAgLy8gICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgLy8gICAgICBpbmRleDogaWR4LFxuICAgIC8vICAgICAgb2JqOiB0aGlzLm9iamVjdFxuICAgIC8vICAgIH0pO1xuICAgIC8vICB9XG4gICAgLy99LmJpbmQodGhpcykpO1xuICB9XG59XG5cbk1hbnlUb01hbnlQcm94eS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSk7XG5cbnV0aWwuZXh0ZW5kKE1hbnlUb01hbnlQcm94eS5wcm90b3R5cGUsIHtcbiAgY2xlYXJSZXZlcnNlOiBmdW5jdGlvbihyZW1vdmVkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJlbW92ZWQuZm9yRWFjaChmdW5jdGlvbihyZW1vdmVkT2JqZWN0KSB7XG4gICAgICB2YXIgcmV2ZXJzZVByb3h5ID0gc2VsZi5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZShyZW1vdmVkT2JqZWN0KTtcbiAgICAgIHZhciBpZHggPSByZXZlcnNlUHJveHkucmVsYXRlZC5pbmRleE9mKHNlbGYub2JqZWN0KTtcbiAgICAgIHJldmVyc2VQcm94eS5tYWtlQ2hhbmdlc1RvUmVsYXRlZFdpdGhvdXRPYnNlcnZhdGlvbnMoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldmVyc2VQcm94eS5zcGxpY2UoaWR4LCAxKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9LFxuICBzZXRSZXZlcnNlT2ZBZGRlZDogZnVuY3Rpb24oYWRkZWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgYWRkZWQuZm9yRWFjaChmdW5jdGlvbihhZGRlZE9iamVjdCkge1xuICAgICAgdmFyIHJldmVyc2VQcm94eSA9IHNlbGYucmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2UoYWRkZWRPYmplY3QpO1xuICAgICAgcmV2ZXJzZVByb3h5Lm1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9ucyhmdW5jdGlvbigpIHtcbiAgICAgICAgcmV2ZXJzZVByb3h5LnNwbGljZSgwLCAwLCBzZWxmLm9iamVjdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSxcbiAgd3JhcEFycmF5OiBmdW5jdGlvbihhcnIpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyhhcnIsIHRoaXMucmV2ZXJzZU5hbWUsIHRoaXMub2JqZWN0KTtcbiAgICBpZiAoIWFyci5hcnJheU9ic2VydmVyKSB7XG4gICAgICBhcnIuYXJyYXlPYnNlcnZlciA9IG5ldyBBcnJheU9ic2VydmVyKGFycik7XG4gICAgICB2YXIgb2JzZXJ2ZXJGdW5jdGlvbiA9IGZ1bmN0aW9uKHNwbGljZXMpIHtcbiAgICAgICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uKHNwbGljZSkge1xuICAgICAgICAgIHZhciBhZGRlZCA9IHNwbGljZS5hZGRlZENvdW50ID8gYXJyLnNsaWNlKHNwbGljZS5pbmRleCwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQpIDogW107XG4gICAgICAgICAgdmFyIHJlbW92ZWQgPSBzcGxpY2UucmVtb3ZlZDtcbiAgICAgICAgICBzZWxmLmNsZWFyUmV2ZXJzZShyZW1vdmVkKTtcbiAgICAgICAgICBzZWxmLnNldFJldmVyc2VPZkFkZGVkKGFkZGVkKTtcbiAgICAgICAgICB2YXIgbW9kZWwgPSBzZWxmLmdldEZvcndhcmRNb2RlbCgpO1xuICAgICAgICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgICAgICAgY29sbGVjdGlvbjogbW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICBtb2RlbDogbW9kZWwubmFtZSxcbiAgICAgICAgICAgIGxvY2FsSWQ6IHNlbGYub2JqZWN0LmxvY2FsSWQsXG4gICAgICAgICAgICBmaWVsZDogc2VsZi5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgICAgICAgcmVtb3ZlZDogcmVtb3ZlZCxcbiAgICAgICAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgIGluZGV4OiBzcGxpY2UuaW5kZXgsXG4gICAgICAgICAgICBvYmo6IHNlbGYub2JqZWN0XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfTtcbiAgICAgIGFyci5hcnJheU9ic2VydmVyLm9wZW4ob2JzZXJ2ZXJGdW5jdGlvbik7XG4gICAgfVxuICB9LFxuICBnZXQ6IGZ1bmN0aW9uKGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIGNiKG51bGwsIHRoaXMucmVsYXRlZCk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgdmFsaWRhdGU6IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSAhPSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICByZXR1cm4gJ0Nhbm5vdCBhc3NpZ24gc2NhbGFyIHRvIG1hbnkgdG8gbWFueSc7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuICBzZXQ6IGZ1bmN0aW9uKG9iaiwgb3B0cykge1xuICAgIHRoaXMuY2hlY2tJbnN0YWxsZWQoKTtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKG9iaikge1xuICAgICAgdmFyIGVycm9yTWVzc2FnZTtcbiAgICAgIGlmIChlcnJvck1lc3NhZ2UgPSB0aGlzLnZhbGlkYXRlKG9iaikpIHtcbiAgICAgICAgcmV0dXJuIGVycm9yTWVzc2FnZTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB0aGlzLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkKG9iaiwgb3B0cyk7XG4gICAgICAgIHRoaXMud3JhcEFycmF5KG9iaik7XG4gICAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkUmV2ZXJzZShvYmosIG9wdHMpO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHRoaXMuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkKG9iaiwgb3B0cyk7XG4gICAgfVxuICB9LFxuICBpbnN0YWxsOiBmdW5jdGlvbihvYmopIHtcbiAgICBSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUuaW5zdGFsbC5jYWxsKHRoaXMsIG9iaik7XG4gICAgdGhpcy53cmFwQXJyYXkodGhpcy5yZWxhdGVkKTtcbiAgICBvYmpbKCdzcGxpY2UnICsgdXRpbC5jYXBpdGFsaXNlRmlyc3RMZXR0ZXIodGhpcy5yZXZlcnNlTmFtZSkpXSA9IHRoaXMuc3BsaWNlLmJpbmQodGhpcyk7XG4gIH0sXG4gIHJlZ2lzdGVyUmVtb3ZhbExpc3RlbmVyOiBmdW5jdGlvbihvYmopIHtcbiAgICB0aGlzLnJlbGF0ZWRDYW5jZWxMaXN0ZW5lcnNbb2JqLmxvY2FsSWRdID0gb2JqLm9uKCcqJywgZnVuY3Rpb24oZSkge1xuXG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gTWFueVRvTWFueVByb3h5O1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL01hbnlUb01hbnlQcm94eS5qc1xuICoqIG1vZHVsZSBpZCA9IDEwXG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgUmVsYXRpb25zaGlwUHJveHkgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFByb3h5JyksXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgU2llc3RhTW9kZWwgPSByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKTtcblxuLyoqXG4gKiBbT25lVG9PbmVQcm94eSBkZXNjcmlwdGlvbl1cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKi9cbmZ1bmN0aW9uIE9uZVRvT25lUHJveHkob3B0cykge1xuICBSZWxhdGlvbnNoaXBQcm94eS5jYWxsKHRoaXMsIG9wdHMpO1xufVxuXG5cbk9uZVRvT25lUHJveHkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUpO1xuXG51dGlsLmV4dGVuZChPbmVUb09uZVByb3h5LnByb3RvdHlwZSwge1xuICAvKipcbiAgICogVmFsaWRhdGUgdGhlIG9iamVjdCB0aGF0IHdlJ3JlIHNldHRpbmdcbiAgICogQHBhcmFtIG9ialxuICAgKiBAcmV0dXJucyB7c3RyaW5nfG51bGx9IEFuIGVycm9yIG1lc3NhZ2Ugb3IgbnVsbFxuICAgKi9cbiAgdmFsaWRhdGU6IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSA9PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICByZXR1cm4gJ0Nhbm5vdCBhc3NpZ24gYXJyYXkgdG8gb25lIHRvIG9uZSByZWxhdGlvbnNoaXAnO1xuICAgIH1cbiAgICBlbHNlIGlmICgoIW9iaiBpbnN0YW5jZW9mIFNpZXN0YU1vZGVsKSkge1xuXG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuICBzZXQ6IGZ1bmN0aW9uKG9iaiwgb3B0cykge1xuICAgIHRoaXMuY2hlY2tJbnN0YWxsZWQoKTtcbiAgICBpZiAob2JqKSB7XG4gICAgICB2YXIgZXJyb3JNZXNzYWdlO1xuICAgICAgaWYgKGVycm9yTWVzc2FnZSA9IHRoaXMudmFsaWRhdGUob2JqKSkge1xuICAgICAgICByZXR1cm4gZXJyb3JNZXNzYWdlO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHRoaXMuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgICAgdGhpcy5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICAgICAgdGhpcy5zZXRJZEFuZFJlbGF0ZWRSZXZlcnNlKG9iaiwgb3B0cyk7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgdGhpcy5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICB9XG4gIH0sXG4gIGdldDogZnVuY3Rpb24oY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgY2IobnVsbCwgdGhpcy5yZWxhdGVkKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBPbmVUb09uZVByb3h5O1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL09uZVRvT25lUHJveHkuanNcbiAqKiBtb2R1bGUgaWQgPSAxMVxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIFJlbGF0aW9uc2hpcFByb3h5ID0gcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBQcm94eScpLFxuICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzID0gZXZlbnRzLndyYXBBcnJheSxcbiAgQXJyYXlPYnNlcnZlciA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuQXJyYXlPYnNlcnZlcixcbiAgTW9kZWxFdmVudFR5cGUgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJykuTW9kZWxFdmVudFR5cGU7XG5cbi8qKlxuICogQGNsYXNzICBbT25lVG9NYW55UHJveHkgZGVzY3JpcHRpb25dXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB7W3R5cGVdfSBvcHRzXG4gKi9cbmZ1bmN0aW9uIE9uZVRvTWFueVByb3h5KG9wdHMpIHtcbiAgUmVsYXRpb25zaGlwUHJveHkuY2FsbCh0aGlzLCBvcHRzKTtcbiAgaWYgKHRoaXMuaXNSZXZlcnNlKSB7XG4gICAgdGhpcy5yZWxhdGVkID0gW107XG4gICAgLy90aGlzLmZvcndhcmRNb2RlbC5vbihtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5SZW1vdmUsIGZ1bmN0aW9uKGUpIHtcbiAgICAvLyAgaWYgKGUuZmllbGQgPT0gZS5mb3J3YXJkTmFtZSkge1xuICAgIC8vICAgIHZhciBpZHggPSB0aGlzLnJlbGF0ZWQuaW5kZXhPZihlLm9iaik7XG4gICAgLy8gICAgaWYgKGlkeCA+IC0xKSB7XG4gICAgLy8gICAgICB2YXIgcmVtb3ZlZCA9IHRoaXMucmVsYXRlZC5zcGxpY2UoaWR4LCAxKTtcbiAgICAvLyAgICB9XG4gICAgLy8gICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgLy8gICAgICBjb2xsZWN0aW9uOiB0aGlzLnJldmVyc2VNb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAvLyAgICAgIG1vZGVsOiB0aGlzLnJldmVyc2VNb2RlbC5uYW1lLFxuICAgIC8vICAgICAgbG9jYWxJZDogdGhpcy5vYmplY3QubG9jYWxJZCxcbiAgICAvLyAgICAgIGZpZWxkOiB0aGlzLnJldmVyc2VOYW1lLFxuICAgIC8vICAgICAgcmVtb3ZlZDogcmVtb3ZlZCxcbiAgICAvLyAgICAgIGFkZGVkOiBbXSxcbiAgICAvLyAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAvLyAgICAgIGluZGV4OiBpZHgsXG4gICAgLy8gICAgICBvYmo6IHRoaXMub2JqZWN0XG4gICAgLy8gICAgfSk7XG4gICAgLy8gIH1cbiAgICAvL30uYmluZCh0aGlzKSk7XG4gIH1cbn1cblxuT25lVG9NYW55UHJveHkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUpO1xuXG51dGlsLmV4dGVuZChPbmVUb01hbnlQcm94eS5wcm90b3R5cGUsIHtcbiAgY2xlYXJSZXZlcnNlOiBmdW5jdGlvbihyZW1vdmVkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJlbW92ZWQuZm9yRWFjaChmdW5jdGlvbihyZW1vdmVkT2JqZWN0KSB7XG4gICAgICB2YXIgcmV2ZXJzZVByb3h5ID0gc2VsZi5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZShyZW1vdmVkT2JqZWN0KTtcbiAgICAgIHJldmVyc2VQcm94eS5zZXRJZEFuZFJlbGF0ZWQobnVsbCk7XG4gICAgfSk7XG4gIH0sXG4gIHNldFJldmVyc2VPZkFkZGVkOiBmdW5jdGlvbihhZGRlZCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBhZGRlZC5mb3JFYWNoKGZ1bmN0aW9uKGFkZGVkKSB7XG4gICAgICB2YXIgZm9yd2FyZFByb3h5ID0gc2VsZi5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZShhZGRlZCk7XG4gICAgICBmb3J3YXJkUHJveHkuc2V0SWRBbmRSZWxhdGVkKHNlbGYub2JqZWN0KTtcbiAgICB9KTtcbiAgfSxcbiAgd3JhcEFycmF5OiBmdW5jdGlvbihhcnIpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyhhcnIsIHRoaXMucmV2ZXJzZU5hbWUsIHRoaXMub2JqZWN0KTtcbiAgICBpZiAoIWFyci5hcnJheU9ic2VydmVyKSB7XG4gICAgICBhcnIuYXJyYXlPYnNlcnZlciA9IG5ldyBBcnJheU9ic2VydmVyKGFycik7XG4gICAgICB2YXIgb2JzZXJ2ZXJGdW5jdGlvbiA9IGZ1bmN0aW9uKHNwbGljZXMpIHtcbiAgICAgICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uKHNwbGljZSkge1xuICAgICAgICAgIHZhciBhZGRlZCA9IHNwbGljZS5hZGRlZENvdW50ID8gYXJyLnNsaWNlKHNwbGljZS5pbmRleCwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQpIDogW107XG4gICAgICAgICAgdmFyIHJlbW92ZWQgPSBzcGxpY2UucmVtb3ZlZDtcbiAgICAgICAgICBzZWxmLmNsZWFyUmV2ZXJzZShyZW1vdmVkKTtcbiAgICAgICAgICBzZWxmLnNldFJldmVyc2VPZkFkZGVkKGFkZGVkKTtcbiAgICAgICAgICB2YXIgbW9kZWwgPSBzZWxmLmdldEZvcndhcmRNb2RlbCgpO1xuICAgICAgICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgICAgICAgY29sbGVjdGlvbjogbW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICBtb2RlbDogbW9kZWwubmFtZSxcbiAgICAgICAgICAgIGxvY2FsSWQ6IHNlbGYub2JqZWN0LmxvY2FsSWQsXG4gICAgICAgICAgICBmaWVsZDogc2VsZi5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgICAgICAgcmVtb3ZlZDogcmVtb3ZlZCxcbiAgICAgICAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgIGluZGV4OiBzcGxpY2UuaW5kZXgsXG4gICAgICAgICAgICBvYmo6IHNlbGYub2JqZWN0XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfTtcbiAgICAgIGFyci5hcnJheU9ic2VydmVyLm9wZW4ob2JzZXJ2ZXJGdW5jdGlvbik7XG4gICAgfVxuICB9LFxuICBnZXQ6IGZ1bmN0aW9uKGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIGNiKG51bGwsIHRoaXMucmVsYXRlZCk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgLyoqXG4gICAqIFZhbGlkYXRlIHRoZSBvYmplY3QgdGhhdCB3ZSdyZSBzZXR0aW5nXG4gICAqIEBwYXJhbSBvYmpcbiAgICogQHJldHVybnMge3N0cmluZ3xudWxsfSBBbiBlcnJvciBtZXNzYWdlIG9yIG51bGxcbiAgICogQGNsYXNzIE9uZVRvTWFueVByb3h5XG4gICAqL1xuICB2YWxpZGF0ZTogZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIHN0ciA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopO1xuICAgIGlmICh0aGlzLmlzRm9yd2FyZCkge1xuICAgICAgaWYgKHN0ciA9PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICAgIHJldHVybiAnQ2Fubm90IGFzc2lnbiBhcnJheSBmb3J3YXJkIG9uZVRvTWFueSAoJyArIHN0ciArICcpOiAnICsgdGhpcy5mb3J3YXJkTmFtZTtcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBpZiAoc3RyICE9ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICAgICAgcmV0dXJuICdDYW5ub3Qgc2NhbGFyIHRvIHJldmVyc2Ugb25lVG9NYW55ICgnICsgc3RyICsgJyk6ICcgKyB0aGlzLnJldmVyc2VOYW1lO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcbiAgc2V0OiBmdW5jdGlvbihvYmosIG9wdHMpIHtcbiAgICB0aGlzLmNoZWNrSW5zdGFsbGVkKCk7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChvYmopIHtcbiAgICAgIHZhciBlcnJvck1lc3NhZ2U7XG4gICAgICBpZiAoZXJyb3JNZXNzYWdlID0gdGhpcy52YWxpZGF0ZShvYmopKSB7XG4gICAgICAgIHJldHVybiBlcnJvck1lc3NhZ2U7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgICBzZWxmLnNldElkQW5kUmVsYXRlZChvYmosIG9wdHMpO1xuICAgICAgICBpZiAoc2VsZi5pc1JldmVyc2UpIHtcbiAgICAgICAgICB0aGlzLndyYXBBcnJheShzZWxmLnJlbGF0ZWQpO1xuICAgICAgICB9XG4gICAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkUmV2ZXJzZShvYmosIG9wdHMpO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHRoaXMuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkKG9iaiwgb3B0cyk7XG4gICAgfVxuICB9LFxuICBpbnN0YWxsOiBmdW5jdGlvbihvYmopIHtcbiAgICBSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUuaW5zdGFsbC5jYWxsKHRoaXMsIG9iaik7XG5cbiAgICBpZiAodGhpcy5pc1JldmVyc2UpIHtcbiAgICAgIG9ialsoJ3NwbGljZScgKyB1dGlsLmNhcGl0YWxpc2VGaXJzdExldHRlcih0aGlzLnJldmVyc2VOYW1lKSldID0gdGhpcy5zcGxpY2UuYmluZCh0aGlzKTtcbiAgICAgIHRoaXMud3JhcEFycmF5KHRoaXMucmVsYXRlZCk7XG4gICAgfVxuXG4gIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE9uZVRvTWFueVByb3h5O1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL09uZVRvTWFueVByb3h5LmpzXG4gKiogbW9kdWxlIGlkID0gMTJcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIi8qKlxuICogQmFzZSBmdW5jdGlvbmFsaXR5IGZvciByZWxhdGlvbnNoaXBzLlxuICogQG1vZHVsZSByZWxhdGlvbnNoaXBzXG4gKi9cbnZhciBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgUXVlcnkgPSByZXF1aXJlKCcuL1F1ZXJ5JyksXG4gIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyksXG4gIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpLFxuICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzID0gZXZlbnRzLndyYXBBcnJheSxcbiAgQXJyYXlPYnNlcnZlciA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuQXJyYXlPYnNlcnZlcixcbiAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gIE1vZGVsRXZlbnRUeXBlID0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGU7XG5cbi8qKlxuICogQGNsYXNzICBbUmVsYXRpb25zaGlwUHJveHkgZGVzY3JpcHRpb25dXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIFJlbGF0aW9uc2hpcFByb3h5KG9wdHMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBvcHRzID0gb3B0cyB8fCB7fTtcblxuICB1dGlsLmV4dGVuZCh0aGlzLCB7XG4gICAgb2JqZWN0OiBudWxsLFxuICAgIHJlbGF0ZWQ6IG51bGxcbiAgfSk7XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXModGhpcywge1xuICAgIGlzRm9yd2FyZDoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuICFzZWxmLmlzUmV2ZXJzZTtcbiAgICAgIH0sXG4gICAgICBzZXQ6IGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgc2VsZi5pc1JldmVyc2UgPSAhdjtcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfVxuICB9KTtcblxuICB1dGlsLmV4dGVuZEZyb21PcHRzKHRoaXMsIG9wdHMsIHtcbiAgICByZXZlcnNlTW9kZWw6IG51bGwsXG4gICAgZm9yd2FyZE1vZGVsOiBudWxsLFxuICAgIGZvcndhcmROYW1lOiBudWxsLFxuICAgIHJldmVyc2VOYW1lOiBudWxsLFxuICAgIGlzUmV2ZXJzZTogbnVsbCxcbiAgICBzZXJpYWxpc2U6IG51bGxcbiAgfSwgZmFsc2UpO1xuXG4gIHRoaXMuY2FuY2VsTGlzdGVucyA9IHt9O1xufVxuXG51dGlsLmV4dGVuZChSZWxhdGlvbnNoaXBQcm94eSwge30pO1xuXG51dGlsLmV4dGVuZChSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUsIHtcbiAgLyoqXG4gICAqIEluc3RhbGwgdGhpcyBwcm94eSBvbiB0aGUgZ2l2ZW4gaW5zdGFuY2VcbiAgICogQHBhcmFtIHtNb2RlbEluc3RhbmNlfSBtb2RlbEluc3RhbmNlXG4gICAqL1xuICBpbnN0YWxsOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlKSB7XG4gICAgaWYgKG1vZGVsSW5zdGFuY2UpIHtcbiAgICAgIGlmICghdGhpcy5vYmplY3QpIHtcbiAgICAgICAgdGhpcy5vYmplY3QgPSBtb2RlbEluc3RhbmNlO1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHZhciBuYW1lID0gdGhpcy5nZXRGb3J3YXJkTmFtZSgpO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobW9kZWxJbnN0YW5jZSwgbmFtZSwge1xuICAgICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gc2VsZi5yZWxhdGVkO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgc2V0OiBmdW5jdGlvbih2KSB7XG4gICAgICAgICAgICBzZWxmLnNldCh2KTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoIW1vZGVsSW5zdGFuY2UuX19wcm94aWVzKSBtb2RlbEluc3RhbmNlLl9fcHJveGllcyA9IHt9O1xuICAgICAgICBtb2RlbEluc3RhbmNlLl9fcHJveGllc1tuYW1lXSA9IHRoaXM7XG4gICAgICAgIGlmICghbW9kZWxJbnN0YW5jZS5fcHJveGllcykge1xuICAgICAgICAgIG1vZGVsSW5zdGFuY2UuX3Byb3hpZXMgPSBbXTtcbiAgICAgICAgfVxuICAgICAgICBtb2RlbEluc3RhbmNlLl9wcm94aWVzLnB1c2godGhpcyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignQWxyZWFkeSBpbnN0YWxsZWQuJyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdObyBvYmplY3QgcGFzc2VkIHRvIHJlbGF0aW9uc2hpcCBpbnN0YWxsJyk7XG4gICAgfVxuICB9XG5cbn0pO1xuXG4vL25vaW5zcGVjdGlvbiBKU1VudXNlZExvY2FsU3ltYm9sc1xudXRpbC5leHRlbmQoUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlLCB7XG4gIHNldDogZnVuY3Rpb24ob2JqLCBvcHRzKSB7XG4gICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3Qgc3ViY2xhc3MgUmVsYXRpb25zaGlwUHJveHknKTtcbiAgfSxcbiAgZ2V0OiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHN1YmNsYXNzIFJlbGF0aW9uc2hpcFByb3h5Jyk7XG4gIH1cbn0pO1xuXG51dGlsLmV4dGVuZChSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUsIHtcbiAgcHJveHlGb3JJbnN0YW5jZTogZnVuY3Rpb24obW9kZWxJbnN0YW5jZSwgcmV2ZXJzZSkge1xuICAgIHZhciBuYW1lID0gcmV2ZXJzZSA/IHRoaXMuZ2V0UmV2ZXJzZU5hbWUoKSA6IHRoaXMuZ2V0Rm9yd2FyZE5hbWUoKSxcbiAgICAgIG1vZGVsID0gcmV2ZXJzZSA/IHRoaXMucmV2ZXJzZU1vZGVsIDogdGhpcy5mb3J3YXJkTW9kZWw7XG4gICAgdmFyIHJldDtcbiAgICAvLyBUaGlzIHNob3VsZCBuZXZlciBoYXBwZW4uIFNob3VsZCBnICAgZXQgY2F1Z2h0IGluIHRoZSBtYXBwaW5nIG9wZXJhdGlvbj9cbiAgICBpZiAodXRpbC5pc0FycmF5KG1vZGVsSW5zdGFuY2UpKSB7XG4gICAgICByZXQgPSBtb2RlbEluc3RhbmNlLm1hcChmdW5jdGlvbihvKSB7XG4gICAgICAgIHJldHVybiBvLl9fcHJveGllc1tuYW1lXTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgcHJveGllcyA9IG1vZGVsSW5zdGFuY2UuX19wcm94aWVzO1xuICAgICAgdmFyIHByb3h5ID0gcHJveGllc1tuYW1lXTtcbiAgICAgIGlmICghcHJveHkpIHtcbiAgICAgICAgdmFyIGVyciA9ICdObyBwcm94eSB3aXRoIG5hbWUgXCInICsgbmFtZSArICdcIiBvbiBtYXBwaW5nICcgKyBtb2RlbC5uYW1lO1xuICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihlcnIpO1xuICAgICAgfVxuICAgICAgcmV0ID0gcHJveHk7XG4gICAgfVxuICAgIHJldHVybiByZXQ7XG4gIH0sXG4gIHJldmVyc2VQcm94eUZvckluc3RhbmNlOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlKSB7XG4gICAgcmV0dXJuIHRoaXMucHJveHlGb3JJbnN0YW5jZShtb2RlbEluc3RhbmNlLCB0cnVlKTtcbiAgfSxcbiAgZ2V0UmV2ZXJzZU5hbWU6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmlzRm9yd2FyZCA/IHRoaXMucmV2ZXJzZU5hbWUgOiB0aGlzLmZvcndhcmROYW1lO1xuICB9LFxuICBnZXRGb3J3YXJkTmFtZTogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuaXNGb3J3YXJkID8gdGhpcy5mb3J3YXJkTmFtZSA6IHRoaXMucmV2ZXJzZU5hbWU7XG4gIH0sXG4gIGdldEZvcndhcmRNb2RlbDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuaXNGb3J3YXJkID8gdGhpcy5mb3J3YXJkTW9kZWwgOiB0aGlzLnJldmVyc2VNb2RlbDtcbiAgfSxcbiAgLyoqXG4gICAqIENvbmZpZ3VyZSBfaWQgYW5kIHJlbGF0ZWQgd2l0aCB0aGUgbmV3IHJlbGF0ZWQgb2JqZWN0LlxuICAgKiBAcGFyYW0gb2JqXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0c11cbiAgICogQHBhcmFtIHtib29sZWFufSBbb3B0cy5kaXNhYmxlTm90aWZpY2F0aW9uc11cbiAgICogQHJldHVybnMge1N0cmluZ3x1bmRlZmluZWR9IC0gRXJyb3IgbWVzc2FnZSBvciB1bmRlZmluZWRcbiAgICovXG4gIHNldElkQW5kUmVsYXRlZDogZnVuY3Rpb24ob2JqLCBvcHRzKSB7XG4gICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgaWYgKCFvcHRzLmRpc2FibGVldmVudHMpIHZhciBvbGRWYWx1ZSA9IHRoaXMuX2dldE9sZFZhbHVlRm9yU2V0Q2hhbmdlRXZlbnQoKTtcbiAgICBpZiAob2JqKSB7XG4gICAgICBpZiAodXRpbC5pc0FycmF5KG9iaikpIHtcbiAgICAgICAgdGhpcy5yZWxhdGVkID0gb2JqO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5yZWxhdGVkID0gb2JqO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHRoaXMucmVsYXRlZCA9IG51bGw7XG4gICAgfVxuICAgIGlmICghb3B0cy5kaXNhYmxlZXZlbnRzKSB0aGlzLnJlZ2lzdGVyU2V0Q2hhbmdlKG9iaiwgb2xkVmFsdWUpO1xuICB9LFxuICBjaGVja0luc3RhbGxlZDogZnVuY3Rpb24oKSB7XG4gICAgaWYgKCF0aGlzLm9iamVjdCkge1xuICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ1Byb3h5IG11c3QgYmUgaW5zdGFsbGVkIG9uIGFuIG9iamVjdCBiZWZvcmUgY2FuIHVzZSBpdC4nKTtcbiAgICB9XG4gIH0sXG4gIHNwbGljZXI6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICByZXR1cm4gZnVuY3Rpb24oaWR4LCBudW1SZW1vdmUpIHtcbiAgICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgICAgaWYgKCFvcHRzLmRpc2FibGVldmVudHMpIHtcbiAgICAgICAgdmFyIGFkZGVkID0gdGhpcy5fZ2V0QWRkZWRGb3JTcGxpY2VDaGFuZ2VFdmVudChhcmd1bWVudHMpLFxuICAgICAgICAgIHJlbW92ZWQgPSB0aGlzLl9nZXRSZW1vdmVkRm9yU3BsaWNlQ2hhbmdlRXZlbnQoaWR4LCBudW1SZW1vdmUpO1xuICAgICAgfVxuICAgICAgdmFyIGFkZCA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgICB2YXIgcmVzID0gdGhpcy5yZWxhdGVkLnNwbGljZS5iaW5kKHRoaXMucmVsYXRlZCwgaWR4LCBudW1SZW1vdmUpLmFwcGx5KHRoaXMucmVsYXRlZCwgYWRkKTtcbiAgICAgIGlmICghb3B0cy5kaXNhYmxlZXZlbnRzKSB0aGlzLnJlZ2lzdGVyU3BsaWNlQ2hhbmdlKGlkeCwgYWRkZWQsIHJlbW92ZWQpO1xuICAgICAgcmV0dXJuIHJlcztcbiAgICB9LmJpbmQodGhpcyk7XG4gIH0sXG4gIGNsZWFyUmV2ZXJzZVJlbGF0ZWQ6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHRoaXMucmVsYXRlZCkge1xuICAgICAgdmFyIHJldmVyc2VQcm94eSA9IHRoaXMucmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2UodGhpcy5yZWxhdGVkKTtcbiAgICAgIHZhciByZXZlcnNlUHJveGllcyA9IHV0aWwuaXNBcnJheShyZXZlcnNlUHJveHkpID8gcmV2ZXJzZVByb3h5IDogW3JldmVyc2VQcm94eV07XG4gICAgICByZXZlcnNlUHJveGllcy5mb3JFYWNoKGZ1bmN0aW9uKHApIHtcbiAgICAgICAgaWYgKHV0aWwuaXNBcnJheShwLnJlbGF0ZWQpKSB7XG4gICAgICAgICAgdmFyIGlkeCA9IHAucmVsYXRlZC5pbmRleE9mKHNlbGYub2JqZWN0KTtcbiAgICAgICAgICBwLm1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9ucyhmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHAuc3BsaWNlcihvcHRzKShpZHgsIDEpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHAuc2V0SWRBbmRSZWxhdGVkKG51bGwsIG9wdHMpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG4gIHNldElkQW5kUmVsYXRlZFJldmVyc2U6IGZ1bmN0aW9uKG9iaiwgb3B0cykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgcmV2ZXJzZVByb3h5ID0gdGhpcy5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZShvYmopO1xuICAgIHZhciByZXZlcnNlUHJveGllcyA9IHV0aWwuaXNBcnJheShyZXZlcnNlUHJveHkpID8gcmV2ZXJzZVByb3h5IDogW3JldmVyc2VQcm94eV07XG4gICAgcmV2ZXJzZVByb3hpZXMuZm9yRWFjaChmdW5jdGlvbihwKSB7XG4gICAgICBpZiAodXRpbC5pc0FycmF5KHAucmVsYXRlZCkpIHtcbiAgICAgICAgcC5tYWtlQ2hhbmdlc1RvUmVsYXRlZFdpdGhvdXRPYnNlcnZhdGlvbnMoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcC5zcGxpY2VyKG9wdHMpKHAucmVsYXRlZC5sZW5ndGgsIDAsIHNlbGYub2JqZWN0KTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICAgIHAuc2V0SWRBbmRSZWxhdGVkKHNlbGYub2JqZWN0LCBvcHRzKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcbiAgbWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zOiBmdW5jdGlvbihmKSB7XG4gICAgaWYgKHRoaXMucmVsYXRlZCkge1xuICAgICAgdGhpcy5yZWxhdGVkLmFycmF5T2JzZXJ2ZXIuY2xvc2UoKTtcbiAgICAgIHRoaXMucmVsYXRlZC5hcnJheU9ic2VydmVyID0gbnVsbDtcbiAgICAgIGYoKTtcbiAgICAgIHRoaXMud3JhcEFycmF5KHRoaXMucmVsYXRlZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGYoKTtcbiAgICB9XG4gIH0sXG4gIC8qKlxuICAgKiBHZXQgb2xkIHZhbHVlIHRoYXQgaXMgc2VudCBvdXQgaW4gZW1pc3Npb25zLlxuICAgKiBAcmV0dXJucyB7Kn1cbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9nZXRPbGRWYWx1ZUZvclNldENoYW5nZUV2ZW50OiBmdW5jdGlvbigpIHtcbiAgICB2YXIgb2xkVmFsdWUgPSB0aGlzLnJlbGF0ZWQ7XG4gICAgaWYgKHV0aWwuaXNBcnJheShvbGRWYWx1ZSkgJiYgIW9sZFZhbHVlLmxlbmd0aCkge1xuICAgICAgb2xkVmFsdWUgPSBudWxsO1xuICAgIH1cbiAgICByZXR1cm4gb2xkVmFsdWU7XG4gIH0sXG4gIHJlZ2lzdGVyU2V0Q2hhbmdlOiBmdW5jdGlvbihuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICB2YXIgcHJveHlPYmplY3QgPSB0aGlzLm9iamVjdDtcbiAgICBpZiAoIXByb3h5T2JqZWN0KSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignUHJveHkgbXVzdCBoYXZlIGFuIG9iamVjdCBhc3NvY2lhdGVkJyk7XG4gICAgdmFyIG1vZGVsID0gcHJveHlPYmplY3QubW9kZWwubmFtZTtcbiAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBwcm94eU9iamVjdC5jb2xsZWN0aW9uTmFtZTtcbiAgICAvLyBXZSB0YWtlIFtdID09IG51bGwgPT0gdW5kZWZpbmVkIGluIHRoZSBjYXNlIG9mIHJlbGF0aW9uc2hpcHMuXG4gICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uTmFtZSxcbiAgICAgIG1vZGVsOiBtb2RlbCxcbiAgICAgIGxvY2FsSWQ6IHByb3h5T2JqZWN0LmxvY2FsSWQsXG4gICAgICBmaWVsZDogdGhpcy5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgb2xkOiBvbGRWYWx1ZSxcbiAgICAgIG5ldzogbmV3VmFsdWUsXG4gICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TZXQsXG4gICAgICBvYmo6IHByb3h5T2JqZWN0XG4gICAgfSk7XG4gIH0sXG5cbiAgX2dldFJlbW92ZWRGb3JTcGxpY2VDaGFuZ2VFdmVudDogZnVuY3Rpb24oaWR4LCBudW1SZW1vdmUpIHtcbiAgICB2YXIgcmVtb3ZlZCA9IHRoaXMucmVsYXRlZCA/IHRoaXMucmVsYXRlZC5zbGljZShpZHgsIGlkeCArIG51bVJlbW92ZSkgOiBudWxsO1xuICAgIHJldHVybiByZW1vdmVkO1xuICB9LFxuXG4gIF9nZXRBZGRlZEZvclNwbGljZUNoYW5nZUV2ZW50OiBmdW5jdGlvbihhcmdzKSB7XG4gICAgdmFyIGFkZCA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3MsIDIpLFxuICAgICAgYWRkZWQgPSBhZGQubGVuZ3RoID8gYWRkIDogW107XG4gICAgcmV0dXJuIGFkZGVkO1xuICB9LFxuXG4gIHJlZ2lzdGVyU3BsaWNlQ2hhbmdlOiBmdW5jdGlvbihpZHgsIGFkZGVkLCByZW1vdmVkKSB7XG4gICAgdmFyIG1vZGVsID0gdGhpcy5vYmplY3QubW9kZWwubmFtZSxcbiAgICAgIGNvbGwgPSB0aGlzLm9iamVjdC5jb2xsZWN0aW9uTmFtZTtcbiAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgIGNvbGxlY3Rpb246IGNvbGwsXG4gICAgICBtb2RlbDogbW9kZWwsXG4gICAgICBsb2NhbElkOiB0aGlzLm9iamVjdC5sb2NhbElkLFxuICAgICAgZmllbGQ6IHRoaXMuZ2V0Rm9yd2FyZE5hbWUoKSxcbiAgICAgIGluZGV4OiBpZHgsXG4gICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgYWRkZWQ6IGFkZGVkLFxuICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgb2JqOiB0aGlzLm9iamVjdFxuICAgIH0pO1xuICB9LFxuICB3cmFwQXJyYXk6IGZ1bmN0aW9uKGFycikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzKGFyciwgdGhpcy5yZXZlcnNlTmFtZSwgdGhpcy5vYmplY3QpO1xuICAgIGlmICghYXJyLmFycmF5T2JzZXJ2ZXIpIHtcbiAgICAgIGFyci5hcnJheU9ic2VydmVyID0gbmV3IEFycmF5T2JzZXJ2ZXIoYXJyKTtcbiAgICAgIHZhciBvYnNlcnZlckZ1bmN0aW9uID0gZnVuY3Rpb24oc3BsaWNlcykge1xuICAgICAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24oc3BsaWNlKSB7XG4gICAgICAgICAgdmFyIGFkZGVkID0gc3BsaWNlLmFkZGVkQ291bnQgPyBhcnIuc2xpY2Uoc3BsaWNlLmluZGV4LCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkgOiBbXTtcbiAgICAgICAgICB2YXIgbW9kZWwgPSBzZWxmLmdldEZvcndhcmRNb2RlbCgpO1xuICAgICAgICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgICAgICAgY29sbGVjdGlvbjogbW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICBtb2RlbDogbW9kZWwubmFtZSxcbiAgICAgICAgICAgIGxvY2FsSWQ6IHNlbGYub2JqZWN0LmxvY2FsSWQsXG4gICAgICAgICAgICBmaWVsZDogc2VsZi5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgICAgICAgcmVtb3ZlZDogc3BsaWNlLnJlbW92ZWQsXG4gICAgICAgICAgICBhZGRlZDogYWRkZWQsXG4gICAgICAgICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgICAgICBvYmo6IHNlbGYub2JqZWN0XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfTtcbiAgICAgIGFyci5hcnJheU9ic2VydmVyLm9wZW4ob2JzZXJ2ZXJGdW5jdGlvbik7XG4gICAgfVxuICB9LFxuICBzcGxpY2U6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuc3BsaWNlcih7fSkuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgfVxuXG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBSZWxhdGlvbnNoaXBQcm94eTtcblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9SZWxhdGlvbnNoaXBQcm94eS5qc1xuICoqIG1vZHVsZSBpZCA9IDEzXG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdldmVudHMnKSxcbiAgZXh0ZW5kID0gcmVxdWlyZSgnLi91dGlsJykuZXh0ZW5kLFxuICBjb2xsZWN0aW9uUmVnaXN0cnkgPSByZXF1aXJlKCcuL2NvbGxlY3Rpb25SZWdpc3RyeScpLkNvbGxlY3Rpb25SZWdpc3RyeTtcblxuXG4vKipcbiAqIENvbnN0YW50cyB0aGF0IGRlc2NyaWJlIGNoYW5nZSBldmVudHMuXG4gKiBTZXQgPT4gQSBuZXcgdmFsdWUgaXMgYXNzaWduZWQgdG8gYW4gYXR0cmlidXRlL3JlbGF0aW9uc2hpcFxuICogU3BsaWNlID0+IEFsbCBqYXZhc2NyaXB0IGFycmF5IG9wZXJhdGlvbnMgYXJlIGRlc2NyaWJlZCBhcyBzcGxpY2VzLlxuICogRGVsZXRlID0+IFVzZWQgaW4gdGhlIGNhc2Ugd2hlcmUgb2JqZWN0cyBhcmUgcmVtb3ZlZCBmcm9tIGFuIGFycmF5LCBidXQgYXJyYXkgb3JkZXIgaXMgbm90IGtub3duIGluIGFkdmFuY2UuXG4gKiBSZW1vdmUgPT4gT2JqZWN0IGRlbGV0aW9uIGV2ZW50c1xuICogTmV3ID0+IE9iamVjdCBjcmVhdGlvbiBldmVudHNcbiAqIEB0eXBlIHtPYmplY3R9XG4gKi9cbnZhciBNb2RlbEV2ZW50VHlwZSA9IHtcbiAgU2V0OiAnc2V0JyxcbiAgU3BsaWNlOiAnc3BsaWNlJyxcbiAgTmV3OiAnbmV3JyxcbiAgUmVtb3ZlOiAncmVtb3ZlJ1xufTtcblxuLyoqXG4gKiBSZXByZXNlbnRzIGFuIGluZGl2aWR1YWwgY2hhbmdlLlxuICogQHBhcmFtIG9wdHNcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBNb2RlbEV2ZW50KG9wdHMpIHtcbiAgdGhpcy5fb3B0cyA9IG9wdHMgfHwge307XG4gIE9iamVjdC5rZXlzKG9wdHMpLmZvckVhY2goZnVuY3Rpb24oaykge1xuICAgIHRoaXNba10gPSBvcHRzW2tdO1xuICB9LmJpbmQodGhpcykpO1xufVxuXG5Nb2RlbEV2ZW50LnByb3RvdHlwZS5fZHVtcCA9IGZ1bmN0aW9uKHByZXR0eSkge1xuICB2YXIgZHVtcGVkID0ge307XG4gIGR1bXBlZC5jb2xsZWN0aW9uID0gKHR5cGVvZiB0aGlzLmNvbGxlY3Rpb24pID09ICdzdHJpbmcnID8gdGhpcy5jb2xsZWN0aW9uIDogdGhpcy5jb2xsZWN0aW9uLl9kdW1wKCk7XG4gIGR1bXBlZC5tb2RlbCA9ICh0eXBlb2YgdGhpcy5tb2RlbCkgPT0gJ3N0cmluZycgPyB0aGlzLm1vZGVsIDogdGhpcy5tb2RlbC5uYW1lO1xuICBkdW1wZWQubG9jYWxJZCA9IHRoaXMubG9jYWxJZDtcbiAgZHVtcGVkLmZpZWxkID0gdGhpcy5maWVsZDtcbiAgZHVtcGVkLnR5cGUgPSB0aGlzLnR5cGU7XG4gIGlmICh0aGlzLmluZGV4KSBkdW1wZWQuaW5kZXggPSB0aGlzLmluZGV4O1xuICBpZiAodGhpcy5hZGRlZCkgZHVtcGVkLmFkZGVkID0gdGhpcy5hZGRlZC5tYXAoZnVuY3Rpb24oeCkge3JldHVybiB4Ll9kdW1wKCl9KTtcbiAgaWYgKHRoaXMucmVtb3ZlZCkgZHVtcGVkLnJlbW92ZWQgPSB0aGlzLnJlbW92ZWQubWFwKGZ1bmN0aW9uKHgpIHtyZXR1cm4geC5fZHVtcCgpfSk7XG4gIGlmICh0aGlzLm9sZCkgZHVtcGVkLm9sZCA9IHRoaXMub2xkO1xuICBpZiAodGhpcy5uZXcpIGR1bXBlZC5uZXcgPSB0aGlzLm5ldztcbiAgcmV0dXJuIHByZXR0eSA/IHV0aWwucHJldHR5UHJpbnQoZHVtcGVkKSA6IGR1bXBlZDtcbn07XG5cbmZ1bmN0aW9uIGJyb2FkY2FzdEV2ZW50KGNvbGxlY3Rpb25OYW1lLCBtb2RlbE5hbWUsIG9wdHMpIHtcbiAgdmFyIGdlbmVyaWNFdmVudCA9ICdTaWVzdGEnLFxuICAgIGNvbGxlY3Rpb24gPSBjb2xsZWN0aW9uUmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdLFxuICAgIG1vZGVsID0gY29sbGVjdGlvblttb2RlbE5hbWVdO1xuICBpZiAoIWNvbGxlY3Rpb24pIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdObyBzdWNoIGNvbGxlY3Rpb24gXCInICsgY29sbGVjdGlvbk5hbWUgKyAnXCInKTtcbiAgaWYgKCFtb2RlbCkgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ05vIHN1Y2ggbW9kZWwgXCInICsgbW9kZWxOYW1lICsgJ1wiJyk7XG4gIHZhciBzaG91bGRFbWl0ID0gb3B0cy5vYmouX2VtaXRFdmVudHM7XG4gIC8vIERvbid0IGVtaXQgcG9pbnRsZXNzIGV2ZW50cy5cbiAgaWYgKHNob3VsZEVtaXQgJiYgJ25ldycgaW4gb3B0cyAmJiAnb2xkJyBpbiBvcHRzKSB7XG4gICAgaWYgKG9wdHMubmV3IGluc3RhbmNlb2YgRGF0ZSAmJiBvcHRzLm9sZCBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgIHNob3VsZEVtaXQgPSBvcHRzLm5ldy5nZXRUaW1lKCkgIT0gb3B0cy5vbGQuZ2V0VGltZSgpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHNob3VsZEVtaXQgPSBvcHRzLm5ldyAhPSBvcHRzLm9sZDtcbiAgICB9XG4gIH1cbiAgaWYgKHNob3VsZEVtaXQpIHtcbiAgICBldmVudHMuZW1pdChnZW5lcmljRXZlbnQsIG9wdHMpO1xuICAgIGlmIChzaWVzdGEuaW5zdGFsbGVkKSB7XG4gICAgICB2YXIgbW9kZWxFdmVudCA9IGNvbGxlY3Rpb25OYW1lICsgJzonICsgbW9kZWxOYW1lLFxuICAgICAgICBsb2NhbElkRXZlbnQgPSBvcHRzLmxvY2FsSWQ7XG4gICAgICBldmVudHMuZW1pdChjb2xsZWN0aW9uTmFtZSwgb3B0cyk7XG4gICAgICBldmVudHMuZW1pdChtb2RlbEV2ZW50LCBvcHRzKTtcbiAgICAgIGV2ZW50cy5lbWl0KGxvY2FsSWRFdmVudCwgb3B0cyk7XG4gICAgfVxuICAgIGlmIChtb2RlbC5pZCAmJiBvcHRzLm9ialttb2RlbC5pZF0pIGV2ZW50cy5lbWl0KGNvbGxlY3Rpb25OYW1lICsgJzonICsgbW9kZWxOYW1lICsgJzonICsgb3B0cy5vYmpbbW9kZWwuaWRdLCBvcHRzKTtcbiAgfVxufVxuXG5mdW5jdGlvbiB2YWxpZGF0ZUV2ZW50T3B0cyhvcHRzKSB7XG4gIGlmICghb3B0cy5tb2RlbCkgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3QgcGFzcyBhIG1vZGVsJyk7XG4gIGlmICghb3B0cy5jb2xsZWN0aW9uKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBwYXNzIGEgY29sbGVjdGlvbicpO1xuICBpZiAoIW9wdHMubG9jYWxJZCkgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3QgcGFzcyBhIGxvY2FsIGlkZW50aWZpZXInKTtcbiAgaWYgKCFvcHRzLm9iaikgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3QgcGFzcyB0aGUgb2JqZWN0Jyk7XG59XG5cbmZ1bmN0aW9uIGVtaXQob3B0cykge1xuICB2YWxpZGF0ZUV2ZW50T3B0cyhvcHRzKTtcbiAgdmFyIGNvbGxlY3Rpb24gPSBvcHRzLmNvbGxlY3Rpb247XG4gIHZhciBtb2RlbCA9IG9wdHMubW9kZWw7XG4gIHZhciBjID0gbmV3IE1vZGVsRXZlbnQob3B0cyk7XG4gIGJyb2FkY2FzdEV2ZW50KGNvbGxlY3Rpb24sIG1vZGVsLCBjKTtcbiAgcmV0dXJuIGM7XG59XG5cbmV4dGVuZChleHBvcnRzLCB7XG4gIE1vZGVsRXZlbnQ6IE1vZGVsRXZlbnQsXG4gIGVtaXQ6IGVtaXQsXG4gIHZhbGlkYXRlRXZlbnRPcHRzOiB2YWxpZGF0ZUV2ZW50T3B0cyxcbiAgTW9kZWxFdmVudFR5cGU6IE1vZGVsRXZlbnRUeXBlXG59KTtcblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9tb2RlbEV2ZW50cy5qc1xuICoqIG1vZHVsZSBpZCA9IDE0XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSgncXVlcnknKSxcbiAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyksXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgZXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJyksXG4gIE1vZGVsSW5zdGFuY2UgPSByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKSxcbiAgY29uc3RydWN0UXVlcnlTZXQgPSByZXF1aXJlKCcuL1F1ZXJ5U2V0Jyk7XG5cbi8qKlxuICogQGNsYXNzIFtRdWVyeSBkZXNjcmlwdGlvbl1cbiAqIEBwYXJhbSB7TW9kZWx9IG1vZGVsXG4gKiBAcGFyYW0ge09iamVjdH0gcXVlcnlcbiAqL1xuZnVuY3Rpb24gUXVlcnkobW9kZWwsIHF1ZXJ5KSB7XG4gIHZhciBvcHRzID0ge307XG4gIGZvciAodmFyIHByb3AgaW4gcXVlcnkpIHtcbiAgICBpZiAocXVlcnkuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgIGlmIChwcm9wLnNsaWNlKDAsIDIpID09ICdfXycpIHtcbiAgICAgICAgb3B0c1twcm9wLnNsaWNlKDIpXSA9IHF1ZXJ5W3Byb3BdO1xuICAgICAgICBkZWxldGUgcXVlcnlbcHJvcF07XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHV0aWwuZXh0ZW5kKHRoaXMsIHtcbiAgICBtb2RlbDogbW9kZWwsXG4gICAgcXVlcnk6IHF1ZXJ5LFxuICAgIG9wdHM6IG9wdHNcbiAgfSk7XG4gIG9wdHMub3JkZXIgPSBvcHRzLm9yZGVyIHx8IFtdO1xuICBpZiAoIXV0aWwuaXNBcnJheShvcHRzLm9yZGVyKSkgb3B0cy5vcmRlciA9IFtvcHRzLm9yZGVyXTtcbn1cblxuZnVuY3Rpb24gdmFsdWVBc1N0cmluZyhmaWVsZFZhbHVlKSB7XG4gIHZhciBmaWVsZEFzU3RyaW5nO1xuICBpZiAoZmllbGRWYWx1ZSA9PT0gbnVsbCkgZmllbGRBc1N0cmluZyA9ICdudWxsJztcbiAgZWxzZSBpZiAoZmllbGRWYWx1ZSA9PT0gdW5kZWZpbmVkKSBmaWVsZEFzU3RyaW5nID0gJ3VuZGVmaW5lZCc7XG4gIGVsc2UgaWYgKGZpZWxkVmFsdWUgaW5zdGFuY2VvZiBNb2RlbEluc3RhbmNlKSBmaWVsZEFzU3RyaW5nID0gZmllbGRWYWx1ZS5sb2NhbElkO1xuICBlbHNlIGZpZWxkQXNTdHJpbmcgPSBmaWVsZFZhbHVlLnRvU3RyaW5nKCk7XG4gIHJldHVybiBmaWVsZEFzU3RyaW5nO1xufVxuXG5mdW5jdGlvbiBjb250YWlucyhvcHRzKSB7XG4gIGlmICghb3B0cy5pbnZhbGlkKSB7XG4gICAgdmFyIG9iaiA9IG9wdHMub2JqZWN0O1xuICAgIGlmICh1dGlsLmlzQXJyYXkob2JqKSkge1xuICAgICAgYXJyID0gdXRpbC5wbHVjayhvYmosIG9wdHMuZmllbGQpO1xuICAgIH1cbiAgICBlbHNlXG4gICAgICB2YXIgYXJyID0gb2JqW29wdHMuZmllbGRdO1xuICAgIGlmICh1dGlsLmlzQXJyYXkoYXJyKSB8fCB1dGlsLmlzU3RyaW5nKGFycikpIHtcbiAgICAgIHJldHVybiBhcnIuaW5kZXhPZihvcHRzLnZhbHVlKSA+IC0xO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbnZhciBjb21wYXJhdG9ycyA9IHtcbiAgZTogZnVuY3Rpb24ob3B0cykge1xuICAgIHZhciBmaWVsZFZhbHVlID0gb3B0cy5vYmplY3Rbb3B0cy5maWVsZF07XG4gICAgaWYgKGxvZy5lbmFibGVkKSB7XG4gICAgICBsb2cob3B0cy5maWVsZCArICc6ICcgKyB2YWx1ZUFzU3RyaW5nKGZpZWxkVmFsdWUpICsgJyA9PSAnICsgdmFsdWVBc1N0cmluZyhvcHRzLnZhbHVlKSwge29wdHM6IG9wdHN9KTtcbiAgICB9XG4gICAgcmV0dXJuIGZpZWxkVmFsdWUgPT0gb3B0cy52YWx1ZTtcbiAgfSxcbiAgbHQ6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICBpZiAoIW9wdHMuaW52YWxpZCkgcmV0dXJuIG9wdHMub2JqZWN0W29wdHMuZmllbGRdIDwgb3B0cy52YWx1ZTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0sXG4gIGd0OiBmdW5jdGlvbihvcHRzKSB7XG4gICAgaWYgKCFvcHRzLmludmFsaWQpIHJldHVybiBvcHRzLm9iamVjdFtvcHRzLmZpZWxkXSA+IG9wdHMudmFsdWU7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9LFxuICBsdGU6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICBpZiAoIW9wdHMuaW52YWxpZCkgcmV0dXJuIG9wdHMub2JqZWN0W29wdHMuZmllbGRdIDw9IG9wdHMudmFsdWU7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9LFxuICBndGU6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICBpZiAoIW9wdHMuaW52YWxpZCkgcmV0dXJuIG9wdHMub2JqZWN0W29wdHMuZmllbGRdID49IG9wdHMudmFsdWU7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9LFxuICBjb250YWluczogY29udGFpbnMsXG4gIGluOiBjb250YWluc1xufTtcblxudXRpbC5leHRlbmQoUXVlcnksIHtcbiAgY29tcGFyYXRvcnM6IGNvbXBhcmF0b3JzLFxuICByZWdpc3RlckNvbXBhcmF0b3I6IGZ1bmN0aW9uKHN5bWJvbCwgZm4pIHtcbiAgICBpZiAoIWNvbXBhcmF0b3JzW3N5bWJvbF0pIHtcbiAgICAgIGNvbXBhcmF0b3JzW3N5bWJvbF0gPSBmbjtcbiAgICB9XG4gIH1cbn0pO1xuXG5mdW5jdGlvbiBjYWNoZUZvck1vZGVsKG1vZGVsKSB7XG4gIHZhciBjYWNoZUJ5VHlwZSA9IGNhY2hlLl9sb2NhbENhY2hlQnlUeXBlO1xuICB2YXIgbW9kZWxOYW1lID0gbW9kZWwubmFtZTtcbiAgdmFyIGNvbGxlY3Rpb25OYW1lID0gbW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gIHZhciBjYWNoZUJ5TW9kZWwgPSBjYWNoZUJ5VHlwZVtjb2xsZWN0aW9uTmFtZV07XG4gIHZhciBjYWNoZUJ5TG9jYWxJZDtcbiAgaWYgKGNhY2hlQnlNb2RlbCkge1xuICAgIGNhY2hlQnlMb2NhbElkID0gY2FjaGVCeU1vZGVsW21vZGVsTmFtZV0gfHwge307XG4gIH1cbiAgcmV0dXJuIGNhY2hlQnlMb2NhbElkO1xufVxuXG51dGlsLmV4dGVuZChRdWVyeS5wcm90b3R5cGUsIHtcbiAgZXhlY3V0ZTogZnVuY3Rpb24oY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgdGhpcy5fZXhlY3V0ZUluTWVtb3J5KGNiKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuICBfZHVtcDogZnVuY3Rpb24oYXNKc29uKSB7XG4gICAgcmV0dXJuIGFzSnNvbiA/ICd7fScgOiB7fTtcbiAgfSxcbiAgc29ydEZ1bmM6IGZ1bmN0aW9uKGZpZWxkcykge1xuICAgIHZhciBzb3J0RnVuYyA9IGZ1bmN0aW9uKGFzY2VuZGluZywgZmllbGQpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbih2MSwgdjIpIHtcbiAgICAgICAgdmFyIGQxID0gdjFbZmllbGRdLFxuICAgICAgICAgIGQyID0gdjJbZmllbGRdLFxuICAgICAgICAgIHJlcztcbiAgICAgICAgaWYgKHR5cGVvZiBkMSA9PSAnc3RyaW5nJyB8fCBkMSBpbnN0YW5jZW9mIFN0cmluZyAmJlxuICAgICAgICAgIHR5cGVvZiBkMiA9PSAnc3RyaW5nJyB8fCBkMiBpbnN0YW5jZW9mIFN0cmluZykge1xuICAgICAgICAgIHJlcyA9IGFzY2VuZGluZyA/IGQxLmxvY2FsZUNvbXBhcmUoZDIpIDogZDIubG9jYWxlQ29tcGFyZShkMSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgaWYgKGQxIGluc3RhbmNlb2YgRGF0ZSkgZDEgPSBkMS5nZXRUaW1lKCk7XG4gICAgICAgICAgaWYgKGQyIGluc3RhbmNlb2YgRGF0ZSkgZDIgPSBkMi5nZXRUaW1lKCk7XG4gICAgICAgICAgaWYgKGFzY2VuZGluZykgcmVzID0gZDEgLSBkMjtcbiAgICAgICAgICBlbHNlIHJlcyA9IGQyIC0gZDE7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICAgIH1cbiAgICB9O1xuICAgIHZhciBzID0gdXRpbDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZpZWxkcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGZpZWxkID0gZmllbGRzW2ldO1xuICAgICAgcyA9IHMudGhlbkJ5KHNvcnRGdW5jKGZpZWxkLmFzY2VuZGluZywgZmllbGQuZmllbGQpKTtcbiAgICB9XG4gICAgcmV0dXJuIHMgPT0gdXRpbCA/IG51bGwgOiBzO1xuICB9LFxuICBfc29ydFJlc3VsdHM6IGZ1bmN0aW9uKHJlcykge1xuICAgIHZhciBvcmRlciA9IHRoaXMub3B0cy5vcmRlcjtcbiAgICBpZiAocmVzICYmIG9yZGVyKSB7XG4gICAgICB2YXIgZmllbGRzID0gb3JkZXIubWFwKGZ1bmN0aW9uKG9yZGVyaW5nKSB7XG4gICAgICAgIHZhciBzcGx0ID0gb3JkZXJpbmcuc3BsaXQoJy0nKSxcbiAgICAgICAgICBhc2NlbmRpbmcgPSB0cnVlLFxuICAgICAgICAgIGZpZWxkID0gbnVsbDtcbiAgICAgICAgaWYgKHNwbHQubGVuZ3RoID4gMSkge1xuICAgICAgICAgIGZpZWxkID0gc3BsdFsxXTtcbiAgICAgICAgICBhc2NlbmRpbmcgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBmaWVsZCA9IHNwbHRbMF07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHtmaWVsZDogZmllbGQsIGFzY2VuZGluZzogYXNjZW5kaW5nfTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICB2YXIgc29ydEZ1bmMgPSB0aGlzLnNvcnRGdW5jKGZpZWxkcyk7XG4gICAgICBpZiAocmVzLmltbXV0YWJsZSkgcmVzID0gcmVzLm11dGFibGVDb3B5KCk7XG4gICAgICBpZiAoc29ydEZ1bmMpIHJlcy5zb3J0KHNvcnRGdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlcztcbiAgfSxcbiAgLyoqXG4gICAqIFJldHVybiBhbGwgbW9kZWwgaW5zdGFuY2VzIGluIHRoZSBjYWNoZS5cbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9nZXRDYWNoZUJ5TG9jYWxJZDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuZGVzY2VuZGFudHMucmVkdWNlKGZ1bmN0aW9uKG1lbW8sIGNoaWxkTW9kZWwpIHtcbiAgICAgIHJldHVybiB1dGlsLmV4dGVuZChtZW1vLCBjYWNoZUZvck1vZGVsKGNoaWxkTW9kZWwpKTtcbiAgICB9LCB1dGlsLmV4dGVuZCh7fSwgY2FjaGVGb3JNb2RlbCh0aGlzLm1vZGVsKSkpO1xuICB9LFxuICBfZXhlY3V0ZUluTWVtb3J5OiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgIHZhciBfZXhlY3V0ZUluTWVtb3J5ID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLm1vZGVsXG4gICAgICAgIC5faW5kZXhJc0luc3RhbGxlZFxuICAgICAgICAudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgY2FjaGVCeUxvY2FsSWQgPSB0aGlzLl9nZXRDYWNoZUJ5TG9jYWxJZCgpO1xuICAgICAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMoY2FjaGVCeUxvY2FsSWQpO1xuICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICB2YXIgcmVzID0gW107XG4gICAgICAgICAgdmFyIGVycjtcbiAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBrID0ga2V5c1tpXTtcbiAgICAgICAgICAgIHZhciBvYmogPSBjYWNoZUJ5TG9jYWxJZFtrXTtcbiAgICAgICAgICAgIHZhciBtYXRjaGVzID0gc2VsZi5vYmplY3RNYXRjaGVzUXVlcnkob2JqKTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YobWF0Y2hlcykgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgZXJyID0gZXJyb3IobWF0Y2hlcyk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgaWYgKG1hdGNoZXMpIHJlcy5wdXNoKG9iaik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHJlcyA9IHRoaXMuX3NvcnRSZXN1bHRzKHJlcyk7XG4gICAgICAgICAgaWYgKGVycikgbG9nKCdFcnJvciBleGVjdXRpbmcgcXVlcnknLCBlcnIpO1xuICAgICAgICAgIGNhbGxiYWNrKGVyciwgZXJyID8gbnVsbCA6IGNvbnN0cnVjdFF1ZXJ5U2V0KHJlcywgdGhpcy5tb2RlbCkpO1xuICAgICAgICB9LmJpbmQodGhpcykpXG4gICAgICAgIC5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICB2YXIgX2VyciA9ICdVbmFibGUgdG8gZXhlY3V0ZSBxdWVyeSBkdWUgdG8gZmFpbGVkIGluZGV4IGluc3RhbGxhdGlvbiBvbiBNb2RlbCBcIicgK1xuICAgICAgICAgICAgdGhpcy5tb2RlbC5uYW1lICsgJ1wiJztcbiAgICAgICAgICBjb25zb2xlLmVycm9yKF9lcnIsIGVycik7XG4gICAgICAgICAgY2FsbGJhY2soX2Vycik7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfS5iaW5kKHRoaXMpO1xuICAgIGlmICh0aGlzLm9wdHMuaWdub3JlSW5zdGFsbGVkKSB7XG4gICAgICBfZXhlY3V0ZUluTWVtb3J5KCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgc2llc3RhLl9hZnRlckluc3RhbGwoX2V4ZWN1dGVJbk1lbW9yeSk7XG4gICAgfVxuICB9LFxuICBjbGVhck9yZGVyaW5nOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLm9wdHMub3JkZXIgPSBudWxsO1xuICB9LFxuICBvYmplY3RNYXRjaGVzT3JRdWVyeTogZnVuY3Rpb24ob2JqLCBvclF1ZXJ5KSB7XG4gICAgZm9yICh2YXIgaWR4IGluIG9yUXVlcnkpIHtcbiAgICAgIGlmIChvclF1ZXJ5Lmhhc093blByb3BlcnR5KGlkeCkpIHtcbiAgICAgICAgdmFyIHF1ZXJ5ID0gb3JRdWVyeVtpZHhdO1xuICAgICAgICBpZiAodGhpcy5vYmplY3RNYXRjaGVzQmFzZVF1ZXJ5KG9iaiwgcXVlcnkpKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9LFxuICBvYmplY3RNYXRjaGVzQW5kUXVlcnk6IGZ1bmN0aW9uKG9iaiwgYW5kUXVlcnkpIHtcbiAgICBmb3IgKHZhciBpZHggaW4gYW5kUXVlcnkpIHtcbiAgICAgIGlmIChhbmRRdWVyeS5oYXNPd25Qcm9wZXJ0eShpZHgpKSB7XG4gICAgICAgIHZhciBxdWVyeSA9IGFuZFF1ZXJ5W2lkeF07XG4gICAgICAgIGlmICghdGhpcy5vYmplY3RNYXRjaGVzQmFzZVF1ZXJ5KG9iaiwgcXVlcnkpKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9LFxuICBzcGxpdE1hdGNoZXM6IGZ1bmN0aW9uKG9iaiwgdW5wcm9jZXNzZWRGaWVsZCwgdmFsdWUpIHtcbiAgICB2YXIgb3AgPSAnZSc7XG4gICAgdmFyIGZpZWxkcyA9IHVucHJvY2Vzc2VkRmllbGQuc3BsaXQoJy4nKTtcbiAgICB2YXIgc3BsdCA9IGZpZWxkc1tmaWVsZHMubGVuZ3RoIC0gMV0uc3BsaXQoJ19fJyk7XG4gICAgaWYgKHNwbHQubGVuZ3RoID09IDIpIHtcbiAgICAgIHZhciBmaWVsZCA9IHNwbHRbMF07XG4gICAgICBvcCA9IHNwbHRbMV07XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgZmllbGQgPSBzcGx0WzBdO1xuICAgIH1cbiAgICBmaWVsZHNbZmllbGRzLmxlbmd0aCAtIDFdID0gZmllbGQ7XG4gICAgZmllbGRzLnNsaWNlKDAsIGZpZWxkcy5sZW5ndGggLSAxKS5mb3JFYWNoKGZ1bmN0aW9uKGYpIHtcbiAgICAgIGlmICh1dGlsLmlzQXJyYXkob2JqKSkge1xuICAgICAgICBvYmogPSB1dGlsLnBsdWNrKG9iaiwgZik7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgb2JqID0gb2JqW2ZdO1xuICAgICAgfVxuICAgIH0pO1xuICAgIC8vIElmIHdlIGdldCB0byB0aGUgcG9pbnQgd2hlcmUgd2UncmUgYWJvdXQgdG8gaW5kZXggbnVsbCBvciB1bmRlZmluZWQgd2Ugc3RvcCAtIG9idmlvdXNseSB0aGlzIG9iamVjdCBkb2VzXG4gICAgLy8gbm90IG1hdGNoIHRoZSBxdWVyeS5cbiAgICB2YXIgbm90TnVsbE9yVW5kZWZpbmVkID0gb2JqICE9IHVuZGVmaW5lZDtcbiAgICBpZiAobm90TnVsbE9yVW5kZWZpbmVkKSB7XG4gICAgICBpZiAodXRpbC5pc0FycmF5KG9iaikpIHtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB2YXIgdmFsID0gb2JqW2ZpZWxkXTtcbiAgICAgICAgdmFyIGludmFsaWQgPSB1dGlsLmlzQXJyYXkodmFsKSA/IGZhbHNlIDogdmFsID09PSBudWxsIHx8IHZhbCA9PT0gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgICAgdmFyIGNvbXBhcmF0b3IgPSBRdWVyeS5jb21wYXJhdG9yc1tvcF0sXG4gICAgICAgIG9wdHMgPSB7b2JqZWN0OiBvYmosIGZpZWxkOiBmaWVsZCwgdmFsdWU6IHZhbHVlLCBpbnZhbGlkOiBpbnZhbGlkfTtcbiAgICAgIGlmICghY29tcGFyYXRvcikge1xuICAgICAgICByZXR1cm4gJ05vIGNvbXBhcmF0b3IgcmVnaXN0ZXJlZCBmb3IgcXVlcnkgb3BlcmF0aW9uIFwiJyArIG9wICsgJ1wiJztcbiAgICAgIH1cbiAgICAgIHJldHVybiBjb21wYXJhdG9yKG9wdHMpO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH0sXG4gIG9iamVjdE1hdGNoZXM6IGZ1bmN0aW9uKG9iaiwgdW5wcm9jZXNzZWRGaWVsZCwgdmFsdWUsIHF1ZXJ5KSB7XG4gICAgaWYgKHVucHJvY2Vzc2VkRmllbGQgPT0gJyRvcicpIHtcbiAgICAgIHZhciAkb3IgPSBxdWVyeVsnJG9yJ107XG4gICAgICBpZiAoIXV0aWwuaXNBcnJheSgkb3IpKSB7XG4gICAgICAgICRvciA9IE9iamVjdC5rZXlzKCRvcikubWFwKGZ1bmN0aW9uKGspIHtcbiAgICAgICAgICB2YXIgbm9ybWFsaXNlZCA9IHt9O1xuICAgICAgICAgIG5vcm1hbGlzZWRba10gPSAkb3Jba107XG4gICAgICAgICAgcmV0dXJuIG5vcm1hbGlzZWQ7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgaWYgKCF0aGlzLm9iamVjdE1hdGNoZXNPclF1ZXJ5KG9iaiwgJG9yKSkgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBlbHNlIGlmICh1bnByb2Nlc3NlZEZpZWxkID09ICckYW5kJykge1xuICAgICAgaWYgKCF0aGlzLm9iamVjdE1hdGNoZXNBbmRRdWVyeShvYmosIHF1ZXJ5WyckYW5kJ10pKSByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdmFyIG1hdGNoZXMgPSB0aGlzLnNwbGl0TWF0Y2hlcyhvYmosIHVucHJvY2Vzc2VkRmllbGQsIHZhbHVlKTtcbiAgICAgIGlmICh0eXBlb2YgbWF0Y2hlcyAhPSAnYm9vbGVhbicpIHJldHVybiBtYXRjaGVzO1xuICAgICAgaWYgKCFtYXRjaGVzKSByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9LFxuICBvYmplY3RNYXRjaGVzQmFzZVF1ZXJ5OiBmdW5jdGlvbihvYmosIHF1ZXJ5KSB7XG4gICAgdmFyIGZpZWxkcyA9IE9iamVjdC5rZXlzKHF1ZXJ5KTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZpZWxkcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHVucHJvY2Vzc2VkRmllbGQgPSBmaWVsZHNbaV0sXG4gICAgICAgIHZhbHVlID0gcXVlcnlbdW5wcm9jZXNzZWRGaWVsZF07XG4gICAgICB2YXIgcnQgPSB0aGlzLm9iamVjdE1hdGNoZXMob2JqLCB1bnByb2Nlc3NlZEZpZWxkLCB2YWx1ZSwgcXVlcnkpO1xuICAgICAgaWYgKHR5cGVvZiBydCAhPSAnYm9vbGVhbicpIHJldHVybiBydDtcbiAgICAgIGlmICghcnQpIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH0sXG4gIG9iamVjdE1hdGNoZXNRdWVyeTogZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIHRoaXMub2JqZWN0TWF0Y2hlc0Jhc2VRdWVyeShvYmosIHRoaXMucXVlcnkpO1xuICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBRdWVyeTtcblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9RdWVyeS5qc1xuICoqIG1vZHVsZSBpZCA9IDE1XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICBQcm9taXNlID0gdXRpbC5Qcm9taXNlLFxuICBlcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKSxcbiAgTW9kZWxJbnN0YW5jZSA9IHJlcXVpcmUoJy4vTW9kZWxJbnN0YW5jZScpO1xuXG4vKlxuIFRPRE86IFVzZSBFUzYgUHJveHkgaW5zdGVhZC5cbiBFdmVudHVhbGx5IHF1ZXJ5IHNldHMgc2hvdWxkIHVzZSBFUzYgUHJveGllcyB3aGljaCB3aWxsIGJlIG11Y2ggbW9yZSBuYXR1cmFsIGFuZCByb2J1c3QuIEUuZy4gbm8gbmVlZCBmb3IgdGhlIGJlbG93XG4gKi9cbnZhciBBUlJBWV9NRVRIT0RTID0gWydwdXNoJywgJ3NvcnQnLCAncmV2ZXJzZScsICdzcGxpY2UnLCAnc2hpZnQnLCAndW5zaGlmdCddLFxuICBOVU1CRVJfTUVUSE9EUyA9IFsndG9TdHJpbmcnLCAndG9FeHBvbmVudGlhbCcsICd0b0ZpeGVkJywgJ3RvUHJlY2lzaW9uJywgJ3ZhbHVlT2YnXSxcbiAgTlVNQkVSX1BST1BFUlRJRVMgPSBbJ01BWF9WQUxVRScsICdNSU5fVkFMVUUnLCAnTkVHQVRJVkVfSU5GSU5JVFknLCAnTmFOJywgJ1BPU0lUSVZFX0lORklOSVRZJ10sXG4gIFNUUklOR19NRVRIT0RTID0gWydjaGFyQXQnLCAnY2hhckNvZGVBdCcsICdjb25jYXQnLCAnZnJvbUNoYXJDb2RlJywgJ2luZGV4T2YnLCAnbGFzdEluZGV4T2YnLCAnbG9jYWxlQ29tcGFyZScsXG4gICAgJ21hdGNoJywgJ3JlcGxhY2UnLCAnc2VhcmNoJywgJ3NsaWNlJywgJ3NwbGl0JywgJ3N1YnN0cicsICdzdWJzdHJpbmcnLCAndG9Mb2NhbGVMb3dlckNhc2UnLCAndG9Mb2NhbGVVcHBlckNhc2UnLFxuICAgICd0b0xvd2VyQ2FzZScsICd0b1N0cmluZycsICd0b1VwcGVyQ2FzZScsICd0cmltJywgJ3ZhbHVlT2YnXSxcbiAgU1RSSU5HX1BST1BFUlRJRVMgPSBbJ2xlbmd0aCddO1xuXG4vKipcbiAqIFJldHVybiB0aGUgcHJvcGVydHkgbmFtZXMgZm9yIGEgZ2l2ZW4gb2JqZWN0LiBIYW5kbGVzIHNwZWNpYWwgY2FzZXMgc3VjaCBhcyBzdHJpbmdzIGFuZCBudW1iZXJzIHRoYXQgZG8gbm90IGhhdmVcbiAqIHRoZSBnZXRPd25Qcm9wZXJ0eU5hbWVzIGZ1bmN0aW9uLlxuICogVGhlIHNwZWNpYWwgY2FzZXMgYXJlIHZlcnkgbXVjaCBoYWNrcy4gVGhpcyBoYWNrIGNhbiBiZSByZW1vdmVkIG9uY2UgdGhlIFByb3h5IG9iamVjdCBpcyBtb3JlIHdpZGVseSBhZG9wdGVkLlxuICogQHBhcmFtIG9iamVjdFxuICogQHJldHVybnMge0FycmF5fVxuICovXG5mdW5jdGlvbiBnZXRQcm9wZXJ0eU5hbWVzKG9iamVjdCkge1xuICB2YXIgcHJvcGVydHlOYW1lcztcbiAgaWYgKHR5cGVvZiBvYmplY3QgPT0gJ3N0cmluZycgfHwgb2JqZWN0IGluc3RhbmNlb2YgU3RyaW5nKSB7XG4gICAgcHJvcGVydHlOYW1lcyA9IFNUUklOR19NRVRIT0RTLmNvbmNhdChTVFJJTkdfUFJPUEVSVElFUyk7XG4gIH1cbiAgZWxzZSBpZiAodHlwZW9mIG9iamVjdCA9PSAnbnVtYmVyJyB8fCBvYmplY3QgaW5zdGFuY2VvZiBOdW1iZXIpIHtcbiAgICBwcm9wZXJ0eU5hbWVzID0gTlVNQkVSX01FVEhPRFMuY29uY2F0KE5VTUJFUl9QUk9QRVJUSUVTKTtcbiAgfVxuICBlbHNlIHtcbiAgICBwcm9wZXJ0eU5hbWVzID0gb2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoKTtcbiAgfVxuICByZXR1cm4gcHJvcGVydHlOYW1lcztcbn1cblxuLyoqXG4gKiBEZWZpbmUgYSBwcm94eSBwcm9wZXJ0eSB0byBhdHRyaWJ1dGVzIG9uIG9iamVjdHMgaW4gdGhlIGFycmF5XG4gKiBAcGFyYW0gYXJyXG4gKiBAcGFyYW0gcHJvcFxuICovXG5mdW5jdGlvbiBkZWZpbmVBdHRyaWJ1dGUoYXJyLCBwcm9wKSB7XG4gIGlmICghKHByb3AgaW4gYXJyKSkgeyAvLyBlLmcuIHdlIGNhbm5vdCByZWRlZmluZSAubGVuZ3RoXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGFyciwgcHJvcCwge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHF1ZXJ5U2V0KHV0aWwucGx1Y2soYXJyLCBwcm9wKSk7XG4gICAgICB9LFxuICAgICAgc2V0OiBmdW5jdGlvbih2KSB7XG4gICAgICAgIGlmICh1dGlsLmlzQXJyYXkodikpIHtcbiAgICAgICAgICBpZiAodGhpcy5sZW5ndGggIT0gdi5sZW5ndGgpIHRocm93IGVycm9yKHttZXNzYWdlOiAnTXVzdCBiZSBzYW1lIGxlbmd0aCd9KTtcbiAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHYubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXNbaV1bcHJvcF0gPSB2W2ldO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpc1tpXVtwcm9wXSA9IHY7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNQcm9taXNlKG9iaikge1xuICAvLyBUT0RPOiBEb24ndCB0aGluayB0aGlzIGlzIHZlcnkgcm9idXN0LlxuICByZXR1cm4gb2JqLnRoZW4gJiYgb2JqLmNhdGNoO1xufVxuXG4vKipcbiAqIERlZmluZSBhIHByb3h5IG1ldGhvZCBvbiB0aGUgYXJyYXkgaWYgbm90IGFscmVhZHkgaW4gZXhpc3RlbmNlLlxuICogQHBhcmFtIGFyclxuICogQHBhcmFtIHByb3BcbiAqL1xuZnVuY3Rpb24gZGVmaW5lTWV0aG9kKGFyciwgcHJvcCkge1xuICBpZiAoIShwcm9wIGluIGFycikpIHsgLy8gZS5nLiB3ZSBkb24ndCB3YW50IHRvIHJlZGVmaW5lIHRvU3RyaW5nXG4gICAgYXJyW3Byb3BdID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cyxcbiAgICAgICAgcmVzID0gdGhpcy5tYXAoZnVuY3Rpb24ocCkge1xuICAgICAgICAgIHJldHVybiBwW3Byb3BdLmFwcGx5KHAsIGFyZ3MpO1xuICAgICAgICB9KTtcbiAgICAgIHZhciBhcmVQcm9taXNlcyA9IGZhbHNlO1xuICAgICAgaWYgKHJlcy5sZW5ndGgpIGFyZVByb21pc2VzID0gaXNQcm9taXNlKHJlc1swXSk7XG4gICAgICByZXR1cm4gYXJlUHJvbWlzZXMgPyBQcm9taXNlLmFsbChyZXMpIDogcXVlcnlTZXQocmVzKTtcbiAgICB9O1xuICB9XG59XG5cbi8qKlxuICogVHJhbnNmb3JtIHRoZSBhcnJheSBpbnRvIGEgcXVlcnkgc2V0LlxuICogUmVuZGVycyB0aGUgYXJyYXkgaW1tdXRhYmxlLlxuICogQHBhcmFtIGFyclxuICogQHBhcmFtIG1vZGVsIC0gVGhlIG1vZGVsIHdpdGggd2hpY2ggdG8gcHJveHkgdG9cbiAqL1xuZnVuY3Rpb24gbW9kZWxRdWVyeVNldChhcnIsIG1vZGVsKSB7XG4gIGFyciA9IHV0aWwuZXh0ZW5kKFtdLCBhcnIpO1xuICB2YXIgYXR0cmlidXRlTmFtZXMgPSBtb2RlbC5fYXR0cmlidXRlTmFtZXMsXG4gICAgcmVsYXRpb25zaGlwTmFtZXMgPSBtb2RlbC5fcmVsYXRpb25zaGlwTmFtZXMsXG4gICAgbmFtZXMgPSBhdHRyaWJ1dGVOYW1lcy5jb25jYXQocmVsYXRpb25zaGlwTmFtZXMpLmNvbmNhdChpbnN0YW5jZU1ldGhvZHMpO1xuICBuYW1lcy5mb3JFYWNoKGRlZmluZUF0dHJpYnV0ZS5iaW5kKGRlZmluZUF0dHJpYnV0ZSwgYXJyKSk7XG4gIHZhciBpbnN0YW5jZU1ldGhvZHMgPSBPYmplY3Qua2V5cyhNb2RlbEluc3RhbmNlLnByb3RvdHlwZSk7XG4gIGluc3RhbmNlTWV0aG9kcy5mb3JFYWNoKGRlZmluZU1ldGhvZC5iaW5kKGRlZmluZU1ldGhvZCwgYXJyKSk7XG4gIHJldHVybiByZW5kZXJJbW11dGFibGUoYXJyKTtcbn1cblxuLyoqXG4gKiBUcmFuc2Zvcm0gdGhlIGFycmF5IGludG8gYSBxdWVyeSBzZXQsIGJhc2VkIG9uIHdoYXRldmVyIGlzIGluIGl0LlxuICogTm90ZSB0aGF0IGFsbCBvYmplY3RzIG11c3QgYmUgb2YgdGhlIHNhbWUgdHlwZS4gVGhpcyBmdW5jdGlvbiB3aWxsIHRha2UgdGhlIGZpcnN0IG9iamVjdCBhbmQgZGVjaWRlIGhvdyB0byBwcm94eVxuICogYmFzZWQgb24gdGhhdC5cbiAqIEBwYXJhbSBhcnJcbiAqL1xuZnVuY3Rpb24gcXVlcnlTZXQoYXJyKSB7XG4gIGlmIChhcnIubGVuZ3RoKSB7XG4gICAgdmFyIHJlZmVyZW5jZU9iamVjdCA9IGFyclswXSxcbiAgICAgIHByb3BlcnR5TmFtZXMgPSBnZXRQcm9wZXJ0eU5hbWVzKHJlZmVyZW5jZU9iamVjdCk7XG4gICAgcHJvcGVydHlOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uKHByb3ApIHtcbiAgICAgIGlmICh0eXBlb2YgcmVmZXJlbmNlT2JqZWN0W3Byb3BdID09ICdmdW5jdGlvbicpIGRlZmluZU1ldGhvZChhcnIsIHByb3AsIGFyZ3VtZW50cyk7XG4gICAgICBlbHNlIGRlZmluZUF0dHJpYnV0ZShhcnIsIHByb3ApO1xuICAgIH0pO1xuICB9XG4gIHJldHVybiByZW5kZXJJbW11dGFibGUoYXJyKTtcbn1cblxuZnVuY3Rpb24gdGhyb3dJbW11dGFibGVFcnJvcigpIHtcbiAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgbW9kaWZ5IGEgcXVlcnkgc2V0Jyk7XG59XG5cbi8qKlxuICogUmVuZGVyIGFuIGFycmF5IGltbXV0YWJsZSBieSByZXBsYWNpbmcgYW55IGZ1bmN0aW9ucyB0aGF0IGNhbiBtdXRhdGUgaXQuXG4gKiBAcGFyYW0gYXJyXG4gKi9cbmZ1bmN0aW9uIHJlbmRlckltbXV0YWJsZShhcnIpIHtcbiAgQVJSQVlfTUVUSE9EUy5mb3JFYWNoKGZ1bmN0aW9uKHApIHtcbiAgICBhcnJbcF0gPSB0aHJvd0ltbXV0YWJsZUVycm9yO1xuICB9KTtcbiAgYXJyLmltbXV0YWJsZSA9IHRydWU7XG4gIGFyci5tdXRhYmxlQ29weSA9IGFyci5hc0FycmF5ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIG11dGFibGVBcnIgPSB0aGlzLm1hcChmdW5jdGlvbih4KSB7cmV0dXJuIHh9KTtcbiAgICBtdXRhYmxlQXJyLmFzUXVlcnlTZXQgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBxdWVyeVNldCh0aGlzKTtcbiAgICB9O1xuICAgIG11dGFibGVBcnIuYXNNb2RlbFF1ZXJ5U2V0ID0gZnVuY3Rpb24obW9kZWwpIHtcbiAgICAgIHJldHVybiBtb2RlbFF1ZXJ5U2V0KHRoaXMsIG1vZGVsKTtcbiAgICB9O1xuICAgIHJldHVybiBtdXRhYmxlQXJyO1xuICB9O1xuICByZXR1cm4gYXJyO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG1vZGVsUXVlcnlTZXQ7XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvUXVlcnlTZXQuanNcbiAqKiBtb2R1bGUgaWQgPSAxNlxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiLyoqXG4gKiBEZWFkIHNpbXBsZSBsb2dnaW5nIHNlcnZpY2UgYmFzZWQgb24gdmlzaW9ubWVkaWEvZGVidWdcbiAqIEBtb2R1bGUgbG9nXG4gKi9cblxudmFyIGRlYnVnID0gcmVxdWlyZSgnZGVidWcnKSxcbiAgYXJnc2FycmF5ID0gcmVxdWlyZSgnYXJnc2FycmF5Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24obmFtZSkge1xuICB2YXIgbG9nID0gZGVidWcoJ3NpZXN0YTonICsgbmFtZSk7XG4gIHZhciBmbiA9IGFyZ3NhcnJheShmdW5jdGlvbihhcmdzKSB7XG4gICAgbG9nLmNhbGwobG9nLCBhcmdzKTtcbiAgfSk7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShmbiwgJ2VuYWJsZWQnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBkZWJ1Zy5lbmFibGVkKG5hbWUpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBmbjtcbn07XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvbG9nLmpzXG4gKiogbW9kdWxlIGlkID0gMTdcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpLFxuICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgTW9kZWxFdmVudFR5cGUgPSBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZSxcbiAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyk7XG5cbmZ1bmN0aW9uIE1vZGVsSW5zdGFuY2UobW9kZWwpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB0aGlzLm1vZGVsID0gbW9kZWw7XG5cbiAgdXRpbC5zdWJQcm9wZXJ0aWVzKHRoaXMsIHRoaXMubW9kZWwsIFtcbiAgICAnY29sbGVjdGlvbicsXG4gICAgJ2NvbGxlY3Rpb25OYW1lJyxcbiAgICAnX2F0dHJpYnV0ZU5hbWVzJyxcbiAgICB7XG4gICAgICBuYW1lOiAnaWRGaWVsZCcsXG4gICAgICBwcm9wZXJ0eTogJ2lkJ1xuICAgIH0sXG4gICAge1xuICAgICAgbmFtZTogJ21vZGVsTmFtZScsXG4gICAgICBwcm9wZXJ0eTogJ25hbWUnXG4gICAgfVxuICBdKTtcblxuICBldmVudHMuUHJveHlFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcblxuICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0aGlzLCB7XG4gICAgX3JlbGF0aW9uc2hpcE5hbWVzOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgcHJveGllcyA9IE9iamVjdC5rZXlzKHNlbGYuX19wcm94aWVzIHx8IHt9KS5tYXAoZnVuY3Rpb24oeCkge1xuICAgICAgICAgIHJldHVybiBzZWxmLl9fcHJveGllc1t4XVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHByb3hpZXMubWFwKGZ1bmN0aW9uKHApIHtcbiAgICAgICAgICBpZiAocC5pc0ZvcndhcmQpIHtcbiAgICAgICAgICAgIHJldHVybiBwLmZvcndhcmROYW1lO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gcC5yZXZlcnNlTmFtZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9LFxuICAgIGRpcnR5OiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkge1xuICAgICAgICAgIHJldHVybiBzZWxmLmxvY2FsSWQgaW4gc2llc3RhLmV4dC5zdG9yYWdlLl91bnNhdmVkT2JqZWN0c0hhc2g7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgfSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9LFxuICAgIC8vIFRoaXMgaXMgZm9yIFByb3h5RXZlbnRFbWl0dGVyLlxuICAgIGV2ZW50OiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5sb2NhbElkXG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICB0aGlzLnJlbW92ZWQgPSBmYWxzZTtcblxuICAvKipcbiAgICogV2hldGhlciBvciBub3QgZXZlbnRzIChzZXQsIHJlbW92ZSBldGMpIGFyZSBlbWl0dGVkIGZvciB0aGlzIG1vZGVsIGluc3RhbmNlLlxuICAgKlxuICAgKiBUaGlzIGlzIHVzZWQgYXMgYSB3YXkgb2YgY29udHJvbGxpbmcgd2hhdCBldmVudHMgYXJlIGVtaXR0ZWQgd2hlbiB0aGUgbW9kZWwgaW5zdGFuY2UgaXMgY3JlYXRlZC4gRS5nLiB3ZSBkb24ndFxuICAgKiB3YW50IHRvIHNlbmQgYSBtZXRyaWMgc2hpdCB0b24gb2YgJ3NldCcgZXZlbnRzIGlmIHdlJ3JlIG5ld2x5IGNyZWF0aW5nIGFuIGluc3RhbmNlLiBXZSBvbmx5IHdhbnQgdG8gc2VuZCB0aGVcbiAgICogJ25ldycgZXZlbnQgb25jZSBjb25zdHJ1Y3RlZC5cbiAgICpcbiAgICogVGhpcyBpcyBwcm9iYWJseSBhIGJpdCBvZiBhIGhhY2sgYW5kIHNob3VsZCBiZSByZW1vdmVkIGV2ZW50dWFsbHkuXG4gICAqIEB0eXBlIHtib29sZWFufVxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgdGhpcy5fZW1pdEV2ZW50cyA9IGZhbHNlO1xufVxuXG5Nb2RlbEluc3RhbmNlLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoZXZlbnRzLlByb3h5RXZlbnRFbWl0dGVyLnByb3RvdHlwZSk7XG5cbnV0aWwuZXh0ZW5kKE1vZGVsSW5zdGFuY2UucHJvdG90eXBlLCB7XG4gIGdldDogZnVuY3Rpb24oY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgY2IobnVsbCwgdGhpcyk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgZW1pdDogZnVuY3Rpb24odHlwZSwgb3B0cykge1xuICAgIGlmICh0eXBlb2YgdHlwZSA9PSAnb2JqZWN0Jykgb3B0cyA9IHR5cGU7XG4gICAgZWxzZSBvcHRzLnR5cGUgPSB0eXBlO1xuICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgIHV0aWwuZXh0ZW5kKG9wdHMsIHtcbiAgICAgIGNvbGxlY3Rpb246IHRoaXMuY29sbGVjdGlvbk5hbWUsXG4gICAgICBtb2RlbDogdGhpcy5tb2RlbC5uYW1lLFxuICAgICAgbG9jYWxJZDogdGhpcy5sb2NhbElkLFxuICAgICAgb2JqOiB0aGlzXG4gICAgfSk7XG4gICAgbW9kZWxFdmVudHMuZW1pdChvcHRzKTtcbiAgfSxcbiAgcmVtb3ZlOiBmdW5jdGlvbihjYiwgbm90aWZpY2F0aW9uKSB7XG4gICAgXy5lYWNoKHRoaXMuX3JlbGF0aW9uc2hpcE5hbWVzLCBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgaWYgKHV0aWwuaXNBcnJheSh0aGlzW25hbWVdKSkge1xuICAgICAgICB0aGlzW25hbWVdID0gW107XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdGhpc1tuYW1lXSA9IG51bGw7XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgICBub3RpZmljYXRpb24gPSBub3RpZmljYXRpb24gPT0gbnVsbCA/IHRydWUgOiBub3RpZmljYXRpb247XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIGNhY2hlLnJlbW92ZSh0aGlzKTtcbiAgICAgIHRoaXMucmVtb3ZlZCA9IHRydWU7XG4gICAgICBpZiAobm90aWZpY2F0aW9uKSB7XG4gICAgICAgIHRoaXMuZW1pdChtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5SZW1vdmUsIHtcbiAgICAgICAgICBvbGQ6IHRoaXNcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICB2YXIgcmVtb3ZlID0gdGhpcy5tb2RlbC5yZW1vdmU7XG4gICAgICBpZiAocmVtb3ZlKSB7XG4gICAgICAgIHZhciBwYXJhbU5hbWVzID0gdXRpbC5wYXJhbU5hbWVzKHJlbW92ZSk7XG4gICAgICAgIGlmIChwYXJhbU5hbWVzLmxlbmd0aCkge1xuICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICByZW1vdmUuY2FsbCh0aGlzLCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgIGNiKGVyciwgc2VsZik7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgcmVtb3ZlLmNhbGwodGhpcyk7XG4gICAgICAgICAgY2IobnVsbCwgdGhpcyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBjYihudWxsLCB0aGlzKTtcbiAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuICByZXN0b3JlOiBmdW5jdGlvbihjYikge1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICB2YXIgX2ZpbmlzaCA9IGZ1bmN0aW9uKGVycikge1xuICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgIHRoaXMuZW1pdChtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5OZXcsIHtcbiAgICAgICAgICAgIG5ldzogdGhpc1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGNiKGVyciwgdGhpcyk7XG4gICAgICB9LmJpbmQodGhpcyk7XG4gICAgICBpZiAodGhpcy5yZW1vdmVkKSB7XG4gICAgICAgIGNhY2hlLmluc2VydCh0aGlzKTtcbiAgICAgICAgdGhpcy5yZW1vdmVkID0gZmFsc2U7XG4gICAgICAgIHZhciBpbml0ID0gdGhpcy5tb2RlbC5pbml0O1xuICAgICAgICBpZiAoaW5pdCkge1xuICAgICAgICAgIHZhciBwYXJhbU5hbWVzID0gdXRpbC5wYXJhbU5hbWVzKGluaXQpO1xuICAgICAgICAgIHZhciBmcm9tU3RvcmFnZSA9IHRydWU7XG4gICAgICAgICAgaWYgKHBhcmFtTmFtZXMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgaW5pdC5jYWxsKHRoaXMsIGZyb21TdG9yYWdlLCBfZmluaXNoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpbml0LmNhbGwodGhpcywgZnJvbVN0b3JhZ2UpO1xuICAgICAgICAgICAgX2ZpbmlzaCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBfZmluaXNoKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpO1xuICB9XG59KTtcblxuLy8gSW5zcGVjdGlvblxudXRpbC5leHRlbmQoTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUsIHtcbiAgZ2V0QXR0cmlidXRlczogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHV0aWwuZXh0ZW5kKHt9LCB0aGlzLl9fdmFsdWVzKTtcbiAgfSxcbiAgaXNJbnN0YW5jZU9mOiBmdW5jdGlvbihtb2RlbCkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsID09IG1vZGVsO1xuICB9LFxuICBpc0E6IGZ1bmN0aW9uKG1vZGVsKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwgPT0gbW9kZWwgfHwgdGhpcy5tb2RlbC5pc0Rlc2NlbmRhbnRPZihtb2RlbCk7XG4gIH1cbn0pO1xuXG4vLyBEdW1wXG51dGlsLmV4dGVuZChNb2RlbEluc3RhbmNlLnByb3RvdHlwZSwge1xuICBfZHVtcFN0cmluZzogZnVuY3Rpb24ocmV2ZXJzZVJlbGF0aW9uc2hpcHMpIHtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodGhpcy5fZHVtcChyZXZlcnNlUmVsYXRpb25zaGlwcywgbnVsbCwgNCkpO1xuICB9LFxuICBfZHVtcDogZnVuY3Rpb24ocmV2ZXJzZVJlbGF0aW9uc2hpcHMpIHtcbiAgICB2YXIgZHVtcGVkID0gdXRpbC5leHRlbmQoe30sIHRoaXMuX192YWx1ZXMpO1xuICAgIGR1bXBlZC5fcmV2ID0gdGhpcy5fcmV2O1xuICAgIGR1bXBlZC5sb2NhbElkID0gdGhpcy5sb2NhbElkO1xuICAgIHJldHVybiBkdW1wZWQ7XG4gIH1cbn0pO1xuXG4vLyBTZXJpYWxpc2F0aW9uXG51dGlsLmV4dGVuZChNb2RlbEluc3RhbmNlLnByb3RvdHlwZSwge1xuICBfZGVmYXVsdFNlcmlhbGlzZTogZnVuY3Rpb24ob3B0cykge1xuICAgIHZhciBzZXJpYWxpc2VkID0ge307XG4gICAgdmFyIGluY2x1ZGVOdWxsQXR0cmlidXRlcyA9IG9wdHMuaW5jbHVkZU51bGxBdHRyaWJ1dGVzICE9PSB1bmRlZmluZWQgPyBvcHRzLmluY2x1ZGVOdWxsQXR0cmlidXRlcyA6IHRydWUsXG4gICAgICBpbmNsdWRlTnVsbFJlbGF0aW9uc2hpcHMgPSBvcHRzLmluY2x1ZGVOdWxsUmVsYXRpb25zaGlwcyAhPT0gdW5kZWZpbmVkID8gb3B0cy5pbmNsdWRlTnVsbFJlbGF0aW9uc2hpcHMgOiB0cnVlO1xuICAgIHZhciBzZXJpYWxpc2FibGVGaWVsZHMgPSB0aGlzLm1vZGVsLnNlcmlhbGlzYWJsZUZpZWxkcyB8fFxuICAgICAgdGhpcy5fYXR0cmlidXRlTmFtZXMuY29uY2F0LmFwcGx5KHRoaXMuX2F0dHJpYnV0ZU5hbWVzLCB0aGlzLl9yZWxhdGlvbnNoaXBOYW1lcykuY29uY2F0KHRoaXMuaWQpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZU5hbWVzLmZvckVhY2goZnVuY3Rpb24oYXR0ck5hbWUpIHtcbiAgICAgIGlmIChzZXJpYWxpc2FibGVGaWVsZHMuaW5kZXhPZihhdHRyTmFtZSkgPiAtMSkge1xuICAgICAgICB2YXIgYXR0ckRlZmluaXRpb24gPSB0aGlzLm1vZGVsLl9hdHRyaWJ1dGVEZWZpbml0aW9uV2l0aE5hbWUoYXR0ck5hbWUpIHx8IHt9O1xuICAgICAgICB2YXIgc2VyaWFsaXNlcjtcbiAgICAgICAgaWYgKGF0dHJEZWZpbml0aW9uLnNlcmlhbGlzZSkgc2VyaWFsaXNlciA9IGF0dHJEZWZpbml0aW9uLnNlcmlhbGlzZS5iaW5kKHRoaXMpO1xuICAgICAgICBlbHNlIHNlcmlhbGlzZXIgPSB0aGlzLm1vZGVsLnNlcmlhbGlzZUZpZWxkLmJpbmQodGhpcywgYXR0ck5hbWUpO1xuICAgICAgICB2YXIgdmFsID0gdGhpc1thdHRyTmFtZV07XG4gICAgICAgIGlmICh2YWwgPT09IG51bGwpIHtcbiAgICAgICAgICBpZiAoaW5jbHVkZU51bGxBdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICBzZXJpYWxpc2VkW2F0dHJOYW1lXSA9IHNlcmlhbGlzZXIodmFsKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodmFsICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBzZXJpYWxpc2VkW2F0dHJOYW1lXSA9IHNlcmlhbGlzZXIodmFsKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG4gICAgdGhpcy5fcmVsYXRpb25zaGlwTmFtZXMuZm9yRWFjaChmdW5jdGlvbihyZWxOYW1lKSB7XG4gICAgICBpZiAoc2VyaWFsaXNhYmxlRmllbGRzLmluZGV4T2YocmVsTmFtZSkgPiAtMSkge1xuICAgICAgICB2YXIgdmFsID0gdGhpc1tyZWxOYW1lXSxcbiAgICAgICAgICByZWwgPSB0aGlzLm1vZGVsLnJlbGF0aW9uc2hpcHNbcmVsTmFtZV07XG4gICAgICAgIGlmICh1dGlsLmlzQXJyYXkodmFsKSkge1xuICAgICAgICAgIHZhbCA9IHV0aWwucGx1Y2sodmFsLCB0aGlzLm1vZGVsLmlkKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh2YWwpIHtcbiAgICAgICAgICB2YWwgPSB2YWxbdGhpcy5tb2RlbC5pZF07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlbCAmJiAhcmVsLmlzUmV2ZXJzZSkge1xuICAgICAgICAgIHZhciBzZXJpYWxpc2VyO1xuICAgICAgICAgIGlmIChyZWwuc2VyaWFsaXNlKSBzZXJpYWxpc2VyID0gcmVsLnNlcmlhbGlzZS5iaW5kKHRoaXMpO1xuICAgICAgICAgIGVsc2Ugc2VyaWFsaXNlciA9IHRoaXMubW9kZWwuc2VyaWFsaXNlRmllbGQuYmluZCh0aGlzLCByZWxOYW1lKTtcbiAgICAgICAgICBpZiAodmFsID09PSBudWxsKSB7XG4gICAgICAgICAgICBpZiAoaW5jbHVkZU51bGxSZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgICAgICAgIHNlcmlhbGlzZWRbcmVsTmFtZV0gPSBzZXJpYWxpc2VyKHZhbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2UgaWYgKHV0aWwuaXNBcnJheSh2YWwpKSB7XG4gICAgICAgICAgICBpZiAoKGluY2x1ZGVOdWxsUmVsYXRpb25zaGlwcyAmJiAhdmFsLmxlbmd0aCkgfHwgdmFsLmxlbmd0aCkge1xuICAgICAgICAgICAgICBzZXJpYWxpc2VkW3JlbE5hbWVdID0gc2VyaWFsaXNlcih2YWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIGlmICh2YWwgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgc2VyaWFsaXNlZFtyZWxOYW1lXSA9IHNlcmlhbGlzZXIodmFsKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpO1xuICAgIHJldHVybiBzZXJpYWxpc2VkO1xuICB9LFxuICBzZXJpYWxpc2U6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICBpZiAoIXRoaXMubW9kZWwuc2VyaWFsaXNlKSByZXR1cm4gdGhpcy5fZGVmYXVsdFNlcmlhbGlzZShvcHRzKTtcbiAgICBlbHNlIHJldHVybiB0aGlzLm1vZGVsLnNlcmlhbGlzZSh0aGlzLCBvcHRzKTtcbiAgfVxufSk7XG5cbnV0aWwuZXh0ZW5kKE1vZGVsSW5zdGFuY2UucHJvdG90eXBlLCB7XG4gIC8qKlxuICAgKiBFbWl0IGFuIGV2ZW50IGluZGljYXRpbmcgdGhhdCB0aGlzIGluc3RhbmNlIGhhcyBqdXN0IGJlZW4gY3JlYXRlZC5cbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9lbWl0TmV3OiBmdW5jdGlvbigpIHtcbiAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgIGNvbGxlY3Rpb246IHRoaXMubW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICBtb2RlbDogdGhpcy5tb2RlbC5uYW1lLFxuICAgICAgbG9jYWxJZDogdGhpcy5sb2NhbElkLFxuICAgICAgbmV3OiB0aGlzLFxuICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuTmV3LFxuICAgICAgb2JqOiB0aGlzXG4gICAgfSk7XG4gIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1vZGVsSW5zdGFuY2U7XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvTW9kZWxJbnN0YW5jZS5qc1xuICoqIG1vZHVsZSBpZCA9IDE4XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgTW9kZWxJbnN0YW5jZSA9IHJlcXVpcmUoJy4vTW9kZWxJbnN0YW5jZScpLFxuICBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdncmFwaCcpLFxuICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKSxcbiAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xuXG5mdW5jdGlvbiBTaWVzdGFFcnJvcihvcHRzKSB7XG4gIHRoaXMub3B0cyA9IG9wdHM7XG59XG5cblNpZXN0YUVycm9yLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodGhpcy5vcHRzLCBudWxsLCA0KTtcbn07XG5cbi8qKlxuICogRW5jYXBzdWxhdGVzIHRoZSBpZGVhIG9mIG1hcHBpbmcgYXJyYXlzIG9mIGRhdGEgb250byB0aGUgb2JqZWN0IGdyYXBoIG9yIGFycmF5cyBvZiBvYmplY3RzLlxuICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAqIEBwYXJhbSBvcHRzLm1vZGVsXG4gKiBAcGFyYW0gb3B0cy5kYXRhXG4gKiBAcGFyYW0gb3B0cy5vYmplY3RzXG4gKiBAcGFyYW0gb3B0cy5kaXNhYmxlTm90aWZpY2F0aW9uc1xuICovXG5mdW5jdGlvbiBNYXBwaW5nT3BlcmF0aW9uKG9wdHMpIHtcbiAgdGhpcy5fb3B0cyA9IG9wdHM7XG5cbiAgdXRpbC5leHRlbmRGcm9tT3B0cyh0aGlzLCBvcHRzLCB7XG4gICAgbW9kZWw6IG51bGwsXG4gICAgZGF0YTogbnVsbCxcbiAgICBvYmplY3RzOiBbXSxcbiAgICBkaXNhYmxlZXZlbnRzOiBmYWxzZSxcbiAgICBfaWdub3JlSW5zdGFsbGVkOiBmYWxzZSxcbiAgICBmcm9tU3RvcmFnZTogZmFsc2VcbiAgfSk7XG5cbiAgdXRpbC5leHRlbmQodGhpcywge1xuICAgIGVycm9yczogW10sXG4gICAgc3ViVGFza1Jlc3VsdHM6IHt9LFxuICAgIF9uZXdPYmplY3RzOiBbXVxuICB9KTtcblxuXG4gIHRoaXMubW9kZWwuX2luc3RhbGxSZXZlcnNlUGxhY2Vob2xkZXJzKCk7XG4gIHRoaXMuZGF0YSA9IHRoaXMucHJlcHJvY2Vzc0RhdGEoKTtcbn1cblxudXRpbC5leHRlbmQoTWFwcGluZ09wZXJhdGlvbi5wcm90b3R5cGUsIHtcbiAgbWFwQXR0cmlidXRlczogZnVuY3Rpb24oKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBkYXR1bSA9IHRoaXMuZGF0YVtpXSxcbiAgICAgICAgb2JqZWN0ID0gdGhpcy5vYmplY3RzW2ldO1xuICAgICAgLy8gTm8gcG9pbnQgbWFwcGluZyBvYmplY3Qgb250byBpdHNlbGYuIFRoaXMgaGFwcGVucyBpZiBhIE1vZGVsSW5zdGFuY2UgaXMgcGFzc2VkIGFzIGEgcmVsYXRpb25zaGlwLlxuICAgICAgaWYgKGRhdHVtICE9IG9iamVjdCkge1xuICAgICAgICBpZiAob2JqZWN0KSB7IC8vIElmIG9iamVjdCBpcyBmYWxzeSwgdGhlbiB0aGVyZSB3YXMgYW4gZXJyb3IgbG9va2luZyB1cCB0aGF0IG9iamVjdC9jcmVhdGluZyBpdC5cbiAgICAgICAgICB2YXIgZmllbGRzID0gdGhpcy5tb2RlbC5fYXR0cmlidXRlTmFtZXM7XG4gICAgICAgICAgZmllbGRzLmZvckVhY2goZnVuY3Rpb24oZikge1xuICAgICAgICAgICAgaWYgKGRhdHVtW2ZdICE9PSB1bmRlZmluZWQpIHsgLy8gbnVsbCBpcyBmaW5lXG4gICAgICAgICAgICAgIC8vIElmIGV2ZW50cyBhcmUgZGlzYWJsZWQgd2UgdXBkYXRlIF9fdmFsdWVzIG9iamVjdCBkaXJlY3RseS4gVGhpcyBhdm9pZHMgdHJpZ2dlcmluZ1xuICAgICAgICAgICAgICAvLyBldmVudHMgd2hpY2ggYXJlIGJ1aWx0IGludG8gdGhlIHNldCBmdW5jdGlvbiBvZiB0aGUgcHJvcGVydHkuXG4gICAgICAgICAgICAgIGlmICh0aGlzLmRpc2FibGVldmVudHMpIHtcbiAgICAgICAgICAgICAgICBvYmplY3QuX192YWx1ZXNbZl0gPSBkYXR1bVtmXTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBvYmplY3RbZl0gPSBkYXR1bVtmXTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgICAgLy8gUG91Y2hEQiByZXZpc2lvbiAoaWYgdXNpbmcgc3RvcmFnZSBtb2R1bGUpLlxuICAgICAgICAgIC8vIFRPRE86IENhbiB0aGlzIGJlIHB1bGxlZCBvdXQgb2YgY29yZT9cbiAgICAgICAgICBpZiAoZGF0dW0uX3Jldikgb2JqZWN0Ll9yZXYgPSBkYXR1bS5fcmV2O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuICBfbWFwOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGVycjtcbiAgICB0aGlzLm1hcEF0dHJpYnV0ZXMoKTtcbiAgICB2YXIgcmVsYXRpb25zaGlwRmllbGRzID0gT2JqZWN0LmtleXMoc2VsZi5zdWJUYXNrUmVzdWx0cyk7XG4gICAgcmVsYXRpb25zaGlwRmllbGRzLmZvckVhY2goZnVuY3Rpb24oZikge1xuICAgICAgdmFyIHJlcyA9IHNlbGYuc3ViVGFza1Jlc3VsdHNbZl07XG4gICAgICB2YXIgaW5kZXhlcyA9IHJlcy5pbmRleGVzLFxuICAgICAgICBvYmplY3RzID0gcmVzLm9iamVjdHM7XG4gICAgICB2YXIgcmVsYXRlZERhdGEgPSBzZWxmLmdldFJlbGF0ZWREYXRhKGYpLnJlbGF0ZWREYXRhO1xuICAgICAgdmFyIHVuZmxhdHRlbmVkT2JqZWN0cyA9IHV0aWwudW5mbGF0dGVuQXJyYXkob2JqZWN0cywgcmVsYXRlZERhdGEpO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB1bmZsYXR0ZW5lZE9iamVjdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGlkeCA9IGluZGV4ZXNbaV07XG4gICAgICAgIC8vIEVycm9ycyBhcmUgcGx1Y2tlZCBmcm9tIHRoZSBzdWJvcGVyYXRpb25zLlxuICAgICAgICB2YXIgZXJyb3IgPSBzZWxmLmVycm9yc1tpZHhdO1xuICAgICAgICBlcnIgPSBlcnJvciA/IGVycm9yW2ZdIDogbnVsbDtcbiAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICB2YXIgcmVsYXRlZCA9IHVuZmxhdHRlbmVkT2JqZWN0c1tpXTsgLy8gQ2FuIGJlIGFycmF5IG9yIHNjYWxhci5cbiAgICAgICAgICB2YXIgb2JqZWN0ID0gc2VsZi5vYmplY3RzW2lkeF07XG4gICAgICAgICAgaWYgKG9iamVjdCkge1xuICAgICAgICAgICAgZXJyID0gb2JqZWN0Ll9fcHJveGllc1tmXS5zZXQocmVsYXRlZCwge2Rpc2FibGVldmVudHM6IHNlbGYuZGlzYWJsZWV2ZW50c30pO1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICBpZiAoIXNlbGYuZXJyb3JzW2lkeF0pIHNlbGYuZXJyb3JzW2lkeF0gPSB7fTtcbiAgICAgICAgICAgICAgc2VsZi5lcnJvcnNbaWR4XVtmXSA9IGVycjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcbiAgLyoqXG4gICAqIEZpZ3VyZSBvdXQgd2hpY2ggZGF0YSBpdGVtcyByZXF1aXJlIGEgY2FjaGUgbG9va3VwLlxuICAgKiBAcmV0dXJucyB7e3JlbW90ZUxvb2t1cHM6IEFycmF5LCBsb2NhbExvb2t1cHM6IEFycmF5fX1cbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9zb3J0TG9va3VwczogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHJlbW90ZUxvb2t1cHMgPSBbXTtcbiAgICB2YXIgbG9jYWxMb29rdXBzID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICghdGhpcy5vYmplY3RzW2ldKSB7XG4gICAgICAgIHZhciBsb29rdXA7XG4gICAgICAgIHZhciBkYXR1bSA9IHRoaXMuZGF0YVtpXTtcbiAgICAgICAgdmFyIGlzU2NhbGFyID0gdHlwZW9mIGRhdHVtID09ICdzdHJpbmcnIHx8IHR5cGVvZiBkYXR1bSA9PSAnbnVtYmVyJyB8fCBkYXR1bSBpbnN0YW5jZW9mIFN0cmluZztcbiAgICAgICAgaWYgKGRhdHVtKSB7XG4gICAgICAgICAgaWYgKGlzU2NhbGFyKSB7XG4gICAgICAgICAgICBsb29rdXAgPSB7XG4gICAgICAgICAgICAgIGluZGV4OiBpLFxuICAgICAgICAgICAgICBkYXR1bToge31cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBsb29rdXAuZGF0dW1bdGhpcy5tb2RlbC5pZF0gPSBkYXR1bTtcbiAgICAgICAgICAgIHJlbW90ZUxvb2t1cHMucHVzaChsb29rdXApO1xuICAgICAgICAgIH0gZWxzZSBpZiAoZGF0dW0gaW5zdGFuY2VvZiBNb2RlbEluc3RhbmNlKSB7IC8vIFdlIHdvbid0IG5lZWQgdG8gcGVyZm9ybSBhbnkgbWFwcGluZy5cbiAgICAgICAgICAgIHRoaXMub2JqZWN0c1tpXSA9IGRhdHVtO1xuICAgICAgICAgIH0gZWxzZSBpZiAoZGF0dW0ubG9jYWxJZCkge1xuICAgICAgICAgICAgbG9jYWxMb29rdXBzLnB1c2goe1xuICAgICAgICAgICAgICBpbmRleDogaSxcbiAgICAgICAgICAgICAgZGF0dW06IGRhdHVtXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGRhdHVtW3RoaXMubW9kZWwuaWRdKSB7XG4gICAgICAgICAgICByZW1vdGVMb29rdXBzLnB1c2goe1xuICAgICAgICAgICAgICBpbmRleDogaSxcbiAgICAgICAgICAgICAgZGF0dW06IGRhdHVtXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5vYmplY3RzW2ldID0gdGhpcy5faW5zdGFuY2UoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5vYmplY3RzW2ldID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4ge3JlbW90ZUxvb2t1cHM6IHJlbW90ZUxvb2t1cHMsIGxvY2FsTG9va3VwczogbG9jYWxMb29rdXBzfTtcbiAgfSxcbiAgX3BlcmZvcm1Mb2NhbExvb2t1cHM6IGZ1bmN0aW9uKGxvY2FsTG9va3Vwcykge1xuICAgIHZhciBsb2NhbElkZW50aWZpZXJzID0gdXRpbC5wbHVjayh1dGlsLnBsdWNrKGxvY2FsTG9va3VwcywgJ2RhdHVtJyksICdsb2NhbElkJyksXG4gICAgICBsb2NhbE9iamVjdHMgPSBjYWNoZS5nZXRWaWFMb2NhbElkKGxvY2FsSWRlbnRpZmllcnMpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbG9jYWxJZGVudGlmaWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIG9iaiA9IGxvY2FsT2JqZWN0c1tpXTtcbiAgICAgIHZhciBsb2NhbElkID0gbG9jYWxJZGVudGlmaWVyc1tpXTtcbiAgICAgIHZhciBsb29rdXAgPSBsb2NhbExvb2t1cHNbaV07XG4gICAgICBpZiAoIW9iaikge1xuICAgICAgICAvLyBJZiB0aGVyZSBhcmUgbXVsdGlwbGUgbWFwcGluZyBvcGVyYXRpb25zIGdvaW5nIG9uLCB0aGVyZSBtYXkgYmVcbiAgICAgICAgb2JqID0gY2FjaGUuZ2V0KHtsb2NhbElkOiBsb2NhbElkfSk7XG4gICAgICAgIGlmICghb2JqKSBvYmogPSB0aGlzLl9pbnN0YW5jZSh7bG9jYWxJZDogbG9jYWxJZH0sICF0aGlzLmRpc2FibGVldmVudHMpO1xuICAgICAgICB0aGlzLm9iamVjdHNbbG9va3VwLmluZGV4XSA9IG9iajtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMub2JqZWN0c1tsb29rdXAuaW5kZXhdID0gb2JqO1xuICAgICAgfVxuICAgIH1cblxuICB9LFxuICBfcGVyZm9ybVJlbW90ZUxvb2t1cHM6IGZ1bmN0aW9uKHJlbW90ZUxvb2t1cHMpIHtcbiAgICB2YXIgcmVtb3RlSWRlbnRpZmllcnMgPSB1dGlsLnBsdWNrKHV0aWwucGx1Y2socmVtb3RlTG9va3VwcywgJ2RhdHVtJyksIHRoaXMubW9kZWwuaWQpLFxuICAgICAgcmVtb3RlT2JqZWN0cyA9IGNhY2hlLmdldFZpYVJlbW90ZUlkKHJlbW90ZUlkZW50aWZpZXJzLCB7bW9kZWw6IHRoaXMubW9kZWx9KTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlbW90ZU9iamVjdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBvYmogPSByZW1vdGVPYmplY3RzW2ldLFxuICAgICAgICBsb29rdXAgPSByZW1vdGVMb29rdXBzW2ldO1xuICAgICAgaWYgKG9iaikge1xuICAgICAgICB0aGlzLm9iamVjdHNbbG9va3VwLmluZGV4XSA9IG9iajtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBkYXRhID0ge307XG4gICAgICAgIHZhciByZW1vdGVJZCA9IHJlbW90ZUlkZW50aWZpZXJzW2ldO1xuICAgICAgICBkYXRhW3RoaXMubW9kZWwuaWRdID0gcmVtb3RlSWQ7XG4gICAgICAgIHZhciBjYWNoZVF1ZXJ5ID0ge1xuICAgICAgICAgIG1vZGVsOiB0aGlzLm1vZGVsXG4gICAgICAgIH07XG4gICAgICAgIGNhY2hlUXVlcnlbdGhpcy5tb2RlbC5pZF0gPSByZW1vdGVJZDtcbiAgICAgICAgdmFyIGNhY2hlZCA9IGNhY2hlLmdldChjYWNoZVF1ZXJ5KTtcbiAgICAgICAgaWYgKGNhY2hlZCkge1xuICAgICAgICAgIHRoaXMub2JqZWN0c1tsb29rdXAuaW5kZXhdID0gY2FjaGVkO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMub2JqZWN0c1tsb29rdXAuaW5kZXhdID0gdGhpcy5faW5zdGFuY2UoKTtcbiAgICAgICAgICAvLyBJdCdzIGltcG9ydGFudCB0aGF0IHdlIG1hcCB0aGUgcmVtb3RlIGlkZW50aWZpZXIgaGVyZSB0byBlbnN1cmUgdGhhdCBpdCBlbmRzXG4gICAgICAgICAgLy8gdXAgaW4gdGhlIGNhY2hlLlxuICAgICAgICAgIHRoaXMub2JqZWN0c1tsb29rdXAuaW5kZXhdW3RoaXMubW9kZWwuaWRdID0gcmVtb3RlSWQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIC8qKlxuICAgKiBGb3IgaW5kaWNlcyB3aGVyZSBubyBvYmplY3QgaXMgcHJlc2VudCwgcGVyZm9ybSBjYWNoZSBsb29rdXBzLCBjcmVhdGluZyBhIG5ldyBvYmplY3QgaWYgbmVjZXNzYXJ5LlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2xvb2t1cDogZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMubW9kZWwuc2luZ2xldG9uKSB7XG4gICAgICB0aGlzLl9sb29rdXBTaW5nbGV0b24oKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICB2YXIgbG9va3VwcyA9IHRoaXMuX3NvcnRMb29rdXBzKCksXG4gICAgICAgIHJlbW90ZUxvb2t1cHMgPSBsb29rdXBzLnJlbW90ZUxvb2t1cHMsXG4gICAgICAgIGxvY2FsTG9va3VwcyA9IGxvb2t1cHMubG9jYWxMb29rdXBzO1xuICAgICAgdGhpcy5fcGVyZm9ybUxvY2FsTG9va3Vwcyhsb2NhbExvb2t1cHMpO1xuICAgICAgdGhpcy5fcGVyZm9ybVJlbW90ZUxvb2t1cHMocmVtb3RlTG9va3Vwcyk7XG4gICAgfVxuICB9LFxuICBfbG9va3VwU2luZ2xldG9uOiBmdW5jdGlvbigpIHtcbiAgICAvLyBQaWNrIGEgcmFuZG9tIGxvY2FsSWQgZnJvbSB0aGUgYXJyYXkgb2YgZGF0YSBiZWluZyBtYXBwZWQgb250byB0aGUgc2luZ2xldG9uIG9iamVjdC4gTm90ZSB0aGF0IHRoZXkgc2hvdWxkXG4gICAgLy8gYWx3YXlzIGJlIHRoZSBzYW1lLiBUaGlzIGlzIGp1c3QgYSBwcmVjYXV0aW9uLlxuICAgIHZhciBsb2NhbElkZW50aWZpZXJzID0gdXRpbC5wbHVjayh0aGlzLmRhdGEsICdsb2NhbElkJyksIGxvY2FsSWQ7XG4gICAgZm9yIChpID0gMDsgaSA8IGxvY2FsSWRlbnRpZmllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChsb2NhbElkZW50aWZpZXJzW2ldKSB7XG4gICAgICAgIGxvY2FsSWQgPSB7bG9jYWxJZDogbG9jYWxJZGVudGlmaWVyc1tpXX07XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBUaGUgbWFwcGluZyBvcGVyYXRpb24gaXMgcmVzcG9uc2libGUgZm9yIGNyZWF0aW5nIHNpbmdsZXRvbiBpbnN0YW5jZXMgaWYgdGhleSBkbyBub3QgYWxyZWFkeSBleGlzdC5cbiAgICB2YXIgc2luZ2xldG9uID0gY2FjaGUuZ2V0U2luZ2xldG9uKHRoaXMubW9kZWwpIHx8IHRoaXMuX2luc3RhbmNlKGxvY2FsSWQpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5kYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICB0aGlzLm9iamVjdHNbaV0gPSBzaW5nbGV0b247XG4gICAgfVxuICB9LFxuICBfaW5zdGFuY2U6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBtb2RlbCA9IHRoaXMubW9kZWwsXG4gICAgICBtb2RlbEluc3RhbmNlID0gbW9kZWwuX2luc3RhbmNlLmFwcGx5KG1vZGVsLCBhcmd1bWVudHMpO1xuICAgIHRoaXMuX25ld09iamVjdHMucHVzaChtb2RlbEluc3RhbmNlKTtcbiAgICByZXR1cm4gbW9kZWxJbnN0YW5jZTtcbiAgfSxcblxuICBwcmVwcm9jZXNzRGF0YTogZnVuY3Rpb24oKSB7XG4gICAgdmFyIGRhdGEgPSB1dGlsLmV4dGVuZChbXSwgdGhpcy5kYXRhKTtcbiAgICByZXR1cm4gZGF0YS5tYXAoZnVuY3Rpb24oZGF0dW0pIHtcbiAgICAgIGlmIChkYXR1bSkge1xuICAgICAgICBpZiAoIXV0aWwuaXNTdHJpbmcoZGF0dW0pKSB7XG4gICAgICAgICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhkYXR1bSk7XG4gICAgICAgICAga2V5cy5mb3JFYWNoKGZ1bmN0aW9uKGspIHtcbiAgICAgICAgICAgIHZhciBpc1JlbGF0aW9uc2hpcCA9IHRoaXMubW9kZWwuX3JlbGF0aW9uc2hpcE5hbWVzLmluZGV4T2YoaykgPiAtMTtcblxuICAgICAgICAgICAgaWYgKGlzUmVsYXRpb25zaGlwKSB7XG4gICAgICAgICAgICAgIHZhciB2YWwgPSBkYXR1bVtrXTtcbiAgICAgICAgICAgICAgaWYgKHZhbCBpbnN0YW5jZW9mIE1vZGVsSW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICBkYXR1bVtrXSA9IHtsb2NhbElkOiB2YWwubG9jYWxJZH07XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBkYXR1bTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuICBzdGFydDogZnVuY3Rpb24oZG9uZSkge1xuICAgIHZhciBkYXRhID0gdGhpcy5kYXRhO1xuICAgIGlmIChkYXRhLmxlbmd0aCkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgdmFyIHRhc2tzID0gW107XG4gICAgICB0aGlzLl9sb29rdXAoKTtcbiAgICAgIHRhc2tzLnB1c2godGhpcy5fZXhlY3V0ZVN1Yk9wZXJhdGlvbnMuYmluZCh0aGlzKSk7XG4gICAgICB1dGlsLnBhcmFsbGVsKHRhc2tzLCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgaWYgKGVycikgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAgICBzZWxmLl9tYXAoKTtcbiAgICAgICAgLy8gVXNlcnMgYXJlIGFsbG93ZWQgdG8gYWRkIGEgY3VzdG9tIGluaXQgbWV0aG9kIHRvIHRoZSBtZXRob2RzIG9iamVjdCB3aGVuIGRlZmluaW5nIGEgTW9kZWwsIG9mIHRoZSBmb3JtOlxuICAgICAgICAvL1xuICAgICAgICAvL1xuICAgICAgICAvLyBpbml0OiBmdW5jdGlvbiAoW2RvbmVdKSB7XG4gICAgICAgIC8vICAgICAvLyAuLi5cbiAgICAgICAgLy8gIH1cbiAgICAgICAgLy9cbiAgICAgICAgLy9cbiAgICAgICAgLy8gSWYgZG9uZSBpcyBwYXNzZWQsIHRoZW4gX19pbml0IG11c3QgYmUgZXhlY3V0ZWQgYXN5bmNocm9ub3VzbHksIGFuZCB0aGUgbWFwcGluZyBvcGVyYXRpb24gd2lsbCBub3RcbiAgICAgICAgLy8gZmluaXNoIHVudGlsIGFsbCBpbml0cyBoYXZlIGV4ZWN1dGVkLlxuICAgICAgICAvL1xuICAgICAgICAvLyBIZXJlIHdlIGVuc3VyZSB0aGUgZXhlY3V0aW9uIG9mIGFsbCBvZiB0aGVtXG4gICAgICAgIHZhciBmcm9tU3RvcmFnZSA9IHRoaXMuZnJvbVN0b3JhZ2U7XG4gICAgICAgIHZhciBpbml0VGFza3MgPSBzZWxmLl9uZXdPYmplY3RzLnJlZHVjZShmdW5jdGlvbihtZW1vLCBvKSB7XG4gICAgICAgICAgdmFyIGluaXQgPSBvLm1vZGVsLmluaXQ7XG4gICAgICAgICAgaWYgKGluaXQpIHtcbiAgICAgICAgICAgIHZhciBwYXJhbU5hbWVzID0gdXRpbC5wYXJhbU5hbWVzKGluaXQpO1xuICAgICAgICAgICAgaWYgKHBhcmFtTmFtZXMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICBtZW1vLnB1c2goaW5pdC5iaW5kKG8sIGZyb21TdG9yYWdlLCBkb25lKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgaW5pdC5jYWxsKG8sIGZyb21TdG9yYWdlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgby5fZW1pdEV2ZW50cyA9IHRydWU7XG4gICAgICAgICAgby5fZW1pdE5ldygpO1xuICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICB9LCBbXSk7XG4gICAgICAgIHV0aWwucGFyYWxsZWwoaW5pdFRhc2tzLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICBkb25lKHNlbGYuZXJyb3JzLmxlbmd0aCA/IHNlbGYuZXJyb3JzIDogbnVsbCwgc2VsZi5vYmplY3RzKTtcbiAgICAgICAgfSk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0gZWxzZSB7XG4gICAgICBkb25lKG51bGwsIFtdKTtcbiAgICB9XG4gIH0sXG4gIGdldFJlbGF0ZWREYXRhOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIGluZGV4ZXMgPSBbXTtcbiAgICB2YXIgcmVsYXRlZERhdGEgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGRhdHVtID0gdGhpcy5kYXRhW2ldO1xuICAgICAgaWYgKGRhdHVtKSB7XG4gICAgICAgIHZhciB2YWwgPSBkYXR1bVtuYW1lXTtcbiAgICAgICAgaWYgKHZhbCkge1xuICAgICAgICAgIGluZGV4ZXMucHVzaChpKTtcbiAgICAgICAgICByZWxhdGVkRGF0YS5wdXNoKHZhbCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIGluZGV4ZXM6IGluZGV4ZXMsXG4gICAgICByZWxhdGVkRGF0YTogcmVsYXRlZERhdGFcbiAgICB9O1xuICB9XG4gICxcbiAgcHJvY2Vzc0Vycm9yc0Zyb21UYXNrOiBmdW5jdGlvbihyZWxhdGlvbnNoaXBOYW1lLCBlcnJvcnMsIGluZGV4ZXMpIHtcbiAgICBpZiAoZXJyb3JzLmxlbmd0aCkge1xuICAgICAgdmFyIHJlbGF0ZWREYXRhID0gdGhpcy5nZXRSZWxhdGVkRGF0YShyZWxhdGlvbnNoaXBOYW1lKS5yZWxhdGVkRGF0YTtcbiAgICAgIHZhciB1bmZsYXR0ZW5lZEVycm9ycyA9IHV0aWwudW5mbGF0dGVuQXJyYXkoZXJyb3JzLCByZWxhdGVkRGF0YSk7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHVuZmxhdHRlbmVkRXJyb3JzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBpZHggPSBpbmRleGVzW2ldO1xuICAgICAgICB2YXIgZXJyID0gdW5mbGF0dGVuZWRFcnJvcnNbaV07XG4gICAgICAgIHZhciBpc0Vycm9yID0gZXJyO1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KGVycikpIGlzRXJyb3IgPSBlcnIucmVkdWNlKGZ1bmN0aW9uKG1lbW8sIHgpIHtcbiAgICAgICAgICByZXR1cm4gbWVtbyB8fCB4XG4gICAgICAgIH0sIGZhbHNlKTtcbiAgICAgICAgaWYgKGlzRXJyb3IpIHtcbiAgICAgICAgICBpZiAoIXRoaXMuZXJyb3JzW2lkeF0pIHRoaXMuZXJyb3JzW2lkeF0gPSB7fTtcbiAgICAgICAgICB0aGlzLmVycm9yc1tpZHhdW3JlbGF0aW9uc2hpcE5hbWVdID0gZXJyO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuICBfZXhlY3V0ZVN1Yk9wZXJhdGlvbnM6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgcmVsYXRpb25zaGlwTmFtZXMgPSBPYmplY3Qua2V5cyh0aGlzLm1vZGVsLnJlbGF0aW9uc2hpcHMpO1xuICAgIGlmIChyZWxhdGlvbnNoaXBOYW1lcy5sZW5ndGgpIHtcbiAgICAgIHZhciB0YXNrcyA9IHJlbGF0aW9uc2hpcE5hbWVzLnJlZHVjZShmdW5jdGlvbihtLCByZWxhdGlvbnNoaXBOYW1lKSB7XG4gICAgICAgIHZhciByZWxhdGlvbnNoaXAgPSBzZWxmLm1vZGVsLnJlbGF0aW9uc2hpcHNbcmVsYXRpb25zaGlwTmFtZV07XG4gICAgICAgIHZhciByZXZlcnNlTW9kZWwgPSByZWxhdGlvbnNoaXAuZm9yd2FyZE5hbWUgPT0gcmVsYXRpb25zaGlwTmFtZSA/IHJlbGF0aW9uc2hpcC5yZXZlcnNlTW9kZWwgOiByZWxhdGlvbnNoaXAuZm9yd2FyZE1vZGVsO1xuICAgICAgICAvLyBNb2NrIGFueSBtaXNzaW5nIHNpbmdsZXRvbiBkYXRhIHRvIGVuc3VyZSB0aGF0IGFsbCBzaW5nbGV0b24gaW5zdGFuY2VzIGFyZSBjcmVhdGVkLlxuICAgICAgICBpZiAocmV2ZXJzZU1vZGVsLnNpbmdsZXRvbiAmJiAhcmVsYXRpb25zaGlwLmlzUmV2ZXJzZSkge1xuICAgICAgICAgIHRoaXMuZGF0YS5mb3JFYWNoKGZ1bmN0aW9uKGRhdHVtKSB7XG4gICAgICAgICAgICBpZiAoIWRhdHVtW3JlbGF0aW9uc2hpcE5hbWVdKSBkYXR1bVtyZWxhdGlvbnNoaXBOYW1lXSA9IHt9O1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHZhciBfX3JldCA9IHRoaXMuZ2V0UmVsYXRlZERhdGEocmVsYXRpb25zaGlwTmFtZSksXG4gICAgICAgICAgaW5kZXhlcyA9IF9fcmV0LmluZGV4ZXMsXG4gICAgICAgICAgcmVsYXRlZERhdGEgPSBfX3JldC5yZWxhdGVkRGF0YTtcbiAgICAgICAgaWYgKHJlbGF0ZWREYXRhLmxlbmd0aCkge1xuICAgICAgICAgIHZhciBmbGF0UmVsYXRlZERhdGEgPSB1dGlsLmZsYXR0ZW5BcnJheShyZWxhdGVkRGF0YSk7XG4gICAgICAgICAgdmFyIG9wID0gbmV3IE1hcHBpbmdPcGVyYXRpb24oe1xuICAgICAgICAgICAgbW9kZWw6IHJldmVyc2VNb2RlbCxcbiAgICAgICAgICAgIGRhdGE6IGZsYXRSZWxhdGVkRGF0YSxcbiAgICAgICAgICAgIGRpc2FibGVldmVudHM6IHNlbGYuZGlzYWJsZWV2ZW50cyxcbiAgICAgICAgICAgIF9pZ25vcmVJbnN0YWxsZWQ6IHNlbGYuX2lnbm9yZUluc3RhbGxlZCxcbiAgICAgICAgICAgIGZyb21TdG9yYWdlOiB0aGlzLmZyb21TdG9yYWdlXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3ApIHtcbiAgICAgICAgICB2YXIgdGFzaztcbiAgICAgICAgICB0YXNrID0gZnVuY3Rpb24oZG9uZSkge1xuICAgICAgICAgICAgb3Auc3RhcnQoZnVuY3Rpb24oZXJyb3JzLCBvYmplY3RzKSB7XG4gICAgICAgICAgICAgIHNlbGYuc3ViVGFza1Jlc3VsdHNbcmVsYXRpb25zaGlwTmFtZV0gPSB7XG4gICAgICAgICAgICAgICAgZXJyb3JzOiBlcnJvcnMsXG4gICAgICAgICAgICAgICAgb2JqZWN0czogb2JqZWN0cyxcbiAgICAgICAgICAgICAgICBpbmRleGVzOiBpbmRleGVzXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgIHNlbGYucHJvY2Vzc0Vycm9yc0Zyb21UYXNrKHJlbGF0aW9uc2hpcE5hbWUsIG9wLmVycm9ycywgaW5kZXhlcyk7XG4gICAgICAgICAgICAgIGRvbmUoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH07XG4gICAgICAgICAgbS5wdXNoKHRhc2spO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtO1xuICAgICAgfS5iaW5kKHRoaXMpLCBbXSk7XG4gICAgICB1dGlsLnBhcmFsbGVsKHRhc2tzLCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYWxsYmFjaygpO1xuICAgIH1cbiAgfVxufSlcbjtcblxubW9kdWxlLmV4cG9ydHMgPSBNYXBwaW5nT3BlcmF0aW9uO1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL21hcHBpbmdPcGVyYXRpb24uanNcbiAqKiBtb2R1bGUgaWQgPSAxOVxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiaWYgKHR5cGVvZiBzaWVzdGEgPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIG1vZHVsZSA9PSAndW5kZWZpbmVkJykge1xuICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIHdpbmRvdy5zaWVzdGEuIE1ha2Ugc3VyZSB5b3UgaW5jbHVkZSBzaWVzdGEuY29yZS5qcyBmaXJzdC4nKTtcbn1cblxudmFyIF9pID0gc2llc3RhLl9pbnRlcm5hbCxcbiAgY2FjaGUgPSBfaS5jYWNoZSxcbiAgQ29sbGVjdGlvblJlZ2lzdHJ5ID0gX2kuQ29sbGVjdGlvblJlZ2lzdHJ5LFxuICBsb2cgPSBfaS5sb2coJ3N0b3JhZ2UnKSxcbiAgZXJyb3IgPSBfaS5lcnJvcixcbiAgdXRpbCA9IF9pLnV0aWwsXG4gIGV2ZW50cyA9IF9pLmV2ZW50cztcblxudmFyIHVuc2F2ZWRPYmplY3RzID0gW10sXG4gIHVuc2F2ZWRPYmplY3RzSGFzaCA9IHt9LFxuICB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbiA9IHt9O1xuXG52YXIgc3RvcmFnZSA9IHt9O1xuXG4vLyBWYXJpYWJsZXMgYmVnaW5uaW5nIHdpdGggdW5kZXJzY29yZSBhcmUgdHJlYXRlZCBhcyBzcGVjaWFsIGJ5IFBvdWNoREIvQ291Y2hEQiBzbyB3aGVuIHNlcmlhbGlzaW5nIHdlIG5lZWQgdG9cbi8vIHJlcGxhY2Ugd2l0aCBzb21ldGhpbmcgZWxzZS5cbnZhciBVTkRFUlNDT1JFID0gL18vZyxcbiAgVU5ERVJTQ09SRV9SRVBMQUNFTUVOVCA9IC9AL2c7XG5cbmZ1bmN0aW9uIF9pbml0TWV0YSgpIHtcbiAgcmV0dXJuIHtkYXRlRmllbGRzOiBbXX07XG59XG5cbmZ1bmN0aW9uIGZ1bGx5UXVhbGlmaWVkTW9kZWxOYW1lKGNvbGxlY3Rpb25OYW1lLCBtb2RlbE5hbWUpIHtcbiAgcmV0dXJuIGNvbGxlY3Rpb25OYW1lICsgJy4nICsgbW9kZWxOYW1lO1xufVxuXG5pZiAodHlwZW9mIFBvdWNoREIgPT0gJ3VuZGVmaW5lZCcpIHtcbiAgc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCA9IGZhbHNlO1xuICBjb25zb2xlLmxvZygnUG91Y2hEQiBpcyBub3QgcHJlc2VudCB0aGVyZWZvcmUgc3RvcmFnZSBpcyBkaXNhYmxlZC4nKTtcbn1cbmVsc2Uge1xuICB2YXIgREJfTkFNRSA9ICdzaWVzdGEnLFxuICAgIHBvdWNoID0gbmV3IFBvdWNoREIoREJfTkFNRSwge2F1dG9fY29tcGFjdGlvbjogdHJ1ZX0pO1xuXG4gIC8qKlxuICAgKiBTb21ldGltZXMgc2llc3RhIG5lZWRzIHRvIHN0b3JlIHNvbWUgZXh0cmEgaW5mb3JtYXRpb24gYWJvdXQgdGhlIG1vZGVsIGluc3RhbmNlLlxuICAgKiBAcGFyYW0gc2VyaWFsaXNlZFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgZnVuY3Rpb24gX2FkZE1ldGEoc2VyaWFsaXNlZCkge1xuICAgIC8vIFBvdWNoREIgPD0gMy4yLjEgaGFzIGEgYnVnIHdoZXJlYnkgZGF0ZSBmaWVsZHMgYXJlIG5vdCBkZXNlcmlhbGlzZWQgcHJvcGVybHkgaWYgeW91IHVzZSBkYi5xdWVyeVxuICAgIC8vIHRoZXJlZm9yZSB3ZSBuZWVkIHRvIGFkZCBleHRyYSBpbmZvIHRvIHRoZSBvYmplY3QgZm9yIGRlc2VyaWFsaXNpbmcgZGF0ZXMgbWFudWFsbHkuXG4gICAgc2VyaWFsaXNlZC5zaWVzdGFfbWV0YSA9IF9pbml0TWV0YSgpO1xuICAgIGZvciAodmFyIHByb3AgaW4gc2VyaWFsaXNlZCkge1xuICAgICAgaWYgKHNlcmlhbGlzZWQuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgaWYgKHNlcmlhbGlzZWRbcHJvcF0gaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICAgICAgc2VyaWFsaXNlZC5zaWVzdGFfbWV0YS5kYXRlRmllbGRzLnB1c2gocHJvcCk7XG4gICAgICAgICAgc2VyaWFsaXNlZFtwcm9wXSA9IHNlcmlhbGlzZWRbcHJvcF0uZ2V0VGltZSgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gX3Byb2Nlc3NNZXRhKGRhdHVtKSB7XG4gICAgdmFyIG1ldGEgPSBkYXR1bS5zaWVzdGFfbWV0YSB8fCBfaW5pdE1ldGEoKTtcbiAgICBtZXRhLmRhdGVGaWVsZHMuZm9yRWFjaChmdW5jdGlvbihkYXRlRmllbGQpIHtcbiAgICAgIHZhciB2YWx1ZSA9IGRhdHVtW2RhdGVGaWVsZF07XG4gICAgICBpZiAoISh2YWx1ZSBpbnN0YW5jZW9mIERhdGUpKSB7XG4gICAgICAgIGRhdHVtW2RhdGVGaWVsZF0gPSBuZXcgRGF0ZSh2YWx1ZSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgZGVsZXRlIGRhdHVtLnNpZXN0YV9tZXRhO1xuICB9XG5cbiAgZnVuY3Rpb24gY29uc3RydWN0SW5kZXhEZXNpZ25Eb2MoY29sbGVjdGlvbk5hbWUsIG1vZGVsTmFtZSkge1xuICAgIHZhciBmdWxseVF1YWxpZmllZE5hbWUgPSBmdWxseVF1YWxpZmllZE1vZGVsTmFtZShjb2xsZWN0aW9uTmFtZSwgbW9kZWxOYW1lKTtcbiAgICB2YXIgdmlld3MgPSB7fTtcbiAgICB2aWV3c1tmdWxseVF1YWxpZmllZE5hbWVdID0ge1xuICAgICAgbWFwOiBmdW5jdGlvbihkb2MpIHtcbiAgICAgICAgaWYgKGRvYy5jb2xsZWN0aW9uID09ICckMScgJiYgZG9jLm1vZGVsID09ICckMicpIGVtaXQoZG9jLmNvbGxlY3Rpb24gKyAnLicgKyBkb2MubW9kZWwsIGRvYyk7XG4gICAgICB9LnRvU3RyaW5nKCkucmVwbGFjZSgnJDEnLCBjb2xsZWN0aW9uTmFtZSkucmVwbGFjZSgnJDInLCBtb2RlbE5hbWUpXG4gICAgfTtcbiAgICByZXR1cm4ge1xuICAgICAgX2lkOiAnX2Rlc2lnbi8nICsgZnVsbHlRdWFsaWZpZWROYW1lLFxuICAgICAgdmlld3M6IHZpZXdzXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFbnN1cmUgdGhhdCB0aGUgUG91Y2hEQiBpbmRleCBmb3IgdGhlIGdpdmVuIG1vZGVsIGV4aXN0cywgY3JlYXRpbmcgaXQgaWYgbm90LlxuICAgKiBAcGFyYW0gbW9kZWxcbiAgICogQHBhcmFtIGNiXG4gICAqL1xuICBmdW5jdGlvbiBlbnN1cmVJbmRleEluc3RhbGxlZChtb2RlbCwgY2IpIHtcbiAgICBmdW5jdGlvbiBmbihyZXNwKSB7XG4gICAgICB2YXIgZXJyO1xuICAgICAgaWYgKCFyZXNwLm9rKSB7XG4gICAgICAgIGlmIChyZXNwLnN0YXR1cyA9PSA0MDkpIHtcbiAgICAgICAgICBlcnIgPSBudWxsO1xuICAgICAgICAgIG1vZGVsLmluZGV4SW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgY2IoZXJyKTtcbiAgICB9XG5cbiAgICBwb3VjaFxuICAgICAgLnB1dChjb25zdHJ1Y3RJbmRleERlc2lnbkRvYyhtb2RlbC5jb2xsZWN0aW9uTmFtZSwgbW9kZWwubmFtZSkpXG4gICAgICAudGhlbihmbilcbiAgICAgIC5jYXRjaChmbik7XG4gIH1cblxuICBmdW5jdGlvbiBnZXRBbGxNb2RlbHMoKSB7XG4gICAgdmFyIGFsbE1vZGVscyA9IFtdO1xuICAgIHZhciByZWdpc3RyeSA9IHNpZXN0YS5faW50ZXJuYWwuQ29sbGVjdGlvblJlZ2lzdHJ5O1xuICAgIHJlZ2lzdHJ5LmNvbGxlY3Rpb25OYW1lcy5mb3JFYWNoKGZ1bmN0aW9uKGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICB2YXIgY29sbCA9IHJlZ2lzdHJ5W2NvbGxlY3Rpb25OYW1lXTtcbiAgICAgIHZhciBtb2RlbHMgPSBjb2xsLl9tb2RlbHM7XG4gICAgICBmb3IgKHZhciBtb2RlbE5hbWUgaW4gbW9kZWxzKSB7XG4gICAgICAgIGlmIChtb2RlbHMuaGFzT3duUHJvcGVydHkobW9kZWxOYW1lKSkge1xuICAgICAgICAgIHZhciBtb2RlbCA9IGNvbGxbbW9kZWxOYW1lXTtcbiAgICAgICAgICBhbGxNb2RlbHMucHVzaChtb2RlbCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gYWxsTW9kZWxzO1xuICB9XG5cbiAgZnVuY3Rpb24gY29uc3RydWN0SW5kZXhlc0ZvckFsbE1vZGVscyhtb2RlbHMpIHtcbiAgICByZXR1cm4gbW9kZWxzLm1hcChmdW5jdGlvbihtb2RlbCkge1xuICAgICAgcmV0dXJuIGNvbnN0cnVjdEluZGV4RGVzaWduRG9jKG1vZGVsLmNvbGxlY3Rpb25OYW1lLCBtb2RlbC5uYW1lKTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIF9fZW5zdXJlSW5kZXhlcyhpbmRleGVzLCBjYikge1xuICAgIGZ1bmN0aW9uIGZuKHJlc3ApIHtcbiAgICAgIHZhciBlcnJvcnMgPSBbXTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVzcC5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgcmVzcG9uc2UgPSByZXNwW2ldO1xuICAgICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgICAgLy8gQ29uZmxpY3QgbWVhbnMgYWxyZWFkeSBleGlzdHMsIGFuZCB0aGlzIGlzIGZpbmUhXG4gICAgICAgICAgdmFyIGlzQ29uZmxpY3QgPSByZXNwb25zZS5zdGF0dXMgPT0gNDA5O1xuICAgICAgICAgIGlmICghaXNDb25mbGljdCkgZXJyb3JzLnB1c2gocmVzcG9uc2UpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjYihlcnJvcnMubGVuZ3RoID8gZXJyb3IoJ211bHRpcGxlIGVycm9ycycsIHtlcnJvcnM6IGVycm9yc30pIDogbnVsbCk7XG4gICAgfVxuXG4gICAgcG91Y2hcbiAgICAgIC5idWxrRG9jcyhpbmRleGVzKVxuICAgICAgLnRoZW4oZm4pXG4gICAgICAuY2F0Y2goZm4pO1xuICB9XG5cbiAgZnVuY3Rpb24gZW5zdXJlSW5kZXhlc0ZvckFsbChjYikge1xuICAgIHZhciBtb2RlbHMgPSBnZXRBbGxNb2RlbHMoKTtcbiAgICB2YXIgaW5kZXhlcyA9IGNvbnN0cnVjdEluZGV4ZXNGb3JBbGxNb2RlbHMobW9kZWxzKTtcbiAgICBfX2Vuc3VyZUluZGV4ZXMoaW5kZXhlcywgY2IpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlcmlhbGlzZSBhIG1vZGVsIGludG8gYSBmb3JtYXQgdGhhdCBQb3VjaERCIGJ1bGtEb2NzIEFQSSBjYW4gcHJvY2Vzc1xuICAgKiBAcGFyYW0ge01vZGVsSW5zdGFuY2V9IG1vZGVsSW5zdGFuY2VcbiAgICovXG4gIGZ1bmN0aW9uIF9zZXJpYWxpc2UobW9kZWxJbnN0YW5jZSkge1xuICAgIHZhciBzZXJpYWxpc2VkID0ge307XG4gICAgdmFyIF9fdmFsdWVzID0gbW9kZWxJbnN0YW5jZS5fX3ZhbHVlcztcbiAgICBzZXJpYWxpc2VkID0gdXRpbC5leHRlbmQoc2VyaWFsaXNlZCwgX192YWx1ZXMpO1xuICAgIE9iamVjdC5rZXlzKHNlcmlhbGlzZWQpLmZvckVhY2goZnVuY3Rpb24oaykge1xuICAgICAgc2VyaWFsaXNlZFtrLnJlcGxhY2UoVU5ERVJTQ09SRSwgJ0AnKV0gPSBfX3ZhbHVlc1trXTtcbiAgICB9KTtcbiAgICBfYWRkTWV0YShzZXJpYWxpc2VkKTtcbiAgICBzZXJpYWxpc2VkWydjb2xsZWN0aW9uJ10gPSBtb2RlbEluc3RhbmNlLmNvbGxlY3Rpb25OYW1lO1xuICAgIHNlcmlhbGlzZWRbJ21vZGVsJ10gPSBtb2RlbEluc3RhbmNlLm1vZGVsTmFtZTtcbiAgICBzZXJpYWxpc2VkWydfaWQnXSA9IG1vZGVsSW5zdGFuY2UubG9jYWxJZDtcbiAgICBpZiAobW9kZWxJbnN0YW5jZS5yZW1vdmVkKSBzZXJpYWxpc2VkWydfZGVsZXRlZCddID0gdHJ1ZTtcbiAgICB2YXIgcmV2ID0gbW9kZWxJbnN0YW5jZS5fcmV2O1xuICAgIGlmIChyZXYpIHNlcmlhbGlzZWRbJ19yZXYnXSA9IHJldjtcbiAgICBzZXJpYWxpc2VkID0gbW9kZWxJbnN0YW5jZS5fcmVsYXRpb25zaGlwTmFtZXMucmVkdWNlKGZ1bmN0aW9uKG1lbW8sIG4pIHtcbiAgICAgIHZhciB2YWwgPSBtb2RlbEluc3RhbmNlW25dO1xuICAgICAgaWYgKHNpZXN0YS5pc0FycmF5KHZhbCkpIHtcbiAgICAgICAgbWVtb1tuXSA9IHV0aWwucGx1Y2sodmFsLCAnbG9jYWxJZCcpO1xuICAgICAgfVxuICAgICAgZWxzZSBpZiAodmFsKSB7XG4gICAgICAgIG1lbW9bbl0gPSB2YWwubG9jYWxJZDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtZW1vO1xuICAgIH0sIHNlcmlhbGlzZWQpO1xuICAgIHJldHVybiBzZXJpYWxpc2VkO1xuICB9XG5cbiAgZnVuY3Rpb24gX3ByZXBhcmVEYXR1bShyYXdEYXR1bSwgbW9kZWwpIHtcbiAgICBfcHJvY2Vzc01ldGEocmF3RGF0dW0pO1xuICAgIGRlbGV0ZSByYXdEYXR1bS5jb2xsZWN0aW9uO1xuICAgIGRlbGV0ZSByYXdEYXR1bS5tb2RlbDtcbiAgICByYXdEYXR1bS5sb2NhbElkID0gcmF3RGF0dW0uX2lkO1xuICAgIGRlbGV0ZSByYXdEYXR1bS5faWQ7XG4gICAgdmFyIGRhdHVtID0ge307XG4gICAgT2JqZWN0LmtleXMocmF3RGF0dW0pLmZvckVhY2goZnVuY3Rpb24oaykge1xuICAgICAgZGF0dW1bay5yZXBsYWNlKFVOREVSU0NPUkVfUkVQTEFDRU1FTlQsICdfJyldID0gcmF3RGF0dW1ba107XG4gICAgfSk7XG5cbiAgICB2YXIgcmVsYXRpb25zaGlwTmFtZXMgPSBtb2RlbC5fcmVsYXRpb25zaGlwTmFtZXM7XG4gICAgcmVsYXRpb25zaGlwTmFtZXMuZm9yRWFjaChmdW5jdGlvbihyKSB7XG4gICAgICB2YXIgbG9jYWxJZCA9IGRhdHVtW3JdO1xuICAgICAgaWYgKGxvY2FsSWQpIHtcbiAgICAgICAgaWYgKHNpZXN0YS5pc0FycmF5KGxvY2FsSWQpKSB7XG4gICAgICAgICAgZGF0dW1bcl0gPSBsb2NhbElkLm1hcChmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICByZXR1cm4ge2xvY2FsSWQ6IHh9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgZGF0dW1bcl0gPSB7bG9jYWxJZDogbG9jYWxJZH07XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgIH0pO1xuICAgIHJldHVybiBkYXR1bTtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKiBAcGFyYW0gb3B0c1xuICAgKiBAcGFyYW0gW29wdHMuY29sbGVjdGlvbk5hbWVdXG4gICAqIEBwYXJhbSBbb3B0cy5tb2RlbE5hbWVdXG4gICAqIEBwYXJhbSBbb3B0cy5tb2RlbF1cbiAgICogQHBhcmFtIGNhbGxiYWNrXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBmdW5jdGlvbiBsb2FkTW9kZWwob3B0cywgY2FsbGJhY2spIHtcbiAgICB2YXIgbG9hZGVkID0ge307XG4gICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gb3B0cy5jb2xsZWN0aW9uTmFtZSxcbiAgICAgIG1vZGVsTmFtZSA9IG9wdHMubW9kZWxOYW1lLFxuICAgICAgbW9kZWwgPSBvcHRzLm1vZGVsO1xuICAgIGlmIChtb2RlbCkge1xuICAgICAgY29sbGVjdGlvbk5hbWUgPSBtb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgIG1vZGVsTmFtZSA9IG1vZGVsLm5hbWU7XG4gICAgfVxuICAgIHZhciBmdWxseVF1YWxpZmllZE5hbWUgPSBmdWxseVF1YWxpZmllZE1vZGVsTmFtZShjb2xsZWN0aW9uTmFtZSwgbW9kZWxOYW1lKTtcbiAgICB2YXIgTW9kZWwgPSBDb2xsZWN0aW9uUmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV07XG4gICAgcG91Y2gucXVlcnkoZnVsbHlRdWFsaWZpZWROYW1lKVxuICAgICAgLnRoZW4oZnVuY3Rpb24ocmVzcCkge1xuICAgICAgICBsb2coJ1F1ZXJpZWQgcG91Y2ggc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgIHZhciByb3dzID0gcmVzcC5yb3dzO1xuICAgICAgICB2YXIgZGF0YSA9IHV0aWwucGx1Y2socm93cywgJ3ZhbHVlJykubWFwKGZ1bmN0aW9uKGRhdHVtKSB7XG4gICAgICAgICAgcmV0dXJuIF9wcmVwYXJlRGF0dW0oZGF0dW0sIE1vZGVsKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZGF0YS5tYXAoZnVuY3Rpb24oZGF0dW0pIHtcbiAgICAgICAgICB2YXIgcmVtb3RlSWQgPSBkYXR1bVtNb2RlbC5pZF07XG4gICAgICAgICAgaWYgKHJlbW90ZUlkKSB7XG4gICAgICAgICAgICBpZiAobG9hZGVkW3JlbW90ZUlkXSkge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdEdXBsaWNhdGVzIGRldGVjdGVkIGluIHN0b3JhZ2UuIFlvdSBoYXZlIGVuY291bnRlcmVkIGEgc2VyaW91cyBidWcuIFBsZWFzZSByZXBvcnQgdGhpcy4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICBsb2FkZWRbcmVtb3RlSWRdID0gZGF0dW07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBsb2coJ01hcHBpbmcgZGF0YScsIGRhdGEpO1xuXG4gICAgICAgIE1vZGVsLmdyYXBoKGRhdGEsIHtcbiAgICAgICAgICBfaWdub3JlSW5zdGFsbGVkOiB0cnVlLFxuICAgICAgICAgIGZyb21TdG9yYWdlOiB0cnVlXG4gICAgICAgIH0sIGZ1bmN0aW9uKGVyciwgaW5zdGFuY2VzKSB7XG4gICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgIGlmIChsb2cuZW5hYmxlZClcbiAgICAgICAgICAgICAgbG9nKCdMb2FkZWQgJyArIGluc3RhbmNlcyA/IGluc3RhbmNlcy5sZW5ndGgudG9TdHJpbmcoKSA6IDAgKyAnIGluc3RhbmNlcyBmb3IgJyArIGZ1bGx5UXVhbGlmaWVkTmFtZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbG9nKCdFcnJvciBsb2FkaW5nIG1vZGVscycsIGVycik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNhbGxiYWNrKGVyciwgaW5zdGFuY2VzKTtcbiAgICAgICAgfSk7XG4gICAgICB9KVxuICAgICAgLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgfSk7XG5cbiAgfVxuXG4gIC8qKlxuICAgKiBMb2FkIGFsbCBkYXRhIGZyb20gUG91Y2hEQi5cbiAgICovXG4gIGZ1bmN0aW9uIF9sb2FkKGNiKSB7XG4gICAgaWYgKHNhdmluZykgdGhyb3cgbmV3IEVycm9yKCdub3QgbG9hZGVkIHlldCBob3cgY2FuIGkgc2F2ZScpO1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkge1xuICAgICAgICB2YXIgY29sbGVjdGlvbk5hbWVzID0gQ29sbGVjdGlvblJlZ2lzdHJ5LmNvbGxlY3Rpb25OYW1lcztcbiAgICAgICAgdmFyIHRhc2tzID0gW107XG4gICAgICAgIGNvbGxlY3Rpb25OYW1lcy5mb3JFYWNoKGZ1bmN0aW9uKGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICAgICAgdmFyIGNvbGxlY3Rpb24gPSBDb2xsZWN0aW9uUmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdLFxuICAgICAgICAgICAgbW9kZWxOYW1lcyA9IE9iamVjdC5rZXlzKGNvbGxlY3Rpb24uX21vZGVscyk7XG4gICAgICAgICAgbW9kZWxOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uKG1vZGVsTmFtZSkge1xuICAgICAgICAgICAgdGFza3MucHVzaChmdW5jdGlvbihjYikge1xuICAgICAgICAgICAgICAvLyBXZSBjYWxsIGZyb20gc3RvcmFnZSB0byBhbGxvdyBmb3IgcmVwbGFjZW1lbnQgb2YgX2xvYWRNb2RlbCBmb3IgcGVyZm9ybWFuY2UgZXh0ZW5zaW9uLlxuICAgICAgICAgICAgICBzdG9yYWdlLmxvYWRNb2RlbCh7XG4gICAgICAgICAgICAgICAgY29sbGVjdGlvbk5hbWU6IGNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgIG1vZGVsTmFtZTogbW9kZWxOYW1lXG4gICAgICAgICAgICAgIH0sIGNiKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgICAgdXRpbC5zZXJpZXModGFza3MsIGZ1bmN0aW9uKGVyciwgcmVzdWx0cykge1xuICAgICAgICAgIHZhciBuO1xuICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICB2YXIgaW5zdGFuY2VzID0gW107XG4gICAgICAgICAgICByZXN1bHRzLmZvckVhY2goZnVuY3Rpb24ocikge1xuICAgICAgICAgICAgICBpbnN0YW5jZXMgPSBpbnN0YW5jZXMuY29uY2F0KHIpXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIG4gPSBpbnN0YW5jZXMubGVuZ3RoO1xuICAgICAgICAgICAgaWYgKGxvZykge1xuICAgICAgICAgICAgICBsb2coJ0xvYWRlZCAnICsgbi50b1N0cmluZygpICsgJyBpbnN0YW5jZXMuIENhY2hlIHNpemUgaXMgJyArIGNhY2hlLmNvdW50KCksIHtcbiAgICAgICAgICAgICAgICByZW1vdGU6IGNhY2hlLl9yZW1vdGVDYWNoZSgpLFxuICAgICAgICAgICAgICAgIGxvY2FsQ2FjaGU6IGNhY2hlLl9sb2NhbENhY2hlKClcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzaWVzdGEub24oJ1NpZXN0YScsIGxpc3RlbmVyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY2IoZXJyLCBuKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY2IoKTtcbiAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpO1xuICB9XG5cbiAgZnVuY3Rpb24gc2F2ZUNvbmZsaWN0cyhvYmplY3RzLCBjYikge1xuICAgIHBvdWNoLmFsbERvY3Moe2tleXM6IHV0aWwucGx1Y2sob2JqZWN0cywgJ2xvY2FsSWQnKX0pXG4gICAgICAudGhlbihmdW5jdGlvbihyZXNwKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVzcC5yb3dzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgb2JqZWN0c1tpXS5fcmV2ID0gcmVzcC5yb3dzW2ldLnZhbHVlLnJldjtcbiAgICAgICAgfVxuICAgICAgICBzYXZlVG9Qb3VjaChvYmplY3RzLCBjYik7XG4gICAgICB9KVxuICAgICAgLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICBjYihlcnIpO1xuICAgICAgfSlcbiAgfVxuXG4gIGZ1bmN0aW9uIHNhdmVUb1BvdWNoKG9iamVjdHMsIGNiKSB7XG4gICAgdmFyIGNvbmZsaWN0cyA9IFtdO1xuICAgIHZhciBzZXJpYWxpc2VkRG9jcyA9IG9iamVjdHMubWFwKF9zZXJpYWxpc2UpO1xuICAgIHBvdWNoLmJ1bGtEb2NzKHNlcmlhbGlzZWREb2NzKS50aGVuKGZ1bmN0aW9uKHJlc3ApIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVzcC5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgcmVzcG9uc2UgPSByZXNwW2ldO1xuICAgICAgICB2YXIgb2JqID0gb2JqZWN0c1tpXTtcbiAgICAgICAgaWYgKHJlc3BvbnNlLm9rKSB7XG4gICAgICAgICAgb2JqLl9yZXYgPSByZXNwb25zZS5yZXY7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAocmVzcG9uc2Uuc3RhdHVzID09IDQwOSkge1xuICAgICAgICAgIGNvbmZsaWN0cy5wdXNoKG9iaik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgbG9nKCdFcnJvciBzYXZpbmcgb2JqZWN0IHdpdGggbG9jYWxJZD1cIicgKyBvYmoubG9jYWxJZCArICdcIicsIHJlc3BvbnNlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGNvbmZsaWN0cy5sZW5ndGgpIHtcbiAgICAgICAgc2F2ZUNvbmZsaWN0cyhjb25mbGljdHMsIGNiKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBjYigpO1xuICAgICAgfVxuICAgIH0sIGZ1bmN0aW9uKGVycikge1xuICAgICAgY2IoZXJyKTtcbiAgICB9KTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIFNhdmUgYWxsIG1vZGVsRXZlbnRzIGRvd24gdG8gUG91Y2hEQi5cbiAgICovXG4gIGZ1bmN0aW9uIHNhdmUoY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgc2llc3RhLl9hZnRlckluc3RhbGwoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBpbnN0YW5jZXMgPSB1bnNhdmVkT2JqZWN0cztcbiAgICAgICAgdW5zYXZlZE9iamVjdHMgPSBbXTtcbiAgICAgICAgdW5zYXZlZE9iamVjdHNIYXNoID0ge307XG4gICAgICAgIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uID0ge307XG4gICAgICAgIHNhdmVUb1BvdWNoKGluc3RhbmNlcywgY2IpO1xuICAgICAgfSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGxpc3RlbmVyKG4pIHtcbiAgICB2YXIgY2hhbmdlZE9iamVjdCA9IG4ub2JqLFxuICAgICAgaWRlbnQgPSBjaGFuZ2VkT2JqZWN0LmxvY2FsSWQ7XG4gICAgaWYgKCFjaGFuZ2VkT2JqZWN0KSB7XG4gICAgICB0aHJvdyBuZXcgX2kuZXJyb3IuSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gb2JqIGZpZWxkIGluIG5vdGlmaWNhdGlvbiByZWNlaXZlZCBieSBzdG9yYWdlIGV4dGVuc2lvbicpO1xuICAgIH1cbiAgICBpZiAoIShpZGVudCBpbiB1bnNhdmVkT2JqZWN0c0hhc2gpKSB7XG4gICAgICB1bnNhdmVkT2JqZWN0c0hhc2hbaWRlbnRdID0gY2hhbmdlZE9iamVjdDtcbiAgICAgIHVuc2F2ZWRPYmplY3RzLnB1c2goY2hhbmdlZE9iamVjdCk7XG4gICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBjaGFuZ2VkT2JqZWN0LmNvbGxlY3Rpb25OYW1lO1xuICAgICAgaWYgKCF1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uTmFtZV0pIHtcbiAgICAgICAgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdID0ge307XG4gICAgICB9XG4gICAgICB2YXIgbW9kZWxOYW1lID0gY2hhbmdlZE9iamVjdC5tb2RlbC5uYW1lO1xuICAgICAgaWYgKCF1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXSkge1xuICAgICAgICB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXSA9IHt9O1xuICAgICAgfVxuICAgICAgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV1baWRlbnRdID0gY2hhbmdlZE9iamVjdDtcbiAgICB9XG4gIH1cblxuICB1dGlsLmV4dGVuZChzdG9yYWdlLCB7XG4gICAgX2xvYWQ6IF9sb2FkLFxuICAgIGxvYWRNb2RlbDogbG9hZE1vZGVsLFxuICAgIHNhdmU6IHNhdmUsXG4gICAgX3NlcmlhbGlzZTogX3NlcmlhbGlzZSxcbiAgICBlbnN1cmVJbmRleGVzRm9yQWxsOiBlbnN1cmVJbmRleGVzRm9yQWxsLFxuICAgIGVuc3VyZUluZGV4SW5zdGFsbGVkOiBlbnN1cmVJbmRleEluc3RhbGxlZCxcbiAgICBfcmVzZXQ6IGZ1bmN0aW9uKGNiKSB7XG4gICAgICBzaWVzdGEucmVtb3ZlTGlzdGVuZXIoJ1NpZXN0YScsIGxpc3RlbmVyKTtcbiAgICAgIHVuc2F2ZWRPYmplY3RzID0gW107XG4gICAgICB1bnNhdmVkT2JqZWN0c0hhc2ggPSB7fTtcbiAgICAgIHBvdWNoLmRlc3Ryb3koZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgcG91Y2ggPSBuZXcgUG91Y2hEQihEQl9OQU1FKTtcbiAgICAgICAgfVxuICAgICAgICBsb2coJ1Jlc2V0IGNvbXBsZXRlJyk7XG4gICAgICAgIGNiKGVycik7XG4gICAgICB9KVxuICAgIH1cblxuICB9KTtcblxuICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhzdG9yYWdlLCB7XG4gICAgX3Vuc2F2ZWRPYmplY3RzOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdW5zYXZlZE9iamVjdHNcbiAgICAgIH1cbiAgICB9LFxuICAgIF91bnNhdmVkT2JqZWN0c0hhc2g6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB1bnNhdmVkT2JqZWN0c0hhc2hcbiAgICAgIH1cbiAgICB9LFxuICAgIF91bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbjoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uXG4gICAgICB9XG4gICAgfSxcbiAgICBfcG91Y2g6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBwb3VjaFxuICAgICAgfVxuICAgIH1cbiAgfSk7XG5cbiAgaWYgKCFzaWVzdGEuZXh0KSBzaWVzdGEuZXh0ID0ge307XG4gIHNpZXN0YS5leHQuc3RvcmFnZSA9IHN0b3JhZ2U7XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoc2llc3RhLmV4dCwge1xuICAgIHN0b3JhZ2VFbmFibGVkOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoc2llc3RhLmV4dC5fc3RvcmFnZUVuYWJsZWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHJldHVybiBzaWVzdGEuZXh0Ll9zdG9yYWdlRW5hYmxlZDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gISFzaWVzdGEuZXh0LnN0b3JhZ2U7XG4gICAgICB9LFxuICAgICAgc2V0OiBmdW5jdGlvbih2KSB7XG4gICAgICAgIHNpZXN0YS5leHQuX3N0b3JhZ2VFbmFibGVkID0gdjtcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfVxuICB9KTtcblxuICB2YXIgaW50ZXJ2YWwsIHNhdmluZywgYXV0b3NhdmVJbnRlcnZhbCA9IDEwMDA7XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoc2llc3RhLCB7XG4gICAgYXV0b3NhdmU6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAhIWludGVydmFsO1xuICAgICAgfSxcbiAgICAgIHNldDogZnVuY3Rpb24oYXV0b3NhdmUpIHtcbiAgICAgICAgaWYgKGF1dG9zYXZlKSB7XG4gICAgICAgICAgaWYgKCFpbnRlcnZhbCkge1xuICAgICAgICAgICAgaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgLy8gQ2hlZWt5IHdheSBvZiBhdm9pZGluZyBtdWx0aXBsZSBzYXZlcyBoYXBwZW5pbmcuLi5cbiAgICAgICAgICAgICAgaWYgKCFzYXZpbmcpIHtcbiAgICAgICAgICAgICAgICBzYXZpbmcgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHNpZXN0YS5zYXZlKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgZXZlbnRzLmVtaXQoJ3NhdmVkJyk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBzYXZpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgc2llc3RhLmF1dG9zYXZlSW50ZXJ2YWwpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBpZiAoaW50ZXJ2YWwpIHtcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwoaW50ZXJ2YWwpO1xuICAgICAgICAgICAgaW50ZXJ2YWwgPSBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgYXV0b3NhdmVJbnRlcnZhbDoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGF1dG9zYXZlSW50ZXJ2YWw7XG4gICAgICB9LFxuICAgICAgc2V0OiBmdW5jdGlvbihfYXV0b3NhdmVJbnRlcnZhbCkge1xuICAgICAgICBhdXRvc2F2ZUludGVydmFsID0gX2F1dG9zYXZlSW50ZXJ2YWw7XG4gICAgICAgIGlmIChpbnRlcnZhbCkge1xuICAgICAgICAgIC8vIFJlc2V0IGludGVydmFsXG4gICAgICAgICAgc2llc3RhLmF1dG9zYXZlID0gZmFsc2U7XG4gICAgICAgICAgc2llc3RhLmF1dG9zYXZlID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgZGlydHk6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbiA9IHNpZXN0YS5leHQuc3RvcmFnZS5fdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb247XG4gICAgICAgIHJldHVybiAhIU9iamVjdC5rZXlzKHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uKS5sZW5ndGg7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH1cbiAgfSk7XG5cbiAgdXRpbC5leHRlbmQoc2llc3RhLCB7XG4gICAgc2F2ZTogc2F2ZSxcbiAgICBzZXRQb3VjaDogZnVuY3Rpb24oX3ApIHtcbiAgICAgIGlmIChzaWVzdGEuX2NhbkNoYW5nZSkgcG91Y2ggPSBfcDtcbiAgICAgIGVsc2UgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgY2hhbmdlIFBvdWNoREIgaW5zdGFuY2Ugd2hlbiBhbiBvYmplY3QgZ3JhcGggZXhpc3RzLicpO1xuICAgIH1cbiAgfSk7XG5cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBzdG9yYWdlO1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9zdG9yYWdlL2luZGV4LmpzXG4gKiogbW9kdWxlIGlkID0gMjBcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xudmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcbnZhciB1bmRlZmluZWQ7XG5cbnZhciBpc1BsYWluT2JqZWN0ID0gZnVuY3Rpb24gaXNQbGFpbk9iamVjdChvYmopIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcbiAgICBpZiAoIW9iaiB8fCB0b1N0cmluZy5jYWxsKG9iaikgIT09ICdbb2JqZWN0IE9iamVjdF0nIHx8IG9iai5ub2RlVHlwZSB8fCBvYmouc2V0SW50ZXJ2YWwpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHZhciBoYXNfb3duX2NvbnN0cnVjdG9yID0gaGFzT3duLmNhbGwob2JqLCAnY29uc3RydWN0b3InKTtcbiAgICB2YXIgaGFzX2lzX3Byb3BlcnR5X29mX21ldGhvZCA9IG9iai5jb25zdHJ1Y3RvciAmJiBvYmouY29uc3RydWN0b3IucHJvdG90eXBlICYmIGhhc093bi5jYWxsKG9iai5jb25zdHJ1Y3Rvci5wcm90b3R5cGUsICdpc1Byb3RvdHlwZU9mJyk7XG4gICAgLy8gTm90IG93biBjb25zdHJ1Y3RvciBwcm9wZXJ0eSBtdXN0IGJlIE9iamVjdFxuICAgIGlmIChvYmouY29uc3RydWN0b3IgJiYgIWhhc19vd25fY29uc3RydWN0b3IgJiYgIWhhc19pc19wcm9wZXJ0eV9vZl9tZXRob2QpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIE93biBwcm9wZXJ0aWVzIGFyZSBlbnVtZXJhdGVkIGZpcnN0bHksIHNvIHRvIHNwZWVkIHVwLFxuICAgIC8vIGlmIGxhc3Qgb25lIGlzIG93biwgdGhlbiBhbGwgcHJvcGVydGllcyBhcmUgb3duLlxuICAgIHZhciBrZXk7XG4gICAgZm9yIChrZXkgaW4gb2JqKSB7fVxuXG4gICAgcmV0dXJuIGtleSA9PT0gdW5kZWZpbmVkIHx8IGhhc093bi5jYWxsKG9iaiwga2V5KTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZXh0ZW5kKCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuICAgIHZhciBvcHRpb25zLCBuYW1lLCBzcmMsIGNvcHksIGNvcHlJc0FycmF5LCBjbG9uZSxcbiAgICAgICAgdGFyZ2V0ID0gYXJndW1lbnRzWzBdLFxuICAgICAgICBpID0gMSxcbiAgICAgICAgbGVuZ3RoID0gYXJndW1lbnRzLmxlbmd0aCxcbiAgICAgICAgZGVlcCA9IGZhbHNlO1xuXG4gICAgLy8gSGFuZGxlIGEgZGVlcCBjb3B5IHNpdHVhdGlvblxuICAgIGlmICh0eXBlb2YgdGFyZ2V0ID09PSBcImJvb2xlYW5cIikge1xuICAgICAgICBkZWVwID0gdGFyZ2V0O1xuICAgICAgICB0YXJnZXQgPSBhcmd1bWVudHNbMV0gfHwge307XG4gICAgICAgIC8vIHNraXAgdGhlIGJvb2xlYW4gYW5kIHRoZSB0YXJnZXRcbiAgICAgICAgaSA9IDI7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgdGFyZ2V0ICE9PSBcIm9iamVjdFwiICYmIHR5cGVvZiB0YXJnZXQgIT09IFwiZnVuY3Rpb25cIiB8fCB0YXJnZXQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRhcmdldCA9IHt9O1xuICAgIH1cblxuICAgIGZvciAoOyBpIDwgbGVuZ3RoOyArK2kpIHtcbiAgICAgICAgLy8gT25seSBkZWFsIHdpdGggbm9uLW51bGwvdW5kZWZpbmVkIHZhbHVlc1xuICAgICAgICBpZiAoKG9wdGlvbnMgPSBhcmd1bWVudHNbaV0pICE9IG51bGwpIHtcbiAgICAgICAgICAgIC8vIEV4dGVuZCB0aGUgYmFzZSBvYmplY3RcbiAgICAgICAgICAgIGZvciAobmFtZSBpbiBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgc3JjID0gdGFyZ2V0W25hbWVdO1xuICAgICAgICAgICAgICAgIGNvcHkgPSBvcHRpb25zW25hbWVdO1xuXG4gICAgICAgICAgICAgICAgLy8gUHJldmVudCBuZXZlci1lbmRpbmcgbG9vcFxuICAgICAgICAgICAgICAgIGlmICh0YXJnZXQgPT09IGNvcHkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gUmVjdXJzZSBpZiB3ZSdyZSBtZXJnaW5nIHBsYWluIG9iamVjdHMgb3IgYXJyYXlzXG4gICAgICAgICAgICAgICAgaWYgKGRlZXAgJiYgY29weSAmJiAoaXNQbGFpbk9iamVjdChjb3B5KSB8fCAoY29weUlzQXJyYXkgPSBBcnJheS5pc0FycmF5KGNvcHkpKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvcHlJc0FycmF5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb3B5SXNBcnJheSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2xvbmUgPSBzcmMgJiYgQXJyYXkuaXNBcnJheShzcmMpID8gc3JjIDogW107XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjbG9uZSA9IHNyYyAmJiBpc1BsYWluT2JqZWN0KHNyYykgPyBzcmMgOiB7fTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIE5ldmVyIG1vdmUgb3JpZ2luYWwgb2JqZWN0cywgY2xvbmUgdGhlbVxuICAgICAgICAgICAgICAgICAgICB0YXJnZXRbbmFtZV0gPSBleHRlbmQoZGVlcCwgY2xvbmUsIGNvcHkpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIERvbid0IGJyaW5nIGluIHVuZGVmaW5lZCB2YWx1ZXNcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGNvcHkgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXRbbmFtZV0gPSBjb3B5O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFJldHVybiB0aGUgbW9kaWZpZWQgb2JqZWN0XG4gICAgcmV0dXJuIHRhcmdldDtcbn07XG5cblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9+L2V4dGVuZC9pbmRleC5qc1xuICoqIG1vZHVsZSBpZCA9IDIxXG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCIvKlxuICogQ29weXJpZ2h0IChjKSAyMDE0IFRoZSBQb2x5bWVyIFByb2plY3QgQXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqIFRoaXMgY29kZSBtYXkgb25seSBiZSB1c2VkIHVuZGVyIHRoZSBCU0Qgc3R5bGUgbGljZW5zZSBmb3VuZCBhdCBodHRwOi8vcG9seW1lci5naXRodWIuaW8vTElDRU5TRS50eHRcbiAqIFRoZSBjb21wbGV0ZSBzZXQgb2YgYXV0aG9ycyBtYXkgYmUgZm91bmQgYXQgaHR0cDovL3BvbHltZXIuZ2l0aHViLmlvL0FVVEhPUlMudHh0XG4gKiBUaGUgY29tcGxldGUgc2V0IG9mIGNvbnRyaWJ1dG9ycyBtYXkgYmUgZm91bmQgYXQgaHR0cDovL3BvbHltZXIuZ2l0aHViLmlvL0NPTlRSSUJVVE9SUy50eHRcbiAqIENvZGUgZGlzdHJpYnV0ZWQgYnkgR29vZ2xlIGFzIHBhcnQgb2YgdGhlIHBvbHltZXIgcHJvamVjdCBpcyBhbHNvXG4gKiBzdWJqZWN0IHRvIGFuIGFkZGl0aW9uYWwgSVAgcmlnaHRzIGdyYW50IGZvdW5kIGF0IGh0dHA6Ly9wb2x5bWVyLmdpdGh1Yi5pby9QQVRFTlRTLnR4dFxuICovXG5cbihmdW5jdGlvbihnbG9iYWwpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIHZhciB0ZXN0aW5nRXhwb3NlQ3ljbGVDb3VudCA9IGdsb2JhbC50ZXN0aW5nRXhwb3NlQ3ljbGVDb3VudDtcblxuICAvLyBEZXRlY3QgYW5kIGRvIGJhc2ljIHNhbml0eSBjaGVja2luZyBvbiBPYmplY3QvQXJyYXkub2JzZXJ2ZS5cbiAgZnVuY3Rpb24gZGV0ZWN0T2JqZWN0T2JzZXJ2ZSgpIHtcbiAgICBpZiAodHlwZW9mIE9iamVjdC5vYnNlcnZlICE9PSAnZnVuY3Rpb24nIHx8XG4gICAgICAgIHR5cGVvZiBBcnJheS5vYnNlcnZlICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIHJlY29yZHMgPSBbXTtcblxuICAgIGZ1bmN0aW9uIGNhbGxiYWNrKHJlY3MpIHtcbiAgICAgIHJlY29yZHMgPSByZWNzO1xuICAgIH1cblxuICAgIHZhciB0ZXN0ID0ge307XG4gICAgdmFyIGFyciA9IFtdO1xuICAgIE9iamVjdC5vYnNlcnZlKHRlc3QsIGNhbGxiYWNrKTtcbiAgICBBcnJheS5vYnNlcnZlKGFyciwgY2FsbGJhY2spO1xuICAgIHRlc3QuaWQgPSAxO1xuICAgIHRlc3QuaWQgPSAyO1xuICAgIGRlbGV0ZSB0ZXN0LmlkO1xuICAgIGFyci5wdXNoKDEsIDIpO1xuICAgIGFyci5sZW5ndGggPSAwO1xuXG4gICAgT2JqZWN0LmRlbGl2ZXJDaGFuZ2VSZWNvcmRzKGNhbGxiYWNrKTtcbiAgICBpZiAocmVjb3Jkcy5sZW5ndGggIT09IDUpXG4gICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICBpZiAocmVjb3Jkc1swXS50eXBlICE9ICdhZGQnIHx8XG4gICAgICAgIHJlY29yZHNbMV0udHlwZSAhPSAndXBkYXRlJyB8fFxuICAgICAgICByZWNvcmRzWzJdLnR5cGUgIT0gJ2RlbGV0ZScgfHxcbiAgICAgICAgcmVjb3Jkc1szXS50eXBlICE9ICdzcGxpY2UnIHx8XG4gICAgICAgIHJlY29yZHNbNF0udHlwZSAhPSAnc3BsaWNlJykge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIE9iamVjdC51bm9ic2VydmUodGVzdCwgY2FsbGJhY2spO1xuICAgIEFycmF5LnVub2JzZXJ2ZShhcnIsIGNhbGxiYWNrKTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgdmFyIGhhc09ic2VydmUgPSBkZXRlY3RPYmplY3RPYnNlcnZlKCk7XG5cbiAgZnVuY3Rpb24gZGV0ZWN0RXZhbCgpIHtcbiAgICAvLyBEb24ndCB0ZXN0IGZvciBldmFsIGlmIHdlJ3JlIHJ1bm5pbmcgaW4gYSBDaHJvbWUgQXBwIGVudmlyb25tZW50LlxuICAgIC8vIFdlIGNoZWNrIGZvciBBUElzIHNldCB0aGF0IG9ubHkgZXhpc3QgaW4gYSBDaHJvbWUgQXBwIGNvbnRleHQuXG4gICAgaWYgKHR5cGVvZiBjaHJvbWUgIT09ICd1bmRlZmluZWQnICYmIGNocm9tZS5hcHAgJiYgY2hyb21lLmFwcC5ydW50aW1lKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gRmlyZWZveCBPUyBBcHBzIGRvIG5vdCBhbGxvdyBldmFsLiBUaGlzIGZlYXR1cmUgZGV0ZWN0aW9uIGlzIHZlcnkgaGFja3lcbiAgICAvLyBidXQgZXZlbiBpZiBzb21lIG90aGVyIHBsYXRmb3JtIGFkZHMgc3VwcG9ydCBmb3IgdGhpcyBmdW5jdGlvbiB0aGlzIGNvZGVcbiAgICAvLyB3aWxsIGNvbnRpbnVlIHRvIHdvcmsuXG4gICAgaWYgKG5hdmlnYXRvci5nZXREZXZpY2VTdG9yYWdlKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIHZhciBmID0gbmV3IEZ1bmN0aW9uKCcnLCAncmV0dXJuIHRydWU7Jyk7XG4gICAgICByZXR1cm4gZigpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgdmFyIGhhc0V2YWwgPSBkZXRlY3RFdmFsKCk7XG5cbiAgZnVuY3Rpb24gaXNJbmRleChzKSB7XG4gICAgcmV0dXJuICtzID09PSBzID4+PiAwICYmIHMgIT09ICcnO1xuICB9XG5cbiAgZnVuY3Rpb24gdG9OdW1iZXIocykge1xuICAgIHJldHVybiArcztcbiAgfVxuXG4gIHZhciBudW1iZXJJc05hTiA9IGdsb2JhbC5OdW1iZXIuaXNOYU4gfHwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyAmJiBnbG9iYWwuaXNOYU4odmFsdWUpO1xuICB9XG5cblxuICB2YXIgY3JlYXRlT2JqZWN0ID0gKCdfX3Byb3RvX18nIGluIHt9KSA/XG4gICAgZnVuY3Rpb24ob2JqKSB7IHJldHVybiBvYmo7IH0gOlxuICAgIGZ1bmN0aW9uKG9iaikge1xuICAgICAgdmFyIHByb3RvID0gb2JqLl9fcHJvdG9fXztcbiAgICAgIGlmICghcHJvdG8pXG4gICAgICAgIHJldHVybiBvYmo7XG4gICAgICB2YXIgbmV3T2JqZWN0ID0gT2JqZWN0LmNyZWF0ZShwcm90byk7XG4gICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhvYmopLmZvckVhY2goZnVuY3Rpb24obmFtZSkge1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobmV3T2JqZWN0LCBuYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG9iaiwgbmFtZSkpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gbmV3T2JqZWN0O1xuICAgIH07XG5cbiAgdmFyIGlkZW50U3RhcnQgPSAnW1xcJF9hLXpBLVpdJztcbiAgdmFyIGlkZW50UGFydCA9ICdbXFwkX2EtekEtWjAtOV0nO1xuXG5cbiAgdmFyIE1BWF9ESVJUWV9DSEVDS19DWUNMRVMgPSAxMDAwO1xuXG4gIGZ1bmN0aW9uIGRpcnR5Q2hlY2sob2JzZXJ2ZXIpIHtcbiAgICB2YXIgY3ljbGVzID0gMDtcbiAgICB3aGlsZSAoY3ljbGVzIDwgTUFYX0RJUlRZX0NIRUNLX0NZQ0xFUyAmJiBvYnNlcnZlci5jaGVja18oKSkge1xuICAgICAgY3ljbGVzKys7XG4gICAgfVxuICAgIGlmICh0ZXN0aW5nRXhwb3NlQ3ljbGVDb3VudClcbiAgICAgIGdsb2JhbC5kaXJ0eUNoZWNrQ3ljbGVDb3VudCA9IGN5Y2xlcztcblxuICAgIHJldHVybiBjeWNsZXMgPiAwO1xuICB9XG5cbiAgZnVuY3Rpb24gb2JqZWN0SXNFbXB0eShvYmplY3QpIHtcbiAgICBmb3IgKHZhciBwcm9wIGluIG9iamVjdClcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRpZmZJc0VtcHR5KGRpZmYpIHtcbiAgICByZXR1cm4gb2JqZWN0SXNFbXB0eShkaWZmLmFkZGVkKSAmJlxuICAgICAgICAgICBvYmplY3RJc0VtcHR5KGRpZmYucmVtb3ZlZCkgJiZcbiAgICAgICAgICAgb2JqZWN0SXNFbXB0eShkaWZmLmNoYW5nZWQpO1xuICB9XG5cbiAgZnVuY3Rpb24gZGlmZk9iamVjdEZyb21PbGRPYmplY3Qob2JqZWN0LCBvbGRPYmplY3QpIHtcbiAgICB2YXIgYWRkZWQgPSB7fTtcbiAgICB2YXIgcmVtb3ZlZCA9IHt9O1xuICAgIHZhciBjaGFuZ2VkID0ge307XG5cbiAgICBmb3IgKHZhciBwcm9wIGluIG9sZE9iamVjdCkge1xuICAgICAgdmFyIG5ld1ZhbHVlID0gb2JqZWN0W3Byb3BdO1xuXG4gICAgICBpZiAobmV3VmFsdWUgIT09IHVuZGVmaW5lZCAmJiBuZXdWYWx1ZSA9PT0gb2xkT2JqZWN0W3Byb3BdKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgaWYgKCEocHJvcCBpbiBvYmplY3QpKSB7XG4gICAgICAgIHJlbW92ZWRbcHJvcF0gPSB1bmRlZmluZWQ7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAobmV3VmFsdWUgIT09IG9sZE9iamVjdFtwcm9wXSlcbiAgICAgICAgY2hhbmdlZFtwcm9wXSA9IG5ld1ZhbHVlO1xuICAgIH1cblxuICAgIGZvciAodmFyIHByb3AgaW4gb2JqZWN0KSB7XG4gICAgICBpZiAocHJvcCBpbiBvbGRPYmplY3QpXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICBhZGRlZFtwcm9wXSA9IG9iamVjdFtwcm9wXTtcbiAgICB9XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShvYmplY3QpICYmIG9iamVjdC5sZW5ndGggIT09IG9sZE9iamVjdC5sZW5ndGgpXG4gICAgICBjaGFuZ2VkLmxlbmd0aCA9IG9iamVjdC5sZW5ndGg7XG5cbiAgICByZXR1cm4ge1xuICAgICAgYWRkZWQ6IGFkZGVkLFxuICAgICAgcmVtb3ZlZDogcmVtb3ZlZCxcbiAgICAgIGNoYW5nZWQ6IGNoYW5nZWRcbiAgICB9O1xuICB9XG5cbiAgdmFyIGVvbVRhc2tzID0gW107XG4gIGZ1bmN0aW9uIHJ1bkVPTVRhc2tzKCkge1xuICAgIGlmICghZW9tVGFza3MubGVuZ3RoKVxuICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBlb21UYXNrcy5sZW5ndGg7IGkrKykge1xuICAgICAgZW9tVGFza3NbaV0oKTtcbiAgICB9XG4gICAgZW9tVGFza3MubGVuZ3RoID0gMDtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHZhciBydW5FT00gPSBoYXNPYnNlcnZlID8gKGZ1bmN0aW9uKCl7XG4gICAgdmFyIGVvbU9iaiA9IHsgcGluZ1Bvbmc6IHRydWUgfTtcbiAgICB2YXIgZW9tUnVuU2NoZWR1bGVkID0gZmFsc2U7XG5cbiAgICBPYmplY3Qub2JzZXJ2ZShlb21PYmosIGZ1bmN0aW9uKCkge1xuICAgICAgcnVuRU9NVGFza3MoKTtcbiAgICAgIGVvbVJ1blNjaGVkdWxlZCA9IGZhbHNlO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7XG4gICAgICBlb21UYXNrcy5wdXNoKGZuKTtcbiAgICAgIGlmICghZW9tUnVuU2NoZWR1bGVkKSB7XG4gICAgICAgIGVvbVJ1blNjaGVkdWxlZCA9IHRydWU7XG4gICAgICAgIGVvbU9iai5waW5nUG9uZyA9ICFlb21PYmoucGluZ1Bvbmc7XG4gICAgICB9XG4gICAgfTtcbiAgfSkoKSA6XG4gIChmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHtcbiAgICAgIGVvbVRhc2tzLnB1c2goZm4pO1xuICAgIH07XG4gIH0pKCk7XG5cbiAgdmFyIG9ic2VydmVkT2JqZWN0Q2FjaGUgPSBbXTtcblxuICBmdW5jdGlvbiBuZXdPYnNlcnZlZE9iamVjdCgpIHtcbiAgICB2YXIgb2JzZXJ2ZXI7XG4gICAgdmFyIG9iamVjdDtcbiAgICB2YXIgZGlzY2FyZFJlY29yZHMgPSBmYWxzZTtcbiAgICB2YXIgZmlyc3QgPSB0cnVlO1xuXG4gICAgZnVuY3Rpb24gY2FsbGJhY2socmVjb3Jkcykge1xuICAgICAgaWYgKG9ic2VydmVyICYmIG9ic2VydmVyLnN0YXRlXyA9PT0gT1BFTkVEICYmICFkaXNjYXJkUmVjb3JkcylcbiAgICAgICAgb2JzZXJ2ZXIuY2hlY2tfKHJlY29yZHMpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBvcGVuOiBmdW5jdGlvbihvYnMpIHtcbiAgICAgICAgaWYgKG9ic2VydmVyKVxuICAgICAgICAgIHRocm93IEVycm9yKCdPYnNlcnZlZE9iamVjdCBpbiB1c2UnKTtcblxuICAgICAgICBpZiAoIWZpcnN0KVxuICAgICAgICAgIE9iamVjdC5kZWxpdmVyQ2hhbmdlUmVjb3JkcyhjYWxsYmFjayk7XG5cbiAgICAgICAgb2JzZXJ2ZXIgPSBvYnM7XG4gICAgICAgIGZpcnN0ID0gZmFsc2U7XG4gICAgICB9LFxuICAgICAgb2JzZXJ2ZTogZnVuY3Rpb24ob2JqLCBhcnJheU9ic2VydmUpIHtcbiAgICAgICAgb2JqZWN0ID0gb2JqO1xuICAgICAgICBpZiAoYXJyYXlPYnNlcnZlKVxuICAgICAgICAgIEFycmF5Lm9ic2VydmUob2JqZWN0LCBjYWxsYmFjayk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBPYmplY3Qub2JzZXJ2ZShvYmplY3QsIGNhbGxiYWNrKTtcbiAgICAgIH0sXG4gICAgICBkZWxpdmVyOiBmdW5jdGlvbihkaXNjYXJkKSB7XG4gICAgICAgIGRpc2NhcmRSZWNvcmRzID0gZGlzY2FyZDtcbiAgICAgICAgT2JqZWN0LmRlbGl2ZXJDaGFuZ2VSZWNvcmRzKGNhbGxiYWNrKTtcbiAgICAgICAgZGlzY2FyZFJlY29yZHMgPSBmYWxzZTtcbiAgICAgIH0sXG4gICAgICBjbG9zZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIG9ic2VydmVyID0gdW5kZWZpbmVkO1xuICAgICAgICBPYmplY3QudW5vYnNlcnZlKG9iamVjdCwgY2FsbGJhY2spO1xuICAgICAgICBvYnNlcnZlZE9iamVjdENhY2hlLnB1c2godGhpcyk7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIC8qXG4gICAqIFRoZSBvYnNlcnZlZFNldCBhYnN0cmFjdGlvbiBpcyBhIHBlcmYgb3B0aW1pemF0aW9uIHdoaWNoIHJlZHVjZXMgdGhlIHRvdGFsXG4gICAqIG51bWJlciBvZiBPYmplY3Qub2JzZXJ2ZSBvYnNlcnZhdGlvbnMgb2YgYSBzZXQgb2Ygb2JqZWN0cy4gVGhlIGlkZWEgaXMgdGhhdFxuICAgKiBncm91cHMgb2YgT2JzZXJ2ZXJzIHdpbGwgaGF2ZSBzb21lIG9iamVjdCBkZXBlbmRlbmNpZXMgaW4gY29tbW9uIGFuZCB0aGlzXG4gICAqIG9ic2VydmVkIHNldCBlbnN1cmVzIHRoYXQgZWFjaCBvYmplY3QgaW4gdGhlIHRyYW5zaXRpdmUgY2xvc3VyZSBvZlxuICAgKiBkZXBlbmRlbmNpZXMgaXMgb25seSBvYnNlcnZlZCBvbmNlLiBUaGUgb2JzZXJ2ZWRTZXQgYWN0cyBhcyBhIHdyaXRlIGJhcnJpZXJcbiAgICogc3VjaCB0aGF0IHdoZW5ldmVyIGFueSBjaGFuZ2UgY29tZXMgdGhyb3VnaCwgYWxsIE9ic2VydmVycyBhcmUgY2hlY2tlZCBmb3JcbiAgICogY2hhbmdlZCB2YWx1ZXMuXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0aGlzIG9wdGltaXphdGlvbiBpcyBleHBsaWNpdGx5IG1vdmluZyB3b3JrIGZyb20gc2V0dXAtdGltZSB0b1xuICAgKiBjaGFuZ2UtdGltZS5cbiAgICpcbiAgICogVE9ETyhyYWZhZWx3KTogSW1wbGVtZW50IFwiZ2FyYmFnZSBjb2xsZWN0aW9uXCIuIEluIG9yZGVyIHRvIG1vdmUgd29yayBvZmZcbiAgICogdGhlIGNyaXRpY2FsIHBhdGgsIHdoZW4gT2JzZXJ2ZXJzIGFyZSBjbG9zZWQsIHRoZWlyIG9ic2VydmVkIG9iamVjdHMgYXJlXG4gICAqIG5vdCBPYmplY3QudW5vYnNlcnZlKGQpLiBBcyBhIHJlc3VsdCwgaXQnc2llc3RhIHBvc3NpYmxlIHRoYXQgaWYgdGhlIG9ic2VydmVkU2V0XG4gICAqIGlzIGtlcHQgb3BlbiwgYnV0IHNvbWUgT2JzZXJ2ZXJzIGhhdmUgYmVlbiBjbG9zZWQsIGl0IGNvdWxkIGNhdXNlIFwibGVha3NcIlxuICAgKiAocHJldmVudCBvdGhlcndpc2UgY29sbGVjdGFibGUgb2JqZWN0cyBmcm9tIGJlaW5nIGNvbGxlY3RlZCkuIEF0IHNvbWVcbiAgICogcG9pbnQsIHdlIHNob3VsZCBpbXBsZW1lbnQgaW5jcmVtZW50YWwgXCJnY1wiIHdoaWNoIGtlZXBzIGEgbGlzdCBvZlxuICAgKiBvYnNlcnZlZFNldHMgd2hpY2ggbWF5IG5lZWQgY2xlYW4tdXAgYW5kIGRvZXMgc21hbGwgYW1vdW50cyBvZiBjbGVhbnVwIG9uIGFcbiAgICogdGltZW91dCB1bnRpbCBhbGwgaXMgY2xlYW4uXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGdldE9ic2VydmVkT2JqZWN0KG9ic2VydmVyLCBvYmplY3QsIGFycmF5T2JzZXJ2ZSkge1xuICAgIHZhciBkaXIgPSBvYnNlcnZlZE9iamVjdENhY2hlLnBvcCgpIHx8IG5ld09ic2VydmVkT2JqZWN0KCk7XG4gICAgZGlyLm9wZW4ob2JzZXJ2ZXIpO1xuICAgIGRpci5vYnNlcnZlKG9iamVjdCwgYXJyYXlPYnNlcnZlKTtcbiAgICByZXR1cm4gZGlyO1xuICB9XG5cbiAgdmFyIG9ic2VydmVkU2V0Q2FjaGUgPSBbXTtcblxuICBmdW5jdGlvbiBuZXdPYnNlcnZlZFNldCgpIHtcbiAgICB2YXIgb2JzZXJ2ZXJDb3VudCA9IDA7XG4gICAgdmFyIG9ic2VydmVycyA9IFtdO1xuICAgIHZhciBvYmplY3RzID0gW107XG4gICAgdmFyIHJvb3RPYmo7XG4gICAgdmFyIHJvb3RPYmpQcm9wcztcblxuICAgIGZ1bmN0aW9uIG9ic2VydmUob2JqLCBwcm9wKSB7XG4gICAgICBpZiAoIW9iailcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICBpZiAob2JqID09PSByb290T2JqKVxuICAgICAgICByb290T2JqUHJvcHNbcHJvcF0gPSB0cnVlO1xuXG4gICAgICBpZiAob2JqZWN0cy5pbmRleE9mKG9iaikgPCAwKSB7XG4gICAgICAgIG9iamVjdHMucHVzaChvYmopO1xuICAgICAgICBPYmplY3Qub2JzZXJ2ZShvYmosIGNhbGxiYWNrKTtcbiAgICAgIH1cblxuICAgICAgb2JzZXJ2ZShPYmplY3QuZ2V0UHJvdG90eXBlT2Yob2JqKSwgcHJvcCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWxsUm9vdE9iak5vbk9ic2VydmVkUHJvcHMocmVjcykge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZWNzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciByZWMgPSByZWNzW2ldO1xuICAgICAgICBpZiAocmVjLm9iamVjdCAhPT0gcm9vdE9iaiB8fFxuICAgICAgICAgICAgcm9vdE9ialByb3BzW3JlYy5uYW1lXSB8fFxuICAgICAgICAgICAgcmVjLnR5cGUgPT09ICdzZXRQcm90b3R5cGUnKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjYWxsYmFjayhyZWNzKSB7XG4gICAgICBpZiAoYWxsUm9vdE9iak5vbk9ic2VydmVkUHJvcHMocmVjcykpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgdmFyIG9ic2VydmVyO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYnNlcnZlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgb2JzZXJ2ZXIgPSBvYnNlcnZlcnNbaV07XG4gICAgICAgIGlmIChvYnNlcnZlci5zdGF0ZV8gPT0gT1BFTkVEKSB7XG4gICAgICAgICAgb2JzZXJ2ZXIuaXRlcmF0ZU9iamVjdHNfKG9ic2VydmUpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2JzZXJ2ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIG9ic2VydmVyID0gb2JzZXJ2ZXJzW2ldO1xuICAgICAgICBpZiAob2JzZXJ2ZXIuc3RhdGVfID09IE9QRU5FRCkge1xuICAgICAgICAgIG9ic2VydmVyLmNoZWNrXygpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIHJlY29yZCA9IHtcbiAgICAgIG9iamVjdDogdW5kZWZpbmVkLFxuICAgICAgb2JqZWN0czogb2JqZWN0cyxcbiAgICAgIG9wZW46IGZ1bmN0aW9uKG9icywgb2JqZWN0KSB7XG4gICAgICAgIGlmICghcm9vdE9iaikge1xuICAgICAgICAgIHJvb3RPYmogPSBvYmplY3Q7XG4gICAgICAgICAgcm9vdE9ialByb3BzID0ge307XG4gICAgICAgIH1cblxuICAgICAgICBvYnNlcnZlcnMucHVzaChvYnMpO1xuICAgICAgICBvYnNlcnZlckNvdW50Kys7XG4gICAgICAgIG9icy5pdGVyYXRlT2JqZWN0c18ob2JzZXJ2ZSk7XG4gICAgICB9LFxuICAgICAgY2xvc2U6IGZ1bmN0aW9uKG9icykge1xuICAgICAgICBvYnNlcnZlckNvdW50LS07XG4gICAgICAgIGlmIChvYnNlcnZlckNvdW50ID4gMCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2JqZWN0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIE9iamVjdC51bm9ic2VydmUob2JqZWN0c1tpXSwgY2FsbGJhY2spO1xuICAgICAgICAgIE9ic2VydmVyLnVub2JzZXJ2ZWRDb3VudCsrO1xuICAgICAgICB9XG5cbiAgICAgICAgb2JzZXJ2ZXJzLmxlbmd0aCA9IDA7XG4gICAgICAgIG9iamVjdHMubGVuZ3RoID0gMDtcbiAgICAgICAgcm9vdE9iaiA9IHVuZGVmaW5lZDtcbiAgICAgICAgcm9vdE9ialByb3BzID0gdW5kZWZpbmVkO1xuICAgICAgICBvYnNlcnZlZFNldENhY2hlLnB1c2godGhpcyk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiByZWNvcmQ7XG4gIH1cblxuICB2YXIgbGFzdE9ic2VydmVkU2V0O1xuXG4gIHZhciBVTk9QRU5FRCA9IDA7XG4gIHZhciBPUEVORUQgPSAxO1xuICB2YXIgQ0xPU0VEID0gMjtcblxuICB2YXIgbmV4dE9ic2VydmVySWQgPSAxO1xuXG4gIGZ1bmN0aW9uIE9ic2VydmVyKCkge1xuICAgIHRoaXMuc3RhdGVfID0gVU5PUEVORUQ7XG4gICAgdGhpcy5jYWxsYmFja18gPSB1bmRlZmluZWQ7XG4gICAgdGhpcy50YXJnZXRfID0gdW5kZWZpbmVkOyAvLyBUT0RPKHJhZmFlbHcpOiBTaG91bGQgYmUgV2Vha1JlZlxuICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gdW5kZWZpbmVkO1xuICAgIHRoaXMudmFsdWVfID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuaWRfID0gbmV4dE9ic2VydmVySWQrKztcbiAgfVxuXG4gIE9ic2VydmVyLnByb3RvdHlwZSA9IHtcbiAgICBvcGVuOiBmdW5jdGlvbihjYWxsYmFjaywgdGFyZ2V0KSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gVU5PUEVORUQpXG4gICAgICAgIHRocm93IEVycm9yKCdPYnNlcnZlciBoYXMgYWxyZWFkeSBiZWVuIG9wZW5lZC4nKTtcblxuICAgICAgYWRkVG9BbGwodGhpcyk7XG4gICAgICB0aGlzLmNhbGxiYWNrXyA9IGNhbGxiYWNrO1xuICAgICAgdGhpcy50YXJnZXRfID0gdGFyZ2V0O1xuICAgICAgdGhpcy5jb25uZWN0XygpO1xuICAgICAgdGhpcy5zdGF0ZV8gPSBPUEVORUQ7XG4gICAgICByZXR1cm4gdGhpcy52YWx1ZV87XG4gICAgfSxcblxuICAgIGNsb3NlOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBPUEVORUQpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgcmVtb3ZlRnJvbUFsbCh0aGlzKTtcbiAgICAgIHRoaXMuZGlzY29ubmVjdF8oKTtcbiAgICAgIHRoaXMudmFsdWVfID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5jYWxsYmFja18gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLnRhcmdldF8gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLnN0YXRlXyA9IENMT1NFRDtcbiAgICB9LFxuXG4gICAgZGVsaXZlcjogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gT1BFTkVEKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIGRpcnR5Q2hlY2sodGhpcyk7XG4gICAgfSxcblxuICAgIHJlcG9ydF86IGZ1bmN0aW9uKGNoYW5nZXMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHRoaXMuY2FsbGJhY2tfLmFwcGx5KHRoaXMudGFyZ2V0XywgY2hhbmdlcyk7XG4gICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICBPYnNlcnZlci5fZXJyb3JUaHJvd25EdXJpbmdDYWxsYmFjayA9IHRydWU7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0V4Y2VwdGlvbiBjYXVnaHQgZHVyaW5nIG9ic2VydmVyIGNhbGxiYWNrOiAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgKGV4LnN0YWNrIHx8IGV4KSk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIGRpc2NhcmRDaGFuZ2VzOiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuY2hlY2tfKHVuZGVmaW5lZCwgdHJ1ZSk7XG4gICAgICByZXR1cm4gdGhpcy52YWx1ZV87XG4gICAgfVxuICB9XG5cbiAgdmFyIGNvbGxlY3RPYnNlcnZlcnMgPSAhaGFzT2JzZXJ2ZTtcbiAgdmFyIGFsbE9ic2VydmVycztcbiAgT2JzZXJ2ZXIuX2FsbE9ic2VydmVyc0NvdW50ID0gMDtcblxuICBpZiAoY29sbGVjdE9ic2VydmVycykge1xuICAgIGFsbE9ic2VydmVycyA9IFtdO1xuICB9XG5cbiAgZnVuY3Rpb24gYWRkVG9BbGwob2JzZXJ2ZXIpIHtcbiAgICBPYnNlcnZlci5fYWxsT2JzZXJ2ZXJzQ291bnQrKztcbiAgICBpZiAoIWNvbGxlY3RPYnNlcnZlcnMpXG4gICAgICByZXR1cm47XG5cbiAgICBhbGxPYnNlcnZlcnMucHVzaChvYnNlcnZlcik7XG4gIH1cblxuICBmdW5jdGlvbiByZW1vdmVGcm9tQWxsKG9ic2VydmVyKSB7XG4gICAgT2JzZXJ2ZXIuX2FsbE9ic2VydmVyc0NvdW50LS07XG4gIH1cblxuICB2YXIgcnVubmluZ01pY3JvdGFza0NoZWNrcG9pbnQgPSBmYWxzZTtcblxuICB2YXIgaGFzRGVidWdGb3JjZUZ1bGxEZWxpdmVyeSA9IGhhc09ic2VydmUgJiYgaGFzRXZhbCAmJiAoZnVuY3Rpb24oKSB7XG4gICAgdHJ5IHtcbiAgICAgIGV2YWwoJyVSdW5NaWNyb3Rhc2tzKCknKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9KSgpO1xuXG4gIGdsb2JhbC5QbGF0Zm9ybSA9IGdsb2JhbC5QbGF0Zm9ybSB8fCB7fTtcblxuICBnbG9iYWwuUGxhdGZvcm0ucGVyZm9ybU1pY3JvdGFza0NoZWNrcG9pbnQgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAocnVubmluZ01pY3JvdGFza0NoZWNrcG9pbnQpXG4gICAgICByZXR1cm47XG5cbiAgICBpZiAoaGFzRGVidWdGb3JjZUZ1bGxEZWxpdmVyeSkge1xuICAgICAgZXZhbCgnJVJ1bk1pY3JvdGFza3MoKScpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICghY29sbGVjdE9ic2VydmVycylcbiAgICAgIHJldHVybjtcblxuICAgIHJ1bm5pbmdNaWNyb3Rhc2tDaGVja3BvaW50ID0gdHJ1ZTtcblxuICAgIHZhciBjeWNsZXMgPSAwO1xuICAgIHZhciBhbnlDaGFuZ2VkLCB0b0NoZWNrO1xuXG4gICAgZG8ge1xuICAgICAgY3ljbGVzKys7XG4gICAgICB0b0NoZWNrID0gYWxsT2JzZXJ2ZXJzO1xuICAgICAgYWxsT2JzZXJ2ZXJzID0gW107XG4gICAgICBhbnlDaGFuZ2VkID0gZmFsc2U7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdG9DaGVjay5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgb2JzZXJ2ZXIgPSB0b0NoZWNrW2ldO1xuICAgICAgICBpZiAob2JzZXJ2ZXIuc3RhdGVfICE9IE9QRU5FRClcbiAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICBpZiAob2JzZXJ2ZXIuY2hlY2tfKCkpXG4gICAgICAgICAgYW55Q2hhbmdlZCA9IHRydWU7XG5cbiAgICAgICAgYWxsT2JzZXJ2ZXJzLnB1c2gob2JzZXJ2ZXIpO1xuICAgICAgfVxuICAgICAgaWYgKHJ1bkVPTVRhc2tzKCkpXG4gICAgICAgIGFueUNoYW5nZWQgPSB0cnVlO1xuICAgIH0gd2hpbGUgKGN5Y2xlcyA8IE1BWF9ESVJUWV9DSEVDS19DWUNMRVMgJiYgYW55Q2hhbmdlZCk7XG5cbiAgICBpZiAodGVzdGluZ0V4cG9zZUN5Y2xlQ291bnQpXG4gICAgICBnbG9iYWwuZGlydHlDaGVja0N5Y2xlQ291bnQgPSBjeWNsZXM7XG5cbiAgICBydW5uaW5nTWljcm90YXNrQ2hlY2twb2ludCA9IGZhbHNlO1xuICB9O1xuXG4gIGlmIChjb2xsZWN0T2JzZXJ2ZXJzKSB7XG4gICAgZ2xvYmFsLlBsYXRmb3JtLmNsZWFyT2JzZXJ2ZXJzID0gZnVuY3Rpb24oKSB7XG4gICAgICBhbGxPYnNlcnZlcnMgPSBbXTtcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gT2JqZWN0T2JzZXJ2ZXIob2JqZWN0KSB7XG4gICAgT2JzZXJ2ZXIuY2FsbCh0aGlzKTtcbiAgICB0aGlzLnZhbHVlXyA9IG9iamVjdDtcbiAgICB0aGlzLm9sZE9iamVjdF8gPSB1bmRlZmluZWQ7XG4gIH1cblxuICBPYmplY3RPYnNlcnZlci5wcm90b3R5cGUgPSBjcmVhdGVPYmplY3Qoe1xuICAgIF9fcHJvdG9fXzogT2JzZXJ2ZXIucHJvdG90eXBlLFxuXG4gICAgYXJyYXlPYnNlcnZlOiBmYWxzZSxcblxuICAgIGNvbm5lY3RfOiBmdW5jdGlvbihjYWxsYmFjaywgdGFyZ2V0KSB7XG4gICAgICBpZiAoaGFzT2JzZXJ2ZSkge1xuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXyA9IGdldE9ic2VydmVkT2JqZWN0KHRoaXMsIHRoaXMudmFsdWVfLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXJyYXlPYnNlcnZlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMub2xkT2JqZWN0XyA9IHRoaXMuY29weU9iamVjdCh0aGlzLnZhbHVlXyk7XG4gICAgICB9XG5cbiAgICB9LFxuXG4gICAgY29weU9iamVjdDogZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgICB2YXIgY29weSA9IEFycmF5LmlzQXJyYXkob2JqZWN0KSA/IFtdIDoge307XG4gICAgICBmb3IgKHZhciBwcm9wIGluIG9iamVjdCkge1xuICAgICAgICBjb3B5W3Byb3BdID0gb2JqZWN0W3Byb3BdO1xuICAgICAgfTtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KG9iamVjdCkpXG4gICAgICAgIGNvcHkubGVuZ3RoID0gb2JqZWN0Lmxlbmd0aDtcbiAgICAgIHJldHVybiBjb3B5O1xuICAgIH0sXG5cbiAgICBjaGVja186IGZ1bmN0aW9uKGNoYW5nZVJlY29yZHMsIHNraXBDaGFuZ2VzKSB7XG4gICAgICB2YXIgZGlmZjtcbiAgICAgIHZhciBvbGRWYWx1ZXM7XG4gICAgICBpZiAoaGFzT2JzZXJ2ZSkge1xuICAgICAgICBpZiAoIWNoYW5nZVJlY29yZHMpXG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIG9sZFZhbHVlcyA9IHt9O1xuICAgICAgICBkaWZmID0gZGlmZk9iamVjdEZyb21DaGFuZ2VSZWNvcmRzKHRoaXMudmFsdWVfLCBjaGFuZ2VSZWNvcmRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlcyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvbGRWYWx1ZXMgPSB0aGlzLm9sZE9iamVjdF87XG4gICAgICAgIGRpZmYgPSBkaWZmT2JqZWN0RnJvbU9sZE9iamVjdCh0aGlzLnZhbHVlXywgdGhpcy5vbGRPYmplY3RfKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGRpZmZJc0VtcHR5KGRpZmYpKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgIGlmICghaGFzT2JzZXJ2ZSlcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdGhpcy5jb3B5T2JqZWN0KHRoaXMudmFsdWVfKTtcblxuICAgICAgdGhpcy5yZXBvcnRfKFtcbiAgICAgICAgZGlmZi5hZGRlZCB8fCB7fSxcbiAgICAgICAgZGlmZi5yZW1vdmVkIHx8IHt9LFxuICAgICAgICBkaWZmLmNoYW5nZWQgfHwge30sXG4gICAgICAgIGZ1bmN0aW9uKHByb3BlcnR5KSB7XG4gICAgICAgICAgcmV0dXJuIG9sZFZhbHVlc1twcm9wZXJ0eV07XG4gICAgICAgIH1cbiAgICAgIF0pO1xuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9LFxuXG4gICAgZGlzY29ubmVjdF86IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKGhhc09ic2VydmUpIHtcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8uY2xvc2UoKTtcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8gPSB1bmRlZmluZWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm9sZE9iamVjdF8gPSB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgfSxcblxuICAgIGRlbGl2ZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuc3RhdGVfICE9IE9QRU5FRClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICBpZiAoaGFzT2JzZXJ2ZSlcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8uZGVsaXZlcihmYWxzZSk7XG4gICAgICBlbHNlXG4gICAgICAgIGRpcnR5Q2hlY2sodGhpcyk7XG4gICAgfSxcblxuICAgIGRpc2NhcmRDaGFuZ2VzOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLmRpcmVjdE9ic2VydmVyXylcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8uZGVsaXZlcih0cnVlKTtcbiAgICAgIGVsc2VcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdGhpcy5jb3B5T2JqZWN0KHRoaXMudmFsdWVfKTtcblxuICAgICAgcmV0dXJuIHRoaXMudmFsdWVfO1xuICAgIH1cbiAgfSk7XG5cbiAgZnVuY3Rpb24gQXJyYXlPYnNlcnZlcihhcnJheSkge1xuICAgIGlmICghQXJyYXkuaXNBcnJheShhcnJheSkpXG4gICAgICB0aHJvdyBFcnJvcignUHJvdmlkZWQgb2JqZWN0IGlzIG5vdCBhbiBBcnJheScpO1xuICAgIE9iamVjdE9ic2VydmVyLmNhbGwodGhpcywgYXJyYXkpO1xuICB9XG5cbiAgQXJyYXlPYnNlcnZlci5wcm90b3R5cGUgPSBjcmVhdGVPYmplY3Qoe1xuXG4gICAgX19wcm90b19fOiBPYmplY3RPYnNlcnZlci5wcm90b3R5cGUsXG5cbiAgICBhcnJheU9ic2VydmU6IHRydWUsXG5cbiAgICBjb3B5T2JqZWN0OiBmdW5jdGlvbihhcnIpIHtcbiAgICAgIHJldHVybiBhcnIuc2xpY2UoKTtcbiAgICB9LFxuXG4gICAgY2hlY2tfOiBmdW5jdGlvbihjaGFuZ2VSZWNvcmRzKSB7XG4gICAgICB2YXIgc3BsaWNlcztcbiAgICAgIGlmIChoYXNPYnNlcnZlKSB7XG4gICAgICAgIGlmICghY2hhbmdlUmVjb3JkcylcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIHNwbGljZXMgPSBwcm9qZWN0QXJyYXlTcGxpY2VzKHRoaXMudmFsdWVfLCBjaGFuZ2VSZWNvcmRzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNwbGljZXMgPSBjYWxjU3BsaWNlcyh0aGlzLnZhbHVlXywgMCwgdGhpcy52YWx1ZV8ubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5vbGRPYmplY3RfLCAwLCB0aGlzLm9sZE9iamVjdF8ubGVuZ3RoKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFzcGxpY2VzIHx8ICFzcGxpY2VzLmxlbmd0aClcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICBpZiAoIWhhc09ic2VydmUpXG4gICAgICAgIHRoaXMub2xkT2JqZWN0XyA9IHRoaXMuY29weU9iamVjdCh0aGlzLnZhbHVlXyk7XG5cbiAgICAgIHRoaXMucmVwb3J0Xyhbc3BsaWNlc10pO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9KTtcblxuICBBcnJheU9ic2VydmVyLmFwcGx5U3BsaWNlcyA9IGZ1bmN0aW9uKHByZXZpb3VzLCBjdXJyZW50LCBzcGxpY2VzKSB7XG4gICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uKHNwbGljZSkge1xuICAgICAgdmFyIHNwbGljZUFyZ3MgPSBbc3BsaWNlLmluZGV4LCBzcGxpY2UucmVtb3ZlZC5sZW5ndGhdO1xuICAgICAgdmFyIGFkZEluZGV4ID0gc3BsaWNlLmluZGV4O1xuICAgICAgd2hpbGUgKGFkZEluZGV4IDwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQpIHtcbiAgICAgICAgc3BsaWNlQXJncy5wdXNoKGN1cnJlbnRbYWRkSW5kZXhdKTtcbiAgICAgICAgYWRkSW5kZXgrKztcbiAgICAgIH1cblxuICAgICAgQXJyYXkucHJvdG90eXBlLnNwbGljZS5hcHBseShwcmV2aW91cywgc3BsaWNlQXJncyk7XG4gICAgfSk7XG4gIH07XG5cbiAgdmFyIG9ic2VydmVyU2VudGluZWwgPSB7fTtcblxuICB2YXIgZXhwZWN0ZWRSZWNvcmRUeXBlcyA9IHtcbiAgICBhZGQ6IHRydWUsXG4gICAgdXBkYXRlOiB0cnVlLFxuICAgIGRlbGV0ZTogdHJ1ZVxuICB9O1xuXG4gIGZ1bmN0aW9uIGRpZmZPYmplY3RGcm9tQ2hhbmdlUmVjb3JkcyhvYmplY3QsIGNoYW5nZVJlY29yZHMsIG9sZFZhbHVlcykge1xuICAgIHZhciBhZGRlZCA9IHt9O1xuICAgIHZhciByZW1vdmVkID0ge307XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoYW5nZVJlY29yZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciByZWNvcmQgPSBjaGFuZ2VSZWNvcmRzW2ldO1xuICAgICAgaWYgKCFleHBlY3RlZFJlY29yZFR5cGVzW3JlY29yZC50eXBlXSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdVbmtub3duIGNoYW5nZVJlY29yZCB0eXBlOiAnICsgcmVjb3JkLnR5cGUpO1xuICAgICAgICBjb25zb2xlLmVycm9yKHJlY29yZCk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoIShyZWNvcmQubmFtZSBpbiBvbGRWYWx1ZXMpKVxuICAgICAgICBvbGRWYWx1ZXNbcmVjb3JkLm5hbWVdID0gcmVjb3JkLm9sZFZhbHVlO1xuXG4gICAgICBpZiAocmVjb3JkLnR5cGUgPT0gJ3VwZGF0ZScpXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICBpZiAocmVjb3JkLnR5cGUgPT0gJ2FkZCcpIHtcbiAgICAgICAgaWYgKHJlY29yZC5uYW1lIGluIHJlbW92ZWQpXG4gICAgICAgICAgZGVsZXRlIHJlbW92ZWRbcmVjb3JkLm5hbWVdO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgYWRkZWRbcmVjb3JkLm5hbWVdID0gdHJ1ZTtcblxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gdHlwZSA9ICdkZWxldGUnXG4gICAgICBpZiAocmVjb3JkLm5hbWUgaW4gYWRkZWQpIHtcbiAgICAgICAgZGVsZXRlIGFkZGVkW3JlY29yZC5uYW1lXTtcbiAgICAgICAgZGVsZXRlIG9sZFZhbHVlc1tyZWNvcmQubmFtZV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZW1vdmVkW3JlY29yZC5uYW1lXSA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yICh2YXIgcHJvcCBpbiBhZGRlZClcbiAgICAgIGFkZGVkW3Byb3BdID0gb2JqZWN0W3Byb3BdO1xuXG4gICAgZm9yICh2YXIgcHJvcCBpbiByZW1vdmVkKVxuICAgICAgcmVtb3ZlZFtwcm9wXSA9IHVuZGVmaW5lZDtcblxuICAgIHZhciBjaGFuZ2VkID0ge307XG4gICAgZm9yICh2YXIgcHJvcCBpbiBvbGRWYWx1ZXMpIHtcbiAgICAgIGlmIChwcm9wIGluIGFkZGVkIHx8IHByb3AgaW4gcmVtb3ZlZClcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIHZhciBuZXdWYWx1ZSA9IG9iamVjdFtwcm9wXTtcbiAgICAgIGlmIChvbGRWYWx1ZXNbcHJvcF0gIT09IG5ld1ZhbHVlKVxuICAgICAgICBjaGFuZ2VkW3Byb3BdID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICBjaGFuZ2VkOiBjaGFuZ2VkXG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG5ld1NwbGljZShpbmRleCwgcmVtb3ZlZCwgYWRkZWRDb3VudCkge1xuICAgIHJldHVybiB7XG4gICAgICBpbmRleDogaW5kZXgsXG4gICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgYWRkZWRDb3VudDogYWRkZWRDb3VudFxuICAgIH07XG4gIH1cblxuICB2YXIgRURJVF9MRUFWRSA9IDA7XG4gIHZhciBFRElUX1VQREFURSA9IDE7XG4gIHZhciBFRElUX0FERCA9IDI7XG4gIHZhciBFRElUX0RFTEVURSA9IDM7XG5cbiAgZnVuY3Rpb24gQXJyYXlTcGxpY2UoKSB7fVxuXG4gIEFycmF5U3BsaWNlLnByb3RvdHlwZSA9IHtcblxuICAgIC8vIE5vdGU6IFRoaXMgZnVuY3Rpb24gaXMgKmJhc2VkKiBvbiB0aGUgY29tcHV0YXRpb24gb2YgdGhlIExldmVuc2h0ZWluXG4gICAgLy8gXCJlZGl0XCIgZGlzdGFuY2UuIFRoZSBvbmUgY2hhbmdlIGlzIHRoYXQgXCJ1cGRhdGVzXCIgYXJlIHRyZWF0ZWQgYXMgdHdvXG4gICAgLy8gZWRpdHMgLSBub3Qgb25lLiBXaXRoIEFycmF5IHNwbGljZXMsIGFuIHVwZGF0ZSBpcyByZWFsbHkgYSBkZWxldGVcbiAgICAvLyBmb2xsb3dlZCBieSBhbiBhZGQuIEJ5IHJldGFpbmluZyB0aGlzLCB3ZSBvcHRpbWl6ZSBmb3IgXCJrZWVwaW5nXCIgdGhlXG4gICAgLy8gbWF4aW11bSBhcnJheSBpdGVtcyBpbiB0aGUgb3JpZ2luYWwgYXJyYXkuIEZvciBleGFtcGxlOlxuICAgIC8vXG4gICAgLy8gICAneHh4eDEyMycgLT4gJzEyM3l5eXknXG4gICAgLy9cbiAgICAvLyBXaXRoIDEtZWRpdCB1cGRhdGVzLCB0aGUgc2hvcnRlc3QgcGF0aCB3b3VsZCBiZSBqdXN0IHRvIHVwZGF0ZSBhbGwgc2V2ZW5cbiAgICAvLyBjaGFyYWN0ZXJzLiBXaXRoIDItZWRpdCB1cGRhdGVzLCB3ZSBkZWxldGUgNCwgbGVhdmUgMywgYW5kIGFkZCA0LiBUaGlzXG4gICAgLy8gbGVhdmVzIHRoZSBzdWJzdHJpbmcgJzEyMycgaW50YWN0LlxuICAgIGNhbGNFZGl0RGlzdGFuY2VzOiBmdW5jdGlvbihjdXJyZW50LCBjdXJyZW50U3RhcnQsIGN1cnJlbnRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZCwgb2xkU3RhcnQsIG9sZEVuZCkge1xuICAgICAgLy8gXCJEZWxldGlvblwiIGNvbHVtbnNcbiAgICAgIHZhciByb3dDb3VudCA9IG9sZEVuZCAtIG9sZFN0YXJ0ICsgMTtcbiAgICAgIHZhciBjb2x1bW5Db3VudCA9IGN1cnJlbnRFbmQgLSBjdXJyZW50U3RhcnQgKyAxO1xuICAgICAgdmFyIGRpc3RhbmNlcyA9IG5ldyBBcnJheShyb3dDb3VudCk7XG5cbiAgICAgIC8vIFwiQWRkaXRpb25cIiByb3dzLiBJbml0aWFsaXplIG51bGwgY29sdW1uLlxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByb3dDb3VudDsgaSsrKSB7XG4gICAgICAgIGRpc3RhbmNlc1tpXSA9IG5ldyBBcnJheShjb2x1bW5Db3VudCk7XG4gICAgICAgIGRpc3RhbmNlc1tpXVswXSA9IGk7XG4gICAgICB9XG5cbiAgICAgIC8vIEluaXRpYWxpemUgbnVsbCByb3dcbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgY29sdW1uQ291bnQ7IGorKylcbiAgICAgICAgZGlzdGFuY2VzWzBdW2pdID0gajtcblxuICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCByb3dDb3VudDsgaSsrKSB7XG4gICAgICAgIGZvciAodmFyIGogPSAxOyBqIDwgY29sdW1uQ291bnQ7IGorKykge1xuICAgICAgICAgIGlmICh0aGlzLmVxdWFscyhjdXJyZW50W2N1cnJlbnRTdGFydCArIGogLSAxXSwgb2xkW29sZFN0YXJ0ICsgaSAtIDFdKSlcbiAgICAgICAgICAgIGRpc3RhbmNlc1tpXVtqXSA9IGRpc3RhbmNlc1tpIC0gMV1baiAtIDFdO1xuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdmFyIG5vcnRoID0gZGlzdGFuY2VzW2kgLSAxXVtqXSArIDE7XG4gICAgICAgICAgICB2YXIgd2VzdCA9IGRpc3RhbmNlc1tpXVtqIC0gMV0gKyAxO1xuICAgICAgICAgICAgZGlzdGFuY2VzW2ldW2pdID0gbm9ydGggPCB3ZXN0ID8gbm9ydGggOiB3ZXN0O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gZGlzdGFuY2VzO1xuICAgIH0sXG5cbiAgICAvLyBUaGlzIHN0YXJ0cyBhdCB0aGUgZmluYWwgd2VpZ2h0LCBhbmQgd2Fsa3MgXCJiYWNrd2FyZFwiIGJ5IGZpbmRpbmdcbiAgICAvLyB0aGUgbWluaW11bSBwcmV2aW91cyB3ZWlnaHQgcmVjdXJzaXZlbHkgdW50aWwgdGhlIG9yaWdpbiBvZiB0aGUgd2VpZ2h0XG4gICAgLy8gbWF0cml4LlxuICAgIHNwbGljZU9wZXJhdGlvbnNGcm9tRWRpdERpc3RhbmNlczogZnVuY3Rpb24oZGlzdGFuY2VzKSB7XG4gICAgICB2YXIgaSA9IGRpc3RhbmNlcy5sZW5ndGggLSAxO1xuICAgICAgdmFyIGogPSBkaXN0YW5jZXNbMF0ubGVuZ3RoIC0gMTtcbiAgICAgIHZhciBjdXJyZW50ID0gZGlzdGFuY2VzW2ldW2pdO1xuICAgICAgdmFyIGVkaXRzID0gW107XG4gICAgICB3aGlsZSAoaSA+IDAgfHwgaiA+IDApIHtcbiAgICAgICAgaWYgKGkgPT0gMCkge1xuICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9BREQpO1xuICAgICAgICAgIGotLTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaiA9PSAwKSB7XG4gICAgICAgICAgZWRpdHMucHVzaChFRElUX0RFTEVURSk7XG4gICAgICAgICAgaS0tO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHZhciBub3J0aFdlc3QgPSBkaXN0YW5jZXNbaSAtIDFdW2ogLSAxXTtcbiAgICAgICAgdmFyIHdlc3QgPSBkaXN0YW5jZXNbaSAtIDFdW2pdO1xuICAgICAgICB2YXIgbm9ydGggPSBkaXN0YW5jZXNbaV1baiAtIDFdO1xuXG4gICAgICAgIHZhciBtaW47XG4gICAgICAgIGlmICh3ZXN0IDwgbm9ydGgpXG4gICAgICAgICAgbWluID0gd2VzdCA8IG5vcnRoV2VzdCA/IHdlc3QgOiBub3J0aFdlc3Q7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBtaW4gPSBub3J0aCA8IG5vcnRoV2VzdCA/IG5vcnRoIDogbm9ydGhXZXN0O1xuXG4gICAgICAgIGlmIChtaW4gPT0gbm9ydGhXZXN0KSB7XG4gICAgICAgICAgaWYgKG5vcnRoV2VzdCA9PSBjdXJyZW50KSB7XG4gICAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfTEVBVkUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfVVBEQVRFKTtcbiAgICAgICAgICAgIGN1cnJlbnQgPSBub3J0aFdlc3Q7XG4gICAgICAgICAgfVxuICAgICAgICAgIGktLTtcbiAgICAgICAgICBqLS07XG4gICAgICAgIH0gZWxzZSBpZiAobWluID09IHdlc3QpIHtcbiAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfREVMRVRFKTtcbiAgICAgICAgICBpLS07XG4gICAgICAgICAgY3VycmVudCA9IHdlc3Q7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZWRpdHMucHVzaChFRElUX0FERCk7XG4gICAgICAgICAgai0tO1xuICAgICAgICAgIGN1cnJlbnQgPSBub3J0aDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBlZGl0cy5yZXZlcnNlKCk7XG4gICAgICByZXR1cm4gZWRpdHM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFNwbGljZSBQcm9qZWN0aW9uIGZ1bmN0aW9uczpcbiAgICAgKlxuICAgICAqIEEgc3BsaWNlIG1hcCBpcyBhIHJlcHJlc2VudGF0aW9uIG9mIGhvdyBhIHByZXZpb3VzIGFycmF5IG9mIGl0ZW1zXG4gICAgICogd2FzIHRyYW5zZm9ybWVkIGludG8gYSBuZXcgYXJyYXkgb2YgaXRlbXMuIENvbmNlcHR1YWxseSBpdCBpcyBhIGxpc3Qgb2ZcbiAgICAgKiB0dXBsZXMgb2ZcbiAgICAgKlxuICAgICAqICAgPGluZGV4LCByZW1vdmVkLCBhZGRlZENvdW50PlxuICAgICAqXG4gICAgICogd2hpY2ggYXJlIGtlcHQgaW4gYXNjZW5kaW5nIGluZGV4IG9yZGVyIG9mLiBUaGUgdHVwbGUgcmVwcmVzZW50cyB0aGF0IGF0XG4gICAgICogdGhlIHxpbmRleHwsIHxyZW1vdmVkfCBzZXF1ZW5jZSBvZiBpdGVtcyB3ZXJlIHJlbW92ZWQsIGFuZCBjb3VudGluZyBmb3J3YXJkXG4gICAgICogZnJvbSB8aW5kZXh8LCB8YWRkZWRDb3VudHwgaXRlbXMgd2VyZSBhZGRlZC5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIExhY2tpbmcgaW5kaXZpZHVhbCBzcGxpY2UgbXV0YXRpb24gaW5mb3JtYXRpb24sIHRoZSBtaW5pbWFsIHNldCBvZlxuICAgICAqIHNwbGljZXMgY2FuIGJlIHN5bnRoZXNpemVkIGdpdmVuIHRoZSBwcmV2aW91cyBzdGF0ZSBhbmQgZmluYWwgc3RhdGUgb2YgYW5cbiAgICAgKiBhcnJheS4gVGhlIGJhc2ljIGFwcHJvYWNoIGlzIHRvIGNhbGN1bGF0ZSB0aGUgZWRpdCBkaXN0YW5jZSBtYXRyaXggYW5kXG4gICAgICogY2hvb3NlIHRoZSBzaG9ydGVzdCBwYXRoIHRocm91Z2ggaXQuXG4gICAgICpcbiAgICAgKiBDb21wbGV4aXR5OiBPKGwgKiBwKVxuICAgICAqICAgbDogVGhlIGxlbmd0aCBvZiB0aGUgY3VycmVudCBhcnJheVxuICAgICAqICAgcDogVGhlIGxlbmd0aCBvZiB0aGUgb2xkIGFycmF5XG4gICAgICovXG4gICAgY2FsY1NwbGljZXM6IGZ1bmN0aW9uKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKSB7XG4gICAgICB2YXIgcHJlZml4Q291bnQgPSAwO1xuICAgICAgdmFyIHN1ZmZpeENvdW50ID0gMDtcblxuICAgICAgdmFyIG1pbkxlbmd0aCA9IE1hdGgubWluKGN1cnJlbnRFbmQgLSBjdXJyZW50U3RhcnQsIG9sZEVuZCAtIG9sZFN0YXJ0KTtcbiAgICAgIGlmIChjdXJyZW50U3RhcnQgPT0gMCAmJiBvbGRTdGFydCA9PSAwKVxuICAgICAgICBwcmVmaXhDb3VudCA9IHRoaXMuc2hhcmVkUHJlZml4KGN1cnJlbnQsIG9sZCwgbWluTGVuZ3RoKTtcblxuICAgICAgaWYgKGN1cnJlbnRFbmQgPT0gY3VycmVudC5sZW5ndGggJiYgb2xkRW5kID09IG9sZC5sZW5ndGgpXG4gICAgICAgIHN1ZmZpeENvdW50ID0gdGhpcy5zaGFyZWRTdWZmaXgoY3VycmVudCwgb2xkLCBtaW5MZW5ndGggLSBwcmVmaXhDb3VudCk7XG5cbiAgICAgIGN1cnJlbnRTdGFydCArPSBwcmVmaXhDb3VudDtcbiAgICAgIG9sZFN0YXJ0ICs9IHByZWZpeENvdW50O1xuICAgICAgY3VycmVudEVuZCAtPSBzdWZmaXhDb3VudDtcbiAgICAgIG9sZEVuZCAtPSBzdWZmaXhDb3VudDtcblxuICAgICAgaWYgKGN1cnJlbnRFbmQgLSBjdXJyZW50U3RhcnQgPT0gMCAmJiBvbGRFbmQgLSBvbGRTdGFydCA9PSAwKVxuICAgICAgICByZXR1cm4gW107XG5cbiAgICAgIGlmIChjdXJyZW50U3RhcnQgPT0gY3VycmVudEVuZCkge1xuICAgICAgICB2YXIgc3BsaWNlID0gbmV3U3BsaWNlKGN1cnJlbnRTdGFydCwgW10sIDApO1xuICAgICAgICB3aGlsZSAob2xkU3RhcnQgPCBvbGRFbmQpXG4gICAgICAgICAgc3BsaWNlLnJlbW92ZWQucHVzaChvbGRbb2xkU3RhcnQrK10pO1xuXG4gICAgICAgIHJldHVybiBbIHNwbGljZSBdO1xuICAgICAgfSBlbHNlIGlmIChvbGRTdGFydCA9PSBvbGRFbmQpXG4gICAgICAgIHJldHVybiBbIG5ld1NwbGljZShjdXJyZW50U3RhcnQsIFtdLCBjdXJyZW50RW5kIC0gY3VycmVudFN0YXJ0KSBdO1xuXG4gICAgICB2YXIgb3BzID0gdGhpcy5zcGxpY2VPcGVyYXRpb25zRnJvbUVkaXREaXN0YW5jZXMoXG4gICAgICAgICAgdGhpcy5jYWxjRWRpdERpc3RhbmNlcyhjdXJyZW50LCBjdXJyZW50U3RhcnQsIGN1cnJlbnRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGQsIG9sZFN0YXJ0LCBvbGRFbmQpKTtcblxuICAgICAgdmFyIHNwbGljZSA9IHVuZGVmaW5lZDtcbiAgICAgIHZhciBzcGxpY2VzID0gW107XG4gICAgICB2YXIgaW5kZXggPSBjdXJyZW50U3RhcnQ7XG4gICAgICB2YXIgb2xkSW5kZXggPSBvbGRTdGFydDtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHN3aXRjaChvcHNbaV0pIHtcbiAgICAgICAgICBjYXNlIEVESVRfTEVBVkU6XG4gICAgICAgICAgICBpZiAoc3BsaWNlKSB7XG4gICAgICAgICAgICAgIHNwbGljZXMucHVzaChzcGxpY2UpO1xuICAgICAgICAgICAgICBzcGxpY2UgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgICAgICBvbGRJbmRleCsrO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBFRElUX1VQREFURTpcbiAgICAgICAgICAgIGlmICghc3BsaWNlKVxuICAgICAgICAgICAgICBzcGxpY2UgPSBuZXdTcGxpY2UoaW5kZXgsIFtdLCAwKTtcblxuICAgICAgICAgICAgc3BsaWNlLmFkZGVkQ291bnQrKztcbiAgICAgICAgICAgIGluZGV4Kys7XG5cbiAgICAgICAgICAgIHNwbGljZS5yZW1vdmVkLnB1c2gob2xkW29sZEluZGV4XSk7XG4gICAgICAgICAgICBvbGRJbmRleCsrO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBFRElUX0FERDpcbiAgICAgICAgICAgIGlmICghc3BsaWNlKVxuICAgICAgICAgICAgICBzcGxpY2UgPSBuZXdTcGxpY2UoaW5kZXgsIFtdLCAwKTtcblxuICAgICAgICAgICAgc3BsaWNlLmFkZGVkQ291bnQrKztcbiAgICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIEVESVRfREVMRVRFOlxuICAgICAgICAgICAgaWYgKCFzcGxpY2UpXG4gICAgICAgICAgICAgIHNwbGljZSA9IG5ld1NwbGljZShpbmRleCwgW10sIDApO1xuXG4gICAgICAgICAgICBzcGxpY2UucmVtb3ZlZC5wdXNoKG9sZFtvbGRJbmRleF0pO1xuICAgICAgICAgICAgb2xkSW5kZXgrKztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChzcGxpY2UpIHtcbiAgICAgICAgc3BsaWNlcy5wdXNoKHNwbGljZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gc3BsaWNlcztcbiAgICB9LFxuXG4gICAgc2hhcmVkUHJlZml4OiBmdW5jdGlvbihjdXJyZW50LCBvbGQsIHNlYXJjaExlbmd0aCkge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzZWFyY2hMZW5ndGg7IGkrKylcbiAgICAgICAgaWYgKCF0aGlzLmVxdWFscyhjdXJyZW50W2ldLCBvbGRbaV0pKVxuICAgICAgICAgIHJldHVybiBpO1xuICAgICAgcmV0dXJuIHNlYXJjaExlbmd0aDtcbiAgICB9LFxuXG4gICAgc2hhcmVkU3VmZml4OiBmdW5jdGlvbihjdXJyZW50LCBvbGQsIHNlYXJjaExlbmd0aCkge1xuICAgICAgdmFyIGluZGV4MSA9IGN1cnJlbnQubGVuZ3RoO1xuICAgICAgdmFyIGluZGV4MiA9IG9sZC5sZW5ndGg7XG4gICAgICB2YXIgY291bnQgPSAwO1xuICAgICAgd2hpbGUgKGNvdW50IDwgc2VhcmNoTGVuZ3RoICYmIHRoaXMuZXF1YWxzKGN1cnJlbnRbLS1pbmRleDFdLCBvbGRbLS1pbmRleDJdKSlcbiAgICAgICAgY291bnQrKztcblxuICAgICAgcmV0dXJuIGNvdW50O1xuICAgIH0sXG5cbiAgICBjYWxjdWxhdGVTcGxpY2VzOiBmdW5jdGlvbihjdXJyZW50LCBwcmV2aW91cykge1xuICAgICAgcmV0dXJuIHRoaXMuY2FsY1NwbGljZXMoY3VycmVudCwgMCwgY3VycmVudC5sZW5ndGgsIHByZXZpb3VzLCAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJldmlvdXMubGVuZ3RoKTtcbiAgICB9LFxuXG4gICAgZXF1YWxzOiBmdW5jdGlvbihjdXJyZW50VmFsdWUsIHByZXZpb3VzVmFsdWUpIHtcbiAgICAgIHJldHVybiBjdXJyZW50VmFsdWUgPT09IHByZXZpb3VzVmFsdWU7XG4gICAgfVxuICB9O1xuXG4gIHZhciBhcnJheVNwbGljZSA9IG5ldyBBcnJheVNwbGljZSgpO1xuXG4gIGZ1bmN0aW9uIGNhbGNTcGxpY2VzKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKSB7XG4gICAgcmV0dXJuIGFycmF5U3BsaWNlLmNhbGNTcGxpY2VzKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGludGVyc2VjdChzdGFydDEsIGVuZDEsIHN0YXJ0MiwgZW5kMikge1xuICAgIC8vIERpc2pvaW50XG4gICAgaWYgKGVuZDEgPCBzdGFydDIgfHwgZW5kMiA8IHN0YXJ0MSlcbiAgICAgIHJldHVybiAtMTtcblxuICAgIC8vIEFkamFjZW50XG4gICAgaWYgKGVuZDEgPT0gc3RhcnQyIHx8IGVuZDIgPT0gc3RhcnQxKVxuICAgICAgcmV0dXJuIDA7XG5cbiAgICAvLyBOb24temVybyBpbnRlcnNlY3QsIHNwYW4xIGZpcnN0XG4gICAgaWYgKHN0YXJ0MSA8IHN0YXJ0Mikge1xuICAgICAgaWYgKGVuZDEgPCBlbmQyKVxuICAgICAgICByZXR1cm4gZW5kMSAtIHN0YXJ0MjsgLy8gT3ZlcmxhcFxuICAgICAgZWxzZVxuICAgICAgICByZXR1cm4gZW5kMiAtIHN0YXJ0MjsgLy8gQ29udGFpbmVkXG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE5vbi16ZXJvIGludGVyc2VjdCwgc3BhbjIgZmlyc3RcbiAgICAgIGlmIChlbmQyIDwgZW5kMSlcbiAgICAgICAgcmV0dXJuIGVuZDIgLSBzdGFydDE7IC8vIE92ZXJsYXBcbiAgICAgIGVsc2VcbiAgICAgICAgcmV0dXJuIGVuZDEgLSBzdGFydDE7IC8vIENvbnRhaW5lZFxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG1lcmdlU3BsaWNlKHNwbGljZXMsIGluZGV4LCByZW1vdmVkLCBhZGRlZENvdW50KSB7XG5cbiAgICB2YXIgc3BsaWNlID0gbmV3U3BsaWNlKGluZGV4LCByZW1vdmVkLCBhZGRlZENvdW50KTtcblxuICAgIHZhciBpbnNlcnRlZCA9IGZhbHNlO1xuICAgIHZhciBpbnNlcnRpb25PZmZzZXQgPSAwO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzcGxpY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgY3VycmVudCA9IHNwbGljZXNbaV07XG4gICAgICBjdXJyZW50LmluZGV4ICs9IGluc2VydGlvbk9mZnNldDtcblxuICAgICAgaWYgKGluc2VydGVkKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgdmFyIGludGVyc2VjdENvdW50ID0gaW50ZXJzZWN0KHNwbGljZS5pbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcGxpY2UuaW5kZXggKyBzcGxpY2UucmVtb3ZlZC5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudC5pbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50LmluZGV4ICsgY3VycmVudC5hZGRlZENvdW50KTtcblxuICAgICAgaWYgKGludGVyc2VjdENvdW50ID49IDApIHtcbiAgICAgICAgLy8gTWVyZ2UgdGhlIHR3byBzcGxpY2VzXG5cbiAgICAgICAgc3BsaWNlcy5zcGxpY2UoaSwgMSk7XG4gICAgICAgIGktLTtcblxuICAgICAgICBpbnNlcnRpb25PZmZzZXQgLT0gY3VycmVudC5hZGRlZENvdW50IC0gY3VycmVudC5yZW1vdmVkLmxlbmd0aDtcblxuICAgICAgICBzcGxpY2UuYWRkZWRDb3VudCArPSBjdXJyZW50LmFkZGVkQ291bnQgLSBpbnRlcnNlY3RDb3VudDtcbiAgICAgICAgdmFyIGRlbGV0ZUNvdW50ID0gc3BsaWNlLnJlbW92ZWQubGVuZ3RoICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudC5yZW1vdmVkLmxlbmd0aCAtIGludGVyc2VjdENvdW50O1xuXG4gICAgICAgIGlmICghc3BsaWNlLmFkZGVkQ291bnQgJiYgIWRlbGV0ZUNvdW50KSB7XG4gICAgICAgICAgLy8gbWVyZ2VkIHNwbGljZSBpcyBhIG5vb3AuIGRpc2NhcmQuXG4gICAgICAgICAgaW5zZXJ0ZWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciByZW1vdmVkID0gY3VycmVudC5yZW1vdmVkO1xuXG4gICAgICAgICAgaWYgKHNwbGljZS5pbmRleCA8IGN1cnJlbnQuaW5kZXgpIHtcbiAgICAgICAgICAgIC8vIHNvbWUgcHJlZml4IG9mIHNwbGljZS5yZW1vdmVkIGlzIHByZXBlbmRlZCB0byBjdXJyZW50LnJlbW92ZWQuXG4gICAgICAgICAgICB2YXIgcHJlcGVuZCA9IHNwbGljZS5yZW1vdmVkLnNsaWNlKDAsIGN1cnJlbnQuaW5kZXggLSBzcGxpY2UuaW5kZXgpO1xuICAgICAgICAgICAgQXJyYXkucHJvdG90eXBlLnB1c2guYXBwbHkocHJlcGVuZCwgcmVtb3ZlZCk7XG4gICAgICAgICAgICByZW1vdmVkID0gcHJlcGVuZDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoc3BsaWNlLmluZGV4ICsgc3BsaWNlLnJlbW92ZWQubGVuZ3RoID4gY3VycmVudC5pbmRleCArIGN1cnJlbnQuYWRkZWRDb3VudCkge1xuICAgICAgICAgICAgLy8gc29tZSBzdWZmaXggb2Ygc3BsaWNlLnJlbW92ZWQgaXMgYXBwZW5kZWQgdG8gY3VycmVudC5yZW1vdmVkLlxuICAgICAgICAgICAgdmFyIGFwcGVuZCA9IHNwbGljZS5yZW1vdmVkLnNsaWNlKGN1cnJlbnQuaW5kZXggKyBjdXJyZW50LmFkZGVkQ291bnQgLSBzcGxpY2UuaW5kZXgpO1xuICAgICAgICAgICAgQXJyYXkucHJvdG90eXBlLnB1c2guYXBwbHkocmVtb3ZlZCwgYXBwZW5kKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBzcGxpY2UucmVtb3ZlZCA9IHJlbW92ZWQ7XG4gICAgICAgICAgaWYgKGN1cnJlbnQuaW5kZXggPCBzcGxpY2UuaW5kZXgpIHtcbiAgICAgICAgICAgIHNwbGljZS5pbmRleCA9IGN1cnJlbnQuaW5kZXg7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHNwbGljZS5pbmRleCA8IGN1cnJlbnQuaW5kZXgpIHtcbiAgICAgICAgLy8gSW5zZXJ0IHNwbGljZSBoZXJlLlxuXG4gICAgICAgIGluc2VydGVkID0gdHJ1ZTtcblxuICAgICAgICBzcGxpY2VzLnNwbGljZShpLCAwLCBzcGxpY2UpO1xuICAgICAgICBpKys7XG5cbiAgICAgICAgdmFyIG9mZnNldCA9IHNwbGljZS5hZGRlZENvdW50IC0gc3BsaWNlLnJlbW92ZWQubGVuZ3RoXG4gICAgICAgIGN1cnJlbnQuaW5kZXggKz0gb2Zmc2V0O1xuICAgICAgICBpbnNlcnRpb25PZmZzZXQgKz0gb2Zmc2V0O1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghaW5zZXJ0ZWQpXG4gICAgICBzcGxpY2VzLnB1c2goc3BsaWNlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZUluaXRpYWxTcGxpY2VzKGFycmF5LCBjaGFuZ2VSZWNvcmRzKSB7XG4gICAgdmFyIHNwbGljZXMgPSBbXTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hhbmdlUmVjb3Jkcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHJlY29yZCA9IGNoYW5nZVJlY29yZHNbaV07XG4gICAgICBzd2l0Y2gocmVjb3JkLnR5cGUpIHtcbiAgICAgICAgY2FzZSAnc3BsaWNlJzpcbiAgICAgICAgICBtZXJnZVNwbGljZShzcGxpY2VzLCByZWNvcmQuaW5kZXgsIHJlY29yZC5yZW1vdmVkLnNsaWNlKCksIHJlY29yZC5hZGRlZENvdW50KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnYWRkJzpcbiAgICAgICAgY2FzZSAndXBkYXRlJzpcbiAgICAgICAgY2FzZSAnZGVsZXRlJzpcbiAgICAgICAgICBpZiAoIWlzSW5kZXgocmVjb3JkLm5hbWUpKVxuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgdmFyIGluZGV4ID0gdG9OdW1iZXIocmVjb3JkLm5hbWUpO1xuICAgICAgICAgIGlmIChpbmRleCA8IDApXG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICBtZXJnZVNwbGljZShzcGxpY2VzLCBpbmRleCwgW3JlY29yZC5vbGRWYWx1ZV0sIDEpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1VuZXhwZWN0ZWQgcmVjb3JkIHR5cGU6ICcgKyBKU09OLnN0cmluZ2lmeShyZWNvcmQpKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gc3BsaWNlcztcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb2plY3RBcnJheVNwbGljZXMoYXJyYXksIGNoYW5nZVJlY29yZHMpIHtcbiAgICB2YXIgc3BsaWNlcyA9IFtdO1xuXG4gICAgY3JlYXRlSW5pdGlhbFNwbGljZXMoYXJyYXksIGNoYW5nZVJlY29yZHMpLmZvckVhY2goZnVuY3Rpb24oc3BsaWNlKSB7XG4gICAgICBpZiAoc3BsaWNlLmFkZGVkQ291bnQgPT0gMSAmJiBzcGxpY2UucmVtb3ZlZC5sZW5ndGggPT0gMSkge1xuICAgICAgICBpZiAoc3BsaWNlLnJlbW92ZWRbMF0gIT09IGFycmF5W3NwbGljZS5pbmRleF0pXG4gICAgICAgICAgc3BsaWNlcy5wdXNoKHNwbGljZSk7XG5cbiAgICAgICAgcmV0dXJuXG4gICAgICB9O1xuXG4gICAgICBzcGxpY2VzID0gc3BsaWNlcy5jb25jYXQoY2FsY1NwbGljZXMoYXJyYXksIHNwbGljZS5pbmRleCwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3BsaWNlLnJlbW92ZWQsIDAsIHNwbGljZS5yZW1vdmVkLmxlbmd0aCkpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHNwbGljZXM7XG4gIH1cblxuIC8vIEV4cG9ydCB0aGUgb2JzZXJ2ZS1qcyBvYmplY3QgZm9yICoqTm9kZS5qcyoqLCB3aXRoXG4vLyBiYWNrd2FyZHMtY29tcGF0aWJpbGl0eSBmb3IgdGhlIG9sZCBgcmVxdWlyZSgpYCBBUEkuIElmIHdlJ3JlIGluXG4vLyB0aGUgYnJvd3NlciwgZXhwb3J0IGFzIGEgZ2xvYmFsIG9iamVjdC5cbnZhciBleHBvc2UgPSBnbG9iYWw7XG5pZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbmV4cG9zZSA9IGV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cztcbn1cbmV4cG9zZSA9IGV4cG9ydHM7XG59XG5leHBvc2UuT2JzZXJ2ZXIgPSBPYnNlcnZlcjtcbmV4cG9zZS5PYnNlcnZlci5ydW5FT01fID0gcnVuRU9NO1xuZXhwb3NlLk9ic2VydmVyLm9ic2VydmVyU2VudGluZWxfID0gb2JzZXJ2ZXJTZW50aW5lbDsgLy8gZm9yIHRlc3RpbmcuXG5leHBvc2UuT2JzZXJ2ZXIuaGFzT2JqZWN0T2JzZXJ2ZSA9IGhhc09ic2VydmU7XG5leHBvc2UuQXJyYXlPYnNlcnZlciA9IEFycmF5T2JzZXJ2ZXI7XG5leHBvc2UuQXJyYXlPYnNlcnZlci5jYWxjdWxhdGVTcGxpY2VzID0gZnVuY3Rpb24oY3VycmVudCwgcHJldmlvdXMpIHtcbnJldHVybiBhcnJheVNwbGljZS5jYWxjdWxhdGVTcGxpY2VzKGN1cnJlbnQsIHByZXZpb3VzKTtcbn07XG5leHBvc2UuUGxhdGZvcm0gPSBnbG9iYWwuUGxhdGZvcm07XG5leHBvc2UuQXJyYXlTcGxpY2UgPSBBcnJheVNwbGljZTtcbmV4cG9zZS5PYmplY3RPYnNlcnZlciA9IE9iamVjdE9ic2VydmVyO1xufSkodHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcgJiYgZ2xvYmFsICYmIHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZSA/IGdsb2JhbCA6IHRoaXMgfHwgd2luZG93KTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZS5qc1xuICoqIG1vZHVsZSBpZCA9IDIyXG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xuXG5mdW5jdGlvbiBDb25kaXRpb24oZm4sIGxhenkpIHtcbiAgaWYgKGxhenkgPT09IHVuZGVmaW5lZCB8fCBsYXp5ID09PSBudWxsKSB7XG4gICAgbGF6eSA9IHRydWU7XG4gIH1cbiAgZm4gPSBmbiB8fCBmdW5jdGlvbihkb25lKSB7XG4gICAgZG9uZSgpO1xuICB9O1xuXG4gIHRoaXMuX3Byb21pc2UgPSBuZXcgdXRpbC5Qcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgIHRoaXMuZm4gPSBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuZXhlY3V0ZWQgPSB0cnVlO1xuICAgICAgdmFyIG51bUNvbXBsZXRlID0gMDtcbiAgICAgIHZhciByZXN1bHRzID0gW107XG4gICAgICB2YXIgZXJyb3JzID0gW107XG4gICAgICBpZiAodXRpbC5pc0FycmF5KGZuKSkge1xuICAgICAgICB2YXIgY2hlY2tDb21wbGV0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGlmIChudW1Db21wbGV0ZS5sZW5ndGggPT0gZm4ubGVuZ3RoKSB7XG4gICAgICAgICAgICBpZiAoZXJyb3JzLmxlbmd0aCkgdGhpcy5fcHJvbWlzZS5yZWplY3QoZXJyb3JzKTtcbiAgICAgICAgICAgIGVsc2UgdGhpcy5fcHJvbWlzZS5yZXNvbHZlKG51bGwsIHJlc3VsdHMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuXG4gICAgICAgIGZuLmZvckVhY2goZnVuY3Rpb24oY29uZCwgaWR4KSB7XG4gICAgICAgICAgY29uZC50aGVuKGZ1bmN0aW9uKHJlcykge1xuICAgICAgICAgICAgcmVzdWx0c1tpZHhdID0gcmVzO1xuICAgICAgICAgICAgbnVtQ29tcGxldGUrKztcbiAgICAgICAgICAgIGNoZWNrQ29tcGxldGUoKTtcbiAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgIGVycm9yc1tpZHhdID0gZXJyO1xuICAgICAgICAgICAgbnVtQ29tcGxldGUrKztcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgZm4oZnVuY3Rpb24oZXJyLCByZXMpIHtcbiAgICAgICAgICBpZiAoZXJyKSByZWplY3QoZXJyKTtcbiAgICAgICAgICBlbHNlIHJlc29sdmUocmVzKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKVxuICAgICAgfVxuICAgIH1cbiAgfS5iaW5kKHRoaXMpKTtcblxuICBpZiAoIWxhenkpIHRoaXMuX2V4ZWN1dGUoKTtcbiAgdGhpcy5leGVjdXRlZCA9IGZhbHNlO1xufVxuXG5Db25kaXRpb24ucHJvdG90eXBlID0ge1xuICBfZXhlY3V0ZTogZnVuY3Rpb24oKSB7XG4gICAgaWYgKCF0aGlzLmV4ZWN1dGVkKSB0aGlzLmZuKCk7XG4gIH0sXG4gIHRoZW46IGZ1bmN0aW9uKHN1Y2Nlc3MsIGZhaWwpIHtcbiAgICB0aGlzLl9leGVjdXRlKCk7XG4gICAgcmV0dXJuIHRoaXMuX3Byb21pc2UudGhlbihzdWNjZXNzLCBmYWlsKTtcbiAgfSxcbiAgY2F0Y2g6IGZ1bmN0aW9uKGZhaWwpIHtcbiAgICB0aGlzLl9leGVjdXRlKCk7XG4gICAgcmV0dXJuIHRoaXMuX3Byb21pc2UuY2F0Y2goZmFpbCk7XG4gIH0sXG4gIHJlc29sdmU6IGZ1bmN0aW9uIChyZXMpIHtcbiAgICB0aGlzLmV4ZWN1dGVkID0gdHJ1ZTtcbiAgICB0aGlzLl9wcm9taXNlLnJlc29sdmUocmVzKTtcbiAgfSxcbiAgcmVqZWN0OiBmdW5jdGlvbiAoZXJyKSB7XG4gICAgdGhpcy5leGVjdXRlZCA9IHRydWU7XG4gICAgdGhpcy5fcHJvbWlzZS5yZWplY3QoZXJyKTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDb25kaXRpb247XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvQ29uZGl0aW9uLmpzXG4gKiogbW9kdWxlIGlkID0gMjNcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG5cbi8qKlxuICogQWN0cyBhcyBhIHBsYWNlaG9sZGVyIGZvciB2YXJpb3VzIG9iamVjdHMgZS5nLiBsYXp5IHJlZ2lzdHJhdGlvbiBvZiBtb2RlbHMuXG4gKiBAcGFyYW0gW29wdHNdXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gUGxhY2Vob2xkZXIob3B0cykge1xuICB1dGlsLmV4dGVuZCh0aGlzLCBvcHRzIHx8IHt9KTtcbiAgdGhpcy5pc1BsYWNlaG9sZGVyID0gdHJ1ZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBQbGFjZWhvbGRlcjtcblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9QbGFjZWhvbGRlci5qc1xuICoqIG1vZHVsZSBpZCA9IDI0XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSgnbW9kZWwnKSxcbiAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICBSZWxhdGlvbnNoaXBUeXBlID0gcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBUeXBlJyksXG4gIFF1ZXJ5ID0gcmVxdWlyZSgnLi9RdWVyeScpLFxuICBNb2RlbEluc3RhbmNlID0gcmVxdWlyZSgnLi9Nb2RlbEluc3RhbmNlJyksXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgZ3VpZCA9IHV0aWwuZ3VpZCxcbiAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyksXG4gIGV4dGVuZCA9IHJlcXVpcmUoJ2V4dGVuZCcpLFxuICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgd3JhcEFycmF5ID0gcmVxdWlyZSgnLi9ldmVudHMnKS53cmFwQXJyYXksXG4gIE9uZVRvTWFueVByb3h5ID0gcmVxdWlyZSgnLi9PbmVUb01hbnlQcm94eScpLFxuICBPbmVUb09uZVByb3h5ID0gcmVxdWlyZSgnLi9PbmVUb09uZVByb3h5JyksXG4gIE1hbnlUb01hbnlQcm94eSA9IHJlcXVpcmUoJy4vTWFueVRvTWFueVByb3h5JyksXG4gIFJlYWN0aXZlUXVlcnkgPSByZXF1aXJlKCcuL1JlYWN0aXZlUXVlcnknKSxcbiAgTW9kZWxFdmVudFR5cGUgPSBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZTtcblxuZnVuY3Rpb24gTW9kZWxJbnN0YW5jZUZhY3RvcnkobW9kZWwpIHtcbiAgdGhpcy5tb2RlbCA9IG1vZGVsO1xufVxuXG5Nb2RlbEluc3RhbmNlRmFjdG9yeS5wcm90b3R5cGUgPSB7XG4gIF9nZXRMb2NhbElkOiBmdW5jdGlvbihkYXRhKSB7XG4gICAgdmFyIGxvY2FsSWQ7XG4gICAgaWYgKGRhdGEpIHtcbiAgICAgIGxvY2FsSWQgPSBkYXRhLmxvY2FsSWQgPyBkYXRhLmxvY2FsSWQgOiBndWlkKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvY2FsSWQgPSBndWlkKCk7XG4gICAgfVxuICAgIHJldHVybiBsb2NhbElkO1xuICB9LFxuICAvKipcbiAgICogQ29uZmlndXJlIGF0dHJpYnV0ZXNcbiAgICogQHBhcmFtIG1vZGVsSW5zdGFuY2VcbiAgICogQHBhcmFtIGRhdGFcbiAgICogQHByaXZhdGVcbiAgICovXG5cbiAgX2luc3RhbGxBdHRyaWJ1dGVzOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlLCBkYXRhKSB7XG4gICAgdmFyIE1vZGVsID0gdGhpcy5tb2RlbCxcbiAgICAgIGF0dHJpYnV0ZU5hbWVzID0gTW9kZWwuX2F0dHJpYnV0ZU5hbWVzLFxuICAgICAgaWR4ID0gYXR0cmlidXRlTmFtZXMuaW5kZXhPZihNb2RlbC5pZCk7XG4gICAgdXRpbC5leHRlbmQobW9kZWxJbnN0YW5jZSwge1xuICAgICAgX192YWx1ZXM6IHV0aWwuZXh0ZW5kKE1vZGVsLmF0dHJpYnV0ZXMucmVkdWNlKGZ1bmN0aW9uKG0sIGEpIHtcbiAgICAgICAgaWYgKGEuZGVmYXVsdCAhPT0gdW5kZWZpbmVkKSBtW2EubmFtZV0gPSBhLmRlZmF1bHQ7XG4gICAgICAgIHJldHVybiBtO1xuICAgICAgfSwge30pLCBkYXRhIHx8IHt9KVxuICAgIH0pO1xuICAgIGlmIChpZHggPiAtMSkgYXR0cmlidXRlTmFtZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgYXR0cmlidXRlTmFtZXMuZm9yRWFjaChmdW5jdGlvbihhdHRyaWJ1dGVOYW1lKSB7XG4gICAgICB2YXIgYXR0cmlidXRlRGVmaW5pdGlvbiA9IE1vZGVsLl9hdHRyaWJ1dGVEZWZpbml0aW9uV2l0aE5hbWUoYXR0cmlidXRlTmFtZSk7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobW9kZWxJbnN0YW5jZSwgYXR0cmlidXRlTmFtZSwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciB2YWx1ZSA9IG1vZGVsSW5zdGFuY2UuX192YWx1ZXNbYXR0cmlidXRlTmFtZV07XG4gICAgICAgICAgcmV0dXJuIHZhbHVlID09PSB1bmRlZmluZWQgPyBudWxsIDogdmFsdWU7XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24odikge1xuICAgICAgICAgIGlmIChhdHRyaWJ1dGVEZWZpbml0aW9uLnBhcnNlKSB7XG4gICAgICAgICAgICB2ID0gYXR0cmlidXRlRGVmaW5pdGlvbi5wYXJzZS5jYWxsKG1vZGVsSW5zdGFuY2UsIHYpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoTW9kZWwucGFyc2VBdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgIHYgPSBNb2RlbC5wYXJzZUF0dHJpYnV0ZS5jYWxsKG1vZGVsSW5zdGFuY2UsIGF0dHJpYnV0ZU5hbWUsIHYpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB2YXIgb2xkID0gbW9kZWxJbnN0YW5jZS5fX3ZhbHVlc1thdHRyaWJ1dGVOYW1lXTtcbiAgICAgICAgICB2YXIgcHJvcGVydHlEZXBlbmRlbmNpZXMgPSB0aGlzLl9wcm9wZXJ0eURlcGVuZGVuY2llc1thdHRyaWJ1dGVOYW1lXSB8fCBbXTtcbiAgICAgICAgICBwcm9wZXJ0eURlcGVuZGVuY2llcyA9IHByb3BlcnR5RGVwZW5kZW5jaWVzLm1hcChmdW5jdGlvbihkZXBlbmRhbnQpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIHByb3A6IGRlcGVuZGFudCxcbiAgICAgICAgICAgICAgb2xkOiB0aGlzW2RlcGVuZGFudF1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgICAgICAgbW9kZWxJbnN0YW5jZS5fX3ZhbHVlc1thdHRyaWJ1dGVOYW1lXSA9IHY7XG4gICAgICAgICAgcHJvcGVydHlEZXBlbmRlbmNpZXMuZm9yRWFjaChmdW5jdGlvbihkZXApIHtcbiAgICAgICAgICAgIHZhciBwcm9wZXJ0eU5hbWUgPSBkZXAucHJvcDtcbiAgICAgICAgICAgIHZhciBuZXdfID0gdGhpc1twcm9wZXJ0eU5hbWVdO1xuICAgICAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgICAgIGNvbGxlY3Rpb246IE1vZGVsLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICBtb2RlbDogTW9kZWwubmFtZSxcbiAgICAgICAgICAgICAgbG9jYWxJZDogbW9kZWxJbnN0YW5jZS5sb2NhbElkLFxuICAgICAgICAgICAgICBuZXc6IG5ld18sXG4gICAgICAgICAgICAgIG9sZDogZGVwLm9sZCxcbiAgICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU2V0LFxuICAgICAgICAgICAgICBmaWVsZDogcHJvcGVydHlOYW1lLFxuICAgICAgICAgICAgICBvYmo6IG1vZGVsSW5zdGFuY2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgICAgdmFyIGUgPSB7XG4gICAgICAgICAgICBjb2xsZWN0aW9uOiBNb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgIG1vZGVsOiBNb2RlbC5uYW1lLFxuICAgICAgICAgICAgbG9jYWxJZDogbW9kZWxJbnN0YW5jZS5sb2NhbElkLFxuICAgICAgICAgICAgbmV3OiB2LFxuICAgICAgICAgICAgb2xkOiBvbGQsXG4gICAgICAgICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TZXQsXG4gICAgICAgICAgICBmaWVsZDogYXR0cmlidXRlTmFtZSxcbiAgICAgICAgICAgIG9iajogbW9kZWxJbnN0YW5jZVxuICAgICAgICAgIH07XG4gICAgICAgICAgd2luZG93Lmxhc3RFbWlzc2lvbiA9IGU7XG4gICAgICAgICAgbW9kZWxFdmVudHMuZW1pdChlKTtcbiAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KHYpKSB7XG4gICAgICAgICAgICB3cmFwQXJyYXkodiwgYXR0cmlidXRlTmFtZSwgbW9kZWxJbnN0YW5jZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9LFxuICBfaW5zdGFsbE1ldGhvZHM6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UpIHtcbiAgICB2YXIgTW9kZWwgPSB0aGlzLm1vZGVsO1xuICAgIE9iamVjdC5rZXlzKE1vZGVsLm1ldGhvZHMpLmZvckVhY2goZnVuY3Rpb24obWV0aG9kTmFtZSkge1xuICAgICAgaWYgKG1vZGVsSW5zdGFuY2VbbWV0aG9kTmFtZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBtb2RlbEluc3RhbmNlW21ldGhvZE5hbWVdID0gTW9kZWwubWV0aG9kc1ttZXRob2ROYW1lXS5iaW5kKG1vZGVsSW5zdGFuY2UpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGxvZygnQSBtZXRob2Qgd2l0aCBuYW1lIFwiJyArIG1ldGhvZE5hbWUgKyAnXCIgYWxyZWFkeSBleGlzdHMuIElnbm9yaW5nIGl0LicpO1xuICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG4gIF9pbnN0YWxsUHJvcGVydGllczogZnVuY3Rpb24obW9kZWxJbnN0YW5jZSkge1xuICAgIHZhciBfcHJvcGVydHlOYW1lcyA9IE9iamVjdC5rZXlzKHRoaXMubW9kZWwucHJvcGVydGllcyksXG4gICAgICBfcHJvcGVydHlEZXBlbmRlbmNpZXMgPSB7fTtcbiAgICBfcHJvcGVydHlOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uKHByb3BOYW1lKSB7XG4gICAgICB2YXIgcHJvcERlZiA9IHRoaXMubW9kZWwucHJvcGVydGllc1twcm9wTmFtZV07XG4gICAgICB2YXIgZGVwZW5kZW5jaWVzID0gcHJvcERlZi5kZXBlbmRlbmNpZXMgfHwgW107XG4gICAgICBkZXBlbmRlbmNpZXMuZm9yRWFjaChmdW5jdGlvbihhdHRyKSB7XG4gICAgICAgIGlmICghX3Byb3BlcnR5RGVwZW5kZW5jaWVzW2F0dHJdKSBfcHJvcGVydHlEZXBlbmRlbmNpZXNbYXR0cl0gPSBbXTtcbiAgICAgICAgX3Byb3BlcnR5RGVwZW5kZW5jaWVzW2F0dHJdLnB1c2gocHJvcE5hbWUpO1xuICAgICAgfSk7XG4gICAgICBkZWxldGUgcHJvcERlZi5kZXBlbmRlbmNpZXM7XG4gICAgICBpZiAobW9kZWxJbnN0YW5jZVtwcm9wTmFtZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobW9kZWxJbnN0YW5jZSwgcHJvcE5hbWUsIHByb3BEZWYpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGxvZygnQSBwcm9wZXJ0eS9tZXRob2Qgd2l0aCBuYW1lIFwiJyArIHByb3BOYW1lICsgJ1wiIGFscmVhZHkgZXhpc3RzLiBJZ25vcmluZyBpdC4nKTtcbiAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgbW9kZWxJbnN0YW5jZS5fcHJvcGVydHlEZXBlbmRlbmNpZXMgPSBfcHJvcGVydHlEZXBlbmRlbmNpZXM7XG4gIH0sXG4gIF9pbnN0YWxsUmVtb3RlSWQ6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UpIHtcbiAgICB2YXIgTW9kZWwgPSB0aGlzLm1vZGVsO1xuICAgIHZhciBpZEZpZWxkID0gTW9kZWwuaWQ7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG1vZGVsSW5zdGFuY2UsIGlkRmllbGQsIHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBtb2RlbEluc3RhbmNlLl9fdmFsdWVzW01vZGVsLmlkXSB8fCBudWxsO1xuICAgICAgfSxcbiAgICAgIHNldDogZnVuY3Rpb24odikge1xuICAgICAgICB2YXIgb2xkID0gbW9kZWxJbnN0YW5jZVtNb2RlbC5pZF07XG4gICAgICAgIG1vZGVsSW5zdGFuY2UuX192YWx1ZXNbTW9kZWwuaWRdID0gdjtcbiAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgY29sbGVjdGlvbjogTW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgbW9kZWw6IE1vZGVsLm5hbWUsXG4gICAgICAgICAgbG9jYWxJZDogbW9kZWxJbnN0YW5jZS5sb2NhbElkLFxuICAgICAgICAgIG5ldzogdixcbiAgICAgICAgICBvbGQ6IG9sZCxcbiAgICAgICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TZXQsXG4gICAgICAgICAgZmllbGQ6IE1vZGVsLmlkLFxuICAgICAgICAgIG9iajogbW9kZWxJbnN0YW5jZVxuICAgICAgICB9KTtcbiAgICAgICAgY2FjaGUucmVtb3RlSW5zZXJ0KG1vZGVsSW5zdGFuY2UsIHYsIG9sZCk7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xuICB9LFxuICAvKipcbiAgICogQHBhcmFtIGRlZmluaXRpb24gLSBEZWZpbml0aW9uIG9mIGEgcmVsYXRpb25zaGlwXG4gICAqIEBwYXJhbSBtb2RlbEluc3RhbmNlIC0gSW5zdGFuY2Ugb2Ygd2hpY2ggdG8gaW5zdGFsbCB0aGUgcmVsYXRpb25zaGlwLlxuICAgKi9cbiAgX2luc3RhbGxSZWxhdGlvbnNoaXA6IGZ1bmN0aW9uKGRlZmluaXRpb24sIG1vZGVsSW5zdGFuY2UpIHtcbiAgICB2YXIgcHJveHk7XG4gICAgdmFyIHR5cGUgPSBkZWZpbml0aW9uLnR5cGU7XG4gICAgaWYgKHR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5PbmVUb01hbnkpIHtcbiAgICAgIHByb3h5ID0gbmV3IE9uZVRvTWFueVByb3h5KGRlZmluaXRpb24pO1xuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuT25lVG9PbmUpIHtcbiAgICAgIHByb3h5ID0gbmV3IE9uZVRvT25lUHJveHkoZGVmaW5pdGlvbik7XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5NYW55VG9NYW55KSB7XG4gICAgICBwcm94eSA9IG5ldyBNYW55VG9NYW55UHJveHkoZGVmaW5pdGlvbik7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ05vIHN1Y2ggcmVsYXRpb25zaGlwIHR5cGU6ICcgKyB0eXBlKTtcbiAgICB9XG4gICAgcHJveHkuaW5zdGFsbChtb2RlbEluc3RhbmNlKTtcbiAgfSxcbiAgX2luc3RhbGxSZWxhdGlvbnNoaXBQcm94aWVzOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlKSB7XG4gICAgdmFyIG1vZGVsID0gdGhpcy5tb2RlbDtcbiAgICBmb3IgKHZhciBuYW1lIGluIG1vZGVsLnJlbGF0aW9uc2hpcHMpIHtcbiAgICAgIGlmIChtb2RlbC5yZWxhdGlvbnNoaXBzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgIHZhciBkZWZpbml0aW9uID0gdXRpbC5leHRlbmQoe30sIG1vZGVsLnJlbGF0aW9uc2hpcHNbbmFtZV0pO1xuICAgICAgICB0aGlzLl9pbnN0YWxsUmVsYXRpb25zaGlwKGRlZmluaXRpb24sIG1vZGVsSW5zdGFuY2UpO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgX3JlZ2lzdGVySW5zdGFuY2U6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UsIHNob3VsZFJlZ2lzdGVyQ2hhbmdlKSB7XG4gICAgY2FjaGUuaW5zZXJ0KG1vZGVsSW5zdGFuY2UpO1xuICAgIHNob3VsZFJlZ2lzdGVyQ2hhbmdlID0gc2hvdWxkUmVnaXN0ZXJDaGFuZ2UgPT09IHVuZGVmaW5lZCA/IHRydWUgOiBzaG91bGRSZWdpc3RlckNoYW5nZTtcbiAgICBpZiAoc2hvdWxkUmVnaXN0ZXJDaGFuZ2UpIG1vZGVsSW5zdGFuY2UuX2VtaXROZXcoKTtcbiAgfSxcbiAgX2luc3RhbGxMb2NhbElkOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlLCBkYXRhKSB7XG4gICAgbW9kZWxJbnN0YW5jZS5sb2NhbElkID0gdGhpcy5fZ2V0TG9jYWxJZChkYXRhKTtcbiAgfSxcbiAgLyoqXG4gICAqIENvbnZlcnQgcmF3IGRhdGEgaW50byBhIE1vZGVsSW5zdGFuY2VcbiAgICogQHJldHVybnMge01vZGVsSW5zdGFuY2V9XG4gICAqL1xuICBfaW5zdGFuY2U6IGZ1bmN0aW9uKGRhdGEsIHNob3VsZFJlZ2lzdGVyQ2hhbmdlKSB7XG4gICAgaWYgKCF0aGlzLm1vZGVsLl9yZWxhdGlvbnNoaXBzSW5zdGFsbGVkIHx8ICF0aGlzLm1vZGVsLl9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZCkge1xuICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ01vZGVsIG11c3QgYmUgZnVsbHkgaW5zdGFsbGVkIGJlZm9yZSBjcmVhdGluZyBhbnkgbW9kZWxzJyk7XG4gICAgfVxuICAgIHZhciBtb2RlbEluc3RhbmNlID0gbmV3IE1vZGVsSW5zdGFuY2UodGhpcy5tb2RlbCk7XG4gICAgdGhpcy5faW5zdGFsbExvY2FsSWQobW9kZWxJbnN0YW5jZSwgZGF0YSk7XG4gICAgdGhpcy5faW5zdGFsbEF0dHJpYnV0ZXMobW9kZWxJbnN0YW5jZSwgZGF0YSk7XG4gICAgdGhpcy5faW5zdGFsbE1ldGhvZHMobW9kZWxJbnN0YW5jZSk7XG4gICAgdGhpcy5faW5zdGFsbFByb3BlcnRpZXMobW9kZWxJbnN0YW5jZSk7XG4gICAgdGhpcy5faW5zdGFsbFJlbW90ZUlkKG1vZGVsSW5zdGFuY2UpO1xuICAgIHRoaXMuX2luc3RhbGxSZWxhdGlvbnNoaXBQcm94aWVzKG1vZGVsSW5zdGFuY2UpO1xuICAgIHRoaXMuX3JlZ2lzdGVySW5zdGFuY2UobW9kZWxJbnN0YW5jZSwgc2hvdWxkUmVnaXN0ZXJDaGFuZ2UpO1xuICAgIHJldHVybiBtb2RlbEluc3RhbmNlO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1vZGVsSW5zdGFuY2VGYWN0b3J5O1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL2luc3RhbmNlRmFjdG9yeS5qc1xuICoqIG1vZHVsZSBpZCA9IDI1XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgYXJnc2FycmF5ID0gcmVxdWlyZSgnYXJnc2FycmF5Jyk7XG5cbi8qKlxuICogQ2xhc3MgZm9yIGZhY2lsaXRhdGluZyBcImNoYWluZWRcIiBiZWhhdmlvdXIgZS5nOlxuICpcbiAqIHZhciBjYW5jZWwgPSBVc2Vyc1xuICogIC5vbignbmV3JywgZnVuY3Rpb24gKHVzZXIpIHtcbiAgICogICAgIC8vIC4uLlxuICAgKiAgIH0pXG4gKiAgLnF1ZXJ5KHskb3I6IHthZ2VfX2d0ZTogMjAsIGFnZV9fbHRlOiAzMH19KVxuICogIC5vbignKicsIGZ1bmN0aW9uIChjaGFuZ2UpIHtcbiAgICogICAgIC8vIC4uXG4gICAqICAgfSk7XG4gKlxuICogQHBhcmFtIG9wdHNcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBDaGFpbihvcHRzKSB7XG4gIHRoaXMub3B0cyA9IG9wdHM7XG59XG5cbkNoYWluLnByb3RvdHlwZSA9IHtcbiAgLyoqXG4gICAqIENvbnN0cnVjdCBhIGxpbmsgaW4gdGhlIGNoYWluIG9mIGNhbGxzLlxuICAgKiBAcGFyYW0gb3B0c1xuICAgKiBAcGFyYW0gb3B0cy5mblxuICAgKiBAcGFyYW0gb3B0cy50eXBlXG4gICAqL1xuICBfaGFuZGxlckxpbms6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICB2YXIgZmlyc3RMaW5rO1xuICAgIGZpcnN0TGluayA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHR5cCA9IG9wdHMudHlwZTtcbiAgICAgIGlmIChvcHRzLmZuKVxuICAgICAgICB0aGlzLl9yZW1vdmVMaXN0ZW5lcihvcHRzLmZuLCB0eXApO1xuICAgICAgaWYgKGZpcnN0TGluay5fcGFyZW50TGluaykgZmlyc3RMaW5rLl9wYXJlbnRMaW5rKCk7IC8vIENhbmNlbCBsaXN0ZW5lcnMgYWxsIHRoZSB3YXkgdXAgdGhlIGNoYWluLlxuICAgIH0uYmluZCh0aGlzKTtcbiAgICBPYmplY3Qua2V5cyh0aGlzLm9wdHMpLmZvckVhY2goZnVuY3Rpb24ocHJvcCkge1xuICAgICAgdmFyIGZ1bmMgPSB0aGlzLm9wdHNbcHJvcF07XG4gICAgICBmaXJzdExpbmtbcHJvcF0gPSBhcmdzYXJyYXkoZnVuY3Rpb24oYXJncykge1xuICAgICAgICB2YXIgbGluayA9IGZ1bmMuYXBwbHkoZnVuYy5fX3NpZXN0YV9ib3VuZF9vYmplY3QsIGFyZ3MpO1xuICAgICAgICBsaW5rLl9wYXJlbnRMaW5rID0gZmlyc3RMaW5rO1xuICAgICAgICByZXR1cm4gbGluaztcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgICBmaXJzdExpbmsuX3BhcmVudExpbmsgPSBudWxsO1xuICAgIHJldHVybiBmaXJzdExpbms7XG4gIH0sXG4gIC8qKlxuICAgKiBDb25zdHJ1Y3QgYSBsaW5rIGluIHRoZSBjaGFpbiBvZiBjYWxscy5cbiAgICogQHBhcmFtIG9wdHNcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NsZWFuXVxuICAgKi9cbiAgX2xpbms6IGZ1bmN0aW9uKG9wdHMsIGNsZWFuKSB7XG4gICAgdmFyIGNoYWluID0gdGhpcztcbiAgICBjbGVhbiA9IGNsZWFuIHx8IGZ1bmN0aW9uKCkge307XG4gICAgdmFyIGxpbms7XG4gICAgbGluayA9IGZ1bmN0aW9uKCkge1xuICAgICAgY2xlYW4oKTtcbiAgICAgIGlmIChsaW5rLl9wYXJlbnRMaW5rKSBsaW5rLl9wYXJlbnRMaW5rKCk7IC8vIENhbmNlbCBsaXN0ZW5lcnMgYWxsIHRoZSB3YXkgdXAgdGhlIGNoYWluLlxuICAgIH0uYmluZCh0aGlzKTtcbiAgICBsaW5rLl9fc2llc3RhX2lzTGluayA9IHRydWU7XG4gICAgbGluay5vcHRzID0gb3B0cztcbiAgICBsaW5rLmNsZWFuID0gY2xlYW47XG4gICAgT2JqZWN0LmtleXMob3B0cykuZm9yRWFjaChmdW5jdGlvbihwcm9wKSB7XG4gICAgICB2YXIgZnVuYyA9IG9wdHNbcHJvcF07XG4gICAgICBsaW5rW3Byb3BdID0gYXJnc2FycmF5KGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICAgICAgdmFyIHBvc3NpYmxlTGluayA9IGZ1bmMuYXBwbHkoZnVuYy5fX3NpZXN0YV9ib3VuZF9vYmplY3QsIGFyZ3MpO1xuICAgICAgICBpZiAoIXBvc3NpYmxlTGluayB8fCAhcG9zc2libGVMaW5rLl9fc2llc3RhX2lzTGluaykgeyAvLyBQYXRjaCBpbiBhIGxpbmsgaW4gdGhlIGNoYWluIHRvIGF2b2lkIGl0IGJlaW5nIGJyb2tlbiwgYmFzaW5nIG9mZiB0aGUgY3VycmVudCBsaW5rXG4gICAgICAgICAgbmV4dExpbmsgPSBjaGFpbi5fbGluayhsaW5rLm9wdHMpO1xuICAgICAgICAgIGZvciAodmFyIHByb3AgaW4gcG9zc2libGVMaW5rKSB7XG4gICAgICAgICAgICAvL25vaW5zcGVjdGlvbiBKU1VuZmlsdGVyZWRGb3JJbkxvb3BcbiAgICAgICAgICAgIGlmIChwb3NzaWJsZUxpbmtbcHJvcF0gaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgICAgICAgICAgICAvL25vaW5zcGVjdGlvbiBKU1VuZmlsdGVyZWRGb3JJbkxvb3BcbiAgICAgICAgICAgICAgbmV4dExpbmtbcHJvcF0gPSBwb3NzaWJsZUxpbmtbcHJvcF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHZhciBuZXh0TGluayA9IHBvc3NpYmxlTGluaztcbiAgICAgICAgfVxuICAgICAgICBuZXh0TGluay5fcGFyZW50TGluayA9IGxpbms7XG4gICAgICAgIC8vIEluaGVyaXQgbWV0aG9kcyBmcm9tIHRoZSBwYXJlbnQgbGluayBpZiB0aG9zZSBtZXRob2RzIGRvbid0IGFscmVhZHkgZXhpc3QuXG4gICAgICAgIGZvciAocHJvcCBpbiBsaW5rKSB7XG4gICAgICAgICAgaWYgKGxpbmtbcHJvcF0gaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgICAgICAgICAgbmV4dExpbmtbcHJvcF0gPSBsaW5rW3Byb3BdLmJpbmQobGluayk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXh0TGluaztcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgICBsaW5rLl9wYXJlbnRMaW5rID0gbnVsbDtcbiAgICByZXR1cm4gbGluaztcbiAgfVxufTtcbm1vZHVsZS5leHBvcnRzID0gQ2hhaW47XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvQ2hhaW4uanNcbiAqKiBtb2R1bGUgaWQgPSAyNlxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiXG4vKipcbiAqIFRoaXMgaXMgdGhlIHdlYiBicm93c2VyIGltcGxlbWVudGF0aW9uIG9mIGBkZWJ1ZygpYC5cbiAqXG4gKiBFeHBvc2UgYGRlYnVnKClgIGFzIHRoZSBtb2R1bGUuXG4gKi9cblxuZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9kZWJ1ZycpO1xuZXhwb3J0cy5sb2cgPSBsb2c7XG5leHBvcnRzLmZvcm1hdEFyZ3MgPSBmb3JtYXRBcmdzO1xuZXhwb3J0cy5zYXZlID0gc2F2ZTtcbmV4cG9ydHMubG9hZCA9IGxvYWQ7XG5leHBvcnRzLnVzZUNvbG9ycyA9IHVzZUNvbG9ycztcblxuLyoqXG4gKiBVc2UgY2hyb21lLnN0b3JhZ2UubG9jYWwgaWYgd2UgYXJlIGluIGFuIGFwcFxuICovXG5cbnZhciBzdG9yYWdlO1xuXG5pZiAodHlwZW9mIGNocm9tZSAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIGNocm9tZS5zdG9yYWdlICE9PSAndW5kZWZpbmVkJylcbiAgc3RvcmFnZSA9IGNocm9tZS5zdG9yYWdlLmxvY2FsO1xuZWxzZVxuICBzdG9yYWdlID0gd2luZG93LmxvY2FsU3RvcmFnZTtcblxuLyoqXG4gKiBDb2xvcnMuXG4gKi9cblxuZXhwb3J0cy5jb2xvcnMgPSBbXG4gICdsaWdodHNlYWdyZWVuJyxcbiAgJ2ZvcmVzdGdyZWVuJyxcbiAgJ2dvbGRlbnJvZCcsXG4gICdkb2RnZXJibHVlJyxcbiAgJ2RhcmtvcmNoaWQnLFxuICAnY3JpbXNvbidcbl07XG5cbi8qKlxuICogQ3VycmVudGx5IG9ubHkgV2ViS2l0LWJhc2VkIFdlYiBJbnNwZWN0b3JzLCBGaXJlZm94ID49IHYzMSxcbiAqIGFuZCB0aGUgRmlyZWJ1ZyBleHRlbnNpb24gKGFueSBGaXJlZm94IHZlcnNpb24pIGFyZSBrbm93blxuICogdG8gc3VwcG9ydCBcIiVjXCIgQ1NTIGN1c3RvbWl6YXRpb25zLlxuICpcbiAqIFRPRE86IGFkZCBhIGBsb2NhbFN0b3JhZ2VgIHZhcmlhYmxlIHRvIGV4cGxpY2l0bHkgZW5hYmxlL2Rpc2FibGUgY29sb3JzXG4gKi9cblxuZnVuY3Rpb24gdXNlQ29sb3JzKCkge1xuICAvLyBpcyB3ZWJraXQ/IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzE2NDU5NjA2LzM3Njc3M1xuICByZXR1cm4gKCdXZWJraXRBcHBlYXJhbmNlJyBpbiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc3R5bGUpIHx8XG4gICAgLy8gaXMgZmlyZWJ1Zz8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMzk4MTIwLzM3Njc3M1xuICAgICh3aW5kb3cuY29uc29sZSAmJiAoY29uc29sZS5maXJlYnVnIHx8IChjb25zb2xlLmV4Y2VwdGlvbiAmJiBjb25zb2xlLnRhYmxlKSkpIHx8XG4gICAgLy8gaXMgZmlyZWZveCA+PSB2MzE/XG4gICAgLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9Ub29scy9XZWJfQ29uc29sZSNTdHlsaW5nX21lc3NhZ2VzXG4gICAgKG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5tYXRjaCgvZmlyZWZveFxcLyhcXGQrKS8pICYmIHBhcnNlSW50KFJlZ0V4cC4kMSwgMTApID49IDMxKTtcbn1cblxuLyoqXG4gKiBNYXAgJWogdG8gYEpTT04uc3RyaW5naWZ5KClgLCBzaW5jZSBubyBXZWIgSW5zcGVjdG9ycyBkbyB0aGF0IGJ5IGRlZmF1bHQuXG4gKi9cblxuZXhwb3J0cy5mb3JtYXR0ZXJzLmogPSBmdW5jdGlvbih2KSB7XG4gIHJldHVybiBKU09OLnN0cmluZ2lmeSh2KTtcbn07XG5cblxuLyoqXG4gKiBDb2xvcml6ZSBsb2cgYXJndW1lbnRzIGlmIGVuYWJsZWQuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBmb3JtYXRBcmdzKCkge1xuICB2YXIgYXJncyA9IGFyZ3VtZW50cztcbiAgdmFyIHVzZUNvbG9ycyA9IHRoaXMudXNlQ29sb3JzO1xuXG4gIGFyZ3NbMF0gPSAodXNlQ29sb3JzID8gJyVjJyA6ICcnKVxuICAgICsgdGhpcy5uYW1lc3BhY2VcbiAgICArICh1c2VDb2xvcnMgPyAnICVjJyA6ICcgJylcbiAgICArIGFyZ3NbMF1cbiAgICArICh1c2VDb2xvcnMgPyAnJWMgJyA6ICcgJylcbiAgICArICcrJyArIGV4cG9ydHMuaHVtYW5pemUodGhpcy5kaWZmKTtcblxuICBpZiAoIXVzZUNvbG9ycykgcmV0dXJuIGFyZ3M7XG5cbiAgdmFyIGMgPSAnY29sb3I6ICcgKyB0aGlzLmNvbG9yO1xuICBhcmdzID0gW2FyZ3NbMF0sIGMsICdjb2xvcjogaW5oZXJpdCddLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmdzLCAxKSk7XG5cbiAgLy8gdGhlIGZpbmFsIFwiJWNcIiBpcyBzb21ld2hhdCB0cmlja3ksIGJlY2F1c2UgdGhlcmUgY291bGQgYmUgb3RoZXJcbiAgLy8gYXJndW1lbnRzIHBhc3NlZCBlaXRoZXIgYmVmb3JlIG9yIGFmdGVyIHRoZSAlYywgc28gd2UgbmVlZCB0b1xuICAvLyBmaWd1cmUgb3V0IHRoZSBjb3JyZWN0IGluZGV4IHRvIGluc2VydCB0aGUgQ1NTIGludG9cbiAgdmFyIGluZGV4ID0gMDtcbiAgdmFyIGxhc3RDID0gMDtcbiAgYXJnc1swXS5yZXBsYWNlKC8lW2EteiVdL2csIGZ1bmN0aW9uKG1hdGNoKSB7XG4gICAgaWYgKCclJScgPT09IG1hdGNoKSByZXR1cm47XG4gICAgaW5kZXgrKztcbiAgICBpZiAoJyVjJyA9PT0gbWF0Y2gpIHtcbiAgICAgIC8vIHdlIG9ubHkgYXJlIGludGVyZXN0ZWQgaW4gdGhlICpsYXN0KiAlY1xuICAgICAgLy8gKHRoZSB1c2VyIG1heSBoYXZlIHByb3ZpZGVkIHRoZWlyIG93bilcbiAgICAgIGxhc3RDID0gaW5kZXg7XG4gICAgfVxuICB9KTtcblxuICBhcmdzLnNwbGljZShsYXN0QywgMCwgYyk7XG4gIHJldHVybiBhcmdzO1xufVxuXG4vKipcbiAqIEludm9rZXMgYGNvbnNvbGUubG9nKClgIHdoZW4gYXZhaWxhYmxlLlxuICogTm8tb3Agd2hlbiBgY29uc29sZS5sb2dgIGlzIG5vdCBhIFwiZnVuY3Rpb25cIi5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGxvZygpIHtcbiAgLy8gdGhpcyBoYWNrZXJ5IGlzIHJlcXVpcmVkIGZvciBJRTgvOSwgd2hlcmVcbiAgLy8gdGhlIGBjb25zb2xlLmxvZ2AgZnVuY3Rpb24gZG9lc24ndCBoYXZlICdhcHBseSdcbiAgcmV0dXJuICdvYmplY3QnID09PSB0eXBlb2YgY29uc29sZVxuICAgICYmIGNvbnNvbGUubG9nXG4gICAgJiYgRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5LmNhbGwoY29uc29sZS5sb2csIGNvbnNvbGUsIGFyZ3VtZW50cyk7XG59XG5cbi8qKlxuICogU2F2ZSBgbmFtZXNwYWNlc2AuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVzcGFjZXNcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHNhdmUobmFtZXNwYWNlcykge1xuICB0cnkge1xuICAgIGlmIChudWxsID09IG5hbWVzcGFjZXMpIHtcbiAgICAgIHN0b3JhZ2UucmVtb3ZlSXRlbSgnZGVidWcnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RvcmFnZS5kZWJ1ZyA9IG5hbWVzcGFjZXM7XG4gICAgfVxuICB9IGNhdGNoKGUpIHt9XG59XG5cbi8qKlxuICogTG9hZCBgbmFtZXNwYWNlc2AuXG4gKlxuICogQHJldHVybiB7U3RyaW5nfSByZXR1cm5zIHRoZSBwcmV2aW91c2x5IHBlcnNpc3RlZCBkZWJ1ZyBtb2Rlc1xuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gbG9hZCgpIHtcbiAgdmFyIHI7XG4gIHRyeSB7XG4gICAgciA9IHN0b3JhZ2UuZGVidWc7XG4gIH0gY2F0Y2goZSkge31cbiAgcmV0dXJuIHI7XG59XG5cbi8qKlxuICogRW5hYmxlIG5hbWVzcGFjZXMgbGlzdGVkIGluIGBsb2NhbFN0b3JhZ2UuZGVidWdgIGluaXRpYWxseS5cbiAqL1xuXG5leHBvcnRzLmVuYWJsZShsb2FkKCkpO1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL34vZGVidWcvYnJvd3Nlci5qc1xuICoqIG1vZHVsZSBpZCA9IDI3XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gYXJnc0FycmF5O1xuXG5mdW5jdGlvbiBhcmdzQXJyYXkoZnVuKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgaWYgKGxlbikge1xuICAgICAgdmFyIGFyZ3MgPSBbXTtcbiAgICAgIHZhciBpID0gLTE7XG4gICAgICB3aGlsZSAoKytpIDwgbGVuKSB7XG4gICAgICAgIGFyZ3NbaV0gPSBhcmd1bWVudHNbaV07XG4gICAgICB9XG4gICAgICByZXR1cm4gZnVuLmNhbGwodGhpcywgYXJncyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmdW4uY2FsbCh0aGlzLCBbXSk7XG4gICAgfVxuICB9O1xufVxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9+L2FyZ3NhcnJheS9pbmRleC5qc1xuICoqIG1vZHVsZSBpZCA9IDI4XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgbmV4dFRpY2sgPSByZXF1aXJlKCdwcm9jZXNzL2Jyb3dzZXIuanMnKS5uZXh0VGljaztcbnZhciBhcHBseSA9IEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseTtcbnZhciBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZTtcbnZhciBpbW1lZGlhdGVJZHMgPSB7fTtcbnZhciBuZXh0SW1tZWRpYXRlSWQgPSAwO1xuXG4vLyBET00gQVBJcywgZm9yIGNvbXBsZXRlbmVzc1xuXG5leHBvcnRzLnNldFRpbWVvdXQgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIG5ldyBUaW1lb3V0KGFwcGx5LmNhbGwoc2V0VGltZW91dCwgd2luZG93LCBhcmd1bWVudHMpLCBjbGVhclRpbWVvdXQpO1xufTtcbmV4cG9ydHMuc2V0SW50ZXJ2YWwgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIG5ldyBUaW1lb3V0KGFwcGx5LmNhbGwoc2V0SW50ZXJ2YWwsIHdpbmRvdywgYXJndW1lbnRzKSwgY2xlYXJJbnRlcnZhbCk7XG59O1xuZXhwb3J0cy5jbGVhclRpbWVvdXQgPVxuZXhwb3J0cy5jbGVhckludGVydmFsID0gZnVuY3Rpb24odGltZW91dCkgeyB0aW1lb3V0LmNsb3NlKCk7IH07XG5cbmZ1bmN0aW9uIFRpbWVvdXQoaWQsIGNsZWFyRm4pIHtcbiAgdGhpcy5faWQgPSBpZDtcbiAgdGhpcy5fY2xlYXJGbiA9IGNsZWFyRm47XG59XG5UaW1lb3V0LnByb3RvdHlwZS51bnJlZiA9IFRpbWVvdXQucHJvdG90eXBlLnJlZiA9IGZ1bmN0aW9uKCkge307XG5UaW1lb3V0LnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLl9jbGVhckZuLmNhbGwod2luZG93LCB0aGlzLl9pZCk7XG59O1xuXG4vLyBEb2VzIG5vdCBzdGFydCB0aGUgdGltZSwganVzdCBzZXRzIHVwIHRoZSBtZW1iZXJzIG5lZWRlZC5cbmV4cG9ydHMuZW5yb2xsID0gZnVuY3Rpb24oaXRlbSwgbXNlY3MpIHtcbiAgY2xlYXJUaW1lb3V0KGl0ZW0uX2lkbGVUaW1lb3V0SWQpO1xuICBpdGVtLl9pZGxlVGltZW91dCA9IG1zZWNzO1xufTtcblxuZXhwb3J0cy51bmVucm9sbCA9IGZ1bmN0aW9uKGl0ZW0pIHtcbiAgY2xlYXJUaW1lb3V0KGl0ZW0uX2lkbGVUaW1lb3V0SWQpO1xuICBpdGVtLl9pZGxlVGltZW91dCA9IC0xO1xufTtcblxuZXhwb3J0cy5fdW5yZWZBY3RpdmUgPSBleHBvcnRzLmFjdGl2ZSA9IGZ1bmN0aW9uKGl0ZW0pIHtcbiAgY2xlYXJUaW1lb3V0KGl0ZW0uX2lkbGVUaW1lb3V0SWQpO1xuXG4gIHZhciBtc2VjcyA9IGl0ZW0uX2lkbGVUaW1lb3V0O1xuICBpZiAobXNlY3MgPj0gMCkge1xuICAgIGl0ZW0uX2lkbGVUaW1lb3V0SWQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uIG9uVGltZW91dCgpIHtcbiAgICAgIGlmIChpdGVtLl9vblRpbWVvdXQpXG4gICAgICAgIGl0ZW0uX29uVGltZW91dCgpO1xuICAgIH0sIG1zZWNzKTtcbiAgfVxufTtcblxuLy8gVGhhdCdzIG5vdCBob3cgbm9kZS5qcyBpbXBsZW1lbnRzIGl0IGJ1dCB0aGUgZXhwb3NlZCBhcGkgaXMgdGhlIHNhbWUuXG5leHBvcnRzLnNldEltbWVkaWF0ZSA9IHR5cGVvZiBzZXRJbW1lZGlhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHNldEltbWVkaWF0ZSA6IGZ1bmN0aW9uKGZuKSB7XG4gIHZhciBpZCA9IG5leHRJbW1lZGlhdGVJZCsrO1xuICB2YXIgYXJncyA9IGFyZ3VtZW50cy5sZW5ndGggPCAyID8gZmFsc2UgOiBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG5cbiAgaW1tZWRpYXRlSWRzW2lkXSA9IHRydWU7XG5cbiAgbmV4dFRpY2soZnVuY3Rpb24gb25OZXh0VGljaygpIHtcbiAgICBpZiAoaW1tZWRpYXRlSWRzW2lkXSkge1xuICAgICAgLy8gZm4uY2FsbCgpIGlzIGZhc3RlciBzbyB3ZSBvcHRpbWl6ZSBmb3IgdGhlIGNvbW1vbiB1c2UtY2FzZVxuICAgICAgLy8gQHNlZSBodHRwOi8vanNwZXJmLmNvbS9jYWxsLWFwcGx5LXNlZ3VcbiAgICAgIGlmIChhcmdzKSB7XG4gICAgICAgIGZuLmFwcGx5KG51bGwsIGFyZ3MpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm4uY2FsbChudWxsKTtcbiAgICAgIH1cbiAgICAgIC8vIFByZXZlbnQgaWRzIGZyb20gbGVha2luZ1xuICAgICAgZXhwb3J0cy5jbGVhckltbWVkaWF0ZShpZCk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gaWQ7XG59O1xuXG5leHBvcnRzLmNsZWFySW1tZWRpYXRlID0gdHlwZW9mIGNsZWFySW1tZWRpYXRlID09PSBcImZ1bmN0aW9uXCIgPyBjbGVhckltbWVkaWF0ZSA6IGZ1bmN0aW9uKGlkKSB7XG4gIGRlbGV0ZSBpbW1lZGlhdGVJZHNbaWRdO1xufTtcblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqICh3ZWJwYWNrKS9+L25vZGUtbGlicy1icm93c2VyL34vdGltZXJzLWJyb3dzZXJpZnkvbWFpbi5qc1xuICoqIG1vZHVsZSBpZCA9IDI5XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgdmFyIG07XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCFlbWl0dGVyLl9ldmVudHMgfHwgIWVtaXR0ZXIuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSAwO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKGVtaXR0ZXIuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gMTtcbiAgZWxzZVxuICAgIHJldCA9IGVtaXR0ZXIuX2V2ZW50c1t0eXBlXS5sZW5ndGg7XG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqICh3ZWJwYWNrKS9+L25vZGUtbGlicy1icm93c2VyL34vZXZlbnRzL2V2ZW50cy5qc1xuICoqIG1vZHVsZSBpZCA9IDMwXG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCIhZnVuY3Rpb24oZSl7aWYoXCJvYmplY3RcIj09dHlwZW9mIGV4cG9ydHMmJlwidW5kZWZpbmVkXCIhPXR5cGVvZiBtb2R1bGUpbW9kdWxlLmV4cG9ydHM9ZSgpO2Vsc2UgaWYoXCJmdW5jdGlvblwiPT10eXBlb2YgZGVmaW5lJiZkZWZpbmUuYW1kKWRlZmluZShbXSxlKTtlbHNle3ZhciBmO1widW5kZWZpbmVkXCIhPXR5cGVvZiB3aW5kb3c/Zj13aW5kb3c6XCJ1bmRlZmluZWRcIiE9dHlwZW9mIGdsb2JhbD9mPWdsb2JhbDpcInVuZGVmaW5lZFwiIT10eXBlb2Ygc2VsZiYmKGY9c2VsZiksZi5Qcm9taXNlPWUoKX19KGZ1bmN0aW9uKCl7dmFyIGRlZmluZSxtb2R1bGUsZXhwb3J0cztyZXR1cm4gKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkoezE6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xuJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IElOVEVSTkFMO1xuXG5mdW5jdGlvbiBJTlRFUk5BTCgpIHt9XG59LHt9XSwyOltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbid1c2Ugc3RyaWN0JztcbnZhciBQcm9taXNlID0gX2RlcmVxXygnLi9wcm9taXNlJyk7XG52YXIgcmVqZWN0ID0gX2RlcmVxXygnLi9yZWplY3QnKTtcbnZhciByZXNvbHZlID0gX2RlcmVxXygnLi9yZXNvbHZlJyk7XG52YXIgSU5URVJOQUwgPSBfZGVyZXFfKCcuL0lOVEVSTkFMJyk7XG52YXIgaGFuZGxlcnMgPSBfZGVyZXFfKCcuL2hhbmRsZXJzJyk7XG5tb2R1bGUuZXhwb3J0cyA9IGFsbDtcbmZ1bmN0aW9uIGFsbChpdGVyYWJsZSkge1xuICBpZiAoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGl0ZXJhYmxlKSAhPT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgIHJldHVybiByZWplY3QobmV3IFR5cGVFcnJvcignbXVzdCBiZSBhbiBhcnJheScpKTtcbiAgfVxuXG4gIHZhciBsZW4gPSBpdGVyYWJsZS5sZW5ndGg7XG4gIHZhciBjYWxsZWQgPSBmYWxzZTtcbiAgaWYgKCFsZW4pIHtcbiAgICByZXR1cm4gcmVzb2x2ZShbXSk7XG4gIH1cblxuICB2YXIgdmFsdWVzID0gbmV3IEFycmF5KGxlbik7XG4gIHZhciByZXNvbHZlZCA9IDA7XG4gIHZhciBpID0gLTE7XG4gIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoSU5URVJOQUwpO1xuICBcbiAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgIGFsbFJlc29sdmVyKGl0ZXJhYmxlW2ldLCBpKTtcbiAgfVxuICByZXR1cm4gcHJvbWlzZTtcbiAgZnVuY3Rpb24gYWxsUmVzb2x2ZXIodmFsdWUsIGkpIHtcbiAgICByZXNvbHZlKHZhbHVlKS50aGVuKHJlc29sdmVGcm9tQWxsLCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgIGlmICghY2FsbGVkKSB7XG4gICAgICAgIGNhbGxlZCA9IHRydWU7XG4gICAgICAgIGhhbmRsZXJzLnJlamVjdChwcm9taXNlLCBlcnJvcik7XG4gICAgICB9XG4gICAgfSk7XG4gICAgZnVuY3Rpb24gcmVzb2x2ZUZyb21BbGwob3V0VmFsdWUpIHtcbiAgICAgIHZhbHVlc1tpXSA9IG91dFZhbHVlO1xuICAgICAgaWYgKCsrcmVzb2x2ZWQgPT09IGxlbiAmICFjYWxsZWQpIHtcbiAgICAgICAgY2FsbGVkID0gdHJ1ZTtcbiAgICAgICAgaGFuZGxlcnMucmVzb2x2ZShwcm9taXNlLCB2YWx1ZXMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxufSx7XCIuL0lOVEVSTkFMXCI6MSxcIi4vaGFuZGxlcnNcIjozLFwiLi9wcm9taXNlXCI6NSxcIi4vcmVqZWN0XCI6OCxcIi4vcmVzb2x2ZVwiOjl9XSwzOltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbid1c2Ugc3RyaWN0JztcbnZhciB0cnlDYXRjaCA9IF9kZXJlcV8oJy4vdHJ5Q2F0Y2gnKTtcbnZhciByZXNvbHZlVGhlbmFibGUgPSBfZGVyZXFfKCcuL3Jlc29sdmVUaGVuYWJsZScpO1xudmFyIHN0YXRlcyA9IF9kZXJlcV8oJy4vc3RhdGVzJyk7XG5cbmV4cG9ydHMucmVzb2x2ZSA9IGZ1bmN0aW9uIChzZWxmLCB2YWx1ZSkge1xuICB2YXIgcmVzdWx0ID0gdHJ5Q2F0Y2goZ2V0VGhlbiwgdmFsdWUpO1xuICBpZiAocmVzdWx0LnN0YXR1cyA9PT0gJ2Vycm9yJykge1xuICAgIHJldHVybiBleHBvcnRzLnJlamVjdChzZWxmLCByZXN1bHQudmFsdWUpO1xuICB9XG4gIHZhciB0aGVuYWJsZSA9IHJlc3VsdC52YWx1ZTtcblxuICBpZiAodGhlbmFibGUpIHtcbiAgICByZXNvbHZlVGhlbmFibGUuc2FmZWx5KHNlbGYsIHRoZW5hYmxlKTtcbiAgfSBlbHNlIHtcbiAgICBzZWxmLnN0YXRlID0gc3RhdGVzLkZVTEZJTExFRDtcbiAgICBzZWxmLm91dGNvbWUgPSB2YWx1ZTtcbiAgICB2YXIgaSA9IC0xO1xuICAgIHZhciBsZW4gPSBzZWxmLnF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZSAoKytpIDwgbGVuKSB7XG4gICAgICBzZWxmLnF1ZXVlW2ldLmNhbGxGdWxmaWxsZWQodmFsdWUpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gc2VsZjtcbn07XG5leHBvcnRzLnJlamVjdCA9IGZ1bmN0aW9uIChzZWxmLCBlcnJvcikge1xuICBzZWxmLnN0YXRlID0gc3RhdGVzLlJFSkVDVEVEO1xuICBzZWxmLm91dGNvbWUgPSBlcnJvcjtcbiAgdmFyIGkgPSAtMTtcbiAgdmFyIGxlbiA9IHNlbGYucXVldWUubGVuZ3RoO1xuICB3aGlsZSAoKytpIDwgbGVuKSB7XG4gICAgc2VsZi5xdWV1ZVtpXS5jYWxsUmVqZWN0ZWQoZXJyb3IpO1xuICB9XG4gIHJldHVybiBzZWxmO1xufTtcblxuZnVuY3Rpb24gZ2V0VGhlbihvYmopIHtcbiAgLy8gTWFrZSBzdXJlIHdlIG9ubHkgYWNjZXNzIHRoZSBhY2Nlc3NvciBvbmNlIGFzIHJlcXVpcmVkIGJ5IHRoZSBzcGVjXG4gIHZhciB0aGVuID0gb2JqICYmIG9iai50aGVuO1xuICBpZiAob2JqICYmIHR5cGVvZiBvYmogPT09ICdvYmplY3QnICYmIHR5cGVvZiB0aGVuID09PSAnZnVuY3Rpb24nKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIGFwcHlUaGVuKCkge1xuICAgICAgdGhlbi5hcHBseShvYmosIGFyZ3VtZW50cyk7XG4gICAgfTtcbiAgfVxufVxufSx7XCIuL3Jlc29sdmVUaGVuYWJsZVwiOjEwLFwiLi9zdGF0ZXNcIjoxMSxcIi4vdHJ5Q2F0Y2hcIjoxMn1dLDQ6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xubW9kdWxlLmV4cG9ydHMgPSBleHBvcnRzID0gX2RlcmVxXygnLi9wcm9taXNlJyk7XG5cbmV4cG9ydHMucmVzb2x2ZSA9IF9kZXJlcV8oJy4vcmVzb2x2ZScpO1xuZXhwb3J0cy5yZWplY3QgPSBfZGVyZXFfKCcuL3JlamVjdCcpO1xuZXhwb3J0cy5hbGwgPSBfZGVyZXFfKCcuL2FsbCcpO1xuZXhwb3J0cy5yYWNlID0gX2RlcmVxXygnLi9yYWNlJyk7XG59LHtcIi4vYWxsXCI6MixcIi4vcHJvbWlzZVwiOjUsXCIuL3JhY2VcIjo3LFwiLi9yZWplY3RcIjo4LFwiLi9yZXNvbHZlXCI6OX1dLDU6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgdW53cmFwID0gX2RlcmVxXygnLi91bndyYXAnKTtcbnZhciBJTlRFUk5BTCA9IF9kZXJlcV8oJy4vSU5URVJOQUwnKTtcbnZhciByZXNvbHZlVGhlbmFibGUgPSBfZGVyZXFfKCcuL3Jlc29sdmVUaGVuYWJsZScpO1xudmFyIHN0YXRlcyA9IF9kZXJlcV8oJy4vc3RhdGVzJyk7XG52YXIgUXVldWVJdGVtID0gX2RlcmVxXygnLi9xdWV1ZUl0ZW0nKTtcblxubW9kdWxlLmV4cG9ydHMgPSBQcm9taXNlO1xuZnVuY3Rpb24gUHJvbWlzZShyZXNvbHZlcikge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgUHJvbWlzZSkpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZXIpO1xuICB9XG4gIGlmICh0eXBlb2YgcmVzb2x2ZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdyZXNvbHZlciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcbiAgfVxuICB0aGlzLnN0YXRlID0gc3RhdGVzLlBFTkRJTkc7XG4gIHRoaXMucXVldWUgPSBbXTtcbiAgdGhpcy5vdXRjb21lID0gdm9pZCAwO1xuICBpZiAocmVzb2x2ZXIgIT09IElOVEVSTkFMKSB7XG4gICAgcmVzb2x2ZVRoZW5hYmxlLnNhZmVseSh0aGlzLCByZXNvbHZlcik7XG4gIH1cbn1cblxuUHJvbWlzZS5wcm90b3R5cGVbJ2NhdGNoJ10gPSBmdW5jdGlvbiAob25SZWplY3RlZCkge1xuICByZXR1cm4gdGhpcy50aGVuKG51bGwsIG9uUmVqZWN0ZWQpO1xufTtcblByb21pc2UucHJvdG90eXBlLnRoZW4gPSBmdW5jdGlvbiAob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQpIHtcbiAgaWYgKHR5cGVvZiBvbkZ1bGZpbGxlZCAhPT0gJ2Z1bmN0aW9uJyAmJiB0aGlzLnN0YXRlID09PSBzdGF0ZXMuRlVMRklMTEVEIHx8XG4gICAgdHlwZW9mIG9uUmVqZWN0ZWQgIT09ICdmdW5jdGlvbicgJiYgdGhpcy5zdGF0ZSA9PT0gc3RhdGVzLlJFSkVDVEVEKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShJTlRFUk5BTCk7XG5cbiAgXG4gIGlmICh0aGlzLnN0YXRlICE9PSBzdGF0ZXMuUEVORElORykge1xuICAgIHZhciByZXNvbHZlciA9IHRoaXMuc3RhdGUgPT09IHN0YXRlcy5GVUxGSUxMRUQgPyBvbkZ1bGZpbGxlZDogb25SZWplY3RlZDtcbiAgICB1bndyYXAocHJvbWlzZSwgcmVzb2x2ZXIsIHRoaXMub3V0Y29tZSk7XG4gIH0gZWxzZSB7XG4gICAgdGhpcy5xdWV1ZS5wdXNoKG5ldyBRdWV1ZUl0ZW0ocHJvbWlzZSwgb25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQpKTtcbiAgfVxuXG4gIHJldHVybiBwcm9taXNlO1xufTtcblxufSx7XCIuL0lOVEVSTkFMXCI6MSxcIi4vcXVldWVJdGVtXCI6NixcIi4vcmVzb2x2ZVRoZW5hYmxlXCI6MTAsXCIuL3N0YXRlc1wiOjExLFwiLi91bndyYXBcIjoxM31dLDY6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xuJ3VzZSBzdHJpY3QnO1xudmFyIGhhbmRsZXJzID0gX2RlcmVxXygnLi9oYW5kbGVycycpO1xudmFyIHVud3JhcCA9IF9kZXJlcV8oJy4vdW53cmFwJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gUXVldWVJdGVtO1xuZnVuY3Rpb24gUXVldWVJdGVtKHByb21pc2UsIG9uRnVsZmlsbGVkLCBvblJlamVjdGVkKSB7XG4gIHRoaXMucHJvbWlzZSA9IHByb21pc2U7XG4gIGlmICh0eXBlb2Ygb25GdWxmaWxsZWQgPT09ICdmdW5jdGlvbicpIHtcbiAgICB0aGlzLm9uRnVsZmlsbGVkID0gb25GdWxmaWxsZWQ7XG4gICAgdGhpcy5jYWxsRnVsZmlsbGVkID0gdGhpcy5vdGhlckNhbGxGdWxmaWxsZWQ7XG4gIH1cbiAgaWYgKHR5cGVvZiBvblJlamVjdGVkID09PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhpcy5vblJlamVjdGVkID0gb25SZWplY3RlZDtcbiAgICB0aGlzLmNhbGxSZWplY3RlZCA9IHRoaXMub3RoZXJDYWxsUmVqZWN0ZWQ7XG4gIH1cbn1cblF1ZXVlSXRlbS5wcm90b3R5cGUuY2FsbEZ1bGZpbGxlZCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICBoYW5kbGVycy5yZXNvbHZlKHRoaXMucHJvbWlzZSwgdmFsdWUpO1xufTtcblF1ZXVlSXRlbS5wcm90b3R5cGUub3RoZXJDYWxsRnVsZmlsbGVkID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIHVud3JhcCh0aGlzLnByb21pc2UsIHRoaXMub25GdWxmaWxsZWQsIHZhbHVlKTtcbn07XG5RdWV1ZUl0ZW0ucHJvdG90eXBlLmNhbGxSZWplY3RlZCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICBoYW5kbGVycy5yZWplY3QodGhpcy5wcm9taXNlLCB2YWx1ZSk7XG59O1xuUXVldWVJdGVtLnByb3RvdHlwZS5vdGhlckNhbGxSZWplY3RlZCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICB1bndyYXAodGhpcy5wcm9taXNlLCB0aGlzLm9uUmVqZWN0ZWQsIHZhbHVlKTtcbn07XG59LHtcIi4vaGFuZGxlcnNcIjozLFwiLi91bndyYXBcIjoxM31dLDc6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xuJ3VzZSBzdHJpY3QnO1xudmFyIFByb21pc2UgPSBfZGVyZXFfKCcuL3Byb21pc2UnKTtcbnZhciByZWplY3QgPSBfZGVyZXFfKCcuL3JlamVjdCcpO1xudmFyIHJlc29sdmUgPSBfZGVyZXFfKCcuL3Jlc29sdmUnKTtcbnZhciBJTlRFUk5BTCA9IF9kZXJlcV8oJy4vSU5URVJOQUwnKTtcbnZhciBoYW5kbGVycyA9IF9kZXJlcV8oJy4vaGFuZGxlcnMnKTtcbm1vZHVsZS5leHBvcnRzID0gcmFjZTtcbmZ1bmN0aW9uIHJhY2UoaXRlcmFibGUpIHtcbiAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChpdGVyYWJsZSkgIT09ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICByZXR1cm4gcmVqZWN0KG5ldyBUeXBlRXJyb3IoJ211c3QgYmUgYW4gYXJyYXknKSk7XG4gIH1cblxuICB2YXIgbGVuID0gaXRlcmFibGUubGVuZ3RoO1xuICB2YXIgY2FsbGVkID0gZmFsc2U7XG4gIGlmICghbGVuKSB7XG4gICAgcmV0dXJuIHJlc29sdmUoW10pO1xuICB9XG5cbiAgdmFyIHJlc29sdmVkID0gMDtcbiAgdmFyIGkgPSAtMTtcbiAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShJTlRFUk5BTCk7XG4gIFxuICB3aGlsZSAoKytpIDwgbGVuKSB7XG4gICAgcmVzb2x2ZXIoaXRlcmFibGVbaV0pO1xuICB9XG4gIHJldHVybiBwcm9taXNlO1xuICBmdW5jdGlvbiByZXNvbHZlcih2YWx1ZSkge1xuICAgIHJlc29sdmUodmFsdWUpLnRoZW4oZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgICBpZiAoIWNhbGxlZCkge1xuICAgICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgICBoYW5kbGVycy5yZXNvbHZlKHByb21pc2UsIHJlc3BvbnNlKTtcbiAgICAgIH1cbiAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgIGlmICghY2FsbGVkKSB7XG4gICAgICAgIGNhbGxlZCA9IHRydWU7XG4gICAgICAgIGhhbmRsZXJzLnJlamVjdChwcm9taXNlLCBlcnJvcik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cbn0se1wiLi9JTlRFUk5BTFwiOjEsXCIuL2hhbmRsZXJzXCI6MyxcIi4vcHJvbWlzZVwiOjUsXCIuL3JlamVjdFwiOjgsXCIuL3Jlc29sdmVcIjo5fV0sODpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBQcm9taXNlID0gX2RlcmVxXygnLi9wcm9taXNlJyk7XG52YXIgSU5URVJOQUwgPSBfZGVyZXFfKCcuL0lOVEVSTkFMJyk7XG52YXIgaGFuZGxlcnMgPSBfZGVyZXFfKCcuL2hhbmRsZXJzJyk7XG5tb2R1bGUuZXhwb3J0cyA9IHJlamVjdDtcblxuZnVuY3Rpb24gcmVqZWN0KHJlYXNvbikge1xuXHR2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKElOVEVSTkFMKTtcblx0cmV0dXJuIGhhbmRsZXJzLnJlamVjdChwcm9taXNlLCByZWFzb24pO1xufVxufSx7XCIuL0lOVEVSTkFMXCI6MSxcIi4vaGFuZGxlcnNcIjozLFwiLi9wcm9taXNlXCI6NX1dLDk6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgUHJvbWlzZSA9IF9kZXJlcV8oJy4vcHJvbWlzZScpO1xudmFyIElOVEVSTkFMID0gX2RlcmVxXygnLi9JTlRFUk5BTCcpO1xudmFyIGhhbmRsZXJzID0gX2RlcmVxXygnLi9oYW5kbGVycycpO1xubW9kdWxlLmV4cG9ydHMgPSByZXNvbHZlO1xuXG52YXIgRkFMU0UgPSBoYW5kbGVycy5yZXNvbHZlKG5ldyBQcm9taXNlKElOVEVSTkFMKSwgZmFsc2UpO1xudmFyIE5VTEwgPSBoYW5kbGVycy5yZXNvbHZlKG5ldyBQcm9taXNlKElOVEVSTkFMKSwgbnVsbCk7XG52YXIgVU5ERUZJTkVEID0gaGFuZGxlcnMucmVzb2x2ZShuZXcgUHJvbWlzZShJTlRFUk5BTCksIHZvaWQgMCk7XG52YXIgWkVSTyA9IGhhbmRsZXJzLnJlc29sdmUobmV3IFByb21pc2UoSU5URVJOQUwpLCAwKTtcbnZhciBFTVBUWVNUUklORyA9IGhhbmRsZXJzLnJlc29sdmUobmV3IFByb21pc2UoSU5URVJOQUwpLCAnJyk7XG5cbmZ1bmN0aW9uIHJlc29sdmUodmFsdWUpIHtcbiAgaWYgKHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cbiAgICByZXR1cm4gaGFuZGxlcnMucmVzb2x2ZShuZXcgUHJvbWlzZShJTlRFUk5BTCksIHZhbHVlKTtcbiAgfVxuICB2YXIgdmFsdWVUeXBlID0gdHlwZW9mIHZhbHVlO1xuICBzd2l0Y2ggKHZhbHVlVHlwZSkge1xuICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgICAgcmV0dXJuIEZBTFNFO1xuICAgIGNhc2UgJ3VuZGVmaW5lZCc6XG4gICAgICByZXR1cm4gVU5ERUZJTkVEO1xuICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICByZXR1cm4gTlVMTDtcbiAgICBjYXNlICdudW1iZXInOlxuICAgICAgcmV0dXJuIFpFUk87XG4gICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgIHJldHVybiBFTVBUWVNUUklORztcbiAgfVxufVxufSx7XCIuL0lOVEVSTkFMXCI6MSxcIi4vaGFuZGxlcnNcIjozLFwiLi9wcm9taXNlXCI6NX1dLDEwOltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbid1c2Ugc3RyaWN0JztcbnZhciBoYW5kbGVycyA9IF9kZXJlcV8oJy4vaGFuZGxlcnMnKTtcbnZhciB0cnlDYXRjaCA9IF9kZXJlcV8oJy4vdHJ5Q2F0Y2gnKTtcbmZ1bmN0aW9uIHNhZmVseVJlc29sdmVUaGVuYWJsZShzZWxmLCB0aGVuYWJsZSkge1xuICAvLyBFaXRoZXIgZnVsZmlsbCwgcmVqZWN0IG9yIHJlamVjdCB3aXRoIGVycm9yXG4gIHZhciBjYWxsZWQgPSBmYWxzZTtcbiAgZnVuY3Rpb24gb25FcnJvcih2YWx1ZSkge1xuICAgIGlmIChjYWxsZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY2FsbGVkID0gdHJ1ZTtcbiAgICBoYW5kbGVycy5yZWplY3Qoc2VsZiwgdmFsdWUpO1xuICB9XG5cbiAgZnVuY3Rpb24gb25TdWNjZXNzKHZhbHVlKSB7XG4gICAgaWYgKGNhbGxlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjYWxsZWQgPSB0cnVlO1xuICAgIGhhbmRsZXJzLnJlc29sdmUoc2VsZiwgdmFsdWUpO1xuICB9XG5cbiAgZnVuY3Rpb24gdHJ5VG9VbndyYXAoKSB7XG4gICAgdGhlbmFibGUob25TdWNjZXNzLCBvbkVycm9yKTtcbiAgfVxuICBcbiAgdmFyIHJlc3VsdCA9IHRyeUNhdGNoKHRyeVRvVW53cmFwKTtcbiAgaWYgKHJlc3VsdC5zdGF0dXMgPT09ICdlcnJvcicpIHtcbiAgICBvbkVycm9yKHJlc3VsdC52YWx1ZSk7XG4gIH1cbn1cbmV4cG9ydHMuc2FmZWx5ID0gc2FmZWx5UmVzb2x2ZVRoZW5hYmxlO1xufSx7XCIuL2hhbmRsZXJzXCI6MyxcIi4vdHJ5Q2F0Y2hcIjoxMn1dLDExOltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbi8vIExhenkgbWFuJ3Mgc3ltYm9scyBmb3Igc3RhdGVzXG5cbmV4cG9ydHMuUkVKRUNURUQgPSBbJ1JFSkVDVEVEJ107XG5leHBvcnRzLkZVTEZJTExFRCA9IFsnRlVMRklMTEVEJ107XG5leHBvcnRzLlBFTkRJTkcgPSBbJ1BFTkRJTkcnXTtcbn0se31dLDEyOltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSB0cnlDYXRjaDtcblxuZnVuY3Rpb24gdHJ5Q2F0Y2goZnVuYywgdmFsdWUpIHtcbiAgdmFyIG91dCA9IHt9O1xuICB0cnkge1xuICAgIG91dC52YWx1ZSA9IGZ1bmModmFsdWUpO1xuICAgIG91dC5zdGF0dXMgPSAnc3VjY2Vzcyc7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBvdXQuc3RhdHVzID0gJ2Vycm9yJztcbiAgICBvdXQudmFsdWUgPSBlO1xuICB9XG4gIHJldHVybiBvdXQ7XG59XG59LHt9XSwxMzpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBpbW1lZGlhdGUgPSBfZGVyZXFfKCdpbW1lZGlhdGUnKTtcbnZhciBoYW5kbGVycyA9IF9kZXJlcV8oJy4vaGFuZGxlcnMnKTtcbm1vZHVsZS5leHBvcnRzID0gdW53cmFwO1xuXG5mdW5jdGlvbiB1bndyYXAocHJvbWlzZSwgZnVuYywgdmFsdWUpIHtcbiAgaW1tZWRpYXRlKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcmV0dXJuVmFsdWU7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVyblZhbHVlID0gZnVuYyh2YWx1ZSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmV0dXJuIGhhbmRsZXJzLnJlamVjdChwcm9taXNlLCBlKTtcbiAgICB9XG4gICAgaWYgKHJldHVyblZhbHVlID09PSBwcm9taXNlKSB7XG4gICAgICBoYW5kbGVycy5yZWplY3QocHJvbWlzZSwgbmV3IFR5cGVFcnJvcignQ2Fubm90IHJlc29sdmUgcHJvbWlzZSB3aXRoIGl0c2VsZicpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaGFuZGxlcnMucmVzb2x2ZShwcm9taXNlLCByZXR1cm5WYWx1ZSk7XG4gICAgfVxuICB9KTtcbn1cbn0se1wiLi9oYW5kbGVyc1wiOjMsXCJpbW1lZGlhdGVcIjoxNX1dLDE0OltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcblxufSx7fV0sMTU6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xuJ3VzZSBzdHJpY3QnO1xudmFyIHR5cGVzID0gW1xuICBfZGVyZXFfKCcuL25leHRUaWNrJyksXG4gIF9kZXJlcV8oJy4vbXV0YXRpb24uanMnKSxcbiAgX2RlcmVxXygnLi9tZXNzYWdlQ2hhbm5lbCcpLFxuICBfZGVyZXFfKCcuL3N0YXRlQ2hhbmdlJyksXG4gIF9kZXJlcV8oJy4vdGltZW91dCcpXG5dO1xudmFyIGRyYWluaW5nO1xudmFyIHF1ZXVlID0gW107XG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICBkcmFpbmluZyA9IHRydWU7XG4gIHZhciBpLCBvbGRRdWV1ZTtcbiAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgd2hpbGUgKGxlbikge1xuICAgIG9sZFF1ZXVlID0gcXVldWU7XG4gICAgcXVldWUgPSBbXTtcbiAgICBpID0gLTE7XG4gICAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgICAgb2xkUXVldWVbaV0oKTtcbiAgICB9XG4gICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICB9XG4gIGRyYWluaW5nID0gZmFsc2U7XG59XG52YXIgc2NoZWR1bGVEcmFpbjtcbnZhciBpID0gLTE7XG52YXIgbGVuID0gdHlwZXMubGVuZ3RoO1xud2hpbGUgKCsrIGkgPCBsZW4pIHtcbiAgaWYgKHR5cGVzW2ldICYmIHR5cGVzW2ldLnRlc3QgJiYgdHlwZXNbaV0udGVzdCgpKSB7XG4gICAgc2NoZWR1bGVEcmFpbiA9IHR5cGVzW2ldLmluc3RhbGwoZHJhaW5RdWV1ZSk7XG4gICAgYnJlYWs7XG4gIH1cbn1cbm1vZHVsZS5leHBvcnRzID0gaW1tZWRpYXRlO1xuZnVuY3Rpb24gaW1tZWRpYXRlKHRhc2spIHtcbiAgaWYgKHF1ZXVlLnB1c2godGFzaykgPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgc2NoZWR1bGVEcmFpbigpO1xuICB9XG59XG59LHtcIi4vbWVzc2FnZUNoYW5uZWxcIjoxNixcIi4vbXV0YXRpb24uanNcIjoxNyxcIi4vbmV4dFRpY2tcIjoxNCxcIi4vc3RhdGVDaGFuZ2VcIjoxOCxcIi4vdGltZW91dFwiOjE5fV0sMTY6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xuKGZ1bmN0aW9uIChnbG9iYWwpe1xuJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLnRlc3QgPSBmdW5jdGlvbiAoKSB7XG4gIGlmIChnbG9iYWwuc2V0SW1tZWRpYXRlKSB7XG4gICAgLy8gd2UgY2FuIG9ubHkgZ2V0IGhlcmUgaW4gSUUxMFxuICAgIC8vIHdoaWNoIGRvZXNuJ3QgaGFuZGVsIHBvc3RNZXNzYWdlIHdlbGxcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHR5cGVvZiBnbG9iYWwuTWVzc2FnZUNoYW5uZWwgIT09ICd1bmRlZmluZWQnO1xufTtcblxuZXhwb3J0cy5pbnN0YWxsID0gZnVuY3Rpb24gKGZ1bmMpIHtcbiAgdmFyIGNoYW5uZWwgPSBuZXcgZ2xvYmFsLk1lc3NhZ2VDaGFubmVsKCk7XG4gIGNoYW5uZWwucG9ydDEub25tZXNzYWdlID0gZnVuYztcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICBjaGFubmVsLnBvcnQyLnBvc3RNZXNzYWdlKDApO1xuICB9O1xufTtcbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KVxufSx7fV0sMTc6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xuKGZ1bmN0aW9uIChnbG9iYWwpe1xuJ3VzZSBzdHJpY3QnO1xuLy9iYXNlZCBvZmYgcnN2cCBodHRwczovL2dpdGh1Yi5jb20vdGlsZGVpby9yc3ZwLmpzXG4vL2xpY2Vuc2UgaHR0cHM6Ly9naXRodWIuY29tL3RpbGRlaW8vcnN2cC5qcy9ibG9iL21hc3Rlci9MSUNFTlNFXG4vL2h0dHBzOi8vZ2l0aHViLmNvbS90aWxkZWlvL3JzdnAuanMvYmxvYi9tYXN0ZXIvbGliL3JzdnAvYXNhcC5qc1xuXG52YXIgTXV0YXRpb24gPSBnbG9iYWwuTXV0YXRpb25PYnNlcnZlciB8fCBnbG9iYWwuV2ViS2l0TXV0YXRpb25PYnNlcnZlcjtcblxuZXhwb3J0cy50ZXN0ID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gTXV0YXRpb247XG59O1xuXG5leHBvcnRzLmluc3RhbGwgPSBmdW5jdGlvbiAoaGFuZGxlKSB7XG4gIHZhciBjYWxsZWQgPSAwO1xuICB2YXIgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb24oaGFuZGxlKTtcbiAgdmFyIGVsZW1lbnQgPSBnbG9iYWwuZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJycpO1xuICBvYnNlcnZlci5vYnNlcnZlKGVsZW1lbnQsIHtcbiAgICBjaGFyYWN0ZXJEYXRhOiB0cnVlXG4gIH0pO1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIGVsZW1lbnQuZGF0YSA9IChjYWxsZWQgPSArK2NhbGxlZCAlIDIpO1xuICB9O1xufTtcbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KVxufSx7fV0sMTg6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xuKGZ1bmN0aW9uIChnbG9iYWwpe1xuJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLnRlc3QgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiAnZG9jdW1lbnQnIGluIGdsb2JhbCAmJiAnb25yZWFkeXN0YXRlY2hhbmdlJyBpbiBnbG9iYWwuZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG59O1xuXG5leHBvcnRzLmluc3RhbGwgPSBmdW5jdGlvbiAoaGFuZGxlKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG5cbiAgICAvLyBDcmVhdGUgYSA8c2NyaXB0PiBlbGVtZW50OyBpdHMgcmVhZHlzdGF0ZWNoYW5nZSBldmVudCB3aWxsIGJlIGZpcmVkIGFzeW5jaHJvbm91c2x5IG9uY2UgaXQgaXMgaW5zZXJ0ZWRcbiAgICAvLyBpbnRvIHRoZSBkb2N1bWVudC4gRG8gc28sIHRodXMgcXVldWluZyB1cCB0aGUgdGFzay4gUmVtZW1iZXIgdG8gY2xlYW4gdXAgb25jZSBpdCdzIGJlZW4gY2FsbGVkLlxuICAgIHZhciBzY3JpcHRFbCA9IGdsb2JhbC5kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcbiAgICBzY3JpcHRFbC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgICBoYW5kbGUoKTtcblxuICAgICAgc2NyaXB0RWwub25yZWFkeXN0YXRlY2hhbmdlID0gbnVsbDtcbiAgICAgIHNjcmlwdEVsLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoc2NyaXB0RWwpO1xuICAgICAgc2NyaXB0RWwgPSBudWxsO1xuICAgIH07XG4gICAgZ2xvYmFsLmRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5hcHBlbmRDaGlsZChzY3JpcHRFbCk7XG5cbiAgICByZXR1cm4gaGFuZGxlO1xuICB9O1xufTtcbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KVxufSx7fV0sMTk6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xuJ3VzZSBzdHJpY3QnO1xuZXhwb3J0cy50ZXN0ID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdHJ1ZTtcbn07XG5cbmV4cG9ydHMuaW5zdGFsbCA9IGZ1bmN0aW9uICh0KSB7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgc2V0VGltZW91dCh0LCAwKTtcbiAgfTtcbn07XG59LHt9XX0se30sWzRdKSg0KVxufSk7XG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vfi9saWUvZGlzdC9saWUuanNcbiAqKiBtb2R1bGUgaWQgPSAzMVxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiXG4vKipcbiAqIFRoaXMgaXMgdGhlIGNvbW1vbiBsb2dpYyBmb3IgYm90aCB0aGUgTm9kZS5qcyBhbmQgd2ViIGJyb3dzZXJcbiAqIGltcGxlbWVudGF0aW9ucyBvZiBgZGVidWcoKWAuXG4gKlxuICogRXhwb3NlIGBkZWJ1ZygpYCBhcyB0aGUgbW9kdWxlLlxuICovXG5cbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IGRlYnVnO1xuZXhwb3J0cy5jb2VyY2UgPSBjb2VyY2U7XG5leHBvcnRzLmRpc2FibGUgPSBkaXNhYmxlO1xuZXhwb3J0cy5lbmFibGUgPSBlbmFibGU7XG5leHBvcnRzLmVuYWJsZWQgPSBlbmFibGVkO1xuZXhwb3J0cy5odW1hbml6ZSA9IHJlcXVpcmUoJ21zJyk7XG5cbi8qKlxuICogVGhlIGN1cnJlbnRseSBhY3RpdmUgZGVidWcgbW9kZSBuYW1lcywgYW5kIG5hbWVzIHRvIHNraXAuXG4gKi9cblxuZXhwb3J0cy5uYW1lcyA9IFtdO1xuZXhwb3J0cy5za2lwcyA9IFtdO1xuXG4vKipcbiAqIE1hcCBvZiBzcGVjaWFsIFwiJW5cIiBoYW5kbGluZyBmdW5jdGlvbnMsIGZvciB0aGUgZGVidWcgXCJmb3JtYXRcIiBhcmd1bWVudC5cbiAqXG4gKiBWYWxpZCBrZXkgbmFtZXMgYXJlIGEgc2luZ2xlLCBsb3dlcmNhc2VkIGxldHRlciwgaS5lLiBcIm5cIi5cbiAqL1xuXG5leHBvcnRzLmZvcm1hdHRlcnMgPSB7fTtcblxuLyoqXG4gKiBQcmV2aW91c2x5IGFzc2lnbmVkIGNvbG9yLlxuICovXG5cbnZhciBwcmV2Q29sb3IgPSAwO1xuXG4vKipcbiAqIFByZXZpb3VzIGxvZyB0aW1lc3RhbXAuXG4gKi9cblxudmFyIHByZXZUaW1lO1xuXG4vKipcbiAqIFNlbGVjdCBhIGNvbG9yLlxuICpcbiAqIEByZXR1cm4ge051bWJlcn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHNlbGVjdENvbG9yKCkge1xuICByZXR1cm4gZXhwb3J0cy5jb2xvcnNbcHJldkNvbG9yKysgJSBleHBvcnRzLmNvbG9ycy5sZW5ndGhdO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIGRlYnVnZ2VyIHdpdGggdGhlIGdpdmVuIGBuYW1lc3BhY2VgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBkZWJ1ZyhuYW1lc3BhY2UpIHtcblxuICAvLyBkZWZpbmUgdGhlIGBkaXNhYmxlZGAgdmVyc2lvblxuICBmdW5jdGlvbiBkaXNhYmxlZCgpIHtcbiAgfVxuICBkaXNhYmxlZC5lbmFibGVkID0gZmFsc2U7XG5cbiAgLy8gZGVmaW5lIHRoZSBgZW5hYmxlZGAgdmVyc2lvblxuICBmdW5jdGlvbiBlbmFibGVkKCkge1xuXG4gICAgdmFyIHNlbGYgPSBlbmFibGVkO1xuXG4gICAgLy8gc2V0IGBkaWZmYCB0aW1lc3RhbXBcbiAgICB2YXIgY3VyciA9ICtuZXcgRGF0ZSgpO1xuICAgIHZhciBtcyA9IGN1cnIgLSAocHJldlRpbWUgfHwgY3Vycik7XG4gICAgc2VsZi5kaWZmID0gbXM7XG4gICAgc2VsZi5wcmV2ID0gcHJldlRpbWU7XG4gICAgc2VsZi5jdXJyID0gY3VycjtcbiAgICBwcmV2VGltZSA9IGN1cnI7XG5cbiAgICAvLyBhZGQgdGhlIGBjb2xvcmAgaWYgbm90IHNldFxuICAgIGlmIChudWxsID09IHNlbGYudXNlQ29sb3JzKSBzZWxmLnVzZUNvbG9ycyA9IGV4cG9ydHMudXNlQ29sb3JzKCk7XG4gICAgaWYgKG51bGwgPT0gc2VsZi5jb2xvciAmJiBzZWxmLnVzZUNvbG9ycykgc2VsZi5jb2xvciA9IHNlbGVjdENvbG9yKCk7XG5cbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cbiAgICBhcmdzWzBdID0gZXhwb3J0cy5jb2VyY2UoYXJnc1swXSk7XG5cbiAgICBpZiAoJ3N0cmluZycgIT09IHR5cGVvZiBhcmdzWzBdKSB7XG4gICAgICAvLyBhbnl0aGluZyBlbHNlIGxldCdzIGluc3BlY3Qgd2l0aCAlb1xuICAgICAgYXJncyA9IFsnJW8nXS5jb25jYXQoYXJncyk7XG4gICAgfVxuXG4gICAgLy8gYXBwbHkgYW55IGBmb3JtYXR0ZXJzYCB0cmFuc2Zvcm1hdGlvbnNcbiAgICB2YXIgaW5kZXggPSAwO1xuICAgIGFyZ3NbMF0gPSBhcmdzWzBdLnJlcGxhY2UoLyUoW2EteiVdKS9nLCBmdW5jdGlvbihtYXRjaCwgZm9ybWF0KSB7XG4gICAgICAvLyBpZiB3ZSBlbmNvdW50ZXIgYW4gZXNjYXBlZCAlIHRoZW4gZG9uJ3QgaW5jcmVhc2UgdGhlIGFycmF5IGluZGV4XG4gICAgICBpZiAobWF0Y2ggPT09ICclJScpIHJldHVybiBtYXRjaDtcbiAgICAgIGluZGV4Kys7XG4gICAgICB2YXIgZm9ybWF0dGVyID0gZXhwb3J0cy5mb3JtYXR0ZXJzW2Zvcm1hdF07XG4gICAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGZvcm1hdHRlcikge1xuICAgICAgICB2YXIgdmFsID0gYXJnc1tpbmRleF07XG4gICAgICAgIG1hdGNoID0gZm9ybWF0dGVyLmNhbGwoc2VsZiwgdmFsKTtcblxuICAgICAgICAvLyBub3cgd2UgbmVlZCB0byByZW1vdmUgYGFyZ3NbaW5kZXhdYCBzaW5jZSBpdCdzIGlubGluZWQgaW4gdGhlIGBmb3JtYXRgXG4gICAgICAgIGFyZ3Muc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgaW5kZXgtLTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtYXRjaDtcbiAgICB9KTtcblxuICAgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgZXhwb3J0cy5mb3JtYXRBcmdzKSB7XG4gICAgICBhcmdzID0gZXhwb3J0cy5mb3JtYXRBcmdzLmFwcGx5KHNlbGYsIGFyZ3MpO1xuICAgIH1cbiAgICB2YXIgbG9nRm4gPSBlbmFibGVkLmxvZyB8fCBleHBvcnRzLmxvZyB8fCBjb25zb2xlLmxvZy5iaW5kKGNvbnNvbGUpO1xuICAgIGxvZ0ZuLmFwcGx5KHNlbGYsIGFyZ3MpO1xuICB9XG4gIGVuYWJsZWQuZW5hYmxlZCA9IHRydWU7XG5cbiAgdmFyIGZuID0gZXhwb3J0cy5lbmFibGVkKG5hbWVzcGFjZSkgPyBlbmFibGVkIDogZGlzYWJsZWQ7XG5cbiAgZm4ubmFtZXNwYWNlID0gbmFtZXNwYWNlO1xuXG4gIHJldHVybiBmbjtcbn1cblxuLyoqXG4gKiBFbmFibGVzIGEgZGVidWcgbW9kZSBieSBuYW1lc3BhY2VzLiBUaGlzIGNhbiBpbmNsdWRlIG1vZGVzXG4gKiBzZXBhcmF0ZWQgYnkgYSBjb2xvbiBhbmQgd2lsZGNhcmRzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VzXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGVuYWJsZShuYW1lc3BhY2VzKSB7XG4gIGV4cG9ydHMuc2F2ZShuYW1lc3BhY2VzKTtcblxuICB2YXIgc3BsaXQgPSAobmFtZXNwYWNlcyB8fCAnJykuc3BsaXQoL1tcXHMsXSsvKTtcbiAgdmFyIGxlbiA9IHNwbGl0Lmxlbmd0aDtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKCFzcGxpdFtpXSkgY29udGludWU7IC8vIGlnbm9yZSBlbXB0eSBzdHJpbmdzXG4gICAgbmFtZXNwYWNlcyA9IHNwbGl0W2ldLnJlcGxhY2UoL1xcKi9nLCAnLio/Jyk7XG4gICAgaWYgKG5hbWVzcGFjZXNbMF0gPT09ICctJykge1xuICAgICAgZXhwb3J0cy5za2lwcy5wdXNoKG5ldyBSZWdFeHAoJ14nICsgbmFtZXNwYWNlcy5zdWJzdHIoMSkgKyAnJCcpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZXhwb3J0cy5uYW1lcy5wdXNoKG5ldyBSZWdFeHAoJ14nICsgbmFtZXNwYWNlcyArICckJykpO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIERpc2FibGUgZGVidWcgb3V0cHV0LlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZGlzYWJsZSgpIHtcbiAgZXhwb3J0cy5lbmFibGUoJycpO1xufVxuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgZ2l2ZW4gbW9kZSBuYW1lIGlzIGVuYWJsZWQsIGZhbHNlIG90aGVyd2lzZS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZW5hYmxlZChuYW1lKSB7XG4gIHZhciBpLCBsZW47XG4gIGZvciAoaSA9IDAsIGxlbiA9IGV4cG9ydHMuc2tpcHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBpZiAoZXhwb3J0cy5za2lwc1tpXS50ZXN0KG5hbWUpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIGZvciAoaSA9IDAsIGxlbiA9IGV4cG9ydHMubmFtZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBpZiAoZXhwb3J0cy5uYW1lc1tpXS50ZXN0KG5hbWUpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vKipcbiAqIENvZXJjZSBgdmFsYC5cbiAqXG4gKiBAcGFyYW0ge01peGVkfSB2YWxcbiAqIEByZXR1cm4ge01peGVkfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gY29lcmNlKHZhbCkge1xuICBpZiAodmFsIGluc3RhbmNlb2YgRXJyb3IpIHJldHVybiB2YWwuc3RhY2sgfHwgdmFsLm1lc3NhZ2U7XG4gIHJldHVybiB2YWw7XG59XG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vfi9kZWJ1Zy9kZWJ1Zy5qc1xuICoqIG1vZHVsZSBpZCA9IDMyXG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG1vZHVsZSkge1xyXG5cdGlmKCFtb2R1bGUud2VicGFja1BvbHlmaWxsKSB7XHJcblx0XHRtb2R1bGUuZGVwcmVjYXRlID0gZnVuY3Rpb24oKSB7fTtcclxuXHRcdG1vZHVsZS5wYXRocyA9IFtdO1xyXG5cdFx0Ly8gbW9kdWxlLnBhcmVudCA9IHVuZGVmaW5lZCBieSBkZWZhdWx0XHJcblx0XHRtb2R1bGUuY2hpbGRyZW4gPSBbXTtcclxuXHRcdG1vZHVsZS53ZWJwYWNrUG9seWZpbGwgPSAxO1xyXG5cdH1cclxuXHRyZXR1cm4gbW9kdWxlO1xyXG59XHJcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogKHdlYnBhY2spL2J1aWxkaW4vbW9kdWxlLmpzXG4gKiogbW9kdWxlIGlkID0gMzNcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGRyYWluaW5nID0gdHJ1ZTtcbiAgICB2YXIgY3VycmVudFF1ZXVlO1xuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB2YXIgaSA9IC0xO1xuICAgICAgICB3aGlsZSAoKytpIDwgbGVuKSB7XG4gICAgICAgICAgICBjdXJyZW50UXVldWVbaV0oKTtcbiAgICAgICAgfVxuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGRyYWluaW5nID0gZmFsc2U7XG59XG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHF1ZXVlLnB1c2goZnVuKTtcbiAgICBpZiAoIWRyYWluaW5nKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZHJhaW5RdWV1ZSwgMCk7XG4gICAgfVxufTtcblxucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbi8vIFRPRE8oc2h0eWxtYW4pXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqICh3ZWJwYWNrKS9+L25vZGUtbGlicy1icm93c2VyL34vcHJvY2Vzcy9icm93c2VyLmpzXG4gKiogbW9kdWxlIGlkID0gMzRcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIi8qKlxuICogSGVscGVycy5cbiAqL1xuXG52YXIgcyA9IDEwMDA7XG52YXIgbSA9IHMgKiA2MDtcbnZhciBoID0gbSAqIDYwO1xudmFyIGQgPSBoICogMjQ7XG52YXIgeSA9IGQgKiAzNjUuMjU7XG5cbi8qKlxuICogUGFyc2Ugb3IgZm9ybWF0IHRoZSBnaXZlbiBgdmFsYC5cbiAqXG4gKiBPcHRpb25zOlxuICpcbiAqICAtIGBsb25nYCB2ZXJib3NlIGZvcm1hdHRpbmcgW2ZhbHNlXVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfE51bWJlcn0gdmFsXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHJldHVybiB7U3RyaW5nfE51bWJlcn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih2YWwsIG9wdGlvbnMpe1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgaWYgKCdzdHJpbmcnID09IHR5cGVvZiB2YWwpIHJldHVybiBwYXJzZSh2YWwpO1xuICByZXR1cm4gb3B0aW9ucy5sb25nXG4gICAgPyBsb25nKHZhbClcbiAgICA6IHNob3J0KHZhbCk7XG59O1xuXG4vKipcbiAqIFBhcnNlIHRoZSBnaXZlbiBgc3RyYCBhbmQgcmV0dXJuIG1pbGxpc2Vjb25kcy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyXG4gKiBAcmV0dXJuIHtOdW1iZXJ9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBwYXJzZShzdHIpIHtcbiAgdmFyIG1hdGNoID0gL14oKD86XFxkKyk/XFwuP1xcZCspICoobXN8c2Vjb25kcz98c3xtaW51dGVzP3xtfGhvdXJzP3xofGRheXM/fGR8eWVhcnM/fHkpPyQvaS5leGVjKHN0cik7XG4gIGlmICghbWF0Y2gpIHJldHVybjtcbiAgdmFyIG4gPSBwYXJzZUZsb2F0KG1hdGNoWzFdKTtcbiAgdmFyIHR5cGUgPSAobWF0Y2hbMl0gfHwgJ21zJykudG9Mb3dlckNhc2UoKTtcbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSAneWVhcnMnOlxuICAgIGNhc2UgJ3llYXInOlxuICAgIGNhc2UgJ3knOlxuICAgICAgcmV0dXJuIG4gKiB5O1xuICAgIGNhc2UgJ2RheXMnOlxuICAgIGNhc2UgJ2RheSc6XG4gICAgY2FzZSAnZCc6XG4gICAgICByZXR1cm4gbiAqIGQ7XG4gICAgY2FzZSAnaG91cnMnOlxuICAgIGNhc2UgJ2hvdXInOlxuICAgIGNhc2UgJ2gnOlxuICAgICAgcmV0dXJuIG4gKiBoO1xuICAgIGNhc2UgJ21pbnV0ZXMnOlxuICAgIGNhc2UgJ21pbnV0ZSc6XG4gICAgY2FzZSAnbSc6XG4gICAgICByZXR1cm4gbiAqIG07XG4gICAgY2FzZSAnc2Vjb25kcyc6XG4gICAgY2FzZSAnc2Vjb25kJzpcbiAgICBjYXNlICdzJzpcbiAgICAgIHJldHVybiBuICogcztcbiAgICBjYXNlICdtcyc6XG4gICAgICByZXR1cm4gbjtcbiAgfVxufVxuXG4vKipcbiAqIFNob3J0IGZvcm1hdCBmb3IgYG1zYC5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gbXNcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHNob3J0KG1zKSB7XG4gIGlmIChtcyA+PSBkKSByZXR1cm4gTWF0aC5yb3VuZChtcyAvIGQpICsgJ2QnO1xuICBpZiAobXMgPj0gaCkgcmV0dXJuIE1hdGgucm91bmQobXMgLyBoKSArICdoJztcbiAgaWYgKG1zID49IG0pIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gbSkgKyAnbSc7XG4gIGlmIChtcyA+PSBzKSByZXR1cm4gTWF0aC5yb3VuZChtcyAvIHMpICsgJ3MnO1xuICByZXR1cm4gbXMgKyAnbXMnO1xufVxuXG4vKipcbiAqIExvbmcgZm9ybWF0IGZvciBgbXNgLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBtc1xuICogQHJldHVybiB7U3RyaW5nfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gbG9uZyhtcykge1xuICByZXR1cm4gcGx1cmFsKG1zLCBkLCAnZGF5JylcbiAgICB8fCBwbHVyYWwobXMsIGgsICdob3VyJylcbiAgICB8fCBwbHVyYWwobXMsIG0sICdtaW51dGUnKVxuICAgIHx8IHBsdXJhbChtcywgcywgJ3NlY29uZCcpXG4gICAgfHwgbXMgKyAnIG1zJztcbn1cblxuLyoqXG4gKiBQbHVyYWxpemF0aW9uIGhlbHBlci5cbiAqL1xuXG5mdW5jdGlvbiBwbHVyYWwobXMsIG4sIG5hbWUpIHtcbiAgaWYgKG1zIDwgbikgcmV0dXJuO1xuICBpZiAobXMgPCBuICogMS41KSByZXR1cm4gTWF0aC5mbG9vcihtcyAvIG4pICsgJyAnICsgbmFtZTtcbiAgcmV0dXJuIE1hdGguY2VpbChtcyAvIG4pICsgJyAnICsgbmFtZSArICdzJztcbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9+L2RlYnVnL34vbXMvaW5kZXguanNcbiAqKiBtb2R1bGUgaWQgPSAzNVxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIl0sInNvdXJjZVJvb3QiOiIiLCJmaWxlIjoiYTk2OTc3MTA0NWQ2N2RhMDk5MjguanMifQ==