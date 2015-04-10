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
	  clearRemovalListener: function(obj) {
	    var localId = obj.localId;
	    var cancelListen = this.cancelListens[localId];
	    // TODO: Remove this check. cancelListen should always exist
	    if (cancelListen) {
	      cancelListen();
	      this.cancelListens[localId] = null;
	    }
	  },
	  listenForRemoval: function(obj) {
	    this.cancelListens[obj.localId] = obj.on('*', function(e) {
	      if (e.type == ModelEventType.Remove) {
	        if (util.isArray(this.related)) {
	          var idx = this.related.indexOf(obj);
	          this.splice(idx, 1);
	        }
	        else {
	          this.setIdAndRelated(null);
	        }
	        this.clearRemovalListener(obj);
	      }
	    }.bind(this));
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
	    var previouslyRelated = this.related;
	    if (previouslyRelated) this.clearRemovalListener(previouslyRelated);
	    if (obj) {
	      if (util.isArray(obj)) {
	        this.related = obj;
	        obj.forEach(function(_obj) {
	          this.listenForRemoval(_obj);
	        }.bind(this));
	      } else {
	        this.related = obj;
	        this.listenForRemoval(obj);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vd2VicGFjay9ib290c3RyYXAgOGE3MjcwN2U5NmI3OThhZDliZjgiLCJ3ZWJwYWNrOi8vLy4vY29yZS9pbmRleC5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL3V0aWwuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9jb2xsZWN0aW9uUmVnaXN0cnkuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9jb2xsZWN0aW9uLmpzIiwid2VicGFjazovLy8uL2NvcmUvY2FjaGUuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9tb2RlbC5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL2Vycm9yLmpzIiwid2VicGFjazovLy8uL2NvcmUvZXZlbnRzLmpzIiwid2VicGFjazovLy8uL2NvcmUvUmVsYXRpb25zaGlwVHlwZS5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL1JlYWN0aXZlUXVlcnkuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9NYW55VG9NYW55UHJveHkuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9PbmVUb09uZVByb3h5LmpzIiwid2VicGFjazovLy8uL2NvcmUvT25lVG9NYW55UHJveHkuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9SZWxhdGlvbnNoaXBQcm94eS5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL21vZGVsRXZlbnRzLmpzIiwid2VicGFjazovLy8uL2NvcmUvUXVlcnkuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9RdWVyeVNldC5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL2xvZy5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL01vZGVsSW5zdGFuY2UuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9tYXBwaW5nT3BlcmF0aW9uLmpzIiwid2VicGFjazovLy8uL3N0b3JhZ2UvaW5kZXguanMiLCJ3ZWJwYWNrOi8vLy4vfi9leHRlbmQvaW5kZXguanMiLCJ3ZWJwYWNrOi8vLy4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9Db25kaXRpb24uanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9QbGFjZWhvbGRlci5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL2luc3RhbmNlRmFjdG9yeS5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL0NoYWluLmpzIiwid2VicGFjazovLy8uL34vZGVidWcvYnJvd3Nlci5qcyIsIndlYnBhY2s6Ly8vLi9+L2FyZ3NhcnJheS9pbmRleC5qcyIsIndlYnBhY2s6Ly8vKHdlYnBhY2spL34vbm9kZS1saWJzLWJyb3dzZXIvfi90aW1lcnMtYnJvd3NlcmlmeS9tYWluLmpzIiwid2VicGFjazovLy8od2VicGFjaykvfi9ub2RlLWxpYnMtYnJvd3Nlci9+L2V2ZW50cy9ldmVudHMuanMiLCJ3ZWJwYWNrOi8vLy4vfi9saWUvZGlzdC9saWUuanMiLCJ3ZWJwYWNrOi8vLy4vfi9kZWJ1Zy9kZWJ1Zy5qcyIsIndlYnBhY2s6Ly8vKHdlYnBhY2spL2J1aWxkaW4vbW9kdWxlLmpzIiwid2VicGFjazovLy8od2VicGFjaykvfi9ub2RlLWxpYnMtYnJvd3Nlci9+L3Byb2Nlc3MvYnJvd3Nlci5qcyIsIndlYnBhY2s6Ly8vLi9+L2RlYnVnL34vbXMvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLHVCQUFlO0FBQ2Y7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7OztBQUdBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0Esd0M7Ozs7Ozs7QUN0Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxvQ0FBbUM7QUFDbkM7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFDO0FBQ0Q7QUFDQTtBQUNBO0FBQ0Es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Q0E7QUFDQSxNQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7OztBQUdIOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUM7O0FBRUQ7QUFDQTtBQUNBO0FBQ0E7QUFDQSxjQUFhLEtBQUs7QUFDbEIsZ0JBQWU7QUFDZjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQVc7QUFDWDtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUDtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsWUFBVztBQUNYO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQLElBQUc7QUFDSDtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBLEVBQUM7O0FBRUQsZ0M7Ozs7OztBQ3pRQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLFlBQVcsT0FBTztBQUNsQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsWUFBVztBQUNYO0FBQ0EsUUFBTztBQUNQO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUCxNQUFLO0FBQ0wsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUCxNQUFLO0FBQ0wsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsWUFBVztBQUNYLFVBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Es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QTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBLEc7Ozs7OztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSx1REFBc0Q7QUFDdEQ7QUFDQSxVQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0EsWUFBVztBQUNYO0FBQ0E7QUFDQSxVQUFTO0FBQ1QsUUFBTztBQUNQO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7O0FBRUg7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGFBQVk7QUFDWjtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTCxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQVc7QUFDWDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0wsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQVc7QUFDWDtBQUNBO0FB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QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7O0FBRUE7QUFDQTtBQUNBO0FBQ0Esc0JBQXFCLGlCQUFpQjtBQUN0QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG9EQUFtRCxlQUFlO0FBQ2xFOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsY0FBYSxjQUFjO0FBQzNCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSzs7QUFFTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxxQkFBb0I7QUFDcEIsWUFBVztBQUNYO0FBQ0E7QUFDQSx1QkFBc0I7QUFDdEI7QUFDQTs7QUFFQSxNQUFLO0FBQ0w7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBUzs7QUFFVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7O0FBRVQ7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FB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akI7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7Ozs7Ozs7O0FDOUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQSw2Q0FBNEM7QUFDNUM7QUFDQSxNQUFLO0FBQ0w7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOzs7QUFHQSx3Q0FBdUM7QUFDdkMsb0JBQW1CLFlBQVksRUFBRTtBQUNqQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7O0FBRUE7QUFDQTs7O0FBR0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSxvQkFBbUIscUJBQXFCO0FBQ3hDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQSxtQkFBa0I7QUFDbEI7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsTUFBSzs7QUFFTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7O0FBRUg7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQSxzQkFBcUIsaUJBQWlCO0FBQ3RDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQSxzQkFBcUIsc0JBQXNCO0FBQzNDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsc0JBQXFCLHNCQUFzQjtBQUMzQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSx3QkFBdUIsb0JBQW9CO0FBQzNDO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSw4QkFBNkI7QUFDN0I7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSzs7QUFFTDtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSzs7QUFFTDtBQUNBO0FBQ0E7O0FBRUE7QUFDQSxNQUFLOztBQUVMO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7O0FBRUw7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQSxJQUFHOztBQUVIOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSxzQkFBcUIsb0JBQW9CO0FBQ3pDO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSzs7QUFFTDtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQTs7QUFFQSxNQUFLOztBQUVMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLOztBQUVMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQTtBQUNB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QTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSzs7QUFFTDtBQUNBLHNCQUFxQixrQkFBa0I7QUFDdkM7QUFDQTtBQUNBO0FBQ0EsTUFBSzs7QUFFTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQSxNQUFLOztBQUVMO0FBQ0E7QUFDQTtBQUNBLE1BQUs7O0FBRUw7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsOEJBQTZCO0FBQzdCO0FBQ0EsOEJBQTZCO0FBQzdCLE1BQUs7QUFDTDtBQUNBO0FBQ0EsOEJBQTZCO0FBQzdCO0FBQ0EsOEJBQTZCO0FBQzdCO0FBQ0E7O0FBRUE7O0FBRUE7O0FBRUE7QUFDQTs7QUFFQSxvQkFBbUIsb0JBQW9CO0FBQ3ZDO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQOztBQUVBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQSxvQkFBbUIsMEJBQTBCO0FBQzdDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNB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Q0E7QUFDQTtBQUNBLElBQUc7O0FBRUg7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsRzs7Ozs7OztBQzNFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxrQkFBaUI7QUFDakI7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG9CQUFtQixTQUFTO0FBQzVCO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0EsZ0JBQWUsU0FBUztBQUN4Qjs7QUFFQTtBQUNBO0FBQ0EsZ0JBQWUsU0FBUztBQUN4QjtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSxJQUFHO0FBQ0gscUJBQW9CLFNBQVM7QUFDN0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOzs7Ozs7O3lCQzVTQSwyREFBYSwyQkFBMkUsMkRBQTJELEtBQUssTUFBTSwwSEFBMEgsWUFBWSwwQkFBMEIsMEJBQTBCLGdCQUFnQixVQUFVLFVBQVUsMENBQTBDLDhCQUF3QixvQkFBb0IsOENBQThDLGtDQUFrQyxZQUFZLFlBQVksbUNBQW1DLGlCQUFpQixnQkFBZ0Isc0JBQXNCLG9CQUFvQiwwQ0FBMEMsWUFBWSxXQUFXLFlBQVksU0FBUyxHQUFHO0FBQ2p3Qjs7QUFFQTs7QUFFQTtBQUNBLEVBQUMsR0FBRztBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFDLEVBQUUsdUVBQXVFO0FBQzFFO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBQyxFQUFFLHFEQUFxRDtBQUN4RDs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUMsRUFBRSw4REFBOEQ7QUFDakU7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFHQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTs7QUFFQTtBQUNBOztBQUVBLEVBQUMsRUFBRSxrRkFBa0Y7QUFDckY7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUMsRUFBRSw2QkFBNkI7QUFDaEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0EsRUFBQyxFQUFFLHVFQUF1RTtBQUMxRTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUMsRUFBRSw0Q0FBNEM7QUFDL0M7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFDLEVBQUUsNENBQTRDO0FBQy9DO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFDLEVBQUUsK0JBQStCO0FBQ2xDOztBQUVBO0FBQ0E7QUFDQTtBQUNBLEVBQUMsR0FBRztBQUNKOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUMsR0FBRztBQUNKOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQSxFQUFDLEVBQUUsOEJBQThCOztBQUVqQyxFQUFDLEdBQUc7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFD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cUI7QUFDckI7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0EsNEJBQTJCO0FBQzNCO0FBQ0E7QUFDQTtBQUNBLDZCQUE0QixVQUFVOzs7Ozs7O0FDekR0QztBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQVcsY0FBYztBQUN6QixZQUFXLE9BQU87QUFDbEIsYUFBWTtBQUNaO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsWUFBVyxPQUFPO0FBQ2xCLGFBQVk7QUFDWjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxZQUFXLE9BQU87QUFDbEIsYUFBWTtBQUNaO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsWUFBVyxPQUFPO0FBQ2xCLGFBQVk7QUFDWjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwic291cmNlc0NvbnRlbnQiOlsiIFx0Ly8gVGhlIG1vZHVsZSBjYWNoZVxuIFx0dmFyIGluc3RhbGxlZE1vZHVsZXMgPSB7fTtcblxuIFx0Ly8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbiBcdGZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblxuIFx0XHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcbiBcdFx0aWYoaW5zdGFsbGVkTW9kdWxlc1ttb2R1bGVJZF0pXG4gXHRcdFx0cmV0dXJuIGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdLmV4cG9ydHM7XG5cbiBcdFx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcbiBcdFx0dmFyIG1vZHVsZSA9IGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdID0ge1xuIFx0XHRcdGV4cG9ydHM6IHt9LFxuIFx0XHRcdGlkOiBtb2R1bGVJZCxcbiBcdFx0XHRsb2FkZWQ6IGZhbHNlXG4gXHRcdH07XG5cbiBcdFx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG4gXHRcdG1vZHVsZXNbbW9kdWxlSWRdLmNhbGwobW9kdWxlLmV4cG9ydHMsIG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG4gXHRcdC8vIEZsYWcgdGhlIG1vZHVsZSBhcyBsb2FkZWRcbiBcdFx0bW9kdWxlLmxvYWRlZCA9IHRydWU7XG5cbiBcdFx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcbiBcdFx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xuIFx0fVxuXG5cbiBcdC8vIGV4cG9zZSB0aGUgbW9kdWxlcyBvYmplY3QgKF9fd2VicGFja19tb2R1bGVzX18pXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLm0gPSBtb2R1bGVzO1xuXG4gXHQvLyBleHBvc2UgdGhlIG1vZHVsZSBjYWNoZVxuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5jID0gaW5zdGFsbGVkTW9kdWxlcztcblxuIFx0Ly8gX193ZWJwYWNrX3B1YmxpY19wYXRoX19cbiBcdF9fd2VicGFja19yZXF1aXJlX18ucCA9IFwiXCI7XG5cbiBcdC8vIExvYWQgZW50cnkgbW9kdWxlIGFuZCByZXR1cm4gZXhwb3J0c1xuIFx0cmV0dXJuIF9fd2VicGFja19yZXF1aXJlX18oMCk7XG5cblxuLyoqIFdFQlBBQ0sgRk9PVEVSICoqXG4gKiogd2VicGFjay9ib290c3RyYXAgOGE3MjcwN2U5NmI3OThhZDliZjhcbiAqKi8iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICBDb2xsZWN0aW9uUmVnaXN0cnkgPSByZXF1aXJlKCcuL2NvbGxlY3Rpb25SZWdpc3RyeScpLkNvbGxlY3Rpb25SZWdpc3RyeSxcbiAgQ29sbGVjdGlvbiA9IHJlcXVpcmUoJy4vY29sbGVjdGlvbicpLFxuICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKSxcbiAgTW9kZWwgPSByZXF1aXJlKCcuL21vZGVsJyksXG4gIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICBSZWxhdGlvbnNoaXBUeXBlID0gcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBUeXBlJyksXG4gIFJlYWN0aXZlUXVlcnkgPSByZXF1aXJlKCcuL1JlYWN0aXZlUXVlcnknKSxcbiAgTWFueVRvTWFueVByb3h5ID0gcmVxdWlyZSgnLi9NYW55VG9NYW55UHJveHknKSxcbiAgT25lVG9PbmVQcm94eSA9IHJlcXVpcmUoJy4vT25lVG9PbmVQcm94eScpLFxuICBPbmVUb01hbnlQcm94eSA9IHJlcXVpcmUoJy4vT25lVG9NYW55UHJveHknKSxcbiAgUmVsYXRpb25zaGlwUHJveHkgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFByb3h5JyksXG4gIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICBRdWVyeSA9IHJlcXVpcmUoJy4vUXVlcnknKSxcbiAgcXVlcnlTZXQgPSByZXF1aXJlKCcuL1F1ZXJ5U2V0JyksXG4gIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyk7XG5cbnV0aWwuX3BhdGNoQmluZCgpO1xuXG4vLyBJbml0aWFsaXNlIHNpZXN0YSBvYmplY3QuIFN0cmFuZ2UgZm9ybWF0IGZhY2lsaXRpZXMgdXNpbmcgc3VibW9kdWxlcyB3aXRoIHJlcXVpcmVKUyAoZXZlbnR1YWxseSlcbnZhciBzaWVzdGEgPSBmdW5jdGlvbihleHQpIHtcbiAgaWYgKCFzaWVzdGEuZXh0KSBzaWVzdGEuZXh0ID0ge307XG4gIHV0aWwuZXh0ZW5kKHNpZXN0YS5leHQsIGV4dCB8fCB7fSk7XG4gIHJldHVybiBzaWVzdGE7XG59O1xuXG4vLyBOb3RpZmljYXRpb25zXG51dGlsLmV4dGVuZChzaWVzdGEsIHtcbiAgb246IGV2ZW50cy5vbi5iaW5kKGV2ZW50cyksXG4gIG9mZjogZXZlbnRzLnJlbW92ZUxpc3RlbmVyLmJpbmQoZXZlbnRzKSxcbiAgb25jZTogZXZlbnRzLm9uY2UuYmluZChldmVudHMpLFxuICByZW1vdmVBbGxMaXN0ZW5lcnM6IGV2ZW50cy5yZW1vdmVBbGxMaXN0ZW5lcnMuYmluZChldmVudHMpXG59KTtcbnV0aWwuZXh0ZW5kKHNpZXN0YSwge1xuICByZW1vdmVMaXN0ZW5lcjogc2llc3RhLm9mZixcbiAgYWRkTGlzdGVuZXI6IHNpZXN0YS5vblxufSk7XG5cbi8vIEV4cG9zZSBzb21lIHN0dWZmIGZvciB1c2FnZSBieSBleHRlbnNpb25zIGFuZC9vciB1c2Vyc1xudXRpbC5leHRlbmQoc2llc3RhLCB7XG4gIFJlbGF0aW9uc2hpcFR5cGU6IFJlbGF0aW9uc2hpcFR5cGUsXG4gIE1vZGVsRXZlbnRUeXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZSxcbiAgbG9nOiBsb2cuTGV2ZWwsXG4gIEluc2VydGlvblBvbGljeTogUmVhY3RpdmVRdWVyeS5JbnNlcnRpb25Qb2xpY3ksXG4gIF9pbnRlcm5hbDoge1xuICAgIGxvZzogbG9nLFxuICAgIE1vZGVsOiBNb2RlbCxcbiAgICBlcnJvcjogZXJyb3IsXG4gICAgTW9kZWxFdmVudFR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLFxuICAgIE1vZGVsSW5zdGFuY2U6IHJlcXVpcmUoJy4vTW9kZWxJbnN0YW5jZScpLFxuICAgIGV4dGVuZDogcmVxdWlyZSgnZXh0ZW5kJyksXG4gICAgTWFwcGluZ09wZXJhdGlvbjogcmVxdWlyZSgnLi9tYXBwaW5nT3BlcmF0aW9uJyksXG4gICAgZXZlbnRzOiBldmVudHMsXG4gICAgUHJveHlFdmVudEVtaXR0ZXI6IGV2ZW50cy5Qcm94eUV2ZW50RW1pdHRlcixcbiAgICBjYWNoZTogcmVxdWlyZSgnLi9jYWNoZScpLFxuICAgIG1vZGVsRXZlbnRzOiBtb2RlbEV2ZW50cyxcbiAgICBDb2xsZWN0aW9uUmVnaXN0cnk6IHJlcXVpcmUoJy4vY29sbGVjdGlvblJlZ2lzdHJ5JykuQ29sbGVjdGlvblJlZ2lzdHJ5LFxuICAgIENvbGxlY3Rpb246IENvbGxlY3Rpb24sXG4gICAgdXRpbHM6IHV0aWwsXG4gICAgdXRpbDogdXRpbCxcbiAgICBxdWVyeVNldDogcXVlcnlTZXQsXG4gICAgb2JzZXJ2ZTogcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKSxcbiAgICBRdWVyeTogUXVlcnksXG4gICAgTWFueVRvTWFueVByb3h5OiBNYW55VG9NYW55UHJveHksXG4gICAgT25lVG9NYW55UHJveHk6IE9uZVRvTWFueVByb3h5LFxuICAgIE9uZVRvT25lUHJveHk6IE9uZVRvT25lUHJveHksXG4gICAgUmVsYXRpb25zaGlwUHJveHk6IFJlbGF0aW9uc2hpcFByb3h5XG4gIH0sXG4gIGlzQXJyYXk6IHV0aWwuaXNBcnJheSxcbiAgaXNTdHJpbmc6IHV0aWwuaXNTdHJpbmdcbn0pO1xuXG5zaWVzdGEuZXh0ID0ge307XG5cbnZhciBpbnN0YWxsZWQgPSBmYWxzZSxcbiAgaW5zdGFsbGluZyA9IGZhbHNlO1xuXG5cbnV0aWwuZXh0ZW5kKHNpZXN0YSwge1xuICAvKipcbiAgICogV2lwZSBldmVyeXRoaW5nLiBVc2VkIGR1cmluZyB0ZXN0IGdlbmVyYWxseS5cbiAgICovXG4gIHJlc2V0OiBmdW5jdGlvbihjYiwgcmVzZXRTdG9yYWdlKSB7XG4gICAgaW5zdGFsbGVkID0gZmFsc2U7XG4gICAgaW5zdGFsbGluZyA9IGZhbHNlO1xuICAgIGRlbGV0ZSB0aGlzLnF1ZXVlZFRhc2tzO1xuICAgIGNhY2hlLnJlc2V0KCk7XG4gICAgQ29sbGVjdGlvblJlZ2lzdHJ5LnJlc2V0KCk7XG4gICAgZXZlbnRzLnJlbW92ZUFsbExpc3RlbmVycygpO1xuICAgIGlmIChzaWVzdGEuZXh0LnN0b3JhZ2VFbmFibGVkKSB7XG4gICAgICByZXNldFN0b3JhZ2UgPSByZXNldFN0b3JhZ2UgPT09IHVuZGVmaW5lZCA/IHRydWUgOiByZXNldFN0b3JhZ2U7XG4gICAgICBpZiAocmVzZXRTdG9yYWdlKSBzaWVzdGEuZXh0LnN0b3JhZ2UuX3Jlc2V0KGNiKTtcbiAgICAgIGVsc2UgY2IoKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBjYigpO1xuICAgIH1cbiAgfSxcbiAgLyoqXG4gICAqIENyZWF0ZXMgYW5kIHJlZ2lzdGVycyBhIG5ldyBDb2xsZWN0aW9uLlxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBbb3B0c11cbiAgICogQHJldHVybiB7Q29sbGVjdGlvbn1cbiAgICovXG4gIGNvbGxlY3Rpb246IGZ1bmN0aW9uKG5hbWUsIG9wdHMpIHtcbiAgICB2YXIgYyA9IG5ldyBDb2xsZWN0aW9uKG5hbWUsIG9wdHMpO1xuICAgIGlmIChpbnN0YWxsZWQpIGMuaW5zdGFsbGVkID0gdHJ1ZTsgLy8gVE9ETzogUmVtb3ZlXG4gICAgcmV0dXJuIGM7XG4gIH0sXG4gIC8qKlxuICAgKiBJbnN0YWxsIGFsbCBjb2xsZWN0aW9ucy5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NiXVxuICAgKiBAcmV0dXJucyB7cS5Qcm9taXNlfVxuICAgKi9cbiAgaW5zdGFsbDogZnVuY3Rpb24oY2IpIHtcbiAgICBpZiAoIWluc3RhbGxpbmcgJiYgIWluc3RhbGxlZCkge1xuICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgaW5zdGFsbGluZyA9IHRydWU7XG4gICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZXMgPSBDb2xsZWN0aW9uUmVnaXN0cnkuY29sbGVjdGlvbk5hbWVzLFxuICAgICAgICAgIHRhc2tzID0gY29sbGVjdGlvbk5hbWVzLm1hcChmdW5jdGlvbihuKSB7XG4gICAgICAgICAgICB2YXIgY29sbGVjdGlvbiA9IENvbGxlY3Rpb25SZWdpc3RyeVtuXTtcbiAgICAgICAgICAgIHJldHVybiBjb2xsZWN0aW9uLmluc3RhbGwuYmluZChjb2xsZWN0aW9uKTtcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBzdG9yYWdlRW5hYmxlZCA9IHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQ7XG4gICAgICAgIGlmIChzdG9yYWdlRW5hYmxlZCkgdGFza3MgPSB0YXNrcy5jb25jYXQoW3NpZXN0YS5leHQuc3RvcmFnZS5lbnN1cmVJbmRleGVzRm9yQWxsLCBzaWVzdGEuZXh0LnN0b3JhZ2UuX2xvYWRdKTtcbiAgICAgICAgdGFza3MucHVzaChmdW5jdGlvbihkb25lKSB7XG4gICAgICAgICAgaW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgICBpZiAodGhpcy5xdWV1ZWRUYXNrcykgdGhpcy5xdWV1ZWRUYXNrcy5leGVjdXRlKCk7XG4gICAgICAgICAgZG9uZSgpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB1dGlsLnNlcmllcyh0YXNrcywgY2IpO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG4gICAgZWxzZSBjYihlcnJvcignYWxyZWFkeSBpbnN0YWxsaW5nJykpO1xuICB9LFxuICBfcHVzaFRhc2s6IGZ1bmN0aW9uKHRhc2spIHtcbiAgICBpZiAoIXRoaXMucXVldWVkVGFza3MpIHtcbiAgICAgIHRoaXMucXVldWVkVGFza3MgPSBuZXcgZnVuY3Rpb24gUXVldWUoKSB7XG4gICAgICAgIHRoaXMudGFza3MgPSBbXTtcbiAgICAgICAgdGhpcy5leGVjdXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdGhpcy50YXNrcy5mb3JFYWNoKGZ1bmN0aW9uKGYpIHtcbiAgICAgICAgICAgIGYoKVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHRoaXMudGFza3MgPSBbXTtcbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgfTtcbiAgICB9XG4gICAgdGhpcy5xdWV1ZWRUYXNrcy50YXNrcy5wdXNoKHRhc2spO1xuICB9LFxuICBfYWZ0ZXJJbnN0YWxsOiBmdW5jdGlvbih0YXNrKSB7XG4gICAgaWYgKCFpbnN0YWxsZWQpIHtcbiAgICAgIGlmICghaW5zdGFsbGluZykge1xuICAgICAgICB0aGlzLmluc3RhbGwoZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3Igc2V0dGluZyB1cCBzaWVzdGEnLCBlcnIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBkZWxldGUgdGhpcy5xdWV1ZWRUYXNrcztcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgIH1cbiAgICAgIC8vIEluIGNhc2UgaW5zdGFsbGVkIHN0cmFpZ2h0IGF3YXkgZS5nLiBpZiBzdG9yYWdlIGV4dGVuc2lvbiBub3QgaW5zdGFsbGVkLlxuICAgICAgaWYgKCFpbnN0YWxsZWQpIHRoaXMuX3B1c2hUYXNrKHRhc2spO1xuICAgICAgZWxzZSB0YXNrKCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGFzaygpO1xuICAgIH1cbiAgfSxcbiAgc2V0TG9nTGV2ZWw6IGZ1bmN0aW9uKGxvZ2dlck5hbWUsIGxldmVsKSB7XG4gICAgdmFyIExvZ2dlciA9IGxvZy5sb2dnZXJXaXRoTmFtZShsb2dnZXJOYW1lKTtcbiAgICBMb2dnZXIuc2V0TGV2ZWwobGV2ZWwpO1xuICB9LFxuICBncmFwaDogZnVuY3Rpb24oZGF0YSwgb3B0cywgY2IpIHtcbiAgICBpZiAodHlwZW9mIG9wdHMgPT0gJ2Z1bmN0aW9uJykgY2IgPSBvcHRzO1xuICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICB2YXIgdGFza3MgPSBbXSwgZXJyO1xuICAgICAgZm9yICh2YXIgY29sbGVjdGlvbk5hbWUgaW4gZGF0YSkge1xuICAgICAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eShjb2xsZWN0aW9uTmFtZSkpIHtcbiAgICAgICAgICB2YXIgY29sbGVjdGlvbiA9IENvbGxlY3Rpb25SZWdpc3RyeVtjb2xsZWN0aW9uTmFtZV07XG4gICAgICAgICAgaWYgKGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgIChmdW5jdGlvbihjb2xsZWN0aW9uLCBkYXRhKSB7XG4gICAgICAgICAgICAgIHRhc2tzLnB1c2goZnVuY3Rpb24oZG9uZSkge1xuICAgICAgICAgICAgICAgIGNvbGxlY3Rpb24uZ3JhcGgoZGF0YSwgZnVuY3Rpb24oZXJyLCByZXMpIHtcbiAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciByZXN1bHRzID0ge307XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHNbY29sbGVjdGlvbi5uYW1lXSA9IHJlcztcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGRvbmUoZXJyLCByZXN1bHRzKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KShjb2xsZWN0aW9uLCBkYXRhW2NvbGxlY3Rpb25OYW1lXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgZXJyID0gJ05vIHN1Y2ggY29sbGVjdGlvbiBcIicgKyBjb2xsZWN0aW9uTmFtZSArICdcIic7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoIWVycikge1xuICAgICAgICB1dGlsLnNlcmllcyh0YXNrcywgZnVuY3Rpb24oZXJyLCByZXN1bHRzKSB7XG4gICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLnJlZHVjZShmdW5jdGlvbihtZW1vLCByZXMpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHV0aWwuZXh0ZW5kKG1lbW8sIHJlcyk7XG4gICAgICAgICAgICB9LCB7fSlcbiAgICAgICAgICB9IGVsc2UgcmVzdWx0cyA9IG51bGw7XG4gICAgICAgICAgY2IoZXJyLCByZXN1bHRzKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIGNiKGVycm9yKGVyciwge2RhdGE6IGRhdGEsIGludmFsaWRDb2xsZWN0aW9uTmFtZTogY29sbGVjdGlvbk5hbWV9KSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgbm90aWZ5OiB1dGlsLm5leHQsXG4gIHJlZ2lzdGVyQ29tcGFyYXRvcjogUXVlcnkucmVnaXN0ZXJDb21wYXJhdG9yLmJpbmQoUXVlcnkpLFxuICBjb3VudDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIGNhY2hlLmNvdW50KCk7XG4gIH0sXG4gIGdldDogZnVuY3Rpb24oaWQsIGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIHRoaXMuX2FmdGVySW5zdGFsbChmdW5jdGlvbigpIHtcbiAgICAgICAgY2IobnVsbCwgY2FjaGUuX2xvY2FsQ2FjaGUoKVtpZF0pO1xuICAgICAgfSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgcmVtb3ZlQWxsOiBmdW5jdGlvbihjYikge1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICB1dGlsLlByb21pc2UuYWxsKFxuICAgICAgICBDb2xsZWN0aW9uUmVnaXN0cnkuY29sbGVjdGlvbk5hbWVzLm1hcChmdW5jdGlvbihjb2xsZWN0aW9uTmFtZSkge1xuICAgICAgICAgIHJldHVybiBDb2xsZWN0aW9uUmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdLnJlbW92ZUFsbCgpO1xuICAgICAgICB9LmJpbmQodGhpcykpXG4gICAgICApLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgY2IobnVsbCk7XG4gICAgICAgIH0pLmNhdGNoKGNiKVxuICAgIH0uYmluZCh0aGlzKSk7XG4gIH1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydGllcyhzaWVzdGEsIHtcbiAgX2NhbkNoYW5nZToge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gIShpbnN0YWxsaW5nIHx8IGluc3RhbGxlZCk7XG4gICAgfVxuICB9LFxuICBpbnN0YWxsZWQ6IHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGluc3RhbGxlZDtcbiAgICB9XG4gIH1cbn0pO1xuXG5pZiAodHlwZW9mIHdpbmRvdyAhPSAndW5kZWZpbmVkJykge1xuICB3aW5kb3dbJ3NpZXN0YSddID0gc2llc3RhO1xufVxuXG5zaWVzdGEubG9nID0gcmVxdWlyZSgnZGVidWcnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBzaWVzdGE7XG5cbihmdW5jdGlvbiBsb2FkRXh0ZW5zaW9ucygpIHtcbiAgcmVxdWlyZSgnLi4vc3RvcmFnZScpO1xufSkoKTtcblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9pbmRleC5qc1xuICoqIG1vZHVsZSBpZCA9IDBcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciBvYnNlcnZlID0gcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5QbGF0Zm9ybSxcbiAgUHJvbWlzZSA9IHJlcXVpcmUoJ2xpZScpLFxuICBhcmdzYXJyYXkgPSByZXF1aXJlKCdhcmdzYXJyYXknKSxcbiAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yO1xuXG52YXIgZXh0ZW5kID0gZnVuY3Rpb24obGVmdCwgcmlnaHQpIHtcbiAgZm9yICh2YXIgcHJvcCBpbiByaWdodCkge1xuICAgIGlmIChyaWdodC5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgbGVmdFtwcm9wXSA9IHJpZ2h0W3Byb3BdO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbGVmdDtcbn07XG5cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSxcbiAgaXNTdHJpbmcgPSBmdW5jdGlvbihvKSB7XG4gICAgcmV0dXJuIHR5cGVvZiBvID09ICdzdHJpbmcnIHx8IG8gaW5zdGFuY2VvZiBTdHJpbmdcbiAgfTtcblxuZXh0ZW5kKG1vZHVsZS5leHBvcnRzLCB7XG4gIGFyZ3NhcnJheTogYXJnc2FycmF5LFxuICAvKipcbiAgICogUGVyZm9ybXMgZGlydHkgY2hlY2svT2JqZWN0Lm9ic2VydmUgY2FsbGJhY2tzIGRlcGVuZGluZyBvbiB0aGUgYnJvd3Nlci5cbiAgICpcbiAgICogSWYgT2JqZWN0Lm9ic2VydmUgaXMgcHJlc2VudCxcbiAgICogQHBhcmFtIGNhbGxiYWNrXG4gICAqL1xuICBuZXh0OiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgIG9ic2VydmUucGVyZm9ybU1pY3JvdGFza0NoZWNrcG9pbnQoKTtcbiAgICBzZXRUaW1lb3V0KGNhbGxiYWNrKTtcbiAgfSxcbiAgZXh0ZW5kOiBleHRlbmQsXG4gIGd1aWQ6IChmdW5jdGlvbigpIHtcbiAgICBmdW5jdGlvbiBzNCgpIHtcbiAgICAgIHJldHVybiBNYXRoLmZsb29yKCgxICsgTWF0aC5yYW5kb20oKSkgKiAweDEwMDAwKVxuICAgICAgICAudG9TdHJpbmcoMTYpXG4gICAgICAgIC5zdWJzdHJpbmcoMSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHM0KCkgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyAnLScgK1xuICAgICAgICBzNCgpICsgJy0nICsgczQoKSArIHM0KCkgKyBzNCgpO1xuICAgIH07XG4gIH0pKCksXG4gIGFzc2VydDogZnVuY3Rpb24oY29uZGl0aW9uLCBtZXNzYWdlLCBjb250ZXh0KSB7XG4gICAgaWYgKCFjb25kaXRpb24pIHtcbiAgICAgIG1lc3NhZ2UgPSBtZXNzYWdlIHx8IFwiQXNzZXJ0aW9uIGZhaWxlZFwiO1xuICAgICAgY29udGV4dCA9IGNvbnRleHQgfHwge307XG4gICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihtZXNzYWdlLCBjb250ZXh0KTtcbiAgICB9XG4gIH0sXG4gIHBsdWNrOiBmdW5jdGlvbihjb2xsLCBrZXkpIHtcbiAgICByZXR1cm4gY29sbC5tYXAoZnVuY3Rpb24obykge3JldHVybiBvW2tleV19KTtcbiAgfSxcbiAgdGhlbkJ5OiAoZnVuY3Rpb24oKSB7XG4gICAgLyogbWl4aW4gZm9yIHRoZSBgdGhlbkJ5YCBwcm9wZXJ0eSAqL1xuICAgIGZ1bmN0aW9uIGV4dGVuZChmKSB7XG4gICAgICBmLnRoZW5CeSA9IHRiO1xuICAgICAgcmV0dXJuIGY7XG4gICAgfVxuXG4gICAgLyogYWRkcyBhIHNlY29uZGFyeSBjb21wYXJlIGZ1bmN0aW9uIHRvIHRoZSB0YXJnZXQgZnVuY3Rpb24gKGB0aGlzYCBjb250ZXh0KVxuICAgICB3aGljaCBpcyBhcHBsaWVkIGluIGNhc2UgdGhlIGZpcnN0IG9uZSByZXR1cm5zIDAgKGVxdWFsKVxuICAgICByZXR1cm5zIGEgbmV3IGNvbXBhcmUgZnVuY3Rpb24sIHdoaWNoIGhhcyBhIGB0aGVuQnlgIG1ldGhvZCBhcyB3ZWxsICovXG4gICAgZnVuY3Rpb24gdGIoeSkge1xuICAgICAgdmFyIHggPSB0aGlzO1xuICAgICAgcmV0dXJuIGV4dGVuZChmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgIHJldHVybiB4KGEsIGIpIHx8IHkoYSwgYik7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gZXh0ZW5kO1xuICB9KSgpLFxuICAvKipcbiAgICogVE9ETzogVGhpcyBpcyBibG9vZHkgdWdseS5cbiAgICogUHJldHR5IGRhbW4gdXNlZnVsIHRvIGJlIGFibGUgdG8gYWNjZXNzIHRoZSBib3VuZCBvYmplY3Qgb24gYSBmdW5jdGlvbiB0aG8uXG4gICAqIFNlZTogaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8xNDMwNzI2NC93aGF0LW9iamVjdC1qYXZhc2NyaXB0LWZ1bmN0aW9uLWlzLWJvdW5kLXRvLXdoYXQtaXMtaXRzLXRoaXNcbiAgICovXG4gIF9wYXRjaEJpbmQ6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBfYmluZCA9IEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseS5iaW5kKEZ1bmN0aW9uLnByb3RvdHlwZS5iaW5kKTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoRnVuY3Rpb24ucHJvdG90eXBlLCAnYmluZCcsIHtcbiAgICAgIHZhbHVlOiBmdW5jdGlvbihvYmopIHtcbiAgICAgICAgdmFyIGJvdW5kRnVuY3Rpb24gPSBfYmluZCh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoYm91bmRGdW5jdGlvbiwgJ19fc2llc3RhX2JvdW5kX29iamVjdCcsIHtcbiAgICAgICAgICB2YWx1ZTogb2JqLFxuICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGJvdW5kRnVuY3Rpb247XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG4gIFByb21pc2U6IFByb21pc2UsXG4gIHByb21pc2U6IGZ1bmN0aW9uKGNiLCBmbikge1xuICAgIGNiID0gY2IgfHwgZnVuY3Rpb24oKSB7fTtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICB2YXIgX2NiID0gYXJnc2FycmF5KGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICAgICAgdmFyIGVyciA9IGFyZ3NbMF0sXG4gICAgICAgICAgcmVzdCA9IGFyZ3Muc2xpY2UoMSk7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdVbmNhdWdodCBlcnJvciBkdXJpbmcgcHJvbWlzZSByZWplY3Rpb24nLCBlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJlc29sdmUocmVzdFswXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICByZWplY3QoZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdVbmNhdWdodCBlcnJvciBkdXJpbmcgcHJvbWlzZSByZWplY3Rpb24nLCBlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGJvdW5kID0gY2JbJ19fc2llc3RhX2JvdW5kX29iamVjdCddIHx8IGNiOyAvLyBQcmVzZXJ2ZSBib3VuZCBvYmplY3QuXG4gICAgICAgIGNiLmFwcGx5KGJvdW5kLCBhcmdzKTtcbiAgICAgIH0pO1xuICAgICAgZm4oX2NiKTtcbiAgICB9KVxuICB9LFxuICBkZWZlcjogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHJlc29sdmUsIHJlamVjdDtcbiAgICB2YXIgcCA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKF9yZXNvbHZlLCBfcmVqZWN0KSB7XG4gICAgICByZXNvbHZlID0gX3Jlc29sdmU7XG4gICAgICByZWplY3QgPSBfcmVqZWN0O1xuICAgIH0pO1xuICAgIC8vbm9pbnNwZWN0aW9uIEpTVW51c2VkQXNzaWdubWVudFxuICAgIHAucmVzb2x2ZSA9IHJlc29sdmU7XG4gICAgLy9ub2luc3BlY3Rpb24gSlNVbnVzZWRBc3NpZ25tZW50XG4gICAgcC5yZWplY3QgPSByZWplY3Q7XG4gICAgcmV0dXJuIHA7XG4gIH0sXG4gIHN1YlByb3BlcnRpZXM6IGZ1bmN0aW9uKG9iaiwgc3ViT2JqLCBwcm9wZXJ0aWVzKSB7XG4gICAgaWYgKCFpc0FycmF5KHByb3BlcnRpZXMpKSB7XG4gICAgICBwcm9wZXJ0aWVzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICB9XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm9wZXJ0aWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAoZnVuY3Rpb24ocHJvcGVydHkpIHtcbiAgICAgICAgdmFyIG9wdHMgPSB7XG4gICAgICAgICAgc2V0OiBmYWxzZSxcbiAgICAgICAgICBuYW1lOiBwcm9wZXJ0eSxcbiAgICAgICAgICBwcm9wZXJ0eTogcHJvcGVydHlcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKCFpc1N0cmluZyhwcm9wZXJ0eSkpIHtcbiAgICAgICAgICBleHRlbmQob3B0cywgcHJvcGVydHkpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBkZXNjID0ge1xuICAgICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gc3ViT2JqW29wdHMucHJvcGVydHldO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKG9wdHMuc2V0KSB7XG4gICAgICAgICAgZGVzYy5zZXQgPSBmdW5jdGlvbih2KSB7XG4gICAgICAgICAgICBzdWJPYmpbb3B0cy5wcm9wZXJ0eV0gPSB2O1xuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgb3B0cy5uYW1lLCBkZXNjKTtcbiAgICAgIH0pKHByb3BlcnRpZXNbaV0pO1xuICAgIH1cbiAgfSxcbiAgY2FwaXRhbGlzZUZpcnN0TGV0dGVyOiBmdW5jdGlvbihzdHJpbmcpIHtcbiAgICByZXR1cm4gc3RyaW5nLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgc3RyaW5nLnNsaWNlKDEpO1xuICB9LFxuICBleHRlbmRGcm9tT3B0czogZnVuY3Rpb24ob2JqLCBvcHRzLCBkZWZhdWx0cywgZXJyb3JPblVua25vd24pIHtcbiAgICBlcnJvck9uVW5rbm93biA9IGVycm9yT25Vbmtub3duID09IHVuZGVmaW5lZCA/IHRydWUgOiBlcnJvck9uVW5rbm93bjtcbiAgICBpZiAoZXJyb3JPblVua25vd24pIHtcbiAgICAgIHZhciBkZWZhdWx0S2V5cyA9IE9iamVjdC5rZXlzKGRlZmF1bHRzKSxcbiAgICAgICAgb3B0c0tleXMgPSBPYmplY3Qua2V5cyhvcHRzKTtcbiAgICAgIHZhciB1bmtub3duS2V5cyA9IG9wdHNLZXlzLmZpbHRlcihmdW5jdGlvbihuKSB7XG4gICAgICAgIHJldHVybiBkZWZhdWx0S2V5cy5pbmRleE9mKG4pID09IC0xXG4gICAgICB9KTtcbiAgICAgIGlmICh1bmtub3duS2V5cy5sZW5ndGgpIHRocm93IEVycm9yKCdVbmtub3duIG9wdGlvbnM6ICcgKyB1bmtub3duS2V5cy50b1N0cmluZygpKTtcbiAgICB9XG4gICAgLy8gQXBwbHkgYW55IGZ1bmN0aW9ucyBzcGVjaWZpZWQgaW4gdGhlIGRlZmF1bHRzLlxuICAgIE9iamVjdC5rZXlzKGRlZmF1bHRzKS5mb3JFYWNoKGZ1bmN0aW9uKGspIHtcbiAgICAgIHZhciBkID0gZGVmYXVsdHNba107XG4gICAgICBpZiAodHlwZW9mIGQgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBkZWZhdWx0c1trXSA9IGQob3B0c1trXSk7XG4gICAgICAgIGRlbGV0ZSBvcHRzW2tdO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGV4dGVuZChkZWZhdWx0cywgb3B0cyk7XG4gICAgZXh0ZW5kKG9iaiwgZGVmYXVsdHMpO1xuICB9LFxuICBpc1N0cmluZzogaXNTdHJpbmcsXG4gIGlzQXJyYXk6IGlzQXJyYXksXG4gIHByZXR0eVByaW50OiBmdW5jdGlvbihvKSB7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KG8sIG51bGwsIDQpO1xuICB9LFxuICBmbGF0dGVuQXJyYXk6IGZ1bmN0aW9uKGFycikge1xuICAgIHJldHVybiBhcnIucmVkdWNlKGZ1bmN0aW9uKG1lbW8sIGUpIHtcbiAgICAgIGlmIChpc0FycmF5KGUpKSB7XG4gICAgICAgIG1lbW8gPSBtZW1vLmNvbmNhdChlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1lbW8ucHVzaChlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtZW1vO1xuICAgIH0sIFtdKTtcbiAgfSxcbiAgdW5mbGF0dGVuQXJyYXk6IGZ1bmN0aW9uKGFyciwgbW9kZWxBcnIpIHtcbiAgICB2YXIgbiA9IDA7XG4gICAgdmFyIHVuZmxhdHRlbmVkID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBtb2RlbEFyci5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGlzQXJyYXkobW9kZWxBcnJbaV0pKSB7XG4gICAgICAgIHZhciBuZXdBcnIgPSBbXTtcbiAgICAgICAgdW5mbGF0dGVuZWRbaV0gPSBuZXdBcnI7XG4gICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgbW9kZWxBcnJbaV0ubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICBuZXdBcnIucHVzaChhcnJbbl0pO1xuICAgICAgICAgIG4rKztcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdW5mbGF0dGVuZWRbaV0gPSBhcnJbbl07XG4gICAgICAgIG4rKztcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHVuZmxhdHRlbmVkO1xuICB9XG59KTtcblxuLyoqXG4gKiBDb21wYWN0IGEgc3BhcnNlIGFycmF5XG4gKiBAcGFyYW0gYXJyXG4gKiBAcmV0dXJucyB7QXJyYXl9XG4gKi9cbmZ1bmN0aW9uIGNvbXBhY3QoYXJyKSB7XG4gIGFyciA9IGFyciB8fCBbXTtcbiAgcmV0dXJuIGFyci5maWx0ZXIoZnVuY3Rpb24oeCkge3JldHVybiB4fSk7XG59XG5cbi8qKlxuICogRXhlY3V0ZSB0YXNrcyBpbiBwYXJhbGxlbFxuICogQHBhcmFtIHRhc2tzXG4gKiBAcGFyYW0gY2JcbiAqL1xuZnVuY3Rpb24gcGFyYWxsZWwodGFza3MsIGNiKSB7XG4gIGNiID0gY2IgfHwgZnVuY3Rpb24oKSB7fTtcbiAgaWYgKHRhc2tzICYmIHRhc2tzLmxlbmd0aCkge1xuICAgIHZhciByZXN1bHRzID0gW10sIGVycm9ycyA9IFtdLCBudW1GaW5pc2hlZCA9IDA7XG4gICAgdGFza3MuZm9yRWFjaChmdW5jdGlvbihmbiwgaWR4KSB7XG4gICAgICByZXN1bHRzW2lkeF0gPSBmYWxzZTtcbiAgICAgIGZuKGZ1bmN0aW9uKGVyciwgcmVzKSB7XG4gICAgICAgIG51bUZpbmlzaGVkKys7XG4gICAgICAgIGlmIChlcnIpIGVycm9yc1tpZHhdID0gZXJyO1xuICAgICAgICByZXN1bHRzW2lkeF0gPSByZXM7XG4gICAgICAgIGlmIChudW1GaW5pc2hlZCA9PSB0YXNrcy5sZW5ndGgpIHtcbiAgICAgICAgICBjYihcbiAgICAgICAgICAgIGVycm9ycy5sZW5ndGggPyBjb21wYWN0KGVycm9ycykgOiBudWxsLFxuICAgICAgICAgICAgY29tcGFjdChyZXN1bHRzKSxcbiAgICAgICAgICAgIHtyZXN1bHRzOiByZXN1bHRzLCBlcnJvcnM6IGVycm9yc31cbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSBlbHNlIGNiKCk7XG59XG5cbi8qKlxuICogRXhlY3V0ZSB0YXNrcyBvbmUgYWZ0ZXIgYW5vdGhlclxuICogQHBhcmFtIHRhc2tzXG4gKiBAcGFyYW0gY2JcbiAqL1xuZnVuY3Rpb24gc2VyaWVzKHRhc2tzLCBjYikge1xuICBjYiA9IGNiIHx8IGZ1bmN0aW9uKCkge307XG4gIGlmICh0YXNrcyAmJiB0YXNrcy5sZW5ndGgpIHtcbiAgICB2YXIgcmVzdWx0cyA9IFtdLCBlcnJvcnMgPSBbXSwgaWR4ID0gMDtcblxuICAgIGZ1bmN0aW9uIGV4ZWN1dGVUYXNrKHRhc2spIHtcbiAgICAgIHRhc2soZnVuY3Rpb24oZXJyLCByZXMpIHtcbiAgICAgICAgaWYgKGVycikgZXJyb3JzW2lkeF0gPSBlcnI7XG4gICAgICAgIHJlc3VsdHNbaWR4XSA9IHJlcztcbiAgICAgICAgaWYgKCF0YXNrcy5sZW5ndGgpIHtcbiAgICAgICAgICBjYihcbiAgICAgICAgICAgIGVycm9ycy5sZW5ndGggPyBjb21wYWN0KGVycm9ycykgOiBudWxsLFxuICAgICAgICAgICAgY29tcGFjdChyZXN1bHRzKSxcbiAgICAgICAgICAgIHtyZXN1bHRzOiByZXN1bHRzLCBlcnJvcnM6IGVycm9yc31cbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGlkeCsrO1xuICAgICAgICAgIG5leHRUYXNrKCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG5leHRUYXNrKCkge1xuICAgICAgdmFyIG5leHRUYXNrID0gdGFza3Muc2hpZnQoKTtcbiAgICAgIGV4ZWN1dGVUYXNrKG5leHRUYXNrKTtcbiAgICB9XG5cbiAgICBuZXh0VGFzaygpO1xuXG4gIH0gZWxzZSBjYigpO1xufVxuXG5cbmV4dGVuZChtb2R1bGUuZXhwb3J0cywge1xuICBjb21wYWN0OiBjb21wYWN0LFxuICBwYXJhbGxlbDogcGFyYWxsZWwsXG4gIHNlcmllczogc2VyaWVzXG59KTtcblxudmFyIEZOX0FSR1MgPSAvXmZ1bmN0aW9uXFxzKlteXFwoXSpcXChcXHMqKFteXFwpXSopXFwpL20sXG4gIEZOX0FSR19TUExJVCA9IC8sLyxcbiAgRk5fQVJHID0gL15cXHMqKF8/KSguKz8pXFwxXFxzKiQvLFxuICBTVFJJUF9DT01NRU5UUyA9IC8oKFxcL1xcLy4qJCl8KFxcL1xcKltcXHNcXFNdKj9cXCpcXC8pKS9tZztcblxuZXh0ZW5kKG1vZHVsZS5leHBvcnRzLCB7XG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIHBhcmFtZXRlciBuYW1lcyBvZiBhIGZ1bmN0aW9uLlxuICAgKiBOb3RlOiBhZGFwdGVkIGZyb20gQW5ndWxhckpTIGRlcGVuZGVuY3kgaW5qZWN0aW9uIDopXG4gICAqIEBwYXJhbSBmblxuICAgKi9cbiAgcGFyYW1OYW1lczogZnVuY3Rpb24oZm4pIHtcbiAgICAvLyBUT0RPOiBJcyB0aGVyZSBhIG1vcmUgcm9idXN0IHdheSBvZiBkb2luZyB0aGlzP1xuICAgIHZhciBwYXJhbXMgPSBbXSxcbiAgICAgIGZuVGV4dCxcbiAgICAgIGFyZ0RlY2w7XG4gICAgZm5UZXh0ID0gZm4udG9TdHJpbmcoKS5yZXBsYWNlKFNUUklQX0NPTU1FTlRTLCAnJyk7XG4gICAgYXJnRGVjbCA9IGZuVGV4dC5tYXRjaChGTl9BUkdTKTtcblxuICAgIGFyZ0RlY2xbMV0uc3BsaXQoRk5fQVJHX1NQTElUKS5mb3JFYWNoKGZ1bmN0aW9uKGFyZykge1xuICAgICAgYXJnLnJlcGxhY2UoRk5fQVJHLCBmdW5jdGlvbihhbGwsIHVuZGVyc2NvcmUsIG5hbWUpIHtcbiAgICAgICAgcGFyYW1zLnB1c2gobmFtZSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICByZXR1cm4gcGFyYW1zO1xuICB9XG59KTtcblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS91dGlsLmpzXG4gKiogbW9kdWxlIGlkID0gMVxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuZnVuY3Rpb24gQ29sbGVjdGlvblJlZ2lzdHJ5KCkge1xuICBpZiAoIXRoaXMpIHJldHVybiBuZXcgQ29sbGVjdGlvblJlZ2lzdHJ5KCk7XG4gIHRoaXMuY29sbGVjdGlvbk5hbWVzID0gW107XG59XG5cbnV0aWwuZXh0ZW5kKENvbGxlY3Rpb25SZWdpc3RyeS5wcm90b3R5cGUsIHtcbiAgcmVnaXN0ZXI6IGZ1bmN0aW9uKGNvbGxlY3Rpb24pIHtcbiAgICB2YXIgbmFtZSA9IGNvbGxlY3Rpb24ubmFtZTtcbiAgICB0aGlzW25hbWVdID0gY29sbGVjdGlvbjtcbiAgICB0aGlzLmNvbGxlY3Rpb25OYW1lcy5wdXNoKG5hbWUpO1xuICB9LFxuICByZXNldDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMuY29sbGVjdGlvbk5hbWVzLmZvckVhY2goZnVuY3Rpb24obmFtZSkge1xuICAgICAgZGVsZXRlIHNlbGZbbmFtZV07XG4gICAgfSk7XG4gICAgdGhpcy5jb2xsZWN0aW9uTmFtZXMgPSBbXTtcbiAgfVxufSk7XG5cbmV4cG9ydHMuQ29sbGVjdGlvblJlZ2lzdHJ5ID0gbmV3IENvbGxlY3Rpb25SZWdpc3RyeSgpO1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL2NvbGxlY3Rpb25SZWdpc3RyeS5qc1xuICoqIG1vZHVsZSBpZCA9IDJcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdjb2xsZWN0aW9uJyksXG4gIENvbGxlY3Rpb25SZWdpc3RyeSA9IHJlcXVpcmUoJy4vY29sbGVjdGlvblJlZ2lzdHJ5JykuQ29sbGVjdGlvblJlZ2lzdHJ5LFxuICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gIE1vZGVsID0gcmVxdWlyZSgnLi9tb2RlbCcpLFxuICBleHRlbmQgPSByZXF1aXJlKCdleHRlbmQnKSxcbiAgb2JzZXJ2ZSA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuUGxhdGZvcm0sXG4gIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgZXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJyksXG4gIGFyZ3NhcnJheSA9IHJlcXVpcmUoJ2FyZ3NhcnJheScpLFxuICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKTtcblxuXG4vKipcbiAqIEEgY29sbGVjdGlvbiBkZXNjcmliZXMgYSBzZXQgb2YgbW9kZWxzIGFuZCBvcHRpb25hbGx5IGEgUkVTVCBBUEkgd2hpY2ggd2Ugd291bGRcbiAqIGxpa2UgdG8gbW9kZWwuXG4gKlxuICogQHBhcmFtIG5hbWVcbiAqIEBwYXJhbSBvcHRzXG4gKiBAY29uc3RydWN0b3JcbiAqXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYGpzXG4gKiB2YXIgR2l0SHViID0gbmV3IHNpZXN0YSgnR2l0SHViJylcbiAqIC8vIC4uLiBjb25maWd1cmUgbWFwcGluZ3MsIGRlc2NyaXB0b3JzIGV0YyAuLi5cbiAqIEdpdEh1Yi5pbnN0YWxsKGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgLy8gLi4uIGNhcnJ5IG9uLlxuICAgICAqIH0pO1xuICogYGBgXG4gKi9cbmZ1bmN0aW9uIENvbGxlY3Rpb24obmFtZSwgb3B0cykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIGlmICghbmFtZSkgdGhyb3cgbmV3IEVycm9yKCdDb2xsZWN0aW9uIG11c3QgaGF2ZSBhIG5hbWUnKTtcblxuICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgdXRpbC5leHRlbmRGcm9tT3B0cyh0aGlzLCBvcHRzLCB7fSk7XG5cbiAgdXRpbC5leHRlbmQodGhpcywge1xuICAgIG5hbWU6IG5hbWUsXG4gICAgX3Jhd01vZGVsczoge30sXG4gICAgX21vZGVsczoge30sXG4gICAgX29wdHM6IG9wdHMsXG4gICAgaW5zdGFsbGVkOiBmYWxzZVxuICB9KTtcblxuICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0aGlzLCB7XG4gICAgZGlydHk6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmIChzaWVzdGEuZXh0LnN0b3JhZ2VFbmFibGVkKSB7XG4gICAgICAgICAgdmFyIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uID0gc2llc3RhLmV4dC5zdG9yYWdlLl91bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbixcbiAgICAgICAgICAgIGhhc2ggPSB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltzZWxmLm5hbWVdIHx8IHt9O1xuICAgICAgICAgIHJldHVybiAhIU9iamVjdC5rZXlzKGhhc2gpLmxlbmd0aDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH1cbiAgfSk7XG5cbiAgQ29sbGVjdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyKHRoaXMpO1xuICB0aGlzLl9tYWtlQXZhaWxhYmxlT25Sb290KCk7XG4gIGV2ZW50cy5Qcm94eUV2ZW50RW1pdHRlci5jYWxsKHRoaXMsIHRoaXMubmFtZSk7XG59XG5cbkNvbGxlY3Rpb24ucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShldmVudHMuUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlKTtcblxudXRpbC5leHRlbmQoQ29sbGVjdGlvbi5wcm90b3R5cGUsIHtcbiAgX2dldE1vZGVsc1RvSW5zdGFsbDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIG1vZGVsc1RvSW5zdGFsbCA9IFtdO1xuICAgIGZvciAodmFyIG5hbWUgaW4gdGhpcy5fbW9kZWxzKSB7XG4gICAgICBpZiAodGhpcy5fbW9kZWxzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgIHZhciBtb2RlbCA9IHRoaXMuX21vZGVsc1tuYW1lXTtcbiAgICAgICAgbW9kZWxzVG9JbnN0YWxsLnB1c2gobW9kZWwpO1xuICAgICAgfVxuICAgIH1cbiAgICBsb2coJ1RoZXJlIGFyZSAnICsgbW9kZWxzVG9JbnN0YWxsLmxlbmd0aC50b1N0cmluZygpICsgJyBtYXBwaW5ncyB0byBpbnN0YWxsJyk7XG4gICAgcmV0dXJuIG1vZGVsc1RvSW5zdGFsbDtcbiAgfSxcbiAgLyoqXG4gICAqIE1lYW5zIHRoYXQgd2UgY2FuIGFjY2VzcyB0aGUgY29sbGVjdGlvbiBvbiB0aGUgc2llc3RhIG9iamVjdC5cbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9tYWtlQXZhaWxhYmxlT25Sb290OiBmdW5jdGlvbigpIHtcbiAgICBzaWVzdGFbdGhpcy5uYW1lXSA9IHRoaXM7XG4gIH0sXG4gIC8qKlxuICAgKiBFbnN1cmUgbWFwcGluZ3MgYXJlIGluc3RhbGxlZC5cbiAgICogQHBhcmFtIFtjYl1cbiAgICogQGNsYXNzIENvbGxlY3Rpb25cbiAgICovXG4gIGluc3RhbGw6IGZ1bmN0aW9uKGNiKSB7XG4gICAgdmFyIG1vZGVsc1RvSW5zdGFsbCA9IHRoaXMuX2dldE1vZGVsc1RvSW5zdGFsbCgpO1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICBpZiAoIXRoaXMuaW5zdGFsbGVkKSB7XG4gICAgICAgIHRoaXMuaW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgdmFyIGVycm9ycyA9IFtdO1xuICAgICAgICBtb2RlbHNUb0luc3RhbGwuZm9yRWFjaChmdW5jdGlvbihtKSB7XG4gICAgICAgICAgbG9nKCdJbnN0YWxsaW5nIHJlbGF0aW9uc2hpcHMgZm9yIG1hcHBpbmcgd2l0aCBuYW1lIFwiJyArIG0ubmFtZSArICdcIicpO1xuICAgICAgICAgIHZhciBlcnIgPSBtLmluc3RhbGxSZWxhdGlvbnNoaXBzKCk7XG4gICAgICAgICAgaWYgKGVycikgZXJyb3JzLnB1c2goZXJyKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGlmICghZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgIG1vZGVsc1RvSW5zdGFsbC5mb3JFYWNoKGZ1bmN0aW9uKG0pIHtcbiAgICAgICAgICAgIGxvZygnSW5zdGFsbGluZyByZXZlcnNlIHJlbGF0aW9uc2hpcHMgZm9yIG1hcHBpbmcgd2l0aCBuYW1lIFwiJyArIG0ubmFtZSArICdcIicpO1xuICAgICAgICAgICAgdmFyIGVyciA9IG0uaW5zdGFsbFJldmVyc2VSZWxhdGlvbnNoaXBzKCk7XG4gICAgICAgICAgICBpZiAoZXJyKSBlcnJvcnMucHVzaChlcnIpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGlmICghZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhpcy5pbnN0YWxsZWQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5fbWFrZUF2YWlsYWJsZU9uUm9vdCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjYihlcnJvcnMubGVuZ3RoID8gZXJyb3IoJ0Vycm9ycyB3ZXJlIGVuY291bnRlcmVkIHdoaWxzdCBzZXR0aW5nIHVwIHRoZSBjb2xsZWN0aW9uJywge2Vycm9yczogZXJyb3JzfSkgOiBudWxsKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdDb2xsZWN0aW9uIFwiJyArIHRoaXMubmFtZSArICdcIiBoYXMgYWxyZWFkeSBiZWVuIGluc3RhbGxlZCcpO1xuICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG5cbiAgX21vZGVsOiBmdW5jdGlvbihuYW1lLCBvcHRzKSB7XG4gICAgaWYgKG5hbWUpIHtcbiAgICAgIHRoaXMuX3Jhd01vZGVsc1tuYW1lXSA9IG9wdHM7XG4gICAgICBvcHRzID0gZXh0ZW5kKHRydWUsIHt9LCBvcHRzKTtcbiAgICAgIG9wdHMubmFtZSA9IG5hbWU7XG4gICAgICBvcHRzLmNvbGxlY3Rpb24gPSB0aGlzO1xuICAgICAgdmFyIG1vZGVsID0gbmV3IE1vZGVsKG9wdHMpO1xuICAgICAgdGhpcy5fbW9kZWxzW25hbWVdID0gbW9kZWw7XG4gICAgICB0aGlzW25hbWVdID0gbW9kZWw7XG4gICAgICBpZiAodGhpcy5pbnN0YWxsZWQpIHtcbiAgICAgICAgdmFyIGVycm9yID0gbW9kZWwuaW5zdGFsbFJlbGF0aW9uc2hpcHMoKTtcbiAgICAgICAgaWYgKCFlcnJvcikgZXJyb3IgPSBtb2RlbC5pbnN0YWxsUmV2ZXJzZVJlbGF0aW9uc2hpcHMoKTtcbiAgICAgICAgaWYgKGVycm9yKSAgdGhyb3cgZXJyb3I7XG4gICAgICB9XG4gICAgICByZXR1cm4gbW9kZWw7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBuYW1lIHNwZWNpZmllZCB3aGVuIGNyZWF0aW5nIG1hcHBpbmcnKTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVycyBhIG1vZGVsIHdpdGggdGhpcyBjb2xsZWN0aW9uLlxuICAgKi9cbiAgbW9kZWw6IGFyZ3NhcnJheShmdW5jdGlvbihhcmdzKSB7XG4gICAgaWYgKGFyZ3MubGVuZ3RoKSB7XG4gICAgICBpZiAoYXJncy5sZW5ndGggPT0gMSkge1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KGFyZ3NbMF0pKSB7XG4gICAgICAgICAgcmV0dXJuIGFyZ3NbMF0ubWFwKGZ1bmN0aW9uKG0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9tb2RlbChtLm5hbWUsIG0pO1xuICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIG5hbWUsIG9wdHM7XG4gICAgICAgICAgaWYgKHV0aWwuaXNTdHJpbmcoYXJnc1swXSkpIHtcbiAgICAgICAgICAgIG5hbWUgPSBhcmdzWzBdO1xuICAgICAgICAgICAgb3B0cyA9IHt9O1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIG9wdHMgPSBhcmdzWzBdO1xuICAgICAgICAgICAgbmFtZSA9IG9wdHMubmFtZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHRoaXMuX21vZGVsKG5hbWUsIG9wdHMpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAodHlwZW9mIGFyZ3NbMF0gPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5fbW9kZWwoYXJnc1swXSwgYXJnc1sxXSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIGFyZ3MubWFwKGZ1bmN0aW9uKG0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9tb2RlbChtLm5hbWUsIG0pO1xuICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfSksXG5cbiAgLyoqXG4gICAqIER1bXAgdGhpcyBjb2xsZWN0aW9uIGFzIEpTT05cbiAgICogQHBhcmFtICB7Qm9vbGVhbn0gYXNKc29uIFdoZXRoZXIgb3Igbm90IHRvIGFwcGx5IEpTT04uc3RyaW5naWZ5XG4gICAqIEByZXR1cm4ge1N0cmluZ3xPYmplY3R9XG4gICAqIEBjbGFzcyBDb2xsZWN0aW9uXG4gICAqL1xuICBfZHVtcDogZnVuY3Rpb24oYXNKc29uKSB7XG4gICAgdmFyIG9iaiA9IHt9O1xuICAgIG9iai5pbnN0YWxsZWQgPSB0aGlzLmluc3RhbGxlZDtcbiAgICBvYmouZG9jSWQgPSB0aGlzLl9kb2NJZDtcbiAgICBvYmoubmFtZSA9IHRoaXMubmFtZTtcbiAgICByZXR1cm4gYXNKc29uID8gdXRpbC5wcmV0dHlQcmludChvYmopIDogb2JqO1xuICB9LFxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBudW1iZXIgb2Ygb2JqZWN0cyBpbiB0aGlzIGNvbGxlY3Rpb24uXG4gICAqXG4gICAqIEBwYXJhbSBjYlxuICAgKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAgICovXG4gIGNvdW50OiBmdW5jdGlvbihjYikge1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICB2YXIgdGFza3MgPSBPYmplY3Qua2V5cyh0aGlzLl9tb2RlbHMpLm1hcChmdW5jdGlvbihtb2RlbE5hbWUpIHtcbiAgICAgICAgdmFyIG0gPSB0aGlzLl9tb2RlbHNbbW9kZWxOYW1lXTtcbiAgICAgICAgcmV0dXJuIG0uY291bnQuYmluZChtKTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICB1dGlsLnBhcmFsbGVsKHRhc2tzLCBmdW5jdGlvbihlcnIsIG5zKSB7XG4gICAgICAgIHZhciBuO1xuICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgIG4gPSBucy5yZWR1Y2UoZnVuY3Rpb24obSwgcikge1xuICAgICAgICAgICAgcmV0dXJuIG0gKyByXG4gICAgICAgICAgfSwgMCk7XG4gICAgICAgIH1cbiAgICAgICAgY2IoZXJyLCBuKTtcbiAgICAgIH0pO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG5cbiAgZ3JhcGg6IGZ1bmN0aW9uKGRhdGEsIG9wdHMsIGNiKSB7XG4gICAgaWYgKHR5cGVvZiBvcHRzID09ICdmdW5jdGlvbicpIGNiID0gb3B0cztcbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgdmFyIHRhc2tzID0gW10sIGVycjtcbiAgICAgIGZvciAodmFyIG1vZGVsTmFtZSBpbiBkYXRhKSB7XG4gICAgICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KG1vZGVsTmFtZSkpIHtcbiAgICAgICAgICB2YXIgbW9kZWwgPSB0aGlzLl9tb2RlbHNbbW9kZWxOYW1lXTtcbiAgICAgICAgICBpZiAobW9kZWwpIHtcbiAgICAgICAgICAgIChmdW5jdGlvbihtb2RlbCwgZGF0YSkge1xuICAgICAgICAgICAgICB0YXNrcy5wdXNoKGZ1bmN0aW9uKGRvbmUpIHtcbiAgICAgICAgICAgICAgICBtb2RlbC5ncmFwaChkYXRhLCBmdW5jdGlvbihlcnIsIG1vZGVscykge1xuICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3VsdHMgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0c1ttb2RlbC5uYW1lXSA9IG1vZGVscztcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGRvbmUoZXJyLCByZXN1bHRzKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KShtb2RlbCwgZGF0YVttb2RlbE5hbWVdKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBlcnIgPSAnTm8gc3VjaCBtb2RlbCBcIicgKyBtb2RlbE5hbWUgKyAnXCInO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgdXRpbC5zZXJpZXModGFza3MsIGZ1bmN0aW9uKGVyciwgcmVzdWx0cykge1xuICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICByZXN1bHRzID0gcmVzdWx0cy5yZWR1Y2UoZnVuY3Rpb24obWVtbywgcmVzKSB7XG4gICAgICAgICAgICAgIHJldHVybiB1dGlsLmV4dGVuZChtZW1vLCByZXMgfHwge30pO1xuICAgICAgICAgICAgfSwge30pXG4gICAgICAgICAgfSBlbHNlIHJlc3VsdHMgPSBudWxsO1xuICAgICAgICAgIGNiKGVyciwgcmVzdWx0cyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgZWxzZSBjYihlcnJvcihlcnIsIHtkYXRhOiBkYXRhLCBpbnZhbGlkTW9kZWxOYW1lOiBtb2RlbE5hbWV9KSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcblxuICByZW1vdmVBbGw6IGZ1bmN0aW9uKGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIHV0aWwuUHJvbWlzZS5hbGwoXG4gICAgICAgIE9iamVjdC5rZXlzKHRoaXMuX21vZGVscykubWFwKGZ1bmN0aW9uKG1vZGVsTmFtZSkge1xuICAgICAgICAgIHZhciBtb2RlbCA9IHRoaXMuX21vZGVsc1ttb2RlbE5hbWVdO1xuICAgICAgICAgIHJldHVybiBtb2RlbC5yZW1vdmVBbGwoKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKVxuICAgICAgKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGNiKG51bGwpO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goY2IpXG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gQ29sbGVjdGlvbjtcblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9jb2xsZWN0aW9uLmpzXG4gKiogbW9kdWxlIGlkID0gM1xuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiLyoqXG4gKiBUaGlzIGlzIGFuIGluLW1lbW9yeSBjYWNoZSBmb3IgbW9kZWxzLiBNb2RlbHMgYXJlIGNhY2hlZCBieSBsb2NhbCBpZCAoX2lkKSBhbmQgcmVtb3RlIGlkIChkZWZpbmVkIGJ5IHRoZSBtYXBwaW5nKS5cbiAqIExvb2t1cHMgYXJlIHBlcmZvcm1lZCBhZ2FpbnN0IHRoZSBjYWNoZSB3aGVuIG1hcHBpbmcuXG4gKiBAbW9kdWxlIGNhY2hlXG4gKi9cbnZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdjYWNoZScpLFxuICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuXG5mdW5jdGlvbiBDYWNoZSgpIHtcbiAgdGhpcy5yZXNldCgpO1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ19sb2NhbENhY2hlQnlUeXBlJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5sb2NhbDtcbiAgICB9XG4gIH0pO1xufVxuXG5DYWNoZS5wcm90b3R5cGUgPSB7XG4gIHJlc2V0OiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnJlbW90ZSA9IHt9O1xuICAgIHRoaXMubG9jYWxCeUlkID0ge307XG4gICAgdGhpcy5sb2NhbCA9IHt9O1xuICB9LFxuICAvKipcbiAgICogUmV0dXJuIHRoZSBvYmplY3QgaW4gdGhlIGNhY2hlIGdpdmVuIGEgbG9jYWwgaWQgKF9pZClcbiAgICogQHBhcmFtICB7U3RyaW5nfEFycmF5fSBsb2NhbElkXG4gICAqIEByZXR1cm4ge01vZGVsSW5zdGFuY2V9XG4gICAqL1xuICBnZXRWaWFMb2NhbElkOiBmdW5jdGlvbiBnZXRWaWFMb2NhbElkKGxvY2FsSWQpIHtcbiAgICBpZiAodXRpbC5pc0FycmF5KGxvY2FsSWQpKSByZXR1cm4gbG9jYWxJZC5tYXAoZnVuY3Rpb24oeCkge3JldHVybiB0aGlzLmxvY2FsQnlJZFt4XX0uYmluZCh0aGlzKSk7XG4gICAgZWxzZSByZXR1cm4gdGhpcy5sb2NhbEJ5SWRbbG9jYWxJZF07XG4gIH0sXG4gIC8qKlxuICAgKiBHaXZlbiBhIHJlbW90ZSBpZGVudGlmaWVyIGFuZCBhbiBvcHRpb25zIG9iamVjdCB0aGF0IGRlc2NyaWJlcyBtYXBwaW5nL2NvbGxlY3Rpb24sXG4gICAqIHJldHVybiB0aGUgbW9kZWwgaWYgY2FjaGVkLlxuICAgKiBAcGFyYW0gIHtTdHJpbmd8QXJyYXl9IHJlbW90ZUlkXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0c1xuICAgKiBAcGFyYW0gIHtPYmplY3R9IG9wdHMubW9kZWxcbiAgICogQHJldHVybiB7TW9kZWxJbnN0YW5jZX1cbiAgICovXG4gIGdldFZpYVJlbW90ZUlkOiBmdW5jdGlvbihyZW1vdGVJZCwgb3B0cykge1xuICAgIHZhciBjID0gKHRoaXMucmVtb3RlW29wdHMubW9kZWwuY29sbGVjdGlvbk5hbWVdIHx8IHt9KVtvcHRzLm1vZGVsLm5hbWVdIHx8IHt9O1xuICAgIHJldHVybiB1dGlsLmlzQXJyYXkocmVtb3RlSWQpID8gcmVtb3RlSWQubWFwKGZ1bmN0aW9uKHgpIHtyZXR1cm4gY1t4XX0pIDogY1tyZW1vdGVJZF07XG4gIH0sXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIHNpbmdsZXRvbiBvYmplY3QgZ2l2ZW4gYSBzaW5nbGV0b24gbW9kZWwuXG4gICAqIEBwYXJhbSAge01vZGVsfSBtb2RlbFxuICAgKiBAcmV0dXJuIHtNb2RlbEluc3RhbmNlfVxuICAgKi9cbiAgZ2V0U2luZ2xldG9uOiBmdW5jdGlvbihtb2RlbCkge1xuICAgIHZhciBtb2RlbE5hbWUgPSBtb2RlbC5uYW1lO1xuICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG1vZGVsLmNvbGxlY3Rpb25OYW1lO1xuICAgIHZhciBjb2xsZWN0aW9uQ2FjaGUgPSB0aGlzLmxvY2FsW2NvbGxlY3Rpb25OYW1lXTtcbiAgICBpZiAoY29sbGVjdGlvbkNhY2hlKSB7XG4gICAgICB2YXIgdHlwZUNhY2hlID0gY29sbGVjdGlvbkNhY2hlW21vZGVsTmFtZV07XG4gICAgICBpZiAodHlwZUNhY2hlKSB7XG4gICAgICAgIHZhciBvYmpzID0gW107XG4gICAgICAgIGZvciAodmFyIHByb3AgaW4gdHlwZUNhY2hlKSB7XG4gICAgICAgICAgaWYgKHR5cGVDYWNoZS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgb2Jqcy5wdXNoKHR5cGVDYWNoZVtwcm9wXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChvYmpzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICB2YXIgZXJyU3RyID0gJ0Egc2luZ2xldG9uIG1vZGVsIGhhcyBtb3JlIHRoYW4gMSBvYmplY3QgaW4gdGhlIGNhY2hlISBUaGlzIGlzIGEgc2VyaW91cyBlcnJvci4gJyArXG4gICAgICAgICAgICAnRWl0aGVyIGEgbW9kZWwgaGFzIGJlZW4gbW9kaWZpZWQgYWZ0ZXIgb2JqZWN0cyBoYXZlIGFscmVhZHkgYmVlbiBjcmVhdGVkLCBvciBzb21ldGhpbmcgaGFzIGdvbmUnICtcbiAgICAgICAgICAgICd2ZXJ5IHdyb25nLiBQbGVhc2UgZmlsZSBhIGJ1ZyByZXBvcnQgaWYgdGhlIGxhdHRlci4nO1xuICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKGVyclN0cik7XG4gICAgICAgIH0gZWxzZSBpZiAob2Jqcy5sZW5ndGgpIHtcbiAgICAgICAgICByZXR1cm4gb2Jqc1swXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcbiAgLyoqXG4gICAqIEluc2VydCBhbiBvYmplY3QgaW50byB0aGUgY2FjaGUgdXNpbmcgYSByZW1vdGUgaWRlbnRpZmllciBkZWZpbmVkIGJ5IHRoZSBtYXBwaW5nLlxuICAgKiBAcGFyYW0gIHtNb2RlbEluc3RhbmNlfSBvYmpcbiAgICogQHBhcmFtICB7U3RyaW5nfSByZW1vdGVJZFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IFtwcmV2aW91c1JlbW90ZUlkXSBJZiByZW1vdGUgaWQgaGFzIGJlZW4gY2hhbmdlZCwgdGhpcyBpcyB0aGUgb2xkIHJlbW90ZSBpZGVudGlmaWVyXG4gICAqL1xuICByZW1vdGVJbnNlcnQ6IGZ1bmN0aW9uKG9iaiwgcmVtb3RlSWQsIHByZXZpb3VzUmVtb3RlSWQpIHtcbiAgICBpZiAob2JqKSB7XG4gICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBvYmoubW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgICBpZiAoY29sbGVjdGlvbk5hbWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLnJlbW90ZVtjb2xsZWN0aW9uTmFtZV0pIHtcbiAgICAgICAgICB0aGlzLnJlbW90ZVtjb2xsZWN0aW9uTmFtZV0gPSB7fTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgdHlwZSA9IG9iai5tb2RlbC5uYW1lO1xuICAgICAgICBpZiAodHlwZSkge1xuICAgICAgICAgIGlmICghdGhpcy5yZW1vdGVbY29sbGVjdGlvbk5hbWVdW3R5cGVdKSB7XG4gICAgICAgICAgICB0aGlzLnJlbW90ZVtjb2xsZWN0aW9uTmFtZV1bdHlwZV0gPSB7fTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHByZXZpb3VzUmVtb3RlSWQpIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3RlW2NvbGxlY3Rpb25OYW1lXVt0eXBlXVtwcmV2aW91c1JlbW90ZUlkXSA9IG51bGw7XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhciBjYWNoZWRPYmplY3QgPSB0aGlzLnJlbW90ZVtjb2xsZWN0aW9uTmFtZV1bdHlwZV1bcmVtb3RlSWRdO1xuICAgICAgICAgIGlmICghY2FjaGVkT2JqZWN0KSB7XG4gICAgICAgICAgICB0aGlzLnJlbW90ZVtjb2xsZWN0aW9uTmFtZV1bdHlwZV1bcmVtb3RlSWRdID0gb2JqO1xuICAgICAgICAgICAgbG9nKCdSZW1vdGUgY2FjaGUgaW5zZXJ0OiAnICsgb2JqLl9kdW1wKHRydWUpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gU29tZXRoaW5nIGhhcyBnb25lIHJlYWxseSB3cm9uZy4gT25seSBvbmUgb2JqZWN0IGZvciBhIHBhcnRpY3VsYXIgY29sbGVjdGlvbi90eXBlL3JlbW90ZWlkIGNvbWJvXG4gICAgICAgICAgICAvLyBzaG91bGQgZXZlciBleGlzdC5cbiAgICAgICAgICAgIGlmIChvYmogIT0gY2FjaGVkT2JqZWN0KSB7XG4gICAgICAgICAgICAgIHZhciBtZXNzYWdlID0gJ09iamVjdCAnICsgY29sbGVjdGlvbk5hbWUudG9TdHJpbmcoKSArICc6JyArIHR5cGUudG9TdHJpbmcoKSArICdbJyArIG9iai5tb2RlbC5pZCArICc9XCInICsgcmVtb3RlSWQgKyAnXCJdIGFscmVhZHkgZXhpc3RzIGluIHRoZSBjYWNoZS4nICtcbiAgICAgICAgICAgICAgICAnIFRoaXMgaXMgYSBzZXJpb3VzIGVycm9yLCBwbGVhc2UgZmlsZSBhIGJ1ZyByZXBvcnQgaWYgeW91IGFyZSBleHBlcmllbmNpbmcgdGhpcyBvdXQgaW4gdGhlIHdpbGQnO1xuICAgICAgICAgICAgICBsb2cobWVzc2FnZSwge1xuICAgICAgICAgICAgICAgIG9iajogb2JqLFxuICAgICAgICAgICAgICAgIGNhY2hlZE9iamVjdDogY2FjaGVkT2JqZWN0XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihtZXNzYWdlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ01vZGVsIGhhcyBubyB0eXBlJywge1xuICAgICAgICAgICAgbW9kZWw6IG9iai5tb2RlbCxcbiAgICAgICAgICAgIG9iajogb2JqXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNb2RlbCBoYXMgbm8gY29sbGVjdGlvbicsIHtcbiAgICAgICAgICBtb2RlbDogb2JqLm1vZGVsLFxuICAgICAgICAgIG9iajogb2JqXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgbXNnID0gJ011c3QgcGFzcyBhbiBvYmplY3Qgd2hlbiBpbnNlcnRpbmcgdG8gY2FjaGUnO1xuICAgICAgbG9nKG1zZyk7XG4gICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihtc2cpO1xuICAgIH1cbiAgfSxcbiAgLyoqXG4gICAqIFF1ZXJ5IHRoZSBjYWNoZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG9wdHMgT2JqZWN0IGRlc2NyaWJpbmcgdGhlIHF1ZXJ5XG4gICAqIEByZXR1cm4ge01vZGVsSW5zdGFuY2V9XG4gICAqIEBleGFtcGxlXG4gICAqIGBgYGpzXG4gICAqIGNhY2hlLmdldCh7X2lkOiAnNSd9KTsgLy8gUXVlcnkgYnkgbG9jYWwgaWRcbiAgICogY2FjaGUuZ2V0KHtyZW1vdGVJZDogJzUnLCBtYXBwaW5nOiBteU1hcHBpbmd9KTsgLy8gUXVlcnkgYnkgcmVtb3RlIGlkXG4gICAqIGBgYFxuICAgKi9cbiAgZ2V0OiBmdW5jdGlvbihvcHRzKSB7XG4gICAgbG9nKCdnZXQnLCBvcHRzKTtcbiAgICB2YXIgb2JqLCBpZEZpZWxkLCByZW1vdGVJZDtcbiAgICB2YXIgbG9jYWxJZCA9IG9wdHMubG9jYWxJZDtcbiAgICBpZiAobG9jYWxJZCkge1xuICAgICAgb2JqID0gdGhpcy5nZXRWaWFMb2NhbElkKGxvY2FsSWQpO1xuICAgICAgaWYgKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKG9wdHMubW9kZWwpIHtcbiAgICAgICAgICBpZEZpZWxkID0gb3B0cy5tb2RlbC5pZDtcbiAgICAgICAgICByZW1vdGVJZCA9IG9wdHNbaWRGaWVsZF07XG4gICAgICAgICAgbG9nKGlkRmllbGQgKyAnPScgKyByZW1vdGVJZCk7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuZ2V0VmlhUmVtb3RlSWQocmVtb3RlSWQsIG9wdHMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChvcHRzLm1vZGVsKSB7XG4gICAgICBpZEZpZWxkID0gb3B0cy5tb2RlbC5pZDtcbiAgICAgIHJlbW90ZUlkID0gb3B0c1tpZEZpZWxkXTtcbiAgICAgIGlmIChyZW1vdGVJZCkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRWaWFSZW1vdGVJZChyZW1vdGVJZCwgb3B0cyk7XG4gICAgICB9IGVsc2UgaWYgKG9wdHMubW9kZWwuc2luZ2xldG9uKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldFNpbmdsZXRvbihvcHRzLm1vZGVsKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbG9nKCdJbnZhbGlkIG9wdHMgdG8gY2FjaGUnLCB7XG4gICAgICAgIG9wdHM6IG9wdHNcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcbiAgX3JlbW90ZUNhY2hlOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5yZW1vdGVcbiAgfSxcbiAgX2xvY2FsQ2FjaGU6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmxvY2FsQnlJZDtcbiAgfSxcbiAgLyoqXG4gICAqIEluc2VydCBhbiBvYmplY3QgaW50byB0aGUgY2FjaGUuXG4gICAqIEBwYXJhbSAge01vZGVsSW5zdGFuY2V9IG9ialxuICAgKiBAdGhyb3dzIHtJbnRlcm5hbFNpZXN0YUVycm9yfSBBbiBvYmplY3Qgd2l0aCBfaWQvcmVtb3RlSWQgYWxyZWFkeSBleGlzdHMuIE5vdCB0aHJvd24gaWYgc2FtZSBvYmhlY3QuXG4gICAqL1xuICBpbnNlcnQ6IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBsb2NhbElkID0gb2JqLmxvY2FsSWQ7XG4gICAgaWYgKGxvY2FsSWQpIHtcbiAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG9iai5tb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgIHZhciBtb2RlbE5hbWUgPSBvYmoubW9kZWwubmFtZTtcbiAgICAgIGlmICghdGhpcy5sb2NhbEJ5SWRbbG9jYWxJZF0pIHtcbiAgICAgICAgdGhpcy5sb2NhbEJ5SWRbbG9jYWxJZF0gPSBvYmo7XG4gICAgICAgIGlmICghdGhpcy5sb2NhbFtjb2xsZWN0aW9uTmFtZV0pIHRoaXMubG9jYWxbY29sbGVjdGlvbk5hbWVdID0ge307XG4gICAgICAgIGlmICghdGhpcy5sb2NhbFtjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXSkgdGhpcy5sb2NhbFtjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXSA9IHt9O1xuICAgICAgICB0aGlzLmxvY2FsW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdW2xvY2FsSWRdID0gb2JqO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gU29tZXRoaW5nIGhhcyBnb25lIGJhZGx5IHdyb25nIGhlcmUuIFR3byBvYmplY3RzIHNob3VsZCBuZXZlciBleGlzdCB3aXRoIHRoZSBzYW1lIF9pZFxuICAgICAgICBpZiAodGhpcy5sb2NhbEJ5SWRbbG9jYWxJZF0gIT0gb2JqKSB7XG4gICAgICAgICAgdmFyIG1lc3NhZ2UgPSAnT2JqZWN0IHdpdGggbG9jYWxJZD1cIicgKyBsb2NhbElkLnRvU3RyaW5nKCkgKyAnXCIgaXMgYWxyZWFkeSBpbiB0aGUgY2FjaGUuICcgK1xuICAgICAgICAgICAgJ1RoaXMgaXMgYSBzZXJpb3VzIGVycm9yLiBQbGVhc2UgZmlsZSBhIGJ1ZyByZXBvcnQgaWYgeW91IGFyZSBleHBlcmllbmNpbmcgdGhpcyBvdXQgaW4gdGhlIHdpbGQnO1xuICAgICAgICAgIGxvZyhtZXNzYWdlKTtcbiAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihtZXNzYWdlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB2YXIgaWRGaWVsZCA9IG9iai5pZEZpZWxkO1xuICAgIHZhciByZW1vdGVJZCA9IG9ialtpZEZpZWxkXTtcbiAgICBpZiAocmVtb3RlSWQpIHtcbiAgICAgIHRoaXMucmVtb3RlSW5zZXJ0KG9iaiwgcmVtb3RlSWQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2coJ05vIHJlbW90ZSBpZCAoXCInICsgaWRGaWVsZCArICdcIikgc28gd29udCBiZSBwbGFjaW5nIGluIHRoZSByZW1vdGUgY2FjaGUnLCBvYmopO1xuICAgIH1cbiAgfSxcbiAgLyoqXG4gICAqIFJldHVybnMgdHJ1ZSBpZiBvYmplY3QgaXMgaW4gdGhlIGNhY2hlXG4gICAqIEBwYXJhbSAge01vZGVsSW5zdGFuY2V9IG9ialxuICAgKiBAcmV0dXJuIHtib29sZWFufVxuICAgKi9cbiAgY29udGFpbnM6IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBxID0ge1xuICAgICAgbG9jYWxJZDogb2JqLmxvY2FsSWRcbiAgICB9O1xuICAgIHZhciBtb2RlbCA9IG9iai5tb2RlbDtcbiAgICBpZiAobW9kZWwuaWQpIHtcbiAgICAgIGlmIChvYmpbbW9kZWwuaWRdKSB7XG4gICAgICAgIHEubW9kZWwgPSBtb2RlbDtcbiAgICAgICAgcVttb2RlbC5pZF0gPSBvYmpbbW9kZWwuaWRdO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gISF0aGlzLmdldChxKTtcbiAgfSxcblxuICAvKipcbiAgICogUmVtb3ZlcyB0aGUgb2JqZWN0IGZyb20gdGhlIGNhY2hlIChpZiBpdCdzIGFjdHVhbGx5IGluIHRoZSBjYWNoZSkgb3RoZXJ3aXNlcyB0aHJvd3MgYW4gZXJyb3IuXG4gICAqIEBwYXJhbSAge01vZGVsSW5zdGFuY2V9IG9ialxuICAgKiBAdGhyb3dzIHtJbnRlcm5hbFNpZXN0YUVycm9yfSBJZiBvYmplY3QgYWxyZWFkeSBpbiB0aGUgY2FjaGUuXG4gICAqL1xuICByZW1vdmU6IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmICh0aGlzLmNvbnRhaW5zKG9iaikpIHtcbiAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG9iai5tb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgIHZhciBtb2RlbE5hbWUgPSBvYmoubW9kZWwubmFtZTtcbiAgICAgIHZhciBsb2NhbElkID0gb2JqLmxvY2FsSWQ7XG4gICAgICBpZiAoIW1vZGVsTmFtZSkgdGhyb3cgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gbWFwcGluZyBuYW1lJyk7XG4gICAgICBpZiAoIWNvbGxlY3Rpb25OYW1lKSB0aHJvdyBJbnRlcm5hbFNpZXN0YUVycm9yKCdObyBjb2xsZWN0aW9uIG5hbWUnKTtcbiAgICAgIGlmICghbG9jYWxJZCkgdGhyb3cgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gbG9jYWxJZCcpO1xuICAgICAgZGVsZXRlIHRoaXMubG9jYWxbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV1bbG9jYWxJZF07XG4gICAgICBkZWxldGUgdGhpcy5sb2NhbEJ5SWRbbG9jYWxJZF07XG4gICAgICBpZiAob2JqLm1vZGVsLmlkKSB7XG4gICAgICAgIHZhciByZW1vdGVJZCA9IG9ialtvYmoubW9kZWwuaWRdO1xuICAgICAgICBpZiAocmVtb3RlSWQpIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5yZW1vdGVbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV1bcmVtb3RlSWRdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIGNvdW50OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5sb2NhbEJ5SWQpLmxlbmd0aDtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBuZXcgQ2FjaGUoKTtcblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9jYWNoZS5qc1xuICoqIG1vZHVsZSBpZCA9IDRcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdtb2RlbCcpLFxuICBDb2xsZWN0aW9uUmVnaXN0cnkgPSByZXF1aXJlKCcuL2NvbGxlY3Rpb25SZWdpc3RyeScpLkNvbGxlY3Rpb25SZWdpc3RyeSxcbiAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICBSZWxhdGlvbnNoaXBUeXBlID0gcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBUeXBlJyksXG4gIFF1ZXJ5ID0gcmVxdWlyZSgnLi9RdWVyeScpLFxuICBNYXBwaW5nT3BlcmF0aW9uID0gcmVxdWlyZSgnLi9tYXBwaW5nT3BlcmF0aW9uJyksXG4gIE1vZGVsSW5zdGFuY2UgPSByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKSxcbiAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKSxcbiAgYXJnc2FycmF5ID0gcmVxdWlyZSgnYXJnc2FycmF5JyksXG4gIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICBleHRlbmQgPSByZXF1aXJlKCdleHRlbmQnKSxcbiAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gIENvbmRpdGlvbiA9IHJlcXVpcmUoJy4vQ29uZGl0aW9uJyksXG4gIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gIFBsYWNlaG9sZGVyID0gcmVxdWlyZSgnLi9QbGFjZWhvbGRlcicpLFxuICBSZWFjdGl2ZVF1ZXJ5ID0gcmVxdWlyZSgnLi9SZWFjdGl2ZVF1ZXJ5JyksXG4gIEluc3RhbmNlRmFjdG9yeSA9IHJlcXVpcmUoJy4vaW5zdGFuY2VGYWN0b3J5Jyk7XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKi9cbmZ1bmN0aW9uIE1vZGVsKG9wdHMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB0aGlzLl9vcHRzID0gb3B0cyA/IHV0aWwuZXh0ZW5kKHt9LCBvcHRzKSA6IHt9O1xuXG4gIHV0aWwuZXh0ZW5kRnJvbU9wdHModGhpcywgb3B0cywge1xuICAgIG1ldGhvZHM6IHt9LFxuICAgIGF0dHJpYnV0ZXM6IFtdLFxuICAgIGNvbGxlY3Rpb246IGZ1bmN0aW9uKGMpIHtcbiAgICAgIGlmICh1dGlsLmlzU3RyaW5nKGMpKSB7XG4gICAgICAgIGMgPSBDb2xsZWN0aW9uUmVnaXN0cnlbY107XG4gICAgICB9XG4gICAgICByZXR1cm4gYztcbiAgICB9LFxuICAgIGlkOiAnaWQnLFxuICAgIHJlbGF0aW9uc2hpcHM6IFtdLFxuICAgIG5hbWU6IG51bGwsXG4gICAgaW5kZXhlczogW10sXG4gICAgc2luZ2xldG9uOiBmYWxzZSxcbiAgICBzdGF0aWNzOiB0aGlzLmluc3RhbGxTdGF0aWNzLmJpbmQodGhpcyksXG4gICAgcHJvcGVydGllczoge30sXG4gICAgaW5pdDogbnVsbCxcbiAgICBzZXJpYWxpc2U6IG51bGwsXG4gICAgc2VyaWFsaXNlRmllbGQ6IG51bGwsXG4gICAgc2VyaWFsaXNhYmxlRmllbGRzOiBudWxsLFxuICAgIHJlbW92ZTogbnVsbCxcbiAgICBwYXJzZUF0dHJpYnV0ZTogbnVsbFxuICB9LCBmYWxzZSk7XG5cbiAgaWYgKCF0aGlzLnBhcnNlQXR0cmlidXRlKSB7XG4gICAgdGhpcy5wYXJzZUF0dHJpYnV0ZSA9IGZ1bmN0aW9uKGF0dHJOYW1lLCB2YWx1ZSkge1xuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIGlmICghdGhpcy5zZXJpYWxpc2VGaWVsZCkge1xuICAgIHRoaXMuc2VyaWFsaXNlRmllbGQgPSBmdW5jdGlvbihhdHRyTmFtZSwgdmFsdWUpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9O1xuICB9XG5cbiAgdGhpcy5hdHRyaWJ1dGVzID0gTW9kZWwuX3Byb2Nlc3NBdHRyaWJ1dGVzKHRoaXMuYXR0cmlidXRlcyk7XG5cbiAgdGhpcy5fZmFjdG9yeSA9IG5ldyBJbnN0YW5jZUZhY3RvcnkodGhpcyk7XG4gIHRoaXMuX2luc3RhbmNlID0gdGhpcy5fZmFjdG9yeS5faW5zdGFuY2UuYmluZCh0aGlzLl9mYWN0b3J5KTtcblxuICB1dGlsLmV4dGVuZCh0aGlzLCB7XG4gICAgX3JlbGF0aW9uc2hpcHNJbnN0YWxsZWQ6IGZhbHNlLFxuICAgIF9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZDogZmFsc2UsXG4gICAgY2hpbGRyZW46IFtdXG4gIH0pO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICBfcmVsYXRpb25zaGlwTmFtZXM6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhzZWxmLnJlbGF0aW9uc2hpcHMpO1xuICAgICAgfSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9LFxuICAgIF9hdHRyaWJ1dGVOYW1lczoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIG5hbWVzID0gW107XG4gICAgICAgIGlmIChzZWxmLmlkKSB7XG4gICAgICAgICAgbmFtZXMucHVzaChzZWxmLmlkKTtcbiAgICAgICAgfVxuICAgICAgICBzZWxmLmF0dHJpYnV0ZXMuZm9yRWFjaChmdW5jdGlvbih4KSB7XG4gICAgICAgICAgbmFtZXMucHVzaCh4Lm5hbWUpXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gbmFtZXM7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0sXG4gICAgaW5zdGFsbGVkOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gc2VsZi5fcmVsYXRpb25zaGlwc0luc3RhbGxlZCAmJiBzZWxmLl9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZDtcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSxcbiAgICBkZXNjZW5kYW50czoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHNlbGYuY2hpbGRyZW4ucmVkdWNlKGZ1bmN0aW9uKG1lbW8sIGRlc2NlbmRhbnQpIHtcbiAgICAgICAgICByZXR1cm4gQXJyYXkucHJvdG90eXBlLmNvbmNhdC5jYWxsKG1lbW8sIGRlc2NlbmRhbnQuZGVzY2VuZGFudHMpO1xuICAgICAgICB9LmJpbmQoc2VsZiksIHV0aWwuZXh0ZW5kKFtdLCBzZWxmLmNoaWxkcmVuKSk7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0sXG4gICAgZGlydHk6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmIChzaWVzdGEuZXh0LnN0b3JhZ2VFbmFibGVkKSB7XG4gICAgICAgICAgdmFyIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uID0gc2llc3RhLmV4dC5zdG9yYWdlLl91bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbixcbiAgICAgICAgICAgIGhhc2ggPSAodW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bdGhpcy5jb2xsZWN0aW9uTmFtZV0gfHwge30pW3RoaXMubmFtZV0gfHwge307XG4gICAgICAgICAgcmV0dXJuICEhT2JqZWN0LmtleXMoaGFzaCkubGVuZ3RoO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSxcbiAgICBjb2xsZWN0aW9uTmFtZToge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29sbGVjdGlvbi5uYW1lO1xuICAgICAgfSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9XG4gIH0pO1xuICB2YXIgZ2xvYmFsRXZlbnROYW1lID0gdGhpcy5jb2xsZWN0aW9uTmFtZSArICc6JyArIHRoaXMubmFtZSxcbiAgICBwcm94aWVkID0ge1xuICAgICAgcXVlcnk6IHRoaXMucXVlcnkuYmluZCh0aGlzKVxuICAgIH07XG5cbiAgZXZlbnRzLlByb3h5RXZlbnRFbWl0dGVyLmNhbGwodGhpcywgZ2xvYmFsRXZlbnROYW1lLCBwcm94aWVkKTtcblxuICB0aGlzLl9pbmRleElzSW5zdGFsbGVkID0gbmV3IENvbmRpdGlvbihmdW5jdGlvbihkb25lKSB7XG4gICAgaWYgKHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQpIHNpZXN0YS5leHQuc3RvcmFnZS5lbnN1cmVJbmRleEluc3RhbGxlZCh0aGlzLCBkb25lKTtcbiAgICBlbHNlIGRvbmUoKTtcbiAgfS5iaW5kKHRoaXMpKTtcblxuICB0aGlzLl9tb2RlbExvYWRlZEZyb21TdG9yYWdlID0gbmV3IENvbmRpdGlvbihmdW5jdGlvbihkb25lKSB7XG4gICAgaWYgKHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQpIHNpZXN0YS5leHQuc3RvcmFnZS5sb2FkTW9kZWwoe21vZGVsOiB0aGlzfSwgZG9uZSk7XG4gICAgZWxzZSBkb25lKCk7XG4gIH0pO1xuXG4gIHRoaXMuX3N0b3JhZ2VFbmFibGVkID0gbmV3IENvbmRpdGlvbihbdGhpcy5faW5kZXhJc0luc3RhbGxlZCwgdGhpcy5fbW9kZWxMb2FkZWRGcm9tU3RvcmFnZV0pO1xufVxuXG51dGlsLmV4dGVuZChNb2RlbCwge1xuICAvKipcbiAgICogTm9ybWFsaXNlIGF0dHJpYnV0ZXMgcGFzc2VkIHZpYSB0aGUgb3B0aW9ucyBkaWN0aW9uYXJ5LlxuICAgKiBAcGFyYW0gYXR0cmlidXRlc1xuICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfcHJvY2Vzc0F0dHJpYnV0ZXM6IGZ1bmN0aW9uKGF0dHJpYnV0ZXMpIHtcbiAgICByZXR1cm4gYXR0cmlidXRlcy5yZWR1Y2UoZnVuY3Rpb24obSwgYSkge1xuICAgICAgaWYgKHR5cGVvZiBhID09ICdzdHJpbmcnKSB7XG4gICAgICAgIG0ucHVzaCh7XG4gICAgICAgICAgbmFtZTogYVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBtLnB1c2goYSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbTtcbiAgICB9LCBbXSlcbiAgfVxuXG59KTtcblxuTW9kZWwucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShldmVudHMuUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlKTtcblxudXRpbC5leHRlbmQoTW9kZWwucHJvdG90eXBlLCB7XG4gIGluc3RhbGxTdGF0aWNzOiBmdW5jdGlvbihzdGF0aWNzKSB7XG4gICAgaWYgKHN0YXRpY3MpIHtcbiAgICAgIE9iamVjdC5rZXlzKHN0YXRpY3MpLmZvckVhY2goZnVuY3Rpb24oc3RhdGljTmFtZSkge1xuICAgICAgICBpZiAodGhpc1tzdGF0aWNOYW1lXSkge1xuICAgICAgICAgIGxvZygnU3RhdGljIG1ldGhvZCB3aXRoIG5hbWUgXCInICsgc3RhdGljTmFtZSArICdcIiBhbHJlYWR5IGV4aXN0cy4gSWdub3JpbmcgaXQuJyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgdGhpc1tzdGF0aWNOYW1lXSA9IHN0YXRpY3Nbc3RhdGljTmFtZV0uYmluZCh0aGlzKTtcbiAgICAgICAgfVxuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG4gICAgcmV0dXJuIHN0YXRpY3M7XG4gIH0sXG4gIF92YWxpZGF0ZVJlbGF0aW9uc2hpcFR5cGU6IGZ1bmN0aW9uKHJlbGF0aW9uc2hpcCkge1xuICAgIGlmICghcmVsYXRpb25zaGlwLnR5cGUpIHtcbiAgICAgIGlmICh0aGlzLnNpbmdsZXRvbikgcmVsYXRpb25zaGlwLnR5cGUgPSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvT25lO1xuICAgICAgZWxzZSByZWxhdGlvbnNoaXAudHlwZSA9IFJlbGF0aW9uc2hpcFR5cGUuT25lVG9NYW55O1xuICAgIH1cbiAgICBpZiAodGhpcy5zaW5nbGV0b24gJiYgcmVsYXRpb25zaGlwLnR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5NYW55VG9NYW55KSB7XG4gICAgICByZXR1cm4gJ1NpbmdsZXRvbiBtb2RlbCBjYW5ub3QgdXNlIE1hbnlUb01hbnkgcmVsYXRpb25zaGlwLic7XG4gICAgfVxuICAgIGlmIChPYmplY3Qua2V5cyhSZWxhdGlvbnNoaXBUeXBlKS5pbmRleE9mKHJlbGF0aW9uc2hpcC50eXBlKSA8IDApXG4gICAgICByZXR1cm4gJ1JlbGF0aW9uc2hpcCB0eXBlICcgKyByZWxhdGlvbnNoaXAudHlwZSArICcgZG9lcyBub3QgZXhpc3QnO1xuICAgIHJldHVybiBudWxsO1xuICB9LFxuICBfZ2V0UmV2ZXJzZU1vZGVsOiBmdW5jdGlvbihyZXZlcnNlTmFtZSkge1xuICAgIHZhciByZXZlcnNlTW9kZWw7XG4gICAgaWYgKHJldmVyc2VOYW1lIGluc3RhbmNlb2YgTW9kZWwpIHJldmVyc2VNb2RlbCA9IHJldmVyc2VOYW1lO1xuICAgIGVsc2UgcmV2ZXJzZU1vZGVsID0gdGhpcy5jb2xsZWN0aW9uW3JldmVyc2VOYW1lXTtcbiAgICBpZiAoIXJldmVyc2VNb2RlbCkgeyAvLyBNYXkgaGF2ZSB1c2VkIENvbGxlY3Rpb24uTW9kZWwgZm9ybWF0LlxuICAgICAgdmFyIGFyciA9IHJldmVyc2VOYW1lLnNwbGl0KCcuJyk7XG4gICAgICBpZiAoYXJyLmxlbmd0aCA9PSAyKSB7XG4gICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IGFyclswXTtcbiAgICAgICAgcmV2ZXJzZU5hbWUgPSBhcnJbMV07XG4gICAgICAgIHZhciBvdGhlckNvbGxlY3Rpb24gPSBDb2xsZWN0aW9uUmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdO1xuICAgICAgICBpZiAob3RoZXJDb2xsZWN0aW9uKVxuICAgICAgICAgIHJldmVyc2VNb2RlbCA9IG90aGVyQ29sbGVjdGlvbltyZXZlcnNlTmFtZV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXZlcnNlTW9kZWw7XG4gIH0sXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIHJldmVyc2UgbW9kZWwgb3IgYSBwbGFjZWhvbGRlciB0aGF0IHdpbGwgYmUgcmVzb2x2ZWQgbGF0ZXIuXG4gICAqIEBwYXJhbSBmb3J3YXJkTmFtZVxuICAgKiBAcGFyYW0gcmV2ZXJzZU5hbWVcbiAgICogQHJldHVybnMgeyp9XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfZ2V0UmV2ZXJzZU1vZGVsT3JQbGFjZWhvbGRlcjogZnVuY3Rpb24oZm9yd2FyZE5hbWUsIHJldmVyc2VOYW1lKSB7XG4gICAgdmFyIHJldmVyc2VNb2RlbCA9IHRoaXMuX2dldFJldmVyc2VNb2RlbChyZXZlcnNlTmFtZSk7XG4gICAgcmV0dXJuIHJldmVyc2VNb2RlbCB8fCBuZXcgUGxhY2Vob2xkZXIoe25hbWU6IHJldmVyc2VOYW1lLCByZWY6IHRoaXMsIGZvcndhcmROYW1lOiBmb3J3YXJkTmFtZX0pO1xuICB9LFxuICAvKipcbiAgICogSW5zdGFsbCByZWxhdGlvbnNoaXBzLiBSZXR1cm5zIGVycm9yIGluIGZvcm0gb2Ygc3RyaW5nIGlmIGZhaWxzLlxuICAgKiBAcmV0dXJuIHtTdHJpbmd8bnVsbH1cbiAgICovXG4gIGluc3RhbGxSZWxhdGlvbnNoaXBzOiBmdW5jdGlvbigpIHtcbiAgICBpZiAoIXRoaXMuX3JlbGF0aW9uc2hpcHNJbnN0YWxsZWQpIHtcbiAgICAgIHZhciBlcnIgPSBudWxsO1xuICAgICAgZm9yICh2YXIgbmFtZSBpbiB0aGlzLl9vcHRzLnJlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgaWYgKHRoaXMuX29wdHMucmVsYXRpb25zaGlwcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgIHZhciByZWxhdGlvbnNoaXAgPSB0aGlzLl9vcHRzLnJlbGF0aW9uc2hpcHNbbmFtZV07XG4gICAgICAgICAgLy8gSWYgYSByZXZlcnNlIHJlbGF0aW9uc2hpcCBpcyBpbnN0YWxsZWQgYmVmb3JlaGFuZCwgd2UgZG8gbm90IHdhbnQgdG8gcHJvY2VzcyB0aGVtLlxuICAgICAgICAgIHZhciBpc0ZvcndhcmQgPSAhcmVsYXRpb25zaGlwLmlzUmV2ZXJzZTtcbiAgICAgICAgICBpZiAoaXNGb3J3YXJkKSB7XG4gICAgICAgICAgICBsb2codGhpcy5uYW1lICsgJzogY29uZmlndXJpbmcgcmVsYXRpb25zaGlwICcgKyBuYW1lLCByZWxhdGlvbnNoaXApO1xuICAgICAgICAgICAgaWYgKCEoZXJyID0gdGhpcy5fdmFsaWRhdGVSZWxhdGlvbnNoaXBUeXBlKHJlbGF0aW9uc2hpcCkpKSB7XG4gICAgICAgICAgICAgIHZhciByZXZlcnNlTW9kZWxOYW1lID0gcmVsYXRpb25zaGlwLm1vZGVsO1xuICAgICAgICAgICAgICBpZiAocmV2ZXJzZU1vZGVsTmFtZSkge1xuICAgICAgICAgICAgICAgIHZhciByZXZlcnNlTW9kZWwgPSB0aGlzLl9nZXRSZXZlcnNlTW9kZWxPclBsYWNlaG9sZGVyKG5hbWUsIHJldmVyc2VNb2RlbE5hbWUpO1xuICAgICAgICAgICAgICAgIHV0aWwuZXh0ZW5kKHJlbGF0aW9uc2hpcCwge1xuICAgICAgICAgICAgICAgICAgcmV2ZXJzZU1vZGVsOiByZXZlcnNlTW9kZWwsXG4gICAgICAgICAgICAgICAgICBmb3J3YXJkTW9kZWw6IHRoaXMsXG4gICAgICAgICAgICAgICAgICBmb3J3YXJkTmFtZTogbmFtZSxcbiAgICAgICAgICAgICAgICAgIHJldmVyc2VOYW1lOiByZWxhdGlvbnNoaXAucmV2ZXJzZSB8fCAncmV2ZXJzZV8nICsgbmFtZSxcbiAgICAgICAgICAgICAgICAgIGlzUmV2ZXJzZTogZmFsc2VcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBkZWxldGUgcmVsYXRpb25zaGlwLm1vZGVsO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSByZWxhdGlvbnNoaXAucmV2ZXJzZTtcblxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGVsc2UgcmV0dXJuICdNdXN0IHBhc3MgbW9kZWwnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignUmVsYXRpb25zaGlwcyBmb3IgXCInICsgdGhpcy5uYW1lICsgJ1wiIGhhdmUgYWxyZWFkeSBiZWVuIGluc3RhbGxlZCcpO1xuICAgIH1cbiAgICBpZiAoIWVycikgdGhpcy5fcmVsYXRpb25zaGlwc0luc3RhbGxlZCA9IHRydWU7XG4gICAgcmV0dXJuIGVycjtcbiAgfSxcbiAgX2luc3RhbGxSZXZlcnNlOiBmdW5jdGlvbihyZWxhdGlvbnNoaXApIHtcbiAgICB2YXIgcmV2ZXJzZU1vZGVsID0gcmVsYXRpb25zaGlwLnJldmVyc2VNb2RlbDtcbiAgICB2YXIgaXNQbGFjZWhvbGRlciA9IHJldmVyc2VNb2RlbC5pc1BsYWNlaG9sZGVyO1xuICAgIGlmIChpc1BsYWNlaG9sZGVyKSB7XG4gICAgICB2YXIgbW9kZWxOYW1lID0gcmVsYXRpb25zaGlwLnJldmVyc2VNb2RlbC5uYW1lO1xuICAgICAgcmV2ZXJzZU1vZGVsID0gdGhpcy5fZ2V0UmV2ZXJzZU1vZGVsKG1vZGVsTmFtZSk7XG4gICAgICBpZiAocmV2ZXJzZU1vZGVsKSB7XG4gICAgICAgIHJlbGF0aW9uc2hpcC5yZXZlcnNlTW9kZWwgPSByZXZlcnNlTW9kZWw7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChyZXZlcnNlTW9kZWwpIHtcbiAgICAgIHZhciBlcnI7XG4gICAgICB2YXIgcmV2ZXJzZU5hbWUgPSByZWxhdGlvbnNoaXAucmV2ZXJzZU5hbWUsXG4gICAgICAgIGZvcndhcmRNb2RlbCA9IHJlbGF0aW9uc2hpcC5mb3J3YXJkTW9kZWw7XG5cbiAgICAgIGlmIChyZXZlcnNlTW9kZWwgIT0gdGhpcyB8fCByZXZlcnNlTW9kZWwgPT0gZm9yd2FyZE1vZGVsKSB7XG4gICAgICAgIGlmIChyZXZlcnNlTW9kZWwuc2luZ2xldG9uKSB7XG4gICAgICAgICAgaWYgKHJlbGF0aW9uc2hpcC50eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuTWFueVRvTWFueSkgZXJyID0gJ1NpbmdsZXRvbiBtb2RlbCBjYW5ub3QgYmUgcmVsYXRlZCB2aWEgcmV2ZXJzZSBNYW55VG9NYW55JztcbiAgICAgICAgICBpZiAocmVsYXRpb25zaGlwLnR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5PbmVUb01hbnkpIGVyciA9ICdTaW5nbGV0b24gbW9kZWwgY2Fubm90IGJlIHJlbGF0ZWQgdmlhIHJldmVyc2UgT25lVG9NYW55JztcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgIGxvZyh0aGlzLm5hbWUgKyAnOiBjb25maWd1cmluZyAgcmV2ZXJzZSByZWxhdGlvbnNoaXAgJyArIHJldmVyc2VOYW1lKTtcbiAgICAgICAgICBpZiAocmV2ZXJzZU1vZGVsLnJlbGF0aW9uc2hpcHNbcmV2ZXJzZU5hbWVdKSB7XG4gICAgICAgICAgICAvLyBXZSBhcmUgb2sgdG8gcmVkZWZpbmUgcmV2ZXJzZSByZWxhdGlvbnNoaXBzIHdoZXJlYnkgdGhlIG1vZGVscyBhcmUgaW4gdGhlIHNhbWUgaGllcmFyY2h5XG4gICAgICAgICAgICB2YXIgaXNBbmNlc3Rvck1vZGVsID0gcmV2ZXJzZU1vZGVsLnJlbGF0aW9uc2hpcHNbcmV2ZXJzZU5hbWVdLmZvcndhcmRNb2RlbC5pc0FuY2VzdG9yT2YodGhpcyk7XG4gICAgICAgICAgICB2YXIgaXNEZXNjZW5kZW50TW9kZWwgPSByZXZlcnNlTW9kZWwucmVsYXRpb25zaGlwc1tyZXZlcnNlTmFtZV0uZm9yd2FyZE1vZGVsLmlzRGVzY2VuZGFudE9mKHRoaXMpO1xuICAgICAgICAgICAgaWYgKCFpc0FuY2VzdG9yTW9kZWwgJiYgIWlzRGVzY2VuZGVudE1vZGVsKSB7XG4gICAgICAgICAgICAgIGVyciA9ICdSZXZlcnNlIHJlbGF0aW9uc2hpcCBcIicgKyByZXZlcnNlTmFtZSArICdcIiBhbHJlYWR5IGV4aXN0cyBvbiBtb2RlbCBcIicgKyByZXZlcnNlTW9kZWwubmFtZSArICdcIic7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICByZXZlcnNlTW9kZWwucmVsYXRpb25zaGlwc1tyZXZlcnNlTmFtZV0gPSByZWxhdGlvbnNoaXA7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoaXNQbGFjZWhvbGRlcikge1xuICAgICAgICB2YXIgZXhpc3RpbmdSZXZlcnNlSW5zdGFuY2VzID0gKGNhY2hlLl9sb2NhbENhY2hlQnlUeXBlW3JldmVyc2VNb2RlbC5jb2xsZWN0aW9uTmFtZV0gfHwge30pW3JldmVyc2VNb2RlbC5uYW1lXSB8fCB7fTtcbiAgICAgICAgT2JqZWN0LmtleXMoZXhpc3RpbmdSZXZlcnNlSW5zdGFuY2VzKS5mb3JFYWNoKGZ1bmN0aW9uKGxvY2FsSWQpIHtcbiAgICAgICAgICB2YXIgaW5zdGFuY2NlID0gZXhpc3RpbmdSZXZlcnNlSW5zdGFuY2VzW2xvY2FsSWRdO1xuICAgICAgICAgIHZhciByID0gdXRpbC5leHRlbmQoe30sIHJlbGF0aW9uc2hpcCk7XG4gICAgICAgICAgci5pc1JldmVyc2UgPSB0cnVlO1xuICAgICAgICAgIHRoaXMuX2ZhY3RvcnkuX2luc3RhbGxSZWxhdGlvbnNoaXAociwgaW5zdGFuY2NlKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGVycjtcbiAgfSxcbiAgLyoqXG4gICAqIEN5Y2xlIHRocm91Z2ggcmVsYXRpb25zaGlwcyBhbmQgcmVwbGFjZSBhbnkgcGxhY2Vob2xkZXJzIHdpdGggdGhlIGFjdHVhbCBtb2RlbHMgd2hlcmUgcG9zc2libGUuXG4gICAqL1xuICBfaW5zdGFsbFJldmVyc2VQbGFjZWhvbGRlcnM6IGZ1bmN0aW9uKCkge1xuICAgIGZvciAodmFyIGZvcndhcmROYW1lIGluIHRoaXMucmVsYXRpb25zaGlwcykge1xuICAgICAgaWYgKHRoaXMucmVsYXRpb25zaGlwcy5oYXNPd25Qcm9wZXJ0eShmb3J3YXJkTmFtZSkpIHtcbiAgICAgICAgdmFyIHJlbGF0aW9uc2hpcCA9IHRoaXMucmVsYXRpb25zaGlwc1tmb3J3YXJkTmFtZV07XG4gICAgICAgIGlmIChyZWxhdGlvbnNoaXAucmV2ZXJzZU1vZGVsLmlzUGxhY2Vob2xkZXIpIHRoaXMuX2luc3RhbGxSZXZlcnNlKHJlbGF0aW9uc2hpcCk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICBpbnN0YWxsUmV2ZXJzZVJlbGF0aW9uc2hpcHM6IGZ1bmN0aW9uKCkge1xuICAgIGlmICghdGhpcy5fcmV2ZXJzZVJlbGF0aW9uc2hpcHNJbnN0YWxsZWQpIHtcbiAgICAgIGZvciAodmFyIGZvcndhcmROYW1lIGluIHRoaXMucmVsYXRpb25zaGlwcykge1xuICAgICAgICBpZiAodGhpcy5yZWxhdGlvbnNoaXBzLmhhc093blByb3BlcnR5KGZvcndhcmROYW1lKSkge1xuICAgICAgICAgIHZhciByZWxhdGlvbnNoaXAgPSB0aGlzLnJlbGF0aW9uc2hpcHNbZm9yd2FyZE5hbWVdO1xuICAgICAgICAgIHJlbGF0aW9uc2hpcCA9IGV4dGVuZCh0cnVlLCB7fSwgcmVsYXRpb25zaGlwKTtcbiAgICAgICAgICByZWxhdGlvbnNoaXAuaXNSZXZlcnNlID0gdHJ1ZTtcbiAgICAgICAgICB2YXIgZXJyID0gdGhpcy5faW5zdGFsbFJldmVyc2UocmVsYXRpb25zaGlwKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5fcmV2ZXJzZVJlbGF0aW9uc2hpcHNJbnN0YWxsZWQgPSB0cnVlO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdSZXZlcnNlIHJlbGF0aW9uc2hpcHMgZm9yIFwiJyArIHRoaXMubmFtZSArICdcIiBoYXZlIGFscmVhZHkgYmVlbiBpbnN0YWxsZWQuJyk7XG4gICAgfVxuICAgIHJldHVybiBlcnI7XG4gIH0sXG4gIF9xdWVyeTogZnVuY3Rpb24ocXVlcnkpIHtcbiAgICByZXR1cm4gbmV3IFF1ZXJ5KHRoaXMsIHF1ZXJ5IHx8IHt9KTtcbiAgfSxcbiAgcXVlcnk6IGZ1bmN0aW9uKHF1ZXJ5LCBjYikge1xuICAgIHZhciBxdWVyeUluc3RhbmNlO1xuICAgIHZhciBwcm9taXNlID0gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgaWYgKCF0aGlzLnNpbmdsZXRvbikge1xuICAgICAgICBxdWVyeUluc3RhbmNlID0gdGhpcy5fcXVlcnkocXVlcnkpO1xuICAgICAgICByZXR1cm4gcXVlcnlJbnN0YW5jZS5leGVjdXRlKGNiKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBxdWVyeUluc3RhbmNlID0gdGhpcy5fcXVlcnkoe19faWdub3JlSW5zdGFsbGVkOiB0cnVlfSk7XG4gICAgICAgIHF1ZXJ5SW5zdGFuY2UuZXhlY3V0ZShmdW5jdGlvbihlcnIsIG9ianMpIHtcbiAgICAgICAgICBpZiAoZXJyKSBjYihlcnIpO1xuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgLy8gQ2FjaGUgYSBuZXcgc2luZ2xldG9uIGFuZCB0aGVuIHJlZXhlY3V0ZSB0aGUgcXVlcnlcbiAgICAgICAgICAgIHF1ZXJ5ID0gdXRpbC5leHRlbmQoe30sIHF1ZXJ5KTtcbiAgICAgICAgICAgIHF1ZXJ5Ll9faWdub3JlSW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIGlmICghb2Jqcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgdGhpcy5ncmFwaCh7fSwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgIHF1ZXJ5SW5zdGFuY2UgPSB0aGlzLl9xdWVyeShxdWVyeSk7XG4gICAgICAgICAgICAgICAgICBxdWVyeUluc3RhbmNlLmV4ZWN1dGUoY2IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIGNiKGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIHF1ZXJ5SW5zdGFuY2UgPSB0aGlzLl9xdWVyeShxdWVyeSk7XG4gICAgICAgICAgICAgIHF1ZXJ5SW5zdGFuY2UuZXhlY3V0ZShjYik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICAvLyBCeSB3cmFwcGluZyB0aGUgcHJvbWlzZSBpbiBhbm90aGVyIHByb21pc2Ugd2UgY2FuIHB1c2ggdGhlIGludm9jYXRpb25zIHRvIHRoZSBib3R0b20gb2YgdGhlIGV2ZW50IGxvb3Agc28gdGhhdFxuICAgIC8vIGFueSBldmVudCBoYW5kbGVycyBhZGRlZCB0byB0aGUgY2hhaW4gYXJlIGhvbm91cmVkIHN0cmFpZ2h0IGF3YXkuXG4gICAgdmFyIGxpbmtQcm9taXNlID0gbmV3IHV0aWwuUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgIHByb21pc2UudGhlbihhcmdzYXJyYXkoZnVuY3Rpb24oYXJncykge1xuICAgICAgICBzZXRJbW1lZGlhdGUoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmVzb2x2ZS5hcHBseShudWxsLCBhcmdzKTtcbiAgICAgICAgfSk7XG4gICAgICB9KSwgYXJnc2FycmF5KGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICAgICAgc2V0SW1tZWRpYXRlKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJlamVjdC5hcHBseShudWxsLCBhcmdzKTtcbiAgICAgICAgfSlcbiAgICAgIH0pKTtcbiAgICB9KTtcblxuICAgIHJldHVybiB0aGlzLl9saW5rKHtcbiAgICAgIHRoZW46IGxpbmtQcm9taXNlLnRoZW4uYmluZChsaW5rUHJvbWlzZSksXG4gICAgICBjYXRjaDogbGlua1Byb21pc2UuY2F0Y2guYmluZChsaW5rUHJvbWlzZSksXG4gICAgICBvbjogYXJnc2FycmF5KGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICAgICAgdmFyIHJxID0gbmV3IFJlYWN0aXZlUXVlcnkodGhpcy5fcXVlcnkocXVlcnkpKTtcbiAgICAgICAgcnEuaW5pdCgpO1xuICAgICAgICBycS5vbi5hcHBseShycSwgYXJncyk7XG4gICAgICB9LmJpbmQodGhpcykpXG4gICAgfSk7XG4gIH0sXG4gIC8qKlxuICAgKiBPbmx5IHVzZWQgaW4gdGVzdGluZyBhdCB0aGUgbW9tZW50LlxuICAgKiBAcGFyYW0gcXVlcnlcbiAgICogQHJldHVybnMge1JlYWN0aXZlUXVlcnl9XG4gICAqL1xuICBfcmVhY3RpdmVRdWVyeTogZnVuY3Rpb24ocXVlcnkpIHtcbiAgICByZXR1cm4gbmV3IFJlYWN0aXZlUXVlcnkobmV3IFF1ZXJ5KHRoaXMsIHF1ZXJ5IHx8IHt9KSk7XG4gIH0sXG4gIG9uZTogZnVuY3Rpb24ob3B0cywgY2IpIHtcbiAgICBpZiAodHlwZW9mIG9wdHMgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2IgPSBvcHRzO1xuICAgICAgb3B0cyA9IHt9O1xuICAgIH1cbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgdGhpcy5xdWVyeShvcHRzLCBmdW5jdGlvbihlcnIsIHJlcykge1xuICAgICAgICBpZiAoZXJyKSBjYihlcnIpO1xuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBpZiAocmVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgIGNiKGVycm9yKCdNb3JlIHRoYW4gb25lIGluc3RhbmNlIHJldHVybmVkIHdoZW4gZXhlY3V0aW5nIGdldCBxdWVyeSEnKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmVzID0gcmVzLmxlbmd0aCA/IHJlc1swXSA6IG51bGw7XG4gICAgICAgICAgICBjYihudWxsLCByZXMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgYWxsOiBmdW5jdGlvbihxLCBjYikge1xuICAgIGlmICh0eXBlb2YgcSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYiA9IHE7XG4gICAgICBxID0ge307XG4gICAgfVxuICAgIHEgPSBxIHx8IHt9O1xuICAgIHZhciBxdWVyeSA9IHt9O1xuICAgIGlmIChxLl9fb3JkZXIpIHF1ZXJ5Ll9fb3JkZXIgPSBxLl9fb3JkZXI7XG4gICAgcmV0dXJuIHRoaXMucXVlcnkocSwgY2IpO1xuICB9LFxuICBfYXR0cmlidXRlRGVmaW5pdGlvbldpdGhOYW1lOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmF0dHJpYnV0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBhdHRyaWJ1dGVEZWZpbml0aW9uID0gdGhpcy5hdHRyaWJ1dGVzW2ldO1xuICAgICAgaWYgKGF0dHJpYnV0ZURlZmluaXRpb24ubmFtZSA9PSBuYW1lKSByZXR1cm4gYXR0cmlidXRlRGVmaW5pdGlvbjtcbiAgICB9XG4gIH0sXG4gIC8qKlxuICAgKiBNYXAgZGF0YSBpbnRvIFNpZXN0YS5cbiAgICpcbiAgICogQHBhcmFtIGRhdGEgUmF3IGRhdGEgcmVjZWl2ZWQgcmVtb3RlbHkgb3Igb3RoZXJ3aXNlXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb258b2JqZWN0fSBbb3B0c11cbiAgICogQHBhcmFtIHtib29sZWFufSBvcHRzLm92ZXJyaWRlXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gb3B0cy5faWdub3JlSW5zdGFsbGVkIC0gQSBoYWNrIHRoYXQgYWxsb3dzIG1hcHBpbmcgb250byBNb2RlbHMgZXZlbiBpZiBpbnN0YWxsIHByb2Nlc3MgaGFzIG5vdCBmaW5pc2hlZC5cbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gW2NiXSBDYWxsZWQgb25jZSBwb3VjaCBwZXJzaXN0ZW5jZSByZXR1cm5zLlxuICAgKi9cbiAgZ3JhcGg6IGZ1bmN0aW9uKGRhdGEsIG9wdHMsIGNiKSB7XG4gICAgaWYgKHR5cGVvZiBvcHRzID09ICdmdW5jdGlvbicpIGNiID0gb3B0cztcbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgdmFyIF9tYXAgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIG92ZXJyaWRlcyA9IG9wdHMub3ZlcnJpZGU7XG4gICAgICAgIGlmIChvdmVycmlkZXMpIHtcbiAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KG92ZXJyaWRlcykpIG9wdHMub2JqZWN0cyA9IG92ZXJyaWRlcztcbiAgICAgICAgICBlbHNlIG9wdHMub2JqZWN0cyA9IFtvdmVycmlkZXNdO1xuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZSBvcHRzLm92ZXJyaWRlO1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KGRhdGEpKSB7XG4gICAgICAgICAgdGhpcy5fbWFwQnVsayhkYXRhLCBvcHRzLCBjYik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5fbWFwQnVsayhbZGF0YV0sIG9wdHMsIGZ1bmN0aW9uKGVyciwgb2JqZWN0cykge1xuICAgICAgICAgICAgdmFyIG9iajtcbiAgICAgICAgICAgIGlmIChvYmplY3RzKSB7XG4gICAgICAgICAgICAgIGlmIChvYmplY3RzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIG9iaiA9IG9iamVjdHNbMF07XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVyciA9IGVyciA/ICh1dGlsLmlzQXJyYXkoZGF0YSkgPyBlcnIgOiAodXRpbC5pc0FycmF5KGVycikgPyBlcnJbMF0gOiBlcnIpKSA6IG51bGw7XG4gICAgICAgICAgICBjYihlcnIsIG9iaik7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgIGlmIChvcHRzLl9pZ25vcmVJbnN0YWxsZWQpIHtcbiAgICAgICAgX21hcCgpO1xuICAgICAgfVxuICAgICAgZWxzZSBzaWVzdGEuX2FmdGVySW5zdGFsbChfbWFwKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuICBfbWFwQnVsazogZnVuY3Rpb24oZGF0YSwgb3B0cywgY2FsbGJhY2spIHtcbiAgICB1dGlsLmV4dGVuZChvcHRzLCB7bW9kZWw6IHRoaXMsIGRhdGE6IGRhdGF9KTtcbiAgICB2YXIgb3AgPSBuZXcgTWFwcGluZ09wZXJhdGlvbihvcHRzKTtcbiAgICBvcC5zdGFydChmdW5jdGlvbihlcnIsIG9iamVjdHMpIHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgb2JqZWN0cyB8fCBbXSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG4gIF9jb3VudENhY2hlOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgY29sbENhY2hlID0gY2FjaGUuX2xvY2FsQ2FjaGVCeVR5cGVbdGhpcy5jb2xsZWN0aW9uTmFtZV0gfHwge307XG4gICAgdmFyIG1vZGVsQ2FjaGUgPSBjb2xsQ2FjaGVbdGhpcy5uYW1lXSB8fCB7fTtcbiAgICByZXR1cm4gT2JqZWN0LmtleXMobW9kZWxDYWNoZSkucmVkdWNlKGZ1bmN0aW9uKG0sIGxvY2FsSWQpIHtcbiAgICAgIG1bbG9jYWxJZF0gPSB7fTtcbiAgICAgIHJldHVybiBtO1xuICAgIH0sIHt9KTtcbiAgfSxcbiAgY291bnQ6IGZ1bmN0aW9uKGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIGNiKG51bGwsIE9iamVjdC5rZXlzKHRoaXMuX2NvdW50Q2FjaGUoKSkubGVuZ3RoKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuICBfZHVtcDogZnVuY3Rpb24oYXNKU09OKSB7XG4gICAgdmFyIGR1bXBlZCA9IHt9O1xuICAgIGR1bXBlZC5uYW1lID0gdGhpcy5uYW1lO1xuICAgIGR1bXBlZC5hdHRyaWJ1dGVzID0gdGhpcy5hdHRyaWJ1dGVzO1xuICAgIGR1bXBlZC5pZCA9IHRoaXMuaWQ7XG4gICAgZHVtcGVkLmNvbGxlY3Rpb24gPSB0aGlzLmNvbGxlY3Rpb25OYW1lO1xuICAgIGR1bXBlZC5yZWxhdGlvbnNoaXBzID0gdGhpcy5yZWxhdGlvbnNoaXBzLm1hcChmdW5jdGlvbihyKSB7XG4gICAgICByZXR1cm4gci5pc0ZvcndhcmQgPyByLmZvcndhcmROYW1lIDogci5yZXZlcnNlTmFtZTtcbiAgICB9KTtcbiAgICByZXR1cm4gYXNKU09OID8gdXRpbC5wcmV0dHlQcmludChkdW1wZWQpIDogZHVtcGVkO1xuICB9LFxuICB0b1N0cmluZzogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuICdNb2RlbFsnICsgdGhpcy5uYW1lICsgJ10nO1xuICB9LFxuICByZW1vdmVBbGw6IGZ1bmN0aW9uKGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIHRoaXMuYWxsKClcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24oaW5zdGFuY2VzKSB7XG4gICAgICAgICAgaW5zdGFuY2VzLnJlbW92ZSgpO1xuICAgICAgICAgIGNiKCk7XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChjYik7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfVxuXG59KTtcblxuLy8gU3ViY2xhc3NpbmdcbnV0aWwuZXh0ZW5kKE1vZGVsLnByb3RvdHlwZSwge1xuICBjaGlsZDogZnVuY3Rpb24obmFtZU9yT3B0cywgb3B0cykge1xuICAgIGlmICh0eXBlb2YgbmFtZU9yT3B0cyA9PSAnc3RyaW5nJykge1xuICAgICAgb3B0cy5uYW1lID0gbmFtZU9yT3B0cztcbiAgICB9IGVsc2Uge1xuICAgICAgb3B0cyA9IG5hbWU7XG4gICAgfVxuICAgIHV0aWwuZXh0ZW5kKG9wdHMsIHtcbiAgICAgIGF0dHJpYnV0ZXM6IEFycmF5LnByb3RvdHlwZS5jb25jYXQuY2FsbChvcHRzLmF0dHJpYnV0ZXMgfHwgW10sIHRoaXMuX29wdHMuYXR0cmlidXRlcyksXG4gICAgICByZWxhdGlvbnNoaXBzOiB1dGlsLmV4dGVuZChvcHRzLnJlbGF0aW9uc2hpcHMgfHwge30sIHRoaXMuX29wdHMucmVsYXRpb25zaGlwcyksXG4gICAgICBtZXRob2RzOiB1dGlsLmV4dGVuZCh1dGlsLmV4dGVuZCh7fSwgdGhpcy5fb3B0cy5tZXRob2RzKSB8fCB7fSwgb3B0cy5tZXRob2RzKSxcbiAgICAgIHN0YXRpY3M6IHV0aWwuZXh0ZW5kKHV0aWwuZXh0ZW5kKHt9LCB0aGlzLl9vcHRzLnN0YXRpY3MpIHx8IHt9LCBvcHRzLnN0YXRpY3MpLFxuICAgICAgcHJvcGVydGllczogdXRpbC5leHRlbmQodXRpbC5leHRlbmQoe30sIHRoaXMuX29wdHMucHJvcGVydGllcykgfHwge30sIG9wdHMucHJvcGVydGllcyksXG4gICAgICBpZDogb3B0cy5pZCB8fCB0aGlzLl9vcHRzLmlkLFxuICAgICAgaW5pdDogb3B0cy5pbml0IHx8IHRoaXMuX29wdHMuaW5pdCxcbiAgICAgIHJlbW92ZTogb3B0cy5yZW1vdmUgfHwgdGhpcy5fb3B0cy5yZW1vdmUsXG4gICAgICBzZXJpYWxpc2U6IG9wdHMuc2VyaWFsaXNlIHx8IHRoaXMuX29wdHMuc2VyaWFsaXNlLFxuICAgICAgc2VyaWFsaXNlRmllbGQ6IG9wdHMuc2VyaWFsaXNlRmllbGQgfHwgdGhpcy5fb3B0cy5zZXJpYWxpc2VGaWVsZCxcbiAgICAgIHBhcnNlQXR0cmlidXRlOiBvcHRzLnBhcnNlQXR0cmlidXRlIHx8IHRoaXMuX29wdHMucGFyc2VBdHRyaWJ1dGVcbiAgICB9KTtcblxuICAgIGlmICh0aGlzLl9vcHRzLnNlcmlhbGlzYWJsZUZpZWxkcykge1xuICAgICAgb3B0cy5zZXJpYWxpc2FibGVGaWVsZHMgPSBBcnJheS5wcm90b3R5cGUuY29uY2F0LmFwcGx5KG9wdHMuc2VyaWFsaXNhYmxlRmllbGRzIHx8IFtdLCB0aGlzLl9vcHRzLnNlcmlhbGlzYWJsZUZpZWxkcyk7XG4gICAgfVxuXG4gICAgdmFyIG1vZGVsID0gdGhpcy5jb2xsZWN0aW9uLm1vZGVsKG9wdHMubmFtZSwgb3B0cyk7XG4gICAgbW9kZWwucGFyZW50ID0gdGhpcztcbiAgICB0aGlzLmNoaWxkcmVuLnB1c2gobW9kZWwpO1xuICAgIHJldHVybiBtb2RlbDtcbiAgfSxcbiAgaXNDaGlsZE9mOiBmdW5jdGlvbihwYXJlbnQpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnQgPT0gcGFyZW50O1xuICB9LFxuICBpc1BhcmVudE9mOiBmdW5jdGlvbihjaGlsZCkge1xuICAgIHJldHVybiB0aGlzLmNoaWxkcmVuLmluZGV4T2YoY2hpbGQpID4gLTE7XG4gIH0sXG4gIGlzRGVzY2VuZGFudE9mOiBmdW5jdGlvbihhbmNlc3Rvcikge1xuICAgIHZhciBwYXJlbnQgPSB0aGlzLnBhcmVudDtcbiAgICB3aGlsZSAocGFyZW50KSB7XG4gICAgICBpZiAocGFyZW50ID09IGFuY2VzdG9yKSByZXR1cm4gdHJ1ZTtcbiAgICAgIHBhcmVudCA9IHBhcmVudC5wYXJlbnQ7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfSxcbiAgaXNBbmNlc3Rvck9mOiBmdW5jdGlvbihkZXNjZW5kYW50KSB7XG4gICAgcmV0dXJuIHRoaXMuZGVzY2VuZGFudHMuaW5kZXhPZihkZXNjZW5kYW50KSA+IC0xO1xuICB9LFxuICBoYXNBdHRyaWJ1dGVOYW1lZDogZnVuY3Rpb24oYXR0cmlidXRlTmFtZSkge1xuICAgIHJldHVybiB0aGlzLl9hdHRyaWJ1dGVOYW1lcy5pbmRleE9mKGF0dHJpYnV0ZU5hbWUpID4gLTE7XG4gIH1cbn0pO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gTW9kZWw7XG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9tb2RlbC5qc1xuICoqIG1vZHVsZSBpZCA9IDVcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIi8qKlxuICogVXNlcnMgc2hvdWxkIG5ldmVyIHNlZSB0aGVzZSB0aHJvd24uIEEgYnVnIHJlcG9ydCBzaG91bGQgYmUgZmlsZWQgaWYgc28gYXMgaXQgbWVhbnMgc29tZSBhc3NlcnRpb24gaGFzIGZhaWxlZC5cbiAqIEBwYXJhbSBtZXNzYWdlXG4gKiBAcGFyYW0gY29udGV4dFxuICogQHBhcmFtIHNzZlxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIEludGVybmFsU2llc3RhRXJyb3IobWVzc2FnZSwgY29udGV4dCwgc3NmKSB7XG4gIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG4gIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gIC8vIGNhcHR1cmUgc3RhY2sgdHJhY2VcbiAgaWYgKHNzZiAmJiBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSkge1xuICAgIEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKHRoaXMsIHNzZik7XG4gIH1cbn1cblxuSW50ZXJuYWxTaWVzdGFFcnJvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEVycm9yLnByb3RvdHlwZSk7XG5JbnRlcm5hbFNpZXN0YUVycm9yLnByb3RvdHlwZS5uYW1lID0gJ0ludGVybmFsU2llc3RhRXJyb3InO1xuSW50ZXJuYWxTaWVzdGFFcnJvci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBJbnRlcm5hbFNpZXN0YUVycm9yO1xuXG5mdW5jdGlvbiBpc1NpZXN0YUVycm9yKGVycikge1xuICBpZiAodHlwZW9mIGVyciA9PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiAnZXJyb3InIGluIGVyciAmJiAnb2snIGluIGVyciAmJiAncmVhc29uJyBpbiBlcnI7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGVyck1lc3NhZ2UsIGV4dHJhKSB7XG4gIGlmIChpc1NpZXN0YUVycm9yKGVyck1lc3NhZ2UpKSB7XG4gICAgcmV0dXJuIGVyck1lc3NhZ2U7XG4gIH1cbiAgdmFyIGVyciA9IHtcbiAgICByZWFzb246IGVyck1lc3NhZ2UsXG4gICAgZXJyb3I6IHRydWUsXG4gICAgb2s6IGZhbHNlXG4gIH07XG4gIGZvciAodmFyIHByb3AgaW4gZXh0cmEgfHwge30pIHtcbiAgICBpZiAoZXh0cmEuaGFzT3duUHJvcGVydHkocHJvcCkpIGVycltwcm9wXSA9IGV4dHJhW3Byb3BdO1xuICB9XG4gIGVyci50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh0aGlzKTtcbiAgfTtcbiAgcmV0dXJuIGVycjtcbn07XG5cbm1vZHVsZS5leHBvcnRzLkludGVybmFsU2llc3RhRXJyb3IgPSBJbnRlcm5hbFNpZXN0YUVycm9yO1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL2Vycm9yLmpzXG4gKiogbW9kdWxlIGlkID0gNlxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcixcbiAgQXJyYXlPYnNlcnZlciA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuQXJyYXlPYnNlcnZlcixcbiAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICBhcmdzYXJyYXkgPSByZXF1aXJlKCdhcmdzYXJyYXknKSxcbiAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gIENoYWluID0gcmVxdWlyZSgnLi9DaGFpbicpO1xuXG52YXIgZXZlbnRFbWl0dGVyID0gbmV3IEV2ZW50RW1pdHRlcigpO1xuZXZlbnRFbWl0dGVyLnNldE1heExpc3RlbmVycygxMDApO1xuXG4vKipcbiAqIExpc3RlbiB0byBhIHBhcnRpY3VsYXIgZXZlbnQgZnJvbSB0aGUgU2llc3RhIGdsb2JhbCBFdmVudEVtaXR0ZXIuXG4gKiBNYW5hZ2VzIGl0cyBvd24gc2V0IG9mIGxpc3RlbmVycy5cbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBQcm94eUV2ZW50RW1pdHRlcihldmVudCwgY2hhaW5PcHRzKSB7XG4gIHV0aWwuZXh0ZW5kKHRoaXMsIHtcbiAgICBldmVudDogZXZlbnQsXG4gICAgbGlzdGVuZXJzOiB7fVxuICB9KTtcbiAgdmFyIGRlZmF1bHRDaGFpbk9wdHMgPSB7fTtcblxuICBkZWZhdWx0Q2hhaW5PcHRzLm9uID0gdGhpcy5vbi5iaW5kKHRoaXMpO1xuICBkZWZhdWx0Q2hhaW5PcHRzLm9uY2UgPSB0aGlzLm9uY2UuYmluZCh0aGlzKTtcblxuICBDaGFpbi5jYWxsKHRoaXMsIHV0aWwuZXh0ZW5kKGRlZmF1bHRDaGFpbk9wdHMsIGNoYWluT3B0cyB8fCB7fSkpO1xufVxuXG5Qcm94eUV2ZW50RW1pdHRlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKENoYWluLnByb3RvdHlwZSk7XG5cbnV0aWwuZXh0ZW5kKFByb3h5RXZlbnRFbWl0dGVyLnByb3RvdHlwZSwge1xuICBvbjogZnVuY3Rpb24odHlwZSwgZm4pIHtcbiAgICBpZiAodHlwZW9mIHR5cGUgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgZm4gPSB0eXBlO1xuICAgICAgdHlwZSA9IG51bGw7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgaWYgKHR5cGUudHJpbSgpID09ICcqJykgdHlwZSA9IG51bGw7XG4gICAgICB2YXIgX2ZuID0gZm47XG4gICAgICBmbiA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgZSA9IGUgfHwge307XG4gICAgICAgIGlmICh0eXBlKSB7XG4gICAgICAgICAgaWYgKGUudHlwZSA9PSB0eXBlKSB7XG4gICAgICAgICAgICBfZm4oZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIF9mbihlKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIHZhciBsaXN0ZW5lcnMgPSB0aGlzLmxpc3RlbmVycztcbiAgICAgIGlmICh0eXBlKSB7XG4gICAgICAgIGlmICghbGlzdGVuZXJzW3R5cGVdKSBsaXN0ZW5lcnNbdHlwZV0gPSBbXTtcbiAgICAgICAgbGlzdGVuZXJzW3R5cGVdLnB1c2goZm4pO1xuICAgICAgfVxuICAgIH1cbiAgICBldmVudEVtaXR0ZXIub24odGhpcy5ldmVudCwgZm4pO1xuICAgIHJldHVybiB0aGlzLl9oYW5kbGVyTGluayh7XG4gICAgICBmbjogZm4sXG4gICAgICB0eXBlOiB0eXBlLFxuICAgICAgZXh0ZW5kOiB0aGlzLnByb3h5Q2hhaW5PcHRzXG4gICAgfSk7XG4gIH0sXG4gIG9uY2U6IGZ1bmN0aW9uKHR5cGUsIGZuKSB7XG4gICAgdmFyIGV2ZW50ID0gdGhpcy5ldmVudDtcbiAgICBpZiAodHlwZW9mIHR5cGUgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgZm4gPSB0eXBlO1xuICAgICAgdHlwZSA9IG51bGw7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgaWYgKHR5cGUudHJpbSgpID09ICcqJykgdHlwZSA9IG51bGw7XG4gICAgICB2YXIgX2ZuID0gZm47XG4gICAgICBmbiA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgZSA9IGUgfHwge307XG4gICAgICAgIGlmICh0eXBlKSB7XG4gICAgICAgICAgaWYgKGUudHlwZSA9PSB0eXBlKSB7XG4gICAgICAgICAgICBldmVudEVtaXR0ZXIucmVtb3ZlTGlzdGVuZXIoZXZlbnQsIGZuKTtcbiAgICAgICAgICAgIF9mbihlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgX2ZuKGUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0eXBlKSByZXR1cm4gZXZlbnRFbWl0dGVyLm9uKGV2ZW50LCBmbik7XG4gICAgZWxzZSByZXR1cm4gZXZlbnRFbWl0dGVyLm9uY2UoZXZlbnQsIGZuKTtcbiAgfSxcbiAgX3JlbW92ZUxpc3RlbmVyOiBmdW5jdGlvbihmbiwgdHlwZSkge1xuICAgIGlmICh0eXBlKSB7XG4gICAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5saXN0ZW5lcnNbdHlwZV0sXG4gICAgICAgIGlkeCA9IGxpc3RlbmVycy5pbmRleE9mKGZuKTtcbiAgICAgIGxpc3RlbmVycy5zcGxpY2UoaWR4LCAxKTtcbiAgICB9XG4gICAgcmV0dXJuIGV2ZW50RW1pdHRlci5yZW1vdmVMaXN0ZW5lcih0aGlzLmV2ZW50LCBmbik7XG4gIH0sXG4gIGVtaXQ6IGZ1bmN0aW9uKHR5cGUsIHBheWxvYWQpIHtcbiAgICBpZiAodHlwZW9mIHR5cGUgPT0gJ29iamVjdCcpIHtcbiAgICAgIHBheWxvYWQgPSB0eXBlO1xuICAgICAgdHlwZSA9IG51bGw7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgcGF5bG9hZCA9IHBheWxvYWQgfHwge307XG4gICAgICBwYXlsb2FkLnR5cGUgPSB0eXBlO1xuICAgIH1cbiAgICBldmVudEVtaXR0ZXIuZW1pdC5jYWxsKGV2ZW50RW1pdHRlciwgdGhpcy5ldmVudCwgcGF5bG9hZCk7XG4gIH0sXG4gIF9yZW1vdmVBbGxMaXN0ZW5lcnM6IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICAodGhpcy5saXN0ZW5lcnNbdHlwZV0gfHwgW10pLmZvckVhY2goZnVuY3Rpb24oZm4pIHtcbiAgICAgIGV2ZW50RW1pdHRlci5yZW1vdmVMaXN0ZW5lcih0aGlzLmV2ZW50LCBmbik7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLmxpc3RlbmVyc1t0eXBlXSA9IFtdO1xuICB9LFxuICByZW1vdmVBbGxMaXN0ZW5lcnM6IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICBpZiAodHlwZSkge1xuICAgICAgdGhpcy5fcmVtb3ZlQWxsTGlzdGVuZXJzKHR5cGUpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGZvciAodHlwZSBpbiB0aGlzLmxpc3RlbmVycykge1xuICAgICAgICBpZiAodGhpcy5saXN0ZW5lcnMuaGFzT3duUHJvcGVydHkodHlwZSkpIHtcbiAgICAgICAgICB0aGlzLl9yZW1vdmVBbGxMaXN0ZW5lcnModHlwZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn0pO1xuXG51dGlsLmV4dGVuZChldmVudEVtaXR0ZXIsIHtcbiAgUHJveHlFdmVudEVtaXR0ZXI6IFByb3h5RXZlbnRFbWl0dGVyLFxuICB3cmFwQXJyYXk6IGZ1bmN0aW9uKGFycmF5LCBmaWVsZCwgbW9kZWxJbnN0YW5jZSkge1xuICAgIGlmICghYXJyYXkub2JzZXJ2ZXIpIHtcbiAgICAgIGFycmF5Lm9ic2VydmVyID0gbmV3IEFycmF5T2JzZXJ2ZXIoYXJyYXkpO1xuICAgICAgYXJyYXkub2JzZXJ2ZXIub3BlbihmdW5jdGlvbihzcGxpY2VzKSB7XG4gICAgICAgIHZhciBmaWVsZElzQXR0cmlidXRlID0gbW9kZWxJbnN0YW5jZS5fYXR0cmlidXRlTmFtZXMuaW5kZXhPZihmaWVsZCkgPiAtMTtcbiAgICAgICAgaWYgKGZpZWxkSXNBdHRyaWJ1dGUpIHtcbiAgICAgICAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24oc3BsaWNlKSB7XG4gICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgICAgY29sbGVjdGlvbjogbW9kZWxJbnN0YW5jZS5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgbW9kZWw6IG1vZGVsSW5zdGFuY2UubW9kZWwubmFtZSxcbiAgICAgICAgICAgICAgbG9jYWxJZDogbW9kZWxJbnN0YW5jZS5sb2NhbElkLFxuICAgICAgICAgICAgICBpbmRleDogc3BsaWNlLmluZGV4LFxuICAgICAgICAgICAgICByZW1vdmVkOiBzcGxpY2UucmVtb3ZlZCxcbiAgICAgICAgICAgICAgYWRkZWQ6IHNwbGljZS5hZGRlZENvdW50ID8gYXJyYXkuc2xpY2Uoc3BsaWNlLmluZGV4LCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkgOiBbXSxcbiAgICAgICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgICBmaWVsZDogZmllbGQsXG4gICAgICAgICAgICAgIG9iajogbW9kZWxJbnN0YW5jZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufSk7XG5cbnZhciBvbGRFbWl0ID0gZXZlbnRFbWl0dGVyLmVtaXQ7XG5cbi8vIEVuc3VyZSB0aGF0IGVycm9ycyBpbiBldmVudCBoYW5kbGVycyBkbyBub3Qgc3RhbGwgU2llc3RhLlxuZXZlbnRFbWl0dGVyLmVtaXQgPSBmdW5jdGlvbihldmVudCwgcGF5bG9hZCkge1xuICB0cnkge1xuICAgIG9sZEVtaXQuY2FsbChldmVudEVtaXR0ZXIsIGV2ZW50LCBwYXlsb2FkKTtcbiAgfVxuICBjYXRjaCAoZSkge1xuICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZXZlbnRFbWl0dGVyO1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL2V2ZW50cy5qc1xuICoqIG1vZHVsZSBpZCA9IDdcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIm1vZHVsZS5leHBvcnRzID0ge1xuICBPbmVUb01hbnk6ICdPbmVUb01hbnknLFxuICBPbmVUb09uZTogJ09uZVRvT25lJyxcbiAgTWFueVRvTWFueTogJ01hbnlUb01hbnknXG59O1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL1JlbGF0aW9uc2hpcFR5cGUuanNcbiAqKiBtb2R1bGUgaWQgPSA4XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCIvKipcbiAqIEZvciB0aG9zZSBmYW1pbGlhciB3aXRoIEFwcGxlJ3MgQ29jb2EgbGlicmFyeSwgcmVhY3RpdmUgcXVlcmllcyByb3VnaGx5IG1hcCBvbnRvIE5TRmV0Y2hlZFJlc3VsdHNDb250cm9sbGVyLlxuICpcbiAqIFRoZXkgcHJlc2VudCBhIHF1ZXJ5IHNldCB0aGF0ICdyZWFjdHMnIHRvIGNoYW5nZXMgaW4gdGhlIHVuZGVybHlpbmcgZGF0YS5cbiAqIEBtb2R1bGUgcmVhY3RpdmVRdWVyeVxuICovXG5cbnZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdxdWVyeTpyZWFjdGl2ZScpLFxuICBRdWVyeSA9IHJlcXVpcmUoJy4vUXVlcnknKSxcbiAgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyLFxuICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICBDaGFpbiA9IHJlcXVpcmUoJy4vQ2hhaW4nKSxcbiAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgY29uc3RydWN0UXVlcnlTZXQgPSByZXF1aXJlKCcuL1F1ZXJ5U2V0JyksXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuLyoqXG4gKlxuICogQHBhcmFtIHtRdWVyeX0gcXVlcnkgLSBUaGUgdW5kZXJseWluZyBxdWVyeVxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIFJlYWN0aXZlUXVlcnkocXVlcnkpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcbiAgQ2hhaW4uY2FsbCh0aGlzKTtcbiAgdXRpbC5leHRlbmQodGhpcywge1xuICAgIGluc2VydGlvblBvbGljeTogUmVhY3RpdmVRdWVyeS5JbnNlcnRpb25Qb2xpY3kuQmFjayxcbiAgICBpbml0aWFsaXNlZDogZmFsc2VcbiAgfSk7XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdxdWVyeScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3F1ZXJ5XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKHYpIHtcbiAgICAgIGlmICh2KSB7XG4gICAgICAgIHRoaXMuX3F1ZXJ5ID0gdjtcbiAgICAgICAgdGhpcy5yZXN1bHRzID0gY29uc3RydWN0UXVlcnlTZXQoW10sIHYubW9kZWwpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHRoaXMuX3F1ZXJ5ID0gbnVsbDtcbiAgICAgICAgdGhpcy5yZXN1bHRzID0gbnVsbDtcbiAgICAgIH1cbiAgICB9LFxuICAgIGNvbmZpZ3VyYWJsZTogZmFsc2UsXG4gICAgZW51bWVyYWJsZTogdHJ1ZVxuICB9KTtcblxuICBpZiAocXVlcnkpIHtcbiAgICB1dGlsLmV4dGVuZCh0aGlzLCB7XG4gICAgICBfcXVlcnk6IHF1ZXJ5LFxuICAgICAgcmVzdWx0czogY29uc3RydWN0UXVlcnlTZXQoW10sIHF1ZXJ5Lm1vZGVsKVxuICAgIH0pXG4gIH1cblxuICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0aGlzLCB7XG4gICAgaW5pdGlhbGl6ZWQ6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmluaXRpYWxpc2VkXG4gICAgICB9XG4gICAgfSxcbiAgICBtb2RlbDoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHF1ZXJ5ID0gc2VsZi5fcXVlcnk7XG4gICAgICAgIGlmIChxdWVyeSkge1xuICAgICAgICAgIHJldHVybiBxdWVyeS5tb2RlbFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgICBjb2xsZWN0aW9uOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gc2VsZi5tb2RlbC5jb2xsZWN0aW9uTmFtZVxuICAgICAgfVxuICAgIH1cbiAgfSk7XG5cblxufVxuXG5SZWFjdGl2ZVF1ZXJ5LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRXZlbnRFbWl0dGVyLnByb3RvdHlwZSk7XG51dGlsLmV4dGVuZChSZWFjdGl2ZVF1ZXJ5LnByb3RvdHlwZSwgQ2hhaW4ucHJvdG90eXBlKTtcblxudXRpbC5leHRlbmQoUmVhY3RpdmVRdWVyeSwge1xuICBJbnNlcnRpb25Qb2xpY3k6IHtcbiAgICBGcm9udDogJ0Zyb250JyxcbiAgICBCYWNrOiAnQmFjaydcbiAgfVxufSk7XG5cbnV0aWwuZXh0ZW5kKFJlYWN0aXZlUXVlcnkucHJvdG90eXBlLCB7XG4gIC8qKlxuICAgKlxuICAgKiBAcGFyYW0gY2JcbiAgICogQHBhcmFtIHtib29sfSBfaWdub3JlSW5pdCAtIGV4ZWN1dGUgcXVlcnkgYWdhaW4sIGluaXRpYWxpc2VkIG9yIG5vdC5cbiAgICogQHJldHVybnMgeyp9XG4gICAqL1xuICBpbml0OiBmdW5jdGlvbihjYiwgX2lnbm9yZUluaXQpIHtcbiAgICBpZiAodGhpcy5fcXVlcnkpIHtcbiAgICAgIHZhciBuYW1lID0gdGhpcy5fY29uc3RydWN0Tm90aWZpY2F0aW9uTmFtZSgpO1xuICAgICAgdmFyIGhhbmRsZXIgPSBmdW5jdGlvbihuKSB7XG4gICAgICAgIHRoaXMuX2hhbmRsZU5vdGlmKG4pO1xuICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgdGhpcy5oYW5kbGVyID0gaGFuZGxlcjtcbiAgICAgIGV2ZW50cy5vbihuYW1lLCBoYW5kbGVyKTtcbiAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgIGlmICgoIXRoaXMuaW5pdGlhbGlzZWQpIHx8IF9pZ25vcmVJbml0KSB7XG4gICAgICAgICAgdGhpcy5fcXVlcnkuZXhlY3V0ZShmdW5jdGlvbihlcnIsIHJlc3VsdHMpIHtcbiAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgIGNiKG51bGwsIHRoaXMuX2FwcGx5UmVzdWx0cyhyZXN1bHRzKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGNiKG51bGwsIHRoaXMucmVzdWx0cyk7XG4gICAgICAgIH1cbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuICAgIGVsc2UgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ05vIF9xdWVyeSBkZWZpbmVkJyk7XG4gIH0sXG4gIF9hcHBseVJlc3VsdHM6IGZ1bmN0aW9uKHJlc3VsdHMpIHtcbiAgICB0aGlzLnJlc3VsdHMgPSByZXN1bHRzO1xuICAgIHRoaXMuaW5pdGlhbGlzZWQgPSB0cnVlO1xuICAgIHJldHVybiB0aGlzLnJlc3VsdHM7XG4gIH0sXG4gIGluc2VydDogZnVuY3Rpb24obmV3T2JqKSB7XG4gICAgdmFyIHJlc3VsdHMgPSB0aGlzLnJlc3VsdHMubXV0YWJsZUNvcHkoKTtcbiAgICBpZiAodGhpcy5pbnNlcnRpb25Qb2xpY3kgPT0gUmVhY3RpdmVRdWVyeS5JbnNlcnRpb25Qb2xpY3kuQmFjaykgdmFyIGlkeCA9IHJlc3VsdHMucHVzaChuZXdPYmopO1xuICAgIGVsc2UgaWR4ID0gcmVzdWx0cy51bnNoaWZ0KG5ld09iaik7XG4gICAgdGhpcy5yZXN1bHRzID0gcmVzdWx0cy5hc01vZGVsUXVlcnlTZXQodGhpcy5tb2RlbCk7XG4gICAgcmV0dXJuIGlkeDtcbiAgfSxcbiAgLyoqXG4gICAqIEV4ZWN1dGUgdGhlIHVuZGVybHlpbmcgcXVlcnkgYWdhaW4uXG4gICAqIEBwYXJhbSBjYlxuICAgKi9cbiAgdXBkYXRlOiBmdW5jdGlvbihjYikge1xuICAgIHJldHVybiB0aGlzLmluaXQoY2IsIHRydWUpXG4gIH0sXG4gIF9oYW5kbGVOb3RpZjogZnVuY3Rpb24obikge1xuICAgIGlmIChuLnR5cGUgPT0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuTmV3KSB7XG4gICAgICB2YXIgbmV3T2JqID0gbi5uZXc7XG4gICAgICBpZiAodGhpcy5fcXVlcnkub2JqZWN0TWF0Y2hlc1F1ZXJ5KG5ld09iaikpIHtcbiAgICAgICAgbG9nKCdOZXcgb2JqZWN0IG1hdGNoZXMnLCBuZXdPYmopO1xuICAgICAgICB2YXIgaWR4ID0gdGhpcy5pbnNlcnQobmV3T2JqKTtcbiAgICAgICAgdGhpcy5lbWl0KG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSwge1xuICAgICAgICAgIGluZGV4OiBpZHgsXG4gICAgICAgICAgYWRkZWQ6IFtuZXdPYmpdLFxuICAgICAgICAgIHR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICBvYmo6IHRoaXNcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgbG9nKCdOZXcgb2JqZWN0IGRvZXMgbm90IG1hdGNoJywgbmV3T2JqKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSBpZiAobi50eXBlID09IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNldCkge1xuICAgICAgbmV3T2JqID0gbi5vYmo7XG4gICAgICB2YXIgaW5kZXggPSB0aGlzLnJlc3VsdHMuaW5kZXhPZihuZXdPYmopLFxuICAgICAgICBhbHJlYWR5Q29udGFpbnMgPSBpbmRleCA+IC0xLFxuICAgICAgICBtYXRjaGVzID0gdGhpcy5fcXVlcnkub2JqZWN0TWF0Y2hlc1F1ZXJ5KG5ld09iaik7XG4gICAgICBpZiAobWF0Y2hlcyAmJiAhYWxyZWFkeUNvbnRhaW5zKSB7XG4gICAgICAgIGxvZygnVXBkYXRlZCBvYmplY3Qgbm93IG1hdGNoZXMhJywgbmV3T2JqKTtcbiAgICAgICAgaWR4ID0gdGhpcy5pbnNlcnQobmV3T2JqKTtcbiAgICAgICAgdGhpcy5lbWl0KG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSwge1xuICAgICAgICAgIGluZGV4OiBpZHgsXG4gICAgICAgICAgYWRkZWQ6IFtuZXdPYmpdLFxuICAgICAgICAgIHR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICBvYmo6IHRoaXNcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIGlmICghbWF0Y2hlcyAmJiBhbHJlYWR5Q29udGFpbnMpIHtcbiAgICAgICAgbG9nKCdVcGRhdGVkIG9iamVjdCBubyBsb25nZXIgbWF0Y2hlcyEnLCBuZXdPYmopO1xuICAgICAgICByZXN1bHRzID0gdGhpcy5yZXN1bHRzLm11dGFibGVDb3B5KCk7XG4gICAgICAgIHZhciByZW1vdmVkID0gcmVzdWx0cy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB0aGlzLnJlc3VsdHMgPSByZXN1bHRzLmFzTW9kZWxRdWVyeVNldCh0aGlzLm1vZGVsKTtcbiAgICAgICAgdGhpcy5lbWl0KG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSwge1xuICAgICAgICAgIGluZGV4OiBpbmRleCxcbiAgICAgICAgICBvYmo6IHRoaXMsXG4gICAgICAgICAgbmV3OiBuZXdPYmosXG4gICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgIHJlbW92ZWQ6IHJlbW92ZWRcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIGlmICghbWF0Y2hlcyAmJiAhYWxyZWFkeUNvbnRhaW5zKSB7XG4gICAgICAgIGxvZygnRG9lcyBub3QgY29udGFpbiwgYnV0IGRvZXNudCBtYXRjaCBzbyBub3QgaW5zZXJ0aW5nJywgbmV3T2JqKTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKG1hdGNoZXMgJiYgYWxyZWFkeUNvbnRhaW5zKSB7XG4gICAgICAgIGxvZygnTWF0Y2hlcyBidXQgYWxyZWFkeSBjb250YWlucycsIG5ld09iaik7XG4gICAgICAgIC8vIFNlbmQgdGhlIG5vdGlmaWNhdGlvbiBvdmVyLlxuICAgICAgICB0aGlzLmVtaXQobi50eXBlLCBuKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSBpZiAobi50eXBlID09IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlJlbW92ZSkge1xuICAgICAgbmV3T2JqID0gbi5vYmo7XG4gICAgICB2YXIgcmVzdWx0cyA9IHRoaXMucmVzdWx0cy5tdXRhYmxlQ29weSgpO1xuICAgICAgaW5kZXggPSByZXN1bHRzLmluZGV4T2YobmV3T2JqKTtcbiAgICAgIGlmIChpbmRleCA+IC0xKSB7XG4gICAgICAgIGxvZygnUmVtb3Zpbmcgb2JqZWN0JywgbmV3T2JqKTtcbiAgICAgICAgcmVtb3ZlZCA9IHJlc3VsdHMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgdGhpcy5yZXN1bHRzID0gY29uc3RydWN0UXVlcnlTZXQocmVzdWx0cywgdGhpcy5tb2RlbCk7XG4gICAgICAgIHRoaXMuZW1pdChtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5TcGxpY2UsIHtcbiAgICAgICAgICBpbmRleDogaW5kZXgsXG4gICAgICAgICAgb2JqOiB0aGlzLFxuICAgICAgICAgIHR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICByZW1vdmVkOiByZW1vdmVkXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGxvZygnTm8gbW9kZWxFdmVudHMgbmVjY2Vzc2FyeS4nLCBuZXdPYmopO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdVbmtub3duIGNoYW5nZSB0eXBlIFwiJyArIG4udHlwZS50b1N0cmluZygpICsgJ1wiJylcbiAgICB9XG4gICAgdGhpcy5yZXN1bHRzID0gY29uc3RydWN0UXVlcnlTZXQodGhpcy5fcXVlcnkuX3NvcnRSZXN1bHRzKHRoaXMucmVzdWx0cyksIHRoaXMubW9kZWwpO1xuICB9LFxuICBfY29uc3RydWN0Tm90aWZpY2F0aW9uTmFtZTogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY29sbGVjdGlvbk5hbWUgKyAnOicgKyB0aGlzLm1vZGVsLm5hbWU7XG4gIH0sXG4gIHRlcm1pbmF0ZTogZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMuaGFuZGxlcikge1xuICAgICAgZXZlbnRzLnJlbW92ZUxpc3RlbmVyKHRoaXMuX2NvbnN0cnVjdE5vdGlmaWNhdGlvbk5hbWUoKSwgdGhpcy5oYW5kbGVyKTtcbiAgICB9XG4gICAgdGhpcy5yZXN1bHRzID0gbnVsbDtcbiAgICB0aGlzLmhhbmRsZXIgPSBudWxsO1xuICB9LFxuICBfcmVnaXN0ZXJFdmVudEhhbmRsZXI6IGZ1bmN0aW9uKG9uLCBuYW1lLCBmbikge1xuICAgIHZhciByZW1vdmVMaXN0ZW5lciA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXI7XG4gICAgaWYgKG5hbWUudHJpbSgpID09ICcqJykge1xuICAgICAgT2JqZWN0LmtleXMobW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUpLmZvckVhY2goZnVuY3Rpb24oaykge1xuICAgICAgICBvbi5jYWxsKHRoaXMsIG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlW2tdLCBmbik7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIG9uLmNhbGwodGhpcywgbmFtZSwgZm4pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fbGluayh7XG4gICAgICAgIG9uOiB0aGlzLm9uLmJpbmQodGhpcyksXG4gICAgICAgIG9uY2U6IHRoaXMub25jZS5iaW5kKHRoaXMpLFxuICAgICAgICB1cGRhdGU6IHRoaXMudXBkYXRlLmJpbmQodGhpcyksXG4gICAgICAgIGluc2VydDogdGhpcy5pbnNlcnQuYmluZCh0aGlzKVxuICAgICAgfSxcbiAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAobmFtZS50cmltKCkgPT0gJyonKSB7XG4gICAgICAgICAgT2JqZWN0LmtleXMobW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUpLmZvckVhY2goZnVuY3Rpb24oaykge1xuICAgICAgICAgICAgcmVtb3ZlTGlzdGVuZXIuY2FsbCh0aGlzLCBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZVtrXSwgZm4pO1xuICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgcmVtb3ZlTGlzdGVuZXIuY2FsbCh0aGlzLCBuYW1lLCBmbik7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gIH0sXG4gIG9uOiBmdW5jdGlvbihuYW1lLCBmbikge1xuICAgIHJldHVybiB0aGlzLl9yZWdpc3RlckV2ZW50SGFuZGxlcihFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uLCBuYW1lLCBmbik7XG4gIH0sXG4gIG9uY2U6IGZ1bmN0aW9uKG5hbWUsIGZuKSB7XG4gICAgcmV0dXJuIHRoaXMuX3JlZ2lzdGVyRXZlbnRIYW5kbGVyKEV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSwgbmFtZSwgZm4pO1xuICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBSZWFjdGl2ZVF1ZXJ5O1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL1JlYWN0aXZlUXVlcnkuanNcbiAqKiBtb2R1bGUgaWQgPSA5XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCIvKipcbiAqIEBtb2R1bGUgcmVsYXRpb25zaGlwc1xuICovXG5cbnZhciBSZWxhdGlvbnNoaXBQcm94eSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwUHJveHknKSxcbiAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyA9IGV2ZW50cy53cmFwQXJyYXksXG4gIEFycmF5T2JzZXJ2ZXIgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLkFycmF5T2JzZXJ2ZXIsXG4gIE1vZGVsRXZlbnRUeXBlID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLk1vZGVsRXZlbnRUeXBlO1xuXG4vKipcbiAqIFtNYW55VG9NYW55UHJveHkgZGVzY3JpcHRpb25dXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICovXG5mdW5jdGlvbiBNYW55VG9NYW55UHJveHkob3B0cykge1xuICBSZWxhdGlvbnNoaXBQcm94eS5jYWxsKHRoaXMsIG9wdHMpO1xuICB0aGlzLnJlbGF0ZWQgPSBbXTtcbiAgdGhpcy5yZWxhdGVkQ2FuY2VsTGlzdGVuZXJzID0ge307XG4gIGlmICh0aGlzLmlzUmV2ZXJzZSkge1xuICAgIHRoaXMucmVsYXRlZCA9IFtdO1xuICAgIC8vdGhpcy5mb3J3YXJkTW9kZWwub24obW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuUmVtb3ZlLCBmdW5jdGlvbihlKSB7XG4gICAgLy8gIGlmIChlLmZpZWxkID09IGUuZm9yd2FyZE5hbWUpIHtcbiAgICAvLyAgICB2YXIgaWR4ID0gdGhpcy5yZWxhdGVkLmluZGV4T2YoZS5vYmopO1xuICAgIC8vICAgIGlmIChpZHggPiAtMSkge1xuICAgIC8vICAgICAgdmFyIHJlbW92ZWQgPSB0aGlzLnJlbGF0ZWQuc3BsaWNlKGlkeCwgMSk7XG4gICAgLy8gICAgfVxuICAgIC8vICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgIC8vICAgICAgY29sbGVjdGlvbjogdGhpcy5yZXZlcnNlTW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgLy8gICAgICBtb2RlbDogdGhpcy5yZXZlcnNlTW9kZWwubmFtZSxcbiAgICAvLyAgICAgIGxvY2FsSWQ6IHRoaXMub2JqZWN0LmxvY2FsSWQsXG4gICAgLy8gICAgICBmaWVsZDogdGhpcy5yZXZlcnNlTmFtZSxcbiAgICAvLyAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgLy8gICAgICBhZGRlZDogW10sXG4gICAgLy8gICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgLy8gICAgICBpbmRleDogaWR4LFxuICAgIC8vICAgICAgb2JqOiB0aGlzLm9iamVjdFxuICAgIC8vICAgIH0pO1xuICAgIC8vICB9XG4gICAgLy99LmJpbmQodGhpcykpO1xuICB9XG59XG5cbk1hbnlUb01hbnlQcm94eS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSk7XG5cbnV0aWwuZXh0ZW5kKE1hbnlUb01hbnlQcm94eS5wcm90b3R5cGUsIHtcbiAgY2xlYXJSZXZlcnNlOiBmdW5jdGlvbihyZW1vdmVkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJlbW92ZWQuZm9yRWFjaChmdW5jdGlvbihyZW1vdmVkT2JqZWN0KSB7XG4gICAgICB2YXIgcmV2ZXJzZVByb3h5ID0gc2VsZi5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZShyZW1vdmVkT2JqZWN0KTtcbiAgICAgIHZhciBpZHggPSByZXZlcnNlUHJveHkucmVsYXRlZC5pbmRleE9mKHNlbGYub2JqZWN0KTtcbiAgICAgIHJldmVyc2VQcm94eS5tYWtlQ2hhbmdlc1RvUmVsYXRlZFdpdGhvdXRPYnNlcnZhdGlvbnMoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldmVyc2VQcm94eS5zcGxpY2UoaWR4LCAxKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9LFxuICBzZXRSZXZlcnNlT2ZBZGRlZDogZnVuY3Rpb24oYWRkZWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgYWRkZWQuZm9yRWFjaChmdW5jdGlvbihhZGRlZE9iamVjdCkge1xuICAgICAgdmFyIHJldmVyc2VQcm94eSA9IHNlbGYucmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2UoYWRkZWRPYmplY3QpO1xuICAgICAgcmV2ZXJzZVByb3h5Lm1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9ucyhmdW5jdGlvbigpIHtcbiAgICAgICAgcmV2ZXJzZVByb3h5LnNwbGljZSgwLCAwLCBzZWxmLm9iamVjdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSxcbiAgd3JhcEFycmF5OiBmdW5jdGlvbihhcnIpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyhhcnIsIHRoaXMucmV2ZXJzZU5hbWUsIHRoaXMub2JqZWN0KTtcbiAgICBpZiAoIWFyci5hcnJheU9ic2VydmVyKSB7XG4gICAgICBhcnIuYXJyYXlPYnNlcnZlciA9IG5ldyBBcnJheU9ic2VydmVyKGFycik7XG4gICAgICB2YXIgb2JzZXJ2ZXJGdW5jdGlvbiA9IGZ1bmN0aW9uKHNwbGljZXMpIHtcbiAgICAgICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uKHNwbGljZSkge1xuICAgICAgICAgIHZhciBhZGRlZCA9IHNwbGljZS5hZGRlZENvdW50ID8gYXJyLnNsaWNlKHNwbGljZS5pbmRleCwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQpIDogW107XG4gICAgICAgICAgdmFyIHJlbW92ZWQgPSBzcGxpY2UucmVtb3ZlZDtcbiAgICAgICAgICBzZWxmLmNsZWFyUmV2ZXJzZShyZW1vdmVkKTtcbiAgICAgICAgICBzZWxmLnNldFJldmVyc2VPZkFkZGVkKGFkZGVkKTtcbiAgICAgICAgICB2YXIgbW9kZWwgPSBzZWxmLmdldEZvcndhcmRNb2RlbCgpO1xuICAgICAgICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgICAgICAgY29sbGVjdGlvbjogbW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICBtb2RlbDogbW9kZWwubmFtZSxcbiAgICAgICAgICAgIGxvY2FsSWQ6IHNlbGYub2JqZWN0LmxvY2FsSWQsXG4gICAgICAgICAgICBmaWVsZDogc2VsZi5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgICAgICAgcmVtb3ZlZDogcmVtb3ZlZCxcbiAgICAgICAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgIGluZGV4OiBzcGxpY2UuaW5kZXgsXG4gICAgICAgICAgICBvYmo6IHNlbGYub2JqZWN0XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfTtcbiAgICAgIGFyci5hcnJheU9ic2VydmVyLm9wZW4ob2JzZXJ2ZXJGdW5jdGlvbik7XG4gICAgfVxuICB9LFxuICBnZXQ6IGZ1bmN0aW9uKGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIGNiKG51bGwsIHRoaXMucmVsYXRlZCk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgdmFsaWRhdGU6IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSAhPSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICByZXR1cm4gJ0Nhbm5vdCBhc3NpZ24gc2NhbGFyIHRvIG1hbnkgdG8gbWFueSc7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuICBzZXQ6IGZ1bmN0aW9uKG9iaiwgb3B0cykge1xuICAgIHRoaXMuY2hlY2tJbnN0YWxsZWQoKTtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKG9iaikge1xuICAgICAgdmFyIGVycm9yTWVzc2FnZTtcbiAgICAgIGlmIChlcnJvck1lc3NhZ2UgPSB0aGlzLnZhbGlkYXRlKG9iaikpIHtcbiAgICAgICAgcmV0dXJuIGVycm9yTWVzc2FnZTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB0aGlzLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkKG9iaiwgb3B0cyk7XG4gICAgICAgIHRoaXMud3JhcEFycmF5KG9iaik7XG4gICAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkUmV2ZXJzZShvYmosIG9wdHMpO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHRoaXMuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkKG9iaiwgb3B0cyk7XG4gICAgfVxuICB9LFxuICBpbnN0YWxsOiBmdW5jdGlvbihvYmopIHtcbiAgICBSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUuaW5zdGFsbC5jYWxsKHRoaXMsIG9iaik7XG4gICAgdGhpcy53cmFwQXJyYXkodGhpcy5yZWxhdGVkKTtcbiAgICBvYmpbKCdzcGxpY2UnICsgdXRpbC5jYXBpdGFsaXNlRmlyc3RMZXR0ZXIodGhpcy5yZXZlcnNlTmFtZSkpXSA9IHRoaXMuc3BsaWNlLmJpbmQodGhpcyk7XG4gIH0sXG4gIHJlZ2lzdGVyUmVtb3ZhbExpc3RlbmVyOiBmdW5jdGlvbihvYmopIHtcbiAgICB0aGlzLnJlbGF0ZWRDYW5jZWxMaXN0ZW5lcnNbb2JqLmxvY2FsSWRdID0gb2JqLm9uKCcqJywgZnVuY3Rpb24oZSkge1xuXG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gTWFueVRvTWFueVByb3h5O1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL01hbnlUb01hbnlQcm94eS5qc1xuICoqIG1vZHVsZSBpZCA9IDEwXG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgUmVsYXRpb25zaGlwUHJveHkgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFByb3h5JyksXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgU2llc3RhTW9kZWwgPSByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKTtcblxuLyoqXG4gKiBbT25lVG9PbmVQcm94eSBkZXNjcmlwdGlvbl1cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKi9cbmZ1bmN0aW9uIE9uZVRvT25lUHJveHkob3B0cykge1xuICBSZWxhdGlvbnNoaXBQcm94eS5jYWxsKHRoaXMsIG9wdHMpO1xufVxuXG5cbk9uZVRvT25lUHJveHkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUpO1xuXG51dGlsLmV4dGVuZChPbmVUb09uZVByb3h5LnByb3RvdHlwZSwge1xuICAvKipcbiAgICogVmFsaWRhdGUgdGhlIG9iamVjdCB0aGF0IHdlJ3JlIHNldHRpbmdcbiAgICogQHBhcmFtIG9ialxuICAgKiBAcmV0dXJucyB7c3RyaW5nfG51bGx9IEFuIGVycm9yIG1lc3NhZ2Ugb3IgbnVsbFxuICAgKi9cbiAgdmFsaWRhdGU6IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSA9PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICByZXR1cm4gJ0Nhbm5vdCBhc3NpZ24gYXJyYXkgdG8gb25lIHRvIG9uZSByZWxhdGlvbnNoaXAnO1xuICAgIH1cbiAgICBlbHNlIGlmICgoIW9iaiBpbnN0YW5jZW9mIFNpZXN0YU1vZGVsKSkge1xuXG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuICBzZXQ6IGZ1bmN0aW9uKG9iaiwgb3B0cykge1xuICAgIHRoaXMuY2hlY2tJbnN0YWxsZWQoKTtcbiAgICBpZiAob2JqKSB7XG4gICAgICB2YXIgZXJyb3JNZXNzYWdlO1xuICAgICAgaWYgKGVycm9yTWVzc2FnZSA9IHRoaXMudmFsaWRhdGUob2JqKSkge1xuICAgICAgICByZXR1cm4gZXJyb3JNZXNzYWdlO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHRoaXMuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgICAgdGhpcy5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICAgICAgdGhpcy5zZXRJZEFuZFJlbGF0ZWRSZXZlcnNlKG9iaiwgb3B0cyk7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgdGhpcy5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICB9XG4gIH0sXG4gIGdldDogZnVuY3Rpb24oY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgY2IobnVsbCwgdGhpcy5yZWxhdGVkKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBPbmVUb09uZVByb3h5O1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL09uZVRvT25lUHJveHkuanNcbiAqKiBtb2R1bGUgaWQgPSAxMVxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIFJlbGF0aW9uc2hpcFByb3h5ID0gcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBQcm94eScpLFxuICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzID0gZXZlbnRzLndyYXBBcnJheSxcbiAgQXJyYXlPYnNlcnZlciA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuQXJyYXlPYnNlcnZlcixcbiAgTW9kZWxFdmVudFR5cGUgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJykuTW9kZWxFdmVudFR5cGU7XG5cbi8qKlxuICogQGNsYXNzICBbT25lVG9NYW55UHJveHkgZGVzY3JpcHRpb25dXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB7W3R5cGVdfSBvcHRzXG4gKi9cbmZ1bmN0aW9uIE9uZVRvTWFueVByb3h5KG9wdHMpIHtcbiAgUmVsYXRpb25zaGlwUHJveHkuY2FsbCh0aGlzLCBvcHRzKTtcbiAgaWYgKHRoaXMuaXNSZXZlcnNlKSB7XG4gICAgdGhpcy5yZWxhdGVkID0gW107XG4gICAgLy90aGlzLmZvcndhcmRNb2RlbC5vbihtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5SZW1vdmUsIGZ1bmN0aW9uKGUpIHtcbiAgICAvLyAgaWYgKGUuZmllbGQgPT0gZS5mb3J3YXJkTmFtZSkge1xuICAgIC8vICAgIHZhciBpZHggPSB0aGlzLnJlbGF0ZWQuaW5kZXhPZihlLm9iaik7XG4gICAgLy8gICAgaWYgKGlkeCA+IC0xKSB7XG4gICAgLy8gICAgICB2YXIgcmVtb3ZlZCA9IHRoaXMucmVsYXRlZC5zcGxpY2UoaWR4LCAxKTtcbiAgICAvLyAgICB9XG4gICAgLy8gICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgLy8gICAgICBjb2xsZWN0aW9uOiB0aGlzLnJldmVyc2VNb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAvLyAgICAgIG1vZGVsOiB0aGlzLnJldmVyc2VNb2RlbC5uYW1lLFxuICAgIC8vICAgICAgbG9jYWxJZDogdGhpcy5vYmplY3QubG9jYWxJZCxcbiAgICAvLyAgICAgIGZpZWxkOiB0aGlzLnJldmVyc2VOYW1lLFxuICAgIC8vICAgICAgcmVtb3ZlZDogcmVtb3ZlZCxcbiAgICAvLyAgICAgIGFkZGVkOiBbXSxcbiAgICAvLyAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAvLyAgICAgIGluZGV4OiBpZHgsXG4gICAgLy8gICAgICBvYmo6IHRoaXMub2JqZWN0XG4gICAgLy8gICAgfSk7XG4gICAgLy8gIH1cbiAgICAvL30uYmluZCh0aGlzKSk7XG4gIH1cbn1cblxuT25lVG9NYW55UHJveHkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUpO1xuXG51dGlsLmV4dGVuZChPbmVUb01hbnlQcm94eS5wcm90b3R5cGUsIHtcbiAgY2xlYXJSZXZlcnNlOiBmdW5jdGlvbihyZW1vdmVkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJlbW92ZWQuZm9yRWFjaChmdW5jdGlvbihyZW1vdmVkT2JqZWN0KSB7XG4gICAgICB2YXIgcmV2ZXJzZVByb3h5ID0gc2VsZi5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZShyZW1vdmVkT2JqZWN0KTtcbiAgICAgIHJldmVyc2VQcm94eS5zZXRJZEFuZFJlbGF0ZWQobnVsbCk7XG4gICAgfSk7XG4gIH0sXG4gIHNldFJldmVyc2VPZkFkZGVkOiBmdW5jdGlvbihhZGRlZCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBhZGRlZC5mb3JFYWNoKGZ1bmN0aW9uKGFkZGVkKSB7XG4gICAgICB2YXIgZm9yd2FyZFByb3h5ID0gc2VsZi5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZShhZGRlZCk7XG4gICAgICBmb3J3YXJkUHJveHkuc2V0SWRBbmRSZWxhdGVkKHNlbGYub2JqZWN0KTtcbiAgICB9KTtcbiAgfSxcbiAgd3JhcEFycmF5OiBmdW5jdGlvbihhcnIpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyhhcnIsIHRoaXMucmV2ZXJzZU5hbWUsIHRoaXMub2JqZWN0KTtcbiAgICBpZiAoIWFyci5hcnJheU9ic2VydmVyKSB7XG4gICAgICBhcnIuYXJyYXlPYnNlcnZlciA9IG5ldyBBcnJheU9ic2VydmVyKGFycik7XG4gICAgICB2YXIgb2JzZXJ2ZXJGdW5jdGlvbiA9IGZ1bmN0aW9uKHNwbGljZXMpIHtcbiAgICAgICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uKHNwbGljZSkge1xuICAgICAgICAgIHZhciBhZGRlZCA9IHNwbGljZS5hZGRlZENvdW50ID8gYXJyLnNsaWNlKHNwbGljZS5pbmRleCwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQpIDogW107XG4gICAgICAgICAgdmFyIHJlbW92ZWQgPSBzcGxpY2UucmVtb3ZlZDtcbiAgICAgICAgICBzZWxmLmNsZWFyUmV2ZXJzZShyZW1vdmVkKTtcbiAgICAgICAgICBzZWxmLnNldFJldmVyc2VPZkFkZGVkKGFkZGVkKTtcbiAgICAgICAgICB2YXIgbW9kZWwgPSBzZWxmLmdldEZvcndhcmRNb2RlbCgpO1xuICAgICAgICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgICAgICAgY29sbGVjdGlvbjogbW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICBtb2RlbDogbW9kZWwubmFtZSxcbiAgICAgICAgICAgIGxvY2FsSWQ6IHNlbGYub2JqZWN0LmxvY2FsSWQsXG4gICAgICAgICAgICBmaWVsZDogc2VsZi5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgICAgICAgcmVtb3ZlZDogcmVtb3ZlZCxcbiAgICAgICAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgIGluZGV4OiBzcGxpY2UuaW5kZXgsXG4gICAgICAgICAgICBvYmo6IHNlbGYub2JqZWN0XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfTtcbiAgICAgIGFyci5hcnJheU9ic2VydmVyLm9wZW4ob2JzZXJ2ZXJGdW5jdGlvbik7XG4gICAgfVxuICB9LFxuICBnZXQ6IGZ1bmN0aW9uKGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIGNiKG51bGwsIHRoaXMucmVsYXRlZCk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgLyoqXG4gICAqIFZhbGlkYXRlIHRoZSBvYmplY3QgdGhhdCB3ZSdyZSBzZXR0aW5nXG4gICAqIEBwYXJhbSBvYmpcbiAgICogQHJldHVybnMge3N0cmluZ3xudWxsfSBBbiBlcnJvciBtZXNzYWdlIG9yIG51bGxcbiAgICogQGNsYXNzIE9uZVRvTWFueVByb3h5XG4gICAqL1xuICB2YWxpZGF0ZTogZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIHN0ciA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopO1xuICAgIGlmICh0aGlzLmlzRm9yd2FyZCkge1xuICAgICAgaWYgKHN0ciA9PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICAgIHJldHVybiAnQ2Fubm90IGFzc2lnbiBhcnJheSBmb3J3YXJkIG9uZVRvTWFueSAoJyArIHN0ciArICcpOiAnICsgdGhpcy5mb3J3YXJkTmFtZTtcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBpZiAoc3RyICE9ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICAgICAgcmV0dXJuICdDYW5ub3Qgc2NhbGFyIHRvIHJldmVyc2Ugb25lVG9NYW55ICgnICsgc3RyICsgJyk6ICcgKyB0aGlzLnJldmVyc2VOYW1lO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcbiAgc2V0OiBmdW5jdGlvbihvYmosIG9wdHMpIHtcbiAgICB0aGlzLmNoZWNrSW5zdGFsbGVkKCk7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChvYmopIHtcbiAgICAgIHZhciBlcnJvck1lc3NhZ2U7XG4gICAgICBpZiAoZXJyb3JNZXNzYWdlID0gdGhpcy52YWxpZGF0ZShvYmopKSB7XG4gICAgICAgIHJldHVybiBlcnJvck1lc3NhZ2U7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgICBzZWxmLnNldElkQW5kUmVsYXRlZChvYmosIG9wdHMpO1xuICAgICAgICBpZiAoc2VsZi5pc1JldmVyc2UpIHtcbiAgICAgICAgICB0aGlzLndyYXBBcnJheShzZWxmLnJlbGF0ZWQpO1xuICAgICAgICB9XG4gICAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkUmV2ZXJzZShvYmosIG9wdHMpO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHRoaXMuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkKG9iaiwgb3B0cyk7XG4gICAgfVxuICB9LFxuICBpbnN0YWxsOiBmdW5jdGlvbihvYmopIHtcbiAgICBSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUuaW5zdGFsbC5jYWxsKHRoaXMsIG9iaik7XG5cbiAgICBpZiAodGhpcy5pc1JldmVyc2UpIHtcbiAgICAgIG9ialsoJ3NwbGljZScgKyB1dGlsLmNhcGl0YWxpc2VGaXJzdExldHRlcih0aGlzLnJldmVyc2VOYW1lKSldID0gdGhpcy5zcGxpY2UuYmluZCh0aGlzKTtcbiAgICAgIHRoaXMud3JhcEFycmF5KHRoaXMucmVsYXRlZCk7XG4gICAgfVxuXG4gIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE9uZVRvTWFueVByb3h5O1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL09uZVRvTWFueVByb3h5LmpzXG4gKiogbW9kdWxlIGlkID0gMTJcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIi8qKlxuICogQmFzZSBmdW5jdGlvbmFsaXR5IGZvciByZWxhdGlvbnNoaXBzLlxuICogQG1vZHVsZSByZWxhdGlvbnNoaXBzXG4gKi9cbnZhciBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgUXVlcnkgPSByZXF1aXJlKCcuL1F1ZXJ5JyksXG4gIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyksXG4gIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpLFxuICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzID0gZXZlbnRzLndyYXBBcnJheSxcbiAgQXJyYXlPYnNlcnZlciA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuQXJyYXlPYnNlcnZlcixcbiAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gIE1vZGVsRXZlbnRUeXBlID0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGU7XG5cbi8qKlxuICogQGNsYXNzICBbUmVsYXRpb25zaGlwUHJveHkgZGVzY3JpcHRpb25dXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIFJlbGF0aW9uc2hpcFByb3h5KG9wdHMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBvcHRzID0gb3B0cyB8fCB7fTtcblxuICB1dGlsLmV4dGVuZCh0aGlzLCB7XG4gICAgb2JqZWN0OiBudWxsLFxuICAgIHJlbGF0ZWQ6IG51bGxcbiAgfSk7XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXModGhpcywge1xuICAgIGlzRm9yd2FyZDoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuICFzZWxmLmlzUmV2ZXJzZTtcbiAgICAgIH0sXG4gICAgICBzZXQ6IGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgc2VsZi5pc1JldmVyc2UgPSAhdjtcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfVxuICB9KTtcblxuICB1dGlsLmV4dGVuZEZyb21PcHRzKHRoaXMsIG9wdHMsIHtcbiAgICByZXZlcnNlTW9kZWw6IG51bGwsXG4gICAgZm9yd2FyZE1vZGVsOiBudWxsLFxuICAgIGZvcndhcmROYW1lOiBudWxsLFxuICAgIHJldmVyc2VOYW1lOiBudWxsLFxuICAgIGlzUmV2ZXJzZTogbnVsbCxcbiAgICBzZXJpYWxpc2U6IG51bGxcbiAgfSwgZmFsc2UpO1xuXG4gIHRoaXMuY2FuY2VsTGlzdGVucyA9IHt9O1xufVxuXG51dGlsLmV4dGVuZChSZWxhdGlvbnNoaXBQcm94eSwge30pO1xuXG51dGlsLmV4dGVuZChSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUsIHtcbiAgLyoqXG4gICAqIEluc3RhbGwgdGhpcyBwcm94eSBvbiB0aGUgZ2l2ZW4gaW5zdGFuY2VcbiAgICogQHBhcmFtIHtNb2RlbEluc3RhbmNlfSBtb2RlbEluc3RhbmNlXG4gICAqL1xuICBpbnN0YWxsOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlKSB7XG4gICAgaWYgKG1vZGVsSW5zdGFuY2UpIHtcbiAgICAgIGlmICghdGhpcy5vYmplY3QpIHtcbiAgICAgICAgdGhpcy5vYmplY3QgPSBtb2RlbEluc3RhbmNlO1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHZhciBuYW1lID0gdGhpcy5nZXRGb3J3YXJkTmFtZSgpO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobW9kZWxJbnN0YW5jZSwgbmFtZSwge1xuICAgICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gc2VsZi5yZWxhdGVkO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgc2V0OiBmdW5jdGlvbih2KSB7XG4gICAgICAgICAgICBzZWxmLnNldCh2KTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoIW1vZGVsSW5zdGFuY2UuX19wcm94aWVzKSBtb2RlbEluc3RhbmNlLl9fcHJveGllcyA9IHt9O1xuICAgICAgICBtb2RlbEluc3RhbmNlLl9fcHJveGllc1tuYW1lXSA9IHRoaXM7XG4gICAgICAgIGlmICghbW9kZWxJbnN0YW5jZS5fcHJveGllcykge1xuICAgICAgICAgIG1vZGVsSW5zdGFuY2UuX3Byb3hpZXMgPSBbXTtcbiAgICAgICAgfVxuICAgICAgICBtb2RlbEluc3RhbmNlLl9wcm94aWVzLnB1c2godGhpcyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignQWxyZWFkeSBpbnN0YWxsZWQuJyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdObyBvYmplY3QgcGFzc2VkIHRvIHJlbGF0aW9uc2hpcCBpbnN0YWxsJyk7XG4gICAgfVxuICB9XG5cbn0pO1xuXG4vL25vaW5zcGVjdGlvbiBKU1VudXNlZExvY2FsU3ltYm9sc1xudXRpbC5leHRlbmQoUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlLCB7XG4gIHNldDogZnVuY3Rpb24ob2JqLCBvcHRzKSB7XG4gICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3Qgc3ViY2xhc3MgUmVsYXRpb25zaGlwUHJveHknKTtcbiAgfSxcbiAgZ2V0OiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHN1YmNsYXNzIFJlbGF0aW9uc2hpcFByb3h5Jyk7XG4gIH1cbn0pO1xuXG51dGlsLmV4dGVuZChSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUsIHtcbiAgcHJveHlGb3JJbnN0YW5jZTogZnVuY3Rpb24obW9kZWxJbnN0YW5jZSwgcmV2ZXJzZSkge1xuICAgIHZhciBuYW1lID0gcmV2ZXJzZSA/IHRoaXMuZ2V0UmV2ZXJzZU5hbWUoKSA6IHRoaXMuZ2V0Rm9yd2FyZE5hbWUoKSxcbiAgICAgIG1vZGVsID0gcmV2ZXJzZSA/IHRoaXMucmV2ZXJzZU1vZGVsIDogdGhpcy5mb3J3YXJkTW9kZWw7XG4gICAgdmFyIHJldDtcbiAgICAvLyBUaGlzIHNob3VsZCBuZXZlciBoYXBwZW4uIFNob3VsZCBnICAgZXQgY2F1Z2h0IGluIHRoZSBtYXBwaW5nIG9wZXJhdGlvbj9cbiAgICBpZiAodXRpbC5pc0FycmF5KG1vZGVsSW5zdGFuY2UpKSB7XG4gICAgICByZXQgPSBtb2RlbEluc3RhbmNlLm1hcChmdW5jdGlvbihvKSB7XG4gICAgICAgIHJldHVybiBvLl9fcHJveGllc1tuYW1lXTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgcHJveGllcyA9IG1vZGVsSW5zdGFuY2UuX19wcm94aWVzO1xuICAgICAgdmFyIHByb3h5ID0gcHJveGllc1tuYW1lXTtcbiAgICAgIGlmICghcHJveHkpIHtcbiAgICAgICAgdmFyIGVyciA9ICdObyBwcm94eSB3aXRoIG5hbWUgXCInICsgbmFtZSArICdcIiBvbiBtYXBwaW5nICcgKyBtb2RlbC5uYW1lO1xuICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihlcnIpO1xuICAgICAgfVxuICAgICAgcmV0ID0gcHJveHk7XG4gICAgfVxuICAgIHJldHVybiByZXQ7XG4gIH0sXG4gIHJldmVyc2VQcm94eUZvckluc3RhbmNlOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlKSB7XG4gICAgcmV0dXJuIHRoaXMucHJveHlGb3JJbnN0YW5jZShtb2RlbEluc3RhbmNlLCB0cnVlKTtcbiAgfSxcbiAgZ2V0UmV2ZXJzZU5hbWU6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmlzRm9yd2FyZCA/IHRoaXMucmV2ZXJzZU5hbWUgOiB0aGlzLmZvcndhcmROYW1lO1xuICB9LFxuICBnZXRGb3J3YXJkTmFtZTogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuaXNGb3J3YXJkID8gdGhpcy5mb3J3YXJkTmFtZSA6IHRoaXMucmV2ZXJzZU5hbWU7XG4gIH0sXG4gIGdldEZvcndhcmRNb2RlbDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuaXNGb3J3YXJkID8gdGhpcy5mb3J3YXJkTW9kZWwgOiB0aGlzLnJldmVyc2VNb2RlbDtcbiAgfSxcbiAgY2xlYXJSZW1vdmFsTGlzdGVuZXI6IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBsb2NhbElkID0gb2JqLmxvY2FsSWQ7XG4gICAgdmFyIGNhbmNlbExpc3RlbiA9IHRoaXMuY2FuY2VsTGlzdGVuc1tsb2NhbElkXTtcbiAgICAvLyBUT0RPOiBSZW1vdmUgdGhpcyBjaGVjay4gY2FuY2VsTGlzdGVuIHNob3VsZCBhbHdheXMgZXhpc3RcbiAgICBpZiAoY2FuY2VsTGlzdGVuKSB7XG4gICAgICBjYW5jZWxMaXN0ZW4oKTtcbiAgICAgIHRoaXMuY2FuY2VsTGlzdGVuc1tsb2NhbElkXSA9IG51bGw7XG4gICAgfVxuICB9LFxuICBsaXN0ZW5Gb3JSZW1vdmFsOiBmdW5jdGlvbihvYmopIHtcbiAgICB0aGlzLmNhbmNlbExpc3RlbnNbb2JqLmxvY2FsSWRdID0gb2JqLm9uKCcqJywgZnVuY3Rpb24oZSkge1xuICAgICAgaWYgKGUudHlwZSA9PSBNb2RlbEV2ZW50VHlwZS5SZW1vdmUpIHtcbiAgICAgICAgaWYgKHV0aWwuaXNBcnJheSh0aGlzLnJlbGF0ZWQpKSB7XG4gICAgICAgICAgdmFyIGlkeCA9IHRoaXMucmVsYXRlZC5pbmRleE9mKG9iaik7XG4gICAgICAgICAgdGhpcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICB0aGlzLnNldElkQW5kUmVsYXRlZChudWxsKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmNsZWFyUmVtb3ZhbExpc3RlbmVyKG9iaik7XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgLyoqXG4gICAqIENvbmZpZ3VyZSBfaWQgYW5kIHJlbGF0ZWQgd2l0aCB0aGUgbmV3IHJlbGF0ZWQgb2JqZWN0LlxuICAgKiBAcGFyYW0gb2JqXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0c11cbiAgICogQHBhcmFtIHtib29sZWFufSBbb3B0cy5kaXNhYmxlTm90aWZpY2F0aW9uc11cbiAgICogQHJldHVybnMge1N0cmluZ3x1bmRlZmluZWR9IC0gRXJyb3IgbWVzc2FnZSBvciB1bmRlZmluZWRcbiAgICovXG4gIHNldElkQW5kUmVsYXRlZDogZnVuY3Rpb24ob2JqLCBvcHRzKSB7XG4gICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgaWYgKCFvcHRzLmRpc2FibGVldmVudHMpIHZhciBvbGRWYWx1ZSA9IHRoaXMuX2dldE9sZFZhbHVlRm9yU2V0Q2hhbmdlRXZlbnQoKTtcbiAgICB2YXIgcHJldmlvdXNseVJlbGF0ZWQgPSB0aGlzLnJlbGF0ZWQ7XG4gICAgaWYgKHByZXZpb3VzbHlSZWxhdGVkKSB0aGlzLmNsZWFyUmVtb3ZhbExpc3RlbmVyKHByZXZpb3VzbHlSZWxhdGVkKTtcbiAgICBpZiAob2JqKSB7XG4gICAgICBpZiAodXRpbC5pc0FycmF5KG9iaikpIHtcbiAgICAgICAgdGhpcy5yZWxhdGVkID0gb2JqO1xuICAgICAgICBvYmouZm9yRWFjaChmdW5jdGlvbihfb2JqKSB7XG4gICAgICAgICAgdGhpcy5saXN0ZW5Gb3JSZW1vdmFsKF9vYmopO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5yZWxhdGVkID0gb2JqO1xuICAgICAgICB0aGlzLmxpc3RlbkZvclJlbW92YWwob2JqKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICB0aGlzLnJlbGF0ZWQgPSBudWxsO1xuICAgIH1cbiAgICBpZiAoIW9wdHMuZGlzYWJsZWV2ZW50cykgdGhpcy5yZWdpc3RlclNldENoYW5nZShvYmosIG9sZFZhbHVlKTtcbiAgfSxcbiAgY2hlY2tJbnN0YWxsZWQ6IGZ1bmN0aW9uKCkge1xuICAgIGlmICghdGhpcy5vYmplY3QpIHtcbiAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdQcm94eSBtdXN0IGJlIGluc3RhbGxlZCBvbiBhbiBvYmplY3QgYmVmb3JlIGNhbiB1c2UgaXQuJyk7XG4gICAgfVxuICB9LFxuICBzcGxpY2VyOiBmdW5jdGlvbihvcHRzKSB7XG4gICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgcmV0dXJuIGZ1bmN0aW9uKGlkeCwgbnVtUmVtb3ZlKSB7XG4gICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgIGlmICghb3B0cy5kaXNhYmxlZXZlbnRzKSB7XG4gICAgICAgIHZhciBhZGRlZCA9IHRoaXMuX2dldEFkZGVkRm9yU3BsaWNlQ2hhbmdlRXZlbnQoYXJndW1lbnRzKSxcbiAgICAgICAgICByZW1vdmVkID0gdGhpcy5fZ2V0UmVtb3ZlZEZvclNwbGljZUNoYW5nZUV2ZW50KGlkeCwgbnVtUmVtb3ZlKTtcbiAgICAgIH1cbiAgICAgIHZhciBhZGQgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgICAgdmFyIHJlcyA9IHRoaXMucmVsYXRlZC5zcGxpY2UuYmluZCh0aGlzLnJlbGF0ZWQsIGlkeCwgbnVtUmVtb3ZlKS5hcHBseSh0aGlzLnJlbGF0ZWQsIGFkZCk7XG4gICAgICBpZiAoIW9wdHMuZGlzYWJsZWV2ZW50cykgdGhpcy5yZWdpc3RlclNwbGljZUNoYW5nZShpZHgsIGFkZGVkLCByZW1vdmVkKTtcbiAgICAgIHJldHVybiByZXM7XG4gICAgfS5iaW5kKHRoaXMpO1xuICB9LFxuICBjbGVhclJldmVyc2VSZWxhdGVkOiBmdW5jdGlvbihvcHRzKSB7XG4gICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICh0aGlzLnJlbGF0ZWQpIHtcbiAgICAgIHZhciByZXZlcnNlUHJveHkgPSB0aGlzLnJldmVyc2VQcm94eUZvckluc3RhbmNlKHRoaXMucmVsYXRlZCk7XG4gICAgICB2YXIgcmV2ZXJzZVByb3hpZXMgPSB1dGlsLmlzQXJyYXkocmV2ZXJzZVByb3h5KSA/IHJldmVyc2VQcm94eSA6IFtyZXZlcnNlUHJveHldO1xuICAgICAgcmV2ZXJzZVByb3hpZXMuZm9yRWFjaChmdW5jdGlvbihwKSB7XG4gICAgICAgIGlmICh1dGlsLmlzQXJyYXkocC5yZWxhdGVkKSkge1xuICAgICAgICAgIHZhciBpZHggPSBwLnJlbGF0ZWQuaW5kZXhPZihzZWxmLm9iamVjdCk7XG4gICAgICAgICAgcC5tYWtlQ2hhbmdlc1RvUmVsYXRlZFdpdGhvdXRPYnNlcnZhdGlvbnMoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBwLnNwbGljZXIob3B0cykoaWR4LCAxKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwLnNldElkQW5kUmVsYXRlZChudWxsLCBvcHRzKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9LFxuICBzZXRJZEFuZFJlbGF0ZWRSZXZlcnNlOiBmdW5jdGlvbihvYmosIG9wdHMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHJldmVyc2VQcm94eSA9IHRoaXMucmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2Uob2JqKTtcbiAgICB2YXIgcmV2ZXJzZVByb3hpZXMgPSB1dGlsLmlzQXJyYXkocmV2ZXJzZVByb3h5KSA/IHJldmVyc2VQcm94eSA6IFtyZXZlcnNlUHJveHldO1xuICAgIHJldmVyc2VQcm94aWVzLmZvckVhY2goZnVuY3Rpb24ocCkge1xuICAgICAgaWYgKHV0aWwuaXNBcnJheShwLnJlbGF0ZWQpKSB7XG4gICAgICAgIHAubWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHAuc3BsaWNlcihvcHRzKShwLnJlbGF0ZWQubGVuZ3RoLCAwLCBzZWxmLm9iamVjdCk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcC5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgICBwLnNldElkQW5kUmVsYXRlZChzZWxmLm9iamVjdCwgb3B0cyk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG4gIG1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9uczogZnVuY3Rpb24oZikge1xuICAgIGlmICh0aGlzLnJlbGF0ZWQpIHtcbiAgICAgIHRoaXMucmVsYXRlZC5hcnJheU9ic2VydmVyLmNsb3NlKCk7XG4gICAgICB0aGlzLnJlbGF0ZWQuYXJyYXlPYnNlcnZlciA9IG51bGw7XG4gICAgICBmKCk7XG4gICAgICB0aGlzLndyYXBBcnJheSh0aGlzLnJlbGF0ZWQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBmKCk7XG4gICAgfVxuICB9LFxuICAvKipcbiAgICogR2V0IG9sZCB2YWx1ZSB0aGF0IGlzIHNlbnQgb3V0IGluIGVtaXNzaW9ucy5cbiAgICogQHJldHVybnMgeyp9XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfZ2V0T2xkVmFsdWVGb3JTZXRDaGFuZ2VFdmVudDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIG9sZFZhbHVlID0gdGhpcy5yZWxhdGVkO1xuICAgIGlmICh1dGlsLmlzQXJyYXkob2xkVmFsdWUpICYmICFvbGRWYWx1ZS5sZW5ndGgpIHtcbiAgICAgIG9sZFZhbHVlID0gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIG9sZFZhbHVlO1xuICB9LFxuICByZWdpc3RlclNldENoYW5nZTogZnVuY3Rpb24obmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgdmFyIHByb3h5T2JqZWN0ID0gdGhpcy5vYmplY3Q7XG4gICAgaWYgKCFwcm94eU9iamVjdCkgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ1Byb3h5IG11c3QgaGF2ZSBhbiBvYmplY3QgYXNzb2NpYXRlZCcpO1xuICAgIHZhciBtb2RlbCA9IHByb3h5T2JqZWN0Lm1vZGVsLm5hbWU7XG4gICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gcHJveHlPYmplY3QuY29sbGVjdGlvbk5hbWU7XG4gICAgLy8gV2UgdGFrZSBbXSA9PSBudWxsID09IHVuZGVmaW5lZCBpbiB0aGUgY2FzZSBvZiByZWxhdGlvbnNoaXBzLlxuICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgY29sbGVjdGlvbjogY29sbGVjdGlvbk5hbWUsXG4gICAgICBtb2RlbDogbW9kZWwsXG4gICAgICBsb2NhbElkOiBwcm94eU9iamVjdC5sb2NhbElkLFxuICAgICAgZmllbGQ6IHRoaXMuZ2V0Rm9yd2FyZE5hbWUoKSxcbiAgICAgIG9sZDogb2xkVmFsdWUsXG4gICAgICBuZXc6IG5ld1ZhbHVlLFxuICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU2V0LFxuICAgICAgb2JqOiBwcm94eU9iamVjdFxuICAgIH0pO1xuICB9LFxuXG4gIF9nZXRSZW1vdmVkRm9yU3BsaWNlQ2hhbmdlRXZlbnQ6IGZ1bmN0aW9uKGlkeCwgbnVtUmVtb3ZlKSB7XG4gICAgdmFyIHJlbW92ZWQgPSB0aGlzLnJlbGF0ZWQgPyB0aGlzLnJlbGF0ZWQuc2xpY2UoaWR4LCBpZHggKyBudW1SZW1vdmUpIDogbnVsbDtcbiAgICByZXR1cm4gcmVtb3ZlZDtcbiAgfSxcblxuICBfZ2V0QWRkZWRGb3JTcGxpY2VDaGFuZ2VFdmVudDogZnVuY3Rpb24oYXJncykge1xuICAgIHZhciBhZGQgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmdzLCAyKSxcbiAgICAgIGFkZGVkID0gYWRkLmxlbmd0aCA/IGFkZCA6IFtdO1xuICAgIHJldHVybiBhZGRlZDtcbiAgfSxcblxuICByZWdpc3RlclNwbGljZUNoYW5nZTogZnVuY3Rpb24oaWR4LCBhZGRlZCwgcmVtb3ZlZCkge1xuICAgIHZhciBtb2RlbCA9IHRoaXMub2JqZWN0Lm1vZGVsLm5hbWUsXG4gICAgICBjb2xsID0gdGhpcy5vYmplY3QuY29sbGVjdGlvbk5hbWU7XG4gICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICBjb2xsZWN0aW9uOiBjb2xsLFxuICAgICAgbW9kZWw6IG1vZGVsLFxuICAgICAgbG9jYWxJZDogdGhpcy5vYmplY3QubG9jYWxJZCxcbiAgICAgIGZpZWxkOiB0aGlzLmdldEZvcndhcmROYW1lKCksXG4gICAgICBpbmRleDogaWR4LFxuICAgICAgcmVtb3ZlZDogcmVtb3ZlZCxcbiAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgIG9iajogdGhpcy5vYmplY3RcbiAgICB9KTtcbiAgfSxcbiAgd3JhcEFycmF5OiBmdW5jdGlvbihhcnIpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyhhcnIsIHRoaXMucmV2ZXJzZU5hbWUsIHRoaXMub2JqZWN0KTtcbiAgICBpZiAoIWFyci5hcnJheU9ic2VydmVyKSB7XG4gICAgICBhcnIuYXJyYXlPYnNlcnZlciA9IG5ldyBBcnJheU9ic2VydmVyKGFycik7XG4gICAgICB2YXIgb2JzZXJ2ZXJGdW5jdGlvbiA9IGZ1bmN0aW9uKHNwbGljZXMpIHtcbiAgICAgICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uKHNwbGljZSkge1xuICAgICAgICAgIHZhciBhZGRlZCA9IHNwbGljZS5hZGRlZENvdW50ID8gYXJyLnNsaWNlKHNwbGljZS5pbmRleCwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQpIDogW107XG4gICAgICAgICAgdmFyIG1vZGVsID0gc2VsZi5nZXRGb3J3YXJkTW9kZWwoKTtcbiAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgIGNvbGxlY3Rpb246IG1vZGVsLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgbW9kZWw6IG1vZGVsLm5hbWUsXG4gICAgICAgICAgICBsb2NhbElkOiBzZWxmLm9iamVjdC5sb2NhbElkLFxuICAgICAgICAgICAgZmllbGQ6IHNlbGYuZ2V0Rm9yd2FyZE5hbWUoKSxcbiAgICAgICAgICAgIHJlbW92ZWQ6IHNwbGljZS5yZW1vdmVkLFxuICAgICAgICAgICAgYWRkZWQ6IGFkZGVkLFxuICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgb2JqOiBzZWxmLm9iamVjdFxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH07XG4gICAgICBhcnIuYXJyYXlPYnNlcnZlci5vcGVuKG9ic2VydmVyRnVuY3Rpb24pO1xuICAgIH1cbiAgfSxcbiAgc3BsaWNlOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnNwbGljZXIoe30pLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gIH1cblxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gUmVsYXRpb25zaGlwUHJveHk7XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvUmVsYXRpb25zaGlwUHJveHkuanNcbiAqKiBtb2R1bGUgaWQgPSAxM1xuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSgnZXZlbnRzJyksXG4gIGV4dGVuZCA9IHJlcXVpcmUoJy4vdXRpbCcpLmV4dGVuZCxcbiAgY29sbGVjdGlvblJlZ2lzdHJ5ID0gcmVxdWlyZSgnLi9jb2xsZWN0aW9uUmVnaXN0cnknKS5Db2xsZWN0aW9uUmVnaXN0cnk7XG5cblxuLyoqXG4gKiBDb25zdGFudHMgdGhhdCBkZXNjcmliZSBjaGFuZ2UgZXZlbnRzLlxuICogU2V0ID0+IEEgbmV3IHZhbHVlIGlzIGFzc2lnbmVkIHRvIGFuIGF0dHJpYnV0ZS9yZWxhdGlvbnNoaXBcbiAqIFNwbGljZSA9PiBBbGwgamF2YXNjcmlwdCBhcnJheSBvcGVyYXRpb25zIGFyZSBkZXNjcmliZWQgYXMgc3BsaWNlcy5cbiAqIERlbGV0ZSA9PiBVc2VkIGluIHRoZSBjYXNlIHdoZXJlIG9iamVjdHMgYXJlIHJlbW92ZWQgZnJvbSBhbiBhcnJheSwgYnV0IGFycmF5IG9yZGVyIGlzIG5vdCBrbm93biBpbiBhZHZhbmNlLlxuICogUmVtb3ZlID0+IE9iamVjdCBkZWxldGlvbiBldmVudHNcbiAqIE5ldyA9PiBPYmplY3QgY3JlYXRpb24gZXZlbnRzXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG52YXIgTW9kZWxFdmVudFR5cGUgPSB7XG4gIFNldDogJ3NldCcsXG4gIFNwbGljZTogJ3NwbGljZScsXG4gIE5ldzogJ25ldycsXG4gIFJlbW92ZTogJ3JlbW92ZSdcbn07XG5cbi8qKlxuICogUmVwcmVzZW50cyBhbiBpbmRpdmlkdWFsIGNoYW5nZS5cbiAqIEBwYXJhbSBvcHRzXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gTW9kZWxFdmVudChvcHRzKSB7XG4gIHRoaXMuX29wdHMgPSBvcHRzIHx8IHt9O1xuICBPYmplY3Qua2V5cyhvcHRzKS5mb3JFYWNoKGZ1bmN0aW9uKGspIHtcbiAgICB0aGlzW2tdID0gb3B0c1trXTtcbiAgfS5iaW5kKHRoaXMpKTtcbn1cblxuTW9kZWxFdmVudC5wcm90b3R5cGUuX2R1bXAgPSBmdW5jdGlvbihwcmV0dHkpIHtcbiAgdmFyIGR1bXBlZCA9IHt9O1xuICBkdW1wZWQuY29sbGVjdGlvbiA9ICh0eXBlb2YgdGhpcy5jb2xsZWN0aW9uKSA9PSAnc3RyaW5nJyA/IHRoaXMuY29sbGVjdGlvbiA6IHRoaXMuY29sbGVjdGlvbi5fZHVtcCgpO1xuICBkdW1wZWQubW9kZWwgPSAodHlwZW9mIHRoaXMubW9kZWwpID09ICdzdHJpbmcnID8gdGhpcy5tb2RlbCA6IHRoaXMubW9kZWwubmFtZTtcbiAgZHVtcGVkLmxvY2FsSWQgPSB0aGlzLmxvY2FsSWQ7XG4gIGR1bXBlZC5maWVsZCA9IHRoaXMuZmllbGQ7XG4gIGR1bXBlZC50eXBlID0gdGhpcy50eXBlO1xuICBpZiAodGhpcy5pbmRleCkgZHVtcGVkLmluZGV4ID0gdGhpcy5pbmRleDtcbiAgaWYgKHRoaXMuYWRkZWQpIGR1bXBlZC5hZGRlZCA9IHRoaXMuYWRkZWQubWFwKGZ1bmN0aW9uKHgpIHtyZXR1cm4geC5fZHVtcCgpfSk7XG4gIGlmICh0aGlzLnJlbW92ZWQpIGR1bXBlZC5yZW1vdmVkID0gdGhpcy5yZW1vdmVkLm1hcChmdW5jdGlvbih4KSB7cmV0dXJuIHguX2R1bXAoKX0pO1xuICBpZiAodGhpcy5vbGQpIGR1bXBlZC5vbGQgPSB0aGlzLm9sZDtcbiAgaWYgKHRoaXMubmV3KSBkdW1wZWQubmV3ID0gdGhpcy5uZXc7XG4gIHJldHVybiBwcmV0dHkgPyB1dGlsLnByZXR0eVByaW50KGR1bXBlZCkgOiBkdW1wZWQ7XG59O1xuXG5mdW5jdGlvbiBicm9hZGNhc3RFdmVudChjb2xsZWN0aW9uTmFtZSwgbW9kZWxOYW1lLCBvcHRzKSB7XG4gIHZhciBnZW5lcmljRXZlbnQgPSAnU2llc3RhJyxcbiAgICBjb2xsZWN0aW9uID0gY29sbGVjdGlvblJlZ2lzdHJ5W2NvbGxlY3Rpb25OYW1lXSxcbiAgICBtb2RlbCA9IGNvbGxlY3Rpb25bbW9kZWxOYW1lXTtcbiAgaWYgKCFjb2xsZWN0aW9uKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gc3VjaCBjb2xsZWN0aW9uIFwiJyArIGNvbGxlY3Rpb25OYW1lICsgJ1wiJyk7XG4gIGlmICghbW9kZWwpIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdObyBzdWNoIG1vZGVsIFwiJyArIG1vZGVsTmFtZSArICdcIicpO1xuICB2YXIgc2hvdWxkRW1pdCA9IG9wdHMub2JqLl9lbWl0RXZlbnRzO1xuICAvLyBEb24ndCBlbWl0IHBvaW50bGVzcyBldmVudHMuXG4gIGlmIChzaG91bGRFbWl0ICYmICduZXcnIGluIG9wdHMgJiYgJ29sZCcgaW4gb3B0cykge1xuICAgIGlmIChvcHRzLm5ldyBpbnN0YW5jZW9mIERhdGUgJiYgb3B0cy5vbGQgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICBzaG91bGRFbWl0ID0gb3B0cy5uZXcuZ2V0VGltZSgpICE9IG9wdHMub2xkLmdldFRpbWUoKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBzaG91bGRFbWl0ID0gb3B0cy5uZXcgIT0gb3B0cy5vbGQ7XG4gICAgfVxuICB9XG4gIGlmIChzaG91bGRFbWl0KSB7XG4gICAgZXZlbnRzLmVtaXQoZ2VuZXJpY0V2ZW50LCBvcHRzKTtcbiAgICBpZiAoc2llc3RhLmluc3RhbGxlZCkge1xuICAgICAgdmFyIG1vZGVsRXZlbnQgPSBjb2xsZWN0aW9uTmFtZSArICc6JyArIG1vZGVsTmFtZSxcbiAgICAgICAgbG9jYWxJZEV2ZW50ID0gb3B0cy5sb2NhbElkO1xuICAgICAgZXZlbnRzLmVtaXQoY29sbGVjdGlvbk5hbWUsIG9wdHMpO1xuICAgICAgZXZlbnRzLmVtaXQobW9kZWxFdmVudCwgb3B0cyk7XG4gICAgICBldmVudHMuZW1pdChsb2NhbElkRXZlbnQsIG9wdHMpO1xuICAgIH1cbiAgICBpZiAobW9kZWwuaWQgJiYgb3B0cy5vYmpbbW9kZWwuaWRdKSBldmVudHMuZW1pdChjb2xsZWN0aW9uTmFtZSArICc6JyArIG1vZGVsTmFtZSArICc6JyArIG9wdHMub2JqW21vZGVsLmlkXSwgb3B0cyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gdmFsaWRhdGVFdmVudE9wdHMob3B0cykge1xuICBpZiAoIW9wdHMubW9kZWwpIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHBhc3MgYSBtb2RlbCcpO1xuICBpZiAoIW9wdHMuY29sbGVjdGlvbikgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3QgcGFzcyBhIGNvbGxlY3Rpb24nKTtcbiAgaWYgKCFvcHRzLmxvY2FsSWQpIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHBhc3MgYSBsb2NhbCBpZGVudGlmaWVyJyk7XG4gIGlmICghb3B0cy5vYmopIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHBhc3MgdGhlIG9iamVjdCcpO1xufVxuXG5mdW5jdGlvbiBlbWl0KG9wdHMpIHtcbiAgdmFsaWRhdGVFdmVudE9wdHMob3B0cyk7XG4gIHZhciBjb2xsZWN0aW9uID0gb3B0cy5jb2xsZWN0aW9uO1xuICB2YXIgbW9kZWwgPSBvcHRzLm1vZGVsO1xuICB2YXIgYyA9IG5ldyBNb2RlbEV2ZW50KG9wdHMpO1xuICBicm9hZGNhc3RFdmVudChjb2xsZWN0aW9uLCBtb2RlbCwgYyk7XG4gIHJldHVybiBjO1xufVxuXG5leHRlbmQoZXhwb3J0cywge1xuICBNb2RlbEV2ZW50OiBNb2RlbEV2ZW50LFxuICBlbWl0OiBlbWl0LFxuICB2YWxpZGF0ZUV2ZW50T3B0czogdmFsaWRhdGVFdmVudE9wdHMsXG4gIE1vZGVsRXZlbnRUeXBlOiBNb2RlbEV2ZW50VHlwZVxufSk7XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvbW9kZWxFdmVudHMuanNcbiAqKiBtb2R1bGUgaWQgPSAxNFxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ3F1ZXJ5JyksXG4gIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpLFxuICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICBNb2RlbEluc3RhbmNlID0gcmVxdWlyZSgnLi9Nb2RlbEluc3RhbmNlJyksXG4gIGNvbnN0cnVjdFF1ZXJ5U2V0ID0gcmVxdWlyZSgnLi9RdWVyeVNldCcpO1xuXG4vKipcbiAqIEBjbGFzcyBbUXVlcnkgZGVzY3JpcHRpb25dXG4gKiBAcGFyYW0ge01vZGVsfSBtb2RlbFxuICogQHBhcmFtIHtPYmplY3R9IHF1ZXJ5XG4gKi9cbmZ1bmN0aW9uIFF1ZXJ5KG1vZGVsLCBxdWVyeSkge1xuICB2YXIgb3B0cyA9IHt9O1xuICBmb3IgKHZhciBwcm9wIGluIHF1ZXJ5KSB7XG4gICAgaWYgKHF1ZXJ5Lmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICBpZiAocHJvcC5zbGljZSgwLCAyKSA9PSAnX18nKSB7XG4gICAgICAgIG9wdHNbcHJvcC5zbGljZSgyKV0gPSBxdWVyeVtwcm9wXTtcbiAgICAgICAgZGVsZXRlIHF1ZXJ5W3Byb3BdO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICB1dGlsLmV4dGVuZCh0aGlzLCB7XG4gICAgbW9kZWw6IG1vZGVsLFxuICAgIHF1ZXJ5OiBxdWVyeSxcbiAgICBvcHRzOiBvcHRzXG4gIH0pO1xuICBvcHRzLm9yZGVyID0gb3B0cy5vcmRlciB8fCBbXTtcbiAgaWYgKCF1dGlsLmlzQXJyYXkob3B0cy5vcmRlcikpIG9wdHMub3JkZXIgPSBbb3B0cy5vcmRlcl07XG59XG5cbmZ1bmN0aW9uIHZhbHVlQXNTdHJpbmcoZmllbGRWYWx1ZSkge1xuICB2YXIgZmllbGRBc1N0cmluZztcbiAgaWYgKGZpZWxkVmFsdWUgPT09IG51bGwpIGZpZWxkQXNTdHJpbmcgPSAnbnVsbCc7XG4gIGVsc2UgaWYgKGZpZWxkVmFsdWUgPT09IHVuZGVmaW5lZCkgZmllbGRBc1N0cmluZyA9ICd1bmRlZmluZWQnO1xuICBlbHNlIGlmIChmaWVsZFZhbHVlIGluc3RhbmNlb2YgTW9kZWxJbnN0YW5jZSkgZmllbGRBc1N0cmluZyA9IGZpZWxkVmFsdWUubG9jYWxJZDtcbiAgZWxzZSBmaWVsZEFzU3RyaW5nID0gZmllbGRWYWx1ZS50b1N0cmluZygpO1xuICByZXR1cm4gZmllbGRBc1N0cmluZztcbn1cblxuZnVuY3Rpb24gY29udGFpbnMob3B0cykge1xuICBpZiAoIW9wdHMuaW52YWxpZCkge1xuICAgIHZhciBvYmogPSBvcHRzLm9iamVjdDtcbiAgICBpZiAodXRpbC5pc0FycmF5KG9iaikpIHtcbiAgICAgIGFyciA9IHV0aWwucGx1Y2sob2JqLCBvcHRzLmZpZWxkKTtcbiAgICB9XG4gICAgZWxzZVxuICAgICAgdmFyIGFyciA9IG9ialtvcHRzLmZpZWxkXTtcbiAgICBpZiAodXRpbC5pc0FycmF5KGFycikgfHwgdXRpbC5pc1N0cmluZyhhcnIpKSB7XG4gICAgICByZXR1cm4gYXJyLmluZGV4T2Yob3B0cy52YWx1ZSkgPiAtMTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG52YXIgY29tcGFyYXRvcnMgPSB7XG4gIGU6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICB2YXIgZmllbGRWYWx1ZSA9IG9wdHMub2JqZWN0W29wdHMuZmllbGRdO1xuICAgIGlmIChsb2cuZW5hYmxlZCkge1xuICAgICAgbG9nKG9wdHMuZmllbGQgKyAnOiAnICsgdmFsdWVBc1N0cmluZyhmaWVsZFZhbHVlKSArICcgPT0gJyArIHZhbHVlQXNTdHJpbmcob3B0cy52YWx1ZSksIHtvcHRzOiBvcHRzfSk7XG4gICAgfVxuICAgIHJldHVybiBmaWVsZFZhbHVlID09IG9wdHMudmFsdWU7XG4gIH0sXG4gIGx0OiBmdW5jdGlvbihvcHRzKSB7XG4gICAgaWYgKCFvcHRzLmludmFsaWQpIHJldHVybiBvcHRzLm9iamVjdFtvcHRzLmZpZWxkXSA8IG9wdHMudmFsdWU7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9LFxuICBndDogZnVuY3Rpb24ob3B0cykge1xuICAgIGlmICghb3B0cy5pbnZhbGlkKSByZXR1cm4gb3B0cy5vYmplY3Rbb3B0cy5maWVsZF0gPiBvcHRzLnZhbHVlO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfSxcbiAgbHRlOiBmdW5jdGlvbihvcHRzKSB7XG4gICAgaWYgKCFvcHRzLmludmFsaWQpIHJldHVybiBvcHRzLm9iamVjdFtvcHRzLmZpZWxkXSA8PSBvcHRzLnZhbHVlO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfSxcbiAgZ3RlOiBmdW5jdGlvbihvcHRzKSB7XG4gICAgaWYgKCFvcHRzLmludmFsaWQpIHJldHVybiBvcHRzLm9iamVjdFtvcHRzLmZpZWxkXSA+PSBvcHRzLnZhbHVlO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfSxcbiAgY29udGFpbnM6IGNvbnRhaW5zLFxuICBpbjogY29udGFpbnNcbn07XG5cbnV0aWwuZXh0ZW5kKFF1ZXJ5LCB7XG4gIGNvbXBhcmF0b3JzOiBjb21wYXJhdG9ycyxcbiAgcmVnaXN0ZXJDb21wYXJhdG9yOiBmdW5jdGlvbihzeW1ib2wsIGZuKSB7XG4gICAgaWYgKCFjb21wYXJhdG9yc1tzeW1ib2xdKSB7XG4gICAgICBjb21wYXJhdG9yc1tzeW1ib2xdID0gZm47XG4gICAgfVxuICB9XG59KTtcblxuZnVuY3Rpb24gY2FjaGVGb3JNb2RlbChtb2RlbCkge1xuICB2YXIgY2FjaGVCeVR5cGUgPSBjYWNoZS5fbG9jYWxDYWNoZUJ5VHlwZTtcbiAgdmFyIG1vZGVsTmFtZSA9IG1vZGVsLm5hbWU7XG4gIHZhciBjb2xsZWN0aW9uTmFtZSA9IG1vZGVsLmNvbGxlY3Rpb25OYW1lO1xuICB2YXIgY2FjaGVCeU1vZGVsID0gY2FjaGVCeVR5cGVbY29sbGVjdGlvbk5hbWVdO1xuICB2YXIgY2FjaGVCeUxvY2FsSWQ7XG4gIGlmIChjYWNoZUJ5TW9kZWwpIHtcbiAgICBjYWNoZUJ5TG9jYWxJZCA9IGNhY2hlQnlNb2RlbFttb2RlbE5hbWVdIHx8IHt9O1xuICB9XG4gIHJldHVybiBjYWNoZUJ5TG9jYWxJZDtcbn1cblxudXRpbC5leHRlbmQoUXVlcnkucHJvdG90eXBlLCB7XG4gIGV4ZWN1dGU6IGZ1bmN0aW9uKGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIHRoaXMuX2V4ZWN1dGVJbk1lbW9yeShjYik7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgX2R1bXA6IGZ1bmN0aW9uKGFzSnNvbikge1xuICAgIHJldHVybiBhc0pzb24gPyAne30nIDoge307XG4gIH0sXG4gIHNvcnRGdW5jOiBmdW5jdGlvbihmaWVsZHMpIHtcbiAgICB2YXIgc29ydEZ1bmMgPSBmdW5jdGlvbihhc2NlbmRpbmcsIGZpZWxkKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24odjEsIHYyKSB7XG4gICAgICAgIHZhciBkMSA9IHYxW2ZpZWxkXSxcbiAgICAgICAgICBkMiA9IHYyW2ZpZWxkXSxcbiAgICAgICAgICByZXM7XG4gICAgICAgIGlmICh0eXBlb2YgZDEgPT0gJ3N0cmluZycgfHwgZDEgaW5zdGFuY2VvZiBTdHJpbmcgJiZcbiAgICAgICAgICB0eXBlb2YgZDIgPT0gJ3N0cmluZycgfHwgZDIgaW5zdGFuY2VvZiBTdHJpbmcpIHtcbiAgICAgICAgICByZXMgPSBhc2NlbmRpbmcgPyBkMS5sb2NhbGVDb21wYXJlKGQyKSA6IGQyLmxvY2FsZUNvbXBhcmUoZDEpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGlmIChkMSBpbnN0YW5jZW9mIERhdGUpIGQxID0gZDEuZ2V0VGltZSgpO1xuICAgICAgICAgIGlmIChkMiBpbnN0YW5jZW9mIERhdGUpIGQyID0gZDIuZ2V0VGltZSgpO1xuICAgICAgICAgIGlmIChhc2NlbmRpbmcpIHJlcyA9IGQxIC0gZDI7XG4gICAgICAgICAgZWxzZSByZXMgPSBkMiAtIGQxO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXM7XG4gICAgICB9XG4gICAgfTtcbiAgICB2YXIgcyA9IHV0aWw7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBmaWVsZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBmaWVsZCA9IGZpZWxkc1tpXTtcbiAgICAgIHMgPSBzLnRoZW5CeShzb3J0RnVuYyhmaWVsZC5hc2NlbmRpbmcsIGZpZWxkLmZpZWxkKSk7XG4gICAgfVxuICAgIHJldHVybiBzID09IHV0aWwgPyBudWxsIDogcztcbiAgfSxcbiAgX3NvcnRSZXN1bHRzOiBmdW5jdGlvbihyZXMpIHtcbiAgICB2YXIgb3JkZXIgPSB0aGlzLm9wdHMub3JkZXI7XG4gICAgaWYgKHJlcyAmJiBvcmRlcikge1xuICAgICAgdmFyIGZpZWxkcyA9IG9yZGVyLm1hcChmdW5jdGlvbihvcmRlcmluZykge1xuICAgICAgICB2YXIgc3BsdCA9IG9yZGVyaW5nLnNwbGl0KCctJyksXG4gICAgICAgICAgYXNjZW5kaW5nID0gdHJ1ZSxcbiAgICAgICAgICBmaWVsZCA9IG51bGw7XG4gICAgICAgIGlmIChzcGx0Lmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICBmaWVsZCA9IHNwbHRbMV07XG4gICAgICAgICAgYXNjZW5kaW5nID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgZmllbGQgPSBzcGx0WzBdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7ZmllbGQ6IGZpZWxkLCBhc2NlbmRpbmc6IGFzY2VuZGluZ307XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgdmFyIHNvcnRGdW5jID0gdGhpcy5zb3J0RnVuYyhmaWVsZHMpO1xuICAgICAgaWYgKHJlcy5pbW11dGFibGUpIHJlcyA9IHJlcy5tdXRhYmxlQ29weSgpO1xuICAgICAgaWYgKHNvcnRGdW5jKSByZXMuc29ydChzb3J0RnVuYyk7XG4gICAgfVxuICAgIHJldHVybiByZXM7XG4gIH0sXG4gIC8qKlxuICAgKiBSZXR1cm4gYWxsIG1vZGVsIGluc3RhbmNlcyBpbiB0aGUgY2FjaGUuXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfZ2V0Q2FjaGVCeUxvY2FsSWQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmRlc2NlbmRhbnRzLnJlZHVjZShmdW5jdGlvbihtZW1vLCBjaGlsZE1vZGVsKSB7XG4gICAgICByZXR1cm4gdXRpbC5leHRlbmQobWVtbywgY2FjaGVGb3JNb2RlbChjaGlsZE1vZGVsKSk7XG4gICAgfSwgdXRpbC5leHRlbmQoe30sIGNhY2hlRm9yTW9kZWwodGhpcy5tb2RlbCkpKTtcbiAgfSxcbiAgX2V4ZWN1dGVJbk1lbW9yeTogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICB2YXIgX2V4ZWN1dGVJbk1lbW9yeSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5tb2RlbFxuICAgICAgICAuX2luZGV4SXNJbnN0YWxsZWRcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIGNhY2hlQnlMb2NhbElkID0gdGhpcy5fZ2V0Q2FjaGVCeUxvY2FsSWQoKTtcbiAgICAgICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKGNhY2hlQnlMb2NhbElkKTtcbiAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgdmFyIHJlcyA9IFtdO1xuICAgICAgICAgIHZhciBlcnI7XG4gICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgayA9IGtleXNbaV07XG4gICAgICAgICAgICB2YXIgb2JqID0gY2FjaGVCeUxvY2FsSWRba107XG4gICAgICAgICAgICB2YXIgbWF0Y2hlcyA9IHNlbGYub2JqZWN0TWF0Y2hlc1F1ZXJ5KG9iaik7XG4gICAgICAgICAgICBpZiAodHlwZW9mKG1hdGNoZXMpID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgIGVyciA9IGVycm9yKG1hdGNoZXMpO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGlmIChtYXRjaGVzKSByZXMucHVzaChvYmopO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXMgPSB0aGlzLl9zb3J0UmVzdWx0cyhyZXMpO1xuICAgICAgICAgIGlmIChlcnIpIGxvZygnRXJyb3IgZXhlY3V0aW5nIHF1ZXJ5JywgZXJyKTtcbiAgICAgICAgICBjYWxsYmFjayhlcnIsIGVyciA/IG51bGwgOiBjb25zdHJ1Y3RRdWVyeVNldChyZXMsIHRoaXMubW9kZWwpKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKVxuICAgICAgICAuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgdmFyIF9lcnIgPSAnVW5hYmxlIHRvIGV4ZWN1dGUgcXVlcnkgZHVlIHRvIGZhaWxlZCBpbmRleCBpbnN0YWxsYXRpb24gb24gTW9kZWwgXCInICtcbiAgICAgICAgICAgIHRoaXMubW9kZWwubmFtZSArICdcIic7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihfZXJyLCBlcnIpO1xuICAgICAgICAgIGNhbGxiYWNrKF9lcnIpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0uYmluZCh0aGlzKTtcbiAgICBpZiAodGhpcy5vcHRzLmlnbm9yZUluc3RhbGxlZCkge1xuICAgICAgX2V4ZWN1dGVJbk1lbW9yeSgpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHNpZXN0YS5fYWZ0ZXJJbnN0YWxsKF9leGVjdXRlSW5NZW1vcnkpO1xuICAgIH1cbiAgfSxcbiAgY2xlYXJPcmRlcmluZzogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5vcHRzLm9yZGVyID0gbnVsbDtcbiAgfSxcbiAgb2JqZWN0TWF0Y2hlc09yUXVlcnk6IGZ1bmN0aW9uKG9iaiwgb3JRdWVyeSkge1xuICAgIGZvciAodmFyIGlkeCBpbiBvclF1ZXJ5KSB7XG4gICAgICBpZiAob3JRdWVyeS5oYXNPd25Qcm9wZXJ0eShpZHgpKSB7XG4gICAgICAgIHZhciBxdWVyeSA9IG9yUXVlcnlbaWR4XTtcbiAgICAgICAgaWYgKHRoaXMub2JqZWN0TWF0Y2hlc0Jhc2VRdWVyeShvYmosIHF1ZXJ5KSkge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfSxcbiAgb2JqZWN0TWF0Y2hlc0FuZFF1ZXJ5OiBmdW5jdGlvbihvYmosIGFuZFF1ZXJ5KSB7XG4gICAgZm9yICh2YXIgaWR4IGluIGFuZFF1ZXJ5KSB7XG4gICAgICBpZiAoYW5kUXVlcnkuaGFzT3duUHJvcGVydHkoaWR4KSkge1xuICAgICAgICB2YXIgcXVlcnkgPSBhbmRRdWVyeVtpZHhdO1xuICAgICAgICBpZiAoIXRoaXMub2JqZWN0TWF0Y2hlc0Jhc2VRdWVyeShvYmosIHF1ZXJ5KSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSxcbiAgc3BsaXRNYXRjaGVzOiBmdW5jdGlvbihvYmosIHVucHJvY2Vzc2VkRmllbGQsIHZhbHVlKSB7XG4gICAgdmFyIG9wID0gJ2UnO1xuICAgIHZhciBmaWVsZHMgPSB1bnByb2Nlc3NlZEZpZWxkLnNwbGl0KCcuJyk7XG4gICAgdmFyIHNwbHQgPSBmaWVsZHNbZmllbGRzLmxlbmd0aCAtIDFdLnNwbGl0KCdfXycpO1xuICAgIGlmIChzcGx0Lmxlbmd0aCA9PSAyKSB7XG4gICAgICB2YXIgZmllbGQgPSBzcGx0WzBdO1xuICAgICAgb3AgPSBzcGx0WzFdO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGZpZWxkID0gc3BsdFswXTtcbiAgICB9XG4gICAgZmllbGRzW2ZpZWxkcy5sZW5ndGggLSAxXSA9IGZpZWxkO1xuICAgIGZpZWxkcy5zbGljZSgwLCBmaWVsZHMubGVuZ3RoIC0gMSkuZm9yRWFjaChmdW5jdGlvbihmKSB7XG4gICAgICBpZiAodXRpbC5pc0FycmF5KG9iaikpIHtcbiAgICAgICAgb2JqID0gdXRpbC5wbHVjayhvYmosIGYpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIG9iaiA9IG9ialtmXTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICAvLyBJZiB3ZSBnZXQgdG8gdGhlIHBvaW50IHdoZXJlIHdlJ3JlIGFib3V0IHRvIGluZGV4IG51bGwgb3IgdW5kZWZpbmVkIHdlIHN0b3AgLSBvYnZpb3VzbHkgdGhpcyBvYmplY3QgZG9lc1xuICAgIC8vIG5vdCBtYXRjaCB0aGUgcXVlcnkuXG4gICAgdmFyIG5vdE51bGxPclVuZGVmaW5lZCA9IG9iaiAhPSB1bmRlZmluZWQ7XG4gICAgaWYgKG5vdE51bGxPclVuZGVmaW5lZCkge1xuICAgICAgaWYgKHV0aWwuaXNBcnJheShvYmopKSB7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdmFyIHZhbCA9IG9ialtmaWVsZF07XG4gICAgICAgIHZhciBpbnZhbGlkID0gdXRpbC5pc0FycmF5KHZhbCkgPyBmYWxzZSA6IHZhbCA9PT0gbnVsbCB8fCB2YWwgPT09IHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICAgIHZhciBjb21wYXJhdG9yID0gUXVlcnkuY29tcGFyYXRvcnNbb3BdLFxuICAgICAgICBvcHRzID0ge29iamVjdDogb2JqLCBmaWVsZDogZmllbGQsIHZhbHVlOiB2YWx1ZSwgaW52YWxpZDogaW52YWxpZH07XG4gICAgICBpZiAoIWNvbXBhcmF0b3IpIHtcbiAgICAgICAgcmV0dXJuICdObyBjb21wYXJhdG9yIHJlZ2lzdGVyZWQgZm9yIHF1ZXJ5IG9wZXJhdGlvbiBcIicgKyBvcCArICdcIic7XG4gICAgICB9XG4gICAgICByZXR1cm4gY29tcGFyYXRvcihvcHRzKTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9LFxuICBvYmplY3RNYXRjaGVzOiBmdW5jdGlvbihvYmosIHVucHJvY2Vzc2VkRmllbGQsIHZhbHVlLCBxdWVyeSkge1xuICAgIGlmICh1bnByb2Nlc3NlZEZpZWxkID09ICckb3InKSB7XG4gICAgICB2YXIgJG9yID0gcXVlcnlbJyRvciddO1xuICAgICAgaWYgKCF1dGlsLmlzQXJyYXkoJG9yKSkge1xuICAgICAgICAkb3IgPSBPYmplY3Qua2V5cygkb3IpLm1hcChmdW5jdGlvbihrKSB7XG4gICAgICAgICAgdmFyIG5vcm1hbGlzZWQgPSB7fTtcbiAgICAgICAgICBub3JtYWxpc2VkW2tdID0gJG9yW2tdO1xuICAgICAgICAgIHJldHVybiBub3JtYWxpc2VkO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGlmICghdGhpcy5vYmplY3RNYXRjaGVzT3JRdWVyeShvYmosICRvcikpIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgZWxzZSBpZiAodW5wcm9jZXNzZWRGaWVsZCA9PSAnJGFuZCcpIHtcbiAgICAgIGlmICghdGhpcy5vYmplY3RNYXRjaGVzQW5kUXVlcnkob2JqLCBxdWVyeVsnJGFuZCddKSkgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHZhciBtYXRjaGVzID0gdGhpcy5zcGxpdE1hdGNoZXMob2JqLCB1bnByb2Nlc3NlZEZpZWxkLCB2YWx1ZSk7XG4gICAgICBpZiAodHlwZW9mIG1hdGNoZXMgIT0gJ2Jvb2xlYW4nKSByZXR1cm4gbWF0Y2hlcztcbiAgICAgIGlmICghbWF0Y2hlcykgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSxcbiAgb2JqZWN0TWF0Y2hlc0Jhc2VRdWVyeTogZnVuY3Rpb24ob2JqLCBxdWVyeSkge1xuICAgIHZhciBmaWVsZHMgPSBPYmplY3Qua2V5cyhxdWVyeSk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBmaWVsZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciB1bnByb2Nlc3NlZEZpZWxkID0gZmllbGRzW2ldLFxuICAgICAgICB2YWx1ZSA9IHF1ZXJ5W3VucHJvY2Vzc2VkRmllbGRdO1xuICAgICAgdmFyIHJ0ID0gdGhpcy5vYmplY3RNYXRjaGVzKG9iaiwgdW5wcm9jZXNzZWRGaWVsZCwgdmFsdWUsIHF1ZXJ5KTtcbiAgICAgIGlmICh0eXBlb2YgcnQgIT0gJ2Jvb2xlYW4nKSByZXR1cm4gcnQ7XG4gICAgICBpZiAoIXJ0KSByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9LFxuICBvYmplY3RNYXRjaGVzUXVlcnk6IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiB0aGlzLm9iamVjdE1hdGNoZXNCYXNlUXVlcnkob2JqLCB0aGlzLnF1ZXJ5KTtcbiAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gUXVlcnk7XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvUXVlcnkuanNcbiAqKiBtb2R1bGUgaWQgPSAxNVxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgUHJvbWlzZSA9IHV0aWwuUHJvbWlzZSxcbiAgZXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJyksXG4gIE1vZGVsSW5zdGFuY2UgPSByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKTtcblxuLypcbiBUT0RPOiBVc2UgRVM2IFByb3h5IGluc3RlYWQuXG4gRXZlbnR1YWxseSBxdWVyeSBzZXRzIHNob3VsZCB1c2UgRVM2IFByb3hpZXMgd2hpY2ggd2lsbCBiZSBtdWNoIG1vcmUgbmF0dXJhbCBhbmQgcm9idXN0LiBFLmcuIG5vIG5lZWQgZm9yIHRoZSBiZWxvd1xuICovXG52YXIgQVJSQVlfTUVUSE9EUyA9IFsncHVzaCcsICdzb3J0JywgJ3JldmVyc2UnLCAnc3BsaWNlJywgJ3NoaWZ0JywgJ3Vuc2hpZnQnXSxcbiAgTlVNQkVSX01FVEhPRFMgPSBbJ3RvU3RyaW5nJywgJ3RvRXhwb25lbnRpYWwnLCAndG9GaXhlZCcsICd0b1ByZWNpc2lvbicsICd2YWx1ZU9mJ10sXG4gIE5VTUJFUl9QUk9QRVJUSUVTID0gWydNQVhfVkFMVUUnLCAnTUlOX1ZBTFVFJywgJ05FR0FUSVZFX0lORklOSVRZJywgJ05hTicsICdQT1NJVElWRV9JTkZJTklUWSddLFxuICBTVFJJTkdfTUVUSE9EUyA9IFsnY2hhckF0JywgJ2NoYXJDb2RlQXQnLCAnY29uY2F0JywgJ2Zyb21DaGFyQ29kZScsICdpbmRleE9mJywgJ2xhc3RJbmRleE9mJywgJ2xvY2FsZUNvbXBhcmUnLFxuICAgICdtYXRjaCcsICdyZXBsYWNlJywgJ3NlYXJjaCcsICdzbGljZScsICdzcGxpdCcsICdzdWJzdHInLCAnc3Vic3RyaW5nJywgJ3RvTG9jYWxlTG93ZXJDYXNlJywgJ3RvTG9jYWxlVXBwZXJDYXNlJyxcbiAgICAndG9Mb3dlckNhc2UnLCAndG9TdHJpbmcnLCAndG9VcHBlckNhc2UnLCAndHJpbScsICd2YWx1ZU9mJ10sXG4gIFNUUklOR19QUk9QRVJUSUVTID0gWydsZW5ndGgnXTtcblxuLyoqXG4gKiBSZXR1cm4gdGhlIHByb3BlcnR5IG5hbWVzIGZvciBhIGdpdmVuIG9iamVjdC4gSGFuZGxlcyBzcGVjaWFsIGNhc2VzIHN1Y2ggYXMgc3RyaW5ncyBhbmQgbnVtYmVycyB0aGF0IGRvIG5vdCBoYXZlXG4gKiB0aGUgZ2V0T3duUHJvcGVydHlOYW1lcyBmdW5jdGlvbi5cbiAqIFRoZSBzcGVjaWFsIGNhc2VzIGFyZSB2ZXJ5IG11Y2ggaGFja3MuIFRoaXMgaGFjayBjYW4gYmUgcmVtb3ZlZCBvbmNlIHRoZSBQcm94eSBvYmplY3QgaXMgbW9yZSB3aWRlbHkgYWRvcHRlZC5cbiAqIEBwYXJhbSBvYmplY3RcbiAqIEByZXR1cm5zIHtBcnJheX1cbiAqL1xuZnVuY3Rpb24gZ2V0UHJvcGVydHlOYW1lcyhvYmplY3QpIHtcbiAgdmFyIHByb3BlcnR5TmFtZXM7XG4gIGlmICh0eXBlb2Ygb2JqZWN0ID09ICdzdHJpbmcnIHx8IG9iamVjdCBpbnN0YW5jZW9mIFN0cmluZykge1xuICAgIHByb3BlcnR5TmFtZXMgPSBTVFJJTkdfTUVUSE9EUy5jb25jYXQoU1RSSU5HX1BST1BFUlRJRVMpO1xuICB9XG4gIGVsc2UgaWYgKHR5cGVvZiBvYmplY3QgPT0gJ251bWJlcicgfHwgb2JqZWN0IGluc3RhbmNlb2YgTnVtYmVyKSB7XG4gICAgcHJvcGVydHlOYW1lcyA9IE5VTUJFUl9NRVRIT0RTLmNvbmNhdChOVU1CRVJfUFJPUEVSVElFUyk7XG4gIH1cbiAgZWxzZSB7XG4gICAgcHJvcGVydHlOYW1lcyA9IG9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKCk7XG4gIH1cbiAgcmV0dXJuIHByb3BlcnR5TmFtZXM7XG59XG5cbi8qKlxuICogRGVmaW5lIGEgcHJveHkgcHJvcGVydHkgdG8gYXR0cmlidXRlcyBvbiBvYmplY3RzIGluIHRoZSBhcnJheVxuICogQHBhcmFtIGFyclxuICogQHBhcmFtIHByb3BcbiAqL1xuZnVuY3Rpb24gZGVmaW5lQXR0cmlidXRlKGFyciwgcHJvcCkge1xuICBpZiAoIShwcm9wIGluIGFycikpIHsgLy8gZS5nLiB3ZSBjYW5ub3QgcmVkZWZpbmUgLmxlbmd0aFxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShhcnIsIHByb3AsIHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBxdWVyeVNldCh1dGlsLnBsdWNrKGFyciwgcHJvcCkpO1xuICAgICAgfSxcbiAgICAgIHNldDogZnVuY3Rpb24odikge1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KHYpKSB7XG4gICAgICAgICAgaWYgKHRoaXMubGVuZ3RoICE9IHYubGVuZ3RoKSB0aHJvdyBlcnJvcih7bWVzc2FnZTogJ011c3QgYmUgc2FtZSBsZW5ndGgnfSk7XG4gICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB2Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzW2ldW3Byb3BdID0gdltpXTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgZm9yIChpID0gMDsgaSA8IHRoaXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXNbaV1bcHJvcF0gPSB2O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzUHJvbWlzZShvYmopIHtcbiAgLy8gVE9ETzogRG9uJ3QgdGhpbmsgdGhpcyBpcyB2ZXJ5IHJvYnVzdC5cbiAgcmV0dXJuIG9iai50aGVuICYmIG9iai5jYXRjaDtcbn1cblxuLyoqXG4gKiBEZWZpbmUgYSBwcm94eSBtZXRob2Qgb24gdGhlIGFycmF5IGlmIG5vdCBhbHJlYWR5IGluIGV4aXN0ZW5jZS5cbiAqIEBwYXJhbSBhcnJcbiAqIEBwYXJhbSBwcm9wXG4gKi9cbmZ1bmN0aW9uIGRlZmluZU1ldGhvZChhcnIsIHByb3ApIHtcbiAgaWYgKCEocHJvcCBpbiBhcnIpKSB7IC8vIGUuZy4gd2UgZG9uJ3Qgd2FudCB0byByZWRlZmluZSB0b1N0cmluZ1xuICAgIGFycltwcm9wXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGFyZ3MgPSBhcmd1bWVudHMsXG4gICAgICAgIHJlcyA9IHRoaXMubWFwKGZ1bmN0aW9uKHApIHtcbiAgICAgICAgICByZXR1cm4gcFtwcm9wXS5hcHBseShwLCBhcmdzKTtcbiAgICAgICAgfSk7XG4gICAgICB2YXIgYXJlUHJvbWlzZXMgPSBmYWxzZTtcbiAgICAgIGlmIChyZXMubGVuZ3RoKSBhcmVQcm9taXNlcyA9IGlzUHJvbWlzZShyZXNbMF0pO1xuICAgICAgcmV0dXJuIGFyZVByb21pc2VzID8gUHJvbWlzZS5hbGwocmVzKSA6IHF1ZXJ5U2V0KHJlcyk7XG4gICAgfTtcbiAgfVxufVxuXG4vKipcbiAqIFRyYW5zZm9ybSB0aGUgYXJyYXkgaW50byBhIHF1ZXJ5IHNldC5cbiAqIFJlbmRlcnMgdGhlIGFycmF5IGltbXV0YWJsZS5cbiAqIEBwYXJhbSBhcnJcbiAqIEBwYXJhbSBtb2RlbCAtIFRoZSBtb2RlbCB3aXRoIHdoaWNoIHRvIHByb3h5IHRvXG4gKi9cbmZ1bmN0aW9uIG1vZGVsUXVlcnlTZXQoYXJyLCBtb2RlbCkge1xuICBhcnIgPSB1dGlsLmV4dGVuZChbXSwgYXJyKTtcbiAgdmFyIGF0dHJpYnV0ZU5hbWVzID0gbW9kZWwuX2F0dHJpYnV0ZU5hbWVzLFxuICAgIHJlbGF0aW9uc2hpcE5hbWVzID0gbW9kZWwuX3JlbGF0aW9uc2hpcE5hbWVzLFxuICAgIG5hbWVzID0gYXR0cmlidXRlTmFtZXMuY29uY2F0KHJlbGF0aW9uc2hpcE5hbWVzKS5jb25jYXQoaW5zdGFuY2VNZXRob2RzKTtcbiAgbmFtZXMuZm9yRWFjaChkZWZpbmVBdHRyaWJ1dGUuYmluZChkZWZpbmVBdHRyaWJ1dGUsIGFycikpO1xuICB2YXIgaW5zdGFuY2VNZXRob2RzID0gT2JqZWN0LmtleXMoTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUpO1xuICBpbnN0YW5jZU1ldGhvZHMuZm9yRWFjaChkZWZpbmVNZXRob2QuYmluZChkZWZpbmVNZXRob2QsIGFycikpO1xuICByZXR1cm4gcmVuZGVySW1tdXRhYmxlKGFycik7XG59XG5cbi8qKlxuICogVHJhbnNmb3JtIHRoZSBhcnJheSBpbnRvIGEgcXVlcnkgc2V0LCBiYXNlZCBvbiB3aGF0ZXZlciBpcyBpbiBpdC5cbiAqIE5vdGUgdGhhdCBhbGwgb2JqZWN0cyBtdXN0IGJlIG9mIHRoZSBzYW1lIHR5cGUuIFRoaXMgZnVuY3Rpb24gd2lsbCB0YWtlIHRoZSBmaXJzdCBvYmplY3QgYW5kIGRlY2lkZSBob3cgdG8gcHJveHlcbiAqIGJhc2VkIG9uIHRoYXQuXG4gKiBAcGFyYW0gYXJyXG4gKi9cbmZ1bmN0aW9uIHF1ZXJ5U2V0KGFycikge1xuICBpZiAoYXJyLmxlbmd0aCkge1xuICAgIHZhciByZWZlcmVuY2VPYmplY3QgPSBhcnJbMF0sXG4gICAgICBwcm9wZXJ0eU5hbWVzID0gZ2V0UHJvcGVydHlOYW1lcyhyZWZlcmVuY2VPYmplY3QpO1xuICAgIHByb3BlcnR5TmFtZXMuZm9yRWFjaChmdW5jdGlvbihwcm9wKSB7XG4gICAgICBpZiAodHlwZW9mIHJlZmVyZW5jZU9iamVjdFtwcm9wXSA9PSAnZnVuY3Rpb24nKSBkZWZpbmVNZXRob2QoYXJyLCBwcm9wLCBhcmd1bWVudHMpO1xuICAgICAgZWxzZSBkZWZpbmVBdHRyaWJ1dGUoYXJyLCBwcm9wKTtcbiAgICB9KTtcbiAgfVxuICByZXR1cm4gcmVuZGVySW1tdXRhYmxlKGFycik7XG59XG5cbmZ1bmN0aW9uIHRocm93SW1tdXRhYmxlRXJyb3IoKSB7XG4gIHRocm93IG5ldyBFcnJvcignQ2Fubm90IG1vZGlmeSBhIHF1ZXJ5IHNldCcpO1xufVxuXG4vKipcbiAqIFJlbmRlciBhbiBhcnJheSBpbW11dGFibGUgYnkgcmVwbGFjaW5nIGFueSBmdW5jdGlvbnMgdGhhdCBjYW4gbXV0YXRlIGl0LlxuICogQHBhcmFtIGFyclxuICovXG5mdW5jdGlvbiByZW5kZXJJbW11dGFibGUoYXJyKSB7XG4gIEFSUkFZX01FVEhPRFMuZm9yRWFjaChmdW5jdGlvbihwKSB7XG4gICAgYXJyW3BdID0gdGhyb3dJbW11dGFibGVFcnJvcjtcbiAgfSk7XG4gIGFyci5pbW11dGFibGUgPSB0cnVlO1xuICBhcnIubXV0YWJsZUNvcHkgPSBhcnIuYXNBcnJheSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBtdXRhYmxlQXJyID0gdGhpcy5tYXAoZnVuY3Rpb24oeCkge3JldHVybiB4fSk7XG4gICAgbXV0YWJsZUFyci5hc1F1ZXJ5U2V0ID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gcXVlcnlTZXQodGhpcyk7XG4gICAgfTtcbiAgICBtdXRhYmxlQXJyLmFzTW9kZWxRdWVyeVNldCA9IGZ1bmN0aW9uKG1vZGVsKSB7XG4gICAgICByZXR1cm4gbW9kZWxRdWVyeVNldCh0aGlzLCBtb2RlbCk7XG4gICAgfTtcbiAgICByZXR1cm4gbXV0YWJsZUFycjtcbiAgfTtcbiAgcmV0dXJuIGFycjtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBtb2RlbFF1ZXJ5U2V0O1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL1F1ZXJ5U2V0LmpzXG4gKiogbW9kdWxlIGlkID0gMTZcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIi8qKlxuICogRGVhZCBzaW1wbGUgbG9nZ2luZyBzZXJ2aWNlIGJhc2VkIG9uIHZpc2lvbm1lZGlhL2RlYnVnXG4gKiBAbW9kdWxlIGxvZ1xuICovXG5cbnZhciBkZWJ1ZyA9IHJlcXVpcmUoJ2RlYnVnJyksXG4gIGFyZ3NhcnJheSA9IHJlcXVpcmUoJ2FyZ3NhcnJheScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgdmFyIGxvZyA9IGRlYnVnKCdzaWVzdGE6JyArIG5hbWUpO1xuICB2YXIgZm4gPSBhcmdzYXJyYXkoZnVuY3Rpb24oYXJncykge1xuICAgIGxvZy5jYWxsKGxvZywgYXJncyk7XG4gIH0pO1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZm4sICdlbmFibGVkJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gZGVidWcuZW5hYmxlZChuYW1lKTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gZm47XG59O1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL2xvZy5qc1xuICoqIG1vZHVsZSBpZCA9IDE3XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSxcbiAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICBlcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKSxcbiAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gIE1vZGVsRXZlbnRUeXBlID0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUsXG4gIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpO1xuXG5mdW5jdGlvbiBNb2RlbEluc3RhbmNlKG1vZGVsKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdGhpcy5tb2RlbCA9IG1vZGVsO1xuXG4gIHV0aWwuc3ViUHJvcGVydGllcyh0aGlzLCB0aGlzLm1vZGVsLCBbXG4gICAgJ2NvbGxlY3Rpb24nLFxuICAgICdjb2xsZWN0aW9uTmFtZScsXG4gICAgJ19hdHRyaWJ1dGVOYW1lcycsXG4gICAge1xuICAgICAgbmFtZTogJ2lkRmllbGQnLFxuICAgICAgcHJvcGVydHk6ICdpZCdcbiAgICB9LFxuICAgIHtcbiAgICAgIG5hbWU6ICdtb2RlbE5hbWUnLFxuICAgICAgcHJvcGVydHk6ICduYW1lJ1xuICAgIH1cbiAgXSk7XG5cbiAgZXZlbnRzLlByb3h5RXZlbnRFbWl0dGVyLmNhbGwodGhpcyk7XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXModGhpcywge1xuICAgIF9yZWxhdGlvbnNoaXBOYW1lczoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHByb3hpZXMgPSBPYmplY3Qua2V5cyhzZWxmLl9fcHJveGllcyB8fCB7fSkubWFwKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICByZXR1cm4gc2VsZi5fX3Byb3hpZXNbeF1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBwcm94aWVzLm1hcChmdW5jdGlvbihwKSB7XG4gICAgICAgICAgaWYgKHAuaXNGb3J3YXJkKSB7XG4gICAgICAgICAgICByZXR1cm4gcC5mb3J3YXJkTmFtZTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHAucmV2ZXJzZU5hbWU7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSxcbiAgICBkaXJ0eToge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQpIHtcbiAgICAgICAgICByZXR1cm4gc2VsZi5sb2NhbElkIGluIHNpZXN0YS5leHQuc3RvcmFnZS5fdW5zYXZlZE9iamVjdHNIYXNoO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSxcbiAgICAvLyBUaGlzIGlzIGZvciBQcm94eUV2ZW50RW1pdHRlci5cbiAgICBldmVudDoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubG9jYWxJZFxuICAgICAgfVxuICAgIH1cbiAgfSk7XG5cbiAgdGhpcy5yZW1vdmVkID0gZmFsc2U7XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgb3Igbm90IGV2ZW50cyAoc2V0LCByZW1vdmUgZXRjKSBhcmUgZW1pdHRlZCBmb3IgdGhpcyBtb2RlbCBpbnN0YW5jZS5cbiAgICpcbiAgICogVGhpcyBpcyB1c2VkIGFzIGEgd2F5IG9mIGNvbnRyb2xsaW5nIHdoYXQgZXZlbnRzIGFyZSBlbWl0dGVkIHdoZW4gdGhlIG1vZGVsIGluc3RhbmNlIGlzIGNyZWF0ZWQuIEUuZy4gd2UgZG9uJ3RcbiAgICogd2FudCB0byBzZW5kIGEgbWV0cmljIHNoaXQgdG9uIG9mICdzZXQnIGV2ZW50cyBpZiB3ZSdyZSBuZXdseSBjcmVhdGluZyBhbiBpbnN0YW5jZS4gV2Ugb25seSB3YW50IHRvIHNlbmQgdGhlXG4gICAqICduZXcnIGV2ZW50IG9uY2UgY29uc3RydWN0ZWQuXG4gICAqXG4gICAqIFRoaXMgaXMgcHJvYmFibHkgYSBiaXQgb2YgYSBoYWNrIGFuZCBzaG91bGQgYmUgcmVtb3ZlZCBldmVudHVhbGx5LlxuICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICogQHByaXZhdGVcbiAgICovXG4gIHRoaXMuX2VtaXRFdmVudHMgPSBmYWxzZTtcbn1cblxuTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKGV2ZW50cy5Qcm94eUV2ZW50RW1pdHRlci5wcm90b3R5cGUpO1xuXG51dGlsLmV4dGVuZChNb2RlbEluc3RhbmNlLnByb3RvdHlwZSwge1xuICBnZXQ6IGZ1bmN0aW9uKGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIGNiKG51bGwsIHRoaXMpO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG4gIGVtaXQ6IGZ1bmN0aW9uKHR5cGUsIG9wdHMpIHtcbiAgICBpZiAodHlwZW9mIHR5cGUgPT0gJ29iamVjdCcpIG9wdHMgPSB0eXBlO1xuICAgIGVsc2Ugb3B0cy50eXBlID0gdHlwZTtcbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICB1dGlsLmV4dGVuZChvcHRzLCB7XG4gICAgICBjb2xsZWN0aW9uOiB0aGlzLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgbW9kZWw6IHRoaXMubW9kZWwubmFtZSxcbiAgICAgIGxvY2FsSWQ6IHRoaXMubG9jYWxJZCxcbiAgICAgIG9iajogdGhpc1xuICAgIH0pO1xuICAgIG1vZGVsRXZlbnRzLmVtaXQob3B0cyk7XG4gIH0sXG4gIHJlbW92ZTogZnVuY3Rpb24oY2IsIG5vdGlmaWNhdGlvbikge1xuICAgIF8uZWFjaCh0aGlzLl9yZWxhdGlvbnNoaXBOYW1lcywgZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgIGlmICh1dGlsLmlzQXJyYXkodGhpc1tuYW1lXSkpIHtcbiAgICAgICAgdGhpc1tuYW1lXSA9IFtdO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHRoaXNbbmFtZV0gPSBudWxsO1xuICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG4gICAgbm90aWZpY2F0aW9uID0gbm90aWZpY2F0aW9uID09IG51bGwgPyB0cnVlIDogbm90aWZpY2F0aW9uO1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICBjYWNoZS5yZW1vdmUodGhpcyk7XG4gICAgICB0aGlzLnJlbW92ZWQgPSB0cnVlO1xuICAgICAgaWYgKG5vdGlmaWNhdGlvbikge1xuICAgICAgICB0aGlzLmVtaXQobW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuUmVtb3ZlLCB7XG4gICAgICAgICAgb2xkOiB0aGlzXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgdmFyIHJlbW92ZSA9IHRoaXMubW9kZWwucmVtb3ZlO1xuICAgICAgaWYgKHJlbW92ZSkge1xuICAgICAgICB2YXIgcGFyYW1OYW1lcyA9IHV0aWwucGFyYW1OYW1lcyhyZW1vdmUpO1xuICAgICAgICBpZiAocGFyYW1OYW1lcy5sZW5ndGgpIHtcbiAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgcmVtb3ZlLmNhbGwodGhpcywgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICBjYihlcnIsIHNlbGYpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHJlbW92ZS5jYWxsKHRoaXMpO1xuICAgICAgICAgIGNiKG51bGwsIHRoaXMpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY2IobnVsbCwgdGhpcyk7XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgcmVzdG9yZTogZnVuY3Rpb24oY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgdmFyIF9maW5pc2ggPSBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICB0aGlzLmVtaXQobW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuTmV3LCB7XG4gICAgICAgICAgICBuZXc6IHRoaXNcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBjYihlcnIsIHRoaXMpO1xuICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgaWYgKHRoaXMucmVtb3ZlZCkge1xuICAgICAgICBjYWNoZS5pbnNlcnQodGhpcyk7XG4gICAgICAgIHRoaXMucmVtb3ZlZCA9IGZhbHNlO1xuICAgICAgICB2YXIgaW5pdCA9IHRoaXMubW9kZWwuaW5pdDtcbiAgICAgICAgaWYgKGluaXQpIHtcbiAgICAgICAgICB2YXIgcGFyYW1OYW1lcyA9IHV0aWwucGFyYW1OYW1lcyhpbml0KTtcbiAgICAgICAgICB2YXIgZnJvbVN0b3JhZ2UgPSB0cnVlO1xuICAgICAgICAgIGlmIChwYXJhbU5hbWVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgIGluaXQuY2FsbCh0aGlzLCBmcm9tU3RvcmFnZSwgX2ZpbmlzaCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaW5pdC5jYWxsKHRoaXMsIGZyb21TdG9yYWdlKTtcbiAgICAgICAgICAgIF9maW5pc2goKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgX2ZpbmlzaCgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfVxufSk7XG5cbi8vIEluc3BlY3Rpb25cbnV0aWwuZXh0ZW5kKE1vZGVsSW5zdGFuY2UucHJvdG90eXBlLCB7XG4gIGdldEF0dHJpYnV0ZXM6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB1dGlsLmV4dGVuZCh7fSwgdGhpcy5fX3ZhbHVlcyk7XG4gIH0sXG4gIGlzSW5zdGFuY2VPZjogZnVuY3Rpb24obW9kZWwpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbCA9PSBtb2RlbDtcbiAgfSxcbiAgaXNBOiBmdW5jdGlvbihtb2RlbCkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsID09IG1vZGVsIHx8IHRoaXMubW9kZWwuaXNEZXNjZW5kYW50T2YobW9kZWwpO1xuICB9XG59KTtcblxuLy8gRHVtcFxudXRpbC5leHRlbmQoTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUsIHtcbiAgX2R1bXBTdHJpbmc6IGZ1bmN0aW9uKHJldmVyc2VSZWxhdGlvbnNoaXBzKSB7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHRoaXMuX2R1bXAocmV2ZXJzZVJlbGF0aW9uc2hpcHMsIG51bGwsIDQpKTtcbiAgfSxcbiAgX2R1bXA6IGZ1bmN0aW9uKHJldmVyc2VSZWxhdGlvbnNoaXBzKSB7XG4gICAgdmFyIGR1bXBlZCA9IHV0aWwuZXh0ZW5kKHt9LCB0aGlzLl9fdmFsdWVzKTtcbiAgICBkdW1wZWQuX3JldiA9IHRoaXMuX3JldjtcbiAgICBkdW1wZWQubG9jYWxJZCA9IHRoaXMubG9jYWxJZDtcbiAgICByZXR1cm4gZHVtcGVkO1xuICB9XG59KTtcblxuLy8gU2VyaWFsaXNhdGlvblxudXRpbC5leHRlbmQoTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUsIHtcbiAgX2RlZmF1bHRTZXJpYWxpc2U6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICB2YXIgc2VyaWFsaXNlZCA9IHt9O1xuICAgIHZhciBpbmNsdWRlTnVsbEF0dHJpYnV0ZXMgPSBvcHRzLmluY2x1ZGVOdWxsQXR0cmlidXRlcyAhPT0gdW5kZWZpbmVkID8gb3B0cy5pbmNsdWRlTnVsbEF0dHJpYnV0ZXMgOiB0cnVlLFxuICAgICAgaW5jbHVkZU51bGxSZWxhdGlvbnNoaXBzID0gb3B0cy5pbmNsdWRlTnVsbFJlbGF0aW9uc2hpcHMgIT09IHVuZGVmaW5lZCA/IG9wdHMuaW5jbHVkZU51bGxSZWxhdGlvbnNoaXBzIDogdHJ1ZTtcbiAgICB2YXIgc2VyaWFsaXNhYmxlRmllbGRzID0gdGhpcy5tb2RlbC5zZXJpYWxpc2FibGVGaWVsZHMgfHxcbiAgICAgIHRoaXMuX2F0dHJpYnV0ZU5hbWVzLmNvbmNhdC5hcHBseSh0aGlzLl9hdHRyaWJ1dGVOYW1lcywgdGhpcy5fcmVsYXRpb25zaGlwTmFtZXMpLmNvbmNhdCh0aGlzLmlkKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGVOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uKGF0dHJOYW1lKSB7XG4gICAgICBpZiAoc2VyaWFsaXNhYmxlRmllbGRzLmluZGV4T2YoYXR0ck5hbWUpID4gLTEpIHtcbiAgICAgICAgdmFyIGF0dHJEZWZpbml0aW9uID0gdGhpcy5tb2RlbC5fYXR0cmlidXRlRGVmaW5pdGlvbldpdGhOYW1lKGF0dHJOYW1lKSB8fCB7fTtcbiAgICAgICAgdmFyIHNlcmlhbGlzZXI7XG4gICAgICAgIGlmIChhdHRyRGVmaW5pdGlvbi5zZXJpYWxpc2UpIHNlcmlhbGlzZXIgPSBhdHRyRGVmaW5pdGlvbi5zZXJpYWxpc2UuYmluZCh0aGlzKTtcbiAgICAgICAgZWxzZSBzZXJpYWxpc2VyID0gdGhpcy5tb2RlbC5zZXJpYWxpc2VGaWVsZC5iaW5kKHRoaXMsIGF0dHJOYW1lKTtcbiAgICAgICAgdmFyIHZhbCA9IHRoaXNbYXR0ck5hbWVdO1xuICAgICAgICBpZiAodmFsID09PSBudWxsKSB7XG4gICAgICAgICAgaWYgKGluY2x1ZGVOdWxsQXR0cmlidXRlcykge1xuICAgICAgICAgICAgc2VyaWFsaXNlZFthdHRyTmFtZV0gPSBzZXJpYWxpc2VyKHZhbCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHZhbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgc2VyaWFsaXNlZFthdHRyTmFtZV0gPSBzZXJpYWxpc2VyKHZhbCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpO1xuICAgIHRoaXMuX3JlbGF0aW9uc2hpcE5hbWVzLmZvckVhY2goZnVuY3Rpb24ocmVsTmFtZSkge1xuICAgICAgaWYgKHNlcmlhbGlzYWJsZUZpZWxkcy5pbmRleE9mKHJlbE5hbWUpID4gLTEpIHtcbiAgICAgICAgdmFyIHZhbCA9IHRoaXNbcmVsTmFtZV0sXG4gICAgICAgICAgcmVsID0gdGhpcy5tb2RlbC5yZWxhdGlvbnNoaXBzW3JlbE5hbWVdO1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KHZhbCkpIHtcbiAgICAgICAgICB2YWwgPSB1dGlsLnBsdWNrKHZhbCwgdGhpcy5tb2RlbC5pZCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodmFsKSB7XG4gICAgICAgICAgdmFsID0gdmFsW3RoaXMubW9kZWwuaWRdO1xuICAgICAgICB9XG4gICAgICAgIGlmIChyZWwgJiYgIXJlbC5pc1JldmVyc2UpIHtcbiAgICAgICAgICB2YXIgc2VyaWFsaXNlcjtcbiAgICAgICAgICBpZiAocmVsLnNlcmlhbGlzZSkgc2VyaWFsaXNlciA9IHJlbC5zZXJpYWxpc2UuYmluZCh0aGlzKTtcbiAgICAgICAgICBlbHNlIHNlcmlhbGlzZXIgPSB0aGlzLm1vZGVsLnNlcmlhbGlzZUZpZWxkLmJpbmQodGhpcywgcmVsTmFtZSk7XG4gICAgICAgICAgaWYgKHZhbCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgaWYgKGluY2x1ZGVOdWxsUmVsYXRpb25zaGlwcykge1xuICAgICAgICAgICAgICBzZXJpYWxpc2VkW3JlbE5hbWVdID0gc2VyaWFsaXNlcih2YWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIGlmICh1dGlsLmlzQXJyYXkodmFsKSkge1xuICAgICAgICAgICAgaWYgKChpbmNsdWRlTnVsbFJlbGF0aW9uc2hpcHMgJiYgIXZhbC5sZW5ndGgpIHx8IHZhbC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgc2VyaWFsaXNlZFtyZWxOYW1lXSA9IHNlcmlhbGlzZXIodmFsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSBpZiAodmFsICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHNlcmlhbGlzZWRbcmVsTmFtZV0gPSBzZXJpYWxpc2VyKHZhbCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgICByZXR1cm4gc2VyaWFsaXNlZDtcbiAgfSxcbiAgc2VyaWFsaXNlOiBmdW5jdGlvbihvcHRzKSB7XG4gICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgaWYgKCF0aGlzLm1vZGVsLnNlcmlhbGlzZSkgcmV0dXJuIHRoaXMuX2RlZmF1bHRTZXJpYWxpc2Uob3B0cyk7XG4gICAgZWxzZSByZXR1cm4gdGhpcy5tb2RlbC5zZXJpYWxpc2UodGhpcywgb3B0cyk7XG4gIH1cbn0pO1xuXG51dGlsLmV4dGVuZChNb2RlbEluc3RhbmNlLnByb3RvdHlwZSwge1xuICAvKipcbiAgICogRW1pdCBhbiBldmVudCBpbmRpY2F0aW5nIHRoYXQgdGhpcyBpbnN0YW5jZSBoYXMganVzdCBiZWVuIGNyZWF0ZWQuXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfZW1pdE5ldzogZnVuY3Rpb24oKSB7XG4gICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICBjb2xsZWN0aW9uOiB0aGlzLm1vZGVsLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgbW9kZWw6IHRoaXMubW9kZWwubmFtZSxcbiAgICAgIGxvY2FsSWQ6IHRoaXMubG9jYWxJZCxcbiAgICAgIG5ldzogdGhpcyxcbiAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLk5ldyxcbiAgICAgIG9iajogdGhpc1xuICAgIH0pO1xuICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBNb2RlbEluc3RhbmNlO1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL01vZGVsSW5zdGFuY2UuanNcbiAqKiBtb2R1bGUgaWQgPSAxOFxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIE1vZGVsSW5zdGFuY2UgPSByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKSxcbiAgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSgnZ3JhcGgnKSxcbiAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyksXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuZnVuY3Rpb24gU2llc3RhRXJyb3Iob3B0cykge1xuICB0aGlzLm9wdHMgPSBvcHRzO1xufVxuXG5TaWVzdGFFcnJvci5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHRoaXMub3B0cywgbnVsbCwgNCk7XG59O1xuXG4vKipcbiAqIEVuY2Fwc3VsYXRlcyB0aGUgaWRlYSBvZiBtYXBwaW5nIGFycmF5cyBvZiBkYXRhIG9udG8gdGhlIG9iamVjdCBncmFwaCBvciBhcnJheXMgb2Ygb2JqZWN0cy5cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKiBAcGFyYW0gb3B0cy5tb2RlbFxuICogQHBhcmFtIG9wdHMuZGF0YVxuICogQHBhcmFtIG9wdHMub2JqZWN0c1xuICogQHBhcmFtIG9wdHMuZGlzYWJsZU5vdGlmaWNhdGlvbnNcbiAqL1xuZnVuY3Rpb24gTWFwcGluZ09wZXJhdGlvbihvcHRzKSB7XG4gIHRoaXMuX29wdHMgPSBvcHRzO1xuXG4gIHV0aWwuZXh0ZW5kRnJvbU9wdHModGhpcywgb3B0cywge1xuICAgIG1vZGVsOiBudWxsLFxuICAgIGRhdGE6IG51bGwsXG4gICAgb2JqZWN0czogW10sXG4gICAgZGlzYWJsZWV2ZW50czogZmFsc2UsXG4gICAgX2lnbm9yZUluc3RhbGxlZDogZmFsc2UsXG4gICAgZnJvbVN0b3JhZ2U6IGZhbHNlXG4gIH0pO1xuXG4gIHV0aWwuZXh0ZW5kKHRoaXMsIHtcbiAgICBlcnJvcnM6IFtdLFxuICAgIHN1YlRhc2tSZXN1bHRzOiB7fSxcbiAgICBfbmV3T2JqZWN0czogW11cbiAgfSk7XG5cblxuICB0aGlzLm1vZGVsLl9pbnN0YWxsUmV2ZXJzZVBsYWNlaG9sZGVycygpO1xuICB0aGlzLmRhdGEgPSB0aGlzLnByZXByb2Nlc3NEYXRhKCk7XG59XG5cbnV0aWwuZXh0ZW5kKE1hcHBpbmdPcGVyYXRpb24ucHJvdG90eXBlLCB7XG4gIG1hcEF0dHJpYnV0ZXM6IGZ1bmN0aW9uKCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5kYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgZGF0dW0gPSB0aGlzLmRhdGFbaV0sXG4gICAgICAgIG9iamVjdCA9IHRoaXMub2JqZWN0c1tpXTtcbiAgICAgIC8vIE5vIHBvaW50IG1hcHBpbmcgb2JqZWN0IG9udG8gaXRzZWxmLiBUaGlzIGhhcHBlbnMgaWYgYSBNb2RlbEluc3RhbmNlIGlzIHBhc3NlZCBhcyBhIHJlbGF0aW9uc2hpcC5cbiAgICAgIGlmIChkYXR1bSAhPSBvYmplY3QpIHtcbiAgICAgICAgaWYgKG9iamVjdCkgeyAvLyBJZiBvYmplY3QgaXMgZmFsc3ksIHRoZW4gdGhlcmUgd2FzIGFuIGVycm9yIGxvb2tpbmcgdXAgdGhhdCBvYmplY3QvY3JlYXRpbmcgaXQuXG4gICAgICAgICAgdmFyIGZpZWxkcyA9IHRoaXMubW9kZWwuX2F0dHJpYnV0ZU5hbWVzO1xuICAgICAgICAgIGZpZWxkcy5mb3JFYWNoKGZ1bmN0aW9uKGYpIHtcbiAgICAgICAgICAgIGlmIChkYXR1bVtmXSAhPT0gdW5kZWZpbmVkKSB7IC8vIG51bGwgaXMgZmluZVxuICAgICAgICAgICAgICAvLyBJZiBldmVudHMgYXJlIGRpc2FibGVkIHdlIHVwZGF0ZSBfX3ZhbHVlcyBvYmplY3QgZGlyZWN0bHkuIFRoaXMgYXZvaWRzIHRyaWdnZXJpbmdcbiAgICAgICAgICAgICAgLy8gZXZlbnRzIHdoaWNoIGFyZSBidWlsdCBpbnRvIHRoZSBzZXQgZnVuY3Rpb24gb2YgdGhlIHByb3BlcnR5LlxuICAgICAgICAgICAgICBpZiAodGhpcy5kaXNhYmxlZXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgb2JqZWN0Ll9fdmFsdWVzW2ZdID0gZGF0dW1bZl07XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgb2JqZWN0W2ZdID0gZGF0dW1bZl07XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgIC8vIFBvdWNoREIgcmV2aXNpb24gKGlmIHVzaW5nIHN0b3JhZ2UgbW9kdWxlKS5cbiAgICAgICAgICAvLyBUT0RPOiBDYW4gdGhpcyBiZSBwdWxsZWQgb3V0IG9mIGNvcmU/XG4gICAgICAgICAgaWYgKGRhdHVtLl9yZXYpIG9iamVjdC5fcmV2ID0gZGF0dW0uX3JldjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgX21hcDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBlcnI7XG4gICAgdGhpcy5tYXBBdHRyaWJ1dGVzKCk7XG4gICAgdmFyIHJlbGF0aW9uc2hpcEZpZWxkcyA9IE9iamVjdC5rZXlzKHNlbGYuc3ViVGFza1Jlc3VsdHMpO1xuICAgIHJlbGF0aW9uc2hpcEZpZWxkcy5mb3JFYWNoKGZ1bmN0aW9uKGYpIHtcbiAgICAgIHZhciByZXMgPSBzZWxmLnN1YlRhc2tSZXN1bHRzW2ZdO1xuICAgICAgdmFyIGluZGV4ZXMgPSByZXMuaW5kZXhlcyxcbiAgICAgICAgb2JqZWN0cyA9IHJlcy5vYmplY3RzO1xuICAgICAgdmFyIHJlbGF0ZWREYXRhID0gc2VsZi5nZXRSZWxhdGVkRGF0YShmKS5yZWxhdGVkRGF0YTtcbiAgICAgIHZhciB1bmZsYXR0ZW5lZE9iamVjdHMgPSB1dGlsLnVuZmxhdHRlbkFycmF5KG9iamVjdHMsIHJlbGF0ZWREYXRhKTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdW5mbGF0dGVuZWRPYmplY3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBpZHggPSBpbmRleGVzW2ldO1xuICAgICAgICAvLyBFcnJvcnMgYXJlIHBsdWNrZWQgZnJvbSB0aGUgc3Vib3BlcmF0aW9ucy5cbiAgICAgICAgdmFyIGVycm9yID0gc2VsZi5lcnJvcnNbaWR4XTtcbiAgICAgICAgZXJyID0gZXJyb3IgPyBlcnJvcltmXSA6IG51bGw7XG4gICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgdmFyIHJlbGF0ZWQgPSB1bmZsYXR0ZW5lZE9iamVjdHNbaV07IC8vIENhbiBiZSBhcnJheSBvciBzY2FsYXIuXG4gICAgICAgICAgdmFyIG9iamVjdCA9IHNlbGYub2JqZWN0c1tpZHhdO1xuICAgICAgICAgIGlmIChvYmplY3QpIHtcbiAgICAgICAgICAgIGVyciA9IG9iamVjdC5fX3Byb3hpZXNbZl0uc2V0KHJlbGF0ZWQsIHtkaXNhYmxlZXZlbnRzOiBzZWxmLmRpc2FibGVldmVudHN9KTtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgaWYgKCFzZWxmLmVycm9yc1tpZHhdKSBzZWxmLmVycm9yc1tpZHhdID0ge307XG4gICAgICAgICAgICAgIHNlbGYuZXJyb3JzW2lkeF1bZl0gPSBlcnI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG4gIC8qKlxuICAgKiBGaWd1cmUgb3V0IHdoaWNoIGRhdGEgaXRlbXMgcmVxdWlyZSBhIGNhY2hlIGxvb2t1cC5cbiAgICogQHJldHVybnMge3tyZW1vdGVMb29rdXBzOiBBcnJheSwgbG9jYWxMb29rdXBzOiBBcnJheX19XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfc29ydExvb2t1cHM6IGZ1bmN0aW9uKCkge1xuICAgIHZhciByZW1vdGVMb29rdXBzID0gW107XG4gICAgdmFyIGxvY2FsTG9va3VwcyA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5kYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoIXRoaXMub2JqZWN0c1tpXSkge1xuICAgICAgICB2YXIgbG9va3VwO1xuICAgICAgICB2YXIgZGF0dW0gPSB0aGlzLmRhdGFbaV07XG4gICAgICAgIHZhciBpc1NjYWxhciA9IHR5cGVvZiBkYXR1bSA9PSAnc3RyaW5nJyB8fCB0eXBlb2YgZGF0dW0gPT0gJ251bWJlcicgfHwgZGF0dW0gaW5zdGFuY2VvZiBTdHJpbmc7XG4gICAgICAgIGlmIChkYXR1bSkge1xuICAgICAgICAgIGlmIChpc1NjYWxhcikge1xuICAgICAgICAgICAgbG9va3VwID0ge1xuICAgICAgICAgICAgICBpbmRleDogaSxcbiAgICAgICAgICAgICAgZGF0dW06IHt9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgbG9va3VwLmRhdHVtW3RoaXMubW9kZWwuaWRdID0gZGF0dW07XG4gICAgICAgICAgICByZW1vdGVMb29rdXBzLnB1c2gobG9va3VwKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGRhdHVtIGluc3RhbmNlb2YgTW9kZWxJbnN0YW5jZSkgeyAvLyBXZSB3b24ndCBuZWVkIHRvIHBlcmZvcm0gYW55IG1hcHBpbmcuXG4gICAgICAgICAgICB0aGlzLm9iamVjdHNbaV0gPSBkYXR1bTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGRhdHVtLmxvY2FsSWQpIHtcbiAgICAgICAgICAgIGxvY2FsTG9va3Vwcy5wdXNoKHtcbiAgICAgICAgICAgICAgaW5kZXg6IGksXG4gICAgICAgICAgICAgIGRhdHVtOiBkYXR1bVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSBlbHNlIGlmIChkYXR1bVt0aGlzLm1vZGVsLmlkXSkge1xuICAgICAgICAgICAgcmVtb3RlTG9va3Vwcy5wdXNoKHtcbiAgICAgICAgICAgICAgaW5kZXg6IGksXG4gICAgICAgICAgICAgIGRhdHVtOiBkYXR1bVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMub2JqZWN0c1tpXSA9IHRoaXMuX2luc3RhbmNlKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMub2JqZWN0c1tpXSA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtyZW1vdGVMb29rdXBzOiByZW1vdGVMb29rdXBzLCBsb2NhbExvb2t1cHM6IGxvY2FsTG9va3Vwc307XG4gIH0sXG4gIF9wZXJmb3JtTG9jYWxMb29rdXBzOiBmdW5jdGlvbihsb2NhbExvb2t1cHMpIHtcbiAgICB2YXIgbG9jYWxJZGVudGlmaWVycyA9IHV0aWwucGx1Y2sodXRpbC5wbHVjayhsb2NhbExvb2t1cHMsICdkYXR1bScpLCAnbG9jYWxJZCcpLFxuICAgICAgbG9jYWxPYmplY3RzID0gY2FjaGUuZ2V0VmlhTG9jYWxJZChsb2NhbElkZW50aWZpZXJzKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxvY2FsSWRlbnRpZmllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBvYmogPSBsb2NhbE9iamVjdHNbaV07XG4gICAgICB2YXIgbG9jYWxJZCA9IGxvY2FsSWRlbnRpZmllcnNbaV07XG4gICAgICB2YXIgbG9va3VwID0gbG9jYWxMb29rdXBzW2ldO1xuICAgICAgaWYgKCFvYmopIHtcbiAgICAgICAgLy8gSWYgdGhlcmUgYXJlIG11bHRpcGxlIG1hcHBpbmcgb3BlcmF0aW9ucyBnb2luZyBvbiwgdGhlcmUgbWF5IGJlXG4gICAgICAgIG9iaiA9IGNhY2hlLmdldCh7bG9jYWxJZDogbG9jYWxJZH0pO1xuICAgICAgICBpZiAoIW9iaikgb2JqID0gdGhpcy5faW5zdGFuY2Uoe2xvY2FsSWQ6IGxvY2FsSWR9LCAhdGhpcy5kaXNhYmxlZXZlbnRzKTtcbiAgICAgICAgdGhpcy5vYmplY3RzW2xvb2t1cC5pbmRleF0gPSBvYmo7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm9iamVjdHNbbG9va3VwLmluZGV4XSA9IG9iajtcbiAgICAgIH1cbiAgICB9XG5cbiAgfSxcbiAgX3BlcmZvcm1SZW1vdGVMb29rdXBzOiBmdW5jdGlvbihyZW1vdGVMb29rdXBzKSB7XG4gICAgdmFyIHJlbW90ZUlkZW50aWZpZXJzID0gdXRpbC5wbHVjayh1dGlsLnBsdWNrKHJlbW90ZUxvb2t1cHMsICdkYXR1bScpLCB0aGlzLm1vZGVsLmlkKSxcbiAgICAgIHJlbW90ZU9iamVjdHMgPSBjYWNoZS5nZXRWaWFSZW1vdGVJZChyZW1vdGVJZGVudGlmaWVycywge21vZGVsOiB0aGlzLm1vZGVsfSk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZW1vdGVPYmplY3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgb2JqID0gcmVtb3RlT2JqZWN0c1tpXSxcbiAgICAgICAgbG9va3VwID0gcmVtb3RlTG9va3Vwc1tpXTtcbiAgICAgIGlmIChvYmopIHtcbiAgICAgICAgdGhpcy5vYmplY3RzW2xvb2t1cC5pbmRleF0gPSBvYmo7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgZGF0YSA9IHt9O1xuICAgICAgICB2YXIgcmVtb3RlSWQgPSByZW1vdGVJZGVudGlmaWVyc1tpXTtcbiAgICAgICAgZGF0YVt0aGlzLm1vZGVsLmlkXSA9IHJlbW90ZUlkO1xuICAgICAgICB2YXIgY2FjaGVRdWVyeSA9IHtcbiAgICAgICAgICBtb2RlbDogdGhpcy5tb2RlbFxuICAgICAgICB9O1xuICAgICAgICBjYWNoZVF1ZXJ5W3RoaXMubW9kZWwuaWRdID0gcmVtb3RlSWQ7XG4gICAgICAgIHZhciBjYWNoZWQgPSBjYWNoZS5nZXQoY2FjaGVRdWVyeSk7XG4gICAgICAgIGlmIChjYWNoZWQpIHtcbiAgICAgICAgICB0aGlzLm9iamVjdHNbbG9va3VwLmluZGV4XSA9IGNhY2hlZDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLm9iamVjdHNbbG9va3VwLmluZGV4XSA9IHRoaXMuX2luc3RhbmNlKCk7XG4gICAgICAgICAgLy8gSXQncyBpbXBvcnRhbnQgdGhhdCB3ZSBtYXAgdGhlIHJlbW90ZSBpZGVudGlmaWVyIGhlcmUgdG8gZW5zdXJlIHRoYXQgaXQgZW5kc1xuICAgICAgICAgIC8vIHVwIGluIHRoZSBjYWNoZS5cbiAgICAgICAgICB0aGlzLm9iamVjdHNbbG9va3VwLmluZGV4XVt0aGlzLm1vZGVsLmlkXSA9IHJlbW90ZUlkO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAvKipcbiAgICogRm9yIGluZGljZXMgd2hlcmUgbm8gb2JqZWN0IGlzIHByZXNlbnQsIHBlcmZvcm0gY2FjaGUgbG9va3VwcywgY3JlYXRpbmcgYSBuZXcgb2JqZWN0IGlmIG5lY2Vzc2FyeS5cbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9sb29rdXA6IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLm1vZGVsLnNpbmdsZXRvbikge1xuICAgICAgdGhpcy5fbG9va3VwU2luZ2xldG9uKCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdmFyIGxvb2t1cHMgPSB0aGlzLl9zb3J0TG9va3VwcygpLFxuICAgICAgICByZW1vdGVMb29rdXBzID0gbG9va3Vwcy5yZW1vdGVMb29rdXBzLFxuICAgICAgICBsb2NhbExvb2t1cHMgPSBsb29rdXBzLmxvY2FsTG9va3VwcztcbiAgICAgIHRoaXMuX3BlcmZvcm1Mb2NhbExvb2t1cHMobG9jYWxMb29rdXBzKTtcbiAgICAgIHRoaXMuX3BlcmZvcm1SZW1vdGVMb29rdXBzKHJlbW90ZUxvb2t1cHMpO1xuICAgIH1cbiAgfSxcbiAgX2xvb2t1cFNpbmdsZXRvbjogZnVuY3Rpb24oKSB7XG4gICAgLy8gUGljayBhIHJhbmRvbSBsb2NhbElkIGZyb20gdGhlIGFycmF5IG9mIGRhdGEgYmVpbmcgbWFwcGVkIG9udG8gdGhlIHNpbmdsZXRvbiBvYmplY3QuIE5vdGUgdGhhdCB0aGV5IHNob3VsZFxuICAgIC8vIGFsd2F5cyBiZSB0aGUgc2FtZS4gVGhpcyBpcyBqdXN0IGEgcHJlY2F1dGlvbi5cbiAgICB2YXIgbG9jYWxJZGVudGlmaWVycyA9IHV0aWwucGx1Y2sodGhpcy5kYXRhLCAnbG9jYWxJZCcpLCBsb2NhbElkO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsb2NhbElkZW50aWZpZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAobG9jYWxJZGVudGlmaWVyc1tpXSkge1xuICAgICAgICBsb2NhbElkID0ge2xvY2FsSWQ6IGxvY2FsSWRlbnRpZmllcnNbaV19O1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gVGhlIG1hcHBpbmcgb3BlcmF0aW9uIGlzIHJlc3BvbnNpYmxlIGZvciBjcmVhdGluZyBzaW5nbGV0b24gaW5zdGFuY2VzIGlmIHRoZXkgZG8gbm90IGFscmVhZHkgZXhpc3QuXG4gICAgdmFyIHNpbmdsZXRvbiA9IGNhY2hlLmdldFNpbmdsZXRvbih0aGlzLm1vZGVsKSB8fCB0aGlzLl9pbnN0YW5jZShsb2NhbElkKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgdGhpcy5vYmplY3RzW2ldID0gc2luZ2xldG9uO1xuICAgIH1cbiAgfSxcbiAgX2luc3RhbmNlOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgbW9kZWwgPSB0aGlzLm1vZGVsLFxuICAgICAgbW9kZWxJbnN0YW5jZSA9IG1vZGVsLl9pbnN0YW5jZS5hcHBseShtb2RlbCwgYXJndW1lbnRzKTtcbiAgICB0aGlzLl9uZXdPYmplY3RzLnB1c2gobW9kZWxJbnN0YW5jZSk7XG4gICAgcmV0dXJuIG1vZGVsSW5zdGFuY2U7XG4gIH0sXG5cbiAgcHJlcHJvY2Vzc0RhdGE6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBkYXRhID0gdXRpbC5leHRlbmQoW10sIHRoaXMuZGF0YSk7XG4gICAgcmV0dXJuIGRhdGEubWFwKGZ1bmN0aW9uKGRhdHVtKSB7XG4gICAgICBpZiAoZGF0dW0pIHtcbiAgICAgICAgaWYgKCF1dGlsLmlzU3RyaW5nKGRhdHVtKSkge1xuICAgICAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMoZGF0dW0pO1xuICAgICAgICAgIGtleXMuZm9yRWFjaChmdW5jdGlvbihrKSB7XG4gICAgICAgICAgICB2YXIgaXNSZWxhdGlvbnNoaXAgPSB0aGlzLm1vZGVsLl9yZWxhdGlvbnNoaXBOYW1lcy5pbmRleE9mKGspID4gLTE7XG5cbiAgICAgICAgICAgIGlmIChpc1JlbGF0aW9uc2hpcCkge1xuICAgICAgICAgICAgICB2YXIgdmFsID0gZGF0dW1ba107XG4gICAgICAgICAgICAgIGlmICh2YWwgaW5zdGFuY2VvZiBNb2RlbEluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgZGF0dW1ba10gPSB7bG9jYWxJZDogdmFsLmxvY2FsSWR9O1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gZGF0dW07XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgc3RhcnQ6IGZ1bmN0aW9uKGRvbmUpIHtcbiAgICB2YXIgZGF0YSA9IHRoaXMuZGF0YTtcbiAgICBpZiAoZGF0YS5sZW5ndGgpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgIHZhciB0YXNrcyA9IFtdO1xuICAgICAgdGhpcy5fbG9va3VwKCk7XG4gICAgICB0YXNrcy5wdXNoKHRoaXMuX2V4ZWN1dGVTdWJPcGVyYXRpb25zLmJpbmQodGhpcykpO1xuICAgICAgdXRpbC5wYXJhbGxlbCh0YXNrcywgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgIGlmIChlcnIpIGNvbnNvbGUuZXJyb3IoZXJyKTtcbiAgICAgICAgc2VsZi5fbWFwKCk7XG4gICAgICAgIC8vIFVzZXJzIGFyZSBhbGxvd2VkIHRvIGFkZCBhIGN1c3RvbSBpbml0IG1ldGhvZCB0byB0aGUgbWV0aG9kcyBvYmplY3Qgd2hlbiBkZWZpbmluZyBhIE1vZGVsLCBvZiB0aGUgZm9ybTpcbiAgICAgICAgLy9cbiAgICAgICAgLy9cbiAgICAgICAgLy8gaW5pdDogZnVuY3Rpb24gKFtkb25lXSkge1xuICAgICAgICAvLyAgICAgLy8gLi4uXG4gICAgICAgIC8vICB9XG4gICAgICAgIC8vXG4gICAgICAgIC8vXG4gICAgICAgIC8vIElmIGRvbmUgaXMgcGFzc2VkLCB0aGVuIF9faW5pdCBtdXN0IGJlIGV4ZWN1dGVkIGFzeW5jaHJvbm91c2x5LCBhbmQgdGhlIG1hcHBpbmcgb3BlcmF0aW9uIHdpbGwgbm90XG4gICAgICAgIC8vIGZpbmlzaCB1bnRpbCBhbGwgaW5pdHMgaGF2ZSBleGVjdXRlZC5cbiAgICAgICAgLy9cbiAgICAgICAgLy8gSGVyZSB3ZSBlbnN1cmUgdGhlIGV4ZWN1dGlvbiBvZiBhbGwgb2YgdGhlbVxuICAgICAgICB2YXIgZnJvbVN0b3JhZ2UgPSB0aGlzLmZyb21TdG9yYWdlO1xuICAgICAgICB2YXIgaW5pdFRhc2tzID0gc2VsZi5fbmV3T2JqZWN0cy5yZWR1Y2UoZnVuY3Rpb24obWVtbywgbykge1xuICAgICAgICAgIHZhciBpbml0ID0gby5tb2RlbC5pbml0O1xuICAgICAgICAgIGlmIChpbml0KSB7XG4gICAgICAgICAgICB2YXIgcGFyYW1OYW1lcyA9IHV0aWwucGFyYW1OYW1lcyhpbml0KTtcbiAgICAgICAgICAgIGlmIChwYXJhbU5hbWVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgbWVtby5wdXNoKGluaXQuYmluZChvLCBmcm9tU3RvcmFnZSwgZG9uZSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIGluaXQuY2FsbChvLCBmcm9tU3RvcmFnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIG8uX2VtaXRFdmVudHMgPSB0cnVlO1xuICAgICAgICAgIG8uX2VtaXROZXcoKTtcbiAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgfSwgW10pO1xuICAgICAgICB1dGlsLnBhcmFsbGVsKGluaXRUYXNrcywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgZG9uZShzZWxmLmVycm9ycy5sZW5ndGggPyBzZWxmLmVycm9ycyA6IG51bGwsIHNlbGYub2JqZWN0cyk7XG4gICAgICAgIH0pO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZG9uZShudWxsLCBbXSk7XG4gICAgfVxuICB9LFxuICBnZXRSZWxhdGVkRGF0YTogZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBpbmRleGVzID0gW107XG4gICAgdmFyIHJlbGF0ZWREYXRhID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBkYXR1bSA9IHRoaXMuZGF0YVtpXTtcbiAgICAgIGlmIChkYXR1bSkge1xuICAgICAgICB2YXIgdmFsID0gZGF0dW1bbmFtZV07XG4gICAgICAgIGlmICh2YWwpIHtcbiAgICAgICAgICBpbmRleGVzLnB1c2goaSk7XG4gICAgICAgICAgcmVsYXRlZERhdGEucHVzaCh2YWwpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICBpbmRleGVzOiBpbmRleGVzLFxuICAgICAgcmVsYXRlZERhdGE6IHJlbGF0ZWREYXRhXG4gICAgfTtcbiAgfVxuICAsXG4gIHByb2Nlc3NFcnJvcnNGcm9tVGFzazogZnVuY3Rpb24ocmVsYXRpb25zaGlwTmFtZSwgZXJyb3JzLCBpbmRleGVzKSB7XG4gICAgaWYgKGVycm9ycy5sZW5ndGgpIHtcbiAgICAgIHZhciByZWxhdGVkRGF0YSA9IHRoaXMuZ2V0UmVsYXRlZERhdGEocmVsYXRpb25zaGlwTmFtZSkucmVsYXRlZERhdGE7XG4gICAgICB2YXIgdW5mbGF0dGVuZWRFcnJvcnMgPSB1dGlsLnVuZmxhdHRlbkFycmF5KGVycm9ycywgcmVsYXRlZERhdGEpO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB1bmZsYXR0ZW5lZEVycm9ycy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgaWR4ID0gaW5kZXhlc1tpXTtcbiAgICAgICAgdmFyIGVyciA9IHVuZmxhdHRlbmVkRXJyb3JzW2ldO1xuICAgICAgICB2YXIgaXNFcnJvciA9IGVycjtcbiAgICAgICAgaWYgKHV0aWwuaXNBcnJheShlcnIpKSBpc0Vycm9yID0gZXJyLnJlZHVjZShmdW5jdGlvbihtZW1vLCB4KSB7XG4gICAgICAgICAgcmV0dXJuIG1lbW8gfHwgeFxuICAgICAgICB9LCBmYWxzZSk7XG4gICAgICAgIGlmIChpc0Vycm9yKSB7XG4gICAgICAgICAgaWYgKCF0aGlzLmVycm9yc1tpZHhdKSB0aGlzLmVycm9yc1tpZHhdID0ge307XG4gICAgICAgICAgdGhpcy5lcnJvcnNbaWR4XVtyZWxhdGlvbnNoaXBOYW1lXSA9IGVycjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgX2V4ZWN1dGVTdWJPcGVyYXRpb25zOiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgIHJlbGF0aW9uc2hpcE5hbWVzID0gT2JqZWN0LmtleXModGhpcy5tb2RlbC5yZWxhdGlvbnNoaXBzKTtcbiAgICBpZiAocmVsYXRpb25zaGlwTmFtZXMubGVuZ3RoKSB7XG4gICAgICB2YXIgdGFza3MgPSByZWxhdGlvbnNoaXBOYW1lcy5yZWR1Y2UoZnVuY3Rpb24obSwgcmVsYXRpb25zaGlwTmFtZSkge1xuICAgICAgICB2YXIgcmVsYXRpb25zaGlwID0gc2VsZi5tb2RlbC5yZWxhdGlvbnNoaXBzW3JlbGF0aW9uc2hpcE5hbWVdO1xuICAgICAgICB2YXIgcmV2ZXJzZU1vZGVsID0gcmVsYXRpb25zaGlwLmZvcndhcmROYW1lID09IHJlbGF0aW9uc2hpcE5hbWUgPyByZWxhdGlvbnNoaXAucmV2ZXJzZU1vZGVsIDogcmVsYXRpb25zaGlwLmZvcndhcmRNb2RlbDtcbiAgICAgICAgLy8gTW9jayBhbnkgbWlzc2luZyBzaW5nbGV0b24gZGF0YSB0byBlbnN1cmUgdGhhdCBhbGwgc2luZ2xldG9uIGluc3RhbmNlcyBhcmUgY3JlYXRlZC5cbiAgICAgICAgaWYgKHJldmVyc2VNb2RlbC5zaW5nbGV0b24gJiYgIXJlbGF0aW9uc2hpcC5pc1JldmVyc2UpIHtcbiAgICAgICAgICB0aGlzLmRhdGEuZm9yRWFjaChmdW5jdGlvbihkYXR1bSkge1xuICAgICAgICAgICAgaWYgKCFkYXR1bVtyZWxhdGlvbnNoaXBOYW1lXSkgZGF0dW1bcmVsYXRpb25zaGlwTmFtZV0gPSB7fTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgX19yZXQgPSB0aGlzLmdldFJlbGF0ZWREYXRhKHJlbGF0aW9uc2hpcE5hbWUpLFxuICAgICAgICAgIGluZGV4ZXMgPSBfX3JldC5pbmRleGVzLFxuICAgICAgICAgIHJlbGF0ZWREYXRhID0gX19yZXQucmVsYXRlZERhdGE7XG4gICAgICAgIGlmIChyZWxhdGVkRGF0YS5sZW5ndGgpIHtcbiAgICAgICAgICB2YXIgZmxhdFJlbGF0ZWREYXRhID0gdXRpbC5mbGF0dGVuQXJyYXkocmVsYXRlZERhdGEpO1xuICAgICAgICAgIHZhciBvcCA9IG5ldyBNYXBwaW5nT3BlcmF0aW9uKHtcbiAgICAgICAgICAgIG1vZGVsOiByZXZlcnNlTW9kZWwsXG4gICAgICAgICAgICBkYXRhOiBmbGF0UmVsYXRlZERhdGEsXG4gICAgICAgICAgICBkaXNhYmxlZXZlbnRzOiBzZWxmLmRpc2FibGVldmVudHMsXG4gICAgICAgICAgICBfaWdub3JlSW5zdGFsbGVkOiBzZWxmLl9pZ25vcmVJbnN0YWxsZWQsXG4gICAgICAgICAgICBmcm9tU3RvcmFnZTogdGhpcy5mcm9tU3RvcmFnZVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wKSB7XG4gICAgICAgICAgdmFyIHRhc2s7XG4gICAgICAgICAgdGFzayA9IGZ1bmN0aW9uKGRvbmUpIHtcbiAgICAgICAgICAgIG9wLnN0YXJ0KGZ1bmN0aW9uKGVycm9ycywgb2JqZWN0cykge1xuICAgICAgICAgICAgICBzZWxmLnN1YlRhc2tSZXN1bHRzW3JlbGF0aW9uc2hpcE5hbWVdID0ge1xuICAgICAgICAgICAgICAgIGVycm9yczogZXJyb3JzLFxuICAgICAgICAgICAgICAgIG9iamVjdHM6IG9iamVjdHMsXG4gICAgICAgICAgICAgICAgaW5kZXhlczogaW5kZXhlc1xuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICBzZWxmLnByb2Nlc3NFcnJvcnNGcm9tVGFzayhyZWxhdGlvbnNoaXBOYW1lLCBvcC5lcnJvcnMsIGluZGV4ZXMpO1xuICAgICAgICAgICAgICBkb25lKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9O1xuICAgICAgICAgIG0ucHVzaCh0YXNrKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbTtcbiAgICAgIH0uYmluZCh0aGlzKSwgW10pO1xuICAgICAgdXRpbC5wYXJhbGxlbCh0YXNrcywgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2FsbGJhY2soKTtcbiAgICB9XG4gIH1cbn0pXG47XG5cbm1vZHVsZS5leHBvcnRzID0gTWFwcGluZ09wZXJhdGlvbjtcblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9tYXBwaW5nT3BlcmF0aW9uLmpzXG4gKiogbW9kdWxlIGlkID0gMTlcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsImlmICh0eXBlb2Ygc2llc3RhID09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBtb2R1bGUgPT0gJ3VuZGVmaW5lZCcpIHtcbiAgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZmluZCB3aW5kb3cuc2llc3RhLiBNYWtlIHN1cmUgeW91IGluY2x1ZGUgc2llc3RhLmNvcmUuanMgZmlyc3QuJyk7XG59XG5cbnZhciBfaSA9IHNpZXN0YS5faW50ZXJuYWwsXG4gIGNhY2hlID0gX2kuY2FjaGUsXG4gIENvbGxlY3Rpb25SZWdpc3RyeSA9IF9pLkNvbGxlY3Rpb25SZWdpc3RyeSxcbiAgbG9nID0gX2kubG9nKCdzdG9yYWdlJyksXG4gIGVycm9yID0gX2kuZXJyb3IsXG4gIHV0aWwgPSBfaS51dGlsLFxuICBldmVudHMgPSBfaS5ldmVudHM7XG5cbnZhciB1bnNhdmVkT2JqZWN0cyA9IFtdLFxuICB1bnNhdmVkT2JqZWN0c0hhc2ggPSB7fSxcbiAgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24gPSB7fTtcblxudmFyIHN0b3JhZ2UgPSB7fTtcblxuLy8gVmFyaWFibGVzIGJlZ2lubmluZyB3aXRoIHVuZGVyc2NvcmUgYXJlIHRyZWF0ZWQgYXMgc3BlY2lhbCBieSBQb3VjaERCL0NvdWNoREIgc28gd2hlbiBzZXJpYWxpc2luZyB3ZSBuZWVkIHRvXG4vLyByZXBsYWNlIHdpdGggc29tZXRoaW5nIGVsc2UuXG52YXIgVU5ERVJTQ09SRSA9IC9fL2csXG4gIFVOREVSU0NPUkVfUkVQTEFDRU1FTlQgPSAvQC9nO1xuXG5mdW5jdGlvbiBfaW5pdE1ldGEoKSB7XG4gIHJldHVybiB7ZGF0ZUZpZWxkczogW119O1xufVxuXG5mdW5jdGlvbiBmdWxseVF1YWxpZmllZE1vZGVsTmFtZShjb2xsZWN0aW9uTmFtZSwgbW9kZWxOYW1lKSB7XG4gIHJldHVybiBjb2xsZWN0aW9uTmFtZSArICcuJyArIG1vZGVsTmFtZTtcbn1cblxuaWYgKHR5cGVvZiBQb3VjaERCID09ICd1bmRlZmluZWQnKSB7XG4gIHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQgPSBmYWxzZTtcbiAgY29uc29sZS5sb2coJ1BvdWNoREIgaXMgbm90IHByZXNlbnQgdGhlcmVmb3JlIHN0b3JhZ2UgaXMgZGlzYWJsZWQuJyk7XG59XG5lbHNlIHtcbiAgdmFyIERCX05BTUUgPSAnc2llc3RhJyxcbiAgICBwb3VjaCA9IG5ldyBQb3VjaERCKERCX05BTUUsIHthdXRvX2NvbXBhY3Rpb246IHRydWV9KTtcblxuICAvKipcbiAgICogU29tZXRpbWVzIHNpZXN0YSBuZWVkcyB0byBzdG9yZSBzb21lIGV4dHJhIGluZm9ybWF0aW9uIGFib3V0IHRoZSBtb2RlbCBpbnN0YW5jZS5cbiAgICogQHBhcmFtIHNlcmlhbGlzZWRcbiAgICogQHByaXZhdGVcbiAgICovXG4gIGZ1bmN0aW9uIF9hZGRNZXRhKHNlcmlhbGlzZWQpIHtcbiAgICAvLyBQb3VjaERCIDw9IDMuMi4xIGhhcyBhIGJ1ZyB3aGVyZWJ5IGRhdGUgZmllbGRzIGFyZSBub3QgZGVzZXJpYWxpc2VkIHByb3Blcmx5IGlmIHlvdSB1c2UgZGIucXVlcnlcbiAgICAvLyB0aGVyZWZvcmUgd2UgbmVlZCB0byBhZGQgZXh0cmEgaW5mbyB0byB0aGUgb2JqZWN0IGZvciBkZXNlcmlhbGlzaW5nIGRhdGVzIG1hbnVhbGx5LlxuICAgIHNlcmlhbGlzZWQuc2llc3RhX21ldGEgPSBfaW5pdE1ldGEoKTtcbiAgICBmb3IgKHZhciBwcm9wIGluIHNlcmlhbGlzZWQpIHtcbiAgICAgIGlmIChzZXJpYWxpc2VkLmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgIGlmIChzZXJpYWxpc2VkW3Byb3BdIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgICAgICAgIHNlcmlhbGlzZWQuc2llc3RhX21ldGEuZGF0ZUZpZWxkcy5wdXNoKHByb3ApO1xuICAgICAgICAgIHNlcmlhbGlzZWRbcHJvcF0gPSBzZXJpYWxpc2VkW3Byb3BdLmdldFRpbWUoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIF9wcm9jZXNzTWV0YShkYXR1bSkge1xuICAgIHZhciBtZXRhID0gZGF0dW0uc2llc3RhX21ldGEgfHwgX2luaXRNZXRhKCk7XG4gICAgbWV0YS5kYXRlRmllbGRzLmZvckVhY2goZnVuY3Rpb24oZGF0ZUZpZWxkKSB7XG4gICAgICB2YXIgdmFsdWUgPSBkYXR1bVtkYXRlRmllbGRdO1xuICAgICAgaWYgKCEodmFsdWUgaW5zdGFuY2VvZiBEYXRlKSkge1xuICAgICAgICBkYXR1bVtkYXRlRmllbGRdID0gbmV3IERhdGUodmFsdWUpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGRlbGV0ZSBkYXR1bS5zaWVzdGFfbWV0YTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNvbnN0cnVjdEluZGV4RGVzaWduRG9jKGNvbGxlY3Rpb25OYW1lLCBtb2RlbE5hbWUpIHtcbiAgICB2YXIgZnVsbHlRdWFsaWZpZWROYW1lID0gZnVsbHlRdWFsaWZpZWRNb2RlbE5hbWUoY29sbGVjdGlvbk5hbWUsIG1vZGVsTmFtZSk7XG4gICAgdmFyIHZpZXdzID0ge307XG4gICAgdmlld3NbZnVsbHlRdWFsaWZpZWROYW1lXSA9IHtcbiAgICAgIG1hcDogZnVuY3Rpb24oZG9jKSB7XG4gICAgICAgIGlmIChkb2MuY29sbGVjdGlvbiA9PSAnJDEnICYmIGRvYy5tb2RlbCA9PSAnJDInKSBlbWl0KGRvYy5jb2xsZWN0aW9uICsgJy4nICsgZG9jLm1vZGVsLCBkb2MpO1xuICAgICAgfS50b1N0cmluZygpLnJlcGxhY2UoJyQxJywgY29sbGVjdGlvbk5hbWUpLnJlcGxhY2UoJyQyJywgbW9kZWxOYW1lKVxuICAgIH07XG4gICAgcmV0dXJuIHtcbiAgICAgIF9pZDogJ19kZXNpZ24vJyArIGZ1bGx5UXVhbGlmaWVkTmFtZSxcbiAgICAgIHZpZXdzOiB2aWV3c1xuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogRW5zdXJlIHRoYXQgdGhlIFBvdWNoREIgaW5kZXggZm9yIHRoZSBnaXZlbiBtb2RlbCBleGlzdHMsIGNyZWF0aW5nIGl0IGlmIG5vdC5cbiAgICogQHBhcmFtIG1vZGVsXG4gICAqIEBwYXJhbSBjYlxuICAgKi9cbiAgZnVuY3Rpb24gZW5zdXJlSW5kZXhJbnN0YWxsZWQobW9kZWwsIGNiKSB7XG4gICAgZnVuY3Rpb24gZm4ocmVzcCkge1xuICAgICAgdmFyIGVycjtcbiAgICAgIGlmICghcmVzcC5vaykge1xuICAgICAgICBpZiAocmVzcC5zdGF0dXMgPT0gNDA5KSB7XG4gICAgICAgICAgZXJyID0gbnVsbDtcbiAgICAgICAgICBtb2RlbC5pbmRleEluc3RhbGxlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGNiKGVycik7XG4gICAgfVxuXG4gICAgcG91Y2hcbiAgICAgIC5wdXQoY29uc3RydWN0SW5kZXhEZXNpZ25Eb2MobW9kZWwuY29sbGVjdGlvbk5hbWUsIG1vZGVsLm5hbWUpKVxuICAgICAgLnRoZW4oZm4pXG4gICAgICAuY2F0Y2goZm4pO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0QWxsTW9kZWxzKCkge1xuICAgIHZhciBhbGxNb2RlbHMgPSBbXTtcbiAgICB2YXIgcmVnaXN0cnkgPSBzaWVzdGEuX2ludGVybmFsLkNvbGxlY3Rpb25SZWdpc3RyeTtcbiAgICByZWdpc3RyeS5jb2xsZWN0aW9uTmFtZXMuZm9yRWFjaChmdW5jdGlvbihjb2xsZWN0aW9uTmFtZSkge1xuICAgICAgdmFyIGNvbGwgPSByZWdpc3RyeVtjb2xsZWN0aW9uTmFtZV07XG4gICAgICB2YXIgbW9kZWxzID0gY29sbC5fbW9kZWxzO1xuICAgICAgZm9yICh2YXIgbW9kZWxOYW1lIGluIG1vZGVscykge1xuICAgICAgICBpZiAobW9kZWxzLmhhc093blByb3BlcnR5KG1vZGVsTmFtZSkpIHtcbiAgICAgICAgICB2YXIgbW9kZWwgPSBjb2xsW21vZGVsTmFtZV07XG4gICAgICAgICAgYWxsTW9kZWxzLnB1c2gobW9kZWwpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIGFsbE1vZGVscztcbiAgfVxuXG4gIGZ1bmN0aW9uIGNvbnN0cnVjdEluZGV4ZXNGb3JBbGxNb2RlbHMobW9kZWxzKSB7XG4gICAgcmV0dXJuIG1vZGVscy5tYXAoZnVuY3Rpb24obW9kZWwpIHtcbiAgICAgIHJldHVybiBjb25zdHJ1Y3RJbmRleERlc2lnbkRvYyhtb2RlbC5jb2xsZWN0aW9uTmFtZSwgbW9kZWwubmFtZSk7XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBfX2Vuc3VyZUluZGV4ZXMoaW5kZXhlcywgY2IpIHtcbiAgICBmdW5jdGlvbiBmbihyZXNwKSB7XG4gICAgICB2YXIgZXJyb3JzID0gW107XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlc3AubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHJlc3BvbnNlID0gcmVzcFtpXTtcbiAgICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICAgIC8vIENvbmZsaWN0IG1lYW5zIGFscmVhZHkgZXhpc3RzLCBhbmQgdGhpcyBpcyBmaW5lIVxuICAgICAgICAgIHZhciBpc0NvbmZsaWN0ID0gcmVzcG9uc2Uuc3RhdHVzID09IDQwOTtcbiAgICAgICAgICBpZiAoIWlzQ29uZmxpY3QpIGVycm9ycy5wdXNoKHJlc3BvbnNlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgY2IoZXJyb3JzLmxlbmd0aCA/IGVycm9yKCdtdWx0aXBsZSBlcnJvcnMnLCB7ZXJyb3JzOiBlcnJvcnN9KSA6IG51bGwpO1xuICAgIH1cblxuICAgIHBvdWNoXG4gICAgICAuYnVsa0RvY3MoaW5kZXhlcylcbiAgICAgIC50aGVuKGZuKVxuICAgICAgLmNhdGNoKGZuKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGVuc3VyZUluZGV4ZXNGb3JBbGwoY2IpIHtcbiAgICB2YXIgbW9kZWxzID0gZ2V0QWxsTW9kZWxzKCk7XG4gICAgdmFyIGluZGV4ZXMgPSBjb25zdHJ1Y3RJbmRleGVzRm9yQWxsTW9kZWxzKG1vZGVscyk7XG4gICAgX19lbnN1cmVJbmRleGVzKGluZGV4ZXMsIGNiKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXJpYWxpc2UgYSBtb2RlbCBpbnRvIGEgZm9ybWF0IHRoYXQgUG91Y2hEQiBidWxrRG9jcyBBUEkgY2FuIHByb2Nlc3NcbiAgICogQHBhcmFtIHtNb2RlbEluc3RhbmNlfSBtb2RlbEluc3RhbmNlXG4gICAqL1xuICBmdW5jdGlvbiBfc2VyaWFsaXNlKG1vZGVsSW5zdGFuY2UpIHtcbiAgICB2YXIgc2VyaWFsaXNlZCA9IHt9O1xuICAgIHZhciBfX3ZhbHVlcyA9IG1vZGVsSW5zdGFuY2UuX192YWx1ZXM7XG4gICAgc2VyaWFsaXNlZCA9IHV0aWwuZXh0ZW5kKHNlcmlhbGlzZWQsIF9fdmFsdWVzKTtcbiAgICBPYmplY3Qua2V5cyhzZXJpYWxpc2VkKS5mb3JFYWNoKGZ1bmN0aW9uKGspIHtcbiAgICAgIHNlcmlhbGlzZWRbay5yZXBsYWNlKFVOREVSU0NPUkUsICdAJyldID0gX192YWx1ZXNba107XG4gICAgfSk7XG4gICAgX2FkZE1ldGEoc2VyaWFsaXNlZCk7XG4gICAgc2VyaWFsaXNlZFsnY29sbGVjdGlvbiddID0gbW9kZWxJbnN0YW5jZS5jb2xsZWN0aW9uTmFtZTtcbiAgICBzZXJpYWxpc2VkWydtb2RlbCddID0gbW9kZWxJbnN0YW5jZS5tb2RlbE5hbWU7XG4gICAgc2VyaWFsaXNlZFsnX2lkJ10gPSBtb2RlbEluc3RhbmNlLmxvY2FsSWQ7XG4gICAgaWYgKG1vZGVsSW5zdGFuY2UucmVtb3ZlZCkgc2VyaWFsaXNlZFsnX2RlbGV0ZWQnXSA9IHRydWU7XG4gICAgdmFyIHJldiA9IG1vZGVsSW5zdGFuY2UuX3JldjtcbiAgICBpZiAocmV2KSBzZXJpYWxpc2VkWydfcmV2J10gPSByZXY7XG4gICAgc2VyaWFsaXNlZCA9IG1vZGVsSW5zdGFuY2UuX3JlbGF0aW9uc2hpcE5hbWVzLnJlZHVjZShmdW5jdGlvbihtZW1vLCBuKSB7XG4gICAgICB2YXIgdmFsID0gbW9kZWxJbnN0YW5jZVtuXTtcbiAgICAgIGlmIChzaWVzdGEuaXNBcnJheSh2YWwpKSB7XG4gICAgICAgIG1lbW9bbl0gPSB1dGlsLnBsdWNrKHZhbCwgJ2xvY2FsSWQnKTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKHZhbCkge1xuICAgICAgICBtZW1vW25dID0gdmFsLmxvY2FsSWQ7XG4gICAgICB9XG4gICAgICByZXR1cm4gbWVtbztcbiAgICB9LCBzZXJpYWxpc2VkKTtcbiAgICByZXR1cm4gc2VyaWFsaXNlZDtcbiAgfVxuXG4gIGZ1bmN0aW9uIF9wcmVwYXJlRGF0dW0ocmF3RGF0dW0sIG1vZGVsKSB7XG4gICAgX3Byb2Nlc3NNZXRhKHJhd0RhdHVtKTtcbiAgICBkZWxldGUgcmF3RGF0dW0uY29sbGVjdGlvbjtcbiAgICBkZWxldGUgcmF3RGF0dW0ubW9kZWw7XG4gICAgcmF3RGF0dW0ubG9jYWxJZCA9IHJhd0RhdHVtLl9pZDtcbiAgICBkZWxldGUgcmF3RGF0dW0uX2lkO1xuICAgIHZhciBkYXR1bSA9IHt9O1xuICAgIE9iamVjdC5rZXlzKHJhd0RhdHVtKS5mb3JFYWNoKGZ1bmN0aW9uKGspIHtcbiAgICAgIGRhdHVtW2sucmVwbGFjZShVTkRFUlNDT1JFX1JFUExBQ0VNRU5ULCAnXycpXSA9IHJhd0RhdHVtW2tdO1xuICAgIH0pO1xuXG4gICAgdmFyIHJlbGF0aW9uc2hpcE5hbWVzID0gbW9kZWwuX3JlbGF0aW9uc2hpcE5hbWVzO1xuICAgIHJlbGF0aW9uc2hpcE5hbWVzLmZvckVhY2goZnVuY3Rpb24ocikge1xuICAgICAgdmFyIGxvY2FsSWQgPSBkYXR1bVtyXTtcbiAgICAgIGlmIChsb2NhbElkKSB7XG4gICAgICAgIGlmIChzaWVzdGEuaXNBcnJheShsb2NhbElkKSkge1xuICAgICAgICAgIGRhdHVtW3JdID0gbG9jYWxJZC5tYXAoZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgcmV0dXJuIHtsb2NhbElkOiB4fVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGRhdHVtW3JdID0ge2xvY2FsSWQ6IGxvY2FsSWR9O1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICB9KTtcbiAgICByZXR1cm4gZGF0dW07XG4gIH1cblxuICAvKipcbiAgICpcbiAgICogQHBhcmFtIG9wdHNcbiAgICogQHBhcmFtIFtvcHRzLmNvbGxlY3Rpb25OYW1lXVxuICAgKiBAcGFyYW0gW29wdHMubW9kZWxOYW1lXVxuICAgKiBAcGFyYW0gW29wdHMubW9kZWxdXG4gICAqIEBwYXJhbSBjYWxsYmFja1xuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgZnVuY3Rpb24gbG9hZE1vZGVsKG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGxvYWRlZCA9IHt9O1xuICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG9wdHMuY29sbGVjdGlvbk5hbWUsXG4gICAgICBtb2RlbE5hbWUgPSBvcHRzLm1vZGVsTmFtZSxcbiAgICAgIG1vZGVsID0gb3B0cy5tb2RlbDtcbiAgICBpZiAobW9kZWwpIHtcbiAgICAgIGNvbGxlY3Rpb25OYW1lID0gbW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgICBtb2RlbE5hbWUgPSBtb2RlbC5uYW1lO1xuICAgIH1cbiAgICB2YXIgZnVsbHlRdWFsaWZpZWROYW1lID0gZnVsbHlRdWFsaWZpZWRNb2RlbE5hbWUoY29sbGVjdGlvbk5hbWUsIG1vZGVsTmFtZSk7XG4gICAgdmFyIE1vZGVsID0gQ29sbGVjdGlvblJlZ2lzdHJ5W2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdO1xuICAgIHBvdWNoLnF1ZXJ5KGZ1bGx5UXVhbGlmaWVkTmFtZSlcbiAgICAgIC50aGVuKGZ1bmN0aW9uKHJlc3ApIHtcbiAgICAgICAgbG9nKCdRdWVyaWVkIHBvdWNoIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICB2YXIgcm93cyA9IHJlc3Aucm93cztcbiAgICAgICAgdmFyIGRhdGEgPSB1dGlsLnBsdWNrKHJvd3MsICd2YWx1ZScpLm1hcChmdW5jdGlvbihkYXR1bSkge1xuICAgICAgICAgIHJldHVybiBfcHJlcGFyZURhdHVtKGRhdHVtLCBNb2RlbCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGRhdGEubWFwKGZ1bmN0aW9uKGRhdHVtKSB7XG4gICAgICAgICAgdmFyIHJlbW90ZUlkID0gZGF0dW1bTW9kZWwuaWRdO1xuICAgICAgICAgIGlmIChyZW1vdGVJZCkge1xuICAgICAgICAgICAgaWYgKGxvYWRlZFtyZW1vdGVJZF0pIHtcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRHVwbGljYXRlcyBkZXRlY3RlZCBpbiBzdG9yYWdlLiBZb3UgaGF2ZSBlbmNvdW50ZXJlZCBhIHNlcmlvdXMgYnVnLiBQbGVhc2UgcmVwb3J0IHRoaXMuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgbG9hZGVkW3JlbW90ZUlkXSA9IGRhdHVtO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgbG9nKCdNYXBwaW5nIGRhdGEnLCBkYXRhKTtcblxuICAgICAgICBNb2RlbC5ncmFwaChkYXRhLCB7XG4gICAgICAgICAgX2lnbm9yZUluc3RhbGxlZDogdHJ1ZSxcbiAgICAgICAgICBmcm9tU3RvcmFnZTogdHJ1ZVxuICAgICAgICB9LCBmdW5jdGlvbihlcnIsIGluc3RhbmNlcykge1xuICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICBpZiAobG9nLmVuYWJsZWQpXG4gICAgICAgICAgICAgIGxvZygnTG9hZGVkICcgKyBpbnN0YW5jZXMgPyBpbnN0YW5jZXMubGVuZ3RoLnRvU3RyaW5nKCkgOiAwICsgJyBpbnN0YW5jZXMgZm9yICcgKyBmdWxseVF1YWxpZmllZE5hbWUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGxvZygnRXJyb3IgbG9hZGluZyBtb2RlbHMnLCBlcnIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYWxsYmFjayhlcnIsIGluc3RhbmNlcyk7XG4gICAgICAgIH0pO1xuICAgICAgfSlcbiAgICAgIC5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgIH0pO1xuXG4gIH1cblxuICAvKipcbiAgICogTG9hZCBhbGwgZGF0YSBmcm9tIFBvdWNoREIuXG4gICAqL1xuICBmdW5jdGlvbiBfbG9hZChjYikge1xuICAgIGlmIChzYXZpbmcpIHRocm93IG5ldyBFcnJvcignbm90IGxvYWRlZCB5ZXQgaG93IGNhbiBpIHNhdmUnKTtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgaWYgKHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQpIHtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lcyA9IENvbGxlY3Rpb25SZWdpc3RyeS5jb2xsZWN0aW9uTmFtZXM7XG4gICAgICAgIHZhciB0YXNrcyA9IFtdO1xuICAgICAgICBjb2xsZWN0aW9uTmFtZXMuZm9yRWFjaChmdW5jdGlvbihjb2xsZWN0aW9uTmFtZSkge1xuICAgICAgICAgIHZhciBjb2xsZWN0aW9uID0gQ29sbGVjdGlvblJlZ2lzdHJ5W2NvbGxlY3Rpb25OYW1lXSxcbiAgICAgICAgICAgIG1vZGVsTmFtZXMgPSBPYmplY3Qua2V5cyhjb2xsZWN0aW9uLl9tb2RlbHMpO1xuICAgICAgICAgIG1vZGVsTmFtZXMuZm9yRWFjaChmdW5jdGlvbihtb2RlbE5hbWUpIHtcbiAgICAgICAgICAgIHRhc2tzLnB1c2goZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgICAgICAgLy8gV2UgY2FsbCBmcm9tIHN0b3JhZ2UgdG8gYWxsb3cgZm9yIHJlcGxhY2VtZW50IG9mIF9sb2FkTW9kZWwgZm9yIHBlcmZvcm1hbmNlIGV4dGVuc2lvbi5cbiAgICAgICAgICAgICAgc3RvcmFnZS5sb2FkTW9kZWwoe1xuICAgICAgICAgICAgICAgIGNvbGxlY3Rpb25OYW1lOiBjb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICBtb2RlbE5hbWU6IG1vZGVsTmFtZVxuICAgICAgICAgICAgICB9LCBjYik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHV0aWwuc2VyaWVzKHRhc2tzLCBmdW5jdGlvbihlcnIsIHJlc3VsdHMpIHtcbiAgICAgICAgICB2YXIgbjtcbiAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgdmFyIGluc3RhbmNlcyA9IFtdO1xuICAgICAgICAgICAgcmVzdWx0cy5mb3JFYWNoKGZ1bmN0aW9uKHIpIHtcbiAgICAgICAgICAgICAgaW5zdGFuY2VzID0gaW5zdGFuY2VzLmNvbmNhdChyKVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBuID0gaW5zdGFuY2VzLmxlbmd0aDtcbiAgICAgICAgICAgIGlmIChsb2cpIHtcbiAgICAgICAgICAgICAgbG9nKCdMb2FkZWQgJyArIG4udG9TdHJpbmcoKSArICcgaW5zdGFuY2VzLiBDYWNoZSBzaXplIGlzICcgKyBjYWNoZS5jb3VudCgpLCB7XG4gICAgICAgICAgICAgICAgcmVtb3RlOiBjYWNoZS5fcmVtb3RlQ2FjaGUoKSxcbiAgICAgICAgICAgICAgICBsb2NhbENhY2hlOiBjYWNoZS5fbG9jYWxDYWNoZSgpXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2llc3RhLm9uKCdTaWVzdGEnLCBsaXN0ZW5lcik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNiKGVyciwgbik7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNiKCk7XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNhdmVDb25mbGljdHMob2JqZWN0cywgY2IpIHtcbiAgICBwb3VjaC5hbGxEb2NzKHtrZXlzOiB1dGlsLnBsdWNrKG9iamVjdHMsICdsb2NhbElkJyl9KVxuICAgICAgLnRoZW4oZnVuY3Rpb24ocmVzcCkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlc3Aucm93cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIG9iamVjdHNbaV0uX3JldiA9IHJlc3Aucm93c1tpXS52YWx1ZS5yZXY7XG4gICAgICAgIH1cbiAgICAgICAgc2F2ZVRvUG91Y2gob2JqZWN0cywgY2IpO1xuICAgICAgfSlcbiAgICAgIC5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgY2IoZXJyKTtcbiAgICAgIH0pXG4gIH1cblxuICBmdW5jdGlvbiBzYXZlVG9Qb3VjaChvYmplY3RzLCBjYikge1xuICAgIHZhciBjb25mbGljdHMgPSBbXTtcbiAgICB2YXIgc2VyaWFsaXNlZERvY3MgPSBvYmplY3RzLm1hcChfc2VyaWFsaXNlKTtcbiAgICBwb3VjaC5idWxrRG9jcyhzZXJpYWxpc2VkRG9jcykudGhlbihmdW5jdGlvbihyZXNwKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlc3AubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHJlc3BvbnNlID0gcmVzcFtpXTtcbiAgICAgICAgdmFyIG9iaiA9IG9iamVjdHNbaV07XG4gICAgICAgIGlmIChyZXNwb25zZS5vaykge1xuICAgICAgICAgIG9iai5fcmV2ID0gcmVzcG9uc2UucmV2O1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PSA0MDkpIHtcbiAgICAgICAgICBjb25mbGljdHMucHVzaChvYmopO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGxvZygnRXJyb3Igc2F2aW5nIG9iamVjdCB3aXRoIGxvY2FsSWQ9XCInICsgb2JqLmxvY2FsSWQgKyAnXCInLCByZXNwb25zZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChjb25mbGljdHMubGVuZ3RoKSB7XG4gICAgICAgIHNhdmVDb25mbGljdHMoY29uZmxpY3RzLCBjYik7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY2IoKTtcbiAgICAgIH1cbiAgICB9LCBmdW5jdGlvbihlcnIpIHtcbiAgICAgIGNiKGVycik7XG4gICAgfSk7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBTYXZlIGFsbCBtb2RlbEV2ZW50cyBkb3duIHRvIFBvdWNoREIuXG4gICAqL1xuICBmdW5jdGlvbiBzYXZlKGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIHNpZXN0YS5fYWZ0ZXJJbnN0YWxsKGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgaW5zdGFuY2VzID0gdW5zYXZlZE9iamVjdHM7XG4gICAgICAgIHVuc2F2ZWRPYmplY3RzID0gW107XG4gICAgICAgIHVuc2F2ZWRPYmplY3RzSGFzaCA9IHt9O1xuICAgICAgICB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbiA9IHt9O1xuICAgICAgICBzYXZlVG9Qb3VjaChpbnN0YW5jZXMsIGNiKTtcbiAgICAgIH0pO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH1cblxuICBmdW5jdGlvbiBsaXN0ZW5lcihuKSB7XG4gICAgdmFyIGNoYW5nZWRPYmplY3QgPSBuLm9iaixcbiAgICAgIGlkZW50ID0gY2hhbmdlZE9iamVjdC5sb2NhbElkO1xuICAgIGlmICghY2hhbmdlZE9iamVjdCkge1xuICAgICAgdGhyb3cgbmV3IF9pLmVycm9yLkludGVybmFsU2llc3RhRXJyb3IoJ05vIG9iaiBmaWVsZCBpbiBub3RpZmljYXRpb24gcmVjZWl2ZWQgYnkgc3RvcmFnZSBleHRlbnNpb24nKTtcbiAgICB9XG4gICAgaWYgKCEoaWRlbnQgaW4gdW5zYXZlZE9iamVjdHNIYXNoKSkge1xuICAgICAgdW5zYXZlZE9iamVjdHNIYXNoW2lkZW50XSA9IGNoYW5nZWRPYmplY3Q7XG4gICAgICB1bnNhdmVkT2JqZWN0cy5wdXNoKGNoYW5nZWRPYmplY3QpO1xuICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gY2hhbmdlZE9iamVjdC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgIGlmICghdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdKSB7XG4gICAgICAgIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25OYW1lXSA9IHt9O1xuICAgICAgfVxuICAgICAgdmFyIG1vZGVsTmFtZSA9IGNoYW5nZWRPYmplY3QubW9kZWwubmFtZTtcbiAgICAgIGlmICghdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV0pIHtcbiAgICAgICAgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV0gPSB7fTtcbiAgICAgIH1cbiAgICAgIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdW2lkZW50XSA9IGNoYW5nZWRPYmplY3Q7XG4gICAgfVxuICB9XG5cbiAgdXRpbC5leHRlbmQoc3RvcmFnZSwge1xuICAgIF9sb2FkOiBfbG9hZCxcbiAgICBsb2FkTW9kZWw6IGxvYWRNb2RlbCxcbiAgICBzYXZlOiBzYXZlLFxuICAgIF9zZXJpYWxpc2U6IF9zZXJpYWxpc2UsXG4gICAgZW5zdXJlSW5kZXhlc0ZvckFsbDogZW5zdXJlSW5kZXhlc0ZvckFsbCxcbiAgICBlbnN1cmVJbmRleEluc3RhbGxlZDogZW5zdXJlSW5kZXhJbnN0YWxsZWQsXG4gICAgX3Jlc2V0OiBmdW5jdGlvbihjYikge1xuICAgICAgc2llc3RhLnJlbW92ZUxpc3RlbmVyKCdTaWVzdGEnLCBsaXN0ZW5lcik7XG4gICAgICB1bnNhdmVkT2JqZWN0cyA9IFtdO1xuICAgICAgdW5zYXZlZE9iamVjdHNIYXNoID0ge307XG4gICAgICBwb3VjaC5kZXN0cm95KGZ1bmN0aW9uKGVycikge1xuICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgIHBvdWNoID0gbmV3IFBvdWNoREIoREJfTkFNRSk7XG4gICAgICAgIH1cbiAgICAgICAgbG9nKCdSZXNldCBjb21wbGV0ZScpO1xuICAgICAgICBjYihlcnIpO1xuICAgICAgfSlcbiAgICB9XG5cbiAgfSk7XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoc3RvcmFnZSwge1xuICAgIF91bnNhdmVkT2JqZWN0czoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHVuc2F2ZWRPYmplY3RzXG4gICAgICB9XG4gICAgfSxcbiAgICBfdW5zYXZlZE9iamVjdHNIYXNoOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdW5zYXZlZE9iamVjdHNIYXNoXG4gICAgICB9XG4gICAgfSxcbiAgICBfdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb246IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvblxuICAgICAgfVxuICAgIH0sXG4gICAgX3BvdWNoOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gcG91Y2hcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuXG4gIGlmICghc2llc3RhLmV4dCkgc2llc3RhLmV4dCA9IHt9O1xuICBzaWVzdGEuZXh0LnN0b3JhZ2UgPSBzdG9yYWdlO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHNpZXN0YS5leHQsIHtcbiAgICBzdG9yYWdlRW5hYmxlZDoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHNpZXN0YS5leHQuX3N0b3JhZ2VFbmFibGVkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICByZXR1cm4gc2llc3RhLmV4dC5fc3RvcmFnZUVuYWJsZWQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuICEhc2llc3RhLmV4dC5zdG9yYWdlO1xuICAgICAgfSxcbiAgICAgIHNldDogZnVuY3Rpb24odikge1xuICAgICAgICBzaWVzdGEuZXh0Ll9zdG9yYWdlRW5hYmxlZCA9IHY7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH1cbiAgfSk7XG5cbiAgdmFyIGludGVydmFsLCBzYXZpbmcsIGF1dG9zYXZlSW50ZXJ2YWwgPSAxMDAwO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHNpZXN0YSwge1xuICAgIGF1dG9zYXZlOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gISFpbnRlcnZhbDtcbiAgICAgIH0sXG4gICAgICBzZXQ6IGZ1bmN0aW9uKGF1dG9zYXZlKSB7XG4gICAgICAgIGlmIChhdXRvc2F2ZSkge1xuICAgICAgICAgIGlmICghaW50ZXJ2YWwpIHtcbiAgICAgICAgICAgIGludGVydmFsID0gc2V0SW50ZXJ2YWwoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIC8vIENoZWVreSB3YXkgb2YgYXZvaWRpbmcgbXVsdGlwbGUgc2F2ZXMgaGFwcGVuaW5nLi4uXG4gICAgICAgICAgICAgIGlmICghc2F2aW5nKSB7XG4gICAgICAgICAgICAgICAgc2F2aW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBzaWVzdGEuc2F2ZShmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGV2ZW50cy5lbWl0KCdzYXZlZCcpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgc2F2aW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sIHNpZXN0YS5hdXRvc2F2ZUludGVydmFsKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgaWYgKGludGVydmFsKSB7XG4gICAgICAgICAgICBjbGVhckludGVydmFsKGludGVydmFsKTtcbiAgICAgICAgICAgIGludGVydmFsID0gbnVsbDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIGF1dG9zYXZlSW50ZXJ2YWw6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBhdXRvc2F2ZUludGVydmFsO1xuICAgICAgfSxcbiAgICAgIHNldDogZnVuY3Rpb24oX2F1dG9zYXZlSW50ZXJ2YWwpIHtcbiAgICAgICAgYXV0b3NhdmVJbnRlcnZhbCA9IF9hdXRvc2F2ZUludGVydmFsO1xuICAgICAgICBpZiAoaW50ZXJ2YWwpIHtcbiAgICAgICAgICAvLyBSZXNldCBpbnRlcnZhbFxuICAgICAgICAgIHNpZXN0YS5hdXRvc2F2ZSA9IGZhbHNlO1xuICAgICAgICAgIHNpZXN0YS5hdXRvc2F2ZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIGRpcnR5OiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24gPSBzaWVzdGEuZXh0LnN0b3JhZ2UuX3Vuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uO1xuICAgICAgICByZXR1cm4gISFPYmplY3Qua2V5cyh1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbikubGVuZ3RoO1xuICAgICAgfSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9XG4gIH0pO1xuXG4gIHV0aWwuZXh0ZW5kKHNpZXN0YSwge1xuICAgIHNhdmU6IHNhdmUsXG4gICAgc2V0UG91Y2g6IGZ1bmN0aW9uKF9wKSB7XG4gICAgICBpZiAoc2llc3RhLl9jYW5DaGFuZ2UpIHBvdWNoID0gX3A7XG4gICAgICBlbHNlIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGNoYW5nZSBQb3VjaERCIGluc3RhbmNlIHdoZW4gYW4gb2JqZWN0IGdyYXBoIGV4aXN0cy4nKTtcbiAgICB9XG4gIH0pO1xuXG59XG5cbm1vZHVsZS5leHBvcnRzID0gc3RvcmFnZTtcblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vc3RvcmFnZS9pbmRleC5qc1xuICoqIG1vZHVsZSBpZCA9IDIwXG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcbnZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG52YXIgdW5kZWZpbmVkO1xuXG52YXIgaXNQbGFpbk9iamVjdCA9IGZ1bmN0aW9uIGlzUGxhaW5PYmplY3Qob2JqKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG4gICAgaWYgKCFvYmogfHwgdG9TdHJpbmcuY2FsbChvYmopICE9PSAnW29iamVjdCBPYmplY3RdJyB8fCBvYmoubm9kZVR5cGUgfHwgb2JqLnNldEludGVydmFsKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgaGFzX293bl9jb25zdHJ1Y3RvciA9IGhhc093bi5jYWxsKG9iaiwgJ2NvbnN0cnVjdG9yJyk7XG4gICAgdmFyIGhhc19pc19wcm9wZXJ0eV9vZl9tZXRob2QgPSBvYmouY29uc3RydWN0b3IgJiYgb2JqLmNvbnN0cnVjdG9yLnByb3RvdHlwZSAmJiBoYXNPd24uY2FsbChvYmouY29uc3RydWN0b3IucHJvdG90eXBlLCAnaXNQcm90b3R5cGVPZicpO1xuICAgIC8vIE5vdCBvd24gY29uc3RydWN0b3IgcHJvcGVydHkgbXVzdCBiZSBPYmplY3RcbiAgICBpZiAob2JqLmNvbnN0cnVjdG9yICYmICFoYXNfb3duX2NvbnN0cnVjdG9yICYmICFoYXNfaXNfcHJvcGVydHlfb2ZfbWV0aG9kKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBPd24gcHJvcGVydGllcyBhcmUgZW51bWVyYXRlZCBmaXJzdGx5LCBzbyB0byBzcGVlZCB1cCxcbiAgICAvLyBpZiBsYXN0IG9uZSBpcyBvd24sIHRoZW4gYWxsIHByb3BlcnRpZXMgYXJlIG93bi5cbiAgICB2YXIga2V5O1xuICAgIGZvciAoa2V5IGluIG9iaikge31cblxuICAgIHJldHVybiBrZXkgPT09IHVuZGVmaW5lZCB8fCBoYXNPd24uY2FsbChvYmosIGtleSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGV4dGVuZCgpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcbiAgICB2YXIgb3B0aW9ucywgbmFtZSwgc3JjLCBjb3B5LCBjb3B5SXNBcnJheSwgY2xvbmUsXG4gICAgICAgIHRhcmdldCA9IGFyZ3VtZW50c1swXSxcbiAgICAgICAgaSA9IDEsXG4gICAgICAgIGxlbmd0aCA9IGFyZ3VtZW50cy5sZW5ndGgsXG4gICAgICAgIGRlZXAgPSBmYWxzZTtcblxuICAgIC8vIEhhbmRsZSBhIGRlZXAgY29weSBzaXR1YXRpb25cbiAgICBpZiAodHlwZW9mIHRhcmdldCA9PT0gXCJib29sZWFuXCIpIHtcbiAgICAgICAgZGVlcCA9IHRhcmdldDtcbiAgICAgICAgdGFyZ2V0ID0gYXJndW1lbnRzWzFdIHx8IHt9O1xuICAgICAgICAvLyBza2lwIHRoZSBib29sZWFuIGFuZCB0aGUgdGFyZ2V0XG4gICAgICAgIGkgPSAyO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHRhcmdldCAhPT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgdGFyZ2V0ICE9PSBcImZ1bmN0aW9uXCIgfHwgdGFyZ2V0ID09IHVuZGVmaW5lZCkge1xuICAgICAgICB0YXJnZXQgPSB7fTtcbiAgICB9XG5cbiAgICBmb3IgKDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgICAgIC8vIE9ubHkgZGVhbCB3aXRoIG5vbi1udWxsL3VuZGVmaW5lZCB2YWx1ZXNcbiAgICAgICAgaWYgKChvcHRpb25zID0gYXJndW1lbnRzW2ldKSAhPSBudWxsKSB7XG4gICAgICAgICAgICAvLyBFeHRlbmQgdGhlIGJhc2Ugb2JqZWN0XG4gICAgICAgICAgICBmb3IgKG5hbWUgaW4gb3B0aW9ucykge1xuICAgICAgICAgICAgICAgIHNyYyA9IHRhcmdldFtuYW1lXTtcbiAgICAgICAgICAgICAgICBjb3B5ID0gb3B0aW9uc1tuYW1lXTtcblxuICAgICAgICAgICAgICAgIC8vIFByZXZlbnQgbmV2ZXItZW5kaW5nIGxvb3BcbiAgICAgICAgICAgICAgICBpZiAodGFyZ2V0ID09PSBjb3B5KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIFJlY3Vyc2UgaWYgd2UncmUgbWVyZ2luZyBwbGFpbiBvYmplY3RzIG9yIGFycmF5c1xuICAgICAgICAgICAgICAgIGlmIChkZWVwICYmIGNvcHkgJiYgKGlzUGxhaW5PYmplY3QoY29weSkgfHwgKGNvcHlJc0FycmF5ID0gQXJyYXkuaXNBcnJheShjb3B5KSkpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjb3B5SXNBcnJheSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29weUlzQXJyYXkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsb25lID0gc3JjICYmIEFycmF5LmlzQXJyYXkoc3JjKSA/IHNyYyA6IFtdO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2xvbmUgPSBzcmMgJiYgaXNQbGFpbk9iamVjdChzcmMpID8gc3JjIDoge307XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBOZXZlciBtb3ZlIG9yaWdpbmFsIG9iamVjdHMsIGNsb25lIHRoZW1cbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W25hbWVdID0gZXh0ZW5kKGRlZXAsIGNsb25lLCBjb3B5KTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBEb24ndCBicmluZyBpbiB1bmRlZmluZWQgdmFsdWVzXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjb3B5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W25hbWVdID0gY29weTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZXR1cm4gdGhlIG1vZGlmaWVkIG9iamVjdFxuICAgIHJldHVybiB0YXJnZXQ7XG59O1xuXG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vfi9leHRlbmQvaW5kZXguanNcbiAqKiBtb2R1bGUgaWQgPSAyMVxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiLypcbiAqIENvcHlyaWdodCAoYykgMjAxNCBUaGUgUG9seW1lciBQcm9qZWN0IEF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiBUaGlzIGNvZGUgbWF5IG9ubHkgYmUgdXNlZCB1bmRlciB0aGUgQlNEIHN0eWxlIGxpY2Vuc2UgZm91bmQgYXQgaHR0cDovL3BvbHltZXIuZ2l0aHViLmlvL0xJQ0VOU0UudHh0XG4gKiBUaGUgY29tcGxldGUgc2V0IG9mIGF1dGhvcnMgbWF5IGJlIGZvdW5kIGF0IGh0dHA6Ly9wb2x5bWVyLmdpdGh1Yi5pby9BVVRIT1JTLnR4dFxuICogVGhlIGNvbXBsZXRlIHNldCBvZiBjb250cmlidXRvcnMgbWF5IGJlIGZvdW5kIGF0IGh0dHA6Ly9wb2x5bWVyLmdpdGh1Yi5pby9DT05UUklCVVRPUlMudHh0XG4gKiBDb2RlIGRpc3RyaWJ1dGVkIGJ5IEdvb2dsZSBhcyBwYXJ0IG9mIHRoZSBwb2x5bWVyIHByb2plY3QgaXMgYWxzb1xuICogc3ViamVjdCB0byBhbiBhZGRpdGlvbmFsIElQIHJpZ2h0cyBncmFudCBmb3VuZCBhdCBodHRwOi8vcG9seW1lci5naXRodWIuaW8vUEFURU5UUy50eHRcbiAqL1xuXG4oZnVuY3Rpb24oZ2xvYmFsKSB7XG4gICd1c2Ugc3RyaWN0JztcblxuICB2YXIgdGVzdGluZ0V4cG9zZUN5Y2xlQ291bnQgPSBnbG9iYWwudGVzdGluZ0V4cG9zZUN5Y2xlQ291bnQ7XG5cbiAgLy8gRGV0ZWN0IGFuZCBkbyBiYXNpYyBzYW5pdHkgY2hlY2tpbmcgb24gT2JqZWN0L0FycmF5Lm9ic2VydmUuXG4gIGZ1bmN0aW9uIGRldGVjdE9iamVjdE9ic2VydmUoKSB7XG4gICAgaWYgKHR5cGVvZiBPYmplY3Qub2JzZXJ2ZSAhPT0gJ2Z1bmN0aW9uJyB8fFxuICAgICAgICB0eXBlb2YgQXJyYXkub2JzZXJ2ZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHZhciByZWNvcmRzID0gW107XG5cbiAgICBmdW5jdGlvbiBjYWxsYmFjayhyZWNzKSB7XG4gICAgICByZWNvcmRzID0gcmVjcztcbiAgICB9XG5cbiAgICB2YXIgdGVzdCA9IHt9O1xuICAgIHZhciBhcnIgPSBbXTtcbiAgICBPYmplY3Qub2JzZXJ2ZSh0ZXN0LCBjYWxsYmFjayk7XG4gICAgQXJyYXkub2JzZXJ2ZShhcnIsIGNhbGxiYWNrKTtcbiAgICB0ZXN0LmlkID0gMTtcbiAgICB0ZXN0LmlkID0gMjtcbiAgICBkZWxldGUgdGVzdC5pZDtcbiAgICBhcnIucHVzaCgxLCAyKTtcbiAgICBhcnIubGVuZ3RoID0gMDtcblxuICAgIE9iamVjdC5kZWxpdmVyQ2hhbmdlUmVjb3JkcyhjYWxsYmFjayk7XG4gICAgaWYgKHJlY29yZHMubGVuZ3RoICE9PSA1KVxuICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgaWYgKHJlY29yZHNbMF0udHlwZSAhPSAnYWRkJyB8fFxuICAgICAgICByZWNvcmRzWzFdLnR5cGUgIT0gJ3VwZGF0ZScgfHxcbiAgICAgICAgcmVjb3Jkc1syXS50eXBlICE9ICdkZWxldGUnIHx8XG4gICAgICAgIHJlY29yZHNbM10udHlwZSAhPSAnc3BsaWNlJyB8fFxuICAgICAgICByZWNvcmRzWzRdLnR5cGUgIT0gJ3NwbGljZScpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBPYmplY3QudW5vYnNlcnZlKHRlc3QsIGNhbGxiYWNrKTtcbiAgICBBcnJheS51bm9ic2VydmUoYXJyLCBjYWxsYmFjayk7XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHZhciBoYXNPYnNlcnZlID0gZGV0ZWN0T2JqZWN0T2JzZXJ2ZSgpO1xuXG4gIGZ1bmN0aW9uIGRldGVjdEV2YWwoKSB7XG4gICAgLy8gRG9uJ3QgdGVzdCBmb3IgZXZhbCBpZiB3ZSdyZSBydW5uaW5nIGluIGEgQ2hyb21lIEFwcCBlbnZpcm9ubWVudC5cbiAgICAvLyBXZSBjaGVjayBmb3IgQVBJcyBzZXQgdGhhdCBvbmx5IGV4aXN0IGluIGEgQ2hyb21lIEFwcCBjb250ZXh0LlxuICAgIGlmICh0eXBlb2YgY2hyb21lICE9PSAndW5kZWZpbmVkJyAmJiBjaHJvbWUuYXBwICYmIGNocm9tZS5hcHAucnVudGltZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIEZpcmVmb3ggT1MgQXBwcyBkbyBub3QgYWxsb3cgZXZhbC4gVGhpcyBmZWF0dXJlIGRldGVjdGlvbiBpcyB2ZXJ5IGhhY2t5XG4gICAgLy8gYnV0IGV2ZW4gaWYgc29tZSBvdGhlciBwbGF0Zm9ybSBhZGRzIHN1cHBvcnQgZm9yIHRoaXMgZnVuY3Rpb24gdGhpcyBjb2RlXG4gICAgLy8gd2lsbCBjb250aW51ZSB0byB3b3JrLlxuICAgIGlmIChuYXZpZ2F0b3IuZ2V0RGV2aWNlU3RvcmFnZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICB2YXIgZiA9IG5ldyBGdW5jdGlvbignJywgJ3JldHVybiB0cnVlOycpO1xuICAgICAgcmV0dXJuIGYoKTtcbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIHZhciBoYXNFdmFsID0gZGV0ZWN0RXZhbCgpO1xuXG4gIGZ1bmN0aW9uIGlzSW5kZXgocykge1xuICAgIHJldHVybiArcyA9PT0gcyA+Pj4gMCAmJiBzICE9PSAnJztcbiAgfVxuXG4gIGZ1bmN0aW9uIHRvTnVtYmVyKHMpIHtcbiAgICByZXR1cm4gK3M7XG4gIH1cblxuICB2YXIgbnVtYmVySXNOYU4gPSBnbG9iYWwuTnVtYmVyLmlzTmFOIHx8IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgJiYgZ2xvYmFsLmlzTmFOKHZhbHVlKTtcbiAgfVxuXG5cbiAgdmFyIGNyZWF0ZU9iamVjdCA9ICgnX19wcm90b19fJyBpbiB7fSkgP1xuICAgIGZ1bmN0aW9uKG9iaikgeyByZXR1cm4gb2JqOyB9IDpcbiAgICBmdW5jdGlvbihvYmopIHtcbiAgICAgIHZhciBwcm90byA9IG9iai5fX3Byb3RvX187XG4gICAgICBpZiAoIXByb3RvKVxuICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgdmFyIG5ld09iamVjdCA9IE9iamVjdC5jcmVhdGUocHJvdG8pO1xuICAgICAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMob2JqKS5mb3JFYWNoKGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG5ld09iamVjdCwgbmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihvYmosIG5hbWUpKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIG5ld09iamVjdDtcbiAgICB9O1xuXG4gIHZhciBpZGVudFN0YXJ0ID0gJ1tcXCRfYS16QS1aXSc7XG4gIHZhciBpZGVudFBhcnQgPSAnW1xcJF9hLXpBLVowLTldJztcblxuXG4gIHZhciBNQVhfRElSVFlfQ0hFQ0tfQ1lDTEVTID0gMTAwMDtcblxuICBmdW5jdGlvbiBkaXJ0eUNoZWNrKG9ic2VydmVyKSB7XG4gICAgdmFyIGN5Y2xlcyA9IDA7XG4gICAgd2hpbGUgKGN5Y2xlcyA8IE1BWF9ESVJUWV9DSEVDS19DWUNMRVMgJiYgb2JzZXJ2ZXIuY2hlY2tfKCkpIHtcbiAgICAgIGN5Y2xlcysrO1xuICAgIH1cbiAgICBpZiAodGVzdGluZ0V4cG9zZUN5Y2xlQ291bnQpXG4gICAgICBnbG9iYWwuZGlydHlDaGVja0N5Y2xlQ291bnQgPSBjeWNsZXM7XG5cbiAgICByZXR1cm4gY3ljbGVzID4gMDtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9iamVjdElzRW1wdHkob2JqZWN0KSB7XG4gICAgZm9yICh2YXIgcHJvcCBpbiBvYmplY3QpXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBmdW5jdGlvbiBkaWZmSXNFbXB0eShkaWZmKSB7XG4gICAgcmV0dXJuIG9iamVjdElzRW1wdHkoZGlmZi5hZGRlZCkgJiZcbiAgICAgICAgICAgb2JqZWN0SXNFbXB0eShkaWZmLnJlbW92ZWQpICYmXG4gICAgICAgICAgIG9iamVjdElzRW1wdHkoZGlmZi5jaGFuZ2VkKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRpZmZPYmplY3RGcm9tT2xkT2JqZWN0KG9iamVjdCwgb2xkT2JqZWN0KSB7XG4gICAgdmFyIGFkZGVkID0ge307XG4gICAgdmFyIHJlbW92ZWQgPSB7fTtcbiAgICB2YXIgY2hhbmdlZCA9IHt9O1xuXG4gICAgZm9yICh2YXIgcHJvcCBpbiBvbGRPYmplY3QpIHtcbiAgICAgIHZhciBuZXdWYWx1ZSA9IG9iamVjdFtwcm9wXTtcblxuICAgICAgaWYgKG5ld1ZhbHVlICE9PSB1bmRlZmluZWQgJiYgbmV3VmFsdWUgPT09IG9sZE9iamVjdFtwcm9wXSlcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIGlmICghKHByb3AgaW4gb2JqZWN0KSkge1xuICAgICAgICByZW1vdmVkW3Byb3BdID0gdW5kZWZpbmVkO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKG5ld1ZhbHVlICE9PSBvbGRPYmplY3RbcHJvcF0pXG4gICAgICAgIGNoYW5nZWRbcHJvcF0gPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBwcm9wIGluIG9iamVjdCkge1xuICAgICAgaWYgKHByb3AgaW4gb2xkT2JqZWN0KVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgYWRkZWRbcHJvcF0gPSBvYmplY3RbcHJvcF07XG4gICAgfVxuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkob2JqZWN0KSAmJiBvYmplY3QubGVuZ3RoICE9PSBvbGRPYmplY3QubGVuZ3RoKVxuICAgICAgY2hhbmdlZC5sZW5ndGggPSBvYmplY3QubGVuZ3RoO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICBjaGFuZ2VkOiBjaGFuZ2VkXG4gICAgfTtcbiAgfVxuXG4gIHZhciBlb21UYXNrcyA9IFtdO1xuICBmdW5jdGlvbiBydW5FT01UYXNrcygpIHtcbiAgICBpZiAoIWVvbVRhc2tzLmxlbmd0aClcbiAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZW9tVGFza3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIGVvbVRhc2tzW2ldKCk7XG4gICAgfVxuICAgIGVvbVRhc2tzLmxlbmd0aCA9IDA7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICB2YXIgcnVuRU9NID0gaGFzT2JzZXJ2ZSA/IChmdW5jdGlvbigpe1xuICAgIHZhciBlb21PYmogPSB7IHBpbmdQb25nOiB0cnVlIH07XG4gICAgdmFyIGVvbVJ1blNjaGVkdWxlZCA9IGZhbHNlO1xuXG4gICAgT2JqZWN0Lm9ic2VydmUoZW9tT2JqLCBmdW5jdGlvbigpIHtcbiAgICAgIHJ1bkVPTVRhc2tzKCk7XG4gICAgICBlb21SdW5TY2hlZHVsZWQgPSBmYWxzZTtcbiAgICB9KTtcblxuICAgIHJldHVybiBmdW5jdGlvbihmbikge1xuICAgICAgZW9tVGFza3MucHVzaChmbik7XG4gICAgICBpZiAoIWVvbVJ1blNjaGVkdWxlZCkge1xuICAgICAgICBlb21SdW5TY2hlZHVsZWQgPSB0cnVlO1xuICAgICAgICBlb21PYmoucGluZ1BvbmcgPSAhZW9tT2JqLnBpbmdQb25nO1xuICAgICAgfVxuICAgIH07XG4gIH0pKCkgOlxuICAoZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7XG4gICAgICBlb21UYXNrcy5wdXNoKGZuKTtcbiAgICB9O1xuICB9KSgpO1xuXG4gIHZhciBvYnNlcnZlZE9iamVjdENhY2hlID0gW107XG5cbiAgZnVuY3Rpb24gbmV3T2JzZXJ2ZWRPYmplY3QoKSB7XG4gICAgdmFyIG9ic2VydmVyO1xuICAgIHZhciBvYmplY3Q7XG4gICAgdmFyIGRpc2NhcmRSZWNvcmRzID0gZmFsc2U7XG4gICAgdmFyIGZpcnN0ID0gdHJ1ZTtcblxuICAgIGZ1bmN0aW9uIGNhbGxiYWNrKHJlY29yZHMpIHtcbiAgICAgIGlmIChvYnNlcnZlciAmJiBvYnNlcnZlci5zdGF0ZV8gPT09IE9QRU5FRCAmJiAhZGlzY2FyZFJlY29yZHMpXG4gICAgICAgIG9ic2VydmVyLmNoZWNrXyhyZWNvcmRzKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgb3BlbjogZnVuY3Rpb24ob2JzKSB7XG4gICAgICAgIGlmIChvYnNlcnZlcilcbiAgICAgICAgICB0aHJvdyBFcnJvcignT2JzZXJ2ZWRPYmplY3QgaW4gdXNlJyk7XG5cbiAgICAgICAgaWYgKCFmaXJzdClcbiAgICAgICAgICBPYmplY3QuZGVsaXZlckNoYW5nZVJlY29yZHMoY2FsbGJhY2spO1xuXG4gICAgICAgIG9ic2VydmVyID0gb2JzO1xuICAgICAgICBmaXJzdCA9IGZhbHNlO1xuICAgICAgfSxcbiAgICAgIG9ic2VydmU6IGZ1bmN0aW9uKG9iaiwgYXJyYXlPYnNlcnZlKSB7XG4gICAgICAgIG9iamVjdCA9IG9iajtcbiAgICAgICAgaWYgKGFycmF5T2JzZXJ2ZSlcbiAgICAgICAgICBBcnJheS5vYnNlcnZlKG9iamVjdCwgY2FsbGJhY2spO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgT2JqZWN0Lm9ic2VydmUob2JqZWN0LCBjYWxsYmFjayk7XG4gICAgICB9LFxuICAgICAgZGVsaXZlcjogZnVuY3Rpb24oZGlzY2FyZCkge1xuICAgICAgICBkaXNjYXJkUmVjb3JkcyA9IGRpc2NhcmQ7XG4gICAgICAgIE9iamVjdC5kZWxpdmVyQ2hhbmdlUmVjb3JkcyhjYWxsYmFjayk7XG4gICAgICAgIGRpc2NhcmRSZWNvcmRzID0gZmFsc2U7XG4gICAgICB9LFxuICAgICAgY2xvc2U6IGZ1bmN0aW9uKCkge1xuICAgICAgICBvYnNlcnZlciA9IHVuZGVmaW5lZDtcbiAgICAgICAgT2JqZWN0LnVub2JzZXJ2ZShvYmplY3QsIGNhbGxiYWNrKTtcbiAgICAgICAgb2JzZXJ2ZWRPYmplY3RDYWNoZS5wdXNoKHRoaXMpO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICAvKlxuICAgKiBUaGUgb2JzZXJ2ZWRTZXQgYWJzdHJhY3Rpb24gaXMgYSBwZXJmIG9wdGltaXphdGlvbiB3aGljaCByZWR1Y2VzIHRoZSB0b3RhbFxuICAgKiBudW1iZXIgb2YgT2JqZWN0Lm9ic2VydmUgb2JzZXJ2YXRpb25zIG9mIGEgc2V0IG9mIG9iamVjdHMuIFRoZSBpZGVhIGlzIHRoYXRcbiAgICogZ3JvdXBzIG9mIE9ic2VydmVycyB3aWxsIGhhdmUgc29tZSBvYmplY3QgZGVwZW5kZW5jaWVzIGluIGNvbW1vbiBhbmQgdGhpc1xuICAgKiBvYnNlcnZlZCBzZXQgZW5zdXJlcyB0aGF0IGVhY2ggb2JqZWN0IGluIHRoZSB0cmFuc2l0aXZlIGNsb3N1cmUgb2ZcbiAgICogZGVwZW5kZW5jaWVzIGlzIG9ubHkgb2JzZXJ2ZWQgb25jZS4gVGhlIG9ic2VydmVkU2V0IGFjdHMgYXMgYSB3cml0ZSBiYXJyaWVyXG4gICAqIHN1Y2ggdGhhdCB3aGVuZXZlciBhbnkgY2hhbmdlIGNvbWVzIHRocm91Z2gsIGFsbCBPYnNlcnZlcnMgYXJlIGNoZWNrZWQgZm9yXG4gICAqIGNoYW5nZWQgdmFsdWVzLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgdGhpcyBvcHRpbWl6YXRpb24gaXMgZXhwbGljaXRseSBtb3Zpbmcgd29yayBmcm9tIHNldHVwLXRpbWUgdG9cbiAgICogY2hhbmdlLXRpbWUuXG4gICAqXG4gICAqIFRPRE8ocmFmYWVsdyk6IEltcGxlbWVudCBcImdhcmJhZ2UgY29sbGVjdGlvblwiLiBJbiBvcmRlciB0byBtb3ZlIHdvcmsgb2ZmXG4gICAqIHRoZSBjcml0aWNhbCBwYXRoLCB3aGVuIE9ic2VydmVycyBhcmUgY2xvc2VkLCB0aGVpciBvYnNlcnZlZCBvYmplY3RzIGFyZVxuICAgKiBub3QgT2JqZWN0LnVub2JzZXJ2ZShkKS4gQXMgYSByZXN1bHQsIGl0J3NpZXN0YSBwb3NzaWJsZSB0aGF0IGlmIHRoZSBvYnNlcnZlZFNldFxuICAgKiBpcyBrZXB0IG9wZW4sIGJ1dCBzb21lIE9ic2VydmVycyBoYXZlIGJlZW4gY2xvc2VkLCBpdCBjb3VsZCBjYXVzZSBcImxlYWtzXCJcbiAgICogKHByZXZlbnQgb3RoZXJ3aXNlIGNvbGxlY3RhYmxlIG9iamVjdHMgZnJvbSBiZWluZyBjb2xsZWN0ZWQpLiBBdCBzb21lXG4gICAqIHBvaW50LCB3ZSBzaG91bGQgaW1wbGVtZW50IGluY3JlbWVudGFsIFwiZ2NcIiB3aGljaCBrZWVwcyBhIGxpc3Qgb2ZcbiAgICogb2JzZXJ2ZWRTZXRzIHdoaWNoIG1heSBuZWVkIGNsZWFuLXVwIGFuZCBkb2VzIHNtYWxsIGFtb3VudHMgb2YgY2xlYW51cCBvbiBhXG4gICAqIHRpbWVvdXQgdW50aWwgYWxsIGlzIGNsZWFuLlxuICAgKi9cblxuICBmdW5jdGlvbiBnZXRPYnNlcnZlZE9iamVjdChvYnNlcnZlciwgb2JqZWN0LCBhcnJheU9ic2VydmUpIHtcbiAgICB2YXIgZGlyID0gb2JzZXJ2ZWRPYmplY3RDYWNoZS5wb3AoKSB8fCBuZXdPYnNlcnZlZE9iamVjdCgpO1xuICAgIGRpci5vcGVuKG9ic2VydmVyKTtcbiAgICBkaXIub2JzZXJ2ZShvYmplY3QsIGFycmF5T2JzZXJ2ZSk7XG4gICAgcmV0dXJuIGRpcjtcbiAgfVxuXG4gIHZhciBvYnNlcnZlZFNldENhY2hlID0gW107XG5cbiAgZnVuY3Rpb24gbmV3T2JzZXJ2ZWRTZXQoKSB7XG4gICAgdmFyIG9ic2VydmVyQ291bnQgPSAwO1xuICAgIHZhciBvYnNlcnZlcnMgPSBbXTtcbiAgICB2YXIgb2JqZWN0cyA9IFtdO1xuICAgIHZhciByb290T2JqO1xuICAgIHZhciByb290T2JqUHJvcHM7XG5cbiAgICBmdW5jdGlvbiBvYnNlcnZlKG9iaiwgcHJvcCkge1xuICAgICAgaWYgKCFvYmopXG4gICAgICAgIHJldHVybjtcblxuICAgICAgaWYgKG9iaiA9PT0gcm9vdE9iailcbiAgICAgICAgcm9vdE9ialByb3BzW3Byb3BdID0gdHJ1ZTtcblxuICAgICAgaWYgKG9iamVjdHMuaW5kZXhPZihvYmopIDwgMCkge1xuICAgICAgICBvYmplY3RzLnB1c2gob2JqKTtcbiAgICAgICAgT2JqZWN0Lm9ic2VydmUob2JqLCBjYWxsYmFjayk7XG4gICAgICB9XG5cbiAgICAgIG9ic2VydmUoT2JqZWN0LmdldFByb3RvdHlwZU9mKG9iaiksIHByb3ApO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFsbFJvb3RPYmpOb25PYnNlcnZlZFByb3BzKHJlY3MpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVjcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgcmVjID0gcmVjc1tpXTtcbiAgICAgICAgaWYgKHJlYy5vYmplY3QgIT09IHJvb3RPYmogfHxcbiAgICAgICAgICAgIHJvb3RPYmpQcm9wc1tyZWMubmFtZV0gfHxcbiAgICAgICAgICAgIHJlYy50eXBlID09PSAnc2V0UHJvdG90eXBlJykge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2FsbGJhY2socmVjcykge1xuICAgICAgaWYgKGFsbFJvb3RPYmpOb25PYnNlcnZlZFByb3BzKHJlY3MpKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIHZhciBvYnNlcnZlcjtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2JzZXJ2ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIG9ic2VydmVyID0gb2JzZXJ2ZXJzW2ldO1xuICAgICAgICBpZiAob2JzZXJ2ZXIuc3RhdGVfID09IE9QRU5FRCkge1xuICAgICAgICAgIG9ic2VydmVyLml0ZXJhdGVPYmplY3RzXyhvYnNlcnZlKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9ic2VydmVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICBvYnNlcnZlciA9IG9ic2VydmVyc1tpXTtcbiAgICAgICAgaWYgKG9ic2VydmVyLnN0YXRlXyA9PSBPUEVORUQpIHtcbiAgICAgICAgICBvYnNlcnZlci5jaGVja18oKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHZhciByZWNvcmQgPSB7XG4gICAgICBvYmplY3Q6IHVuZGVmaW5lZCxcbiAgICAgIG9iamVjdHM6IG9iamVjdHMsXG4gICAgICBvcGVuOiBmdW5jdGlvbihvYnMsIG9iamVjdCkge1xuICAgICAgICBpZiAoIXJvb3RPYmopIHtcbiAgICAgICAgICByb290T2JqID0gb2JqZWN0O1xuICAgICAgICAgIHJvb3RPYmpQcm9wcyA9IHt9O1xuICAgICAgICB9XG5cbiAgICAgICAgb2JzZXJ2ZXJzLnB1c2gob2JzKTtcbiAgICAgICAgb2JzZXJ2ZXJDb3VudCsrO1xuICAgICAgICBvYnMuaXRlcmF0ZU9iamVjdHNfKG9ic2VydmUpO1xuICAgICAgfSxcbiAgICAgIGNsb3NlOiBmdW5jdGlvbihvYnMpIHtcbiAgICAgICAgb2JzZXJ2ZXJDb3VudC0tO1xuICAgICAgICBpZiAob2JzZXJ2ZXJDb3VudCA+IDApIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9iamVjdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBPYmplY3QudW5vYnNlcnZlKG9iamVjdHNbaV0sIGNhbGxiYWNrKTtcbiAgICAgICAgICBPYnNlcnZlci51bm9ic2VydmVkQ291bnQrKztcbiAgICAgICAgfVxuXG4gICAgICAgIG9ic2VydmVycy5sZW5ndGggPSAwO1xuICAgICAgICBvYmplY3RzLmxlbmd0aCA9IDA7XG4gICAgICAgIHJvb3RPYmogPSB1bmRlZmluZWQ7XG4gICAgICAgIHJvb3RPYmpQcm9wcyA9IHVuZGVmaW5lZDtcbiAgICAgICAgb2JzZXJ2ZWRTZXRDYWNoZS5wdXNoKHRoaXMpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gcmVjb3JkO1xuICB9XG5cbiAgdmFyIGxhc3RPYnNlcnZlZFNldDtcblxuICB2YXIgVU5PUEVORUQgPSAwO1xuICB2YXIgT1BFTkVEID0gMTtcbiAgdmFyIENMT1NFRCA9IDI7XG5cbiAgdmFyIG5leHRPYnNlcnZlcklkID0gMTtcblxuICBmdW5jdGlvbiBPYnNlcnZlcigpIHtcbiAgICB0aGlzLnN0YXRlXyA9IFVOT1BFTkVEO1xuICAgIHRoaXMuY2FsbGJhY2tfID0gdW5kZWZpbmVkO1xuICAgIHRoaXMudGFyZ2V0XyA9IHVuZGVmaW5lZDsgLy8gVE9ETyhyYWZhZWx3KTogU2hvdWxkIGJlIFdlYWtSZWZcbiAgICB0aGlzLmRpcmVjdE9ic2VydmVyXyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLnZhbHVlXyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLmlkXyA9IG5leHRPYnNlcnZlcklkKys7XG4gIH1cblxuICBPYnNlcnZlci5wcm90b3R5cGUgPSB7XG4gICAgb3BlbjogZnVuY3Rpb24oY2FsbGJhY2ssIHRhcmdldCkge1xuICAgICAgaWYgKHRoaXMuc3RhdGVfICE9IFVOT1BFTkVEKVxuICAgICAgICB0aHJvdyBFcnJvcignT2JzZXJ2ZXIgaGFzIGFscmVhZHkgYmVlbiBvcGVuZWQuJyk7XG5cbiAgICAgIGFkZFRvQWxsKHRoaXMpO1xuICAgICAgdGhpcy5jYWxsYmFja18gPSBjYWxsYmFjaztcbiAgICAgIHRoaXMudGFyZ2V0XyA9IHRhcmdldDtcbiAgICAgIHRoaXMuY29ubmVjdF8oKTtcbiAgICAgIHRoaXMuc3RhdGVfID0gT1BFTkVEO1xuICAgICAgcmV0dXJuIHRoaXMudmFsdWVfO1xuICAgIH0sXG5cbiAgICBjbG9zZTogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gT1BFTkVEKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIHJlbW92ZUZyb21BbGwodGhpcyk7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RfKCk7XG4gICAgICB0aGlzLnZhbHVlXyA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMuY2FsbGJhY2tfID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy50YXJnZXRfID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5zdGF0ZV8gPSBDTE9TRUQ7XG4gICAgfSxcblxuICAgIGRlbGl2ZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuc3RhdGVfICE9IE9QRU5FRClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICBkaXJ0eUNoZWNrKHRoaXMpO1xuICAgIH0sXG5cbiAgICByZXBvcnRfOiBmdW5jdGlvbihjaGFuZ2VzKSB7XG4gICAgICB0cnkge1xuICAgICAgICB0aGlzLmNhbGxiYWNrXy5hcHBseSh0aGlzLnRhcmdldF8sIGNoYW5nZXMpO1xuICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgT2JzZXJ2ZXIuX2Vycm9yVGhyb3duRHVyaW5nQ2FsbGJhY2sgPSB0cnVlO1xuICAgICAgICBjb25zb2xlLmVycm9yKCdFeGNlcHRpb24gY2F1Z2h0IGR1cmluZyBvYnNlcnZlciBjYWxsYmFjazogJyArXG4gICAgICAgICAgICAgICAgICAgICAgIChleC5zdGFjayB8fCBleCkpO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBkaXNjYXJkQ2hhbmdlczogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLmNoZWNrXyh1bmRlZmluZWQsIHRydWUpO1xuICAgICAgcmV0dXJuIHRoaXMudmFsdWVfO1xuICAgIH1cbiAgfVxuXG4gIHZhciBjb2xsZWN0T2JzZXJ2ZXJzID0gIWhhc09ic2VydmU7XG4gIHZhciBhbGxPYnNlcnZlcnM7XG4gIE9ic2VydmVyLl9hbGxPYnNlcnZlcnNDb3VudCA9IDA7XG5cbiAgaWYgKGNvbGxlY3RPYnNlcnZlcnMpIHtcbiAgICBhbGxPYnNlcnZlcnMgPSBbXTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZFRvQWxsKG9ic2VydmVyKSB7XG4gICAgT2JzZXJ2ZXIuX2FsbE9ic2VydmVyc0NvdW50Kys7XG4gICAgaWYgKCFjb2xsZWN0T2JzZXJ2ZXJzKVxuICAgICAgcmV0dXJuO1xuXG4gICAgYWxsT2JzZXJ2ZXJzLnB1c2gob2JzZXJ2ZXIpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVtb3ZlRnJvbUFsbChvYnNlcnZlcikge1xuICAgIE9ic2VydmVyLl9hbGxPYnNlcnZlcnNDb3VudC0tO1xuICB9XG5cbiAgdmFyIHJ1bm5pbmdNaWNyb3Rhc2tDaGVja3BvaW50ID0gZmFsc2U7XG5cbiAgdmFyIGhhc0RlYnVnRm9yY2VGdWxsRGVsaXZlcnkgPSBoYXNPYnNlcnZlICYmIGhhc0V2YWwgJiYgKGZ1bmN0aW9uKCkge1xuICAgIHRyeSB7XG4gICAgICBldmFsKCclUnVuTWljcm90YXNrcygpJyk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfSkoKTtcblxuICBnbG9iYWwuUGxhdGZvcm0gPSBnbG9iYWwuUGxhdGZvcm0gfHwge307XG5cbiAgZ2xvYmFsLlBsYXRmb3JtLnBlcmZvcm1NaWNyb3Rhc2tDaGVja3BvaW50ID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKHJ1bm5pbmdNaWNyb3Rhc2tDaGVja3BvaW50KVxuICAgICAgcmV0dXJuO1xuXG4gICAgaWYgKGhhc0RlYnVnRm9yY2VGdWxsRGVsaXZlcnkpIHtcbiAgICAgIGV2YWwoJyVSdW5NaWNyb3Rhc2tzKCknKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIWNvbGxlY3RPYnNlcnZlcnMpXG4gICAgICByZXR1cm47XG5cbiAgICBydW5uaW5nTWljcm90YXNrQ2hlY2twb2ludCA9IHRydWU7XG5cbiAgICB2YXIgY3ljbGVzID0gMDtcbiAgICB2YXIgYW55Q2hhbmdlZCwgdG9DaGVjaztcblxuICAgIGRvIHtcbiAgICAgIGN5Y2xlcysrO1xuICAgICAgdG9DaGVjayA9IGFsbE9ic2VydmVycztcbiAgICAgIGFsbE9ic2VydmVycyA9IFtdO1xuICAgICAgYW55Q2hhbmdlZCA9IGZhbHNlO1xuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRvQ2hlY2subGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIG9ic2VydmVyID0gdG9DaGVja1tpXTtcbiAgICAgICAgaWYgKG9ic2VydmVyLnN0YXRlXyAhPSBPUEVORUQpXG4gICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgaWYgKG9ic2VydmVyLmNoZWNrXygpKVxuICAgICAgICAgIGFueUNoYW5nZWQgPSB0cnVlO1xuXG4gICAgICAgIGFsbE9ic2VydmVycy5wdXNoKG9ic2VydmVyKTtcbiAgICAgIH1cbiAgICAgIGlmIChydW5FT01UYXNrcygpKVxuICAgICAgICBhbnlDaGFuZ2VkID0gdHJ1ZTtcbiAgICB9IHdoaWxlIChjeWNsZXMgPCBNQVhfRElSVFlfQ0hFQ0tfQ1lDTEVTICYmIGFueUNoYW5nZWQpO1xuXG4gICAgaWYgKHRlc3RpbmdFeHBvc2VDeWNsZUNvdW50KVxuICAgICAgZ2xvYmFsLmRpcnR5Q2hlY2tDeWNsZUNvdW50ID0gY3ljbGVzO1xuXG4gICAgcnVubmluZ01pY3JvdGFza0NoZWNrcG9pbnQgPSBmYWxzZTtcbiAgfTtcblxuICBpZiAoY29sbGVjdE9ic2VydmVycykge1xuICAgIGdsb2JhbC5QbGF0Zm9ybS5jbGVhck9ic2VydmVycyA9IGZ1bmN0aW9uKCkge1xuICAgICAgYWxsT2JzZXJ2ZXJzID0gW107XG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIE9iamVjdE9ic2VydmVyKG9iamVjdCkge1xuICAgIE9ic2VydmVyLmNhbGwodGhpcyk7XG4gICAgdGhpcy52YWx1ZV8gPSBvYmplY3Q7XG4gICAgdGhpcy5vbGRPYmplY3RfID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgT2JqZWN0T2JzZXJ2ZXIucHJvdG90eXBlID0gY3JlYXRlT2JqZWN0KHtcbiAgICBfX3Byb3RvX186IE9ic2VydmVyLnByb3RvdHlwZSxcblxuICAgIGFycmF5T2JzZXJ2ZTogZmFsc2UsXG5cbiAgICBjb25uZWN0XzogZnVuY3Rpb24oY2FsbGJhY2ssIHRhcmdldCkge1xuICAgICAgaWYgKGhhc09ic2VydmUpIHtcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8gPSBnZXRPYnNlcnZlZE9iamVjdCh0aGlzLCB0aGlzLnZhbHVlXyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFycmF5T2JzZXJ2ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm9sZE9iamVjdF8gPSB0aGlzLmNvcHlPYmplY3QodGhpcy52YWx1ZV8pO1xuICAgICAgfVxuXG4gICAgfSxcblxuICAgIGNvcHlPYmplY3Q6IGZ1bmN0aW9uKG9iamVjdCkge1xuICAgICAgdmFyIGNvcHkgPSBBcnJheS5pc0FycmF5KG9iamVjdCkgPyBbXSA6IHt9O1xuICAgICAgZm9yICh2YXIgcHJvcCBpbiBvYmplY3QpIHtcbiAgICAgICAgY29weVtwcm9wXSA9IG9iamVjdFtwcm9wXTtcbiAgICAgIH07XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShvYmplY3QpKVxuICAgICAgICBjb3B5Lmxlbmd0aCA9IG9iamVjdC5sZW5ndGg7XG4gICAgICByZXR1cm4gY29weTtcbiAgICB9LFxuXG4gICAgY2hlY2tfOiBmdW5jdGlvbihjaGFuZ2VSZWNvcmRzLCBza2lwQ2hhbmdlcykge1xuICAgICAgdmFyIGRpZmY7XG4gICAgICB2YXIgb2xkVmFsdWVzO1xuICAgICAgaWYgKGhhc09ic2VydmUpIHtcbiAgICAgICAgaWYgKCFjaGFuZ2VSZWNvcmRzKVxuICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICBvbGRWYWx1ZXMgPSB7fTtcbiAgICAgICAgZGlmZiA9IGRpZmZPYmplY3RGcm9tQ2hhbmdlUmVjb3Jkcyh0aGlzLnZhbHVlXywgY2hhbmdlUmVjb3JkcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGRWYWx1ZXMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb2xkVmFsdWVzID0gdGhpcy5vbGRPYmplY3RfO1xuICAgICAgICBkaWZmID0gZGlmZk9iamVjdEZyb21PbGRPYmplY3QodGhpcy52YWx1ZV8sIHRoaXMub2xkT2JqZWN0Xyk7XG4gICAgICB9XG5cbiAgICAgIGlmIChkaWZmSXNFbXB0eShkaWZmKSlcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICBpZiAoIWhhc09ic2VydmUpXG4gICAgICAgIHRoaXMub2xkT2JqZWN0XyA9IHRoaXMuY29weU9iamVjdCh0aGlzLnZhbHVlXyk7XG5cbiAgICAgIHRoaXMucmVwb3J0XyhbXG4gICAgICAgIGRpZmYuYWRkZWQgfHwge30sXG4gICAgICAgIGRpZmYucmVtb3ZlZCB8fCB7fSxcbiAgICAgICAgZGlmZi5jaGFuZ2VkIHx8IHt9LFxuICAgICAgICBmdW5jdGlvbihwcm9wZXJ0eSkge1xuICAgICAgICAgIHJldHVybiBvbGRWYWx1ZXNbcHJvcGVydHldO1xuICAgICAgICB9XG4gICAgICBdKTtcblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSxcblxuICAgIGRpc2Nvbm5lY3RfOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmIChoYXNPYnNlcnZlKSB7XG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfLmNsb3NlKCk7XG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gdW5kZWZpbmVkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBkZWxpdmVyOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBPUEVORUQpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgaWYgKGhhc09ic2VydmUpXG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfLmRlbGl2ZXIoZmFsc2UpO1xuICAgICAgZWxzZVxuICAgICAgICBkaXJ0eUNoZWNrKHRoaXMpO1xuICAgIH0sXG5cbiAgICBkaXNjYXJkQ2hhbmdlczogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5kaXJlY3RPYnNlcnZlcl8pXG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfLmRlbGl2ZXIodHJ1ZSk7XG4gICAgICBlbHNlXG4gICAgICAgIHRoaXMub2xkT2JqZWN0XyA9IHRoaXMuY29weU9iamVjdCh0aGlzLnZhbHVlXyk7XG5cbiAgICAgIHJldHVybiB0aGlzLnZhbHVlXztcbiAgICB9XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIEFycmF5T2JzZXJ2ZXIoYXJyYXkpIHtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoYXJyYXkpKVxuICAgICAgdGhyb3cgRXJyb3IoJ1Byb3ZpZGVkIG9iamVjdCBpcyBub3QgYW4gQXJyYXknKTtcbiAgICBPYmplY3RPYnNlcnZlci5jYWxsKHRoaXMsIGFycmF5KTtcbiAgfVxuXG4gIEFycmF5T2JzZXJ2ZXIucHJvdG90eXBlID0gY3JlYXRlT2JqZWN0KHtcblxuICAgIF9fcHJvdG9fXzogT2JqZWN0T2JzZXJ2ZXIucHJvdG90eXBlLFxuXG4gICAgYXJyYXlPYnNlcnZlOiB0cnVlLFxuXG4gICAgY29weU9iamVjdDogZnVuY3Rpb24oYXJyKSB7XG4gICAgICByZXR1cm4gYXJyLnNsaWNlKCk7XG4gICAgfSxcblxuICAgIGNoZWNrXzogZnVuY3Rpb24oY2hhbmdlUmVjb3Jkcykge1xuICAgICAgdmFyIHNwbGljZXM7XG4gICAgICBpZiAoaGFzT2JzZXJ2ZSkge1xuICAgICAgICBpZiAoIWNoYW5nZVJlY29yZHMpXG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICBzcGxpY2VzID0gcHJvamVjdEFycmF5U3BsaWNlcyh0aGlzLnZhbHVlXywgY2hhbmdlUmVjb3Jkcyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzcGxpY2VzID0gY2FsY1NwbGljZXModGhpcy52YWx1ZV8sIDAsIHRoaXMudmFsdWVfLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMub2xkT2JqZWN0XywgMCwgdGhpcy5vbGRPYmplY3RfLmxlbmd0aCk7XG4gICAgICB9XG5cbiAgICAgIGlmICghc3BsaWNlcyB8fCAhc3BsaWNlcy5sZW5ndGgpXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgaWYgKCFoYXNPYnNlcnZlKVxuICAgICAgICB0aGlzLm9sZE9iamVjdF8gPSB0aGlzLmNvcHlPYmplY3QodGhpcy52YWx1ZV8pO1xuXG4gICAgICB0aGlzLnJlcG9ydF8oW3NwbGljZXNdKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfSk7XG5cbiAgQXJyYXlPYnNlcnZlci5hcHBseVNwbGljZXMgPSBmdW5jdGlvbihwcmV2aW91cywgY3VycmVudCwgc3BsaWNlcykge1xuICAgIHNwbGljZXMuZm9yRWFjaChmdW5jdGlvbihzcGxpY2UpIHtcbiAgICAgIHZhciBzcGxpY2VBcmdzID0gW3NwbGljZS5pbmRleCwgc3BsaWNlLnJlbW92ZWQubGVuZ3RoXTtcbiAgICAgIHZhciBhZGRJbmRleCA9IHNwbGljZS5pbmRleDtcbiAgICAgIHdoaWxlIChhZGRJbmRleCA8IHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50KSB7XG4gICAgICAgIHNwbGljZUFyZ3MucHVzaChjdXJyZW50W2FkZEluZGV4XSk7XG4gICAgICAgIGFkZEluZGV4Kys7XG4gICAgICB9XG5cbiAgICAgIEFycmF5LnByb3RvdHlwZS5zcGxpY2UuYXBwbHkocHJldmlvdXMsIHNwbGljZUFyZ3MpO1xuICAgIH0pO1xuICB9O1xuXG4gIHZhciBvYnNlcnZlclNlbnRpbmVsID0ge307XG5cbiAgdmFyIGV4cGVjdGVkUmVjb3JkVHlwZXMgPSB7XG4gICAgYWRkOiB0cnVlLFxuICAgIHVwZGF0ZTogdHJ1ZSxcbiAgICBkZWxldGU6IHRydWVcbiAgfTtcblxuICBmdW5jdGlvbiBkaWZmT2JqZWN0RnJvbUNoYW5nZVJlY29yZHMob2JqZWN0LCBjaGFuZ2VSZWNvcmRzLCBvbGRWYWx1ZXMpIHtcbiAgICB2YXIgYWRkZWQgPSB7fTtcbiAgICB2YXIgcmVtb3ZlZCA9IHt9O1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGFuZ2VSZWNvcmRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgcmVjb3JkID0gY2hhbmdlUmVjb3Jkc1tpXTtcbiAgICAgIGlmICghZXhwZWN0ZWRSZWNvcmRUeXBlc1tyZWNvcmQudHlwZV0pIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignVW5rbm93biBjaGFuZ2VSZWNvcmQgdHlwZTogJyArIHJlY29yZC50eXBlKTtcbiAgICAgICAgY29uc29sZS5lcnJvcihyZWNvcmQpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKCEocmVjb3JkLm5hbWUgaW4gb2xkVmFsdWVzKSlcbiAgICAgICAgb2xkVmFsdWVzW3JlY29yZC5uYW1lXSA9IHJlY29yZC5vbGRWYWx1ZTtcblxuICAgICAgaWYgKHJlY29yZC50eXBlID09ICd1cGRhdGUnKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgaWYgKHJlY29yZC50eXBlID09ICdhZGQnKSB7XG4gICAgICAgIGlmIChyZWNvcmQubmFtZSBpbiByZW1vdmVkKVxuICAgICAgICAgIGRlbGV0ZSByZW1vdmVkW3JlY29yZC5uYW1lXTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGFkZGVkW3JlY29yZC5uYW1lXSA9IHRydWU7XG5cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIHR5cGUgPSAnZGVsZXRlJ1xuICAgICAgaWYgKHJlY29yZC5uYW1lIGluIGFkZGVkKSB7XG4gICAgICAgIGRlbGV0ZSBhZGRlZFtyZWNvcmQubmFtZV07XG4gICAgICAgIGRlbGV0ZSBvbGRWYWx1ZXNbcmVjb3JkLm5hbWVdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVtb3ZlZFtyZWNvcmQubmFtZV0gPSB0cnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAodmFyIHByb3AgaW4gYWRkZWQpXG4gICAgICBhZGRlZFtwcm9wXSA9IG9iamVjdFtwcm9wXTtcblxuICAgIGZvciAodmFyIHByb3AgaW4gcmVtb3ZlZClcbiAgICAgIHJlbW92ZWRbcHJvcF0gPSB1bmRlZmluZWQ7XG5cbiAgICB2YXIgY2hhbmdlZCA9IHt9O1xuICAgIGZvciAodmFyIHByb3AgaW4gb2xkVmFsdWVzKSB7XG4gICAgICBpZiAocHJvcCBpbiBhZGRlZCB8fCBwcm9wIGluIHJlbW92ZWQpXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICB2YXIgbmV3VmFsdWUgPSBvYmplY3RbcHJvcF07XG4gICAgICBpZiAob2xkVmFsdWVzW3Byb3BdICE9PSBuZXdWYWx1ZSlcbiAgICAgICAgY2hhbmdlZFtwcm9wXSA9IG5ld1ZhbHVlO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBhZGRlZDogYWRkZWQsXG4gICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgY2hhbmdlZDogY2hhbmdlZFxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBuZXdTcGxpY2UoaW5kZXgsIHJlbW92ZWQsIGFkZGVkQ291bnQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgaW5kZXg6IGluZGV4LFxuICAgICAgcmVtb3ZlZDogcmVtb3ZlZCxcbiAgICAgIGFkZGVkQ291bnQ6IGFkZGVkQ291bnRcbiAgICB9O1xuICB9XG5cbiAgdmFyIEVESVRfTEVBVkUgPSAwO1xuICB2YXIgRURJVF9VUERBVEUgPSAxO1xuICB2YXIgRURJVF9BREQgPSAyO1xuICB2YXIgRURJVF9ERUxFVEUgPSAzO1xuXG4gIGZ1bmN0aW9uIEFycmF5U3BsaWNlKCkge31cblxuICBBcnJheVNwbGljZS5wcm90b3R5cGUgPSB7XG5cbiAgICAvLyBOb3RlOiBUaGlzIGZ1bmN0aW9uIGlzICpiYXNlZCogb24gdGhlIGNvbXB1dGF0aW9uIG9mIHRoZSBMZXZlbnNodGVpblxuICAgIC8vIFwiZWRpdFwiIGRpc3RhbmNlLiBUaGUgb25lIGNoYW5nZSBpcyB0aGF0IFwidXBkYXRlc1wiIGFyZSB0cmVhdGVkIGFzIHR3b1xuICAgIC8vIGVkaXRzIC0gbm90IG9uZS4gV2l0aCBBcnJheSBzcGxpY2VzLCBhbiB1cGRhdGUgaXMgcmVhbGx5IGEgZGVsZXRlXG4gICAgLy8gZm9sbG93ZWQgYnkgYW4gYWRkLiBCeSByZXRhaW5pbmcgdGhpcywgd2Ugb3B0aW1pemUgZm9yIFwia2VlcGluZ1wiIHRoZVxuICAgIC8vIG1heGltdW0gYXJyYXkgaXRlbXMgaW4gdGhlIG9yaWdpbmFsIGFycmF5LiBGb3IgZXhhbXBsZTpcbiAgICAvL1xuICAgIC8vICAgJ3h4eHgxMjMnIC0+ICcxMjN5eXl5J1xuICAgIC8vXG4gICAgLy8gV2l0aCAxLWVkaXQgdXBkYXRlcywgdGhlIHNob3J0ZXN0IHBhdGggd291bGQgYmUganVzdCB0byB1cGRhdGUgYWxsIHNldmVuXG4gICAgLy8gY2hhcmFjdGVycy4gV2l0aCAyLWVkaXQgdXBkYXRlcywgd2UgZGVsZXRlIDQsIGxlYXZlIDMsIGFuZCBhZGQgNC4gVGhpc1xuICAgIC8vIGxlYXZlcyB0aGUgc3Vic3RyaW5nICcxMjMnIGludGFjdC5cbiAgICBjYWxjRWRpdERpc3RhbmNlczogZnVuY3Rpb24oY3VycmVudCwgY3VycmVudFN0YXJ0LCBjdXJyZW50RW5kLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGQsIG9sZFN0YXJ0LCBvbGRFbmQpIHtcbiAgICAgIC8vIFwiRGVsZXRpb25cIiBjb2x1bW5zXG4gICAgICB2YXIgcm93Q291bnQgPSBvbGRFbmQgLSBvbGRTdGFydCArIDE7XG4gICAgICB2YXIgY29sdW1uQ291bnQgPSBjdXJyZW50RW5kIC0gY3VycmVudFN0YXJ0ICsgMTtcbiAgICAgIHZhciBkaXN0YW5jZXMgPSBuZXcgQXJyYXkocm93Q291bnQpO1xuXG4gICAgICAvLyBcIkFkZGl0aW9uXCIgcm93cy4gSW5pdGlhbGl6ZSBudWxsIGNvbHVtbi5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcm93Q291bnQ7IGkrKykge1xuICAgICAgICBkaXN0YW5jZXNbaV0gPSBuZXcgQXJyYXkoY29sdW1uQ291bnQpO1xuICAgICAgICBkaXN0YW5jZXNbaV1bMF0gPSBpO1xuICAgICAgfVxuXG4gICAgICAvLyBJbml0aWFsaXplIG51bGwgcm93XG4gICAgICBmb3IgKHZhciBqID0gMDsgaiA8IGNvbHVtbkNvdW50OyBqKyspXG4gICAgICAgIGRpc3RhbmNlc1swXVtqXSA9IGo7XG5cbiAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgcm93Q291bnQ7IGkrKykge1xuICAgICAgICBmb3IgKHZhciBqID0gMTsgaiA8IGNvbHVtbkNvdW50OyBqKyspIHtcbiAgICAgICAgICBpZiAodGhpcy5lcXVhbHMoY3VycmVudFtjdXJyZW50U3RhcnQgKyBqIC0gMV0sIG9sZFtvbGRTdGFydCArIGkgLSAxXSkpXG4gICAgICAgICAgICBkaXN0YW5jZXNbaV1bal0gPSBkaXN0YW5jZXNbaSAtIDFdW2ogLSAxXTtcbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHZhciBub3J0aCA9IGRpc3RhbmNlc1tpIC0gMV1bal0gKyAxO1xuICAgICAgICAgICAgdmFyIHdlc3QgPSBkaXN0YW5jZXNbaV1baiAtIDFdICsgMTtcbiAgICAgICAgICAgIGRpc3RhbmNlc1tpXVtqXSA9IG5vcnRoIDwgd2VzdCA/IG5vcnRoIDogd2VzdDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGRpc3RhbmNlcztcbiAgICB9LFxuXG4gICAgLy8gVGhpcyBzdGFydHMgYXQgdGhlIGZpbmFsIHdlaWdodCwgYW5kIHdhbGtzIFwiYmFja3dhcmRcIiBieSBmaW5kaW5nXG4gICAgLy8gdGhlIG1pbmltdW0gcHJldmlvdXMgd2VpZ2h0IHJlY3Vyc2l2ZWx5IHVudGlsIHRoZSBvcmlnaW4gb2YgdGhlIHdlaWdodFxuICAgIC8vIG1hdHJpeC5cbiAgICBzcGxpY2VPcGVyYXRpb25zRnJvbUVkaXREaXN0YW5jZXM6IGZ1bmN0aW9uKGRpc3RhbmNlcykge1xuICAgICAgdmFyIGkgPSBkaXN0YW5jZXMubGVuZ3RoIC0gMTtcbiAgICAgIHZhciBqID0gZGlzdGFuY2VzWzBdLmxlbmd0aCAtIDE7XG4gICAgICB2YXIgY3VycmVudCA9IGRpc3RhbmNlc1tpXVtqXTtcbiAgICAgIHZhciBlZGl0cyA9IFtdO1xuICAgICAgd2hpbGUgKGkgPiAwIHx8IGogPiAwKSB7XG4gICAgICAgIGlmIChpID09IDApIHtcbiAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfQUREKTtcbiAgICAgICAgICBqLS07XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGogPT0gMCkge1xuICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9ERUxFVEUpO1xuICAgICAgICAgIGktLTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgbm9ydGhXZXN0ID0gZGlzdGFuY2VzW2kgLSAxXVtqIC0gMV07XG4gICAgICAgIHZhciB3ZXN0ID0gZGlzdGFuY2VzW2kgLSAxXVtqXTtcbiAgICAgICAgdmFyIG5vcnRoID0gZGlzdGFuY2VzW2ldW2ogLSAxXTtcblxuICAgICAgICB2YXIgbWluO1xuICAgICAgICBpZiAod2VzdCA8IG5vcnRoKVxuICAgICAgICAgIG1pbiA9IHdlc3QgPCBub3J0aFdlc3QgPyB3ZXN0IDogbm9ydGhXZXN0O1xuICAgICAgICBlbHNlXG4gICAgICAgICAgbWluID0gbm9ydGggPCBub3J0aFdlc3QgPyBub3J0aCA6IG5vcnRoV2VzdDtcblxuICAgICAgICBpZiAobWluID09IG5vcnRoV2VzdCkge1xuICAgICAgICAgIGlmIChub3J0aFdlc3QgPT0gY3VycmVudCkge1xuICAgICAgICAgICAgZWRpdHMucHVzaChFRElUX0xFQVZFKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZWRpdHMucHVzaChFRElUX1VQREFURSk7XG4gICAgICAgICAgICBjdXJyZW50ID0gbm9ydGhXZXN0O1xuICAgICAgICAgIH1cbiAgICAgICAgICBpLS07XG4gICAgICAgICAgai0tO1xuICAgICAgICB9IGVsc2UgaWYgKG1pbiA9PSB3ZXN0KSB7XG4gICAgICAgICAgZWRpdHMucHVzaChFRElUX0RFTEVURSk7XG4gICAgICAgICAgaS0tO1xuICAgICAgICAgIGN1cnJlbnQgPSB3ZXN0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9BREQpO1xuICAgICAgICAgIGotLTtcbiAgICAgICAgICBjdXJyZW50ID0gbm9ydGg7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZWRpdHMucmV2ZXJzZSgpO1xuICAgICAgcmV0dXJuIGVkaXRzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTcGxpY2UgUHJvamVjdGlvbiBmdW5jdGlvbnM6XG4gICAgICpcbiAgICAgKiBBIHNwbGljZSBtYXAgaXMgYSByZXByZXNlbnRhdGlvbiBvZiBob3cgYSBwcmV2aW91cyBhcnJheSBvZiBpdGVtc1xuICAgICAqIHdhcyB0cmFuc2Zvcm1lZCBpbnRvIGEgbmV3IGFycmF5IG9mIGl0ZW1zLiBDb25jZXB0dWFsbHkgaXQgaXMgYSBsaXN0IG9mXG4gICAgICogdHVwbGVzIG9mXG4gICAgICpcbiAgICAgKiAgIDxpbmRleCwgcmVtb3ZlZCwgYWRkZWRDb3VudD5cbiAgICAgKlxuICAgICAqIHdoaWNoIGFyZSBrZXB0IGluIGFzY2VuZGluZyBpbmRleCBvcmRlciBvZi4gVGhlIHR1cGxlIHJlcHJlc2VudHMgdGhhdCBhdFxuICAgICAqIHRoZSB8aW5kZXh8LCB8cmVtb3ZlZHwgc2VxdWVuY2Ugb2YgaXRlbXMgd2VyZSByZW1vdmVkLCBhbmQgY291bnRpbmcgZm9yd2FyZFxuICAgICAqIGZyb20gfGluZGV4fCwgfGFkZGVkQ291bnR8IGl0ZW1zIHdlcmUgYWRkZWQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBMYWNraW5nIGluZGl2aWR1YWwgc3BsaWNlIG11dGF0aW9uIGluZm9ybWF0aW9uLCB0aGUgbWluaW1hbCBzZXQgb2ZcbiAgICAgKiBzcGxpY2VzIGNhbiBiZSBzeW50aGVzaXplZCBnaXZlbiB0aGUgcHJldmlvdXMgc3RhdGUgYW5kIGZpbmFsIHN0YXRlIG9mIGFuXG4gICAgICogYXJyYXkuIFRoZSBiYXNpYyBhcHByb2FjaCBpcyB0byBjYWxjdWxhdGUgdGhlIGVkaXQgZGlzdGFuY2UgbWF0cml4IGFuZFxuICAgICAqIGNob29zZSB0aGUgc2hvcnRlc3QgcGF0aCB0aHJvdWdoIGl0LlxuICAgICAqXG4gICAgICogQ29tcGxleGl0eTogTyhsICogcClcbiAgICAgKiAgIGw6IFRoZSBsZW5ndGggb2YgdGhlIGN1cnJlbnQgYXJyYXlcbiAgICAgKiAgIHA6IFRoZSBsZW5ndGggb2YgdGhlIG9sZCBhcnJheVxuICAgICAqL1xuICAgIGNhbGNTcGxpY2VzOiBmdW5jdGlvbihjdXJyZW50LCBjdXJyZW50U3RhcnQsIGN1cnJlbnRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIG9sZCwgb2xkU3RhcnQsIG9sZEVuZCkge1xuICAgICAgdmFyIHByZWZpeENvdW50ID0gMDtcbiAgICAgIHZhciBzdWZmaXhDb3VudCA9IDA7XG5cbiAgICAgIHZhciBtaW5MZW5ndGggPSBNYXRoLm1pbihjdXJyZW50RW5kIC0gY3VycmVudFN0YXJ0LCBvbGRFbmQgLSBvbGRTdGFydCk7XG4gICAgICBpZiAoY3VycmVudFN0YXJ0ID09IDAgJiYgb2xkU3RhcnQgPT0gMClcbiAgICAgICAgcHJlZml4Q291bnQgPSB0aGlzLnNoYXJlZFByZWZpeChjdXJyZW50LCBvbGQsIG1pbkxlbmd0aCk7XG5cbiAgICAgIGlmIChjdXJyZW50RW5kID09IGN1cnJlbnQubGVuZ3RoICYmIG9sZEVuZCA9PSBvbGQubGVuZ3RoKVxuICAgICAgICBzdWZmaXhDb3VudCA9IHRoaXMuc2hhcmVkU3VmZml4KGN1cnJlbnQsIG9sZCwgbWluTGVuZ3RoIC0gcHJlZml4Q291bnQpO1xuXG4gICAgICBjdXJyZW50U3RhcnQgKz0gcHJlZml4Q291bnQ7XG4gICAgICBvbGRTdGFydCArPSBwcmVmaXhDb3VudDtcbiAgICAgIGN1cnJlbnRFbmQgLT0gc3VmZml4Q291bnQ7XG4gICAgICBvbGRFbmQgLT0gc3VmZml4Q291bnQ7XG5cbiAgICAgIGlmIChjdXJyZW50RW5kIC0gY3VycmVudFN0YXJ0ID09IDAgJiYgb2xkRW5kIC0gb2xkU3RhcnQgPT0gMClcbiAgICAgICAgcmV0dXJuIFtdO1xuXG4gICAgICBpZiAoY3VycmVudFN0YXJ0ID09IGN1cnJlbnRFbmQpIHtcbiAgICAgICAgdmFyIHNwbGljZSA9IG5ld1NwbGljZShjdXJyZW50U3RhcnQsIFtdLCAwKTtcbiAgICAgICAgd2hpbGUgKG9sZFN0YXJ0IDwgb2xkRW5kKVxuICAgICAgICAgIHNwbGljZS5yZW1vdmVkLnB1c2gob2xkW29sZFN0YXJ0KytdKTtcblxuICAgICAgICByZXR1cm4gWyBzcGxpY2UgXTtcbiAgICAgIH0gZWxzZSBpZiAob2xkU3RhcnQgPT0gb2xkRW5kKVxuICAgICAgICByZXR1cm4gWyBuZXdTcGxpY2UoY3VycmVudFN0YXJ0LCBbXSwgY3VycmVudEVuZCAtIGN1cnJlbnRTdGFydCkgXTtcblxuICAgICAgdmFyIG9wcyA9IHRoaXMuc3BsaWNlT3BlcmF0aW9uc0Zyb21FZGl0RGlzdGFuY2VzKFxuICAgICAgICAgIHRoaXMuY2FsY0VkaXREaXN0YW5jZXMoY3VycmVudCwgY3VycmVudFN0YXJ0LCBjdXJyZW50RW5kLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKSk7XG5cbiAgICAgIHZhciBzcGxpY2UgPSB1bmRlZmluZWQ7XG4gICAgICB2YXIgc3BsaWNlcyA9IFtdO1xuICAgICAgdmFyIGluZGV4ID0gY3VycmVudFN0YXJ0O1xuICAgICAgdmFyIG9sZEluZGV4ID0gb2xkU3RhcnQ7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9wcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBzd2l0Y2gob3BzW2ldKSB7XG4gICAgICAgICAgY2FzZSBFRElUX0xFQVZFOlxuICAgICAgICAgICAgaWYgKHNwbGljZSkge1xuICAgICAgICAgICAgICBzcGxpY2VzLnB1c2goc3BsaWNlKTtcbiAgICAgICAgICAgICAgc3BsaWNlID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpbmRleCsrO1xuICAgICAgICAgICAgb2xkSW5kZXgrKztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgRURJVF9VUERBVEU6XG4gICAgICAgICAgICBpZiAoIXNwbGljZSlcbiAgICAgICAgICAgICAgc3BsaWNlID0gbmV3U3BsaWNlKGluZGV4LCBbXSwgMCk7XG5cbiAgICAgICAgICAgIHNwbGljZS5hZGRlZENvdW50Kys7XG4gICAgICAgICAgICBpbmRleCsrO1xuXG4gICAgICAgICAgICBzcGxpY2UucmVtb3ZlZC5wdXNoKG9sZFtvbGRJbmRleF0pO1xuICAgICAgICAgICAgb2xkSW5kZXgrKztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgRURJVF9BREQ6XG4gICAgICAgICAgICBpZiAoIXNwbGljZSlcbiAgICAgICAgICAgICAgc3BsaWNlID0gbmV3U3BsaWNlKGluZGV4LCBbXSwgMCk7XG5cbiAgICAgICAgICAgIHNwbGljZS5hZGRlZENvdW50Kys7XG4gICAgICAgICAgICBpbmRleCsrO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBFRElUX0RFTEVURTpcbiAgICAgICAgICAgIGlmICghc3BsaWNlKVxuICAgICAgICAgICAgICBzcGxpY2UgPSBuZXdTcGxpY2UoaW5kZXgsIFtdLCAwKTtcblxuICAgICAgICAgICAgc3BsaWNlLnJlbW92ZWQucHVzaChvbGRbb2xkSW5kZXhdKTtcbiAgICAgICAgICAgIG9sZEluZGV4Kys7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoc3BsaWNlKSB7XG4gICAgICAgIHNwbGljZXMucHVzaChzcGxpY2UpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHNwbGljZXM7XG4gICAgfSxcblxuICAgIHNoYXJlZFByZWZpeDogZnVuY3Rpb24oY3VycmVudCwgb2xkLCBzZWFyY2hMZW5ndGgpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2VhcmNoTGVuZ3RoOyBpKyspXG4gICAgICAgIGlmICghdGhpcy5lcXVhbHMoY3VycmVudFtpXSwgb2xkW2ldKSlcbiAgICAgICAgICByZXR1cm4gaTtcbiAgICAgIHJldHVybiBzZWFyY2hMZW5ndGg7XG4gICAgfSxcblxuICAgIHNoYXJlZFN1ZmZpeDogZnVuY3Rpb24oY3VycmVudCwgb2xkLCBzZWFyY2hMZW5ndGgpIHtcbiAgICAgIHZhciBpbmRleDEgPSBjdXJyZW50Lmxlbmd0aDtcbiAgICAgIHZhciBpbmRleDIgPSBvbGQubGVuZ3RoO1xuICAgICAgdmFyIGNvdW50ID0gMDtcbiAgICAgIHdoaWxlIChjb3VudCA8IHNlYXJjaExlbmd0aCAmJiB0aGlzLmVxdWFscyhjdXJyZW50Wy0taW5kZXgxXSwgb2xkWy0taW5kZXgyXSkpXG4gICAgICAgIGNvdW50Kys7XG5cbiAgICAgIHJldHVybiBjb3VudDtcbiAgICB9LFxuXG4gICAgY2FsY3VsYXRlU3BsaWNlczogZnVuY3Rpb24oY3VycmVudCwgcHJldmlvdXMpIHtcbiAgICAgIHJldHVybiB0aGlzLmNhbGNTcGxpY2VzKGN1cnJlbnQsIDAsIGN1cnJlbnQubGVuZ3RoLCBwcmV2aW91cywgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByZXZpb3VzLmxlbmd0aCk7XG4gICAgfSxcblxuICAgIGVxdWFsczogZnVuY3Rpb24oY3VycmVudFZhbHVlLCBwcmV2aW91c1ZhbHVlKSB7XG4gICAgICByZXR1cm4gY3VycmVudFZhbHVlID09PSBwcmV2aW91c1ZhbHVlO1xuICAgIH1cbiAgfTtcblxuICB2YXIgYXJyYXlTcGxpY2UgPSBuZXcgQXJyYXlTcGxpY2UoKTtcblxuICBmdW5jdGlvbiBjYWxjU3BsaWNlcyhjdXJyZW50LCBjdXJyZW50U3RhcnQsIGN1cnJlbnRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgIG9sZCwgb2xkU3RhcnQsIG9sZEVuZCkge1xuICAgIHJldHVybiBhcnJheVNwbGljZS5jYWxjU3BsaWNlcyhjdXJyZW50LCBjdXJyZW50U3RhcnQsIGN1cnJlbnRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZCwgb2xkU3RhcnQsIG9sZEVuZCk7XG4gIH1cblxuICBmdW5jdGlvbiBpbnRlcnNlY3Qoc3RhcnQxLCBlbmQxLCBzdGFydDIsIGVuZDIpIHtcbiAgICAvLyBEaXNqb2ludFxuICAgIGlmIChlbmQxIDwgc3RhcnQyIHx8IGVuZDIgPCBzdGFydDEpXG4gICAgICByZXR1cm4gLTE7XG5cbiAgICAvLyBBZGphY2VudFxuICAgIGlmIChlbmQxID09IHN0YXJ0MiB8fCBlbmQyID09IHN0YXJ0MSlcbiAgICAgIHJldHVybiAwO1xuXG4gICAgLy8gTm9uLXplcm8gaW50ZXJzZWN0LCBzcGFuMSBmaXJzdFxuICAgIGlmIChzdGFydDEgPCBzdGFydDIpIHtcbiAgICAgIGlmIChlbmQxIDwgZW5kMilcbiAgICAgICAgcmV0dXJuIGVuZDEgLSBzdGFydDI7IC8vIE92ZXJsYXBcbiAgICAgIGVsc2VcbiAgICAgICAgcmV0dXJuIGVuZDIgLSBzdGFydDI7IC8vIENvbnRhaW5lZFxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBOb24temVybyBpbnRlcnNlY3QsIHNwYW4yIGZpcnN0XG4gICAgICBpZiAoZW5kMiA8IGVuZDEpXG4gICAgICAgIHJldHVybiBlbmQyIC0gc3RhcnQxOyAvLyBPdmVybGFwXG4gICAgICBlbHNlXG4gICAgICAgIHJldHVybiBlbmQxIC0gc3RhcnQxOyAvLyBDb250YWluZWRcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBtZXJnZVNwbGljZShzcGxpY2VzLCBpbmRleCwgcmVtb3ZlZCwgYWRkZWRDb3VudCkge1xuXG4gICAgdmFyIHNwbGljZSA9IG5ld1NwbGljZShpbmRleCwgcmVtb3ZlZCwgYWRkZWRDb3VudCk7XG5cbiAgICB2YXIgaW5zZXJ0ZWQgPSBmYWxzZTtcbiAgICB2YXIgaW5zZXJ0aW9uT2Zmc2V0ID0gMDtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3BsaWNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGN1cnJlbnQgPSBzcGxpY2VzW2ldO1xuICAgICAgY3VycmVudC5pbmRleCArPSBpbnNlcnRpb25PZmZzZXQ7XG5cbiAgICAgIGlmIChpbnNlcnRlZClcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIHZhciBpbnRlcnNlY3RDb3VudCA9IGludGVyc2VjdChzcGxpY2UuaW5kZXgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3BsaWNlLmluZGV4ICsgc3BsaWNlLnJlbW92ZWQubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnQuaW5kZXgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudC5pbmRleCArIGN1cnJlbnQuYWRkZWRDb3VudCk7XG5cbiAgICAgIGlmIChpbnRlcnNlY3RDb3VudCA+PSAwKSB7XG4gICAgICAgIC8vIE1lcmdlIHRoZSB0d28gc3BsaWNlc1xuXG4gICAgICAgIHNwbGljZXMuc3BsaWNlKGksIDEpO1xuICAgICAgICBpLS07XG5cbiAgICAgICAgaW5zZXJ0aW9uT2Zmc2V0IC09IGN1cnJlbnQuYWRkZWRDb3VudCAtIGN1cnJlbnQucmVtb3ZlZC5sZW5ndGg7XG5cbiAgICAgICAgc3BsaWNlLmFkZGVkQ291bnQgKz0gY3VycmVudC5hZGRlZENvdW50IC0gaW50ZXJzZWN0Q291bnQ7XG4gICAgICAgIHZhciBkZWxldGVDb3VudCA9IHNwbGljZS5yZW1vdmVkLmxlbmd0aCArXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnQucmVtb3ZlZC5sZW5ndGggLSBpbnRlcnNlY3RDb3VudDtcblxuICAgICAgICBpZiAoIXNwbGljZS5hZGRlZENvdW50ICYmICFkZWxldGVDb3VudCkge1xuICAgICAgICAgIC8vIG1lcmdlZCBzcGxpY2UgaXMgYSBub29wLiBkaXNjYXJkLlxuICAgICAgICAgIGluc2VydGVkID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YXIgcmVtb3ZlZCA9IGN1cnJlbnQucmVtb3ZlZDtcblxuICAgICAgICAgIGlmIChzcGxpY2UuaW5kZXggPCBjdXJyZW50LmluZGV4KSB7XG4gICAgICAgICAgICAvLyBzb21lIHByZWZpeCBvZiBzcGxpY2UucmVtb3ZlZCBpcyBwcmVwZW5kZWQgdG8gY3VycmVudC5yZW1vdmVkLlxuICAgICAgICAgICAgdmFyIHByZXBlbmQgPSBzcGxpY2UucmVtb3ZlZC5zbGljZSgwLCBjdXJyZW50LmluZGV4IC0gc3BsaWNlLmluZGV4KTtcbiAgICAgICAgICAgIEFycmF5LnByb3RvdHlwZS5wdXNoLmFwcGx5KHByZXBlbmQsIHJlbW92ZWQpO1xuICAgICAgICAgICAgcmVtb3ZlZCA9IHByZXBlbmQ7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHNwbGljZS5pbmRleCArIHNwbGljZS5yZW1vdmVkLmxlbmd0aCA+IGN1cnJlbnQuaW5kZXggKyBjdXJyZW50LmFkZGVkQ291bnQpIHtcbiAgICAgICAgICAgIC8vIHNvbWUgc3VmZml4IG9mIHNwbGljZS5yZW1vdmVkIGlzIGFwcGVuZGVkIHRvIGN1cnJlbnQucmVtb3ZlZC5cbiAgICAgICAgICAgIHZhciBhcHBlbmQgPSBzcGxpY2UucmVtb3ZlZC5zbGljZShjdXJyZW50LmluZGV4ICsgY3VycmVudC5hZGRlZENvdW50IC0gc3BsaWNlLmluZGV4KTtcbiAgICAgICAgICAgIEFycmF5LnByb3RvdHlwZS5wdXNoLmFwcGx5KHJlbW92ZWQsIGFwcGVuZCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgc3BsaWNlLnJlbW92ZWQgPSByZW1vdmVkO1xuICAgICAgICAgIGlmIChjdXJyZW50LmluZGV4IDwgc3BsaWNlLmluZGV4KSB7XG4gICAgICAgICAgICBzcGxpY2UuaW5kZXggPSBjdXJyZW50LmluZGV4O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChzcGxpY2UuaW5kZXggPCBjdXJyZW50LmluZGV4KSB7XG4gICAgICAgIC8vIEluc2VydCBzcGxpY2UgaGVyZS5cblxuICAgICAgICBpbnNlcnRlZCA9IHRydWU7XG5cbiAgICAgICAgc3BsaWNlcy5zcGxpY2UoaSwgMCwgc3BsaWNlKTtcbiAgICAgICAgaSsrO1xuXG4gICAgICAgIHZhciBvZmZzZXQgPSBzcGxpY2UuYWRkZWRDb3VudCAtIHNwbGljZS5yZW1vdmVkLmxlbmd0aFxuICAgICAgICBjdXJyZW50LmluZGV4ICs9IG9mZnNldDtcbiAgICAgICAgaW5zZXJ0aW9uT2Zmc2V0ICs9IG9mZnNldDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIWluc2VydGVkKVxuICAgICAgc3BsaWNlcy5wdXNoKHNwbGljZSk7XG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVJbml0aWFsU3BsaWNlcyhhcnJheSwgY2hhbmdlUmVjb3Jkcykge1xuICAgIHZhciBzcGxpY2VzID0gW107XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoYW5nZVJlY29yZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciByZWNvcmQgPSBjaGFuZ2VSZWNvcmRzW2ldO1xuICAgICAgc3dpdGNoKHJlY29yZC50eXBlKSB7XG4gICAgICAgIGNhc2UgJ3NwbGljZSc6XG4gICAgICAgICAgbWVyZ2VTcGxpY2Uoc3BsaWNlcywgcmVjb3JkLmluZGV4LCByZWNvcmQucmVtb3ZlZC5zbGljZSgpLCByZWNvcmQuYWRkZWRDb3VudCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2FkZCc6XG4gICAgICAgIGNhc2UgJ3VwZGF0ZSc6XG4gICAgICAgIGNhc2UgJ2RlbGV0ZSc6XG4gICAgICAgICAgaWYgKCFpc0luZGV4KHJlY29yZC5uYW1lKSlcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIHZhciBpbmRleCA9IHRvTnVtYmVyKHJlY29yZC5uYW1lKTtcbiAgICAgICAgICBpZiAoaW5kZXggPCAwKVxuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgbWVyZ2VTcGxpY2Uoc3BsaWNlcywgaW5kZXgsIFtyZWNvcmQub2xkVmFsdWVdLCAxKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCdVbmV4cGVjdGVkIHJlY29yZCB0eXBlOiAnICsgSlNPTi5zdHJpbmdpZnkocmVjb3JkKSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHNwbGljZXM7XG4gIH1cblxuICBmdW5jdGlvbiBwcm9qZWN0QXJyYXlTcGxpY2VzKGFycmF5LCBjaGFuZ2VSZWNvcmRzKSB7XG4gICAgdmFyIHNwbGljZXMgPSBbXTtcblxuICAgIGNyZWF0ZUluaXRpYWxTcGxpY2VzKGFycmF5LCBjaGFuZ2VSZWNvcmRzKS5mb3JFYWNoKGZ1bmN0aW9uKHNwbGljZSkge1xuICAgICAgaWYgKHNwbGljZS5hZGRlZENvdW50ID09IDEgJiYgc3BsaWNlLnJlbW92ZWQubGVuZ3RoID09IDEpIHtcbiAgICAgICAgaWYgKHNwbGljZS5yZW1vdmVkWzBdICE9PSBhcnJheVtzcGxpY2UuaW5kZXhdKVxuICAgICAgICAgIHNwbGljZXMucHVzaChzcGxpY2UpO1xuXG4gICAgICAgIHJldHVyblxuICAgICAgfTtcblxuICAgICAgc3BsaWNlcyA9IHNwbGljZXMuY29uY2F0KGNhbGNTcGxpY2VzKGFycmF5LCBzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNwbGljZS5yZW1vdmVkLCAwLCBzcGxpY2UucmVtb3ZlZC5sZW5ndGgpKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBzcGxpY2VzO1xuICB9XG5cbiAvLyBFeHBvcnQgdGhlIG9ic2VydmUtanMgb2JqZWN0IGZvciAqKk5vZGUuanMqKiwgd2l0aFxuLy8gYmFja3dhcmRzLWNvbXBhdGliaWxpdHkgZm9yIHRoZSBvbGQgYHJlcXVpcmUoKWAgQVBJLiBJZiB3ZSdyZSBpblxuLy8gdGhlIGJyb3dzZXIsIGV4cG9ydCBhcyBhIGdsb2JhbCBvYmplY3QuXG52YXIgZXhwb3NlID0gZ2xvYmFsO1xuaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG5leHBvc2UgPSBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHM7XG59XG5leHBvc2UgPSBleHBvcnRzO1xufVxuZXhwb3NlLk9ic2VydmVyID0gT2JzZXJ2ZXI7XG5leHBvc2UuT2JzZXJ2ZXIucnVuRU9NXyA9IHJ1bkVPTTtcbmV4cG9zZS5PYnNlcnZlci5vYnNlcnZlclNlbnRpbmVsXyA9IG9ic2VydmVyU2VudGluZWw7IC8vIGZvciB0ZXN0aW5nLlxuZXhwb3NlLk9ic2VydmVyLmhhc09iamVjdE9ic2VydmUgPSBoYXNPYnNlcnZlO1xuZXhwb3NlLkFycmF5T2JzZXJ2ZXIgPSBBcnJheU9ic2VydmVyO1xuZXhwb3NlLkFycmF5T2JzZXJ2ZXIuY2FsY3VsYXRlU3BsaWNlcyA9IGZ1bmN0aW9uKGN1cnJlbnQsIHByZXZpb3VzKSB7XG5yZXR1cm4gYXJyYXlTcGxpY2UuY2FsY3VsYXRlU3BsaWNlcyhjdXJyZW50LCBwcmV2aW91cyk7XG59O1xuZXhwb3NlLlBsYXRmb3JtID0gZ2xvYmFsLlBsYXRmb3JtO1xuZXhwb3NlLkFycmF5U3BsaWNlID0gQXJyYXlTcGxpY2U7XG5leHBvc2UuT2JqZWN0T2JzZXJ2ZXIgPSBPYmplY3RPYnNlcnZlcjtcbn0pKHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnICYmIGdsb2JhbCAmJiB0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUgPyBnbG9iYWwgOiB0aGlzIHx8IHdpbmRvdyk7XG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUuanNcbiAqKiBtb2R1bGUgaWQgPSAyMlxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuZnVuY3Rpb24gQ29uZGl0aW9uKGZuLCBsYXp5KSB7XG4gIGlmIChsYXp5ID09PSB1bmRlZmluZWQgfHwgbGF6eSA9PT0gbnVsbCkge1xuICAgIGxhenkgPSB0cnVlO1xuICB9XG4gIGZuID0gZm4gfHwgZnVuY3Rpb24oZG9uZSkge1xuICAgIGRvbmUoKTtcbiAgfTtcblxuICB0aGlzLl9wcm9taXNlID0gbmV3IHV0aWwuUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICB0aGlzLmZuID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLmV4ZWN1dGVkID0gdHJ1ZTtcbiAgICAgIHZhciBudW1Db21wbGV0ZSA9IDA7XG4gICAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgICAgdmFyIGVycm9ycyA9IFtdO1xuICAgICAgaWYgKHV0aWwuaXNBcnJheShmbikpIHtcbiAgICAgICAgdmFyIGNoZWNrQ29tcGxldGUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZiAobnVtQ29tcGxldGUubGVuZ3RoID09IGZuLmxlbmd0aCkge1xuICAgICAgICAgICAgaWYgKGVycm9ycy5sZW5ndGgpIHRoaXMuX3Byb21pc2UucmVqZWN0KGVycm9ycyk7XG4gICAgICAgICAgICBlbHNlIHRoaXMuX3Byb21pc2UucmVzb2x2ZShudWxsLCByZXN1bHRzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0uYmluZCh0aGlzKTtcblxuICAgICAgICBmbi5mb3JFYWNoKGZ1bmN0aW9uKGNvbmQsIGlkeCkge1xuICAgICAgICAgIGNvbmQudGhlbihmdW5jdGlvbihyZXMpIHtcbiAgICAgICAgICAgIHJlc3VsdHNbaWR4XSA9IHJlcztcbiAgICAgICAgICAgIG51bUNvbXBsZXRlKys7XG4gICAgICAgICAgICBjaGVja0NvbXBsZXRlKCk7XG4gICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICBlcnJvcnNbaWR4XSA9IGVycjtcbiAgICAgICAgICAgIG51bUNvbXBsZXRlKys7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGZuKGZ1bmN0aW9uKGVyciwgcmVzKSB7XG4gICAgICAgICAgaWYgKGVycikgcmVqZWN0KGVycik7XG4gICAgICAgICAgZWxzZSByZXNvbHZlKHJlcyk7XG4gICAgICAgIH0uYmluZCh0aGlzKSlcbiAgICAgIH1cbiAgICB9XG4gIH0uYmluZCh0aGlzKSk7XG5cbiAgaWYgKCFsYXp5KSB0aGlzLl9leGVjdXRlKCk7XG4gIHRoaXMuZXhlY3V0ZWQgPSBmYWxzZTtcbn1cblxuQ29uZGl0aW9uLnByb3RvdHlwZSA9IHtcbiAgX2V4ZWN1dGU6IGZ1bmN0aW9uKCkge1xuICAgIGlmICghdGhpcy5leGVjdXRlZCkgdGhpcy5mbigpO1xuICB9LFxuICB0aGVuOiBmdW5jdGlvbihzdWNjZXNzLCBmYWlsKSB7XG4gICAgdGhpcy5fZXhlY3V0ZSgpO1xuICAgIHJldHVybiB0aGlzLl9wcm9taXNlLnRoZW4oc3VjY2VzcywgZmFpbCk7XG4gIH0sXG4gIGNhdGNoOiBmdW5jdGlvbihmYWlsKSB7XG4gICAgdGhpcy5fZXhlY3V0ZSgpO1xuICAgIHJldHVybiB0aGlzLl9wcm9taXNlLmNhdGNoKGZhaWwpO1xuICB9LFxuICByZXNvbHZlOiBmdW5jdGlvbiAocmVzKSB7XG4gICAgdGhpcy5leGVjdXRlZCA9IHRydWU7XG4gICAgdGhpcy5fcHJvbWlzZS5yZXNvbHZlKHJlcyk7XG4gIH0sXG4gIHJlamVjdDogZnVuY3Rpb24gKGVycikge1xuICAgIHRoaXMuZXhlY3V0ZWQgPSB0cnVlO1xuICAgIHRoaXMuX3Byb21pc2UucmVqZWN0KGVycik7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ29uZGl0aW9uO1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL0NvbmRpdGlvbi5qc1xuICoqIG1vZHVsZSBpZCA9IDIzXG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xuXG4vKipcbiAqIEFjdHMgYXMgYSBwbGFjZWhvbGRlciBmb3IgdmFyaW91cyBvYmplY3RzIGUuZy4gbGF6eSByZWdpc3RyYXRpb24gb2YgbW9kZWxzLlxuICogQHBhcmFtIFtvcHRzXVxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIFBsYWNlaG9sZGVyKG9wdHMpIHtcbiAgdXRpbC5leHRlbmQodGhpcywgb3B0cyB8fCB7fSk7XG4gIHRoaXMuaXNQbGFjZWhvbGRlciA9IHRydWU7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUGxhY2Vob2xkZXI7XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvUGxhY2Vob2xkZXIuanNcbiAqKiBtb2R1bGUgaWQgPSAyNFxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ21vZGVsJyksXG4gIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgUmVsYXRpb25zaGlwVHlwZSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwVHlwZScpLFxuICBRdWVyeSA9IHJlcXVpcmUoJy4vUXVlcnknKSxcbiAgTW9kZWxJbnN0YW5jZSA9IHJlcXVpcmUoJy4vTW9kZWxJbnN0YW5jZScpLFxuICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gIGd1aWQgPSB1dGlsLmd1aWQsXG4gIGNhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpLFxuICBleHRlbmQgPSByZXF1aXJlKCdleHRlbmQnKSxcbiAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gIHdyYXBBcnJheSA9IHJlcXVpcmUoJy4vZXZlbnRzJykud3JhcEFycmF5LFxuICBPbmVUb01hbnlQcm94eSA9IHJlcXVpcmUoJy4vT25lVG9NYW55UHJveHknKSxcbiAgT25lVG9PbmVQcm94eSA9IHJlcXVpcmUoJy4vT25lVG9PbmVQcm94eScpLFxuICBNYW55VG9NYW55UHJveHkgPSByZXF1aXJlKCcuL01hbnlUb01hbnlQcm94eScpLFxuICBSZWFjdGl2ZVF1ZXJ5ID0gcmVxdWlyZSgnLi9SZWFjdGl2ZVF1ZXJ5JyksXG4gIE1vZGVsRXZlbnRUeXBlID0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGU7XG5cbmZ1bmN0aW9uIE1vZGVsSW5zdGFuY2VGYWN0b3J5KG1vZGVsKSB7XG4gIHRoaXMubW9kZWwgPSBtb2RlbDtcbn1cblxuTW9kZWxJbnN0YW5jZUZhY3RvcnkucHJvdG90eXBlID0ge1xuICBfZ2V0TG9jYWxJZDogZnVuY3Rpb24oZGF0YSkge1xuICAgIHZhciBsb2NhbElkO1xuICAgIGlmIChkYXRhKSB7XG4gICAgICBsb2NhbElkID0gZGF0YS5sb2NhbElkID8gZGF0YS5sb2NhbElkIDogZ3VpZCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2NhbElkID0gZ3VpZCgpO1xuICAgIH1cbiAgICByZXR1cm4gbG9jYWxJZDtcbiAgfSxcbiAgLyoqXG4gICAqIENvbmZpZ3VyZSBhdHRyaWJ1dGVzXG4gICAqIEBwYXJhbSBtb2RlbEluc3RhbmNlXG4gICAqIEBwYXJhbSBkYXRhXG4gICAqIEBwcml2YXRlXG4gICAqL1xuXG4gIF9pbnN0YWxsQXR0cmlidXRlczogZnVuY3Rpb24obW9kZWxJbnN0YW5jZSwgZGF0YSkge1xuICAgIHZhciBNb2RlbCA9IHRoaXMubW9kZWwsXG4gICAgICBhdHRyaWJ1dGVOYW1lcyA9IE1vZGVsLl9hdHRyaWJ1dGVOYW1lcyxcbiAgICAgIGlkeCA9IGF0dHJpYnV0ZU5hbWVzLmluZGV4T2YoTW9kZWwuaWQpO1xuICAgIHV0aWwuZXh0ZW5kKG1vZGVsSW5zdGFuY2UsIHtcbiAgICAgIF9fdmFsdWVzOiB1dGlsLmV4dGVuZChNb2RlbC5hdHRyaWJ1dGVzLnJlZHVjZShmdW5jdGlvbihtLCBhKSB7XG4gICAgICAgIGlmIChhLmRlZmF1bHQgIT09IHVuZGVmaW5lZCkgbVthLm5hbWVdID0gYS5kZWZhdWx0O1xuICAgICAgICByZXR1cm4gbTtcbiAgICAgIH0sIHt9KSwgZGF0YSB8fCB7fSlcbiAgICB9KTtcbiAgICBpZiAoaWR4ID4gLTEpIGF0dHJpYnV0ZU5hbWVzLnNwbGljZShpZHgsIDEpO1xuICAgIGF0dHJpYnV0ZU5hbWVzLmZvckVhY2goZnVuY3Rpb24oYXR0cmlidXRlTmFtZSkge1xuICAgICAgdmFyIGF0dHJpYnV0ZURlZmluaXRpb24gPSBNb2RlbC5fYXR0cmlidXRlRGVmaW5pdGlvbldpdGhOYW1lKGF0dHJpYnV0ZU5hbWUpO1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG1vZGVsSW5zdGFuY2UsIGF0dHJpYnV0ZU5hbWUsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgdmFsdWUgPSBtb2RlbEluc3RhbmNlLl9fdmFsdWVzW2F0dHJpYnV0ZU5hbWVdO1xuICAgICAgICAgIHJldHVybiB2YWx1ZSA9PT0gdW5kZWZpbmVkID8gbnVsbCA6IHZhbHVlO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgICBpZiAoYXR0cmlidXRlRGVmaW5pdGlvbi5wYXJzZSkge1xuICAgICAgICAgICAgdiA9IGF0dHJpYnV0ZURlZmluaXRpb24ucGFyc2UuY2FsbChtb2RlbEluc3RhbmNlLCB2KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKE1vZGVsLnBhcnNlQXR0cmlidXRlKSB7XG4gICAgICAgICAgICB2ID0gTW9kZWwucGFyc2VBdHRyaWJ1dGUuY2FsbChtb2RlbEluc3RhbmNlLCBhdHRyaWJ1dGVOYW1lLCB2KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdmFyIG9sZCA9IG1vZGVsSW5zdGFuY2UuX192YWx1ZXNbYXR0cmlidXRlTmFtZV07XG4gICAgICAgICAgdmFyIHByb3BlcnR5RGVwZW5kZW5jaWVzID0gdGhpcy5fcHJvcGVydHlEZXBlbmRlbmNpZXNbYXR0cmlidXRlTmFtZV0gfHwgW107XG4gICAgICAgICAgcHJvcGVydHlEZXBlbmRlbmNpZXMgPSBwcm9wZXJ0eURlcGVuZGVuY2llcy5tYXAoZnVuY3Rpb24oZGVwZW5kYW50KSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBwcm9wOiBkZXBlbmRhbnQsXG4gICAgICAgICAgICAgIG9sZDogdGhpc1tkZXBlbmRhbnRdXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfS5iaW5kKHRoaXMpKTtcblxuICAgICAgICAgIG1vZGVsSW5zdGFuY2UuX192YWx1ZXNbYXR0cmlidXRlTmFtZV0gPSB2O1xuICAgICAgICAgIHByb3BlcnR5RGVwZW5kZW5jaWVzLmZvckVhY2goZnVuY3Rpb24oZGVwKSB7XG4gICAgICAgICAgICB2YXIgcHJvcGVydHlOYW1lID0gZGVwLnByb3A7XG4gICAgICAgICAgICB2YXIgbmV3XyA9IHRoaXNbcHJvcGVydHlOYW1lXTtcbiAgICAgICAgICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBNb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgbW9kZWw6IE1vZGVsLm5hbWUsXG4gICAgICAgICAgICAgIGxvY2FsSWQ6IG1vZGVsSW5zdGFuY2UubG9jYWxJZCxcbiAgICAgICAgICAgICAgbmV3OiBuZXdfLFxuICAgICAgICAgICAgICBvbGQ6IGRlcC5vbGQsXG4gICAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNldCxcbiAgICAgICAgICAgICAgZmllbGQ6IHByb3BlcnR5TmFtZSxcbiAgICAgICAgICAgICAgb2JqOiBtb2RlbEluc3RhbmNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgIHZhciBlID0ge1xuICAgICAgICAgICAgY29sbGVjdGlvbjogTW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICBtb2RlbDogTW9kZWwubmFtZSxcbiAgICAgICAgICAgIGxvY2FsSWQ6IG1vZGVsSW5zdGFuY2UubG9jYWxJZCxcbiAgICAgICAgICAgIG5ldzogdixcbiAgICAgICAgICAgIG9sZDogb2xkLFxuICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU2V0LFxuICAgICAgICAgICAgZmllbGQ6IGF0dHJpYnV0ZU5hbWUsXG4gICAgICAgICAgICBvYmo6IG1vZGVsSW5zdGFuY2VcbiAgICAgICAgICB9O1xuICAgICAgICAgIHdpbmRvdy5sYXN0RW1pc3Npb24gPSBlO1xuICAgICAgICAgIG1vZGVsRXZlbnRzLmVtaXQoZSk7XG4gICAgICAgICAgaWYgKHV0aWwuaXNBcnJheSh2KSkge1xuICAgICAgICAgICAgd3JhcEFycmF5KHYsIGF0dHJpYnV0ZU5hbWUsIG1vZGVsSW5zdGFuY2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSxcbiAgX2luc3RhbGxNZXRob2RzOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlKSB7XG4gICAgdmFyIE1vZGVsID0gdGhpcy5tb2RlbDtcbiAgICBPYmplY3Qua2V5cyhNb2RlbC5tZXRob2RzKS5mb3JFYWNoKGZ1bmN0aW9uKG1ldGhvZE5hbWUpIHtcbiAgICAgIGlmIChtb2RlbEluc3RhbmNlW21ldGhvZE5hbWVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgbW9kZWxJbnN0YW5jZVttZXRob2ROYW1lXSA9IE1vZGVsLm1ldGhvZHNbbWV0aG9kTmFtZV0uYmluZChtb2RlbEluc3RhbmNlKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBsb2coJ0EgbWV0aG9kIHdpdGggbmFtZSBcIicgKyBtZXRob2ROYW1lICsgJ1wiIGFscmVhZHkgZXhpc3RzLiBJZ25vcmluZyBpdC4nKTtcbiAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuICBfaW5zdGFsbFByb3BlcnRpZXM6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UpIHtcbiAgICB2YXIgX3Byb3BlcnR5TmFtZXMgPSBPYmplY3Qua2V5cyh0aGlzLm1vZGVsLnByb3BlcnRpZXMpLFxuICAgICAgX3Byb3BlcnR5RGVwZW5kZW5jaWVzID0ge307XG4gICAgX3Byb3BlcnR5TmFtZXMuZm9yRWFjaChmdW5jdGlvbihwcm9wTmFtZSkge1xuICAgICAgdmFyIHByb3BEZWYgPSB0aGlzLm1vZGVsLnByb3BlcnRpZXNbcHJvcE5hbWVdO1xuICAgICAgdmFyIGRlcGVuZGVuY2llcyA9IHByb3BEZWYuZGVwZW5kZW5jaWVzIHx8IFtdO1xuICAgICAgZGVwZW5kZW5jaWVzLmZvckVhY2goZnVuY3Rpb24oYXR0cikge1xuICAgICAgICBpZiAoIV9wcm9wZXJ0eURlcGVuZGVuY2llc1thdHRyXSkgX3Byb3BlcnR5RGVwZW5kZW5jaWVzW2F0dHJdID0gW107XG4gICAgICAgIF9wcm9wZXJ0eURlcGVuZGVuY2llc1thdHRyXS5wdXNoKHByb3BOYW1lKTtcbiAgICAgIH0pO1xuICAgICAgZGVsZXRlIHByb3BEZWYuZGVwZW5kZW5jaWVzO1xuICAgICAgaWYgKG1vZGVsSW5zdGFuY2VbcHJvcE5hbWVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG1vZGVsSW5zdGFuY2UsIHByb3BOYW1lLCBwcm9wRGVmKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBsb2coJ0EgcHJvcGVydHkvbWV0aG9kIHdpdGggbmFtZSBcIicgKyBwcm9wTmFtZSArICdcIiBhbHJlYWR5IGV4aXN0cy4gSWdub3JpbmcgaXQuJyk7XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIG1vZGVsSW5zdGFuY2UuX3Byb3BlcnR5RGVwZW5kZW5jaWVzID0gX3Byb3BlcnR5RGVwZW5kZW5jaWVzO1xuICB9LFxuICBfaW5zdGFsbFJlbW90ZUlkOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlKSB7XG4gICAgdmFyIE1vZGVsID0gdGhpcy5tb2RlbDtcbiAgICB2YXIgaWRGaWVsZCA9IE1vZGVsLmlkO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShtb2RlbEluc3RhbmNlLCBpZEZpZWxkLCB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gbW9kZWxJbnN0YW5jZS5fX3ZhbHVlc1tNb2RlbC5pZF0gfHwgbnVsbDtcbiAgICAgIH0sXG4gICAgICBzZXQ6IGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgdmFyIG9sZCA9IG1vZGVsSW5zdGFuY2VbTW9kZWwuaWRdO1xuICAgICAgICBtb2RlbEluc3RhbmNlLl9fdmFsdWVzW01vZGVsLmlkXSA9IHY7XG4gICAgICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgICAgIGNvbGxlY3Rpb246IE1vZGVsLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgIG1vZGVsOiBNb2RlbC5uYW1lLFxuICAgICAgICAgIGxvY2FsSWQ6IG1vZGVsSW5zdGFuY2UubG9jYWxJZCxcbiAgICAgICAgICBuZXc6IHYsXG4gICAgICAgICAgb2xkOiBvbGQsXG4gICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU2V0LFxuICAgICAgICAgIGZpZWxkOiBNb2RlbC5pZCxcbiAgICAgICAgICBvYmo6IG1vZGVsSW5zdGFuY2VcbiAgICAgICAgfSk7XG4gICAgICAgIGNhY2hlLnJlbW90ZUluc2VydChtb2RlbEluc3RhbmNlLCB2LCBvbGQpO1xuICAgICAgfSxcbiAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcbiAgfSxcbiAgLyoqXG4gICAqIEBwYXJhbSBkZWZpbml0aW9uIC0gRGVmaW5pdGlvbiBvZiBhIHJlbGF0aW9uc2hpcFxuICAgKiBAcGFyYW0gbW9kZWxJbnN0YW5jZSAtIEluc3RhbmNlIG9mIHdoaWNoIHRvIGluc3RhbGwgdGhlIHJlbGF0aW9uc2hpcC5cbiAgICovXG4gIF9pbnN0YWxsUmVsYXRpb25zaGlwOiBmdW5jdGlvbihkZWZpbml0aW9uLCBtb2RlbEluc3RhbmNlKSB7XG4gICAgdmFyIHByb3h5O1xuICAgIHZhciB0eXBlID0gZGVmaW5pdGlvbi50eXBlO1xuICAgIGlmICh0eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuT25lVG9NYW55KSB7XG4gICAgICBwcm94eSA9IG5ldyBPbmVUb01hbnlQcm94eShkZWZpbml0aW9uKTtcbiAgICB9XG4gICAgZWxzZSBpZiAodHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvT25lKSB7XG4gICAgICBwcm94eSA9IG5ldyBPbmVUb09uZVByb3h5KGRlZmluaXRpb24pO1xuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuTWFueVRvTWFueSkge1xuICAgICAgcHJveHkgPSBuZXcgTWFueVRvTWFueVByb3h5KGRlZmluaXRpb24pO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdObyBzdWNoIHJlbGF0aW9uc2hpcCB0eXBlOiAnICsgdHlwZSk7XG4gICAgfVxuICAgIHByb3h5Lmluc3RhbGwobW9kZWxJbnN0YW5jZSk7XG4gIH0sXG4gIF9pbnN0YWxsUmVsYXRpb25zaGlwUHJveGllczogZnVuY3Rpb24obW9kZWxJbnN0YW5jZSkge1xuICAgIHZhciBtb2RlbCA9IHRoaXMubW9kZWw7XG4gICAgZm9yICh2YXIgbmFtZSBpbiBtb2RlbC5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICBpZiAobW9kZWwucmVsYXRpb25zaGlwcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICB2YXIgZGVmaW5pdGlvbiA9IHV0aWwuZXh0ZW5kKHt9LCBtb2RlbC5yZWxhdGlvbnNoaXBzW25hbWVdKTtcbiAgICAgICAgdGhpcy5faW5zdGFsbFJlbGF0aW9uc2hpcChkZWZpbml0aW9uLCBtb2RlbEluc3RhbmNlKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIF9yZWdpc3Rlckluc3RhbmNlOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlLCBzaG91bGRSZWdpc3RlckNoYW5nZSkge1xuICAgIGNhY2hlLmluc2VydChtb2RlbEluc3RhbmNlKTtcbiAgICBzaG91bGRSZWdpc3RlckNoYW5nZSA9IHNob3VsZFJlZ2lzdGVyQ2hhbmdlID09PSB1bmRlZmluZWQgPyB0cnVlIDogc2hvdWxkUmVnaXN0ZXJDaGFuZ2U7XG4gICAgaWYgKHNob3VsZFJlZ2lzdGVyQ2hhbmdlKSBtb2RlbEluc3RhbmNlLl9lbWl0TmV3KCk7XG4gIH0sXG4gIF9pbnN0YWxsTG9jYWxJZDogZnVuY3Rpb24obW9kZWxJbnN0YW5jZSwgZGF0YSkge1xuICAgIG1vZGVsSW5zdGFuY2UubG9jYWxJZCA9IHRoaXMuX2dldExvY2FsSWQoZGF0YSk7XG4gIH0sXG4gIC8qKlxuICAgKiBDb252ZXJ0IHJhdyBkYXRhIGludG8gYSBNb2RlbEluc3RhbmNlXG4gICAqIEByZXR1cm5zIHtNb2RlbEluc3RhbmNlfVxuICAgKi9cbiAgX2luc3RhbmNlOiBmdW5jdGlvbihkYXRhLCBzaG91bGRSZWdpc3RlckNoYW5nZSkge1xuICAgIGlmICghdGhpcy5tb2RlbC5fcmVsYXRpb25zaGlwc0luc3RhbGxlZCB8fCAhdGhpcy5tb2RlbC5fcmV2ZXJzZVJlbGF0aW9uc2hpcHNJbnN0YWxsZWQpIHtcbiAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNb2RlbCBtdXN0IGJlIGZ1bGx5IGluc3RhbGxlZCBiZWZvcmUgY3JlYXRpbmcgYW55IG1vZGVscycpO1xuICAgIH1cbiAgICB2YXIgbW9kZWxJbnN0YW5jZSA9IG5ldyBNb2RlbEluc3RhbmNlKHRoaXMubW9kZWwpO1xuICAgIHRoaXMuX2luc3RhbGxMb2NhbElkKG1vZGVsSW5zdGFuY2UsIGRhdGEpO1xuICAgIHRoaXMuX2luc3RhbGxBdHRyaWJ1dGVzKG1vZGVsSW5zdGFuY2UsIGRhdGEpO1xuICAgIHRoaXMuX2luc3RhbGxNZXRob2RzKG1vZGVsSW5zdGFuY2UpO1xuICAgIHRoaXMuX2luc3RhbGxQcm9wZXJ0aWVzKG1vZGVsSW5zdGFuY2UpO1xuICAgIHRoaXMuX2luc3RhbGxSZW1vdGVJZChtb2RlbEluc3RhbmNlKTtcbiAgICB0aGlzLl9pbnN0YWxsUmVsYXRpb25zaGlwUHJveGllcyhtb2RlbEluc3RhbmNlKTtcbiAgICB0aGlzLl9yZWdpc3Rlckluc3RhbmNlKG1vZGVsSW5zdGFuY2UsIHNob3VsZFJlZ2lzdGVyQ2hhbmdlKTtcbiAgICByZXR1cm4gbW9kZWxJbnN0YW5jZTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBNb2RlbEluc3RhbmNlRmFjdG9yeTtcblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9pbnN0YW5jZUZhY3RvcnkuanNcbiAqKiBtb2R1bGUgaWQgPSAyNVxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIGFyZ3NhcnJheSA9IHJlcXVpcmUoJ2FyZ3NhcnJheScpO1xuXG4vKipcbiAqIENsYXNzIGZvciBmYWNpbGl0YXRpbmcgXCJjaGFpbmVkXCIgYmVoYXZpb3VyIGUuZzpcbiAqXG4gKiB2YXIgY2FuY2VsID0gVXNlcnNcbiAqICAub24oJ25ldycsIGZ1bmN0aW9uICh1c2VyKSB7XG4gICAqICAgICAvLyAuLi5cbiAgICogICB9KVxuICogIC5xdWVyeSh7JG9yOiB7YWdlX19ndGU6IDIwLCBhZ2VfX2x0ZTogMzB9fSlcbiAqICAub24oJyonLCBmdW5jdGlvbiAoY2hhbmdlKSB7XG4gICAqICAgICAvLyAuLlxuICAgKiAgIH0pO1xuICpcbiAqIEBwYXJhbSBvcHRzXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gQ2hhaW4ob3B0cykge1xuICB0aGlzLm9wdHMgPSBvcHRzO1xufVxuXG5DaGFpbi5wcm90b3R5cGUgPSB7XG4gIC8qKlxuICAgKiBDb25zdHJ1Y3QgYSBsaW5rIGluIHRoZSBjaGFpbiBvZiBjYWxscy5cbiAgICogQHBhcmFtIG9wdHNcbiAgICogQHBhcmFtIG9wdHMuZm5cbiAgICogQHBhcmFtIG9wdHMudHlwZVxuICAgKi9cbiAgX2hhbmRsZXJMaW5rOiBmdW5jdGlvbihvcHRzKSB7XG4gICAgdmFyIGZpcnN0TGluaztcbiAgICBmaXJzdExpbmsgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciB0eXAgPSBvcHRzLnR5cGU7XG4gICAgICBpZiAob3B0cy5mbilcbiAgICAgICAgdGhpcy5fcmVtb3ZlTGlzdGVuZXIob3B0cy5mbiwgdHlwKTtcbiAgICAgIGlmIChmaXJzdExpbmsuX3BhcmVudExpbmspIGZpcnN0TGluay5fcGFyZW50TGluaygpOyAvLyBDYW5jZWwgbGlzdGVuZXJzIGFsbCB0aGUgd2F5IHVwIHRoZSBjaGFpbi5cbiAgICB9LmJpbmQodGhpcyk7XG4gICAgT2JqZWN0LmtleXModGhpcy5vcHRzKS5mb3JFYWNoKGZ1bmN0aW9uKHByb3ApIHtcbiAgICAgIHZhciBmdW5jID0gdGhpcy5vcHRzW3Byb3BdO1xuICAgICAgZmlyc3RMaW5rW3Byb3BdID0gYXJnc2FycmF5KGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICAgICAgdmFyIGxpbmsgPSBmdW5jLmFwcGx5KGZ1bmMuX19zaWVzdGFfYm91bmRfb2JqZWN0LCBhcmdzKTtcbiAgICAgICAgbGluay5fcGFyZW50TGluayA9IGZpcnN0TGluaztcbiAgICAgICAgcmV0dXJuIGxpbms7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gICAgZmlyc3RMaW5rLl9wYXJlbnRMaW5rID0gbnVsbDtcbiAgICByZXR1cm4gZmlyc3RMaW5rO1xuICB9LFxuICAvKipcbiAgICogQ29uc3RydWN0IGEgbGluayBpbiB0aGUgY2hhaW4gb2YgY2FsbHMuXG4gICAqIEBwYXJhbSBvcHRzXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjbGVhbl1cbiAgICovXG4gIF9saW5rOiBmdW5jdGlvbihvcHRzLCBjbGVhbikge1xuICAgIHZhciBjaGFpbiA9IHRoaXM7XG4gICAgY2xlYW4gPSBjbGVhbiB8fCBmdW5jdGlvbigpIHt9O1xuICAgIHZhciBsaW5rO1xuICAgIGxpbmsgPSBmdW5jdGlvbigpIHtcbiAgICAgIGNsZWFuKCk7XG4gICAgICBpZiAobGluay5fcGFyZW50TGluaykgbGluay5fcGFyZW50TGluaygpOyAvLyBDYW5jZWwgbGlzdGVuZXJzIGFsbCB0aGUgd2F5IHVwIHRoZSBjaGFpbi5cbiAgICB9LmJpbmQodGhpcyk7XG4gICAgbGluay5fX3NpZXN0YV9pc0xpbmsgPSB0cnVlO1xuICAgIGxpbmsub3B0cyA9IG9wdHM7XG4gICAgbGluay5jbGVhbiA9IGNsZWFuO1xuICAgIE9iamVjdC5rZXlzKG9wdHMpLmZvckVhY2goZnVuY3Rpb24ocHJvcCkge1xuICAgICAgdmFyIGZ1bmMgPSBvcHRzW3Byb3BdO1xuICAgICAgbGlua1twcm9wXSA9IGFyZ3NhcnJheShmdW5jdGlvbihhcmdzKSB7XG4gICAgICAgIHZhciBwb3NzaWJsZUxpbmsgPSBmdW5jLmFwcGx5KGZ1bmMuX19zaWVzdGFfYm91bmRfb2JqZWN0LCBhcmdzKTtcbiAgICAgICAgaWYgKCFwb3NzaWJsZUxpbmsgfHwgIXBvc3NpYmxlTGluay5fX3NpZXN0YV9pc0xpbmspIHsgLy8gUGF0Y2ggaW4gYSBsaW5rIGluIHRoZSBjaGFpbiB0byBhdm9pZCBpdCBiZWluZyBicm9rZW4sIGJhc2luZyBvZmYgdGhlIGN1cnJlbnQgbGlua1xuICAgICAgICAgIG5leHRMaW5rID0gY2hhaW4uX2xpbmsobGluay5vcHRzKTtcbiAgICAgICAgICBmb3IgKHZhciBwcm9wIGluIHBvc3NpYmxlTGluaykge1xuICAgICAgICAgICAgLy9ub2luc3BlY3Rpb24gSlNVbmZpbHRlcmVkRm9ySW5Mb29wXG4gICAgICAgICAgICBpZiAocG9zc2libGVMaW5rW3Byb3BdIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgICAgICAgICAgLy9ub2luc3BlY3Rpb24gSlNVbmZpbHRlcmVkRm9ySW5Mb29wXG4gICAgICAgICAgICAgIG5leHRMaW5rW3Byb3BdID0gcG9zc2libGVMaW5rW3Byb3BdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICB2YXIgbmV4dExpbmsgPSBwb3NzaWJsZUxpbms7XG4gICAgICAgIH1cbiAgICAgICAgbmV4dExpbmsuX3BhcmVudExpbmsgPSBsaW5rO1xuICAgICAgICAvLyBJbmhlcml0IG1ldGhvZHMgZnJvbSB0aGUgcGFyZW50IGxpbmsgaWYgdGhvc2UgbWV0aG9kcyBkb24ndCBhbHJlYWR5IGV4aXN0LlxuICAgICAgICBmb3IgKHByb3AgaW4gbGluaykge1xuICAgICAgICAgIGlmIChsaW5rW3Byb3BdIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgICAgICAgIG5leHRMaW5rW3Byb3BdID0gbGlua1twcm9wXS5iaW5kKGxpbmspO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV4dExpbms7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gICAgbGluay5fcGFyZW50TGluayA9IG51bGw7XG4gICAgcmV0dXJuIGxpbms7XG4gIH1cbn07XG5tb2R1bGUuZXhwb3J0cyA9IENoYWluO1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL0NoYWluLmpzXG4gKiogbW9kdWxlIGlkID0gMjZcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIlxuLyoqXG4gKiBUaGlzIGlzIHRoZSB3ZWIgYnJvd3NlciBpbXBsZW1lbnRhdGlvbiBvZiBgZGVidWcoKWAuXG4gKlxuICogRXhwb3NlIGBkZWJ1ZygpYCBhcyB0aGUgbW9kdWxlLlxuICovXG5cbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vZGVidWcnKTtcbmV4cG9ydHMubG9nID0gbG9nO1xuZXhwb3J0cy5mb3JtYXRBcmdzID0gZm9ybWF0QXJncztcbmV4cG9ydHMuc2F2ZSA9IHNhdmU7XG5leHBvcnRzLmxvYWQgPSBsb2FkO1xuZXhwb3J0cy51c2VDb2xvcnMgPSB1c2VDb2xvcnM7XG5cbi8qKlxuICogVXNlIGNocm9tZS5zdG9yYWdlLmxvY2FsIGlmIHdlIGFyZSBpbiBhbiBhcHBcbiAqL1xuXG52YXIgc3RvcmFnZTtcblxuaWYgKHR5cGVvZiBjaHJvbWUgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBjaHJvbWUuc3RvcmFnZSAhPT0gJ3VuZGVmaW5lZCcpXG4gIHN0b3JhZ2UgPSBjaHJvbWUuc3RvcmFnZS5sb2NhbDtcbmVsc2VcbiAgc3RvcmFnZSA9IHdpbmRvdy5sb2NhbFN0b3JhZ2U7XG5cbi8qKlxuICogQ29sb3JzLlxuICovXG5cbmV4cG9ydHMuY29sb3JzID0gW1xuICAnbGlnaHRzZWFncmVlbicsXG4gICdmb3Jlc3RncmVlbicsXG4gICdnb2xkZW5yb2QnLFxuICAnZG9kZ2VyYmx1ZScsXG4gICdkYXJrb3JjaGlkJyxcbiAgJ2NyaW1zb24nXG5dO1xuXG4vKipcbiAqIEN1cnJlbnRseSBvbmx5IFdlYktpdC1iYXNlZCBXZWIgSW5zcGVjdG9ycywgRmlyZWZveCA+PSB2MzEsXG4gKiBhbmQgdGhlIEZpcmVidWcgZXh0ZW5zaW9uIChhbnkgRmlyZWZveCB2ZXJzaW9uKSBhcmUga25vd25cbiAqIHRvIHN1cHBvcnQgXCIlY1wiIENTUyBjdXN0b21pemF0aW9ucy5cbiAqXG4gKiBUT0RPOiBhZGQgYSBgbG9jYWxTdG9yYWdlYCB2YXJpYWJsZSB0byBleHBsaWNpdGx5IGVuYWJsZS9kaXNhYmxlIGNvbG9yc1xuICovXG5cbmZ1bmN0aW9uIHVzZUNvbG9ycygpIHtcbiAgLy8gaXMgd2Via2l0PyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8xNjQ1OTYwNi8zNzY3NzNcbiAgcmV0dXJuICgnV2Via2l0QXBwZWFyYW5jZScgaW4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlKSB8fFxuICAgIC8vIGlzIGZpcmVidWc/IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzM5ODEyMC8zNzY3NzNcbiAgICAod2luZG93LmNvbnNvbGUgJiYgKGNvbnNvbGUuZmlyZWJ1ZyB8fCAoY29uc29sZS5leGNlcHRpb24gJiYgY29uc29sZS50YWJsZSkpKSB8fFxuICAgIC8vIGlzIGZpcmVmb3ggPj0gdjMxP1xuICAgIC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvVG9vbHMvV2ViX0NvbnNvbGUjU3R5bGluZ19tZXNzYWdlc1xuICAgIChuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkubWF0Y2goL2ZpcmVmb3hcXC8oXFxkKykvKSAmJiBwYXJzZUludChSZWdFeHAuJDEsIDEwKSA+PSAzMSk7XG59XG5cbi8qKlxuICogTWFwICVqIHRvIGBKU09OLnN0cmluZ2lmeSgpYCwgc2luY2Ugbm8gV2ViIEluc3BlY3RvcnMgZG8gdGhhdCBieSBkZWZhdWx0LlxuICovXG5cbmV4cG9ydHMuZm9ybWF0dGVycy5qID0gZnVuY3Rpb24odikge1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodik7XG59O1xuXG5cbi8qKlxuICogQ29sb3JpemUgbG9nIGFyZ3VtZW50cyBpZiBlbmFibGVkLlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZm9ybWF0QXJncygpIHtcbiAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gIHZhciB1c2VDb2xvcnMgPSB0aGlzLnVzZUNvbG9ycztcblxuICBhcmdzWzBdID0gKHVzZUNvbG9ycyA/ICclYycgOiAnJylcbiAgICArIHRoaXMubmFtZXNwYWNlXG4gICAgKyAodXNlQ29sb3JzID8gJyAlYycgOiAnICcpXG4gICAgKyBhcmdzWzBdXG4gICAgKyAodXNlQ29sb3JzID8gJyVjICcgOiAnICcpXG4gICAgKyAnKycgKyBleHBvcnRzLmh1bWFuaXplKHRoaXMuZGlmZik7XG5cbiAgaWYgKCF1c2VDb2xvcnMpIHJldHVybiBhcmdzO1xuXG4gIHZhciBjID0gJ2NvbG9yOiAnICsgdGhpcy5jb2xvcjtcbiAgYXJncyA9IFthcmdzWzBdLCBjLCAnY29sb3I6IGluaGVyaXQnXS5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJncywgMSkpO1xuXG4gIC8vIHRoZSBmaW5hbCBcIiVjXCIgaXMgc29tZXdoYXQgdHJpY2t5LCBiZWNhdXNlIHRoZXJlIGNvdWxkIGJlIG90aGVyXG4gIC8vIGFyZ3VtZW50cyBwYXNzZWQgZWl0aGVyIGJlZm9yZSBvciBhZnRlciB0aGUgJWMsIHNvIHdlIG5lZWQgdG9cbiAgLy8gZmlndXJlIG91dCB0aGUgY29ycmVjdCBpbmRleCB0byBpbnNlcnQgdGhlIENTUyBpbnRvXG4gIHZhciBpbmRleCA9IDA7XG4gIHZhciBsYXN0QyA9IDA7XG4gIGFyZ3NbMF0ucmVwbGFjZSgvJVthLXolXS9nLCBmdW5jdGlvbihtYXRjaCkge1xuICAgIGlmICgnJSUnID09PSBtYXRjaCkgcmV0dXJuO1xuICAgIGluZGV4Kys7XG4gICAgaWYgKCclYycgPT09IG1hdGNoKSB7XG4gICAgICAvLyB3ZSBvbmx5IGFyZSBpbnRlcmVzdGVkIGluIHRoZSAqbGFzdCogJWNcbiAgICAgIC8vICh0aGUgdXNlciBtYXkgaGF2ZSBwcm92aWRlZCB0aGVpciBvd24pXG4gICAgICBsYXN0QyA9IGluZGV4O1xuICAgIH1cbiAgfSk7XG5cbiAgYXJncy5zcGxpY2UobGFzdEMsIDAsIGMpO1xuICByZXR1cm4gYXJncztcbn1cblxuLyoqXG4gKiBJbnZva2VzIGBjb25zb2xlLmxvZygpYCB3aGVuIGF2YWlsYWJsZS5cbiAqIE5vLW9wIHdoZW4gYGNvbnNvbGUubG9nYCBpcyBub3QgYSBcImZ1bmN0aW9uXCIuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBsb2coKSB7XG4gIC8vIHRoaXMgaGFja2VyeSBpcyByZXF1aXJlZCBmb3IgSUU4LzksIHdoZXJlXG4gIC8vIHRoZSBgY29uc29sZS5sb2dgIGZ1bmN0aW9uIGRvZXNuJ3QgaGF2ZSAnYXBwbHknXG4gIHJldHVybiAnb2JqZWN0JyA9PT0gdHlwZW9mIGNvbnNvbGVcbiAgICAmJiBjb25zb2xlLmxvZ1xuICAgICYmIEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseS5jYWxsKGNvbnNvbGUubG9nLCBjb25zb2xlLCBhcmd1bWVudHMpO1xufVxuXG4vKipcbiAqIFNhdmUgYG5hbWVzcGFjZXNgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VzXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzYXZlKG5hbWVzcGFjZXMpIHtcbiAgdHJ5IHtcbiAgICBpZiAobnVsbCA9PSBuYW1lc3BhY2VzKSB7XG4gICAgICBzdG9yYWdlLnJlbW92ZUl0ZW0oJ2RlYnVnJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0b3JhZ2UuZGVidWcgPSBuYW1lc3BhY2VzO1xuICAgIH1cbiAgfSBjYXRjaChlKSB7fVxufVxuXG4vKipcbiAqIExvYWQgYG5hbWVzcGFjZXNgLlxuICpcbiAqIEByZXR1cm4ge1N0cmluZ30gcmV0dXJucyB0aGUgcHJldmlvdXNseSBwZXJzaXN0ZWQgZGVidWcgbW9kZXNcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGxvYWQoKSB7XG4gIHZhciByO1xuICB0cnkge1xuICAgIHIgPSBzdG9yYWdlLmRlYnVnO1xuICB9IGNhdGNoKGUpIHt9XG4gIHJldHVybiByO1xufVxuXG4vKipcbiAqIEVuYWJsZSBuYW1lc3BhY2VzIGxpc3RlZCBpbiBgbG9jYWxTdG9yYWdlLmRlYnVnYCBpbml0aWFsbHkuXG4gKi9cblxuZXhwb3J0cy5lbmFibGUobG9hZCgpKTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9+L2RlYnVnL2Jyb3dzZXIuanNcbiAqKiBtb2R1bGUgaWQgPSAyN1xuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGFyZ3NBcnJheTtcblxuZnVuY3Rpb24gYXJnc0FycmF5KGZ1bikge1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHZhciBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGlmIChsZW4pIHtcbiAgICAgIHZhciBhcmdzID0gW107XG4gICAgICB2YXIgaSA9IC0xO1xuICAgICAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgICAgICBhcmdzW2ldID0gYXJndW1lbnRzW2ldO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZ1bi5jYWxsKHRoaXMsIGFyZ3MpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZnVuLmNhbGwodGhpcywgW10pO1xuICAgIH1cbiAgfTtcbn1cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vfi9hcmdzYXJyYXkvaW5kZXguanNcbiAqKiBtb2R1bGUgaWQgPSAyOFxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIG5leHRUaWNrID0gcmVxdWlyZSgncHJvY2Vzcy9icm93c2VyLmpzJykubmV4dFRpY2s7XG52YXIgYXBwbHkgPSBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHk7XG52YXIgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG52YXIgaW1tZWRpYXRlSWRzID0ge307XG52YXIgbmV4dEltbWVkaWF0ZUlkID0gMDtcblxuLy8gRE9NIEFQSXMsIGZvciBjb21wbGV0ZW5lc3NcblxuZXhwb3J0cy5zZXRUaW1lb3V0ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBuZXcgVGltZW91dChhcHBseS5jYWxsKHNldFRpbWVvdXQsIHdpbmRvdywgYXJndW1lbnRzKSwgY2xlYXJUaW1lb3V0KTtcbn07XG5leHBvcnRzLnNldEludGVydmFsID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBuZXcgVGltZW91dChhcHBseS5jYWxsKHNldEludGVydmFsLCB3aW5kb3csIGFyZ3VtZW50cyksIGNsZWFySW50ZXJ2YWwpO1xufTtcbmV4cG9ydHMuY2xlYXJUaW1lb3V0ID1cbmV4cG9ydHMuY2xlYXJJbnRlcnZhbCA9IGZ1bmN0aW9uKHRpbWVvdXQpIHsgdGltZW91dC5jbG9zZSgpOyB9O1xuXG5mdW5jdGlvbiBUaW1lb3V0KGlkLCBjbGVhckZuKSB7XG4gIHRoaXMuX2lkID0gaWQ7XG4gIHRoaXMuX2NsZWFyRm4gPSBjbGVhckZuO1xufVxuVGltZW91dC5wcm90b3R5cGUudW5yZWYgPSBUaW1lb3V0LnByb3RvdHlwZS5yZWYgPSBmdW5jdGlvbigpIHt9O1xuVGltZW91dC5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5fY2xlYXJGbi5jYWxsKHdpbmRvdywgdGhpcy5faWQpO1xufTtcblxuLy8gRG9lcyBub3Qgc3RhcnQgdGhlIHRpbWUsIGp1c3Qgc2V0cyB1cCB0aGUgbWVtYmVycyBuZWVkZWQuXG5leHBvcnRzLmVucm9sbCA9IGZ1bmN0aW9uKGl0ZW0sIG1zZWNzKSB7XG4gIGNsZWFyVGltZW91dChpdGVtLl9pZGxlVGltZW91dElkKTtcbiAgaXRlbS5faWRsZVRpbWVvdXQgPSBtc2Vjcztcbn07XG5cbmV4cG9ydHMudW5lbnJvbGwgPSBmdW5jdGlvbihpdGVtKSB7XG4gIGNsZWFyVGltZW91dChpdGVtLl9pZGxlVGltZW91dElkKTtcbiAgaXRlbS5faWRsZVRpbWVvdXQgPSAtMTtcbn07XG5cbmV4cG9ydHMuX3VucmVmQWN0aXZlID0gZXhwb3J0cy5hY3RpdmUgPSBmdW5jdGlvbihpdGVtKSB7XG4gIGNsZWFyVGltZW91dChpdGVtLl9pZGxlVGltZW91dElkKTtcblxuICB2YXIgbXNlY3MgPSBpdGVtLl9pZGxlVGltZW91dDtcbiAgaWYgKG1zZWNzID49IDApIHtcbiAgICBpdGVtLl9pZGxlVGltZW91dElkID0gc2V0VGltZW91dChmdW5jdGlvbiBvblRpbWVvdXQoKSB7XG4gICAgICBpZiAoaXRlbS5fb25UaW1lb3V0KVxuICAgICAgICBpdGVtLl9vblRpbWVvdXQoKTtcbiAgICB9LCBtc2Vjcyk7XG4gIH1cbn07XG5cbi8vIFRoYXQncyBub3QgaG93IG5vZGUuanMgaW1wbGVtZW50cyBpdCBidXQgdGhlIGV4cG9zZWQgYXBpIGlzIHRoZSBzYW1lLlxuZXhwb3J0cy5zZXRJbW1lZGlhdGUgPSB0eXBlb2Ygc2V0SW1tZWRpYXRlID09PSBcImZ1bmN0aW9uXCIgPyBzZXRJbW1lZGlhdGUgOiBmdW5jdGlvbihmbikge1xuICB2YXIgaWQgPSBuZXh0SW1tZWRpYXRlSWQrKztcbiAgdmFyIGFyZ3MgPSBhcmd1bWVudHMubGVuZ3RoIDwgMiA/IGZhbHNlIDogc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuXG4gIGltbWVkaWF0ZUlkc1tpZF0gPSB0cnVlO1xuXG4gIG5leHRUaWNrKGZ1bmN0aW9uIG9uTmV4dFRpY2soKSB7XG4gICAgaWYgKGltbWVkaWF0ZUlkc1tpZF0pIHtcbiAgICAgIC8vIGZuLmNhbGwoKSBpcyBmYXN0ZXIgc28gd2Ugb3B0aW1pemUgZm9yIHRoZSBjb21tb24gdXNlLWNhc2VcbiAgICAgIC8vIEBzZWUgaHR0cDovL2pzcGVyZi5jb20vY2FsbC1hcHBseS1zZWd1XG4gICAgICBpZiAoYXJncykge1xuICAgICAgICBmbi5hcHBseShudWxsLCBhcmdzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZuLmNhbGwobnVsbCk7XG4gICAgICB9XG4gICAgICAvLyBQcmV2ZW50IGlkcyBmcm9tIGxlYWtpbmdcbiAgICAgIGV4cG9ydHMuY2xlYXJJbW1lZGlhdGUoaWQpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGlkO1xufTtcblxuZXhwb3J0cy5jbGVhckltbWVkaWF0ZSA9IHR5cGVvZiBjbGVhckltbWVkaWF0ZSA9PT0gXCJmdW5jdGlvblwiID8gY2xlYXJJbW1lZGlhdGUgOiBmdW5jdGlvbihpZCkge1xuICBkZWxldGUgaW1tZWRpYXRlSWRzW2lkXTtcbn07XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAod2VicGFjaykvfi9ub2RlLWxpYnMtYnJvd3Nlci9+L3RpbWVycy1icm93c2VyaWZ5L21haW4uanNcbiAqKiBtb2R1bGUgaWQgPSAyOVxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIHZhciBtO1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghZW1pdHRlci5fZXZlbnRzIHx8ICFlbWl0dGVyLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gMDtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbihlbWl0dGVyLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IDE7XG4gIGVsc2VcbiAgICByZXQgPSBlbWl0dGVyLl9ldmVudHNbdHlwZV0ubGVuZ3RoO1xuICByZXR1cm4gcmV0O1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAod2VicGFjaykvfi9ub2RlLWxpYnMtYnJvd3Nlci9+L2V2ZW50cy9ldmVudHMuanNcbiAqKiBtb2R1bGUgaWQgPSAzMFxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiIWZ1bmN0aW9uKGUpe2lmKFwib2JqZWN0XCI9PXR5cGVvZiBleHBvcnRzJiZcInVuZGVmaW5lZFwiIT10eXBlb2YgbW9kdWxlKW1vZHVsZS5leHBvcnRzPWUoKTtlbHNlIGlmKFwiZnVuY3Rpb25cIj09dHlwZW9mIGRlZmluZSYmZGVmaW5lLmFtZClkZWZpbmUoW10sZSk7ZWxzZXt2YXIgZjtcInVuZGVmaW5lZFwiIT10eXBlb2Ygd2luZG93P2Y9d2luZG93OlwidW5kZWZpbmVkXCIhPXR5cGVvZiBnbG9iYWw/Zj1nbG9iYWw6XCJ1bmRlZmluZWRcIiE9dHlwZW9mIHNlbGYmJihmPXNlbGYpLGYuUHJvbWlzZT1lKCl9fShmdW5jdGlvbigpe3ZhciBkZWZpbmUsbW9kdWxlLGV4cG9ydHM7cmV0dXJuIChmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pKHsxOltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBJTlRFUk5BTDtcblxuZnVuY3Rpb24gSU5URVJOQUwoKSB7fVxufSx7fV0sMjpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4ndXNlIHN0cmljdCc7XG52YXIgUHJvbWlzZSA9IF9kZXJlcV8oJy4vcHJvbWlzZScpO1xudmFyIHJlamVjdCA9IF9kZXJlcV8oJy4vcmVqZWN0Jyk7XG52YXIgcmVzb2x2ZSA9IF9kZXJlcV8oJy4vcmVzb2x2ZScpO1xudmFyIElOVEVSTkFMID0gX2RlcmVxXygnLi9JTlRFUk5BTCcpO1xudmFyIGhhbmRsZXJzID0gX2RlcmVxXygnLi9oYW5kbGVycycpO1xubW9kdWxlLmV4cG9ydHMgPSBhbGw7XG5mdW5jdGlvbiBhbGwoaXRlcmFibGUpIHtcbiAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChpdGVyYWJsZSkgIT09ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICByZXR1cm4gcmVqZWN0KG5ldyBUeXBlRXJyb3IoJ211c3QgYmUgYW4gYXJyYXknKSk7XG4gIH1cblxuICB2YXIgbGVuID0gaXRlcmFibGUubGVuZ3RoO1xuICB2YXIgY2FsbGVkID0gZmFsc2U7XG4gIGlmICghbGVuKSB7XG4gICAgcmV0dXJuIHJlc29sdmUoW10pO1xuICB9XG5cbiAgdmFyIHZhbHVlcyA9IG5ldyBBcnJheShsZW4pO1xuICB2YXIgcmVzb2x2ZWQgPSAwO1xuICB2YXIgaSA9IC0xO1xuICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKElOVEVSTkFMKTtcbiAgXG4gIHdoaWxlICgrK2kgPCBsZW4pIHtcbiAgICBhbGxSZXNvbHZlcihpdGVyYWJsZVtpXSwgaSk7XG4gIH1cbiAgcmV0dXJuIHByb21pc2U7XG4gIGZ1bmN0aW9uIGFsbFJlc29sdmVyKHZhbHVlLCBpKSB7XG4gICAgcmVzb2x2ZSh2YWx1ZSkudGhlbihyZXNvbHZlRnJvbUFsbCwgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICBpZiAoIWNhbGxlZCkge1xuICAgICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgICBoYW5kbGVycy5yZWplY3QocHJvbWlzZSwgZXJyb3IpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGZ1bmN0aW9uIHJlc29sdmVGcm9tQWxsKG91dFZhbHVlKSB7XG4gICAgICB2YWx1ZXNbaV0gPSBvdXRWYWx1ZTtcbiAgICAgIGlmICgrK3Jlc29sdmVkID09PSBsZW4gJiAhY2FsbGVkKSB7XG4gICAgICAgIGNhbGxlZCA9IHRydWU7XG4gICAgICAgIGhhbmRsZXJzLnJlc29sdmUocHJvbWlzZSwgdmFsdWVzKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbn0se1wiLi9JTlRFUk5BTFwiOjEsXCIuL2hhbmRsZXJzXCI6MyxcIi4vcHJvbWlzZVwiOjUsXCIuL3JlamVjdFwiOjgsXCIuL3Jlc29sdmVcIjo5fV0sMzpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4ndXNlIHN0cmljdCc7XG52YXIgdHJ5Q2F0Y2ggPSBfZGVyZXFfKCcuL3RyeUNhdGNoJyk7XG52YXIgcmVzb2x2ZVRoZW5hYmxlID0gX2RlcmVxXygnLi9yZXNvbHZlVGhlbmFibGUnKTtcbnZhciBzdGF0ZXMgPSBfZGVyZXFfKCcuL3N0YXRlcycpO1xuXG5leHBvcnRzLnJlc29sdmUgPSBmdW5jdGlvbiAoc2VsZiwgdmFsdWUpIHtcbiAgdmFyIHJlc3VsdCA9IHRyeUNhdGNoKGdldFRoZW4sIHZhbHVlKTtcbiAgaWYgKHJlc3VsdC5zdGF0dXMgPT09ICdlcnJvcicpIHtcbiAgICByZXR1cm4gZXhwb3J0cy5yZWplY3Qoc2VsZiwgcmVzdWx0LnZhbHVlKTtcbiAgfVxuICB2YXIgdGhlbmFibGUgPSByZXN1bHQudmFsdWU7XG5cbiAgaWYgKHRoZW5hYmxlKSB7XG4gICAgcmVzb2x2ZVRoZW5hYmxlLnNhZmVseShzZWxmLCB0aGVuYWJsZSk7XG4gIH0gZWxzZSB7XG4gICAgc2VsZi5zdGF0ZSA9IHN0YXRlcy5GVUxGSUxMRUQ7XG4gICAgc2VsZi5vdXRjb21lID0gdmFsdWU7XG4gICAgdmFyIGkgPSAtMTtcbiAgICB2YXIgbGVuID0gc2VsZi5xdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgICAgc2VsZi5xdWV1ZVtpXS5jYWxsRnVsZmlsbGVkKHZhbHVlKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHNlbGY7XG59O1xuZXhwb3J0cy5yZWplY3QgPSBmdW5jdGlvbiAoc2VsZiwgZXJyb3IpIHtcbiAgc2VsZi5zdGF0ZSA9IHN0YXRlcy5SRUpFQ1RFRDtcbiAgc2VsZi5vdXRjb21lID0gZXJyb3I7XG4gIHZhciBpID0gLTE7XG4gIHZhciBsZW4gPSBzZWxmLnF1ZXVlLmxlbmd0aDtcbiAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgIHNlbGYucXVldWVbaV0uY2FsbFJlamVjdGVkKGVycm9yKTtcbiAgfVxuICByZXR1cm4gc2VsZjtcbn07XG5cbmZ1bmN0aW9uIGdldFRoZW4ob2JqKSB7XG4gIC8vIE1ha2Ugc3VyZSB3ZSBvbmx5IGFjY2VzcyB0aGUgYWNjZXNzb3Igb25jZSBhcyByZXF1aXJlZCBieSB0aGUgc3BlY1xuICB2YXIgdGhlbiA9IG9iaiAmJiBvYmoudGhlbjtcbiAgaWYgKG9iaiAmJiB0eXBlb2Ygb2JqID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgdGhlbiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiBmdW5jdGlvbiBhcHB5VGhlbigpIHtcbiAgICAgIHRoZW4uYXBwbHkob2JqLCBhcmd1bWVudHMpO1xuICAgIH07XG4gIH1cbn1cbn0se1wiLi9yZXNvbHZlVGhlbmFibGVcIjoxMCxcIi4vc3RhdGVzXCI6MTEsXCIuL3RyeUNhdGNoXCI6MTJ9XSw0OltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbm1vZHVsZS5leHBvcnRzID0gZXhwb3J0cyA9IF9kZXJlcV8oJy4vcHJvbWlzZScpO1xuXG5leHBvcnRzLnJlc29sdmUgPSBfZGVyZXFfKCcuL3Jlc29sdmUnKTtcbmV4cG9ydHMucmVqZWN0ID0gX2RlcmVxXygnLi9yZWplY3QnKTtcbmV4cG9ydHMuYWxsID0gX2RlcmVxXygnLi9hbGwnKTtcbmV4cG9ydHMucmFjZSA9IF9kZXJlcV8oJy4vcmFjZScpO1xufSx7XCIuL2FsbFwiOjIsXCIuL3Byb21pc2VcIjo1LFwiLi9yYWNlXCI6NyxcIi4vcmVqZWN0XCI6OCxcIi4vcmVzb2x2ZVwiOjl9XSw1OltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIHVud3JhcCA9IF9kZXJlcV8oJy4vdW53cmFwJyk7XG52YXIgSU5URVJOQUwgPSBfZGVyZXFfKCcuL0lOVEVSTkFMJyk7XG52YXIgcmVzb2x2ZVRoZW5hYmxlID0gX2RlcmVxXygnLi9yZXNvbHZlVGhlbmFibGUnKTtcbnZhciBzdGF0ZXMgPSBfZGVyZXFfKCcuL3N0YXRlcycpO1xudmFyIFF1ZXVlSXRlbSA9IF9kZXJlcV8oJy4vcXVldWVJdGVtJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gUHJvbWlzZTtcbmZ1bmN0aW9uIFByb21pc2UocmVzb2x2ZXIpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFByb21pc2UpKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmVyKTtcbiAgfVxuICBpZiAodHlwZW9mIHJlc29sdmVyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcigncmVzb2x2ZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG4gIH1cbiAgdGhpcy5zdGF0ZSA9IHN0YXRlcy5QRU5ESU5HO1xuICB0aGlzLnF1ZXVlID0gW107XG4gIHRoaXMub3V0Y29tZSA9IHZvaWQgMDtcbiAgaWYgKHJlc29sdmVyICE9PSBJTlRFUk5BTCkge1xuICAgIHJlc29sdmVUaGVuYWJsZS5zYWZlbHkodGhpcywgcmVzb2x2ZXIpO1xuICB9XG59XG5cblByb21pc2UucHJvdG90eXBlWydjYXRjaCddID0gZnVuY3Rpb24gKG9uUmVqZWN0ZWQpIHtcbiAgcmV0dXJuIHRoaXMudGhlbihudWxsLCBvblJlamVjdGVkKTtcbn07XG5Qcm9taXNlLnByb3RvdHlwZS50aGVuID0gZnVuY3Rpb24gKG9uRnVsZmlsbGVkLCBvblJlamVjdGVkKSB7XG4gIGlmICh0eXBlb2Ygb25GdWxmaWxsZWQgIT09ICdmdW5jdGlvbicgJiYgdGhpcy5zdGF0ZSA9PT0gc3RhdGVzLkZVTEZJTExFRCB8fFxuICAgIHR5cGVvZiBvblJlamVjdGVkICE9PSAnZnVuY3Rpb24nICYmIHRoaXMuc3RhdGUgPT09IHN0YXRlcy5SRUpFQ1RFRCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoSU5URVJOQUwpO1xuXG4gIFxuICBpZiAodGhpcy5zdGF0ZSAhPT0gc3RhdGVzLlBFTkRJTkcpIHtcbiAgICB2YXIgcmVzb2x2ZXIgPSB0aGlzLnN0YXRlID09PSBzdGF0ZXMuRlVMRklMTEVEID8gb25GdWxmaWxsZWQ6IG9uUmVqZWN0ZWQ7XG4gICAgdW53cmFwKHByb21pc2UsIHJlc29sdmVyLCB0aGlzLm91dGNvbWUpO1xuICB9IGVsc2Uge1xuICAgIHRoaXMucXVldWUucHVzaChuZXcgUXVldWVJdGVtKHByb21pc2UsIG9uRnVsZmlsbGVkLCBvblJlamVjdGVkKSk7XG4gIH1cblxuICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbn0se1wiLi9JTlRFUk5BTFwiOjEsXCIuL3F1ZXVlSXRlbVwiOjYsXCIuL3Jlc29sdmVUaGVuYWJsZVwiOjEwLFwiLi9zdGF0ZXNcIjoxMSxcIi4vdW53cmFwXCI6MTN9XSw2OltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbid1c2Ugc3RyaWN0JztcbnZhciBoYW5kbGVycyA9IF9kZXJlcV8oJy4vaGFuZGxlcnMnKTtcbnZhciB1bndyYXAgPSBfZGVyZXFfKCcuL3Vud3JhcCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFF1ZXVlSXRlbTtcbmZ1bmN0aW9uIFF1ZXVlSXRlbShwcm9taXNlLCBvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCkge1xuICB0aGlzLnByb21pc2UgPSBwcm9taXNlO1xuICBpZiAodHlwZW9mIG9uRnVsZmlsbGVkID09PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhpcy5vbkZ1bGZpbGxlZCA9IG9uRnVsZmlsbGVkO1xuICAgIHRoaXMuY2FsbEZ1bGZpbGxlZCA9IHRoaXMub3RoZXJDYWxsRnVsZmlsbGVkO1xuICB9XG4gIGlmICh0eXBlb2Ygb25SZWplY3RlZCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHRoaXMub25SZWplY3RlZCA9IG9uUmVqZWN0ZWQ7XG4gICAgdGhpcy5jYWxsUmVqZWN0ZWQgPSB0aGlzLm90aGVyQ2FsbFJlamVjdGVkO1xuICB9XG59XG5RdWV1ZUl0ZW0ucHJvdG90eXBlLmNhbGxGdWxmaWxsZWQgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgaGFuZGxlcnMucmVzb2x2ZSh0aGlzLnByb21pc2UsIHZhbHVlKTtcbn07XG5RdWV1ZUl0ZW0ucHJvdG90eXBlLm90aGVyQ2FsbEZ1bGZpbGxlZCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICB1bndyYXAodGhpcy5wcm9taXNlLCB0aGlzLm9uRnVsZmlsbGVkLCB2YWx1ZSk7XG59O1xuUXVldWVJdGVtLnByb3RvdHlwZS5jYWxsUmVqZWN0ZWQgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgaGFuZGxlcnMucmVqZWN0KHRoaXMucHJvbWlzZSwgdmFsdWUpO1xufTtcblF1ZXVlSXRlbS5wcm90b3R5cGUub3RoZXJDYWxsUmVqZWN0ZWQgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgdW53cmFwKHRoaXMucHJvbWlzZSwgdGhpcy5vblJlamVjdGVkLCB2YWx1ZSk7XG59O1xufSx7XCIuL2hhbmRsZXJzXCI6MyxcIi4vdW53cmFwXCI6MTN9XSw3OltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbid1c2Ugc3RyaWN0JztcbnZhciBQcm9taXNlID0gX2RlcmVxXygnLi9wcm9taXNlJyk7XG52YXIgcmVqZWN0ID0gX2RlcmVxXygnLi9yZWplY3QnKTtcbnZhciByZXNvbHZlID0gX2RlcmVxXygnLi9yZXNvbHZlJyk7XG52YXIgSU5URVJOQUwgPSBfZGVyZXFfKCcuL0lOVEVSTkFMJyk7XG52YXIgaGFuZGxlcnMgPSBfZGVyZXFfKCcuL2hhbmRsZXJzJyk7XG5tb2R1bGUuZXhwb3J0cyA9IHJhY2U7XG5mdW5jdGlvbiByYWNlKGl0ZXJhYmxlKSB7XG4gIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoaXRlcmFibGUpICE9PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgcmV0dXJuIHJlamVjdChuZXcgVHlwZUVycm9yKCdtdXN0IGJlIGFuIGFycmF5JykpO1xuICB9XG5cbiAgdmFyIGxlbiA9IGl0ZXJhYmxlLmxlbmd0aDtcbiAgdmFyIGNhbGxlZCA9IGZhbHNlO1xuICBpZiAoIWxlbikge1xuICAgIHJldHVybiByZXNvbHZlKFtdKTtcbiAgfVxuXG4gIHZhciByZXNvbHZlZCA9IDA7XG4gIHZhciBpID0gLTE7XG4gIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoSU5URVJOQUwpO1xuICBcbiAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgIHJlc29sdmVyKGl0ZXJhYmxlW2ldKTtcbiAgfVxuICByZXR1cm4gcHJvbWlzZTtcbiAgZnVuY3Rpb24gcmVzb2x2ZXIodmFsdWUpIHtcbiAgICByZXNvbHZlKHZhbHVlKS50aGVuKGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgaWYgKCFjYWxsZWQpIHtcbiAgICAgICAgY2FsbGVkID0gdHJ1ZTtcbiAgICAgICAgaGFuZGxlcnMucmVzb2x2ZShwcm9taXNlLCByZXNwb25zZSk7XG4gICAgICB9XG4gICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICBpZiAoIWNhbGxlZCkge1xuICAgICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgICBoYW5kbGVycy5yZWplY3QocHJvbWlzZSwgZXJyb3IpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG59LHtcIi4vSU5URVJOQUxcIjoxLFwiLi9oYW5kbGVyc1wiOjMsXCIuL3Byb21pc2VcIjo1LFwiLi9yZWplY3RcIjo4LFwiLi9yZXNvbHZlXCI6OX1dLDg6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgUHJvbWlzZSA9IF9kZXJlcV8oJy4vcHJvbWlzZScpO1xudmFyIElOVEVSTkFMID0gX2RlcmVxXygnLi9JTlRFUk5BTCcpO1xudmFyIGhhbmRsZXJzID0gX2RlcmVxXygnLi9oYW5kbGVycycpO1xubW9kdWxlLmV4cG9ydHMgPSByZWplY3Q7XG5cbmZ1bmN0aW9uIHJlamVjdChyZWFzb24pIHtcblx0dmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShJTlRFUk5BTCk7XG5cdHJldHVybiBoYW5kbGVycy5yZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbn1cbn0se1wiLi9JTlRFUk5BTFwiOjEsXCIuL2hhbmRsZXJzXCI6MyxcIi4vcHJvbWlzZVwiOjV9XSw5OltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIFByb21pc2UgPSBfZGVyZXFfKCcuL3Byb21pc2UnKTtcbnZhciBJTlRFUk5BTCA9IF9kZXJlcV8oJy4vSU5URVJOQUwnKTtcbnZhciBoYW5kbGVycyA9IF9kZXJlcV8oJy4vaGFuZGxlcnMnKTtcbm1vZHVsZS5leHBvcnRzID0gcmVzb2x2ZTtcblxudmFyIEZBTFNFID0gaGFuZGxlcnMucmVzb2x2ZShuZXcgUHJvbWlzZShJTlRFUk5BTCksIGZhbHNlKTtcbnZhciBOVUxMID0gaGFuZGxlcnMucmVzb2x2ZShuZXcgUHJvbWlzZShJTlRFUk5BTCksIG51bGwpO1xudmFyIFVOREVGSU5FRCA9IGhhbmRsZXJzLnJlc29sdmUobmV3IFByb21pc2UoSU5URVJOQUwpLCB2b2lkIDApO1xudmFyIFpFUk8gPSBoYW5kbGVycy5yZXNvbHZlKG5ldyBQcm9taXNlKElOVEVSTkFMKSwgMCk7XG52YXIgRU1QVFlTVFJJTkcgPSBoYW5kbGVycy5yZXNvbHZlKG5ldyBQcm9taXNlKElOVEVSTkFMKSwgJycpO1xuXG5mdW5jdGlvbiByZXNvbHZlKHZhbHVlKSB7XG4gIGlmICh2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFByb21pc2UpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGhhbmRsZXJzLnJlc29sdmUobmV3IFByb21pc2UoSU5URVJOQUwpLCB2YWx1ZSk7XG4gIH1cbiAgdmFyIHZhbHVlVHlwZSA9IHR5cGVvZiB2YWx1ZTtcbiAgc3dpdGNoICh2YWx1ZVR5cGUpIHtcbiAgICBjYXNlICdib29sZWFuJzpcbiAgICAgIHJldHVybiBGQUxTRTtcbiAgICBjYXNlICd1bmRlZmluZWQnOlxuICAgICAgcmV0dXJuIFVOREVGSU5FRDtcbiAgICBjYXNlICdvYmplY3QnOlxuICAgICAgcmV0dXJuIE5VTEw7XG4gICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgIHJldHVybiBaRVJPO1xuICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICByZXR1cm4gRU1QVFlTVFJJTkc7XG4gIH1cbn1cbn0se1wiLi9JTlRFUk5BTFwiOjEsXCIuL2hhbmRsZXJzXCI6MyxcIi4vcHJvbWlzZVwiOjV9XSwxMDpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4ndXNlIHN0cmljdCc7XG52YXIgaGFuZGxlcnMgPSBfZGVyZXFfKCcuL2hhbmRsZXJzJyk7XG52YXIgdHJ5Q2F0Y2ggPSBfZGVyZXFfKCcuL3RyeUNhdGNoJyk7XG5mdW5jdGlvbiBzYWZlbHlSZXNvbHZlVGhlbmFibGUoc2VsZiwgdGhlbmFibGUpIHtcbiAgLy8gRWl0aGVyIGZ1bGZpbGwsIHJlamVjdCBvciByZWplY3Qgd2l0aCBlcnJvclxuICB2YXIgY2FsbGVkID0gZmFsc2U7XG4gIGZ1bmN0aW9uIG9uRXJyb3IodmFsdWUpIHtcbiAgICBpZiAoY2FsbGVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNhbGxlZCA9IHRydWU7XG4gICAgaGFuZGxlcnMucmVqZWN0KHNlbGYsIHZhbHVlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uU3VjY2Vzcyh2YWx1ZSkge1xuICAgIGlmIChjYWxsZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY2FsbGVkID0gdHJ1ZTtcbiAgICBoYW5kbGVycy5yZXNvbHZlKHNlbGYsIHZhbHVlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRyeVRvVW53cmFwKCkge1xuICAgIHRoZW5hYmxlKG9uU3VjY2Vzcywgb25FcnJvcik7XG4gIH1cbiAgXG4gIHZhciByZXN1bHQgPSB0cnlDYXRjaCh0cnlUb1Vud3JhcCk7XG4gIGlmIChyZXN1bHQuc3RhdHVzID09PSAnZXJyb3InKSB7XG4gICAgb25FcnJvcihyZXN1bHQudmFsdWUpO1xuICB9XG59XG5leHBvcnRzLnNhZmVseSA9IHNhZmVseVJlc29sdmVUaGVuYWJsZTtcbn0se1wiLi9oYW5kbGVyc1wiOjMsXCIuL3RyeUNhdGNoXCI6MTJ9XSwxMTpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4vLyBMYXp5IG1hbidzIHN5bWJvbHMgZm9yIHN0YXRlc1xuXG5leHBvcnRzLlJFSkVDVEVEID0gWydSRUpFQ1RFRCddO1xuZXhwb3J0cy5GVUxGSUxMRUQgPSBbJ0ZVTEZJTExFRCddO1xuZXhwb3J0cy5QRU5ESU5HID0gWydQRU5ESU5HJ107XG59LHt9XSwxMjpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4ndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gdHJ5Q2F0Y2g7XG5cbmZ1bmN0aW9uIHRyeUNhdGNoKGZ1bmMsIHZhbHVlKSB7XG4gIHZhciBvdXQgPSB7fTtcbiAgdHJ5IHtcbiAgICBvdXQudmFsdWUgPSBmdW5jKHZhbHVlKTtcbiAgICBvdXQuc3RhdHVzID0gJ3N1Y2Nlc3MnO1xuICB9IGNhdGNoIChlKSB7XG4gICAgb3V0LnN0YXR1cyA9ICdlcnJvcic7XG4gICAgb3V0LnZhbHVlID0gZTtcbiAgfVxuICByZXR1cm4gb3V0O1xufVxufSx7fV0sMTM6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgaW1tZWRpYXRlID0gX2RlcmVxXygnaW1tZWRpYXRlJyk7XG52YXIgaGFuZGxlcnMgPSBfZGVyZXFfKCcuL2hhbmRsZXJzJyk7XG5tb2R1bGUuZXhwb3J0cyA9IHVud3JhcDtcblxuZnVuY3Rpb24gdW53cmFwKHByb21pc2UsIGZ1bmMsIHZhbHVlKSB7XG4gIGltbWVkaWF0ZShmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJldHVyblZhbHVlO1xuICAgIHRyeSB7XG4gICAgICByZXR1cm5WYWx1ZSA9IGZ1bmModmFsdWUpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiBoYW5kbGVycy5yZWplY3QocHJvbWlzZSwgZSk7XG4gICAgfVxuICAgIGlmIChyZXR1cm5WYWx1ZSA9PT0gcHJvbWlzZSkge1xuICAgICAgaGFuZGxlcnMucmVqZWN0KHByb21pc2UsIG5ldyBUeXBlRXJyb3IoJ0Nhbm5vdCByZXNvbHZlIHByb21pc2Ugd2l0aCBpdHNlbGYnKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGhhbmRsZXJzLnJlc29sdmUocHJvbWlzZSwgcmV0dXJuVmFsdWUpO1xuICAgIH1cbiAgfSk7XG59XG59LHtcIi4vaGFuZGxlcnNcIjozLFwiaW1tZWRpYXRlXCI6MTV9XSwxNDpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG5cbn0se31dLDE1OltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbid1c2Ugc3RyaWN0JztcbnZhciB0eXBlcyA9IFtcbiAgX2RlcmVxXygnLi9uZXh0VGljaycpLFxuICBfZGVyZXFfKCcuL211dGF0aW9uLmpzJyksXG4gIF9kZXJlcV8oJy4vbWVzc2FnZUNoYW5uZWwnKSxcbiAgX2RlcmVxXygnLi9zdGF0ZUNoYW5nZScpLFxuICBfZGVyZXFfKCcuL3RpbWVvdXQnKVxuXTtcbnZhciBkcmFpbmluZztcbnZhciBxdWV1ZSA9IFtdO1xuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgZHJhaW5pbmcgPSB0cnVlO1xuICB2YXIgaSwgb2xkUXVldWU7XG4gIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gIHdoaWxlIChsZW4pIHtcbiAgICBvbGRRdWV1ZSA9IHF1ZXVlO1xuICAgIHF1ZXVlID0gW107XG4gICAgaSA9IC0xO1xuICAgIHdoaWxlICgrK2kgPCBsZW4pIHtcbiAgICAgIG9sZFF1ZXVlW2ldKCk7XG4gICAgfVxuICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgfVxuICBkcmFpbmluZyA9IGZhbHNlO1xufVxudmFyIHNjaGVkdWxlRHJhaW47XG52YXIgaSA9IC0xO1xudmFyIGxlbiA9IHR5cGVzLmxlbmd0aDtcbndoaWxlICgrKyBpIDwgbGVuKSB7XG4gIGlmICh0eXBlc1tpXSAmJiB0eXBlc1tpXS50ZXN0ICYmIHR5cGVzW2ldLnRlc3QoKSkge1xuICAgIHNjaGVkdWxlRHJhaW4gPSB0eXBlc1tpXS5pbnN0YWxsKGRyYWluUXVldWUpO1xuICAgIGJyZWFrO1xuICB9XG59XG5tb2R1bGUuZXhwb3J0cyA9IGltbWVkaWF0ZTtcbmZ1bmN0aW9uIGltbWVkaWF0ZSh0YXNrKSB7XG4gIGlmIChxdWV1ZS5wdXNoKHRhc2spID09PSAxICYmICFkcmFpbmluZykge1xuICAgIHNjaGVkdWxlRHJhaW4oKTtcbiAgfVxufVxufSx7XCIuL21lc3NhZ2VDaGFubmVsXCI6MTYsXCIuL211dGF0aW9uLmpzXCI6MTcsXCIuL25leHRUaWNrXCI6MTQsXCIuL3N0YXRlQ2hhbmdlXCI6MTgsXCIuL3RpbWVvdXRcIjoxOX1dLDE2OltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy50ZXN0ID0gZnVuY3Rpb24gKCkge1xuICBpZiAoZ2xvYmFsLnNldEltbWVkaWF0ZSkge1xuICAgIC8vIHdlIGNhbiBvbmx5IGdldCBoZXJlIGluIElFMTBcbiAgICAvLyB3aGljaCBkb2Vzbid0IGhhbmRlbCBwb3N0TWVzc2FnZSB3ZWxsXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0eXBlb2YgZ2xvYmFsLk1lc3NhZ2VDaGFubmVsICE9PSAndW5kZWZpbmVkJztcbn07XG5cbmV4cG9ydHMuaW5zdGFsbCA9IGZ1bmN0aW9uIChmdW5jKSB7XG4gIHZhciBjaGFubmVsID0gbmV3IGdsb2JhbC5NZXNzYWdlQ2hhbm5lbCgpO1xuICBjaGFubmVsLnBvcnQxLm9ubWVzc2FnZSA9IGZ1bmM7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgY2hhbm5lbC5wb3J0Mi5wb3N0TWVzc2FnZSgwKTtcbiAgfTtcbn07XG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSlcbn0se31dLDE3OltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0Jztcbi8vYmFzZWQgb2ZmIHJzdnAgaHR0cHM6Ly9naXRodWIuY29tL3RpbGRlaW8vcnN2cC5qc1xuLy9saWNlbnNlIGh0dHBzOi8vZ2l0aHViLmNvbS90aWxkZWlvL3JzdnAuanMvYmxvYi9tYXN0ZXIvTElDRU5TRVxuLy9odHRwczovL2dpdGh1Yi5jb20vdGlsZGVpby9yc3ZwLmpzL2Jsb2IvbWFzdGVyL2xpYi9yc3ZwL2FzYXAuanNcblxudmFyIE11dGF0aW9uID0gZ2xvYmFsLk11dGF0aW9uT2JzZXJ2ZXIgfHwgZ2xvYmFsLldlYktpdE11dGF0aW9uT2JzZXJ2ZXI7XG5cbmV4cG9ydHMudGVzdCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIE11dGF0aW9uO1xufTtcblxuZXhwb3J0cy5pbnN0YWxsID0gZnVuY3Rpb24gKGhhbmRsZSkge1xuICB2YXIgY2FsbGVkID0gMDtcbiAgdmFyIG9ic2VydmVyID0gbmV3IE11dGF0aW9uKGhhbmRsZSk7XG4gIHZhciBlbGVtZW50ID0gZ2xvYmFsLmRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcnKTtcbiAgb2JzZXJ2ZXIub2JzZXJ2ZShlbGVtZW50LCB7XG4gICAgY2hhcmFjdGVyRGF0YTogdHJ1ZVxuICB9KTtcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICBlbGVtZW50LmRhdGEgPSAoY2FsbGVkID0gKytjYWxsZWQgJSAyKTtcbiAgfTtcbn07XG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSlcbn0se31dLDE4OltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy50ZXN0ID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gJ2RvY3VtZW50JyBpbiBnbG9iYWwgJiYgJ29ucmVhZHlzdGF0ZWNoYW5nZScgaW4gZ2xvYmFsLmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xufTtcblxuZXhwb3J0cy5pbnN0YWxsID0gZnVuY3Rpb24gKGhhbmRsZSkge1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuXG4gICAgLy8gQ3JlYXRlIGEgPHNjcmlwdD4gZWxlbWVudDsgaXRzIHJlYWR5c3RhdGVjaGFuZ2UgZXZlbnQgd2lsbCBiZSBmaXJlZCBhc3luY2hyb25vdXNseSBvbmNlIGl0IGlzIGluc2VydGVkXG4gICAgLy8gaW50byB0aGUgZG9jdW1lbnQuIERvIHNvLCB0aHVzIHF1ZXVpbmcgdXAgdGhlIHRhc2suIFJlbWVtYmVyIHRvIGNsZWFuIHVwIG9uY2UgaXQncyBiZWVuIGNhbGxlZC5cbiAgICB2YXIgc2NyaXB0RWwgPSBnbG9iYWwuZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG4gICAgc2NyaXB0RWwub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24gKCkge1xuICAgICAgaGFuZGxlKCk7XG5cbiAgICAgIHNjcmlwdEVsLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IG51bGw7XG4gICAgICBzY3JpcHRFbC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHNjcmlwdEVsKTtcbiAgICAgIHNjcmlwdEVsID0gbnVsbDtcbiAgICB9O1xuICAgIGdsb2JhbC5kb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuYXBwZW5kQ2hpbGQoc2NyaXB0RWwpO1xuXG4gICAgcmV0dXJuIGhhbmRsZTtcbiAgfTtcbn07XG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSlcbn0se31dLDE5OltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbid1c2Ugc3RyaWN0JztcbmV4cG9ydHMudGVzdCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRydWU7XG59O1xuXG5leHBvcnRzLmluc3RhbGwgPSBmdW5jdGlvbiAodCkge1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHNldFRpbWVvdXQodCwgMCk7XG4gIH07XG59O1xufSx7fV19LHt9LFs0XSkoNClcbn0pO1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL34vbGllL2Rpc3QvbGllLmpzXG4gKiogbW9kdWxlIGlkID0gMzFcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIlxuLyoqXG4gKiBUaGlzIGlzIHRoZSBjb21tb24gbG9naWMgZm9yIGJvdGggdGhlIE5vZGUuanMgYW5kIHdlYiBicm93c2VyXG4gKiBpbXBsZW1lbnRhdGlvbnMgb2YgYGRlYnVnKClgLlxuICpcbiAqIEV4cG9zZSBgZGVidWcoKWAgYXMgdGhlIG1vZHVsZS5cbiAqL1xuXG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBkZWJ1ZztcbmV4cG9ydHMuY29lcmNlID0gY29lcmNlO1xuZXhwb3J0cy5kaXNhYmxlID0gZGlzYWJsZTtcbmV4cG9ydHMuZW5hYmxlID0gZW5hYmxlO1xuZXhwb3J0cy5lbmFibGVkID0gZW5hYmxlZDtcbmV4cG9ydHMuaHVtYW5pemUgPSByZXF1aXJlKCdtcycpO1xuXG4vKipcbiAqIFRoZSBjdXJyZW50bHkgYWN0aXZlIGRlYnVnIG1vZGUgbmFtZXMsIGFuZCBuYW1lcyB0byBza2lwLlxuICovXG5cbmV4cG9ydHMubmFtZXMgPSBbXTtcbmV4cG9ydHMuc2tpcHMgPSBbXTtcblxuLyoqXG4gKiBNYXAgb2Ygc3BlY2lhbCBcIiVuXCIgaGFuZGxpbmcgZnVuY3Rpb25zLCBmb3IgdGhlIGRlYnVnIFwiZm9ybWF0XCIgYXJndW1lbnQuXG4gKlxuICogVmFsaWQga2V5IG5hbWVzIGFyZSBhIHNpbmdsZSwgbG93ZXJjYXNlZCBsZXR0ZXIsIGkuZS4gXCJuXCIuXG4gKi9cblxuZXhwb3J0cy5mb3JtYXR0ZXJzID0ge307XG5cbi8qKlxuICogUHJldmlvdXNseSBhc3NpZ25lZCBjb2xvci5cbiAqL1xuXG52YXIgcHJldkNvbG9yID0gMDtcblxuLyoqXG4gKiBQcmV2aW91cyBsb2cgdGltZXN0YW1wLlxuICovXG5cbnZhciBwcmV2VGltZTtcblxuLyoqXG4gKiBTZWxlY3QgYSBjb2xvci5cbiAqXG4gKiBAcmV0dXJuIHtOdW1iZXJ9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzZWxlY3RDb2xvcigpIHtcbiAgcmV0dXJuIGV4cG9ydHMuY29sb3JzW3ByZXZDb2xvcisrICUgZXhwb3J0cy5jb2xvcnMubGVuZ3RoXTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBkZWJ1Z2dlciB3aXRoIHRoZSBnaXZlbiBgbmFtZXNwYWNlYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZGVidWcobmFtZXNwYWNlKSB7XG5cbiAgLy8gZGVmaW5lIHRoZSBgZGlzYWJsZWRgIHZlcnNpb25cbiAgZnVuY3Rpb24gZGlzYWJsZWQoKSB7XG4gIH1cbiAgZGlzYWJsZWQuZW5hYmxlZCA9IGZhbHNlO1xuXG4gIC8vIGRlZmluZSB0aGUgYGVuYWJsZWRgIHZlcnNpb25cbiAgZnVuY3Rpb24gZW5hYmxlZCgpIHtcblxuICAgIHZhciBzZWxmID0gZW5hYmxlZDtcblxuICAgIC8vIHNldCBgZGlmZmAgdGltZXN0YW1wXG4gICAgdmFyIGN1cnIgPSArbmV3IERhdGUoKTtcbiAgICB2YXIgbXMgPSBjdXJyIC0gKHByZXZUaW1lIHx8IGN1cnIpO1xuICAgIHNlbGYuZGlmZiA9IG1zO1xuICAgIHNlbGYucHJldiA9IHByZXZUaW1lO1xuICAgIHNlbGYuY3VyciA9IGN1cnI7XG4gICAgcHJldlRpbWUgPSBjdXJyO1xuXG4gICAgLy8gYWRkIHRoZSBgY29sb3JgIGlmIG5vdCBzZXRcbiAgICBpZiAobnVsbCA9PSBzZWxmLnVzZUNvbG9ycykgc2VsZi51c2VDb2xvcnMgPSBleHBvcnRzLnVzZUNvbG9ycygpO1xuICAgIGlmIChudWxsID09IHNlbGYuY29sb3IgJiYgc2VsZi51c2VDb2xvcnMpIHNlbGYuY29sb3IgPSBzZWxlY3RDb2xvcigpO1xuXG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuXG4gICAgYXJnc1swXSA9IGV4cG9ydHMuY29lcmNlKGFyZ3NbMF0pO1xuXG4gICAgaWYgKCdzdHJpbmcnICE9PSB0eXBlb2YgYXJnc1swXSkge1xuICAgICAgLy8gYW55dGhpbmcgZWxzZSBsZXQncyBpbnNwZWN0IHdpdGggJW9cbiAgICAgIGFyZ3MgPSBbJyVvJ10uY29uY2F0KGFyZ3MpO1xuICAgIH1cblxuICAgIC8vIGFwcGx5IGFueSBgZm9ybWF0dGVyc2AgdHJhbnNmb3JtYXRpb25zXG4gICAgdmFyIGluZGV4ID0gMDtcbiAgICBhcmdzWzBdID0gYXJnc1swXS5yZXBsYWNlKC8lKFthLXolXSkvZywgZnVuY3Rpb24obWF0Y2gsIGZvcm1hdCkge1xuICAgICAgLy8gaWYgd2UgZW5jb3VudGVyIGFuIGVzY2FwZWQgJSB0aGVuIGRvbid0IGluY3JlYXNlIHRoZSBhcnJheSBpbmRleFxuICAgICAgaWYgKG1hdGNoID09PSAnJSUnKSByZXR1cm4gbWF0Y2g7XG4gICAgICBpbmRleCsrO1xuICAgICAgdmFyIGZvcm1hdHRlciA9IGV4cG9ydHMuZm9ybWF0dGVyc1tmb3JtYXRdO1xuICAgICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBmb3JtYXR0ZXIpIHtcbiAgICAgICAgdmFyIHZhbCA9IGFyZ3NbaW5kZXhdO1xuICAgICAgICBtYXRjaCA9IGZvcm1hdHRlci5jYWxsKHNlbGYsIHZhbCk7XG5cbiAgICAgICAgLy8gbm93IHdlIG5lZWQgdG8gcmVtb3ZlIGBhcmdzW2luZGV4XWAgc2luY2UgaXQncyBpbmxpbmVkIGluIHRoZSBgZm9ybWF0YFxuICAgICAgICBhcmdzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIGluZGV4LS07XG4gICAgICB9XG4gICAgICByZXR1cm4gbWF0Y2g7XG4gICAgfSk7XG5cbiAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGV4cG9ydHMuZm9ybWF0QXJncykge1xuICAgICAgYXJncyA9IGV4cG9ydHMuZm9ybWF0QXJncy5hcHBseShzZWxmLCBhcmdzKTtcbiAgICB9XG4gICAgdmFyIGxvZ0ZuID0gZW5hYmxlZC5sb2cgfHwgZXhwb3J0cy5sb2cgfHwgY29uc29sZS5sb2cuYmluZChjb25zb2xlKTtcbiAgICBsb2dGbi5hcHBseShzZWxmLCBhcmdzKTtcbiAgfVxuICBlbmFibGVkLmVuYWJsZWQgPSB0cnVlO1xuXG4gIHZhciBmbiA9IGV4cG9ydHMuZW5hYmxlZChuYW1lc3BhY2UpID8gZW5hYmxlZCA6IGRpc2FibGVkO1xuXG4gIGZuLm5hbWVzcGFjZSA9IG5hbWVzcGFjZTtcblxuICByZXR1cm4gZm47XG59XG5cbi8qKlxuICogRW5hYmxlcyBhIGRlYnVnIG1vZGUgYnkgbmFtZXNwYWNlcy4gVGhpcyBjYW4gaW5jbHVkZSBtb2Rlc1xuICogc2VwYXJhdGVkIGJ5IGEgY29sb24gYW5kIHdpbGRjYXJkcy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlc1xuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBlbmFibGUobmFtZXNwYWNlcykge1xuICBleHBvcnRzLnNhdmUobmFtZXNwYWNlcyk7XG5cbiAgdmFyIHNwbGl0ID0gKG5hbWVzcGFjZXMgfHwgJycpLnNwbGl0KC9bXFxzLF0rLyk7XG4gIHZhciBsZW4gPSBzcGxpdC5sZW5ndGg7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgIGlmICghc3BsaXRbaV0pIGNvbnRpbnVlOyAvLyBpZ25vcmUgZW1wdHkgc3RyaW5nc1xuICAgIG5hbWVzcGFjZXMgPSBzcGxpdFtpXS5yZXBsYWNlKC9cXCovZywgJy4qPycpO1xuICAgIGlmIChuYW1lc3BhY2VzWzBdID09PSAnLScpIHtcbiAgICAgIGV4cG9ydHMuc2tpcHMucHVzaChuZXcgUmVnRXhwKCdeJyArIG5hbWVzcGFjZXMuc3Vic3RyKDEpICsgJyQnKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGV4cG9ydHMubmFtZXMucHVzaChuZXcgUmVnRXhwKCdeJyArIG5hbWVzcGFjZXMgKyAnJCcpKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBEaXNhYmxlIGRlYnVnIG91dHB1dC5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGRpc2FibGUoKSB7XG4gIGV4cG9ydHMuZW5hYmxlKCcnKTtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIGdpdmVuIG1vZGUgbmFtZSBpcyBlbmFibGVkLCBmYWxzZSBvdGhlcndpc2UuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGVuYWJsZWQobmFtZSkge1xuICB2YXIgaSwgbGVuO1xuICBmb3IgKGkgPSAwLCBsZW4gPSBleHBvcnRzLnNraXBzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKGV4cG9ydHMuc2tpcHNbaV0udGVzdChuYW1lKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICBmb3IgKGkgPSAwLCBsZW4gPSBleHBvcnRzLm5hbWVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKGV4cG9ydHMubmFtZXNbaV0udGVzdChuYW1lKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuLyoqXG4gKiBDb2VyY2UgYHZhbGAuXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gdmFsXG4gKiBAcmV0dXJuIHtNaXhlZH1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGNvZXJjZSh2YWwpIHtcbiAgaWYgKHZhbCBpbnN0YW5jZW9mIEVycm9yKSByZXR1cm4gdmFsLnN0YWNrIHx8IHZhbC5tZXNzYWdlO1xuICByZXR1cm4gdmFsO1xufVxuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL34vZGVidWcvZGVidWcuanNcbiAqKiBtb2R1bGUgaWQgPSAzMlxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihtb2R1bGUpIHtcclxuXHRpZighbW9kdWxlLndlYnBhY2tQb2x5ZmlsbCkge1xyXG5cdFx0bW9kdWxlLmRlcHJlY2F0ZSA9IGZ1bmN0aW9uKCkge307XHJcblx0XHRtb2R1bGUucGF0aHMgPSBbXTtcclxuXHRcdC8vIG1vZHVsZS5wYXJlbnQgPSB1bmRlZmluZWQgYnkgZGVmYXVsdFxyXG5cdFx0bW9kdWxlLmNoaWxkcmVuID0gW107XHJcblx0XHRtb2R1bGUud2VicGFja1BvbHlmaWxsID0gMTtcclxuXHR9XHJcblx0cmV0dXJuIG1vZHVsZTtcclxufVxyXG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqICh3ZWJwYWNrKS9idWlsZGluL21vZHVsZS5qc1xuICoqIG1vZHVsZSBpZCA9IDMzXG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBkcmFpbmluZyA9IHRydWU7XG4gICAgdmFyIGN1cnJlbnRRdWV1ZTtcbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgdmFyIGkgPSAtMTtcbiAgICAgICAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgICAgICAgICAgY3VycmVudFF1ZXVlW2ldKCk7XG4gICAgICAgIH1cbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBkcmFpbmluZyA9IGZhbHNlO1xufVxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICBxdWV1ZS5wdXNoKGZ1bik7XG4gICAgaWYgKCFkcmFpbmluZykge1xuICAgICAgICBzZXRUaW1lb3V0KGRyYWluUXVldWUsIDApO1xuICAgIH1cbn07XG5cbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG4vLyBUT0RPKHNodHlsbWFuKVxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAod2VicGFjaykvfi9ub2RlLWxpYnMtYnJvd3Nlci9+L3Byb2Nlc3MvYnJvd3Nlci5qc1xuICoqIG1vZHVsZSBpZCA9IDM0XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCIvKipcbiAqIEhlbHBlcnMuXG4gKi9cblxudmFyIHMgPSAxMDAwO1xudmFyIG0gPSBzICogNjA7XG52YXIgaCA9IG0gKiA2MDtcbnZhciBkID0gaCAqIDI0O1xudmFyIHkgPSBkICogMzY1LjI1O1xuXG4vKipcbiAqIFBhcnNlIG9yIGZvcm1hdCB0aGUgZ2l2ZW4gYHZhbGAuXG4gKlxuICogT3B0aW9uczpcbiAqXG4gKiAgLSBgbG9uZ2AgdmVyYm9zZSBmb3JtYXR0aW5nIFtmYWxzZV1cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xOdW1iZXJ9IHZhbFxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEByZXR1cm4ge1N0cmluZ3xOdW1iZXJ9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odmFsLCBvcHRpb25zKXtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIGlmICgnc3RyaW5nJyA9PSB0eXBlb2YgdmFsKSByZXR1cm4gcGFyc2UodmFsKTtcbiAgcmV0dXJuIG9wdGlvbnMubG9uZ1xuICAgID8gbG9uZyh2YWwpXG4gICAgOiBzaG9ydCh2YWwpO1xufTtcblxuLyoqXG4gKiBQYXJzZSB0aGUgZ2l2ZW4gYHN0cmAgYW5kIHJldHVybiBtaWxsaXNlY29uZHMuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7TnVtYmVyfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gcGFyc2Uoc3RyKSB7XG4gIHZhciBtYXRjaCA9IC9eKCg/OlxcZCspP1xcLj9cXGQrKSAqKG1zfHNlY29uZHM/fHN8bWludXRlcz98bXxob3Vycz98aHxkYXlzP3xkfHllYXJzP3x5KT8kL2kuZXhlYyhzdHIpO1xuICBpZiAoIW1hdGNoKSByZXR1cm47XG4gIHZhciBuID0gcGFyc2VGbG9hdChtYXRjaFsxXSk7XG4gIHZhciB0eXBlID0gKG1hdGNoWzJdIHx8ICdtcycpLnRvTG93ZXJDYXNlKCk7XG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgJ3llYXJzJzpcbiAgICBjYXNlICd5ZWFyJzpcbiAgICBjYXNlICd5JzpcbiAgICAgIHJldHVybiBuICogeTtcbiAgICBjYXNlICdkYXlzJzpcbiAgICBjYXNlICdkYXknOlxuICAgIGNhc2UgJ2QnOlxuICAgICAgcmV0dXJuIG4gKiBkO1xuICAgIGNhc2UgJ2hvdXJzJzpcbiAgICBjYXNlICdob3VyJzpcbiAgICBjYXNlICdoJzpcbiAgICAgIHJldHVybiBuICogaDtcbiAgICBjYXNlICdtaW51dGVzJzpcbiAgICBjYXNlICdtaW51dGUnOlxuICAgIGNhc2UgJ20nOlxuICAgICAgcmV0dXJuIG4gKiBtO1xuICAgIGNhc2UgJ3NlY29uZHMnOlxuICAgIGNhc2UgJ3NlY29uZCc6XG4gICAgY2FzZSAncyc6XG4gICAgICByZXR1cm4gbiAqIHM7XG4gICAgY2FzZSAnbXMnOlxuICAgICAgcmV0dXJuIG47XG4gIH1cbn1cblxuLyoqXG4gKiBTaG9ydCBmb3JtYXQgZm9yIGBtc2AuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1zXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzaG9ydChtcykge1xuICBpZiAobXMgPj0gZCkgcmV0dXJuIE1hdGgucm91bmQobXMgLyBkKSArICdkJztcbiAgaWYgKG1zID49IGgpIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gaCkgKyAnaCc7XG4gIGlmIChtcyA+PSBtKSByZXR1cm4gTWF0aC5yb3VuZChtcyAvIG0pICsgJ20nO1xuICBpZiAobXMgPj0gcykgcmV0dXJuIE1hdGgucm91bmQobXMgLyBzKSArICdzJztcbiAgcmV0dXJuIG1zICsgJ21zJztcbn1cblxuLyoqXG4gKiBMb25nIGZvcm1hdCBmb3IgYG1zYC5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gbXNcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGxvbmcobXMpIHtcbiAgcmV0dXJuIHBsdXJhbChtcywgZCwgJ2RheScpXG4gICAgfHwgcGx1cmFsKG1zLCBoLCAnaG91cicpXG4gICAgfHwgcGx1cmFsKG1zLCBtLCAnbWludXRlJylcbiAgICB8fCBwbHVyYWwobXMsIHMsICdzZWNvbmQnKVxuICAgIHx8IG1zICsgJyBtcyc7XG59XG5cbi8qKlxuICogUGx1cmFsaXphdGlvbiBoZWxwZXIuXG4gKi9cblxuZnVuY3Rpb24gcGx1cmFsKG1zLCBuLCBuYW1lKSB7XG4gIGlmIChtcyA8IG4pIHJldHVybjtcbiAgaWYgKG1zIDwgbiAqIDEuNSkgcmV0dXJuIE1hdGguZmxvb3IobXMgLyBuKSArICcgJyArIG5hbWU7XG4gIHJldHVybiBNYXRoLmNlaWwobXMgLyBuKSArICcgJyArIG5hbWUgKyAncyc7XG59XG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vfi9kZWJ1Zy9+L21zL2luZGV4LmpzXG4gKiogbW9kdWxlIGlkID0gMzVcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyJdLCJzb3VyY2VSb290IjoiIiwiZmlsZSI6IjhhNzI3MDdlOTZiNzk4YWQ5YmY4LmpzIn0=