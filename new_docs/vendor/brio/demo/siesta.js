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
	
	function _graphData(data, Model, callback) {
	  Model.graph(data, {
	    _ignoreInstalled: true,
	    fromStorage: true
	  }, function(err, instances) {
	    if (err) {
	      log('Error loading models', err);
	    }
	    callback(err, instances);
	  });
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
	
	  function constructAllIndex() {
	    return {
	      _id: '_design/all',
	      views: {
	        all: {
	          map: function(doc) {
	            if (doc.model) {
	              emit(doc.collection + '.' + doc.model, doc);
	            }
	          }.toString()
	        }
	      }
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
	    var indexes = [constructAllIndex()];
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
	
	
	  var all;
	
	  function _loadPouch(cb) {
	    if (!all) {
	      pouch
	        .query('all')
	        .then(function(resp) {
	          all = {};
	          var rows = resp.rows;
	          rows.forEach(function(row) {
	            var key = row.key;
	            if (!all[key]) all[key] = [];
	            all[key].push(row.value);
	          });
	          cb(null, all);
	        }).catch(cb);
	    }
	    else {
	      cb(null, all);
	    }
	  }
	
	  function _getDataFromPouch(collectionName, modelName, cb) {
	    _loadPouch(function(err, all) {
	      if (err) {
	        cb(err);
	      }
	      else {
	        var fullyQualifiedName = fullyQualifiedModelName(collectionName, modelName),
	          Model = CollectionRegistry[collectionName][modelName],
	          rows = all[fullyQualifiedName] || [],
	          data = rows.map(function(row) {
	            return _prepareDatum(row, Model);
	          }),
	          loaded = {};
	
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
	        cb(null, data);
	      }
	
	
	    });
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
	    var collectionName = opts.collectionName,
	      modelName = opts.modelName,
	      model = opts.model;
	    if (model) {
	      collectionName = model.collectionName;
	      modelName = model.name;
	    }
	    var fullyQualifiedName = fullyQualifiedModelName(collectionName, modelName);
	    var Model = CollectionRegistry[collectionName][modelName];
	    storage._getDataFromPouch(collectionName, modelName, function(err, data) {
	      if (!err)
	        storage._graphData(data, Model, callback);
	      else callback(err);
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
	    _getDataFromPouch: _getDataFromPouch,
	    _graphData: _graphData,
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
	      all = undefined;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vd2VicGFjay9ib290c3RyYXAgNjdmOGFlY2E3OWEyYmVlOGEzYzciLCJ3ZWJwYWNrOi8vLy4vY29yZS9pbmRleC5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL3V0aWwuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9jb2xsZWN0aW9uUmVnaXN0cnkuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9jb2xsZWN0aW9uLmpzIiwid2VicGFjazovLy8uL2NvcmUvY2FjaGUuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9tb2RlbC5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL2Vycm9yLmpzIiwid2VicGFjazovLy8uL2NvcmUvZXZlbnRzLmpzIiwid2VicGFjazovLy8uL2NvcmUvUmVsYXRpb25zaGlwVHlwZS5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL1JlYWN0aXZlUXVlcnkuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9NYW55VG9NYW55UHJveHkuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9PbmVUb09uZVByb3h5LmpzIiwid2VicGFjazovLy8uL2NvcmUvT25lVG9NYW55UHJveHkuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9SZWxhdGlvbnNoaXBQcm94eS5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL21vZGVsRXZlbnRzLmpzIiwid2VicGFjazovLy8uL2NvcmUvUXVlcnkuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9RdWVyeVNldC5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL2xvZy5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL01vZGVsSW5zdGFuY2UuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9tYXBwaW5nT3BlcmF0aW9uLmpzIiwid2VicGFjazovLy8uL3N0b3JhZ2UvaW5kZXguanMiLCJ3ZWJwYWNrOi8vLy4vfi9leHRlbmQvaW5kZXguanMiLCJ3ZWJwYWNrOi8vLy4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9Db25kaXRpb24uanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9QbGFjZWhvbGRlci5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL2luc3RhbmNlRmFjdG9yeS5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL0NoYWluLmpzIiwid2VicGFjazovLy8uL34vZGVidWcvYnJvd3Nlci5qcyIsIndlYnBhY2s6Ly8vLi9+L2FyZ3NhcnJheS9pbmRleC5qcyIsIndlYnBhY2s6Ly8vKHdlYnBhY2spL34vbm9kZS1saWJzLWJyb3dzZXIvfi90aW1lcnMtYnJvd3NlcmlmeS9tYWluLmpzIiwid2VicGFjazovLy8od2VicGFjaykvfi9ub2RlLWxpYnMtYnJvd3Nlci9+L2V2ZW50cy9ldmVudHMuanMiLCJ3ZWJwYWNrOi8vLy4vfi9saWUvZGlzdC9saWUuanMiLCJ3ZWJwYWNrOi8vLy4vfi9kZWJ1Zy9kZWJ1Zy5qcyIsIndlYnBhY2s6Ly8vKHdlYnBhY2spL2J1aWxkaW4vbW9kdWxlLmpzIiwid2VicGFjazovLy8od2VicGFjaykvfi9ub2RlLWxpYnMtYnJvd3Nlci9+L3Byb2Nlc3MvYnJvd3Nlci5qcyIsIndlYnBhY2s6Ly8vLi9+L2RlYnVnL34vbXMvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLHVCQUFlO0FBQ2Y7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7OztBQUdBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0Esd0M7Ozs7Ozs7QUN0Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxvQ0FBbUM7QUFDbkM7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFDO0FBQ0Q7QUFDQTtBQUNBO0FBQ0Es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O0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUM7O0FBRUQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxjQUFhO0FBQ2IsWUFBVztBQUNYO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQSxFQUFDOztBQUVEOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSwrQjs7Ozs7O0FDdEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRzs7Ozs7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsWUFBVyxNQUFNO0FBQ2pCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7O0FBRUg7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0EsSUFBRzs7QUFFSDtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHOzs7QUFHSDs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFDOztBQUVEO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsY0FBYSxLQUFLO0FBQ2xCLGdCQUFlO0FBQ2Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxZQUFXO0FBQ1g7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQVc7QUFDWDtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUCxJQUFHO0FBQ0g7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQSxFQUFDOztBQUVELGdDOzs7Ozs7QUN6UUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxZQUFXLE9BQU87QUFDbEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQVc7QUFDWDtBQUNBLFFBQU87QUFDUDtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1AsTUFBSztBQUNMLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1AsTUFBSztBQUNMLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQVc7QUFDWCxVQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTCxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtB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Q0EsTUFBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsdURBQXNEO0FBQ3REO0FBQ0EsVUFBUztBQUNUO0FBQ0E7QUFDQTtBQUNBLFlBQVc7QUFDWDtBQUNBO0FBQ0EsVUFBUztBQUNULFFBQU87QUFDUDtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUDtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHOztBQUVIOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxhQUFZO0FBQ1o7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0wsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxZQUFXO0FBQ1g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxZQUFXO0FBQ1g7QUFDQTtBQUNBLFFBQU87QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBLEVBQUM7O0FBRUQ7QUFDQTtBQUNBO0FBQ0EsMEJBQXlCO0FBQ3pCLElBQUc7QUFDSDtBQUNBO0FBQ0EsSUFBRztBQUNI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O0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxzQkFBcUI7QUFDckI7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0Esa0JBQWlCO0FBQ2pCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOzs7Ozs7OztBQzlFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsNkNBQTRDO0FBQzVDO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7O0FBR0Esd0NBQXVDO0FBQ3ZDLG9CQUFtQixZQUFZLEVBQUU7QUFDakM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUDtBQUNBOztBQUVBO0FBQ0E7OztBQUdBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsb0JBQW1CLHFCQUFxQjtBQUN4QztBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsbUJBQWtCO0FBQ2xCOztBQUVBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7O0FBRUw7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHOztBQUVIOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0Esc0JBQXFCLGlCQUFpQjtBQUN0QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0Esc0JBQXFCLHNCQUFzQjtBQUMzQztBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLHNCQUFxQixzQkFBc0I7QUFDM0M7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsd0JBQXVCLG9CQUFvQjtBQUMzQztBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsOEJBQTZCO0FBQzdCO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7O0FBRUw7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7O0FBRUw7QUFDQTtBQUNBOztBQUVBO0FBQ0EsTUFBSzs7QUFFTDtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLOztBQUVMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0EsSUFBRzs7QUFFSDs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsc0JBQXFCLG9CQUFvQjtBQUN6QztBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7O0FBRUw7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7O0FBRUEsTUFBSzs7QUFFTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSzs7QUFFTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQSx5QkFBd0I7QUFDeEIsMkJBQTBCO0FBQzFCLDJCQUEwQjtBQUMxQjtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLE1BQUs7O0FBRUw7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQTtBQUNBLE1BQUs7O0FBRUw7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSzs7QUFFTDtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxJQUFHOztBQUVIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7O0FBRUE7O0FBRUE7QUFDQTtBQUNBLE1BQUs7O0FBRUw7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsSUFBRzs7QUFFSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsTUFBSztBQUNMOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBLG9CQUFtQiwwQkFBMEI7QUFDN0M7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLHNCQUFxQixjQUFjO0FBQ25DO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLHNCQUFxQixpQkFBaUI7QUFDdEM7O0FBRUEsc0JBQXFCLGNBQWM7QUFDbkMsd0JBQXVCLGlCQUFpQjtBQUN4QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQSxNQUFLOztBQUVMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsWUFBVztBQUNYO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLE1BQUs7O0FBRUw7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsUUFBTztBQUNQOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHNCQUFxQixnQkFBZ0I7QUFDckM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7O0FBRUw7QUFDQSxzQkFBcUIsa0JBQWtCO0FBQ3ZDO0FBQ0E7QUFDQTtBQUNBLE1BQUs7O0FBRUw7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsTUFBSzs7QUFFTDtBQUNBO0FBQ0E7QUFDQSxNQUFLOztBQUVMO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLDhCQUE2QjtBQUM3QjtBQUNBLDhCQUE2QjtBQUM3QixNQUFLO0FBQ0w7QUFDQTtBQUNBLDhCQUE2QjtBQUM3QjtBQUNBLDhCQUE2QjtBQUM3QjtBQUNBOztBQUVBOztBQUVBOztBQUVBO0FBQ0E7O0FBRUEsb0JBQW1CLG9CQUFvQjtBQUN2QztBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUDs7QUFFQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUEsb0JBQW1CLDBCQUEwQjtBQUM3QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxNQUFLOztBQUVMO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esc0RBQXFEO0FBQ3JEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFDOzs7Ozs7OztBQzVuQ0Q7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBUzs7QUFFVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsWUFBVztBQUNYO0FBQ0E7QUFDQSxZQUFXO0FBQ1gsVUFBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7QUFDQTtBQUNBLElBQUc7O0FBRUg7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLDRCOzs7Ozs7QUN0RUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsK0JBQThCO0FBQzlCO0FBQ0E7O0FBRUEsOEI7Ozs7OztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU8sSUFBSSxhQUFhO0FBQ3hCLE1BQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsWUFBVzs7QUFFWDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGNBQWE7QUFDYixZQUFXO0FBQ1g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0E7QUFDQSxRQUFPO0FBQ1AsTUFBSztBQUNMLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0wsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7O0FBRUw7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBLFFBQU87QUFDUDtBQUNBO0FBQ0EsTUFBSztBQUNMLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esd0NBQXVDO0FBQ3ZDO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQSxnQkFBZTtBQUNmO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLHVDOzs7Ozs7QUNoT0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUTtBQUNSLGFBQVksTUFBTSw0QkFBNEI7QUFDOUM7QUFDQTtBQUNBLFNBQVE7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDBEQUF5RDtBQUN6RCxNQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQLE1BQUs7QUFDTDtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBLGNBQWEsU0FBUztBQUN0QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGdEQUErQztBQUMvQyxNQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSw4REFBNkQ7QUFDN0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUCxNQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQSx3Qjs7Ozs7OztBQzdGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7OztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRzs7QUFFSDtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFlBQVcsT0FBTztBQUNsQjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsYUFBWSxPQUFPO0FBQ25CO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7Ozs7Ozs7QUM3SkE7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0EsRTs7Ozs7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSw0Q0FBMkMsaUJBQWlCOztBQUU1RDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHOztBQUVIO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLEc7Ozs7Ozs7QUMzRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esa0JBQWlCO0FBQ2pCO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxvQkFBbUIsU0FBUztBQUM1QjtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBLGdCQUFlLFNBQVM7QUFDeEI7O0FBRUE7QUFDQTtBQUNBLGdCQUFlLFNBQVM7QUFDeEI7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsSUFBRztBQUNILHFCQUFvQixTQUFTO0FBQzdCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7Ozs7Ozt5QkM1U0EsMkRBQWEsMkJBQTJFLDJEQUEyRCxLQUFLLE1BQU0sMEhBQTBILFlBQVksMEJBQTBCLDBCQUEwQixnQkFBZ0IsVUFBVSxVQUFVLDBDQUEwQyw4QkFBd0Isb0JBQW9CLDhDQUE4QyxrQ0FBa0MsWUFBWSxZQUFZLG1DQUFtQyxpQkFBaUIsZ0JBQWdCLHNCQUFzQixvQkFBb0IsMENBQTBDLFlBQVksV0FBVyxZQUFZLFNBQVMsR0FBRztBQUNqd0I7O0FBRUE7O0FBRUE7QUFDQSxFQUFDLEdBQUc7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBQyxFQUFFLHVFQUF1RTtBQUMxRTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUMsRUFBRSxxREFBcUQ7QUFDeEQ7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFDLEVBQUUsOERBQThEO0FBQ2pFOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FBR0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQSxFQUFDLEVBQUUsa0ZBQWtGO0FBQ3JGO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFDLEVBQUUsNkJBQTZCO0FBQ2hDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQTtBQUNBLEVBQUMsRUFBRSx1RUFBdUU7QUFDMUU7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFDLEVBQUUsNENBQTRDO0FBQy9DOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBQyxFQUFFLDRDQUE0QztBQUMvQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBQyxFQUFFLCtCQUErQjtBQUNsQzs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxFQUFDLEdBQUc7QUFDSjs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFDLEdBQUc7QUFDSjs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0EsRUFBQyxFQUFFLDhCQUE4Qjs7QUFFakMsRUFBQyxHQUFHO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFDLEVBQUUsMkZBQTJGO0FBQzlGO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUMscUlBQXFJO0FBQ3RJLEVBQUMsR0FBRztBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUMscUlBQXFJO0FBQ3RJLEVBQUMsR0FBRztBQUNKO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUEsa0NBQWlDO0FBQ2pDO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsRUFBQyxxSUFBcUk7QUFDdEksRUFBQyxHQUFHO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUMsR0FBRyxFQUFFLEdBQUc7QUFDVCxFQUFDOzs7Ozs7Ozs7QUN0ZEQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsYUFBWTtBQUNaO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFlBQVcsT0FBTztBQUNsQixhQUFZO0FBQ1o7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSzs7QUFFTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsWUFBVyxPQUFPO0FBQ2xCO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBLGtCQUFpQixTQUFTO0FBQzFCLDZCQUE0QjtBQUM1QjtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsWUFBVyxPQUFPO0FBQ2xCLGFBQVk7QUFDWjtBQUNBOztBQUVBO0FBQ0E7QUFDQSwwQ0FBeUMsU0FBUztBQUNsRDtBQUNBO0FBQ0E7QUFDQTtBQUNBLDBDQUF5QyxTQUFTO0FBQ2xEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxZQUFXLE1BQU07QUFDakIsYUFBWTtBQUNaO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7QUNwTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7QUNUQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esc0JBQXFCO0FBQ3JCOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLDRCQUEyQjtBQUMzQjtBQUNBO0FBQ0E7QUFDQSw2QkFBNEIsVUFBVTs7Ozs7OztBQ3pEdEM7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxZQUFXLGNBQWM7QUFDekIsWUFBVyxPQUFPO0FBQ2xCLGFBQVk7QUFDWjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFlBQVcsT0FBTztBQUNsQixhQUFZO0FBQ1o7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsWUFBVyxPQUFPO0FBQ2xCLGFBQVk7QUFDWjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFlBQVcsT0FBTztBQUNsQixhQUFZO0FBQ1o7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbIiBcdC8vIFRoZSBtb2R1bGUgY2FjaGVcbiBcdHZhciBpbnN0YWxsZWRNb2R1bGVzID0ge307XG5cbiBcdC8vIFRoZSByZXF1aXJlIGZ1bmN0aW9uXG4gXHRmdW5jdGlvbiBfX3dlYnBhY2tfcmVxdWlyZV9fKG1vZHVsZUlkKSB7XG5cbiBcdFx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG4gXHRcdGlmKGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdKVxuIFx0XHRcdHJldHVybiBpbnN0YWxsZWRNb2R1bGVzW21vZHVsZUlkXS5leHBvcnRzO1xuXG4gXHRcdC8vIENyZWF0ZSBhIG5ldyBtb2R1bGUgKGFuZCBwdXQgaXQgaW50byB0aGUgY2FjaGUpXG4gXHRcdHZhciBtb2R1bGUgPSBpbnN0YWxsZWRNb2R1bGVzW21vZHVsZUlkXSA9IHtcbiBcdFx0XHRleHBvcnRzOiB7fSxcbiBcdFx0XHRpZDogbW9kdWxlSWQsXG4gXHRcdFx0bG9hZGVkOiBmYWxzZVxuIFx0XHR9O1xuXG4gXHRcdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuIFx0XHRtb2R1bGVzW21vZHVsZUlkXS5jYWxsKG1vZHVsZS5leHBvcnRzLCBtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuIFx0XHQvLyBGbGFnIHRoZSBtb2R1bGUgYXMgbG9hZGVkXG4gXHRcdG1vZHVsZS5sb2FkZWQgPSB0cnVlO1xuXG4gXHRcdC8vIFJldHVybiB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlXG4gXHRcdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbiBcdH1cblxuXG4gXHQvLyBleHBvc2UgdGhlIG1vZHVsZXMgb2JqZWN0IChfX3dlYnBhY2tfbW9kdWxlc19fKVxuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5tID0gbW9kdWxlcztcblxuIFx0Ly8gZXhwb3NlIHRoZSBtb2R1bGUgY2FjaGVcbiBcdF9fd2VicGFja19yZXF1aXJlX18uYyA9IGluc3RhbGxlZE1vZHVsZXM7XG5cbiBcdC8vIF9fd2VicGFja19wdWJsaWNfcGF0aF9fXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLnAgPSBcIlwiO1xuXG4gXHQvLyBMb2FkIGVudHJ5IG1vZHVsZSBhbmQgcmV0dXJuIGV4cG9ydHNcbiBcdHJldHVybiBfX3dlYnBhY2tfcmVxdWlyZV9fKDApO1xuXG5cbi8qKiBXRUJQQUNLIEZPT1RFUiAqKlxuICoqIHdlYnBhY2svYm9vdHN0cmFwIDY3ZjhhZWNhNzlhMmJlZThhM2M3XG4gKiovIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgQ29sbGVjdGlvblJlZ2lzdHJ5ID0gcmVxdWlyZSgnLi9jb2xsZWN0aW9uUmVnaXN0cnknKS5Db2xsZWN0aW9uUmVnaXN0cnksXG4gIENvbGxlY3Rpb24gPSByZXF1aXJlKCcuL2NvbGxlY3Rpb24nKSxcbiAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyksXG4gIE1vZGVsID0gcmVxdWlyZSgnLi9tb2RlbCcpLFxuICBlcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKSxcbiAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgUmVsYXRpb25zaGlwVHlwZSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwVHlwZScpLFxuICBSZWFjdGl2ZVF1ZXJ5ID0gcmVxdWlyZSgnLi9SZWFjdGl2ZVF1ZXJ5JyksXG4gIE1hbnlUb01hbnlQcm94eSA9IHJlcXVpcmUoJy4vTWFueVRvTWFueVByb3h5JyksXG4gIE9uZVRvT25lUHJveHkgPSByZXF1aXJlKCcuL09uZVRvT25lUHJveHknKSxcbiAgT25lVG9NYW55UHJveHkgPSByZXF1aXJlKCcuL09uZVRvTWFueVByb3h5JyksXG4gIFJlbGF0aW9uc2hpcFByb3h5ID0gcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBQcm94eScpLFxuICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgUXVlcnkgPSByZXF1aXJlKCcuL1F1ZXJ5JyksXG4gIHF1ZXJ5U2V0ID0gcmVxdWlyZSgnLi9RdWVyeVNldCcpLFxuICBsb2cgPSByZXF1aXJlKCcuL2xvZycpO1xuXG51dGlsLl9wYXRjaEJpbmQoKTtcblxuLy8gSW5pdGlhbGlzZSBzaWVzdGEgb2JqZWN0LiBTdHJhbmdlIGZvcm1hdCBmYWNpbGl0aWVzIHVzaW5nIHN1Ym1vZHVsZXMgd2l0aCByZXF1aXJlSlMgKGV2ZW50dWFsbHkpXG52YXIgc2llc3RhID0gZnVuY3Rpb24oZXh0KSB7XG4gIGlmICghc2llc3RhLmV4dCkgc2llc3RhLmV4dCA9IHt9O1xuICB1dGlsLmV4dGVuZChzaWVzdGEuZXh0LCBleHQgfHwge30pO1xuICByZXR1cm4gc2llc3RhO1xufTtcblxuLy8gTm90aWZpY2F0aW9uc1xudXRpbC5leHRlbmQoc2llc3RhLCB7XG4gIG9uOiBldmVudHMub24uYmluZChldmVudHMpLFxuICBvZmY6IGV2ZW50cy5yZW1vdmVMaXN0ZW5lci5iaW5kKGV2ZW50cyksXG4gIG9uY2U6IGV2ZW50cy5vbmNlLmJpbmQoZXZlbnRzKSxcbiAgcmVtb3ZlQWxsTGlzdGVuZXJzOiBldmVudHMucmVtb3ZlQWxsTGlzdGVuZXJzLmJpbmQoZXZlbnRzKVxufSk7XG51dGlsLmV4dGVuZChzaWVzdGEsIHtcbiAgcmVtb3ZlTGlzdGVuZXI6IHNpZXN0YS5vZmYsXG4gIGFkZExpc3RlbmVyOiBzaWVzdGEub25cbn0pO1xuXG4vLyBFeHBvc2Ugc29tZSBzdHVmZiBmb3IgdXNhZ2UgYnkgZXh0ZW5zaW9ucyBhbmQvb3IgdXNlcnNcbnV0aWwuZXh0ZW5kKHNpZXN0YSwge1xuICBSZWxhdGlvbnNoaXBUeXBlOiBSZWxhdGlvbnNoaXBUeXBlLFxuICBNb2RlbEV2ZW50VHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUsXG4gIGxvZzogbG9nLkxldmVsLFxuICBJbnNlcnRpb25Qb2xpY3k6IFJlYWN0aXZlUXVlcnkuSW5zZXJ0aW9uUG9saWN5LFxuICBfaW50ZXJuYWw6IHtcbiAgICBsb2c6IGxvZyxcbiAgICBNb2RlbDogTW9kZWwsXG4gICAgZXJyb3I6IGVycm9yLFxuICAgIE1vZGVsRXZlbnRUeXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZSxcbiAgICBNb2RlbEluc3RhbmNlOiByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKSxcbiAgICBleHRlbmQ6IHJlcXVpcmUoJ2V4dGVuZCcpLFxuICAgIE1hcHBpbmdPcGVyYXRpb246IHJlcXVpcmUoJy4vbWFwcGluZ09wZXJhdGlvbicpLFxuICAgIGV2ZW50czogZXZlbnRzLFxuICAgIFByb3h5RXZlbnRFbWl0dGVyOiBldmVudHMuUHJveHlFdmVudEVtaXR0ZXIsXG4gICAgY2FjaGU6IHJlcXVpcmUoJy4vY2FjaGUnKSxcbiAgICBtb2RlbEV2ZW50czogbW9kZWxFdmVudHMsXG4gICAgQ29sbGVjdGlvblJlZ2lzdHJ5OiByZXF1aXJlKCcuL2NvbGxlY3Rpb25SZWdpc3RyeScpLkNvbGxlY3Rpb25SZWdpc3RyeSxcbiAgICBDb2xsZWN0aW9uOiBDb2xsZWN0aW9uLFxuICAgIHV0aWxzOiB1dGlsLFxuICAgIHV0aWw6IHV0aWwsXG4gICAgcXVlcnlTZXQ6IHF1ZXJ5U2V0LFxuICAgIG9ic2VydmU6IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJyksXG4gICAgUXVlcnk6IFF1ZXJ5LFxuICAgIE1hbnlUb01hbnlQcm94eTogTWFueVRvTWFueVByb3h5LFxuICAgIE9uZVRvTWFueVByb3h5OiBPbmVUb01hbnlQcm94eSxcbiAgICBPbmVUb09uZVByb3h5OiBPbmVUb09uZVByb3h5LFxuICAgIFJlbGF0aW9uc2hpcFByb3h5OiBSZWxhdGlvbnNoaXBQcm94eVxuICB9LFxuICBpc0FycmF5OiB1dGlsLmlzQXJyYXksXG4gIGlzU3RyaW5nOiB1dGlsLmlzU3RyaW5nXG59KTtcblxuc2llc3RhLmV4dCA9IHt9O1xuXG52YXIgaW5zdGFsbGVkID0gZmFsc2UsXG4gIGluc3RhbGxpbmcgPSBmYWxzZTtcblxuXG51dGlsLmV4dGVuZChzaWVzdGEsIHtcbiAgLyoqXG4gICAqIFdpcGUgZXZlcnl0aGluZy4gVXNlZCBkdXJpbmcgdGVzdCBnZW5lcmFsbHkuXG4gICAqL1xuICByZXNldDogZnVuY3Rpb24oY2IsIHJlc2V0U3RvcmFnZSkge1xuICAgIGluc3RhbGxlZCA9IGZhbHNlO1xuICAgIGluc3RhbGxpbmcgPSBmYWxzZTtcbiAgICBkZWxldGUgdGhpcy5xdWV1ZWRUYXNrcztcbiAgICBjYWNoZS5yZXNldCgpO1xuICAgIENvbGxlY3Rpb25SZWdpc3RyeS5yZXNldCgpO1xuICAgIGV2ZW50cy5yZW1vdmVBbGxMaXN0ZW5lcnMoKTtcbiAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkge1xuICAgICAgcmVzZXRTdG9yYWdlID0gcmVzZXRTdG9yYWdlID09PSB1bmRlZmluZWQgPyB0cnVlIDogcmVzZXRTdG9yYWdlO1xuICAgICAgaWYgKHJlc2V0U3RvcmFnZSkgc2llc3RhLmV4dC5zdG9yYWdlLl9yZXNldChjYik7XG4gICAgICBlbHNlIGNiKCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgY2IoKTtcbiAgICB9XG4gIH0sXG4gIC8qKlxuICAgKiBDcmVhdGVzIGFuZCByZWdpc3RlcnMgYSBuZXcgQ29sbGVjdGlvbi5cbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lXG4gICAqIEBwYXJhbSAge09iamVjdH0gW29wdHNdXG4gICAqIEByZXR1cm4ge0NvbGxlY3Rpb259XG4gICAqL1xuICBjb2xsZWN0aW9uOiBmdW5jdGlvbihuYW1lLCBvcHRzKSB7XG4gICAgdmFyIGMgPSBuZXcgQ29sbGVjdGlvbihuYW1lLCBvcHRzKTtcbiAgICBpZiAoaW5zdGFsbGVkKSBjLmluc3RhbGxlZCA9IHRydWU7IC8vIFRPRE86IFJlbW92ZVxuICAgIHJldHVybiBjO1xuICB9LFxuICAvKipcbiAgICogSW5zdGFsbCBhbGwgY29sbGVjdGlvbnMuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYl1cbiAgICogQHJldHVybnMge3EuUHJvbWlzZX1cbiAgICovXG4gIGluc3RhbGw6IGZ1bmN0aW9uKGNiKSB7XG4gICAgaWYgKCFpbnN0YWxsaW5nICYmICFpbnN0YWxsZWQpIHtcbiAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgIGluc3RhbGxpbmcgPSB0cnVlO1xuICAgICAgICB2YXIgY29sbGVjdGlvbk5hbWVzID0gQ29sbGVjdGlvblJlZ2lzdHJ5LmNvbGxlY3Rpb25OYW1lcyxcbiAgICAgICAgICB0YXNrcyA9IGNvbGxlY3Rpb25OYW1lcy5tYXAoZnVuY3Rpb24obikge1xuICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb24gPSBDb2xsZWN0aW9uUmVnaXN0cnlbbl07XG4gICAgICAgICAgICByZXR1cm4gY29sbGVjdGlvbi5pbnN0YWxsLmJpbmQoY29sbGVjdGlvbik7XG4gICAgICAgICAgfSksXG4gICAgICAgICAgc3RvcmFnZUVuYWJsZWQgPSBzaWVzdGEuZXh0LnN0b3JhZ2VFbmFibGVkO1xuICAgICAgICBpZiAoc3RvcmFnZUVuYWJsZWQpIHRhc2tzID0gdGFza3MuY29uY2F0KFtzaWVzdGEuZXh0LnN0b3JhZ2UuZW5zdXJlSW5kZXhlc0ZvckFsbCwgc2llc3RhLmV4dC5zdG9yYWdlLl9sb2FkXSk7XG4gICAgICAgIHRhc2tzLnB1c2goZnVuY3Rpb24oZG9uZSkge1xuICAgICAgICAgIGluc3RhbGxlZCA9IHRydWU7XG4gICAgICAgICAgaWYgKHRoaXMucXVldWVkVGFza3MpIHRoaXMucXVldWVkVGFza3MuZXhlY3V0ZSgpO1xuICAgICAgICAgIGRvbmUoKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgdXRpbC5zZXJpZXModGFza3MsIGNiKTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuICAgIGVsc2UgY2IoZXJyb3IoJ2FscmVhZHkgaW5zdGFsbGluZycpKTtcbiAgfSxcbiAgX3B1c2hUYXNrOiBmdW5jdGlvbih0YXNrKSB7XG4gICAgaWYgKCF0aGlzLnF1ZXVlZFRhc2tzKSB7XG4gICAgICB0aGlzLnF1ZXVlZFRhc2tzID0gbmV3IGZ1bmN0aW9uIFF1ZXVlKCkge1xuICAgICAgICB0aGlzLnRhc2tzID0gW107XG4gICAgICAgIHRoaXMuZXhlY3V0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHRoaXMudGFza3MuZm9yRWFjaChmdW5jdGlvbihmKSB7XG4gICAgICAgICAgICBmKClcbiAgICAgICAgICB9KTtcbiAgICAgICAgICB0aGlzLnRhc2tzID0gW107XG4gICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgIH07XG4gICAgfVxuICAgIHRoaXMucXVldWVkVGFza3MudGFza3MucHVzaCh0YXNrKTtcbiAgfSxcbiAgX2FmdGVySW5zdGFsbDogZnVuY3Rpb24odGFzaykge1xuICAgIGlmICghaW5zdGFsbGVkKSB7XG4gICAgICBpZiAoIWluc3RhbGxpbmcpIHtcbiAgICAgICAgdGhpcy5pbnN0YWxsKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHNldHRpbmcgdXAgc2llc3RhJywgZXJyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZGVsZXRlIHRoaXMucXVldWVkVGFza3M7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICB9XG4gICAgICAvLyBJbiBjYXNlIGluc3RhbGxlZCBzdHJhaWdodCBhd2F5IGUuZy4gaWYgc3RvcmFnZSBleHRlbnNpb24gbm90IGluc3RhbGxlZC5cbiAgICAgIGlmICghaW5zdGFsbGVkKSB0aGlzLl9wdXNoVGFzayh0YXNrKTtcbiAgICAgIGVsc2UgdGFzaygpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHRhc2soKTtcbiAgICB9XG4gIH0sXG4gIHNldExvZ0xldmVsOiBmdW5jdGlvbihsb2dnZXJOYW1lLCBsZXZlbCkge1xuICAgIHZhciBMb2dnZXIgPSBsb2cubG9nZ2VyV2l0aE5hbWUobG9nZ2VyTmFtZSk7XG4gICAgTG9nZ2VyLnNldExldmVsKGxldmVsKTtcbiAgfSxcbiAgZ3JhcGg6IGZ1bmN0aW9uKGRhdGEsIG9wdHMsIGNiKSB7XG4gICAgaWYgKHR5cGVvZiBvcHRzID09ICdmdW5jdGlvbicpIGNiID0gb3B0cztcbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgdmFyIHRhc2tzID0gW10sIGVycjtcbiAgICAgIGZvciAodmFyIGNvbGxlY3Rpb25OYW1lIGluIGRhdGEpIHtcbiAgICAgICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoY29sbGVjdGlvbk5hbWUpKSB7XG4gICAgICAgICAgdmFyIGNvbGxlY3Rpb24gPSBDb2xsZWN0aW9uUmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdO1xuICAgICAgICAgIGlmIChjb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICAoZnVuY3Rpb24oY29sbGVjdGlvbiwgZGF0YSkge1xuICAgICAgICAgICAgICB0YXNrcy5wdXNoKGZ1bmN0aW9uKGRvbmUpIHtcbiAgICAgICAgICAgICAgICBjb2xsZWN0aW9uLmdyYXBoKGRhdGEsIGZ1bmN0aW9uKGVyciwgcmVzKSB7XG4gICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmVzdWx0cyA9IHt9O1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRzW2NvbGxlY3Rpb24ubmFtZV0gPSByZXM7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBkb25lKGVyciwgcmVzdWx0cyk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSkoY29sbGVjdGlvbiwgZGF0YVtjb2xsZWN0aW9uTmFtZV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGVyciA9ICdObyBzdWNoIGNvbGxlY3Rpb24gXCInICsgY29sbGVjdGlvbk5hbWUgKyAnXCInO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgdXRpbC5zZXJpZXModGFza3MsIGZ1bmN0aW9uKGVyciwgcmVzdWx0cykge1xuICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICByZXN1bHRzID0gcmVzdWx0cy5yZWR1Y2UoZnVuY3Rpb24obWVtbywgcmVzKSB7XG4gICAgICAgICAgICAgIHJldHVybiB1dGlsLmV4dGVuZChtZW1vLCByZXMpO1xuICAgICAgICAgICAgfSwge30pXG4gICAgICAgICAgfSBlbHNlIHJlc3VsdHMgPSBudWxsO1xuICAgICAgICAgIGNiKGVyciwgcmVzdWx0cyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgZWxzZSBjYihlcnJvcihlcnIsIHtkYXRhOiBkYXRhLCBpbnZhbGlkQ29sbGVjdGlvbk5hbWU6IGNvbGxlY3Rpb25OYW1lfSkpO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG4gIG5vdGlmeTogdXRpbC5uZXh0LFxuICByZWdpc3RlckNvbXBhcmF0b3I6IFF1ZXJ5LnJlZ2lzdGVyQ29tcGFyYXRvci5iaW5kKFF1ZXJ5KSxcbiAgY291bnQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBjYWNoZS5jb3VudCgpO1xuICB9LFxuICBnZXQ6IGZ1bmN0aW9uKGlkLCBjYikge1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICB0aGlzLl9hZnRlckluc3RhbGwoZnVuY3Rpb24oKSB7XG4gICAgICAgIGNiKG51bGwsIGNhY2hlLl9sb2NhbENhY2hlKClbaWRdKTtcbiAgICAgIH0pO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG4gIHJlbW92ZUFsbDogZnVuY3Rpb24oY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgdXRpbC5Qcm9taXNlLmFsbChcbiAgICAgICAgQ29sbGVjdGlvblJlZ2lzdHJ5LmNvbGxlY3Rpb25OYW1lcy5tYXAoZnVuY3Rpb24oY29sbGVjdGlvbk5hbWUpIHtcbiAgICAgICAgICByZXR1cm4gQ29sbGVjdGlvblJlZ2lzdHJ5W2NvbGxlY3Rpb25OYW1lXS5yZW1vdmVBbGwoKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKVxuICAgICAgKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGNiKG51bGwpO1xuICAgICAgICB9KS5jYXRjaChjYilcbiAgICB9LmJpbmQodGhpcykpO1xuICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoc2llc3RhLCB7XG4gIF9jYW5DaGFuZ2U6IHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuICEoaW5zdGFsbGluZyB8fCBpbnN0YWxsZWQpO1xuICAgIH1cbiAgfSxcbiAgaW5zdGFsbGVkOiB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBpbnN0YWxsZWQ7XG4gICAgfVxuICB9XG59KTtcblxuaWYgKHR5cGVvZiB3aW5kb3cgIT0gJ3VuZGVmaW5lZCcpIHtcbiAgd2luZG93WydzaWVzdGEnXSA9IHNpZXN0YTtcbn1cblxuc2llc3RhLmxvZyA9IHJlcXVpcmUoJ2RlYnVnJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gc2llc3RhO1xuXG4oZnVuY3Rpb24gbG9hZEV4dGVuc2lvbnMoKSB7XG4gIHJlcXVpcmUoJy4uL3N0b3JhZ2UnKTtcbn0pKCk7XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvaW5kZXguanNcbiAqKiBtb2R1bGUgaWQgPSAwXG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgb2JzZXJ2ZSA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuUGxhdGZvcm0sXG4gIFByb21pc2UgPSByZXF1aXJlKCdsaWUnKSxcbiAgYXJnc2FycmF5ID0gcmVxdWlyZSgnYXJnc2FycmF5JyksXG4gIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcjtcblxudmFyIGV4dGVuZCA9IGZ1bmN0aW9uKGxlZnQsIHJpZ2h0KSB7XG4gIGZvciAodmFyIHByb3AgaW4gcmlnaHQpIHtcbiAgICBpZiAocmlnaHQuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgIGxlZnRbcHJvcF0gPSByaWdodFtwcm9wXTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGxlZnQ7XG59O1xuXG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXksXG4gIGlzU3RyaW5nID0gZnVuY3Rpb24obykge1xuICAgIHJldHVybiB0eXBlb2YgbyA9PSAnc3RyaW5nJyB8fCBvIGluc3RhbmNlb2YgU3RyaW5nXG4gIH07XG5cbmV4dGVuZChtb2R1bGUuZXhwb3J0cywge1xuICBhcmdzYXJyYXk6IGFyZ3NhcnJheSxcbiAgLyoqXG4gICAqIFBlcmZvcm1zIGRpcnR5IGNoZWNrL09iamVjdC5vYnNlcnZlIGNhbGxiYWNrcyBkZXBlbmRpbmcgb24gdGhlIGJyb3dzZXIuXG4gICAqXG4gICAqIElmIE9iamVjdC5vYnNlcnZlIGlzIHByZXNlbnQsXG4gICAqIEBwYXJhbSBjYWxsYmFja1xuICAgKi9cbiAgbmV4dDogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICBvYnNlcnZlLnBlcmZvcm1NaWNyb3Rhc2tDaGVja3BvaW50KCk7XG4gICAgc2V0VGltZW91dChjYWxsYmFjayk7XG4gIH0sXG4gIGV4dGVuZDogZXh0ZW5kLFxuICBndWlkOiAoZnVuY3Rpb24oKSB7XG4gICAgZnVuY3Rpb24gczQoKSB7XG4gICAgICByZXR1cm4gTWF0aC5mbG9vcigoMSArIE1hdGgucmFuZG9tKCkpICogMHgxMDAwMClcbiAgICAgICAgLnRvU3RyaW5nKDE2KVxuICAgICAgICAuc3Vic3RyaW5nKDEpO1xuICAgIH1cblxuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBzNCgpICsgczQoKSArICctJyArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICtcbiAgICAgICAgczQoKSArICctJyArIHM0KCkgKyBzNCgpICsgczQoKTtcbiAgICB9O1xuICB9KSgpLFxuICBhc3NlcnQ6IGZ1bmN0aW9uKGNvbmRpdGlvbiwgbWVzc2FnZSwgY29udGV4dCkge1xuICAgIGlmICghY29uZGl0aW9uKSB7XG4gICAgICBtZXNzYWdlID0gbWVzc2FnZSB8fCBcIkFzc2VydGlvbiBmYWlsZWRcIjtcbiAgICAgIGNvbnRleHQgPSBjb250ZXh0IHx8IHt9O1xuICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IobWVzc2FnZSwgY29udGV4dCk7XG4gICAgfVxuICB9LFxuICBwbHVjazogZnVuY3Rpb24oY29sbCwga2V5KSB7XG4gICAgcmV0dXJuIGNvbGwubWFwKGZ1bmN0aW9uKG8pIHtyZXR1cm4gb1trZXldfSk7XG4gIH0sXG4gIHRoZW5CeTogKGZ1bmN0aW9uKCkge1xuICAgIC8qIG1peGluIGZvciB0aGUgYHRoZW5CeWAgcHJvcGVydHkgKi9cbiAgICBmdW5jdGlvbiBleHRlbmQoZikge1xuICAgICAgZi50aGVuQnkgPSB0YjtcbiAgICAgIHJldHVybiBmO1xuICAgIH1cblxuICAgIC8qIGFkZHMgYSBzZWNvbmRhcnkgY29tcGFyZSBmdW5jdGlvbiB0byB0aGUgdGFyZ2V0IGZ1bmN0aW9uIChgdGhpc2AgY29udGV4dClcbiAgICAgd2hpY2ggaXMgYXBwbGllZCBpbiBjYXNlIHRoZSBmaXJzdCBvbmUgcmV0dXJucyAwIChlcXVhbClcbiAgICAgcmV0dXJucyBhIG5ldyBjb21wYXJlIGZ1bmN0aW9uLCB3aGljaCBoYXMgYSBgdGhlbkJ5YCBtZXRob2QgYXMgd2VsbCAqL1xuICAgIGZ1bmN0aW9uIHRiKHkpIHtcbiAgICAgIHZhciB4ID0gdGhpcztcbiAgICAgIHJldHVybiBleHRlbmQoZnVuY3Rpb24oYSwgYikge1xuICAgICAgICByZXR1cm4geChhLCBiKSB8fCB5KGEsIGIpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGV4dGVuZDtcbiAgfSkoKSxcbiAgLyoqXG4gICAqIFRPRE86IFRoaXMgaXMgYmxvb2R5IHVnbHkuXG4gICAqIFByZXR0eSBkYW1uIHVzZWZ1bCB0byBiZSBhYmxlIHRvIGFjY2VzcyB0aGUgYm91bmQgb2JqZWN0IG9uIGEgZnVuY3Rpb24gdGhvLlxuICAgKiBTZWU6IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMTQzMDcyNjQvd2hhdC1vYmplY3QtamF2YXNjcmlwdC1mdW5jdGlvbi1pcy1ib3VuZC10by13aGF0LWlzLWl0cy10aGlzXG4gICAqL1xuICBfcGF0Y2hCaW5kOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgX2JpbmQgPSBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHkuYmluZChGdW5jdGlvbi5wcm90b3R5cGUuYmluZCk7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KEZ1bmN0aW9uLnByb3RvdHlwZSwgJ2JpbmQnLCB7XG4gICAgICB2YWx1ZTogZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIHZhciBib3VuZEZ1bmN0aW9uID0gX2JpbmQodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGJvdW5kRnVuY3Rpb24sICdfX3NpZXN0YV9ib3VuZF9vYmplY3QnLCB7XG4gICAgICAgICAgdmFsdWU6IG9iaixcbiAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgZW51bWVyYWJsZTogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBib3VuZEZ1bmN0aW9uO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuICBQcm9taXNlOiBQcm9taXNlLFxuICBwcm9taXNlOiBmdW5jdGlvbihjYiwgZm4pIHtcbiAgICBjYiA9IGNiIHx8IGZ1bmN0aW9uKCkge307XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgdmFyIF9jYiA9IGFyZ3NhcnJheShmdW5jdGlvbihhcmdzKSB7XG4gICAgICAgIHZhciBlcnIgPSBhcmdzWzBdLFxuICAgICAgICAgIHJlc3QgPSBhcmdzLnNsaWNlKDEpO1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignVW5jYXVnaHQgZXJyb3IgZHVyaW5nIHByb21pc2UgcmVqZWN0aW9uJywgZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXNvbHZlKHJlc3RbMF0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgcmVqZWN0KGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignVW5jYXVnaHQgZXJyb3IgZHVyaW5nIHByb21pc2UgcmVqZWN0aW9uJywgZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHZhciBib3VuZCA9IGNiWydfX3NpZXN0YV9ib3VuZF9vYmplY3QnXSB8fCBjYjsgLy8gUHJlc2VydmUgYm91bmQgb2JqZWN0LlxuICAgICAgICBjYi5hcHBseShib3VuZCwgYXJncyk7XG4gICAgICB9KTtcbiAgICAgIGZuKF9jYik7XG4gICAgfSlcbiAgfSxcbiAgZGVmZXI6IGZ1bmN0aW9uKCkge1xuICAgIHZhciByZXNvbHZlLCByZWplY3Q7XG4gICAgdmFyIHAgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihfcmVzb2x2ZSwgX3JlamVjdCkge1xuICAgICAgcmVzb2x2ZSA9IF9yZXNvbHZlO1xuICAgICAgcmVqZWN0ID0gX3JlamVjdDtcbiAgICB9KTtcbiAgICAvL25vaW5zcGVjdGlvbiBKU1VudXNlZEFzc2lnbm1lbnRcbiAgICBwLnJlc29sdmUgPSByZXNvbHZlO1xuICAgIC8vbm9pbnNwZWN0aW9uIEpTVW51c2VkQXNzaWdubWVudFxuICAgIHAucmVqZWN0ID0gcmVqZWN0O1xuICAgIHJldHVybiBwO1xuICB9LFxuICBzdWJQcm9wZXJ0aWVzOiBmdW5jdGlvbihvYmosIHN1Yk9iaiwgcHJvcGVydGllcykge1xuICAgIGlmICghaXNBcnJheShwcm9wZXJ0aWVzKSkge1xuICAgICAgcHJvcGVydGllcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgfVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcGVydGllcy5sZW5ndGg7IGkrKykge1xuICAgICAgKGZ1bmN0aW9uKHByb3BlcnR5KSB7XG4gICAgICAgIHZhciBvcHRzID0ge1xuICAgICAgICAgIHNldDogZmFsc2UsXG4gICAgICAgICAgbmFtZTogcHJvcGVydHksXG4gICAgICAgICAgcHJvcGVydHk6IHByb3BlcnR5XG4gICAgICAgIH07XG4gICAgICAgIGlmICghaXNTdHJpbmcocHJvcGVydHkpKSB7XG4gICAgICAgICAgZXh0ZW5kKG9wdHMsIHByb3BlcnR5KTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgZGVzYyA9IHtcbiAgICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIHN1Yk9ialtvcHRzLnByb3BlcnR5XTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgIH07XG4gICAgICAgIGlmIChvcHRzLnNldCkge1xuICAgICAgICAgIGRlc2Muc2V0ID0gZnVuY3Rpb24odikge1xuICAgICAgICAgICAgc3ViT2JqW29wdHMucHJvcGVydHldID0gdjtcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIG9wdHMubmFtZSwgZGVzYyk7XG4gICAgICB9KShwcm9wZXJ0aWVzW2ldKTtcbiAgICB9XG4gIH0sXG4gIGNhcGl0YWxpc2VGaXJzdExldHRlcjogZnVuY3Rpb24oc3RyaW5nKSB7XG4gICAgcmV0dXJuIHN0cmluZy5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHN0cmluZy5zbGljZSgxKTtcbiAgfSxcbiAgZXh0ZW5kRnJvbU9wdHM6IGZ1bmN0aW9uKG9iaiwgb3B0cywgZGVmYXVsdHMsIGVycm9yT25Vbmtub3duKSB7XG4gICAgZXJyb3JPblVua25vd24gPSBlcnJvck9uVW5rbm93biA9PSB1bmRlZmluZWQgPyB0cnVlIDogZXJyb3JPblVua25vd247XG4gICAgaWYgKGVycm9yT25Vbmtub3duKSB7XG4gICAgICB2YXIgZGVmYXVsdEtleXMgPSBPYmplY3Qua2V5cyhkZWZhdWx0cyksXG4gICAgICAgIG9wdHNLZXlzID0gT2JqZWN0LmtleXMob3B0cyk7XG4gICAgICB2YXIgdW5rbm93bktleXMgPSBvcHRzS2V5cy5maWx0ZXIoZnVuY3Rpb24obikge1xuICAgICAgICByZXR1cm4gZGVmYXVsdEtleXMuaW5kZXhPZihuKSA9PSAtMVxuICAgICAgfSk7XG4gICAgICBpZiAodW5rbm93bktleXMubGVuZ3RoKSB0aHJvdyBFcnJvcignVW5rbm93biBvcHRpb25zOiAnICsgdW5rbm93bktleXMudG9TdHJpbmcoKSk7XG4gICAgfVxuICAgIC8vIEFwcGx5IGFueSBmdW5jdGlvbnMgc3BlY2lmaWVkIGluIHRoZSBkZWZhdWx0cy5cbiAgICBPYmplY3Qua2V5cyhkZWZhdWx0cykuZm9yRWFjaChmdW5jdGlvbihrKSB7XG4gICAgICB2YXIgZCA9IGRlZmF1bHRzW2tdO1xuICAgICAgaWYgKHR5cGVvZiBkID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgZGVmYXVsdHNba10gPSBkKG9wdHNba10pO1xuICAgICAgICBkZWxldGUgb3B0c1trXTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBleHRlbmQoZGVmYXVsdHMsIG9wdHMpO1xuICAgIGV4dGVuZChvYmosIGRlZmF1bHRzKTtcbiAgfSxcbiAgaXNTdHJpbmc6IGlzU3RyaW5nLFxuICBpc0FycmF5OiBpc0FycmF5LFxuICBwcmV0dHlQcmludDogZnVuY3Rpb24obykge1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShvLCBudWxsLCA0KTtcbiAgfSxcbiAgZmxhdHRlbkFycmF5OiBmdW5jdGlvbihhcnIpIHtcbiAgICByZXR1cm4gYXJyLnJlZHVjZShmdW5jdGlvbihtZW1vLCBlKSB7XG4gICAgICBpZiAoaXNBcnJheShlKSkge1xuICAgICAgICBtZW1vID0gbWVtby5jb25jYXQoZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBtZW1vLnB1c2goZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbWVtbztcbiAgICB9LCBbXSk7XG4gIH0sXG4gIHVuZmxhdHRlbkFycmF5OiBmdW5jdGlvbihhcnIsIG1vZGVsQXJyKSB7XG4gICAgdmFyIG4gPSAwO1xuICAgIHZhciB1bmZsYXR0ZW5lZCA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbW9kZWxBcnIubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChpc0FycmF5KG1vZGVsQXJyW2ldKSkge1xuICAgICAgICB2YXIgbmV3QXJyID0gW107XG4gICAgICAgIHVuZmxhdHRlbmVkW2ldID0gbmV3QXJyO1xuICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IG1vZGVsQXJyW2ldLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgbmV3QXJyLnB1c2goYXJyW25dKTtcbiAgICAgICAgICBuKys7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHVuZmxhdHRlbmVkW2ldID0gYXJyW25dO1xuICAgICAgICBuKys7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB1bmZsYXR0ZW5lZDtcbiAgfVxufSk7XG5cbi8qKlxuICogQ29tcGFjdCBhIHNwYXJzZSBhcnJheVxuICogQHBhcmFtIGFyclxuICogQHJldHVybnMge0FycmF5fVxuICovXG5mdW5jdGlvbiBjb21wYWN0KGFycikge1xuICBhcnIgPSBhcnIgfHwgW107XG4gIHJldHVybiBhcnIuZmlsdGVyKGZ1bmN0aW9uKHgpIHtyZXR1cm4geH0pO1xufVxuXG4vKipcbiAqIEV4ZWN1dGUgdGFza3MgaW4gcGFyYWxsZWxcbiAqIEBwYXJhbSB0YXNrc1xuICogQHBhcmFtIGNiXG4gKi9cbmZ1bmN0aW9uIHBhcmFsbGVsKHRhc2tzLCBjYikge1xuICBjYiA9IGNiIHx8IGZ1bmN0aW9uKCkge307XG4gIGlmICh0YXNrcyAmJiB0YXNrcy5sZW5ndGgpIHtcbiAgICB2YXIgcmVzdWx0cyA9IFtdLCBlcnJvcnMgPSBbXSwgbnVtRmluaXNoZWQgPSAwO1xuICAgIHRhc2tzLmZvckVhY2goZnVuY3Rpb24oZm4sIGlkeCkge1xuICAgICAgcmVzdWx0c1tpZHhdID0gZmFsc2U7XG4gICAgICBmbihmdW5jdGlvbihlcnIsIHJlcykge1xuICAgICAgICBudW1GaW5pc2hlZCsrO1xuICAgICAgICBpZiAoZXJyKSBlcnJvcnNbaWR4XSA9IGVycjtcbiAgICAgICAgcmVzdWx0c1tpZHhdID0gcmVzO1xuICAgICAgICBpZiAobnVtRmluaXNoZWQgPT0gdGFza3MubGVuZ3RoKSB7XG4gICAgICAgICAgY2IoXG4gICAgICAgICAgICBlcnJvcnMubGVuZ3RoID8gY29tcGFjdChlcnJvcnMpIDogbnVsbCxcbiAgICAgICAgICAgIGNvbXBhY3QocmVzdWx0cyksXG4gICAgICAgICAgICB7cmVzdWx0czogcmVzdWx0cywgZXJyb3JzOiBlcnJvcnN9XG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH0gZWxzZSBjYigpO1xufVxuXG4vKipcbiAqIEV4ZWN1dGUgdGFza3Mgb25lIGFmdGVyIGFub3RoZXJcbiAqIEBwYXJhbSB0YXNrc1xuICogQHBhcmFtIGNiXG4gKi9cbmZ1bmN0aW9uIHNlcmllcyh0YXNrcywgY2IpIHtcbiAgY2IgPSBjYiB8fCBmdW5jdGlvbigpIHt9O1xuICBpZiAodGFza3MgJiYgdGFza3MubGVuZ3RoKSB7XG4gICAgdmFyIHJlc3VsdHMgPSBbXSwgZXJyb3JzID0gW10sIGlkeCA9IDA7XG5cbiAgICBmdW5jdGlvbiBleGVjdXRlVGFzayh0YXNrKSB7XG4gICAgICB0YXNrKGZ1bmN0aW9uKGVyciwgcmVzKSB7XG4gICAgICAgIGlmIChlcnIpIGVycm9yc1tpZHhdID0gZXJyO1xuICAgICAgICByZXN1bHRzW2lkeF0gPSByZXM7XG4gICAgICAgIGlmICghdGFza3MubGVuZ3RoKSB7XG4gICAgICAgICAgY2IoXG4gICAgICAgICAgICBlcnJvcnMubGVuZ3RoID8gY29tcGFjdChlcnJvcnMpIDogbnVsbCxcbiAgICAgICAgICAgIGNvbXBhY3QocmVzdWx0cyksXG4gICAgICAgICAgICB7cmVzdWx0czogcmVzdWx0cywgZXJyb3JzOiBlcnJvcnN9XG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBpZHgrKztcbiAgICAgICAgICBuZXh0VGFzaygpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBuZXh0VGFzaygpIHtcbiAgICAgIHZhciBuZXh0VGFzayA9IHRhc2tzLnNoaWZ0KCk7XG4gICAgICBleGVjdXRlVGFzayhuZXh0VGFzayk7XG4gICAgfVxuXG4gICAgbmV4dFRhc2soKTtcblxuICB9IGVsc2UgY2IoKTtcbn1cblxuXG5leHRlbmQobW9kdWxlLmV4cG9ydHMsIHtcbiAgY29tcGFjdDogY29tcGFjdCxcbiAgcGFyYWxsZWw6IHBhcmFsbGVsLFxuICBzZXJpZXM6IHNlcmllc1xufSk7XG5cbnZhciBGTl9BUkdTID0gL15mdW5jdGlvblxccypbXlxcKF0qXFwoXFxzKihbXlxcKV0qKVxcKS9tLFxuICBGTl9BUkdfU1BMSVQgPSAvLC8sXG4gIEZOX0FSRyA9IC9eXFxzKihfPykoLis/KVxcMVxccyokLyxcbiAgU1RSSVBfQ09NTUVOVFMgPSAvKChcXC9cXC8uKiQpfChcXC9cXCpbXFxzXFxTXSo/XFwqXFwvKSkvbWc7XG5cbmV4dGVuZChtb2R1bGUuZXhwb3J0cywge1xuICAvKipcbiAgICogUmV0dXJuIHRoZSBwYXJhbWV0ZXIgbmFtZXMgb2YgYSBmdW5jdGlvbi5cbiAgICogTm90ZTogYWRhcHRlZCBmcm9tIEFuZ3VsYXJKUyBkZXBlbmRlbmN5IGluamVjdGlvbiA6KVxuICAgKiBAcGFyYW0gZm5cbiAgICovXG4gIHBhcmFtTmFtZXM6IGZ1bmN0aW9uKGZuKSB7XG4gICAgLy8gVE9ETzogSXMgdGhlcmUgYSBtb3JlIHJvYnVzdCB3YXkgb2YgZG9pbmcgdGhpcz9cbiAgICB2YXIgcGFyYW1zID0gW10sXG4gICAgICBmblRleHQsXG4gICAgICBhcmdEZWNsO1xuICAgIGZuVGV4dCA9IGZuLnRvU3RyaW5nKCkucmVwbGFjZShTVFJJUF9DT01NRU5UUywgJycpO1xuICAgIGFyZ0RlY2wgPSBmblRleHQubWF0Y2goRk5fQVJHUyk7XG5cbiAgICBhcmdEZWNsWzFdLnNwbGl0KEZOX0FSR19TUExJVCkuZm9yRWFjaChmdW5jdGlvbihhcmcpIHtcbiAgICAgIGFyZy5yZXBsYWNlKEZOX0FSRywgZnVuY3Rpb24oYWxsLCB1bmRlcnNjb3JlLCBuYW1lKSB7XG4gICAgICAgIHBhcmFtcy5wdXNoKG5hbWUpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHBhcmFtcztcbiAgfVxufSk7XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvdXRpbC5qc1xuICoqIG1vZHVsZSBpZCA9IDFcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG5cbmZ1bmN0aW9uIENvbGxlY3Rpb25SZWdpc3RyeSgpIHtcbiAgaWYgKCF0aGlzKSByZXR1cm4gbmV3IENvbGxlY3Rpb25SZWdpc3RyeSgpO1xuICB0aGlzLmNvbGxlY3Rpb25OYW1lcyA9IFtdO1xufVxuXG51dGlsLmV4dGVuZChDb2xsZWN0aW9uUmVnaXN0cnkucHJvdG90eXBlLCB7XG4gIHJlZ2lzdGVyOiBmdW5jdGlvbihjb2xsZWN0aW9uKSB7XG4gICAgdmFyIG5hbWUgPSBjb2xsZWN0aW9uLm5hbWU7XG4gICAgdGhpc1tuYW1lXSA9IGNvbGxlY3Rpb247XG4gICAgdGhpcy5jb2xsZWN0aW9uTmFtZXMucHVzaChuYW1lKTtcbiAgfSxcbiAgcmVzZXQ6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB0aGlzLmNvbGxlY3Rpb25OYW1lcy5mb3JFYWNoKGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIGRlbGV0ZSBzZWxmW25hbWVdO1xuICAgIH0pO1xuICAgIHRoaXMuY29sbGVjdGlvbk5hbWVzID0gW107XG4gIH1cbn0pO1xuXG5leHBvcnRzLkNvbGxlY3Rpb25SZWdpc3RyeSA9IG5ldyBDb2xsZWN0aW9uUmVnaXN0cnkoKTtcblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9jb2xsZWN0aW9uUmVnaXN0cnkuanNcbiAqKiBtb2R1bGUgaWQgPSAyXG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSgnY29sbGVjdGlvbicpLFxuICBDb2xsZWN0aW9uUmVnaXN0cnkgPSByZXF1aXJlKCcuL2NvbGxlY3Rpb25SZWdpc3RyeScpLkNvbGxlY3Rpb25SZWdpc3RyeSxcbiAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICBNb2RlbCA9IHJlcXVpcmUoJy4vbW9kZWwnKSxcbiAgZXh0ZW5kID0gcmVxdWlyZSgnZXh0ZW5kJyksXG4gIG9ic2VydmUgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLlBsYXRmb3JtLFxuICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICBhcmdzYXJyYXkgPSByZXF1aXJlKCdhcmdzYXJyYXknKSxcbiAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyk7XG5cblxuLyoqXG4gKiBBIGNvbGxlY3Rpb24gZGVzY3JpYmVzIGEgc2V0IG9mIG1vZGVscyBhbmQgb3B0aW9uYWxseSBhIFJFU1QgQVBJIHdoaWNoIHdlIHdvdWxkXG4gKiBsaWtlIHRvIG1vZGVsLlxuICpcbiAqIEBwYXJhbSBuYW1lXG4gKiBAcGFyYW0gb3B0c1xuICogQGNvbnN0cnVjdG9yXG4gKlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGBqc1xuICogdmFyIEdpdEh1YiA9IG5ldyBzaWVzdGEoJ0dpdEh1YicpXG4gKiAvLyAuLi4gY29uZmlndXJlIG1hcHBpbmdzLCBkZXNjcmlwdG9ycyBldGMgLi4uXG4gKiBHaXRIdWIuaW5zdGFsbChmdW5jdGlvbiAoKSB7XG4gICAgICogICAgIC8vIC4uLiBjYXJyeSBvbi5cbiAgICAgKiB9KTtcbiAqIGBgYFxuICovXG5mdW5jdGlvbiBDb2xsZWN0aW9uKG5hbWUsIG9wdHMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBpZiAoIW5hbWUpIHRocm93IG5ldyBFcnJvcignQ29sbGVjdGlvbiBtdXN0IGhhdmUgYSBuYW1lJyk7XG5cbiAgb3B0cyA9IG9wdHMgfHwge307XG4gIHV0aWwuZXh0ZW5kRnJvbU9wdHModGhpcywgb3B0cywge30pO1xuXG4gIHV0aWwuZXh0ZW5kKHRoaXMsIHtcbiAgICBuYW1lOiBuYW1lLFxuICAgIF9yYXdNb2RlbHM6IHt9LFxuICAgIF9tb2RlbHM6IHt9LFxuICAgIF9vcHRzOiBvcHRzLFxuICAgIGluc3RhbGxlZDogZmFsc2VcbiAgfSk7XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXModGhpcywge1xuICAgIGRpcnR5OiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkge1xuICAgICAgICAgIHZhciB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbiA9IHNpZXN0YS5leHQuc3RvcmFnZS5fdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24sXG4gICAgICAgICAgICBoYXNoID0gdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bc2VsZi5uYW1lXSB8fCB7fTtcbiAgICAgICAgICByZXR1cm4gISFPYmplY3Qua2V5cyhoYXNoKS5sZW5ndGg7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgfSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9XG4gIH0pO1xuXG4gIENvbGxlY3Rpb25SZWdpc3RyeS5yZWdpc3Rlcih0aGlzKTtcbiAgdGhpcy5fbWFrZUF2YWlsYWJsZU9uUm9vdCgpO1xuICBldmVudHMuUHJveHlFdmVudEVtaXR0ZXIuY2FsbCh0aGlzLCB0aGlzLm5hbWUpO1xufVxuXG5Db2xsZWN0aW9uLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoZXZlbnRzLlByb3h5RXZlbnRFbWl0dGVyLnByb3RvdHlwZSk7XG5cbnV0aWwuZXh0ZW5kKENvbGxlY3Rpb24ucHJvdG90eXBlLCB7XG4gIF9nZXRNb2RlbHNUb0luc3RhbGw6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBtb2RlbHNUb0luc3RhbGwgPSBbXTtcbiAgICBmb3IgKHZhciBuYW1lIGluIHRoaXMuX21vZGVscykge1xuICAgICAgaWYgKHRoaXMuX21vZGVscy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICB2YXIgbW9kZWwgPSB0aGlzLl9tb2RlbHNbbmFtZV07XG4gICAgICAgIG1vZGVsc1RvSW5zdGFsbC5wdXNoKG1vZGVsKTtcbiAgICAgIH1cbiAgICB9XG4gICAgbG9nKCdUaGVyZSBhcmUgJyArIG1vZGVsc1RvSW5zdGFsbC5sZW5ndGgudG9TdHJpbmcoKSArICcgbWFwcGluZ3MgdG8gaW5zdGFsbCcpO1xuICAgIHJldHVybiBtb2RlbHNUb0luc3RhbGw7XG4gIH0sXG4gIC8qKlxuICAgKiBNZWFucyB0aGF0IHdlIGNhbiBhY2Nlc3MgdGhlIGNvbGxlY3Rpb24gb24gdGhlIHNpZXN0YSBvYmplY3QuXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfbWFrZUF2YWlsYWJsZU9uUm9vdDogZnVuY3Rpb24oKSB7XG4gICAgc2llc3RhW3RoaXMubmFtZV0gPSB0aGlzO1xuICB9LFxuICAvKipcbiAgICogRW5zdXJlIG1hcHBpbmdzIGFyZSBpbnN0YWxsZWQuXG4gICAqIEBwYXJhbSBbY2JdXG4gICAqIEBjbGFzcyBDb2xsZWN0aW9uXG4gICAqL1xuICBpbnN0YWxsOiBmdW5jdGlvbihjYikge1xuICAgIHZhciBtb2RlbHNUb0luc3RhbGwgPSB0aGlzLl9nZXRNb2RlbHNUb0luc3RhbGwoKTtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgaWYgKCF0aGlzLmluc3RhbGxlZCkge1xuICAgICAgICB0aGlzLmluc3RhbGxlZCA9IHRydWU7XG4gICAgICAgIHZhciBlcnJvcnMgPSBbXTtcbiAgICAgICAgbW9kZWxzVG9JbnN0YWxsLmZvckVhY2goZnVuY3Rpb24obSkge1xuICAgICAgICAgIGxvZygnSW5zdGFsbGluZyByZWxhdGlvbnNoaXBzIGZvciBtYXBwaW5nIHdpdGggbmFtZSBcIicgKyBtLm5hbWUgKyAnXCInKTtcbiAgICAgICAgICB2YXIgZXJyID0gbS5pbnN0YWxsUmVsYXRpb25zaGlwcygpO1xuICAgICAgICAgIGlmIChlcnIpIGVycm9ycy5wdXNoKGVycik7XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoIWVycm9ycy5sZW5ndGgpIHtcbiAgICAgICAgICBtb2RlbHNUb0luc3RhbGwuZm9yRWFjaChmdW5jdGlvbihtKSB7XG4gICAgICAgICAgICBsb2coJ0luc3RhbGxpbmcgcmV2ZXJzZSByZWxhdGlvbnNoaXBzIGZvciBtYXBwaW5nIHdpdGggbmFtZSBcIicgKyBtLm5hbWUgKyAnXCInKTtcbiAgICAgICAgICAgIHZhciBlcnIgPSBtLmluc3RhbGxSZXZlcnNlUmVsYXRpb25zaGlwcygpO1xuICAgICAgICAgICAgaWYgKGVycikgZXJyb3JzLnB1c2goZXJyKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBpZiAoIWVycm9ycy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRoaXMuaW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuX21ha2VBdmFpbGFibGVPblJvb3QoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY2IoZXJyb3JzLmxlbmd0aCA/IGVycm9yKCdFcnJvcnMgd2VyZSBlbmNvdW50ZXJlZCB3aGlsc3Qgc2V0dGluZyB1cCB0aGUgY29sbGVjdGlvbicsIHtlcnJvcnM6IGVycm9yc30pIDogbnVsbCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignQ29sbGVjdGlvbiBcIicgKyB0aGlzLm5hbWUgKyAnXCIgaGFzIGFscmVhZHkgYmVlbiBpbnN0YWxsZWQnKTtcbiAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuXG4gIF9tb2RlbDogZnVuY3Rpb24obmFtZSwgb3B0cykge1xuICAgIGlmIChuYW1lKSB7XG4gICAgICB0aGlzLl9yYXdNb2RlbHNbbmFtZV0gPSBvcHRzO1xuICAgICAgb3B0cyA9IGV4dGVuZCh0cnVlLCB7fSwgb3B0cyk7XG4gICAgICBvcHRzLm5hbWUgPSBuYW1lO1xuICAgICAgb3B0cy5jb2xsZWN0aW9uID0gdGhpcztcbiAgICAgIHZhciBtb2RlbCA9IG5ldyBNb2RlbChvcHRzKTtcbiAgICAgIHRoaXMuX21vZGVsc1tuYW1lXSA9IG1vZGVsO1xuICAgICAgdGhpc1tuYW1lXSA9IG1vZGVsO1xuICAgICAgaWYgKHRoaXMuaW5zdGFsbGVkKSB7XG4gICAgICAgIHZhciBlcnJvciA9IG1vZGVsLmluc3RhbGxSZWxhdGlvbnNoaXBzKCk7XG4gICAgICAgIGlmICghZXJyb3IpIGVycm9yID0gbW9kZWwuaW5zdGFsbFJldmVyc2VSZWxhdGlvbnNoaXBzKCk7XG4gICAgICAgIGlmIChlcnJvcikgIHRocm93IGVycm9yO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG1vZGVsO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTm8gbmFtZSBzcGVjaWZpZWQgd2hlbiBjcmVhdGluZyBtYXBwaW5nJyk7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBSZWdpc3RlcnMgYSBtb2RlbCB3aXRoIHRoaXMgY29sbGVjdGlvbi5cbiAgICovXG4gIG1vZGVsOiBhcmdzYXJyYXkoZnVuY3Rpb24oYXJncykge1xuICAgIGlmIChhcmdzLmxlbmd0aCkge1xuICAgICAgaWYgKGFyZ3MubGVuZ3RoID09IDEpIHtcbiAgICAgICAgaWYgKHV0aWwuaXNBcnJheShhcmdzWzBdKSkge1xuICAgICAgICAgIHJldHVybiBhcmdzWzBdLm1hcChmdW5jdGlvbihtKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fbW9kZWwobS5uYW1lLCBtKTtcbiAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciBuYW1lLCBvcHRzO1xuICAgICAgICAgIGlmICh1dGlsLmlzU3RyaW5nKGFyZ3NbMF0pKSB7XG4gICAgICAgICAgICBuYW1lID0gYXJnc1swXTtcbiAgICAgICAgICAgIG9wdHMgPSB7fTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBvcHRzID0gYXJnc1swXTtcbiAgICAgICAgICAgIG5hbWUgPSBvcHRzLm5hbWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB0aGlzLl9tb2RlbChuYW1lLCBvcHRzKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHR5cGVvZiBhcmdzWzBdID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuX21vZGVsKGFyZ3NbMF0sIGFyZ3NbMV0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBhcmdzLm1hcChmdW5jdGlvbihtKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fbW9kZWwobS5uYW1lLCBtKTtcbiAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG4gIH0pLFxuXG4gIC8qKlxuICAgKiBEdW1wIHRoaXMgY29sbGVjdGlvbiBhcyBKU09OXG4gICAqIEBwYXJhbSAge0Jvb2xlYW59IGFzSnNvbiBXaGV0aGVyIG9yIG5vdCB0byBhcHBseSBKU09OLnN0cmluZ2lmeVxuICAgKiBAcmV0dXJuIHtTdHJpbmd8T2JqZWN0fVxuICAgKiBAY2xhc3MgQ29sbGVjdGlvblxuICAgKi9cbiAgX2R1bXA6IGZ1bmN0aW9uKGFzSnNvbikge1xuICAgIHZhciBvYmogPSB7fTtcbiAgICBvYmouaW5zdGFsbGVkID0gdGhpcy5pbnN0YWxsZWQ7XG4gICAgb2JqLmRvY0lkID0gdGhpcy5fZG9jSWQ7XG4gICAgb2JqLm5hbWUgPSB0aGlzLm5hbWU7XG4gICAgcmV0dXJuIGFzSnNvbiA/IHV0aWwucHJldHR5UHJpbnQob2JqKSA6IG9iajtcbiAgfSxcblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgbnVtYmVyIG9mIG9iamVjdHMgaW4gdGhpcyBjb2xsZWN0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0gY2JcbiAgICogQHJldHVybnMge1Byb21pc2V9XG4gICAqL1xuICBjb3VudDogZnVuY3Rpb24oY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgdmFyIHRhc2tzID0gT2JqZWN0LmtleXModGhpcy5fbW9kZWxzKS5tYXAoZnVuY3Rpb24obW9kZWxOYW1lKSB7XG4gICAgICAgIHZhciBtID0gdGhpcy5fbW9kZWxzW21vZGVsTmFtZV07XG4gICAgICAgIHJldHVybiBtLmNvdW50LmJpbmQobSk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgdXRpbC5wYXJhbGxlbCh0YXNrcywgZnVuY3Rpb24oZXJyLCBucykge1xuICAgICAgICB2YXIgbjtcbiAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICBuID0gbnMucmVkdWNlKGZ1bmN0aW9uKG0sIHIpIHtcbiAgICAgICAgICAgIHJldHVybiBtICsgclxuICAgICAgICAgIH0sIDApO1xuICAgICAgICB9XG4gICAgICAgIGNiKGVyciwgbik7XG4gICAgICB9KTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuXG4gIGdyYXBoOiBmdW5jdGlvbihkYXRhLCBvcHRzLCBjYikge1xuICAgIGlmICh0eXBlb2Ygb3B0cyA9PSAnZnVuY3Rpb24nKSBjYiA9IG9wdHM7XG4gICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIHZhciB0YXNrcyA9IFtdLCBlcnI7XG4gICAgICBmb3IgKHZhciBtb2RlbE5hbWUgaW4gZGF0YSkge1xuICAgICAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eShtb2RlbE5hbWUpKSB7XG4gICAgICAgICAgdmFyIG1vZGVsID0gdGhpcy5fbW9kZWxzW21vZGVsTmFtZV07XG4gICAgICAgICAgaWYgKG1vZGVsKSB7XG4gICAgICAgICAgICAoZnVuY3Rpb24obW9kZWwsIGRhdGEpIHtcbiAgICAgICAgICAgICAgdGFza3MucHVzaChmdW5jdGlvbihkb25lKSB7XG4gICAgICAgICAgICAgICAgbW9kZWwuZ3JhcGgoZGF0YSwgZnVuY3Rpb24oZXJyLCBtb2RlbHMpIHtcbiAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciByZXN1bHRzID0ge307XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHNbbW9kZWwubmFtZV0gPSBtb2RlbHM7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBkb25lKGVyciwgcmVzdWx0cyk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSkobW9kZWwsIGRhdGFbbW9kZWxOYW1lXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgZXJyID0gJ05vIHN1Y2ggbW9kZWwgXCInICsgbW9kZWxOYW1lICsgJ1wiJztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICghZXJyKSB7XG4gICAgICAgIHV0aWwuc2VyaWVzKHRhc2tzLCBmdW5jdGlvbihlcnIsIHJlc3VsdHMpIHtcbiAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgcmVzdWx0cyA9IHJlc3VsdHMucmVkdWNlKGZ1bmN0aW9uKG1lbW8sIHJlcykge1xuICAgICAgICAgICAgICByZXR1cm4gdXRpbC5leHRlbmQobWVtbywgcmVzIHx8IHt9KTtcbiAgICAgICAgICAgIH0sIHt9KVxuICAgICAgICAgIH0gZWxzZSByZXN1bHRzID0gbnVsbDtcbiAgICAgICAgICBjYihlcnIsIHJlc3VsdHMpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGVsc2UgY2IoZXJyb3IoZXJyLCB7ZGF0YTogZGF0YSwgaW52YWxpZE1vZGVsTmFtZTogbW9kZWxOYW1lfSkpO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG5cbiAgcmVtb3ZlQWxsOiBmdW5jdGlvbihjYikge1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICB1dGlsLlByb21pc2UuYWxsKFxuICAgICAgICBPYmplY3Qua2V5cyh0aGlzLl9tb2RlbHMpLm1hcChmdW5jdGlvbihtb2RlbE5hbWUpIHtcbiAgICAgICAgICB2YXIgbW9kZWwgPSB0aGlzLl9tb2RlbHNbbW9kZWxOYW1lXTtcbiAgICAgICAgICByZXR1cm4gbW9kZWwucmVtb3ZlQWxsKCk7XG4gICAgICAgIH0uYmluZCh0aGlzKSlcbiAgICAgICkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICBjYihudWxsKTtcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGNiKVxuICAgIH0uYmluZCh0aGlzKSk7XG4gIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IENvbGxlY3Rpb247XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvY29sbGVjdGlvbi5qc1xuICoqIG1vZHVsZSBpZCA9IDNcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIi8qKlxuICogVGhpcyBpcyBhbiBpbi1tZW1vcnkgY2FjaGUgZm9yIG1vZGVscy4gTW9kZWxzIGFyZSBjYWNoZWQgYnkgbG9jYWwgaWQgKF9pZCkgYW5kIHJlbW90ZSBpZCAoZGVmaW5lZCBieSB0aGUgbWFwcGluZykuXG4gKiBMb29rdXBzIGFyZSBwZXJmb3JtZWQgYWdhaW5zdCB0aGUgY2FjaGUgd2hlbiBtYXBwaW5nLlxuICogQG1vZHVsZSBjYWNoZVxuICovXG52YXIgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSgnY2FjaGUnKSxcbiAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG5cblxuZnVuY3Rpb24gQ2FjaGUoKSB7XG4gIHRoaXMucmVzZXQoKTtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdfbG9jYWxDYWNoZUJ5VHlwZScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMubG9jYWw7XG4gICAgfVxuICB9KTtcbn1cblxuQ2FjaGUucHJvdG90eXBlID0ge1xuICByZXNldDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZW1vdGUgPSB7fTtcbiAgICB0aGlzLmxvY2FsQnlJZCA9IHt9O1xuICAgIHRoaXMubG9jYWwgPSB7fTtcbiAgfSxcbiAgLyoqXG4gICAqIFJldHVybiB0aGUgb2JqZWN0IGluIHRoZSBjYWNoZSBnaXZlbiBhIGxvY2FsIGlkIChfaWQpXG4gICAqIEBwYXJhbSAge1N0cmluZ3xBcnJheX0gbG9jYWxJZFxuICAgKiBAcmV0dXJuIHtNb2RlbEluc3RhbmNlfVxuICAgKi9cbiAgZ2V0VmlhTG9jYWxJZDogZnVuY3Rpb24gZ2V0VmlhTG9jYWxJZChsb2NhbElkKSB7XG4gICAgaWYgKHV0aWwuaXNBcnJheShsb2NhbElkKSkgcmV0dXJuIGxvY2FsSWQubWFwKGZ1bmN0aW9uKHgpIHtyZXR1cm4gdGhpcy5sb2NhbEJ5SWRbeF19LmJpbmQodGhpcykpO1xuICAgIGVsc2UgcmV0dXJuIHRoaXMubG9jYWxCeUlkW2xvY2FsSWRdO1xuICB9LFxuICAvKipcbiAgICogR2l2ZW4gYSByZW1vdGUgaWRlbnRpZmllciBhbmQgYW4gb3B0aW9ucyBvYmplY3QgdGhhdCBkZXNjcmliZXMgbWFwcGluZy9jb2xsZWN0aW9uLFxuICAgKiByZXR1cm4gdGhlIG1vZGVsIGlmIGNhY2hlZC5cbiAgICogQHBhcmFtICB7U3RyaW5nfEFycmF5fSByZW1vdGVJZFxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG9wdHNcbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRzLm1vZGVsXG4gICAqIEByZXR1cm4ge01vZGVsSW5zdGFuY2V9XG4gICAqL1xuICBnZXRWaWFSZW1vdGVJZDogZnVuY3Rpb24ocmVtb3RlSWQsIG9wdHMpIHtcbiAgICB2YXIgYyA9ICh0aGlzLnJlbW90ZVtvcHRzLm1vZGVsLmNvbGxlY3Rpb25OYW1lXSB8fCB7fSlbb3B0cy5tb2RlbC5uYW1lXSB8fCB7fTtcbiAgICByZXR1cm4gdXRpbC5pc0FycmF5KHJlbW90ZUlkKSA/IHJlbW90ZUlkLm1hcChmdW5jdGlvbih4KSB7cmV0dXJuIGNbeF19KSA6IGNbcmVtb3RlSWRdO1xuICB9LFxuICAvKipcbiAgICogUmV0dXJuIHRoZSBzaW5nbGV0b24gb2JqZWN0IGdpdmVuIGEgc2luZ2xldG9uIG1vZGVsLlxuICAgKiBAcGFyYW0gIHtNb2RlbH0gbW9kZWxcbiAgICogQHJldHVybiB7TW9kZWxJbnN0YW5jZX1cbiAgICovXG4gIGdldFNpbmdsZXRvbjogZnVuY3Rpb24obW9kZWwpIHtcbiAgICB2YXIgbW9kZWxOYW1lID0gbW9kZWwubmFtZTtcbiAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBtb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgICB2YXIgY29sbGVjdGlvbkNhY2hlID0gdGhpcy5sb2NhbFtjb2xsZWN0aW9uTmFtZV07XG4gICAgaWYgKGNvbGxlY3Rpb25DYWNoZSkge1xuICAgICAgdmFyIHR5cGVDYWNoZSA9IGNvbGxlY3Rpb25DYWNoZVttb2RlbE5hbWVdO1xuICAgICAgaWYgKHR5cGVDYWNoZSkge1xuICAgICAgICB2YXIgb2JqcyA9IFtdO1xuICAgICAgICBmb3IgKHZhciBwcm9wIGluIHR5cGVDYWNoZSkge1xuICAgICAgICAgIGlmICh0eXBlQ2FjaGUuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgICAgIG9ianMucHVzaCh0eXBlQ2FjaGVbcHJvcF0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAob2Jqcy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgdmFyIGVyclN0ciA9ICdBIHNpbmdsZXRvbiBtb2RlbCBoYXMgbW9yZSB0aGFuIDEgb2JqZWN0IGluIHRoZSBjYWNoZSEgVGhpcyBpcyBhIHNlcmlvdXMgZXJyb3IuICcgK1xuICAgICAgICAgICAgJ0VpdGhlciBhIG1vZGVsIGhhcyBiZWVuIG1vZGlmaWVkIGFmdGVyIG9iamVjdHMgaGF2ZSBhbHJlYWR5IGJlZW4gY3JlYXRlZCwgb3Igc29tZXRoaW5nIGhhcyBnb25lJyArXG4gICAgICAgICAgICAndmVyeSB3cm9uZy4gUGxlYXNlIGZpbGUgYSBidWcgcmVwb3J0IGlmIHRoZSBsYXR0ZXIuJztcbiAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihlcnJTdHIpO1xuICAgICAgICB9IGVsc2UgaWYgKG9ianMubGVuZ3RoKSB7XG4gICAgICAgICAgcmV0dXJuIG9ianNbMF07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG4gIC8qKlxuICAgKiBJbnNlcnQgYW4gb2JqZWN0IGludG8gdGhlIGNhY2hlIHVzaW5nIGEgcmVtb3RlIGlkZW50aWZpZXIgZGVmaW5lZCBieSB0aGUgbWFwcGluZy5cbiAgICogQHBhcmFtICB7TW9kZWxJbnN0YW5jZX0gb2JqXG4gICAqIEBwYXJhbSAge1N0cmluZ30gcmVtb3RlSWRcbiAgICogQHBhcmFtICB7U3RyaW5nfSBbcHJldmlvdXNSZW1vdGVJZF0gSWYgcmVtb3RlIGlkIGhhcyBiZWVuIGNoYW5nZWQsIHRoaXMgaXMgdGhlIG9sZCByZW1vdGUgaWRlbnRpZmllclxuICAgKi9cbiAgcmVtb3RlSW5zZXJ0OiBmdW5jdGlvbihvYmosIHJlbW90ZUlkLCBwcmV2aW91c1JlbW90ZUlkKSB7XG4gICAgaWYgKG9iaikge1xuICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gb2JqLm1vZGVsLmNvbGxlY3Rpb25OYW1lO1xuICAgICAgaWYgKGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICAgIGlmICghdGhpcy5yZW1vdGVbY29sbGVjdGlvbk5hbWVdKSB7XG4gICAgICAgICAgdGhpcy5yZW1vdGVbY29sbGVjdGlvbk5hbWVdID0ge307XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHR5cGUgPSBvYmoubW9kZWwubmFtZTtcbiAgICAgICAgaWYgKHR5cGUpIHtcbiAgICAgICAgICBpZiAoIXRoaXMucmVtb3RlW2NvbGxlY3Rpb25OYW1lXVt0eXBlXSkge1xuICAgICAgICAgICAgdGhpcy5yZW1vdGVbY29sbGVjdGlvbk5hbWVdW3R5cGVdID0ge307XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChwcmV2aW91c1JlbW90ZUlkKSB7XG4gICAgICAgICAgICB0aGlzLnJlbW90ZVtjb2xsZWN0aW9uTmFtZV1bdHlwZV1bcHJldmlvdXNSZW1vdGVJZF0gPSBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgICB2YXIgY2FjaGVkT2JqZWN0ID0gdGhpcy5yZW1vdGVbY29sbGVjdGlvbk5hbWVdW3R5cGVdW3JlbW90ZUlkXTtcbiAgICAgICAgICBpZiAoIWNhY2hlZE9iamVjdCkge1xuICAgICAgICAgICAgdGhpcy5yZW1vdGVbY29sbGVjdGlvbk5hbWVdW3R5cGVdW3JlbW90ZUlkXSA9IG9iajtcbiAgICAgICAgICAgIGxvZygnUmVtb3RlIGNhY2hlIGluc2VydDogJyArIG9iai5fZHVtcCh0cnVlKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFNvbWV0aGluZyBoYXMgZ29uZSByZWFsbHkgd3JvbmcuIE9ubHkgb25lIG9iamVjdCBmb3IgYSBwYXJ0aWN1bGFyIGNvbGxlY3Rpb24vdHlwZS9yZW1vdGVpZCBjb21ib1xuICAgICAgICAgICAgLy8gc2hvdWxkIGV2ZXIgZXhpc3QuXG4gICAgICAgICAgICBpZiAob2JqICE9IGNhY2hlZE9iamVjdCkge1xuICAgICAgICAgICAgICB2YXIgbWVzc2FnZSA9ICdPYmplY3QgJyArIGNvbGxlY3Rpb25OYW1lLnRvU3RyaW5nKCkgKyAnOicgKyB0eXBlLnRvU3RyaW5nKCkgKyAnWycgKyBvYmoubW9kZWwuaWQgKyAnPVwiJyArIHJlbW90ZUlkICsgJ1wiXSBhbHJlYWR5IGV4aXN0cyBpbiB0aGUgY2FjaGUuJyArXG4gICAgICAgICAgICAgICAgJyBUaGlzIGlzIGEgc2VyaW91cyBlcnJvciwgcGxlYXNlIGZpbGUgYSBidWcgcmVwb3J0IGlmIHlvdSBhcmUgZXhwZXJpZW5jaW5nIHRoaXMgb3V0IGluIHRoZSB3aWxkJztcbiAgICAgICAgICAgICAgbG9nKG1lc3NhZ2UsIHtcbiAgICAgICAgICAgICAgICBvYmo6IG9iaixcbiAgICAgICAgICAgICAgICBjYWNoZWRPYmplY3Q6IGNhY2hlZE9iamVjdFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IobWVzc2FnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNb2RlbCBoYXMgbm8gdHlwZScsIHtcbiAgICAgICAgICAgIG1vZGVsOiBvYmoubW9kZWwsXG4gICAgICAgICAgICBvYmo6IG9ialxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTW9kZWwgaGFzIG5vIGNvbGxlY3Rpb24nLCB7XG4gICAgICAgICAgbW9kZWw6IG9iai5tb2RlbCxcbiAgICAgICAgICBvYmo6IG9ialxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIG1zZyA9ICdNdXN0IHBhc3MgYW4gb2JqZWN0IHdoZW4gaW5zZXJ0aW5nIHRvIGNhY2hlJztcbiAgICAgIGxvZyhtc2cpO1xuICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IobXNnKTtcbiAgICB9XG4gIH0sXG4gIC8qKlxuICAgKiBRdWVyeSB0aGUgY2FjaGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRzIE9iamVjdCBkZXNjcmliaW5nIHRoZSBxdWVyeVxuICAgKiBAcmV0dXJuIHtNb2RlbEluc3RhbmNlfVxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGBqc1xuICAgKiBjYWNoZS5nZXQoe19pZDogJzUnfSk7IC8vIFF1ZXJ5IGJ5IGxvY2FsIGlkXG4gICAqIGNhY2hlLmdldCh7cmVtb3RlSWQ6ICc1JywgbWFwcGluZzogbXlNYXBwaW5nfSk7IC8vIFF1ZXJ5IGJ5IHJlbW90ZSBpZFxuICAgKiBgYGBcbiAgICovXG4gIGdldDogZnVuY3Rpb24ob3B0cykge1xuICAgIGxvZygnZ2V0Jywgb3B0cyk7XG4gICAgdmFyIG9iaiwgaWRGaWVsZCwgcmVtb3RlSWQ7XG4gICAgdmFyIGxvY2FsSWQgPSBvcHRzLmxvY2FsSWQ7XG4gICAgaWYgKGxvY2FsSWQpIHtcbiAgICAgIG9iaiA9IHRoaXMuZ2V0VmlhTG9jYWxJZChsb2NhbElkKTtcbiAgICAgIGlmIChvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChvcHRzLm1vZGVsKSB7XG4gICAgICAgICAgaWRGaWVsZCA9IG9wdHMubW9kZWwuaWQ7XG4gICAgICAgICAgcmVtb3RlSWQgPSBvcHRzW2lkRmllbGRdO1xuICAgICAgICAgIGxvZyhpZEZpZWxkICsgJz0nICsgcmVtb3RlSWQpO1xuICAgICAgICAgIHJldHVybiB0aGlzLmdldFZpYVJlbW90ZUlkKHJlbW90ZUlkLCBvcHRzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAob3B0cy5tb2RlbCkge1xuICAgICAgaWRGaWVsZCA9IG9wdHMubW9kZWwuaWQ7XG4gICAgICByZW1vdGVJZCA9IG9wdHNbaWRGaWVsZF07XG4gICAgICBpZiAocmVtb3RlSWQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0VmlhUmVtb3RlSWQocmVtb3RlSWQsIG9wdHMpO1xuICAgICAgfSBlbHNlIGlmIChvcHRzLm1vZGVsLnNpbmdsZXRvbikge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRTaW5nbGV0b24ob3B0cy5tb2RlbCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZygnSW52YWxpZCBvcHRzIHRvIGNhY2hlJywge1xuICAgICAgICBvcHRzOiBvcHRzXG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG4gIF9yZW1vdGVDYWNoZTogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMucmVtb3RlXG4gIH0sXG4gIF9sb2NhbENhY2hlOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5sb2NhbEJ5SWQ7XG4gIH0sXG4gIC8qKlxuICAgKiBJbnNlcnQgYW4gb2JqZWN0IGludG8gdGhlIGNhY2hlLlxuICAgKiBAcGFyYW0gIHtNb2RlbEluc3RhbmNlfSBvYmpcbiAgICogQHRocm93cyB7SW50ZXJuYWxTaWVzdGFFcnJvcn0gQW4gb2JqZWN0IHdpdGggX2lkL3JlbW90ZUlkIGFscmVhZHkgZXhpc3RzLiBOb3QgdGhyb3duIGlmIHNhbWUgb2JoZWN0LlxuICAgKi9cbiAgaW5zZXJ0OiBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIgbG9jYWxJZCA9IG9iai5sb2NhbElkO1xuICAgIGlmIChsb2NhbElkKSB7XG4gICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBvYmoubW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgICB2YXIgbW9kZWxOYW1lID0gb2JqLm1vZGVsLm5hbWU7XG4gICAgICBpZiAoIXRoaXMubG9jYWxCeUlkW2xvY2FsSWRdKSB7XG4gICAgICAgIHRoaXMubG9jYWxCeUlkW2xvY2FsSWRdID0gb2JqO1xuICAgICAgICBpZiAoIXRoaXMubG9jYWxbY29sbGVjdGlvbk5hbWVdKSB0aGlzLmxvY2FsW2NvbGxlY3Rpb25OYW1lXSA9IHt9O1xuICAgICAgICBpZiAoIXRoaXMubG9jYWxbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV0pIHRoaXMubG9jYWxbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV0gPSB7fTtcbiAgICAgICAgdGhpcy5sb2NhbFtjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXVtsb2NhbElkXSA9IG9iajtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFNvbWV0aGluZyBoYXMgZ29uZSBiYWRseSB3cm9uZyBoZXJlLiBUd28gb2JqZWN0cyBzaG91bGQgbmV2ZXIgZXhpc3Qgd2l0aCB0aGUgc2FtZSBfaWRcbiAgICAgICAgaWYgKHRoaXMubG9jYWxCeUlkW2xvY2FsSWRdICE9IG9iaikge1xuICAgICAgICAgIHZhciBtZXNzYWdlID0gJ09iamVjdCB3aXRoIGxvY2FsSWQ9XCInICsgbG9jYWxJZC50b1N0cmluZygpICsgJ1wiIGlzIGFscmVhZHkgaW4gdGhlIGNhY2hlLiAnICtcbiAgICAgICAgICAgICdUaGlzIGlzIGEgc2VyaW91cyBlcnJvci4gUGxlYXNlIGZpbGUgYSBidWcgcmVwb3J0IGlmIHlvdSBhcmUgZXhwZXJpZW5jaW5nIHRoaXMgb3V0IGluIHRoZSB3aWxkJztcbiAgICAgICAgICBsb2cobWVzc2FnZSk7XG4gICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IobWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdmFyIGlkRmllbGQgPSBvYmouaWRGaWVsZDtcbiAgICB2YXIgcmVtb3RlSWQgPSBvYmpbaWRGaWVsZF07XG4gICAgaWYgKHJlbW90ZUlkKSB7XG4gICAgICB0aGlzLnJlbW90ZUluc2VydChvYmosIHJlbW90ZUlkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbG9nKCdObyByZW1vdGUgaWQgKFwiJyArIGlkRmllbGQgKyAnXCIpIHNvIHdvbnQgYmUgcGxhY2luZyBpbiB0aGUgcmVtb3RlIGNhY2hlJywgb2JqKTtcbiAgICB9XG4gIH0sXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRydWUgaWYgb2JqZWN0IGlzIGluIHRoZSBjYWNoZVxuICAgKiBAcGFyYW0gIHtNb2RlbEluc3RhbmNlfSBvYmpcbiAgICogQHJldHVybiB7Ym9vbGVhbn1cbiAgICovXG4gIGNvbnRhaW5zOiBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIgcSA9IHtcbiAgICAgIGxvY2FsSWQ6IG9iai5sb2NhbElkXG4gICAgfTtcbiAgICB2YXIgbW9kZWwgPSBvYmoubW9kZWw7XG4gICAgaWYgKG1vZGVsLmlkKSB7XG4gICAgICBpZiAob2JqW21vZGVsLmlkXSkge1xuICAgICAgICBxLm1vZGVsID0gbW9kZWw7XG4gICAgICAgIHFbbW9kZWwuaWRdID0gb2JqW21vZGVsLmlkXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuICEhdGhpcy5nZXQocSk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFJlbW92ZXMgdGhlIG9iamVjdCBmcm9tIHRoZSBjYWNoZSAoaWYgaXQncyBhY3R1YWxseSBpbiB0aGUgY2FjaGUpIG90aGVyd2lzZXMgdGhyb3dzIGFuIGVycm9yLlxuICAgKiBAcGFyYW0gIHtNb2RlbEluc3RhbmNlfSBvYmpcbiAgICogQHRocm93cyB7SW50ZXJuYWxTaWVzdGFFcnJvcn0gSWYgb2JqZWN0IGFscmVhZHkgaW4gdGhlIGNhY2hlLlxuICAgKi9cbiAgcmVtb3ZlOiBmdW5jdGlvbihvYmopIHtcbiAgICBpZiAodGhpcy5jb250YWlucyhvYmopKSB7XG4gICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBvYmoubW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgICB2YXIgbW9kZWxOYW1lID0gb2JqLm1vZGVsLm5hbWU7XG4gICAgICB2YXIgbG9jYWxJZCA9IG9iai5sb2NhbElkO1xuICAgICAgaWYgKCFtb2RlbE5hbWUpIHRocm93IEludGVybmFsU2llc3RhRXJyb3IoJ05vIG1hcHBpbmcgbmFtZScpO1xuICAgICAgaWYgKCFjb2xsZWN0aW9uTmFtZSkgdGhyb3cgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gY29sbGVjdGlvbiBuYW1lJyk7XG4gICAgICBpZiAoIWxvY2FsSWQpIHRocm93IEludGVybmFsU2llc3RhRXJyb3IoJ05vIGxvY2FsSWQnKTtcbiAgICAgIGRlbGV0ZSB0aGlzLmxvY2FsW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdW2xvY2FsSWRdO1xuICAgICAgZGVsZXRlIHRoaXMubG9jYWxCeUlkW2xvY2FsSWRdO1xuICAgICAgaWYgKG9iai5tb2RlbC5pZCkge1xuICAgICAgICB2YXIgcmVtb3RlSWQgPSBvYmpbb2JqLm1vZGVsLmlkXTtcbiAgICAgICAgaWYgKHJlbW90ZUlkKSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMucmVtb3RlW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdW3JlbW90ZUlkXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBjb3VudDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMubG9jYWxCeUlkKS5sZW5ndGg7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gbmV3IENhY2hlKCk7XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvY2FjaGUuanNcbiAqKiBtb2R1bGUgaWQgPSA0XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSgnbW9kZWwnKSxcbiAgQ29sbGVjdGlvblJlZ2lzdHJ5ID0gcmVxdWlyZSgnLi9jb2xsZWN0aW9uUmVnaXN0cnknKS5Db2xsZWN0aW9uUmVnaXN0cnksXG4gIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgUmVsYXRpb25zaGlwVHlwZSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwVHlwZScpLFxuICBRdWVyeSA9IHJlcXVpcmUoJy4vUXVlcnknKSxcbiAgTWFwcGluZ09wZXJhdGlvbiA9IHJlcXVpcmUoJy4vbWFwcGluZ09wZXJhdGlvbicpLFxuICBNb2RlbEluc3RhbmNlID0gcmVxdWlyZSgnLi9Nb2RlbEluc3RhbmNlJyksXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyksXG4gIGFyZ3NhcnJheSA9IHJlcXVpcmUoJ2FyZ3NhcnJheScpLFxuICBlcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKSxcbiAgZXh0ZW5kID0gcmVxdWlyZSgnZXh0ZW5kJyksXG4gIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICBDb25kaXRpb24gPSByZXF1aXJlKCcuL0NvbmRpdGlvbicpLFxuICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICBQbGFjZWhvbGRlciA9IHJlcXVpcmUoJy4vUGxhY2Vob2xkZXInKSxcbiAgUmVhY3RpdmVRdWVyeSA9IHJlcXVpcmUoJy4vUmVhY3RpdmVRdWVyeScpLFxuICBJbnN0YW5jZUZhY3RvcnkgPSByZXF1aXJlKCcuL2luc3RhbmNlRmFjdG9yeScpO1xuXG4vKipcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICovXG5mdW5jdGlvbiBNb2RlbChvcHRzKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdGhpcy5fb3B0cyA9IG9wdHMgPyB1dGlsLmV4dGVuZCh7fSwgb3B0cykgOiB7fTtcblxuICB1dGlsLmV4dGVuZEZyb21PcHRzKHRoaXMsIG9wdHMsIHtcbiAgICBtZXRob2RzOiB7fSxcbiAgICBhdHRyaWJ1dGVzOiBbXSxcbiAgICBjb2xsZWN0aW9uOiBmdW5jdGlvbihjKSB7XG4gICAgICBpZiAodXRpbC5pc1N0cmluZyhjKSkge1xuICAgICAgICBjID0gQ29sbGVjdGlvblJlZ2lzdHJ5W2NdO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGM7XG4gICAgfSxcbiAgICBpZDogJ2lkJyxcbiAgICByZWxhdGlvbnNoaXBzOiBbXSxcbiAgICBuYW1lOiBudWxsLFxuICAgIGluZGV4ZXM6IFtdLFxuICAgIHNpbmdsZXRvbjogZmFsc2UsXG4gICAgc3RhdGljczogdGhpcy5pbnN0YWxsU3RhdGljcy5iaW5kKHRoaXMpLFxuICAgIHByb3BlcnRpZXM6IHt9LFxuICAgIGluaXQ6IG51bGwsXG4gICAgc2VyaWFsaXNlOiBudWxsLFxuICAgIHNlcmlhbGlzZUZpZWxkOiBudWxsLFxuICAgIHNlcmlhbGlzYWJsZUZpZWxkczogbnVsbCxcbiAgICByZW1vdmU6IG51bGwsXG4gICAgcGFyc2VBdHRyaWJ1dGU6IG51bGxcbiAgfSwgZmFsc2UpO1xuXG4gIGlmICghdGhpcy5wYXJzZUF0dHJpYnV0ZSkge1xuICAgIHRoaXMucGFyc2VBdHRyaWJ1dGUgPSBmdW5jdGlvbihhdHRyTmFtZSwgdmFsdWUpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG4gIH1cblxuICB0aGlzLmF0dHJpYnV0ZXMgPSBNb2RlbC5fcHJvY2Vzc0F0dHJpYnV0ZXModGhpcy5hdHRyaWJ1dGVzKTtcblxuICB0aGlzLl9mYWN0b3J5ID0gbmV3IEluc3RhbmNlRmFjdG9yeSh0aGlzKTtcbiAgdGhpcy5faW5zdGFuY2UgPSB0aGlzLl9mYWN0b3J5Ll9pbnN0YW5jZS5iaW5kKHRoaXMuX2ZhY3RvcnkpO1xuXG4gIHV0aWwuZXh0ZW5kKHRoaXMsIHtcbiAgICBfcmVsYXRpb25zaGlwc0luc3RhbGxlZDogZmFsc2UsXG4gICAgX3JldmVyc2VSZWxhdGlvbnNoaXBzSW5zdGFsbGVkOiBmYWxzZSxcbiAgICBjaGlsZHJlbjogW11cbiAgfSk7XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXModGhpcywge1xuICAgIF9yZWxhdGlvbnNoaXBOYW1lczoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKHNlbGYucmVsYXRpb25zaGlwcyk7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0sXG4gICAgX2F0dHJpYnV0ZU5hbWVzOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgbmFtZXMgPSBbXTtcbiAgICAgICAgaWYgKHNlbGYuaWQpIHtcbiAgICAgICAgICBuYW1lcy5wdXNoKHNlbGYuaWQpO1xuICAgICAgICB9XG4gICAgICAgIHNlbGYuYXR0cmlidXRlcy5mb3JFYWNoKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICBuYW1lcy5wdXNoKHgubmFtZSlcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBuYW1lcztcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSxcbiAgICBpbnN0YWxsZWQ6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBzZWxmLl9yZWxhdGlvbnNoaXBzSW5zdGFsbGVkICYmIHNlbGYuX3JldmVyc2VSZWxhdGlvbnNoaXBzSW5zdGFsbGVkO1xuICAgICAgfSxcbiAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9LFxuICAgIGRlc2NlbmRhbnRzOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gc2VsZi5jaGlsZHJlbi5yZWR1Y2UoZnVuY3Rpb24obWVtbywgZGVzY2VuZGFudCkge1xuICAgICAgICAgIHJldHVybiBBcnJheS5wcm90b3R5cGUuY29uY2F0LmNhbGwobWVtbywgZGVzY2VuZGFudC5kZXNjZW5kYW50cyk7XG4gICAgICAgIH0uYmluZChzZWxmKSwgdXRpbC5leHRlbmQoW10sIHNlbGYuY2hpbGRyZW4pKTtcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSxcbiAgICBkaXJ0eToge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQpIHtcbiAgICAgICAgICB2YXIgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24gPSBzaWVzdGEuZXh0LnN0b3JhZ2UuX3Vuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uLFxuICAgICAgICAgICAgaGFzaCA9ICh1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvblt0aGlzLmNvbGxlY3Rpb25OYW1lXSB8fCB7fSlbdGhpcy5uYW1lXSB8fCB7fTtcbiAgICAgICAgICByZXR1cm4gISFPYmplY3Qua2V5cyhoYXNoKS5sZW5ndGg7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgfSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9LFxuICAgIGNvbGxlY3Rpb25OYW1lOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jb2xsZWN0aW9uLm5hbWU7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH1cbiAgfSk7XG4gIHZhciBnbG9iYWxFdmVudE5hbWUgPSB0aGlzLmNvbGxlY3Rpb25OYW1lICsgJzonICsgdGhpcy5uYW1lLFxuICAgIHByb3hpZWQgPSB7XG4gICAgICBxdWVyeTogdGhpcy5xdWVyeS5iaW5kKHRoaXMpXG4gICAgfTtcblxuICBldmVudHMuUHJveHlFdmVudEVtaXR0ZXIuY2FsbCh0aGlzLCBnbG9iYWxFdmVudE5hbWUsIHByb3hpZWQpO1xuXG4gIHRoaXMuX2luZGV4SXNJbnN0YWxsZWQgPSBuZXcgQ29uZGl0aW9uKGZ1bmN0aW9uKGRvbmUpIHtcbiAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkgc2llc3RhLmV4dC5zdG9yYWdlLmVuc3VyZUluZGV4SW5zdGFsbGVkKHRoaXMsIGRvbmUpO1xuICAgIGVsc2UgZG9uZSgpO1xuICB9LmJpbmQodGhpcykpO1xuXG4gIHRoaXMuX21vZGVsTG9hZGVkRnJvbVN0b3JhZ2UgPSBuZXcgQ29uZGl0aW9uKGZ1bmN0aW9uKGRvbmUpIHtcbiAgICBpZiAoc2llc3RhLmV4dC5zdG9yYWdlRW5hYmxlZCkgc2llc3RhLmV4dC5zdG9yYWdlLmxvYWRNb2RlbCh7bW9kZWw6IHRoaXN9LCBkb25lKTtcbiAgICBlbHNlIGRvbmUoKTtcbiAgfSk7XG5cbiAgdGhpcy5fc3RvcmFnZUVuYWJsZWQgPSBuZXcgQ29uZGl0aW9uKFt0aGlzLl9pbmRleElzSW5zdGFsbGVkLCB0aGlzLl9tb2RlbExvYWRlZEZyb21TdG9yYWdlXSk7XG59XG5cbnV0aWwuZXh0ZW5kKE1vZGVsLCB7XG4gIC8qKlxuICAgKiBOb3JtYWxpc2UgYXR0cmlidXRlcyBwYXNzZWQgdmlhIHRoZSBvcHRpb25zIGRpY3Rpb25hcnkuXG4gICAqIEBwYXJhbSBhdHRyaWJ1dGVzXG4gICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9wcm9jZXNzQXR0cmlidXRlczogZnVuY3Rpb24oYXR0cmlidXRlcykge1xuICAgIHJldHVybiBhdHRyaWJ1dGVzLnJlZHVjZShmdW5jdGlvbihtLCBhKSB7XG4gICAgICBpZiAodHlwZW9mIGEgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgbS5wdXNoKHtcbiAgICAgICAgICBuYW1lOiBhXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIG0ucHVzaChhKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtO1xuICAgIH0sIFtdKVxuICB9XG5cbn0pO1xuXG5Nb2RlbC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKGV2ZW50cy5Qcm94eUV2ZW50RW1pdHRlci5wcm90b3R5cGUpO1xuXG51dGlsLmV4dGVuZChNb2RlbC5wcm90b3R5cGUsIHtcbiAgaW5zdGFsbFN0YXRpY3M6IGZ1bmN0aW9uKHN0YXRpY3MpIHtcbiAgICBpZiAoc3RhdGljcykge1xuICAgICAgT2JqZWN0LmtleXMoc3RhdGljcykuZm9yRWFjaChmdW5jdGlvbihzdGF0aWNOYW1lKSB7XG4gICAgICAgIGlmICh0aGlzW3N0YXRpY05hbWVdKSB7XG4gICAgICAgICAgbG9nKCdTdGF0aWMgbWV0aG9kIHdpdGggbmFtZSBcIicgKyBzdGF0aWNOYW1lICsgJ1wiIGFscmVhZHkgZXhpc3RzLiBJZ25vcmluZyBpdC4nKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICB0aGlzW3N0YXRpY05hbWVdID0gc3RhdGljc1tzdGF0aWNOYW1lXS5iaW5kKHRoaXMpO1xuICAgICAgICB9XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH1cbiAgICByZXR1cm4gc3RhdGljcztcbiAgfSxcbiAgX3ZhbGlkYXRlUmVsYXRpb25zaGlwVHlwZTogZnVuY3Rpb24ocmVsYXRpb25zaGlwKSB7XG4gICAgaWYgKCFyZWxhdGlvbnNoaXAudHlwZSkge1xuICAgICAgaWYgKHRoaXMuc2luZ2xldG9uKSByZWxhdGlvbnNoaXAudHlwZSA9IFJlbGF0aW9uc2hpcFR5cGUuT25lVG9PbmU7XG4gICAgICBlbHNlIHJlbGF0aW9uc2hpcC50eXBlID0gUmVsYXRpb25zaGlwVHlwZS5PbmVUb01hbnk7XG4gICAgfVxuICAgIGlmICh0aGlzLnNpbmdsZXRvbiAmJiByZWxhdGlvbnNoaXAudHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk1hbnlUb01hbnkpIHtcbiAgICAgIHJldHVybiAnU2luZ2xldG9uIG1vZGVsIGNhbm5vdCB1c2UgTWFueVRvTWFueSByZWxhdGlvbnNoaXAuJztcbiAgICB9XG4gICAgaWYgKE9iamVjdC5rZXlzKFJlbGF0aW9uc2hpcFR5cGUpLmluZGV4T2YocmVsYXRpb25zaGlwLnR5cGUpIDwgMClcbiAgICAgIHJldHVybiAnUmVsYXRpb25zaGlwIHR5cGUgJyArIHJlbGF0aW9uc2hpcC50eXBlICsgJyBkb2VzIG5vdCBleGlzdCc7XG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG4gIF9nZXRSZXZlcnNlTW9kZWw6IGZ1bmN0aW9uKHJldmVyc2VOYW1lKSB7XG4gICAgdmFyIHJldmVyc2VNb2RlbDtcbiAgICBpZiAocmV2ZXJzZU5hbWUgaW5zdGFuY2VvZiBNb2RlbCkgcmV2ZXJzZU1vZGVsID0gcmV2ZXJzZU5hbWU7XG4gICAgZWxzZSByZXZlcnNlTW9kZWwgPSB0aGlzLmNvbGxlY3Rpb25bcmV2ZXJzZU5hbWVdO1xuICAgIGlmICghcmV2ZXJzZU1vZGVsKSB7IC8vIE1heSBoYXZlIHVzZWQgQ29sbGVjdGlvbi5Nb2RlbCBmb3JtYXQuXG4gICAgICB2YXIgYXJyID0gcmV2ZXJzZU5hbWUuc3BsaXQoJy4nKTtcbiAgICAgIGlmIChhcnIubGVuZ3RoID09IDIpIHtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gYXJyWzBdO1xuICAgICAgICByZXZlcnNlTmFtZSA9IGFyclsxXTtcbiAgICAgICAgdmFyIG90aGVyQ29sbGVjdGlvbiA9IENvbGxlY3Rpb25SZWdpc3RyeVtjb2xsZWN0aW9uTmFtZV07XG4gICAgICAgIGlmIChvdGhlckNvbGxlY3Rpb24pXG4gICAgICAgICAgcmV2ZXJzZU1vZGVsID0gb3RoZXJDb2xsZWN0aW9uW3JldmVyc2VOYW1lXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJldmVyc2VNb2RlbDtcbiAgfSxcbiAgLyoqXG4gICAqIFJldHVybiB0aGUgcmV2ZXJzZSBtb2RlbCBvciBhIHBsYWNlaG9sZGVyIHRoYXQgd2lsbCBiZSByZXNvbHZlZCBsYXRlci5cbiAgICogQHBhcmFtIGZvcndhcmROYW1lXG4gICAqIEBwYXJhbSByZXZlcnNlTmFtZVxuICAgKiBAcmV0dXJucyB7Kn1cbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9nZXRSZXZlcnNlTW9kZWxPclBsYWNlaG9sZGVyOiBmdW5jdGlvbihmb3J3YXJkTmFtZSwgcmV2ZXJzZU5hbWUpIHtcbiAgICB2YXIgcmV2ZXJzZU1vZGVsID0gdGhpcy5fZ2V0UmV2ZXJzZU1vZGVsKHJldmVyc2VOYW1lKTtcbiAgICByZXR1cm4gcmV2ZXJzZU1vZGVsIHx8IG5ldyBQbGFjZWhvbGRlcih7bmFtZTogcmV2ZXJzZU5hbWUsIHJlZjogdGhpcywgZm9yd2FyZE5hbWU6IGZvcndhcmROYW1lfSk7XG4gIH0sXG4gIC8qKlxuICAgKiBJbnN0YWxsIHJlbGF0aW9uc2hpcHMuIFJldHVybnMgZXJyb3IgaW4gZm9ybSBvZiBzdHJpbmcgaWYgZmFpbHMuXG4gICAqIEByZXR1cm4ge1N0cmluZ3xudWxsfVxuICAgKi9cbiAgaW5zdGFsbFJlbGF0aW9uc2hpcHM6IGZ1bmN0aW9uKCkge1xuICAgIGlmICghdGhpcy5fcmVsYXRpb25zaGlwc0luc3RhbGxlZCkge1xuICAgICAgdmFyIGVyciA9IG51bGw7XG4gICAgICBmb3IgKHZhciBuYW1lIGluIHRoaXMuX29wdHMucmVsYXRpb25zaGlwcykge1xuICAgICAgICBpZiAodGhpcy5fb3B0cy5yZWxhdGlvbnNoaXBzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgdmFyIHJlbGF0aW9uc2hpcCA9IHRoaXMuX29wdHMucmVsYXRpb25zaGlwc1tuYW1lXTtcbiAgICAgICAgICAvLyBJZiBhIHJldmVyc2UgcmVsYXRpb25zaGlwIGlzIGluc3RhbGxlZCBiZWZvcmVoYW5kLCB3ZSBkbyBub3Qgd2FudCB0byBwcm9jZXNzIHRoZW0uXG4gICAgICAgICAgdmFyIGlzRm9yd2FyZCA9ICFyZWxhdGlvbnNoaXAuaXNSZXZlcnNlO1xuICAgICAgICAgIGlmIChpc0ZvcndhcmQpIHtcbiAgICAgICAgICAgIGxvZyh0aGlzLm5hbWUgKyAnOiBjb25maWd1cmluZyByZWxhdGlvbnNoaXAgJyArIG5hbWUsIHJlbGF0aW9uc2hpcCk7XG4gICAgICAgICAgICBpZiAoIShlcnIgPSB0aGlzLl92YWxpZGF0ZVJlbGF0aW9uc2hpcFR5cGUocmVsYXRpb25zaGlwKSkpIHtcbiAgICAgICAgICAgICAgdmFyIHJldmVyc2VNb2RlbE5hbWUgPSByZWxhdGlvbnNoaXAubW9kZWw7XG4gICAgICAgICAgICAgIGlmIChyZXZlcnNlTW9kZWxOYW1lKSB7XG4gICAgICAgICAgICAgICAgdmFyIHJldmVyc2VNb2RlbCA9IHRoaXMuX2dldFJldmVyc2VNb2RlbE9yUGxhY2Vob2xkZXIobmFtZSwgcmV2ZXJzZU1vZGVsTmFtZSk7XG4gICAgICAgICAgICAgICAgdXRpbC5leHRlbmQocmVsYXRpb25zaGlwLCB7XG4gICAgICAgICAgICAgICAgICByZXZlcnNlTW9kZWw6IHJldmVyc2VNb2RlbCxcbiAgICAgICAgICAgICAgICAgIGZvcndhcmRNb2RlbDogdGhpcyxcbiAgICAgICAgICAgICAgICAgIGZvcndhcmROYW1lOiBuYW1lLFxuICAgICAgICAgICAgICAgICAgcmV2ZXJzZU5hbWU6IHJlbGF0aW9uc2hpcC5yZXZlcnNlIHx8ICdyZXZlcnNlXycgKyBuYW1lLFxuICAgICAgICAgICAgICAgICAgaXNSZXZlcnNlOiBmYWxzZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSByZWxhdGlvbnNoaXAubW9kZWw7XG4gICAgICAgICAgICAgICAgZGVsZXRlIHJlbGF0aW9uc2hpcC5yZXZlcnNlO1xuXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZWxzZSByZXR1cm4gJ011c3QgcGFzcyBtb2RlbCc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdSZWxhdGlvbnNoaXBzIGZvciBcIicgKyB0aGlzLm5hbWUgKyAnXCIgaGF2ZSBhbHJlYWR5IGJlZW4gaW5zdGFsbGVkJyk7XG4gICAgfVxuICAgIGlmICghZXJyKSB0aGlzLl9yZWxhdGlvbnNoaXBzSW5zdGFsbGVkID0gdHJ1ZTtcbiAgICByZXR1cm4gZXJyO1xuICB9LFxuICBfaW5zdGFsbFJldmVyc2U6IGZ1bmN0aW9uKHJlbGF0aW9uc2hpcCkge1xuICAgIHZhciByZXZlcnNlTW9kZWwgPSByZWxhdGlvbnNoaXAucmV2ZXJzZU1vZGVsO1xuICAgIHZhciBpc1BsYWNlaG9sZGVyID0gcmV2ZXJzZU1vZGVsLmlzUGxhY2Vob2xkZXI7XG4gICAgaWYgKGlzUGxhY2Vob2xkZXIpIHtcbiAgICAgIHZhciBtb2RlbE5hbWUgPSByZWxhdGlvbnNoaXAucmV2ZXJzZU1vZGVsLm5hbWU7XG4gICAgICByZXZlcnNlTW9kZWwgPSB0aGlzLl9nZXRSZXZlcnNlTW9kZWwobW9kZWxOYW1lKTtcbiAgICAgIGlmIChyZXZlcnNlTW9kZWwpIHtcbiAgICAgICAgcmVsYXRpb25zaGlwLnJldmVyc2VNb2RlbCA9IHJldmVyc2VNb2RlbDtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHJldmVyc2VNb2RlbCkge1xuICAgICAgdmFyIGVycjtcbiAgICAgIHZhciByZXZlcnNlTmFtZSA9IHJlbGF0aW9uc2hpcC5yZXZlcnNlTmFtZSxcbiAgICAgICAgZm9yd2FyZE1vZGVsID0gcmVsYXRpb25zaGlwLmZvcndhcmRNb2RlbDtcblxuICAgICAgaWYgKHJldmVyc2VNb2RlbCAhPSB0aGlzIHx8IHJldmVyc2VNb2RlbCA9PSBmb3J3YXJkTW9kZWwpIHtcbiAgICAgICAgaWYgKHJldmVyc2VNb2RlbC5zaW5nbGV0b24pIHtcbiAgICAgICAgICBpZiAocmVsYXRpb25zaGlwLnR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5NYW55VG9NYW55KSBlcnIgPSAnU2luZ2xldG9uIG1vZGVsIGNhbm5vdCBiZSByZWxhdGVkIHZpYSByZXZlcnNlIE1hbnlUb01hbnknO1xuICAgICAgICAgIGlmIChyZWxhdGlvbnNoaXAudHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvTWFueSkgZXJyID0gJ1NpbmdsZXRvbiBtb2RlbCBjYW5ub3QgYmUgcmVsYXRlZCB2aWEgcmV2ZXJzZSBPbmVUb01hbnknO1xuICAgICAgICB9XG4gICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgbG9nKHRoaXMubmFtZSArICc6IGNvbmZpZ3VyaW5nICByZXZlcnNlIHJlbGF0aW9uc2hpcCAnICsgcmV2ZXJzZU5hbWUpO1xuICAgICAgICAgIGlmIChyZXZlcnNlTW9kZWwucmVsYXRpb25zaGlwc1tyZXZlcnNlTmFtZV0pIHtcbiAgICAgICAgICAgIC8vIFdlIGFyZSBvayB0byByZWRlZmluZSByZXZlcnNlIHJlbGF0aW9uc2hpcHMgd2hlcmVieSB0aGUgbW9kZWxzIGFyZSBpbiB0aGUgc2FtZSBoaWVyYXJjaHlcbiAgICAgICAgICAgIHZhciBpc0FuY2VzdG9yTW9kZWwgPSByZXZlcnNlTW9kZWwucmVsYXRpb25zaGlwc1tyZXZlcnNlTmFtZV0uZm9yd2FyZE1vZGVsLmlzQW5jZXN0b3JPZih0aGlzKTtcbiAgICAgICAgICAgIHZhciBpc0Rlc2NlbmRlbnRNb2RlbCA9IHJldmVyc2VNb2RlbC5yZWxhdGlvbnNoaXBzW3JldmVyc2VOYW1lXS5mb3J3YXJkTW9kZWwuaXNEZXNjZW5kYW50T2YodGhpcyk7XG4gICAgICAgICAgICBpZiAoIWlzQW5jZXN0b3JNb2RlbCAmJiAhaXNEZXNjZW5kZW50TW9kZWwpIHtcbiAgICAgICAgICAgICAgZXJyID0gJ1JldmVyc2UgcmVsYXRpb25zaGlwIFwiJyArIHJldmVyc2VOYW1lICsgJ1wiIGFscmVhZHkgZXhpc3RzIG9uIG1vZGVsIFwiJyArIHJldmVyc2VNb2RlbC5uYW1lICsgJ1wiJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgIHJldmVyc2VNb2RlbC5yZWxhdGlvbnNoaXBzW3JldmVyc2VOYW1lXSA9IHJlbGF0aW9uc2hpcDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChpc1BsYWNlaG9sZGVyKSB7XG4gICAgICAgIHZhciBleGlzdGluZ1JldmVyc2VJbnN0YW5jZXMgPSAoY2FjaGUuX2xvY2FsQ2FjaGVCeVR5cGVbcmV2ZXJzZU1vZGVsLmNvbGxlY3Rpb25OYW1lXSB8fCB7fSlbcmV2ZXJzZU1vZGVsLm5hbWVdIHx8IHt9O1xuICAgICAgICBPYmplY3Qua2V5cyhleGlzdGluZ1JldmVyc2VJbnN0YW5jZXMpLmZvckVhY2goZnVuY3Rpb24obG9jYWxJZCkge1xuICAgICAgICAgIHZhciBpbnN0YW5jY2UgPSBleGlzdGluZ1JldmVyc2VJbnN0YW5jZXNbbG9jYWxJZF07XG4gICAgICAgICAgdmFyIHIgPSB1dGlsLmV4dGVuZCh7fSwgcmVsYXRpb25zaGlwKTtcbiAgICAgICAgICByLmlzUmV2ZXJzZSA9IHRydWU7XG4gICAgICAgICAgdGhpcy5fZmFjdG9yeS5faW5zdGFsbFJlbGF0aW9uc2hpcChyLCBpbnN0YW5jY2UpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZXJyO1xuICB9LFxuICAvKipcbiAgICogQ3ljbGUgdGhyb3VnaCByZWxhdGlvbnNoaXBzIGFuZCByZXBsYWNlIGFueSBwbGFjZWhvbGRlcnMgd2l0aCB0aGUgYWN0dWFsIG1vZGVscyB3aGVyZSBwb3NzaWJsZS5cbiAgICovXG4gIF9pbnN0YWxsUmV2ZXJzZVBsYWNlaG9sZGVyczogZnVuY3Rpb24oKSB7XG4gICAgZm9yICh2YXIgZm9yd2FyZE5hbWUgaW4gdGhpcy5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICBpZiAodGhpcy5yZWxhdGlvbnNoaXBzLmhhc093blByb3BlcnR5KGZvcndhcmROYW1lKSkge1xuICAgICAgICB2YXIgcmVsYXRpb25zaGlwID0gdGhpcy5yZWxhdGlvbnNoaXBzW2ZvcndhcmROYW1lXTtcbiAgICAgICAgaWYgKHJlbGF0aW9uc2hpcC5yZXZlcnNlTW9kZWwuaXNQbGFjZWhvbGRlcikgdGhpcy5faW5zdGFsbFJldmVyc2UocmVsYXRpb25zaGlwKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIGluc3RhbGxSZXZlcnNlUmVsYXRpb25zaGlwczogZnVuY3Rpb24oKSB7XG4gICAgaWYgKCF0aGlzLl9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZCkge1xuICAgICAgZm9yICh2YXIgZm9yd2FyZE5hbWUgaW4gdGhpcy5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgIGlmICh0aGlzLnJlbGF0aW9uc2hpcHMuaGFzT3duUHJvcGVydHkoZm9yd2FyZE5hbWUpKSB7XG4gICAgICAgICAgdmFyIHJlbGF0aW9uc2hpcCA9IHRoaXMucmVsYXRpb25zaGlwc1tmb3J3YXJkTmFtZV07XG4gICAgICAgICAgcmVsYXRpb25zaGlwID0gZXh0ZW5kKHRydWUsIHt9LCByZWxhdGlvbnNoaXApO1xuICAgICAgICAgIHJlbGF0aW9uc2hpcC5pc1JldmVyc2UgPSB0cnVlO1xuICAgICAgICAgIHZhciBlcnIgPSB0aGlzLl9pbnN0YWxsUmV2ZXJzZShyZWxhdGlvbnNoaXApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLl9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZCA9IHRydWU7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ1JldmVyc2UgcmVsYXRpb25zaGlwcyBmb3IgXCInICsgdGhpcy5uYW1lICsgJ1wiIGhhdmUgYWxyZWFkeSBiZWVuIGluc3RhbGxlZC4nKTtcbiAgICB9XG4gICAgcmV0dXJuIGVycjtcbiAgfSxcbiAgX3F1ZXJ5OiBmdW5jdGlvbihxdWVyeSkge1xuICAgIHJldHVybiBuZXcgUXVlcnkodGhpcywgcXVlcnkgfHwge30pO1xuICB9LFxuICBxdWVyeTogZnVuY3Rpb24ocXVlcnksIGNiKSB7XG4gICAgdmFyIHF1ZXJ5SW5zdGFuY2U7XG4gICAgdmFyIHByb21pc2UgPSB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICBpZiAoIXRoaXMuc2luZ2xldG9uKSB7XG4gICAgICAgIHF1ZXJ5SW5zdGFuY2UgPSB0aGlzLl9xdWVyeShxdWVyeSk7XG4gICAgICAgIHJldHVybiBxdWVyeUluc3RhbmNlLmV4ZWN1dGUoY2IpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHF1ZXJ5SW5zdGFuY2UgPSB0aGlzLl9xdWVyeSh7X19pZ25vcmVJbnN0YWxsZWQ6IHRydWV9KTtcbiAgICAgICAgcXVlcnlJbnN0YW5jZS5leGVjdXRlKGZ1bmN0aW9uKGVyciwgb2Jqcykge1xuICAgICAgICAgIGlmIChlcnIpIGNiKGVycik7XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAvLyBDYWNoZSBhIG5ldyBzaW5nbGV0b24gYW5kIHRoZW4gcmVleGVjdXRlIHRoZSBxdWVyeVxuICAgICAgICAgICAgcXVlcnkgPSB1dGlsLmV4dGVuZCh7fSwgcXVlcnkpO1xuICAgICAgICAgICAgcXVlcnkuX19pZ25vcmVJbnN0YWxsZWQgPSB0cnVlO1xuICAgICAgICAgICAgaWYgKCFvYmpzLmxlbmd0aCkge1xuICAgICAgICAgICAgICB0aGlzLmdyYXBoKHt9LCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgcXVlcnlJbnN0YW5jZSA9IHRoaXMuX3F1ZXJ5KHF1ZXJ5KTtcbiAgICAgICAgICAgICAgICAgIHF1ZXJ5SW5zdGFuY2UuZXhlY3V0ZShjYik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgcXVlcnlJbnN0YW5jZSA9IHRoaXMuX3F1ZXJ5KHF1ZXJ5KTtcbiAgICAgICAgICAgICAgcXVlcnlJbnN0YW5jZS5leGVjdXRlKGNiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIC8vIEJ5IHdyYXBwaW5nIHRoZSBwcm9taXNlIGluIGFub3RoZXIgcHJvbWlzZSB3ZSBjYW4gcHVzaCB0aGUgaW52b2NhdGlvbnMgdG8gdGhlIGJvdHRvbSBvZiB0aGUgZXZlbnQgbG9vcCBzbyB0aGF0XG4gICAgLy8gYW55IGV2ZW50IGhhbmRsZXJzIGFkZGVkIHRvIHRoZSBjaGFpbiBhcmUgaG9ub3VyZWQgc3RyYWlnaHQgYXdheS5cbiAgICB2YXIgbGlua1Byb21pc2UgPSBuZXcgdXRpbC5Qcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgcHJvbWlzZS50aGVuKGFyZ3NhcnJheShmdW5jdGlvbihhcmdzKSB7XG4gICAgICAgIHNldEltbWVkaWF0ZShmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXNvbHZlLmFwcGx5KG51bGwsIGFyZ3MpO1xuICAgICAgICB9KTtcbiAgICAgIH0pLCBhcmdzYXJyYXkoZnVuY3Rpb24oYXJncykge1xuICAgICAgICBzZXRJbW1lZGlhdGUoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmVqZWN0LmFwcGx5KG51bGwsIGFyZ3MpO1xuICAgICAgICB9KVxuICAgICAgfSkpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRoaXMuX2xpbmsoe1xuICAgICAgdGhlbjogbGlua1Byb21pc2UudGhlbi5iaW5kKGxpbmtQcm9taXNlKSxcbiAgICAgIGNhdGNoOiBsaW5rUHJvbWlzZS5jYXRjaC5iaW5kKGxpbmtQcm9taXNlKSxcbiAgICAgIG9uOiBhcmdzYXJyYXkoZnVuY3Rpb24oYXJncykge1xuICAgICAgICB2YXIgcnEgPSBuZXcgUmVhY3RpdmVRdWVyeSh0aGlzLl9xdWVyeShxdWVyeSkpO1xuICAgICAgICBycS5pbml0KCk7XG4gICAgICAgIHJxLm9uLmFwcGx5KHJxLCBhcmdzKTtcbiAgICAgIH0uYmluZCh0aGlzKSlcbiAgICB9KTtcbiAgfSxcbiAgLyoqXG4gICAqIE9ubHkgdXNlZCBpbiB0ZXN0aW5nIGF0IHRoZSBtb21lbnQuXG4gICAqIEBwYXJhbSBxdWVyeVxuICAgKiBAcmV0dXJucyB7UmVhY3RpdmVRdWVyeX1cbiAgICovXG4gIF9yZWFjdGl2ZVF1ZXJ5OiBmdW5jdGlvbihxdWVyeSkge1xuICAgIHJldHVybiBuZXcgUmVhY3RpdmVRdWVyeShuZXcgUXVlcnkodGhpcywgcXVlcnkgfHwge30pKTtcbiAgfSxcbiAgb25lOiBmdW5jdGlvbihvcHRzLCBjYikge1xuICAgIGlmICh0eXBlb2Ygb3B0cyA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYiA9IG9wdHM7XG4gICAgICBvcHRzID0ge307XG4gICAgfVxuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICB0aGlzLnF1ZXJ5KG9wdHMsIGZ1bmN0aW9uKGVyciwgcmVzKSB7XG4gICAgICAgIGlmIChlcnIpIGNiKGVycik7XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGlmIChyZXMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgY2IoZXJyb3IoJ01vcmUgdGhhbiBvbmUgaW5zdGFuY2UgcmV0dXJuZWQgd2hlbiBleGVjdXRpbmcgZ2V0IHF1ZXJ5IScpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXMgPSByZXMubGVuZ3RoID8gcmVzWzBdIDogbnVsbDtcbiAgICAgICAgICAgIGNiKG51bGwsIHJlcyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuICBhbGw6IGZ1bmN0aW9uKHEsIGNiKSB7XG4gICAgaWYgKHR5cGVvZiBxID09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNiID0gcTtcbiAgICAgIHEgPSB7fTtcbiAgICB9XG4gICAgcSA9IHEgfHwge307XG4gICAgdmFyIHF1ZXJ5ID0ge307XG4gICAgaWYgKHEuX19vcmRlcikgcXVlcnkuX19vcmRlciA9IHEuX19vcmRlcjtcbiAgICByZXR1cm4gdGhpcy5xdWVyeShxLCBjYik7XG4gIH0sXG4gIF9hdHRyaWJ1dGVEZWZpbml0aW9uV2l0aE5hbWU6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuYXR0cmlidXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGF0dHJpYnV0ZURlZmluaXRpb24gPSB0aGlzLmF0dHJpYnV0ZXNbaV07XG4gICAgICBpZiAoYXR0cmlidXRlRGVmaW5pdGlvbi5uYW1lID09IG5hbWUpIHJldHVybiBhdHRyaWJ1dGVEZWZpbml0aW9uO1xuICAgIH1cbiAgfSxcbiAgLyoqXG4gICAqIE1hcCBkYXRhIGludG8gU2llc3RhLlxuICAgKlxuICAgKiBAcGFyYW0gZGF0YSBSYXcgZGF0YSByZWNlaXZlZCByZW1vdGVseSBvciBvdGhlcndpc2VcbiAgICogQHBhcmFtIHtmdW5jdGlvbnxvYmplY3R9IFtvcHRzXVxuICAgKiBAcGFyYW0ge2Jvb2xlYW59IG9wdHMub3ZlcnJpZGVcbiAgICogQHBhcmFtIHtib29sZWFufSBvcHRzLl9pZ25vcmVJbnN0YWxsZWQgLSBBIGhhY2sgdGhhdCBhbGxvd3MgbWFwcGluZyBvbnRvIE1vZGVscyBldmVuIGlmIGluc3RhbGwgcHJvY2VzcyBoYXMgbm90IGZpbmlzaGVkLlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBbY2JdIENhbGxlZCBvbmNlIHBvdWNoIHBlcnNpc3RlbmNlIHJldHVybnMuXG4gICAqL1xuICBncmFwaDogZnVuY3Rpb24oZGF0YSwgb3B0cywgY2IpIHtcbiAgICBpZiAodHlwZW9mIG9wdHMgPT0gJ2Z1bmN0aW9uJykgY2IgPSBvcHRzO1xuICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICB2YXIgX21hcCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgb3ZlcnJpZGVzID0gb3B0cy5vdmVycmlkZTtcbiAgICAgICAgaWYgKG92ZXJyaWRlcykge1xuICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkob3ZlcnJpZGVzKSkgb3B0cy5vYmplY3RzID0gb3ZlcnJpZGVzO1xuICAgICAgICAgIGVsc2Ugb3B0cy5vYmplY3RzID0gW292ZXJyaWRlc107XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIG9wdHMub3ZlcnJpZGU7XG4gICAgICAgIGlmICh1dGlsLmlzQXJyYXkoZGF0YSkpIHtcbiAgICAgICAgICB0aGlzLl9tYXBCdWxrKGRhdGEsIG9wdHMsIGNiKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLl9tYXBCdWxrKFtkYXRhXSwgb3B0cywgZnVuY3Rpb24oZXJyLCBvYmplY3RzKSB7XG4gICAgICAgICAgICB2YXIgb2JqO1xuICAgICAgICAgICAgaWYgKG9iamVjdHMpIHtcbiAgICAgICAgICAgICAgaWYgKG9iamVjdHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgb2JqID0gb2JqZWN0c1swXTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZXJyID0gZXJyID8gKHV0aWwuaXNBcnJheShkYXRhKSA/IGVyciA6ICh1dGlsLmlzQXJyYXkoZXJyKSA/IGVyclswXSA6IGVycikpIDogbnVsbDtcbiAgICAgICAgICAgIGNiKGVyciwgb2JqKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgaWYgKG9wdHMuX2lnbm9yZUluc3RhbGxlZCkge1xuICAgICAgICBfbWFwKCk7XG4gICAgICB9XG4gICAgICBlbHNlIHNpZXN0YS5fYWZ0ZXJJbnN0YWxsKF9tYXApO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG4gIF9tYXBCdWxrOiBmdW5jdGlvbihkYXRhLCBvcHRzLCBjYWxsYmFjaykge1xuICAgIHV0aWwuZXh0ZW5kKG9wdHMsIHttb2RlbDogdGhpcywgZGF0YTogZGF0YX0pO1xuICAgIHZhciBvcCA9IG5ldyBNYXBwaW5nT3BlcmF0aW9uKG9wdHMpO1xuICAgIG9wLnN0YXJ0KGZ1bmN0aW9uKGVyciwgb2JqZWN0cykge1xuICAgICAgaWYgKGVycikge1xuICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVycik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjYWxsYmFjayhudWxsLCBvYmplY3RzIHx8IFtdKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcbiAgX2NvdW50Q2FjaGU6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBjb2xsQ2FjaGUgPSBjYWNoZS5fbG9jYWxDYWNoZUJ5VHlwZVt0aGlzLmNvbGxlY3Rpb25OYW1lXSB8fCB7fTtcbiAgICB2YXIgbW9kZWxDYWNoZSA9IGNvbGxDYWNoZVt0aGlzLm5hbWVdIHx8IHt9O1xuICAgIHJldHVybiBPYmplY3Qua2V5cyhtb2RlbENhY2hlKS5yZWR1Y2UoZnVuY3Rpb24obSwgbG9jYWxJZCkge1xuICAgICAgbVtsb2NhbElkXSA9IHt9O1xuICAgICAgcmV0dXJuIG07XG4gICAgfSwge30pO1xuICB9LFxuICBjb3VudDogZnVuY3Rpb24oY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgY2IobnVsbCwgT2JqZWN0LmtleXModGhpcy5fY291bnRDYWNoZSgpKS5sZW5ndGgpO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG4gIF9kdW1wOiBmdW5jdGlvbihhc0pTT04pIHtcbiAgICB2YXIgZHVtcGVkID0ge307XG4gICAgZHVtcGVkLm5hbWUgPSB0aGlzLm5hbWU7XG4gICAgZHVtcGVkLmF0dHJpYnV0ZXMgPSB0aGlzLmF0dHJpYnV0ZXM7XG4gICAgZHVtcGVkLmlkID0gdGhpcy5pZDtcbiAgICBkdW1wZWQuY29sbGVjdGlvbiA9IHRoaXMuY29sbGVjdGlvbk5hbWU7XG4gICAgZHVtcGVkLnJlbGF0aW9uc2hpcHMgPSB0aGlzLnJlbGF0aW9uc2hpcHMubWFwKGZ1bmN0aW9uKHIpIHtcbiAgICAgIHJldHVybiByLmlzRm9yd2FyZCA/IHIuZm9yd2FyZE5hbWUgOiByLnJldmVyc2VOYW1lO1xuICAgIH0pO1xuICAgIHJldHVybiBhc0pTT04gPyB1dGlsLnByZXR0eVByaW50KGR1bXBlZCkgOiBkdW1wZWQ7XG4gIH0sXG4gIHRvU3RyaW5nOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gJ01vZGVsWycgKyB0aGlzLm5hbWUgKyAnXSc7XG4gIH0sXG4gIHJlbW92ZUFsbDogZnVuY3Rpb24oY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgdGhpcy5hbGwoKVxuICAgICAgICAudGhlbihmdW5jdGlvbihpbnN0YW5jZXMpIHtcbiAgICAgICAgICBpbnN0YW5jZXMucmVtb3ZlKCk7XG4gICAgICAgICAgY2IoKTtcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGNiKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9XG5cbn0pO1xuXG4vLyBTdWJjbGFzc2luZ1xudXRpbC5leHRlbmQoTW9kZWwucHJvdG90eXBlLCB7XG4gIGNoaWxkOiBmdW5jdGlvbihuYW1lT3JPcHRzLCBvcHRzKSB7XG4gICAgaWYgKHR5cGVvZiBuYW1lT3JPcHRzID09ICdzdHJpbmcnKSB7XG4gICAgICBvcHRzLm5hbWUgPSBuYW1lT3JPcHRzO1xuICAgIH0gZWxzZSB7XG4gICAgICBvcHRzID0gbmFtZTtcbiAgICB9XG4gICAgdXRpbC5leHRlbmQob3B0cywge1xuICAgICAgYXR0cmlidXRlczogQXJyYXkucHJvdG90eXBlLmNvbmNhdC5jYWxsKG9wdHMuYXR0cmlidXRlcyB8fCBbXSwgdGhpcy5fb3B0cy5hdHRyaWJ1dGVzKSxcbiAgICAgIHJlbGF0aW9uc2hpcHM6IHV0aWwuZXh0ZW5kKG9wdHMucmVsYXRpb25zaGlwcyB8fCB7fSwgdGhpcy5fb3B0cy5yZWxhdGlvbnNoaXBzKSxcbiAgICAgIG1ldGhvZHM6IHV0aWwuZXh0ZW5kKHV0aWwuZXh0ZW5kKHt9LCB0aGlzLl9vcHRzLm1ldGhvZHMpIHx8IHt9LCBvcHRzLm1ldGhvZHMpLFxuICAgICAgc3RhdGljczogdXRpbC5leHRlbmQodXRpbC5leHRlbmQoe30sIHRoaXMuX29wdHMuc3RhdGljcykgfHwge30sIG9wdHMuc3RhdGljcyksXG4gICAgICBwcm9wZXJ0aWVzOiB1dGlsLmV4dGVuZCh1dGlsLmV4dGVuZCh7fSwgdGhpcy5fb3B0cy5wcm9wZXJ0aWVzKSB8fCB7fSwgb3B0cy5wcm9wZXJ0aWVzKSxcbiAgICAgIGlkOiBvcHRzLmlkIHx8IHRoaXMuX29wdHMuaWQsXG4gICAgICBpbml0OiBvcHRzLmluaXQgfHwgdGhpcy5fb3B0cy5pbml0LFxuICAgICAgcmVtb3ZlOiBvcHRzLnJlbW92ZSB8fCB0aGlzLl9vcHRzLnJlbW92ZSxcbiAgICAgIHNlcmlhbGlzZTogb3B0cy5zZXJpYWxpc2UgfHwgdGhpcy5fb3B0cy5zZXJpYWxpc2UsXG4gICAgICBzZXJpYWxpc2VGaWVsZDogb3B0cy5zZXJpYWxpc2VGaWVsZCB8fCB0aGlzLl9vcHRzLnNlcmlhbGlzZUZpZWxkLFxuICAgICAgcGFyc2VBdHRyaWJ1dGU6IG9wdHMucGFyc2VBdHRyaWJ1dGUgfHwgdGhpcy5fb3B0cy5wYXJzZUF0dHJpYnV0ZVxuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMuX29wdHMuc2VyaWFsaXNhYmxlRmllbGRzKSB7XG4gICAgICBvcHRzLnNlcmlhbGlzYWJsZUZpZWxkcyA9IEFycmF5LnByb3RvdHlwZS5jb25jYXQuYXBwbHkob3B0cy5zZXJpYWxpc2FibGVGaWVsZHMgfHwgW10sIHRoaXMuX29wdHMuc2VyaWFsaXNhYmxlRmllbGRzKTtcbiAgICB9XG5cbiAgICB2YXIgbW9kZWwgPSB0aGlzLmNvbGxlY3Rpb24ubW9kZWwob3B0cy5uYW1lLCBvcHRzKTtcbiAgICBtb2RlbC5wYXJlbnQgPSB0aGlzO1xuICAgIHRoaXMuY2hpbGRyZW4ucHVzaChtb2RlbCk7XG4gICAgcmV0dXJuIG1vZGVsO1xuICB9LFxuICBpc0NoaWxkT2Y6IGZ1bmN0aW9uKHBhcmVudCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudCA9PSBwYXJlbnQ7XG4gIH0sXG4gIGlzUGFyZW50T2Y6IGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgcmV0dXJuIHRoaXMuY2hpbGRyZW4uaW5kZXhPZihjaGlsZCkgPiAtMTtcbiAgfSxcbiAgaXNEZXNjZW5kYW50T2Y6IGZ1bmN0aW9uKGFuY2VzdG9yKSB7XG4gICAgdmFyIHBhcmVudCA9IHRoaXMucGFyZW50O1xuICAgIHdoaWxlIChwYXJlbnQpIHtcbiAgICAgIGlmIChwYXJlbnQgPT0gYW5jZXN0b3IpIHJldHVybiB0cnVlO1xuICAgICAgcGFyZW50ID0gcGFyZW50LnBhcmVudDtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9LFxuICBpc0FuY2VzdG9yT2Y6IGZ1bmN0aW9uKGRlc2NlbmRhbnQpIHtcbiAgICByZXR1cm4gdGhpcy5kZXNjZW5kYW50cy5pbmRleE9mKGRlc2NlbmRhbnQpID4gLTE7XG4gIH0sXG4gIGhhc0F0dHJpYnV0ZU5hbWVkOiBmdW5jdGlvbihhdHRyaWJ1dGVOYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMuX2F0dHJpYnV0ZU5hbWVzLmluZGV4T2YoYXR0cmlidXRlTmFtZSkgPiAtMTtcbiAgfVxufSk7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBNb2RlbDtcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL21vZGVsLmpzXG4gKiogbW9kdWxlIGlkID0gNVxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiLyoqXG4gKiBVc2VycyBzaG91bGQgbmV2ZXIgc2VlIHRoZXNlIHRocm93bi4gQSBidWcgcmVwb3J0IHNob3VsZCBiZSBmaWxlZCBpZiBzbyBhcyBpdCBtZWFucyBzb21lIGFzc2VydGlvbiBoYXMgZmFpbGVkLlxuICogQHBhcmFtIG1lc3NhZ2VcbiAqIEBwYXJhbSBjb250ZXh0XG4gKiBAcGFyYW0gc3NmXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gSW50ZXJuYWxTaWVzdGFFcnJvcihtZXNzYWdlLCBjb250ZXh0LCBzc2YpIHtcbiAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcbiAgdGhpcy5jb250ZXh0ID0gY29udGV4dDtcbiAgLy8gY2FwdHVyZSBzdGFjayB0cmFjZVxuICBpZiAoc3NmICYmIEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKSB7XG4gICAgRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UodGhpcywgc3NmKTtcbiAgfVxufVxuXG5JbnRlcm5hbFNpZXN0YUVycm9yLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRXJyb3IucHJvdG90eXBlKTtcbkludGVybmFsU2llc3RhRXJyb3IucHJvdG90eXBlLm5hbWUgPSAnSW50ZXJuYWxTaWVzdGFFcnJvcic7XG5JbnRlcm5hbFNpZXN0YUVycm9yLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IEludGVybmFsU2llc3RhRXJyb3I7XG5cbmZ1bmN0aW9uIGlzU2llc3RhRXJyb3IoZXJyKSB7XG4gIGlmICh0eXBlb2YgZXJyID09ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuICdlcnJvcicgaW4gZXJyICYmICdvaycgaW4gZXJyICYmICdyZWFzb24nIGluIGVycjtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZXJyTWVzc2FnZSwgZXh0cmEpIHtcbiAgaWYgKGlzU2llc3RhRXJyb3IoZXJyTWVzc2FnZSkpIHtcbiAgICByZXR1cm4gZXJyTWVzc2FnZTtcbiAgfVxuICB2YXIgZXJyID0ge1xuICAgIHJlYXNvbjogZXJyTWVzc2FnZSxcbiAgICBlcnJvcjogdHJ1ZSxcbiAgICBvazogZmFsc2VcbiAgfTtcbiAgZm9yICh2YXIgcHJvcCBpbiBleHRyYSB8fCB7fSkge1xuICAgIGlmIChleHRyYS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkgZXJyW3Byb3BdID0gZXh0cmFbcHJvcF07XG4gIH1cbiAgZXJyLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHRoaXMpO1xuICB9O1xuICByZXR1cm4gZXJyO1xufTtcblxubW9kdWxlLmV4cG9ydHMuSW50ZXJuYWxTaWVzdGFFcnJvciA9IEludGVybmFsU2llc3RhRXJyb3I7XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvZXJyb3IuanNcbiAqKiBtb2R1bGUgaWQgPSA2XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyLFxuICBBcnJheU9ic2VydmVyID0gcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5BcnJheU9ic2VydmVyLFxuICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gIGFyZ3NhcnJheSA9IHJlcXVpcmUoJ2FyZ3NhcnJheScpLFxuICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgQ2hhaW4gPSByZXF1aXJlKCcuL0NoYWluJyk7XG5cbnZhciBldmVudEVtaXR0ZXIgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XG5ldmVudEVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKDEwMCk7XG5cbi8qKlxuICogTGlzdGVuIHRvIGEgcGFydGljdWxhciBldmVudCBmcm9tIHRoZSBTaWVzdGEgZ2xvYmFsIEV2ZW50RW1pdHRlci5cbiAqIE1hbmFnZXMgaXRzIG93biBzZXQgb2YgbGlzdGVuZXJzLlxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIFByb3h5RXZlbnRFbWl0dGVyKGV2ZW50LCBjaGFpbk9wdHMpIHtcbiAgdXRpbC5leHRlbmQodGhpcywge1xuICAgIGV2ZW50OiBldmVudCxcbiAgICBsaXN0ZW5lcnM6IHt9XG4gIH0pO1xuICB2YXIgZGVmYXVsdENoYWluT3B0cyA9IHt9O1xuXG4gIGRlZmF1bHRDaGFpbk9wdHMub24gPSB0aGlzLm9uLmJpbmQodGhpcyk7XG4gIGRlZmF1bHRDaGFpbk9wdHMub25jZSA9IHRoaXMub25jZS5iaW5kKHRoaXMpO1xuXG4gIENoYWluLmNhbGwodGhpcywgdXRpbC5leHRlbmQoZGVmYXVsdENoYWluT3B0cywgY2hhaW5PcHRzIHx8IHt9KSk7XG59XG5cblByb3h5RXZlbnRFbWl0dGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoQ2hhaW4ucHJvdG90eXBlKTtcblxudXRpbC5leHRlbmQoUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlLCB7XG4gIG9uOiBmdW5jdGlvbih0eXBlLCBmbikge1xuICAgIGlmICh0eXBlb2YgdHlwZSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICBmbiA9IHR5cGU7XG4gICAgICB0eXBlID0gbnVsbDtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBpZiAodHlwZS50cmltKCkgPT0gJyonKSB0eXBlID0gbnVsbDtcbiAgICAgIHZhciBfZm4gPSBmbjtcbiAgICAgIGZuID0gZnVuY3Rpb24oZSkge1xuICAgICAgICBlID0gZSB8fCB7fTtcbiAgICAgICAgaWYgKHR5cGUpIHtcbiAgICAgICAgICBpZiAoZS50eXBlID09IHR5cGUpIHtcbiAgICAgICAgICAgIF9mbihlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgX2ZuKGUpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgdmFyIGxpc3RlbmVycyA9IHRoaXMubGlzdGVuZXJzO1xuICAgICAgaWYgKHR5cGUpIHtcbiAgICAgICAgaWYgKCFsaXN0ZW5lcnNbdHlwZV0pIGxpc3RlbmVyc1t0eXBlXSA9IFtdO1xuICAgICAgICBsaXN0ZW5lcnNbdHlwZV0ucHVzaChmbik7XG4gICAgICB9XG4gICAgfVxuICAgIGV2ZW50RW1pdHRlci5vbih0aGlzLmV2ZW50LCBmbik7XG4gICAgcmV0dXJuIHRoaXMuX2hhbmRsZXJMaW5rKHtcbiAgICAgIGZuOiBmbixcbiAgICAgIHR5cGU6IHR5cGUsXG4gICAgICBleHRlbmQ6IHRoaXMucHJveHlDaGFpbk9wdHNcbiAgICB9KTtcbiAgfSxcbiAgb25jZTogZnVuY3Rpb24odHlwZSwgZm4pIHtcbiAgICB2YXIgZXZlbnQgPSB0aGlzLmV2ZW50O1xuICAgIGlmICh0eXBlb2YgdHlwZSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICBmbiA9IHR5cGU7XG4gICAgICB0eXBlID0gbnVsbDtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBpZiAodHlwZS50cmltKCkgPT0gJyonKSB0eXBlID0gbnVsbDtcbiAgICAgIHZhciBfZm4gPSBmbjtcbiAgICAgIGZuID0gZnVuY3Rpb24oZSkge1xuICAgICAgICBlID0gZSB8fCB7fTtcbiAgICAgICAgaWYgKHR5cGUpIHtcbiAgICAgICAgICBpZiAoZS50eXBlID09IHR5cGUpIHtcbiAgICAgICAgICAgIGV2ZW50RW1pdHRlci5yZW1vdmVMaXN0ZW5lcihldmVudCwgZm4pO1xuICAgICAgICAgICAgX2ZuKGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBfZm4oZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHR5cGUpIHJldHVybiBldmVudEVtaXR0ZXIub24oZXZlbnQsIGZuKTtcbiAgICBlbHNlIHJldHVybiBldmVudEVtaXR0ZXIub25jZShldmVudCwgZm4pO1xuICB9LFxuICBfcmVtb3ZlTGlzdGVuZXI6IGZ1bmN0aW9uKGZuLCB0eXBlKSB7XG4gICAgaWYgKHR5cGUpIHtcbiAgICAgIHZhciBsaXN0ZW5lcnMgPSB0aGlzLmxpc3RlbmVyc1t0eXBlXSxcbiAgICAgICAgaWR4ID0gbGlzdGVuZXJzLmluZGV4T2YoZm4pO1xuICAgICAgbGlzdGVuZXJzLnNwbGljZShpZHgsIDEpO1xuICAgIH1cbiAgICByZXR1cm4gZXZlbnRFbWl0dGVyLnJlbW92ZUxpc3RlbmVyKHRoaXMuZXZlbnQsIGZuKTtcbiAgfSxcbiAgZW1pdDogZnVuY3Rpb24odHlwZSwgcGF5bG9hZCkge1xuICAgIGlmICh0eXBlb2YgdHlwZSA9PSAnb2JqZWN0Jykge1xuICAgICAgcGF5bG9hZCA9IHR5cGU7XG4gICAgICB0eXBlID0gbnVsbDtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBwYXlsb2FkID0gcGF5bG9hZCB8fCB7fTtcbiAgICAgIHBheWxvYWQudHlwZSA9IHR5cGU7XG4gICAgfVxuICAgIGV2ZW50RW1pdHRlci5lbWl0LmNhbGwoZXZlbnRFbWl0dGVyLCB0aGlzLmV2ZW50LCBwYXlsb2FkKTtcbiAgfSxcbiAgX3JlbW92ZUFsbExpc3RlbmVyczogZnVuY3Rpb24odHlwZSkge1xuICAgICh0aGlzLmxpc3RlbmVyc1t0eXBlXSB8fCBbXSkuZm9yRWFjaChmdW5jdGlvbihmbikge1xuICAgICAgZXZlbnRFbWl0dGVyLnJlbW92ZUxpc3RlbmVyKHRoaXMuZXZlbnQsIGZuKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICAgIHRoaXMubGlzdGVuZXJzW3R5cGVdID0gW107XG4gIH0sXG4gIHJlbW92ZUFsbExpc3RlbmVyczogZnVuY3Rpb24odHlwZSkge1xuICAgIGlmICh0eXBlKSB7XG4gICAgICB0aGlzLl9yZW1vdmVBbGxMaXN0ZW5lcnModHlwZSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgZm9yICh0eXBlIGluIHRoaXMubGlzdGVuZXJzKSB7XG4gICAgICAgIGlmICh0aGlzLmxpc3RlbmVycy5oYXNPd25Qcm9wZXJ0eSh0eXBlKSkge1xuICAgICAgICAgIHRoaXMuX3JlbW92ZUFsbExpc3RlbmVycyh0eXBlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufSk7XG5cbnV0aWwuZXh0ZW5kKGV2ZW50RW1pdHRlciwge1xuICBQcm94eUV2ZW50RW1pdHRlcjogUHJveHlFdmVudEVtaXR0ZXIsXG4gIHdyYXBBcnJheTogZnVuY3Rpb24oYXJyYXksIGZpZWxkLCBtb2RlbEluc3RhbmNlKSB7XG4gICAgaWYgKCFhcnJheS5vYnNlcnZlcikge1xuICAgICAgYXJyYXkub2JzZXJ2ZXIgPSBuZXcgQXJyYXlPYnNlcnZlcihhcnJheSk7XG4gICAgICBhcnJheS5vYnNlcnZlci5vcGVuKGZ1bmN0aW9uKHNwbGljZXMpIHtcbiAgICAgICAgdmFyIGZpZWxkSXNBdHRyaWJ1dGUgPSBtb2RlbEluc3RhbmNlLl9hdHRyaWJ1dGVOYW1lcy5pbmRleE9mKGZpZWxkKSA+IC0xO1xuICAgICAgICBpZiAoZmllbGRJc0F0dHJpYnV0ZSkge1xuICAgICAgICAgIHNwbGljZXMuZm9yRWFjaChmdW5jdGlvbihzcGxpY2UpIHtcbiAgICAgICAgICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBtb2RlbEluc3RhbmNlLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICBtb2RlbDogbW9kZWxJbnN0YW5jZS5tb2RlbC5uYW1lLFxuICAgICAgICAgICAgICBsb2NhbElkOiBtb2RlbEluc3RhbmNlLmxvY2FsSWQsXG4gICAgICAgICAgICAgIGluZGV4OiBzcGxpY2UuaW5kZXgsXG4gICAgICAgICAgICAgIHJlbW92ZWQ6IHNwbGljZS5yZW1vdmVkLFxuICAgICAgICAgICAgICBhZGRlZDogc3BsaWNlLmFkZGVkQ291bnQgPyBhcnJheS5zbGljZShzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50KSA6IFtdLFxuICAgICAgICAgICAgICB0eXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgICAgICAgIGZpZWxkOiBmaWVsZCxcbiAgICAgICAgICAgICAgb2JqOiBtb2RlbEluc3RhbmNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG59KTtcblxudmFyIG9sZEVtaXQgPSBldmVudEVtaXR0ZXIuZW1pdDtcblxuLy8gRW5zdXJlIHRoYXQgZXJyb3JzIGluIGV2ZW50IGhhbmRsZXJzIGRvIG5vdCBzdGFsbCBTaWVzdGEuXG5ldmVudEVtaXR0ZXIuZW1pdCA9IGZ1bmN0aW9uKGV2ZW50LCBwYXlsb2FkKSB7XG4gIHRyeSB7XG4gICAgb2xkRW1pdC5jYWxsKGV2ZW50RW1pdHRlciwgZXZlbnQsIHBheWxvYWQpO1xuICB9XG4gIGNhdGNoIChlKSB7XG4gICAgY29uc29sZS5lcnJvcihlKTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBldmVudEVtaXR0ZXI7XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvZXZlbnRzLmpzXG4gKiogbW9kdWxlIGlkID0gN1xuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gIE9uZVRvTWFueTogJ09uZVRvTWFueScsXG4gIE9uZVRvT25lOiAnT25lVG9PbmUnLFxuICBNYW55VG9NYW55OiAnTWFueVRvTWFueSdcbn07XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvUmVsYXRpb25zaGlwVHlwZS5qc1xuICoqIG1vZHVsZSBpZCA9IDhcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIi8qKlxuICogRm9yIHRob3NlIGZhbWlsaWFyIHdpdGggQXBwbGUncyBDb2NvYSBsaWJyYXJ5LCByZWFjdGl2ZSBxdWVyaWVzIHJvdWdobHkgbWFwIG9udG8gTlNGZXRjaGVkUmVzdWx0c0NvbnRyb2xsZXIuXG4gKlxuICogVGhleSBwcmVzZW50IGEgcXVlcnkgc2V0IHRoYXQgJ3JlYWN0cycgdG8gY2hhbmdlcyBpbiB0aGUgdW5kZXJseWluZyBkYXRhLlxuICogQG1vZHVsZSByZWFjdGl2ZVF1ZXJ5XG4gKi9cblxudmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ3F1ZXJ5OnJlYWN0aXZlJyksXG4gIFF1ZXJ5ID0gcmVxdWlyZSgnLi9RdWVyeScpLFxuICBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXIsXG4gIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gIENoYWluID0gcmVxdWlyZSgnLi9DaGFpbicpLFxuICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICBjb25zdHJ1Y3RRdWVyeVNldCA9IHJlcXVpcmUoJy4vUXVlcnlTZXQnKSxcbiAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xuXG4vKipcbiAqXG4gKiBAcGFyYW0ge1F1ZXJ5fSBxdWVyeSAtIFRoZSB1bmRlcmx5aW5nIHF1ZXJ5XG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gUmVhY3RpdmVRdWVyeShxdWVyeSkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIEV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xuICBDaGFpbi5jYWxsKHRoaXMpO1xuICB1dGlsLmV4dGVuZCh0aGlzLCB7XG4gICAgaW5zZXJ0aW9uUG9saWN5OiBSZWFjdGl2ZVF1ZXJ5Lkluc2VydGlvblBvbGljeS5CYWNrLFxuICAgIGluaXRpYWxpc2VkOiBmYWxzZVxuICB9KTtcblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ3F1ZXJ5Jywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5fcXVlcnlcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odikge1xuICAgICAgaWYgKHYpIHtcbiAgICAgICAgdGhpcy5fcXVlcnkgPSB2O1xuICAgICAgICB0aGlzLnJlc3VsdHMgPSBjb25zdHJ1Y3RRdWVyeVNldChbXSwgdi5tb2RlbCk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdGhpcy5fcXVlcnkgPSBudWxsO1xuICAgICAgICB0aGlzLnJlc3VsdHMgPSBudWxsO1xuICAgICAgfVxuICAgIH0sXG4gICAgY29uZmlndXJhYmxlOiBmYWxzZSxcbiAgICBlbnVtZXJhYmxlOiB0cnVlXG4gIH0pO1xuXG4gIGlmIChxdWVyeSkge1xuICAgIHV0aWwuZXh0ZW5kKHRoaXMsIHtcbiAgICAgIF9xdWVyeTogcXVlcnksXG4gICAgICByZXN1bHRzOiBjb25zdHJ1Y3RRdWVyeVNldChbXSwgcXVlcnkubW9kZWwpXG4gICAgfSlcbiAgfVxuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICBpbml0aWFsaXplZDoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaW5pdGlhbGlzZWRcbiAgICAgIH1cbiAgICB9LFxuICAgIG1vZGVsOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgcXVlcnkgPSBzZWxmLl9xdWVyeTtcbiAgICAgICAgaWYgKHF1ZXJ5KSB7XG4gICAgICAgICAgcmV0dXJuIHF1ZXJ5Lm1vZGVsXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIGNvbGxlY3Rpb246IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBzZWxmLm1vZGVsLmNvbGxlY3Rpb25OYW1lXG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuXG59XG5cblJlYWN0aXZlUXVlcnkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFdmVudEVtaXR0ZXIucHJvdG90eXBlKTtcbnV0aWwuZXh0ZW5kKFJlYWN0aXZlUXVlcnkucHJvdG90eXBlLCBDaGFpbi5wcm90b3R5cGUpO1xuXG51dGlsLmV4dGVuZChSZWFjdGl2ZVF1ZXJ5LCB7XG4gIEluc2VydGlvblBvbGljeToge1xuICAgIEZyb250OiAnRnJvbnQnLFxuICAgIEJhY2s6ICdCYWNrJ1xuICB9XG59KTtcblxudXRpbC5leHRlbmQoUmVhY3RpdmVRdWVyeS5wcm90b3R5cGUsIHtcbiAgLyoqXG4gICAqXG4gICAqIEBwYXJhbSBjYlxuICAgKiBAcGFyYW0ge2Jvb2x9IF9pZ25vcmVJbml0IC0gZXhlY3V0ZSBxdWVyeSBhZ2FpbiwgaW5pdGlhbGlzZWQgb3Igbm90LlxuICAgKiBAcmV0dXJucyB7Kn1cbiAgICovXG4gIGluaXQ6IGZ1bmN0aW9uKGNiLCBfaWdub3JlSW5pdCkge1xuICAgIGlmICh0aGlzLl9xdWVyeSkge1xuICAgICAgdmFyIG5hbWUgPSB0aGlzLl9jb25zdHJ1Y3ROb3RpZmljYXRpb25OYW1lKCk7XG4gICAgICB2YXIgaGFuZGxlciA9IGZ1bmN0aW9uKG4pIHtcbiAgICAgICAgdGhpcy5faGFuZGxlTm90aWYobik7XG4gICAgICB9LmJpbmQodGhpcyk7XG4gICAgICB0aGlzLmhhbmRsZXIgPSBoYW5kbGVyO1xuICAgICAgZXZlbnRzLm9uKG5hbWUsIGhhbmRsZXIpO1xuICAgICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgaWYgKCghdGhpcy5pbml0aWFsaXNlZCkgfHwgX2lnbm9yZUluaXQpIHtcbiAgICAgICAgICB0aGlzLl9xdWVyeS5leGVjdXRlKGZ1bmN0aW9uKGVyciwgcmVzdWx0cykge1xuICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgY2IobnVsbCwgdGhpcy5fYXBwbHlSZXN1bHRzKHJlc3VsdHMpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICBjYihlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgY2IobnVsbCwgdGhpcy5yZXN1bHRzKTtcbiAgICAgICAgfVxuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG4gICAgZWxzZSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gX3F1ZXJ5IGRlZmluZWQnKTtcbiAgfSxcbiAgX2FwcGx5UmVzdWx0czogZnVuY3Rpb24ocmVzdWx0cykge1xuICAgIHRoaXMucmVzdWx0cyA9IHJlc3VsdHM7XG4gICAgdGhpcy5pbml0aWFsaXNlZCA9IHRydWU7XG4gICAgcmV0dXJuIHRoaXMucmVzdWx0cztcbiAgfSxcbiAgaW5zZXJ0OiBmdW5jdGlvbihuZXdPYmopIHtcbiAgICB2YXIgcmVzdWx0cyA9IHRoaXMucmVzdWx0cy5tdXRhYmxlQ29weSgpO1xuICAgIGlmICh0aGlzLmluc2VydGlvblBvbGljeSA9PSBSZWFjdGl2ZVF1ZXJ5Lkluc2VydGlvblBvbGljeS5CYWNrKSB2YXIgaWR4ID0gcmVzdWx0cy5wdXNoKG5ld09iaik7XG4gICAgZWxzZSBpZHggPSByZXN1bHRzLnVuc2hpZnQobmV3T2JqKTtcbiAgICB0aGlzLnJlc3VsdHMgPSByZXN1bHRzLmFzTW9kZWxRdWVyeVNldCh0aGlzLm1vZGVsKTtcbiAgICByZXR1cm4gaWR4O1xuICB9LFxuICAvKipcbiAgICogRXhlY3V0ZSB0aGUgdW5kZXJseWluZyBxdWVyeSBhZ2Fpbi5cbiAgICogQHBhcmFtIGNiXG4gICAqL1xuICB1cGRhdGU6IGZ1bmN0aW9uKGNiKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5pdChjYiwgdHJ1ZSlcbiAgfSxcbiAgX2hhbmRsZU5vdGlmOiBmdW5jdGlvbihuKSB7XG4gICAgaWYgKG4udHlwZSA9PSBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5OZXcpIHtcbiAgICAgIHZhciBuZXdPYmogPSBuLm5ldztcbiAgICAgIGlmICh0aGlzLl9xdWVyeS5vYmplY3RNYXRjaGVzUXVlcnkobmV3T2JqKSkge1xuICAgICAgICBsb2coJ05ldyBvYmplY3QgbWF0Y2hlcycsIG5ld09iaik7XG4gICAgICAgIHZhciBpZHggPSB0aGlzLmluc2VydChuZXdPYmopO1xuICAgICAgICB0aGlzLmVtaXQobW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLCB7XG4gICAgICAgICAgaW5kZXg6IGlkeCxcbiAgICAgICAgICBhZGRlZDogW25ld09ial0sXG4gICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgIG9iajogdGhpc1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBsb2coJ05ldyBvYmplY3QgZG9lcyBub3QgbWF0Y2gnLCBuZXdPYmopO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIGlmIChuLnR5cGUgPT0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU2V0KSB7XG4gICAgICBuZXdPYmogPSBuLm9iajtcbiAgICAgIHZhciBpbmRleCA9IHRoaXMucmVzdWx0cy5pbmRleE9mKG5ld09iaiksXG4gICAgICAgIGFscmVhZHlDb250YWlucyA9IGluZGV4ID4gLTEsXG4gICAgICAgIG1hdGNoZXMgPSB0aGlzLl9xdWVyeS5vYmplY3RNYXRjaGVzUXVlcnkobmV3T2JqKTtcbiAgICAgIGlmIChtYXRjaGVzICYmICFhbHJlYWR5Q29udGFpbnMpIHtcbiAgICAgICAgbG9nKCdVcGRhdGVkIG9iamVjdCBub3cgbWF0Y2hlcyEnLCBuZXdPYmopO1xuICAgICAgICBpZHggPSB0aGlzLmluc2VydChuZXdPYmopO1xuICAgICAgICB0aGlzLmVtaXQobW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLCB7XG4gICAgICAgICAgaW5kZXg6IGlkeCxcbiAgICAgICAgICBhZGRlZDogW25ld09ial0sXG4gICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgIG9iajogdGhpc1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKCFtYXRjaGVzICYmIGFscmVhZHlDb250YWlucykge1xuICAgICAgICBsb2coJ1VwZGF0ZWQgb2JqZWN0IG5vIGxvbmdlciBtYXRjaGVzIScsIG5ld09iaik7XG4gICAgICAgIHJlc3VsdHMgPSB0aGlzLnJlc3VsdHMubXV0YWJsZUNvcHkoKTtcbiAgICAgICAgdmFyIHJlbW92ZWQgPSByZXN1bHRzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIHRoaXMucmVzdWx0cyA9IHJlc3VsdHMuYXNNb2RlbFF1ZXJ5U2V0KHRoaXMubW9kZWwpO1xuICAgICAgICB0aGlzLmVtaXQobW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLCB7XG4gICAgICAgICAgaW5kZXg6IGluZGV4LFxuICAgICAgICAgIG9iajogdGhpcyxcbiAgICAgICAgICBuZXc6IG5ld09iaixcbiAgICAgICAgICB0eXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgICAgcmVtb3ZlZDogcmVtb3ZlZFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKCFtYXRjaGVzICYmICFhbHJlYWR5Q29udGFpbnMpIHtcbiAgICAgICAgbG9nKCdEb2VzIG5vdCBjb250YWluLCBidXQgZG9lc250IG1hdGNoIHNvIG5vdCBpbnNlcnRpbmcnLCBuZXdPYmopO1xuICAgICAgfVxuICAgICAgZWxzZSBpZiAobWF0Y2hlcyAmJiBhbHJlYWR5Q29udGFpbnMpIHtcbiAgICAgICAgbG9nKCdNYXRjaGVzIGJ1dCBhbHJlYWR5IGNvbnRhaW5zJywgbmV3T2JqKTtcbiAgICAgICAgLy8gU2VuZCB0aGUgbm90aWZpY2F0aW9uIG92ZXIuXG4gICAgICAgIHRoaXMuZW1pdChuLnR5cGUsIG4pO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIGlmIChuLnR5cGUgPT0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuUmVtb3ZlKSB7XG4gICAgICBuZXdPYmogPSBuLm9iajtcbiAgICAgIHZhciByZXN1bHRzID0gdGhpcy5yZXN1bHRzLm11dGFibGVDb3B5KCk7XG4gICAgICBpbmRleCA9IHJlc3VsdHMuaW5kZXhPZihuZXdPYmopO1xuICAgICAgaWYgKGluZGV4ID4gLTEpIHtcbiAgICAgICAgbG9nKCdSZW1vdmluZyBvYmplY3QnLCBuZXdPYmopO1xuICAgICAgICByZW1vdmVkID0gcmVzdWx0cy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB0aGlzLnJlc3VsdHMgPSBjb25zdHJ1Y3RRdWVyeVNldChyZXN1bHRzLCB0aGlzLm1vZGVsKTtcbiAgICAgICAgdGhpcy5lbWl0KG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSwge1xuICAgICAgICAgIGluZGV4OiBpbmRleCxcbiAgICAgICAgICBvYmo6IHRoaXMsXG4gICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgIHJlbW92ZWQ6IHJlbW92ZWRcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgbG9nKCdObyBtb2RlbEV2ZW50cyBuZWNjZXNzYXJ5LicsIG5ld09iaik7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ1Vua25vd24gY2hhbmdlIHR5cGUgXCInICsgbi50eXBlLnRvU3RyaW5nKCkgKyAnXCInKVxuICAgIH1cbiAgICB0aGlzLnJlc3VsdHMgPSBjb25zdHJ1Y3RRdWVyeVNldCh0aGlzLl9xdWVyeS5fc29ydFJlc3VsdHModGhpcy5yZXN1bHRzKSwgdGhpcy5tb2RlbCk7XG4gIH0sXG4gIF9jb25zdHJ1Y3ROb3RpZmljYXRpb25OYW1lOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jb2xsZWN0aW9uTmFtZSArICc6JyArIHRoaXMubW9kZWwubmFtZTtcbiAgfSxcbiAgdGVybWluYXRlOiBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5oYW5kbGVyKSB7XG4gICAgICBldmVudHMucmVtb3ZlTGlzdGVuZXIodGhpcy5fY29uc3RydWN0Tm90aWZpY2F0aW9uTmFtZSgpLCB0aGlzLmhhbmRsZXIpO1xuICAgIH1cbiAgICB0aGlzLnJlc3VsdHMgPSBudWxsO1xuICAgIHRoaXMuaGFuZGxlciA9IG51bGw7XG4gIH0sXG4gIF9yZWdpc3RlckV2ZW50SGFuZGxlcjogZnVuY3Rpb24ob24sIG5hbWUsIGZuKSB7XG4gICAgdmFyIHJlbW92ZUxpc3RlbmVyID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lcjtcbiAgICBpZiAobmFtZS50cmltKCkgPT0gJyonKSB7XG4gICAgICBPYmplY3Qua2V5cyhtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZSkuZm9yRWFjaChmdW5jdGlvbihrKSB7XG4gICAgICAgIG9uLmNhbGwodGhpcywgbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGVba10sIGZuKTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgb24uY2FsbCh0aGlzLCBuYW1lLCBmbik7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9saW5rKHtcbiAgICAgICAgb246IHRoaXMub24uYmluZCh0aGlzKSxcbiAgICAgICAgb25jZTogdGhpcy5vbmNlLmJpbmQodGhpcyksXG4gICAgICAgIHVwZGF0ZTogdGhpcy51cGRhdGUuYmluZCh0aGlzKSxcbiAgICAgICAgaW5zZXJ0OiB0aGlzLmluc2VydC5iaW5kKHRoaXMpXG4gICAgICB9LFxuICAgICAgZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmIChuYW1lLnRyaW0oKSA9PSAnKicpIHtcbiAgICAgICAgICBPYmplY3Qua2V5cyhtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZSkuZm9yRWFjaChmdW5jdGlvbihrKSB7XG4gICAgICAgICAgICByZW1vdmVMaXN0ZW5lci5jYWxsKHRoaXMsIG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlW2tdLCBmbik7XG4gICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICByZW1vdmVMaXN0ZW5lci5jYWxsKHRoaXMsIG5hbWUsIGZuKTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgfSxcbiAgb246IGZ1bmN0aW9uKG5hbWUsIGZuKSB7XG4gICAgcmV0dXJuIHRoaXMuX3JlZ2lzdGVyRXZlbnRIYW5kbGVyKEV2ZW50RW1pdHRlci5wcm90b3R5cGUub24sIG5hbWUsIGZuKTtcbiAgfSxcbiAgb25jZTogZnVuY3Rpb24obmFtZSwgZm4pIHtcbiAgICByZXR1cm4gdGhpcy5fcmVnaXN0ZXJFdmVudEhhbmRsZXIoRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlLCBuYW1lLCBmbik7XG4gIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJlYWN0aXZlUXVlcnk7XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvUmVhY3RpdmVRdWVyeS5qc1xuICoqIG1vZHVsZSBpZCA9IDlcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIi8qKlxuICogQG1vZHVsZSByZWxhdGlvbnNoaXBzXG4gKi9cblxudmFyIFJlbGF0aW9uc2hpcFByb3h5ID0gcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBQcm94eScpLFxuICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzID0gZXZlbnRzLndyYXBBcnJheSxcbiAgQXJyYXlPYnNlcnZlciA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuQXJyYXlPYnNlcnZlcixcbiAgTW9kZWxFdmVudFR5cGUgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJykuTW9kZWxFdmVudFR5cGU7XG5cbi8qKlxuICogW01hbnlUb01hbnlQcm94eSBkZXNjcmlwdGlvbl1cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKi9cbmZ1bmN0aW9uIE1hbnlUb01hbnlQcm94eShvcHRzKSB7XG4gIFJlbGF0aW9uc2hpcFByb3h5LmNhbGwodGhpcywgb3B0cyk7XG4gIHRoaXMucmVsYXRlZCA9IFtdO1xuICB0aGlzLnJlbGF0ZWRDYW5jZWxMaXN0ZW5lcnMgPSB7fTtcbiAgaWYgKHRoaXMuaXNSZXZlcnNlKSB7XG4gICAgdGhpcy5yZWxhdGVkID0gW107XG4gICAgLy90aGlzLmZvcndhcmRNb2RlbC5vbihtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5SZW1vdmUsIGZ1bmN0aW9uKGUpIHtcbiAgICAvLyAgaWYgKGUuZmllbGQgPT0gZS5mb3J3YXJkTmFtZSkge1xuICAgIC8vICAgIHZhciBpZHggPSB0aGlzLnJlbGF0ZWQuaW5kZXhPZihlLm9iaik7XG4gICAgLy8gICAgaWYgKGlkeCA+IC0xKSB7XG4gICAgLy8gICAgICB2YXIgcmVtb3ZlZCA9IHRoaXMucmVsYXRlZC5zcGxpY2UoaWR4LCAxKTtcbiAgICAvLyAgICB9XG4gICAgLy8gICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgLy8gICAgICBjb2xsZWN0aW9uOiB0aGlzLnJldmVyc2VNb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAvLyAgICAgIG1vZGVsOiB0aGlzLnJldmVyc2VNb2RlbC5uYW1lLFxuICAgIC8vICAgICAgbG9jYWxJZDogdGhpcy5vYmplY3QubG9jYWxJZCxcbiAgICAvLyAgICAgIGZpZWxkOiB0aGlzLnJldmVyc2VOYW1lLFxuICAgIC8vICAgICAgcmVtb3ZlZDogcmVtb3ZlZCxcbiAgICAvLyAgICAgIGFkZGVkOiBbXSxcbiAgICAvLyAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAvLyAgICAgIGluZGV4OiBpZHgsXG4gICAgLy8gICAgICBvYmo6IHRoaXMub2JqZWN0XG4gICAgLy8gICAgfSk7XG4gICAgLy8gIH1cbiAgICAvL30uYmluZCh0aGlzKSk7XG4gIH1cbn1cblxuTWFueVRvTWFueVByb3h5LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlKTtcblxudXRpbC5leHRlbmQoTWFueVRvTWFueVByb3h5LnByb3RvdHlwZSwge1xuICBjbGVhclJldmVyc2U6IGZ1bmN0aW9uKHJlbW92ZWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgcmVtb3ZlZC5mb3JFYWNoKGZ1bmN0aW9uKHJlbW92ZWRPYmplY3QpIHtcbiAgICAgIHZhciByZXZlcnNlUHJveHkgPSBzZWxmLnJldmVyc2VQcm94eUZvckluc3RhbmNlKHJlbW92ZWRPYmplY3QpO1xuICAgICAgdmFyIGlkeCA9IHJldmVyc2VQcm94eS5yZWxhdGVkLmluZGV4T2Yoc2VsZi5vYmplY3QpO1xuICAgICAgcmV2ZXJzZVByb3h5Lm1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9ucyhmdW5jdGlvbigpIHtcbiAgICAgICAgcmV2ZXJzZVByb3h5LnNwbGljZShpZHgsIDEpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0sXG4gIHNldFJldmVyc2VPZkFkZGVkOiBmdW5jdGlvbihhZGRlZCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBhZGRlZC5mb3JFYWNoKGZ1bmN0aW9uKGFkZGVkT2JqZWN0KSB7XG4gICAgICB2YXIgcmV2ZXJzZVByb3h5ID0gc2VsZi5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZShhZGRlZE9iamVjdCk7XG4gICAgICByZXZlcnNlUHJveHkubWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXZlcnNlUHJveHkuc3BsaWNlKDAsIDAsIHNlbGYub2JqZWN0KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9LFxuICB3cmFwQXJyYXk6IGZ1bmN0aW9uKGFycikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzKGFyciwgdGhpcy5yZXZlcnNlTmFtZSwgdGhpcy5vYmplY3QpO1xuICAgIGlmICghYXJyLmFycmF5T2JzZXJ2ZXIpIHtcbiAgICAgIGFyci5hcnJheU9ic2VydmVyID0gbmV3IEFycmF5T2JzZXJ2ZXIoYXJyKTtcbiAgICAgIHZhciBvYnNlcnZlckZ1bmN0aW9uID0gZnVuY3Rpb24oc3BsaWNlcykge1xuICAgICAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24oc3BsaWNlKSB7XG4gICAgICAgICAgdmFyIGFkZGVkID0gc3BsaWNlLmFkZGVkQ291bnQgPyBhcnIuc2xpY2Uoc3BsaWNlLmluZGV4LCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkgOiBbXTtcbiAgICAgICAgICB2YXIgcmVtb3ZlZCA9IHNwbGljZS5yZW1vdmVkO1xuICAgICAgICAgIHNlbGYuY2xlYXJSZXZlcnNlKHJlbW92ZWQpO1xuICAgICAgICAgIHNlbGYuc2V0UmV2ZXJzZU9mQWRkZWQoYWRkZWQpO1xuICAgICAgICAgIHZhciBtb2RlbCA9IHNlbGYuZ2V0Rm9yd2FyZE1vZGVsKCk7XG4gICAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgICBjb2xsZWN0aW9uOiBtb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgIG1vZGVsOiBtb2RlbC5uYW1lLFxuICAgICAgICAgICAgbG9jYWxJZDogc2VsZi5vYmplY3QubG9jYWxJZCxcbiAgICAgICAgICAgIGZpZWxkOiBzZWxmLmdldEZvcndhcmROYW1lKCksXG4gICAgICAgICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgICAgICAgYWRkZWQ6IGFkZGVkLFxuICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgaW5kZXg6IHNwbGljZS5pbmRleCxcbiAgICAgICAgICAgIG9iajogc2VsZi5vYmplY3RcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgICAgYXJyLmFycmF5T2JzZXJ2ZXIub3BlbihvYnNlcnZlckZ1bmN0aW9uKTtcbiAgICB9XG4gIH0sXG4gIGdldDogZnVuY3Rpb24oY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgY2IobnVsbCwgdGhpcy5yZWxhdGVkKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuICB2YWxpZGF0ZTogZnVuY3Rpb24ob2JqKSB7XG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopICE9ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICAgIHJldHVybiAnQ2Fubm90IGFzc2lnbiBzY2FsYXIgdG8gbWFueSB0byBtYW55JztcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG4gIHNldDogZnVuY3Rpb24ob2JqLCBvcHRzKSB7XG4gICAgdGhpcy5jaGVja0luc3RhbGxlZCgpO1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAob2JqKSB7XG4gICAgICB2YXIgZXJyb3JNZXNzYWdlO1xuICAgICAgaWYgKGVycm9yTWVzc2FnZSA9IHRoaXMudmFsaWRhdGUob2JqKSkge1xuICAgICAgICByZXR1cm4gZXJyb3JNZXNzYWdlO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHRoaXMuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgICAgc2VsZi5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICAgICAgdGhpcy53cmFwQXJyYXkob2JqKTtcbiAgICAgICAgc2VsZi5zZXRJZEFuZFJlbGF0ZWRSZXZlcnNlKG9iaiwgb3B0cyk7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgc2VsZi5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICB9XG4gIH0sXG4gIGluc3RhbGw6IGZ1bmN0aW9uKG9iaikge1xuICAgIFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZS5pbnN0YWxsLmNhbGwodGhpcywgb2JqKTtcbiAgICB0aGlzLndyYXBBcnJheSh0aGlzLnJlbGF0ZWQpO1xuICAgIG9ialsoJ3NwbGljZScgKyB1dGlsLmNhcGl0YWxpc2VGaXJzdExldHRlcih0aGlzLnJldmVyc2VOYW1lKSldID0gdGhpcy5zcGxpY2UuYmluZCh0aGlzKTtcbiAgfSxcbiAgcmVnaXN0ZXJSZW1vdmFsTGlzdGVuZXI6IGZ1bmN0aW9uKG9iaikge1xuICAgIHRoaXMucmVsYXRlZENhbmNlbExpc3RlbmVyc1tvYmoubG9jYWxJZF0gPSBvYmoub24oJyonLCBmdW5jdGlvbihlKSB7XG5cbiAgICB9LmJpbmQodGhpcykpO1xuICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBNYW55VG9NYW55UHJveHk7XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvTWFueVRvTWFueVByb3h5LmpzXG4gKiogbW9kdWxlIGlkID0gMTBcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciBSZWxhdGlvbnNoaXBQcm94eSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwUHJveHknKSxcbiAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICBTaWVzdGFNb2RlbCA9IHJlcXVpcmUoJy4vTW9kZWxJbnN0YW5jZScpO1xuXG4vKipcbiAqIFtPbmVUb09uZVByb3h5IGRlc2NyaXB0aW9uXVxuICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAqL1xuZnVuY3Rpb24gT25lVG9PbmVQcm94eShvcHRzKSB7XG4gIFJlbGF0aW9uc2hpcFByb3h5LmNhbGwodGhpcywgb3B0cyk7XG59XG5cblxuT25lVG9PbmVQcm94eS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSk7XG5cbnV0aWwuZXh0ZW5kKE9uZVRvT25lUHJveHkucHJvdG90eXBlLCB7XG4gIC8qKlxuICAgKiBWYWxpZGF0ZSB0aGUgb2JqZWN0IHRoYXQgd2UncmUgc2V0dGluZ1xuICAgKiBAcGFyYW0gb2JqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd8bnVsbH0gQW4gZXJyb3IgbWVzc2FnZSBvciBudWxsXG4gICAqL1xuICB2YWxpZGF0ZTogZnVuY3Rpb24ob2JqKSB7XG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopID09ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICAgIHJldHVybiAnQ2Fubm90IGFzc2lnbiBhcnJheSB0byBvbmUgdG8gb25lIHJlbGF0aW9uc2hpcCc7XG4gICAgfVxuICAgIGVsc2UgaWYgKCghb2JqIGluc3RhbmNlb2YgU2llc3RhTW9kZWwpKSB7XG5cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG4gIHNldDogZnVuY3Rpb24ob2JqLCBvcHRzKSB7XG4gICAgdGhpcy5jaGVja0luc3RhbGxlZCgpO1xuICAgIGlmIChvYmopIHtcbiAgICAgIHZhciBlcnJvck1lc3NhZ2U7XG4gICAgICBpZiAoZXJyb3JNZXNzYWdlID0gdGhpcy52YWxpZGF0ZShvYmopKSB7XG4gICAgICAgIHJldHVybiBlcnJvck1lc3NhZ2U7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgICB0aGlzLnNldElkQW5kUmVsYXRlZChvYmosIG9wdHMpO1xuICAgICAgICB0aGlzLnNldElkQW5kUmVsYXRlZFJldmVyc2Uob2JqLCBvcHRzKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICB0aGlzLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICB0aGlzLnNldElkQW5kUmVsYXRlZChvYmosIG9wdHMpO1xuICAgIH1cbiAgfSxcbiAgZ2V0OiBmdW5jdGlvbihjYikge1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICBjYihudWxsLCB0aGlzLnJlbGF0ZWQpO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE9uZVRvT25lUHJveHk7XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvT25lVG9PbmVQcm94eS5qc1xuICoqIG1vZHVsZSBpZCA9IDExXG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgUmVsYXRpb25zaGlwUHJveHkgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFByb3h5JyksXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMgPSBldmVudHMud3JhcEFycmF5LFxuICBBcnJheU9ic2VydmVyID0gcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5BcnJheU9ic2VydmVyLFxuICBNb2RlbEV2ZW50VHlwZSA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKS5Nb2RlbEV2ZW50VHlwZTtcblxuLyoqXG4gKiBAY2xhc3MgIFtPbmVUb01hbnlQcm94eSBkZXNjcmlwdGlvbl1cbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHtbdHlwZV19IG9wdHNcbiAqL1xuZnVuY3Rpb24gT25lVG9NYW55UHJveHkob3B0cykge1xuICBSZWxhdGlvbnNoaXBQcm94eS5jYWxsKHRoaXMsIG9wdHMpO1xuICBpZiAodGhpcy5pc1JldmVyc2UpIHtcbiAgICB0aGlzLnJlbGF0ZWQgPSBbXTtcbiAgICAvL3RoaXMuZm9yd2FyZE1vZGVsLm9uKG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlJlbW92ZSwgZnVuY3Rpb24oZSkge1xuICAgIC8vICBpZiAoZS5maWVsZCA9PSBlLmZvcndhcmROYW1lKSB7XG4gICAgLy8gICAgdmFyIGlkeCA9IHRoaXMucmVsYXRlZC5pbmRleE9mKGUub2JqKTtcbiAgICAvLyAgICBpZiAoaWR4ID4gLTEpIHtcbiAgICAvLyAgICAgIHZhciByZW1vdmVkID0gdGhpcy5yZWxhdGVkLnNwbGljZShpZHgsIDEpO1xuICAgIC8vICAgIH1cbiAgICAvLyAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAvLyAgICAgIGNvbGxlY3Rpb246IHRoaXMucmV2ZXJzZU1vZGVsLmNvbGxlY3Rpb25OYW1lLFxuICAgIC8vICAgICAgbW9kZWw6IHRoaXMucmV2ZXJzZU1vZGVsLm5hbWUsXG4gICAgLy8gICAgICBsb2NhbElkOiB0aGlzLm9iamVjdC5sb2NhbElkLFxuICAgIC8vICAgICAgZmllbGQ6IHRoaXMucmV2ZXJzZU5hbWUsXG4gICAgLy8gICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgIC8vICAgICAgYWRkZWQ6IFtdLFxuICAgIC8vICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgIC8vICAgICAgaW5kZXg6IGlkeCxcbiAgICAvLyAgICAgIG9iajogdGhpcy5vYmplY3RcbiAgICAvLyAgICB9KTtcbiAgICAvLyAgfVxuICAgIC8vfS5iaW5kKHRoaXMpKTtcbiAgfVxufVxuXG5PbmVUb01hbnlQcm94eS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSk7XG5cbnV0aWwuZXh0ZW5kKE9uZVRvTWFueVByb3h5LnByb3RvdHlwZSwge1xuICBjbGVhclJldmVyc2U6IGZ1bmN0aW9uKHJlbW92ZWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgcmVtb3ZlZC5mb3JFYWNoKGZ1bmN0aW9uKHJlbW92ZWRPYmplY3QpIHtcbiAgICAgIHZhciByZXZlcnNlUHJveHkgPSBzZWxmLnJldmVyc2VQcm94eUZvckluc3RhbmNlKHJlbW92ZWRPYmplY3QpO1xuICAgICAgcmV2ZXJzZVByb3h5LnNldElkQW5kUmVsYXRlZChudWxsKTtcbiAgICB9KTtcbiAgfSxcbiAgc2V0UmV2ZXJzZU9mQWRkZWQ6IGZ1bmN0aW9uKGFkZGVkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGFkZGVkLmZvckVhY2goZnVuY3Rpb24oYWRkZWQpIHtcbiAgICAgIHZhciBmb3J3YXJkUHJveHkgPSBzZWxmLnJldmVyc2VQcm94eUZvckluc3RhbmNlKGFkZGVkKTtcbiAgICAgIGZvcndhcmRQcm94eS5zZXRJZEFuZFJlbGF0ZWQoc2VsZi5vYmplY3QpO1xuICAgIH0pO1xuICB9LFxuICB3cmFwQXJyYXk6IGZ1bmN0aW9uKGFycikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzKGFyciwgdGhpcy5yZXZlcnNlTmFtZSwgdGhpcy5vYmplY3QpO1xuICAgIGlmICghYXJyLmFycmF5T2JzZXJ2ZXIpIHtcbiAgICAgIGFyci5hcnJheU9ic2VydmVyID0gbmV3IEFycmF5T2JzZXJ2ZXIoYXJyKTtcbiAgICAgIHZhciBvYnNlcnZlckZ1bmN0aW9uID0gZnVuY3Rpb24oc3BsaWNlcykge1xuICAgICAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24oc3BsaWNlKSB7XG4gICAgICAgICAgdmFyIGFkZGVkID0gc3BsaWNlLmFkZGVkQ291bnQgPyBhcnIuc2xpY2Uoc3BsaWNlLmluZGV4LCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkgOiBbXTtcbiAgICAgICAgICB2YXIgcmVtb3ZlZCA9IHNwbGljZS5yZW1vdmVkO1xuICAgICAgICAgIHNlbGYuY2xlYXJSZXZlcnNlKHJlbW92ZWQpO1xuICAgICAgICAgIHNlbGYuc2V0UmV2ZXJzZU9mQWRkZWQoYWRkZWQpO1xuICAgICAgICAgIHZhciBtb2RlbCA9IHNlbGYuZ2V0Rm9yd2FyZE1vZGVsKCk7XG4gICAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgICBjb2xsZWN0aW9uOiBtb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgIG1vZGVsOiBtb2RlbC5uYW1lLFxuICAgICAgICAgICAgbG9jYWxJZDogc2VsZi5vYmplY3QubG9jYWxJZCxcbiAgICAgICAgICAgIGZpZWxkOiBzZWxmLmdldEZvcndhcmROYW1lKCksXG4gICAgICAgICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgICAgICAgYWRkZWQ6IGFkZGVkLFxuICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgICAgaW5kZXg6IHNwbGljZS5pbmRleCxcbiAgICAgICAgICAgIG9iajogc2VsZi5vYmplY3RcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgICAgYXJyLmFycmF5T2JzZXJ2ZXIub3BlbihvYnNlcnZlckZ1bmN0aW9uKTtcbiAgICB9XG4gIH0sXG4gIGdldDogZnVuY3Rpb24oY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgY2IobnVsbCwgdGhpcy5yZWxhdGVkKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuICAvKipcbiAgICogVmFsaWRhdGUgdGhlIG9iamVjdCB0aGF0IHdlJ3JlIHNldHRpbmdcbiAgICogQHBhcmFtIG9ialxuICAgKiBAcmV0dXJucyB7c3RyaW5nfG51bGx9IEFuIGVycm9yIG1lc3NhZ2Ugb3IgbnVsbFxuICAgKiBAY2xhc3MgT25lVG9NYW55UHJveHlcbiAgICovXG4gIHZhbGlkYXRlOiBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIgc3RyID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaik7XG4gICAgaWYgKHRoaXMuaXNGb3J3YXJkKSB7XG4gICAgICBpZiAoc3RyID09ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICAgICAgcmV0dXJuICdDYW5ub3QgYXNzaWduIGFycmF5IGZvcndhcmQgb25lVG9NYW55ICgnICsgc3RyICsgJyk6ICcgKyB0aGlzLmZvcndhcmROYW1lO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGlmIChzdHIgIT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgICAgICByZXR1cm4gJ0Nhbm5vdCBzY2FsYXIgdG8gcmV2ZXJzZSBvbmVUb01hbnkgKCcgKyBzdHIgKyAnKTogJyArIHRoaXMucmV2ZXJzZU5hbWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuICBzZXQ6IGZ1bmN0aW9uKG9iaiwgb3B0cykge1xuICAgIHRoaXMuY2hlY2tJbnN0YWxsZWQoKTtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKG9iaikge1xuICAgICAgdmFyIGVycm9yTWVzc2FnZTtcbiAgICAgIGlmIChlcnJvck1lc3NhZ2UgPSB0aGlzLnZhbGlkYXRlKG9iaikpIHtcbiAgICAgICAgcmV0dXJuIGVycm9yTWVzc2FnZTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB0aGlzLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkKG9iaiwgb3B0cyk7XG4gICAgICAgIGlmIChzZWxmLmlzUmV2ZXJzZSkge1xuICAgICAgICAgIHRoaXMud3JhcEFycmF5KHNlbGYucmVsYXRlZCk7XG4gICAgICAgIH1cbiAgICAgICAgc2VsZi5zZXRJZEFuZFJlbGF0ZWRSZXZlcnNlKG9iaiwgb3B0cyk7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgc2VsZi5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICB9XG4gIH0sXG4gIGluc3RhbGw6IGZ1bmN0aW9uKG9iaikge1xuICAgIFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZS5pbnN0YWxsLmNhbGwodGhpcywgb2JqKTtcblxuICAgIGlmICh0aGlzLmlzUmV2ZXJzZSkge1xuICAgICAgb2JqWygnc3BsaWNlJyArIHV0aWwuY2FwaXRhbGlzZUZpcnN0TGV0dGVyKHRoaXMucmV2ZXJzZU5hbWUpKV0gPSB0aGlzLnNwbGljZS5iaW5kKHRoaXMpO1xuICAgICAgdGhpcy53cmFwQXJyYXkodGhpcy5yZWxhdGVkKTtcbiAgICB9XG5cbiAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gT25lVG9NYW55UHJveHk7XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvT25lVG9NYW55UHJveHkuanNcbiAqKiBtb2R1bGUgaWQgPSAxMlxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiLyoqXG4gKiBCYXNlIGZ1bmN0aW9uYWxpdHkgZm9yIHJlbGF0aW9uc2hpcHMuXG4gKiBAbW9kdWxlIHJlbGF0aW9uc2hpcHNcbiAqL1xudmFyIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICBRdWVyeSA9IHJlcXVpcmUoJy4vUXVlcnknKSxcbiAgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSxcbiAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyksXG4gIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMgPSBldmVudHMud3JhcEFycmF5LFxuICBBcnJheU9ic2VydmVyID0gcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5BcnJheU9ic2VydmVyLFxuICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgTW9kZWxFdmVudFR5cGUgPSBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZTtcblxuLyoqXG4gKiBAY2xhc3MgIFtSZWxhdGlvbnNoaXBQcm94eSBkZXNjcmlwdGlvbl1cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gUmVsYXRpb25zaGlwUHJveHkob3B0cykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIG9wdHMgPSBvcHRzIHx8IHt9O1xuXG4gIHV0aWwuZXh0ZW5kKHRoaXMsIHtcbiAgICBvYmplY3Q6IG51bGwsXG4gICAgcmVsYXRlZDogbnVsbFxuICB9KTtcblxuICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0aGlzLCB7XG4gICAgaXNGb3J3YXJkOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gIXNlbGYuaXNSZXZlcnNlO1xuICAgICAgfSxcbiAgICAgIHNldDogZnVuY3Rpb24odikge1xuICAgICAgICBzZWxmLmlzUmV2ZXJzZSA9ICF2O1xuICAgICAgfSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9XG4gIH0pO1xuXG4gIHV0aWwuZXh0ZW5kRnJvbU9wdHModGhpcywgb3B0cywge1xuICAgIHJldmVyc2VNb2RlbDogbnVsbCxcbiAgICBmb3J3YXJkTW9kZWw6IG51bGwsXG4gICAgZm9yd2FyZE5hbWU6IG51bGwsXG4gICAgcmV2ZXJzZU5hbWU6IG51bGwsXG4gICAgaXNSZXZlcnNlOiBudWxsLFxuICAgIHNlcmlhbGlzZTogbnVsbFxuICB9LCBmYWxzZSk7XG5cbiAgdGhpcy5jYW5jZWxMaXN0ZW5zID0ge307XG59XG5cbnV0aWwuZXh0ZW5kKFJlbGF0aW9uc2hpcFByb3h5LCB7fSk7XG5cbnV0aWwuZXh0ZW5kKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSwge1xuICAvKipcbiAgICogSW5zdGFsbCB0aGlzIHByb3h5IG9uIHRoZSBnaXZlbiBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge01vZGVsSW5zdGFuY2V9IG1vZGVsSW5zdGFuY2VcbiAgICovXG4gIGluc3RhbGw6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UpIHtcbiAgICBpZiAobW9kZWxJbnN0YW5jZSkge1xuICAgICAgaWYgKCF0aGlzLm9iamVjdCkge1xuICAgICAgICB0aGlzLm9iamVjdCA9IG1vZGVsSW5zdGFuY2U7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgdmFyIG5hbWUgPSB0aGlzLmdldEZvcndhcmROYW1lKCk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShtb2RlbEluc3RhbmNlLCBuYW1lLCB7XG4gICAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBzZWxmLnJlbGF0ZWQ7XG4gICAgICAgICAgfSxcbiAgICAgICAgICBzZXQ6IGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgICAgIHNlbGYuc2V0KHYpO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIGlmICghbW9kZWxJbnN0YW5jZS5fX3Byb3hpZXMpIG1vZGVsSW5zdGFuY2UuX19wcm94aWVzID0ge307XG4gICAgICAgIG1vZGVsSW5zdGFuY2UuX19wcm94aWVzW25hbWVdID0gdGhpcztcbiAgICAgICAgaWYgKCFtb2RlbEluc3RhbmNlLl9wcm94aWVzKSB7XG4gICAgICAgICAgbW9kZWxJbnN0YW5jZS5fcHJveGllcyA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIG1vZGVsSW5zdGFuY2UuX3Byb3hpZXMucHVzaCh0aGlzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdBbHJlYWR5IGluc3RhbGxlZC4nKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ05vIG9iamVjdCBwYXNzZWQgdG8gcmVsYXRpb25zaGlwIGluc3RhbGwnKTtcbiAgICB9XG4gIH1cblxufSk7XG5cbi8vbm9pbnNwZWN0aW9uIEpTVW51c2VkTG9jYWxTeW1ib2xzXG51dGlsLmV4dGVuZChSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUsIHtcbiAgc2V0OiBmdW5jdGlvbihvYmosIG9wdHMpIHtcbiAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBzdWJjbGFzcyBSZWxhdGlvbnNoaXBQcm94eScpO1xuICB9LFxuICBnZXQ6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ011c3Qgc3ViY2xhc3MgUmVsYXRpb25zaGlwUHJveHknKTtcbiAgfVxufSk7XG5cbnV0aWwuZXh0ZW5kKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSwge1xuICBwcm94eUZvckluc3RhbmNlOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlLCByZXZlcnNlKSB7XG4gICAgdmFyIG5hbWUgPSByZXZlcnNlID8gdGhpcy5nZXRSZXZlcnNlTmFtZSgpIDogdGhpcy5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgbW9kZWwgPSByZXZlcnNlID8gdGhpcy5yZXZlcnNlTW9kZWwgOiB0aGlzLmZvcndhcmRNb2RlbDtcbiAgICB2YXIgcmV0O1xuICAgIC8vIFRoaXMgc2hvdWxkIG5ldmVyIGhhcHBlbi4gU2hvdWxkIGcgICBldCBjYXVnaHQgaW4gdGhlIG1hcHBpbmcgb3BlcmF0aW9uP1xuICAgIGlmICh1dGlsLmlzQXJyYXkobW9kZWxJbnN0YW5jZSkpIHtcbiAgICAgIHJldCA9IG1vZGVsSW5zdGFuY2UubWFwKGZ1bmN0aW9uKG8pIHtcbiAgICAgICAgcmV0dXJuIG8uX19wcm94aWVzW25hbWVdO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBwcm94aWVzID0gbW9kZWxJbnN0YW5jZS5fX3Byb3hpZXM7XG4gICAgICB2YXIgcHJveHkgPSBwcm94aWVzW25hbWVdO1xuICAgICAgaWYgKCFwcm94eSkge1xuICAgICAgICB2YXIgZXJyID0gJ05vIHByb3h5IHdpdGggbmFtZSBcIicgKyBuYW1lICsgJ1wiIG9uIG1hcHBpbmcgJyArIG1vZGVsLm5hbWU7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKGVycik7XG4gICAgICB9XG4gICAgICByZXQgPSBwcm94eTtcbiAgICB9XG4gICAgcmV0dXJuIHJldDtcbiAgfSxcbiAgcmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2U6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UpIHtcbiAgICByZXR1cm4gdGhpcy5wcm94eUZvckluc3RhbmNlKG1vZGVsSW5zdGFuY2UsIHRydWUpO1xuICB9LFxuICBnZXRSZXZlcnNlTmFtZTogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuaXNGb3J3YXJkID8gdGhpcy5yZXZlcnNlTmFtZSA6IHRoaXMuZm9yd2FyZE5hbWU7XG4gIH0sXG4gIGdldEZvcndhcmROYW1lOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5pc0ZvcndhcmQgPyB0aGlzLmZvcndhcmROYW1lIDogdGhpcy5yZXZlcnNlTmFtZTtcbiAgfSxcbiAgZ2V0Rm9yd2FyZE1vZGVsOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5pc0ZvcndhcmQgPyB0aGlzLmZvcndhcmRNb2RlbCA6IHRoaXMucmV2ZXJzZU1vZGVsO1xuICB9LFxuICAvKipcbiAgICogQ29uZmlndXJlIF9pZCBhbmQgcmVsYXRlZCB3aXRoIHRoZSBuZXcgcmVsYXRlZCBvYmplY3QuXG4gICAqIEBwYXJhbSBvYmpcbiAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRzXVxuICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRzLmRpc2FibGVOb3RpZmljYXRpb25zXVxuICAgKiBAcmV0dXJucyB7U3RyaW5nfHVuZGVmaW5lZH0gLSBFcnJvciBtZXNzYWdlIG9yIHVuZGVmaW5lZFxuICAgKi9cbiAgc2V0SWRBbmRSZWxhdGVkOiBmdW5jdGlvbihvYmosIG9wdHMpIHtcbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICBpZiAoIW9wdHMuZGlzYWJsZWV2ZW50cykgdmFyIG9sZFZhbHVlID0gdGhpcy5fZ2V0T2xkVmFsdWVGb3JTZXRDaGFuZ2VFdmVudCgpO1xuICAgIGlmIChvYmopIHtcbiAgICAgIGlmICh1dGlsLmlzQXJyYXkob2JqKSkge1xuICAgICAgICB0aGlzLnJlbGF0ZWQgPSBvYmo7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnJlbGF0ZWQgPSBvYmo7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhpcy5yZWxhdGVkID0gbnVsbDtcbiAgICB9XG4gICAgaWYgKCFvcHRzLmRpc2FibGVldmVudHMpIHRoaXMucmVnaXN0ZXJTZXRDaGFuZ2Uob2JqLCBvbGRWYWx1ZSk7XG4gIH0sXG4gIGNoZWNrSW5zdGFsbGVkOiBmdW5jdGlvbigpIHtcbiAgICBpZiAoIXRoaXMub2JqZWN0KSB7XG4gICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignUHJveHkgbXVzdCBiZSBpbnN0YWxsZWQgb24gYW4gb2JqZWN0IGJlZm9yZSBjYW4gdXNlIGl0LicpO1xuICAgIH1cbiAgfSxcbiAgc3BsaWNlcjogZnVuY3Rpb24ob3B0cykge1xuICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgIHJldHVybiBmdW5jdGlvbihpZHgsIG51bVJlbW92ZSkge1xuICAgICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgICBpZiAoIW9wdHMuZGlzYWJsZWV2ZW50cykge1xuICAgICAgICB2YXIgYWRkZWQgPSB0aGlzLl9nZXRBZGRlZEZvclNwbGljZUNoYW5nZUV2ZW50KGFyZ3VtZW50cyksXG4gICAgICAgICAgcmVtb3ZlZCA9IHRoaXMuX2dldFJlbW92ZWRGb3JTcGxpY2VDaGFuZ2VFdmVudChpZHgsIG51bVJlbW92ZSk7XG4gICAgICB9XG4gICAgICB2YXIgYWRkID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICAgIHZhciByZXMgPSB0aGlzLnJlbGF0ZWQuc3BsaWNlLmJpbmQodGhpcy5yZWxhdGVkLCBpZHgsIG51bVJlbW92ZSkuYXBwbHkodGhpcy5yZWxhdGVkLCBhZGQpO1xuICAgICAgaWYgKCFvcHRzLmRpc2FibGVldmVudHMpIHRoaXMucmVnaXN0ZXJTcGxpY2VDaGFuZ2UoaWR4LCBhZGRlZCwgcmVtb3ZlZCk7XG4gICAgICByZXR1cm4gcmVzO1xuICAgIH0uYmluZCh0aGlzKTtcbiAgfSxcbiAgY2xlYXJSZXZlcnNlUmVsYXRlZDogZnVuY3Rpb24ob3B0cykge1xuICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAodGhpcy5yZWxhdGVkKSB7XG4gICAgICB2YXIgcmV2ZXJzZVByb3h5ID0gdGhpcy5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZSh0aGlzLnJlbGF0ZWQpO1xuICAgICAgdmFyIHJldmVyc2VQcm94aWVzID0gdXRpbC5pc0FycmF5KHJldmVyc2VQcm94eSkgPyByZXZlcnNlUHJveHkgOiBbcmV2ZXJzZVByb3h5XTtcbiAgICAgIHJldmVyc2VQcm94aWVzLmZvckVhY2goZnVuY3Rpb24ocCkge1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KHAucmVsYXRlZCkpIHtcbiAgICAgICAgICB2YXIgaWR4ID0gcC5yZWxhdGVkLmluZGV4T2Yoc2VsZi5vYmplY3QpO1xuICAgICAgICAgIHAubWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcC5zcGxpY2VyKG9wdHMpKGlkeCwgMSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcC5zZXRJZEFuZFJlbGF0ZWQobnVsbCwgb3B0cyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcbiAgc2V0SWRBbmRSZWxhdGVkUmV2ZXJzZTogZnVuY3Rpb24ob2JqLCBvcHRzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciByZXZlcnNlUHJveHkgPSB0aGlzLnJldmVyc2VQcm94eUZvckluc3RhbmNlKG9iaik7XG4gICAgdmFyIHJldmVyc2VQcm94aWVzID0gdXRpbC5pc0FycmF5KHJldmVyc2VQcm94eSkgPyByZXZlcnNlUHJveHkgOiBbcmV2ZXJzZVByb3h5XTtcbiAgICByZXZlcnNlUHJveGllcy5mb3JFYWNoKGZ1bmN0aW9uKHApIHtcbiAgICAgIGlmICh1dGlsLmlzQXJyYXkocC5yZWxhdGVkKSkge1xuICAgICAgICBwLm1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9ucyhmdW5jdGlvbigpIHtcbiAgICAgICAgICBwLnNwbGljZXIob3B0cykocC5yZWxhdGVkLmxlbmd0aCwgMCwgc2VsZi5vYmplY3QpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHAuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgICAgcC5zZXRJZEFuZFJlbGF0ZWQoc2VsZi5vYmplY3QsIG9wdHMpO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuICBtYWtlQ2hhbmdlc1RvUmVsYXRlZFdpdGhvdXRPYnNlcnZhdGlvbnM6IGZ1bmN0aW9uKGYpIHtcbiAgICBpZiAodGhpcy5yZWxhdGVkKSB7XG4gICAgICB0aGlzLnJlbGF0ZWQuYXJyYXlPYnNlcnZlci5jbG9zZSgpO1xuICAgICAgdGhpcy5yZWxhdGVkLmFycmF5T2JzZXJ2ZXIgPSBudWxsO1xuICAgICAgZigpO1xuICAgICAgdGhpcy53cmFwQXJyYXkodGhpcy5yZWxhdGVkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZigpO1xuICAgIH1cbiAgfSxcbiAgLyoqXG4gICAqIEdldCBvbGQgdmFsdWUgdGhhdCBpcyBzZW50IG91dCBpbiBlbWlzc2lvbnMuXG4gICAqIEByZXR1cm5zIHsqfVxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2dldE9sZFZhbHVlRm9yU2V0Q2hhbmdlRXZlbnQ6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBvbGRWYWx1ZSA9IHRoaXMucmVsYXRlZDtcbiAgICBpZiAodXRpbC5pc0FycmF5KG9sZFZhbHVlKSAmJiAhb2xkVmFsdWUubGVuZ3RoKSB7XG4gICAgICBvbGRWYWx1ZSA9IG51bGw7XG4gICAgfVxuICAgIHJldHVybiBvbGRWYWx1ZTtcbiAgfSxcbiAgcmVnaXN0ZXJTZXRDaGFuZ2U6IGZ1bmN0aW9uKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgIHZhciBwcm94eU9iamVjdCA9IHRoaXMub2JqZWN0O1xuICAgIGlmICghcHJveHlPYmplY3QpIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdQcm94eSBtdXN0IGhhdmUgYW4gb2JqZWN0IGFzc29jaWF0ZWQnKTtcbiAgICB2YXIgbW9kZWwgPSBwcm94eU9iamVjdC5tb2RlbC5uYW1lO1xuICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IHByb3h5T2JqZWN0LmNvbGxlY3Rpb25OYW1lO1xuICAgIC8vIFdlIHRha2UgW10gPT0gbnVsbCA9PSB1bmRlZmluZWQgaW4gdGhlIGNhc2Ugb2YgcmVsYXRpb25zaGlwcy5cbiAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgIGNvbGxlY3Rpb246IGNvbGxlY3Rpb25OYW1lLFxuICAgICAgbW9kZWw6IG1vZGVsLFxuICAgICAgbG9jYWxJZDogcHJveHlPYmplY3QubG9jYWxJZCxcbiAgICAgIGZpZWxkOiB0aGlzLmdldEZvcndhcmROYW1lKCksXG4gICAgICBvbGQ6IG9sZFZhbHVlLFxuICAgICAgbmV3OiBuZXdWYWx1ZSxcbiAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNldCxcbiAgICAgIG9iajogcHJveHlPYmplY3RcbiAgICB9KTtcbiAgfSxcblxuICBfZ2V0UmVtb3ZlZEZvclNwbGljZUNoYW5nZUV2ZW50OiBmdW5jdGlvbihpZHgsIG51bVJlbW92ZSkge1xuICAgIHZhciByZW1vdmVkID0gdGhpcy5yZWxhdGVkID8gdGhpcy5yZWxhdGVkLnNsaWNlKGlkeCwgaWR4ICsgbnVtUmVtb3ZlKSA6IG51bGw7XG4gICAgcmV0dXJuIHJlbW92ZWQ7XG4gIH0sXG5cbiAgX2dldEFkZGVkRm9yU3BsaWNlQ2hhbmdlRXZlbnQ6IGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICB2YXIgYWRkID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJncywgMiksXG4gICAgICBhZGRlZCA9IGFkZC5sZW5ndGggPyBhZGQgOiBbXTtcbiAgICByZXR1cm4gYWRkZWQ7XG4gIH0sXG5cbiAgcmVnaXN0ZXJTcGxpY2VDaGFuZ2U6IGZ1bmN0aW9uKGlkeCwgYWRkZWQsIHJlbW92ZWQpIHtcbiAgICB2YXIgbW9kZWwgPSB0aGlzLm9iamVjdC5tb2RlbC5uYW1lLFxuICAgICAgY29sbCA9IHRoaXMub2JqZWN0LmNvbGxlY3Rpb25OYW1lO1xuICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgY29sbGVjdGlvbjogY29sbCxcbiAgICAgIG1vZGVsOiBtb2RlbCxcbiAgICAgIGxvY2FsSWQ6IHRoaXMub2JqZWN0LmxvY2FsSWQsXG4gICAgICBmaWVsZDogdGhpcy5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgaW5kZXg6IGlkeCxcbiAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICBhZGRlZDogYWRkZWQsXG4gICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICBvYmo6IHRoaXMub2JqZWN0XG4gICAgfSk7XG4gIH0sXG4gIHdyYXBBcnJheTogZnVuY3Rpb24oYXJyKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMoYXJyLCB0aGlzLnJldmVyc2VOYW1lLCB0aGlzLm9iamVjdCk7XG4gICAgaWYgKCFhcnIuYXJyYXlPYnNlcnZlcikge1xuICAgICAgYXJyLmFycmF5T2JzZXJ2ZXIgPSBuZXcgQXJyYXlPYnNlcnZlcihhcnIpO1xuICAgICAgdmFyIG9ic2VydmVyRnVuY3Rpb24gPSBmdW5jdGlvbihzcGxpY2VzKSB7XG4gICAgICAgIHNwbGljZXMuZm9yRWFjaChmdW5jdGlvbihzcGxpY2UpIHtcbiAgICAgICAgICB2YXIgYWRkZWQgPSBzcGxpY2UuYWRkZWRDb3VudCA/IGFyci5zbGljZShzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50KSA6IFtdO1xuICAgICAgICAgIHZhciBtb2RlbCA9IHNlbGYuZ2V0Rm9yd2FyZE1vZGVsKCk7XG4gICAgICAgICAgbW9kZWxFdmVudHMuZW1pdCh7XG4gICAgICAgICAgICBjb2xsZWN0aW9uOiBtb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgIG1vZGVsOiBtb2RlbC5uYW1lLFxuICAgICAgICAgICAgbG9jYWxJZDogc2VsZi5vYmplY3QubG9jYWxJZCxcbiAgICAgICAgICAgIGZpZWxkOiBzZWxmLmdldEZvcndhcmROYW1lKCksXG4gICAgICAgICAgICByZW1vdmVkOiBzcGxpY2UucmVtb3ZlZCxcbiAgICAgICAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgIG9iajogc2VsZi5vYmplY3RcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgICAgYXJyLmFycmF5T2JzZXJ2ZXIub3BlbihvYnNlcnZlckZ1bmN0aW9uKTtcbiAgICB9XG4gIH0sXG4gIHNwbGljZTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5zcGxpY2VyKHt9KS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICB9XG5cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJlbGF0aW9uc2hpcFByb3h5O1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL1JlbGF0aW9uc2hpcFByb3h5LmpzXG4gKiogbW9kdWxlIGlkID0gMTNcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ2V2ZW50cycpLFxuICBleHRlbmQgPSByZXF1aXJlKCcuL3V0aWwnKS5leHRlbmQsXG4gIGNvbGxlY3Rpb25SZWdpc3RyeSA9IHJlcXVpcmUoJy4vY29sbGVjdGlvblJlZ2lzdHJ5JykuQ29sbGVjdGlvblJlZ2lzdHJ5O1xuXG5cbi8qKlxuICogQ29uc3RhbnRzIHRoYXQgZGVzY3JpYmUgY2hhbmdlIGV2ZW50cy5cbiAqIFNldCA9PiBBIG5ldyB2YWx1ZSBpcyBhc3NpZ25lZCB0byBhbiBhdHRyaWJ1dGUvcmVsYXRpb25zaGlwXG4gKiBTcGxpY2UgPT4gQWxsIGphdmFzY3JpcHQgYXJyYXkgb3BlcmF0aW9ucyBhcmUgZGVzY3JpYmVkIGFzIHNwbGljZXMuXG4gKiBEZWxldGUgPT4gVXNlZCBpbiB0aGUgY2FzZSB3aGVyZSBvYmplY3RzIGFyZSByZW1vdmVkIGZyb20gYW4gYXJyYXksIGJ1dCBhcnJheSBvcmRlciBpcyBub3Qga25vd24gaW4gYWR2YW5jZS5cbiAqIFJlbW92ZSA9PiBPYmplY3QgZGVsZXRpb24gZXZlbnRzXG4gKiBOZXcgPT4gT2JqZWN0IGNyZWF0aW9uIGV2ZW50c1xuICogQHR5cGUge09iamVjdH1cbiAqL1xudmFyIE1vZGVsRXZlbnRUeXBlID0ge1xuICBTZXQ6ICdzZXQnLFxuICBTcGxpY2U6ICdzcGxpY2UnLFxuICBOZXc6ICduZXcnLFxuICBSZW1vdmU6ICdyZW1vdmUnXG59O1xuXG4vKipcbiAqIFJlcHJlc2VudHMgYW4gaW5kaXZpZHVhbCBjaGFuZ2UuXG4gKiBAcGFyYW0gb3B0c1xuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIE1vZGVsRXZlbnQob3B0cykge1xuICB0aGlzLl9vcHRzID0gb3B0cyB8fCB7fTtcbiAgT2JqZWN0LmtleXMob3B0cykuZm9yRWFjaChmdW5jdGlvbihrKSB7XG4gICAgdGhpc1trXSA9IG9wdHNba107XG4gIH0uYmluZCh0aGlzKSk7XG59XG5cbk1vZGVsRXZlbnQucHJvdG90eXBlLl9kdW1wID0gZnVuY3Rpb24ocHJldHR5KSB7XG4gIHZhciBkdW1wZWQgPSB7fTtcbiAgZHVtcGVkLmNvbGxlY3Rpb24gPSAodHlwZW9mIHRoaXMuY29sbGVjdGlvbikgPT0gJ3N0cmluZycgPyB0aGlzLmNvbGxlY3Rpb24gOiB0aGlzLmNvbGxlY3Rpb24uX2R1bXAoKTtcbiAgZHVtcGVkLm1vZGVsID0gKHR5cGVvZiB0aGlzLm1vZGVsKSA9PSAnc3RyaW5nJyA/IHRoaXMubW9kZWwgOiB0aGlzLm1vZGVsLm5hbWU7XG4gIGR1bXBlZC5sb2NhbElkID0gdGhpcy5sb2NhbElkO1xuICBkdW1wZWQuZmllbGQgPSB0aGlzLmZpZWxkO1xuICBkdW1wZWQudHlwZSA9IHRoaXMudHlwZTtcbiAgaWYgKHRoaXMuaW5kZXgpIGR1bXBlZC5pbmRleCA9IHRoaXMuaW5kZXg7XG4gIGlmICh0aGlzLmFkZGVkKSBkdW1wZWQuYWRkZWQgPSB0aGlzLmFkZGVkLm1hcChmdW5jdGlvbih4KSB7cmV0dXJuIHguX2R1bXAoKX0pO1xuICBpZiAodGhpcy5yZW1vdmVkKSBkdW1wZWQucmVtb3ZlZCA9IHRoaXMucmVtb3ZlZC5tYXAoZnVuY3Rpb24oeCkge3JldHVybiB4Ll9kdW1wKCl9KTtcbiAgaWYgKHRoaXMub2xkKSBkdW1wZWQub2xkID0gdGhpcy5vbGQ7XG4gIGlmICh0aGlzLm5ldykgZHVtcGVkLm5ldyA9IHRoaXMubmV3O1xuICByZXR1cm4gcHJldHR5ID8gdXRpbC5wcmV0dHlQcmludChkdW1wZWQpIDogZHVtcGVkO1xufTtcblxuZnVuY3Rpb24gYnJvYWRjYXN0RXZlbnQoY29sbGVjdGlvbk5hbWUsIG1vZGVsTmFtZSwgb3B0cykge1xuICB2YXIgZ2VuZXJpY0V2ZW50ID0gJ1NpZXN0YScsXG4gICAgY29sbGVjdGlvbiA9IGNvbGxlY3Rpb25SZWdpc3RyeVtjb2xsZWN0aW9uTmFtZV0sXG4gICAgbW9kZWwgPSBjb2xsZWN0aW9uW21vZGVsTmFtZV07XG4gIGlmICghY29sbGVjdGlvbikgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ05vIHN1Y2ggY29sbGVjdGlvbiBcIicgKyBjb2xsZWN0aW9uTmFtZSArICdcIicpO1xuICBpZiAoIW1vZGVsKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gc3VjaCBtb2RlbCBcIicgKyBtb2RlbE5hbWUgKyAnXCInKTtcbiAgdmFyIHNob3VsZEVtaXQgPSBvcHRzLm9iai5fZW1pdEV2ZW50cztcbiAgLy8gRG9uJ3QgZW1pdCBwb2ludGxlc3MgZXZlbnRzLlxuICBpZiAoc2hvdWxkRW1pdCAmJiAnbmV3JyBpbiBvcHRzICYmICdvbGQnIGluIG9wdHMpIHtcbiAgICBpZiAob3B0cy5uZXcgaW5zdGFuY2VvZiBEYXRlICYmIG9wdHMub2xkIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgICAgc2hvdWxkRW1pdCA9IG9wdHMubmV3LmdldFRpbWUoKSAhPSBvcHRzLm9sZC5nZXRUaW1lKCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgc2hvdWxkRW1pdCA9IG9wdHMubmV3ICE9IG9wdHMub2xkO1xuICAgIH1cbiAgfVxuICBpZiAoc2hvdWxkRW1pdCkge1xuICAgIGV2ZW50cy5lbWl0KGdlbmVyaWNFdmVudCwgb3B0cyk7XG4gICAgaWYgKHNpZXN0YS5pbnN0YWxsZWQpIHtcbiAgICAgIHZhciBtb2RlbEV2ZW50ID0gY29sbGVjdGlvbk5hbWUgKyAnOicgKyBtb2RlbE5hbWUsXG4gICAgICAgIGxvY2FsSWRFdmVudCA9IG9wdHMubG9jYWxJZDtcbiAgICAgIGV2ZW50cy5lbWl0KGNvbGxlY3Rpb25OYW1lLCBvcHRzKTtcbiAgICAgIGV2ZW50cy5lbWl0KG1vZGVsRXZlbnQsIG9wdHMpO1xuICAgICAgZXZlbnRzLmVtaXQobG9jYWxJZEV2ZW50LCBvcHRzKTtcbiAgICB9XG4gICAgaWYgKG1vZGVsLmlkICYmIG9wdHMub2JqW21vZGVsLmlkXSkgZXZlbnRzLmVtaXQoY29sbGVjdGlvbk5hbWUgKyAnOicgKyBtb2RlbE5hbWUgKyAnOicgKyBvcHRzLm9ialttb2RlbC5pZF0sIG9wdHMpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHZhbGlkYXRlRXZlbnRPcHRzKG9wdHMpIHtcbiAgaWYgKCFvcHRzLm1vZGVsKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBwYXNzIGEgbW9kZWwnKTtcbiAgaWYgKCFvcHRzLmNvbGxlY3Rpb24pIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHBhc3MgYSBjb2xsZWN0aW9uJyk7XG4gIGlmICghb3B0cy5sb2NhbElkKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBwYXNzIGEgbG9jYWwgaWRlbnRpZmllcicpO1xuICBpZiAoIW9wdHMub2JqKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBwYXNzIHRoZSBvYmplY3QnKTtcbn1cblxuZnVuY3Rpb24gZW1pdChvcHRzKSB7XG4gIHZhbGlkYXRlRXZlbnRPcHRzKG9wdHMpO1xuICB2YXIgY29sbGVjdGlvbiA9IG9wdHMuY29sbGVjdGlvbjtcbiAgdmFyIG1vZGVsID0gb3B0cy5tb2RlbDtcbiAgdmFyIGMgPSBuZXcgTW9kZWxFdmVudChvcHRzKTtcbiAgYnJvYWRjYXN0RXZlbnQoY29sbGVjdGlvbiwgbW9kZWwsIGMpO1xuICByZXR1cm4gYztcbn1cblxuZXh0ZW5kKGV4cG9ydHMsIHtcbiAgTW9kZWxFdmVudDogTW9kZWxFdmVudCxcbiAgZW1pdDogZW1pdCxcbiAgdmFsaWRhdGVFdmVudE9wdHM6IHZhbGlkYXRlRXZlbnRPcHRzLFxuICBNb2RlbEV2ZW50VHlwZTogTW9kZWxFdmVudFR5cGVcbn0pO1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL21vZGVsRXZlbnRzLmpzXG4gKiogbW9kdWxlIGlkID0gMTRcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdxdWVyeScpLFxuICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKSxcbiAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICBlcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKSxcbiAgTW9kZWxJbnN0YW5jZSA9IHJlcXVpcmUoJy4vTW9kZWxJbnN0YW5jZScpLFxuICBjb25zdHJ1Y3RRdWVyeVNldCA9IHJlcXVpcmUoJy4vUXVlcnlTZXQnKTtcblxuLyoqXG4gKiBAY2xhc3MgW1F1ZXJ5IGRlc2NyaXB0aW9uXVxuICogQHBhcmFtIHtNb2RlbH0gbW9kZWxcbiAqIEBwYXJhbSB7T2JqZWN0fSBxdWVyeVxuICovXG5mdW5jdGlvbiBRdWVyeShtb2RlbCwgcXVlcnkpIHtcbiAgdmFyIG9wdHMgPSB7fTtcbiAgZm9yICh2YXIgcHJvcCBpbiBxdWVyeSkge1xuICAgIGlmIChxdWVyeS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgaWYgKHByb3Auc2xpY2UoMCwgMikgPT0gJ19fJykge1xuICAgICAgICBvcHRzW3Byb3Auc2xpY2UoMildID0gcXVlcnlbcHJvcF07XG4gICAgICAgIGRlbGV0ZSBxdWVyeVtwcm9wXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgdXRpbC5leHRlbmQodGhpcywge1xuICAgIG1vZGVsOiBtb2RlbCxcbiAgICBxdWVyeTogcXVlcnksXG4gICAgb3B0czogb3B0c1xuICB9KTtcbiAgb3B0cy5vcmRlciA9IG9wdHMub3JkZXIgfHwgW107XG4gIGlmICghdXRpbC5pc0FycmF5KG9wdHMub3JkZXIpKSBvcHRzLm9yZGVyID0gW29wdHMub3JkZXJdO1xufVxuXG5mdW5jdGlvbiB2YWx1ZUFzU3RyaW5nKGZpZWxkVmFsdWUpIHtcbiAgdmFyIGZpZWxkQXNTdHJpbmc7XG4gIGlmIChmaWVsZFZhbHVlID09PSBudWxsKSBmaWVsZEFzU3RyaW5nID0gJ251bGwnO1xuICBlbHNlIGlmIChmaWVsZFZhbHVlID09PSB1bmRlZmluZWQpIGZpZWxkQXNTdHJpbmcgPSAndW5kZWZpbmVkJztcbiAgZWxzZSBpZiAoZmllbGRWYWx1ZSBpbnN0YW5jZW9mIE1vZGVsSW5zdGFuY2UpIGZpZWxkQXNTdHJpbmcgPSBmaWVsZFZhbHVlLmxvY2FsSWQ7XG4gIGVsc2UgZmllbGRBc1N0cmluZyA9IGZpZWxkVmFsdWUudG9TdHJpbmcoKTtcbiAgcmV0dXJuIGZpZWxkQXNTdHJpbmc7XG59XG5cbmZ1bmN0aW9uIGNvbnRhaW5zKG9wdHMpIHtcbiAgaWYgKCFvcHRzLmludmFsaWQpIHtcbiAgICB2YXIgb2JqID0gb3B0cy5vYmplY3Q7XG4gICAgaWYgKHV0aWwuaXNBcnJheShvYmopKSB7XG4gICAgICBhcnIgPSB1dGlsLnBsdWNrKG9iaiwgb3B0cy5maWVsZCk7XG4gICAgfVxuICAgIGVsc2VcbiAgICAgIHZhciBhcnIgPSBvYmpbb3B0cy5maWVsZF07XG4gICAgaWYgKHV0aWwuaXNBcnJheShhcnIpIHx8IHV0aWwuaXNTdHJpbmcoYXJyKSkge1xuICAgICAgcmV0dXJuIGFyci5pbmRleE9mKG9wdHMudmFsdWUpID4gLTE7XG4gICAgfVxuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxudmFyIGNvbXBhcmF0b3JzID0ge1xuICBlOiBmdW5jdGlvbihvcHRzKSB7XG4gICAgdmFyIGZpZWxkVmFsdWUgPSBvcHRzLm9iamVjdFtvcHRzLmZpZWxkXTtcbiAgICBpZiAobG9nLmVuYWJsZWQpIHtcbiAgICAgIGxvZyhvcHRzLmZpZWxkICsgJzogJyArIHZhbHVlQXNTdHJpbmcoZmllbGRWYWx1ZSkgKyAnID09ICcgKyB2YWx1ZUFzU3RyaW5nKG9wdHMudmFsdWUpLCB7b3B0czogb3B0c30pO1xuICAgIH1cbiAgICByZXR1cm4gZmllbGRWYWx1ZSA9PSBvcHRzLnZhbHVlO1xuICB9LFxuICBsdDogZnVuY3Rpb24ob3B0cykge1xuICAgIGlmICghb3B0cy5pbnZhbGlkKSByZXR1cm4gb3B0cy5vYmplY3Rbb3B0cy5maWVsZF0gPCBvcHRzLnZhbHVlO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfSxcbiAgZ3Q6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICBpZiAoIW9wdHMuaW52YWxpZCkgcmV0dXJuIG9wdHMub2JqZWN0W29wdHMuZmllbGRdID4gb3B0cy52YWx1ZTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0sXG4gIGx0ZTogZnVuY3Rpb24ob3B0cykge1xuICAgIGlmICghb3B0cy5pbnZhbGlkKSByZXR1cm4gb3B0cy5vYmplY3Rbb3B0cy5maWVsZF0gPD0gb3B0cy52YWx1ZTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0sXG4gIGd0ZTogZnVuY3Rpb24ob3B0cykge1xuICAgIGlmICghb3B0cy5pbnZhbGlkKSByZXR1cm4gb3B0cy5vYmplY3Rbb3B0cy5maWVsZF0gPj0gb3B0cy52YWx1ZTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0sXG4gIGNvbnRhaW5zOiBjb250YWlucyxcbiAgaW46IGNvbnRhaW5zXG59O1xuXG51dGlsLmV4dGVuZChRdWVyeSwge1xuICBjb21wYXJhdG9yczogY29tcGFyYXRvcnMsXG4gIHJlZ2lzdGVyQ29tcGFyYXRvcjogZnVuY3Rpb24oc3ltYm9sLCBmbikge1xuICAgIGlmICghY29tcGFyYXRvcnNbc3ltYm9sXSkge1xuICAgICAgY29tcGFyYXRvcnNbc3ltYm9sXSA9IGZuO1xuICAgIH1cbiAgfVxufSk7XG5cbmZ1bmN0aW9uIGNhY2hlRm9yTW9kZWwobW9kZWwpIHtcbiAgdmFyIGNhY2hlQnlUeXBlID0gY2FjaGUuX2xvY2FsQ2FjaGVCeVR5cGU7XG4gIHZhciBtb2RlbE5hbWUgPSBtb2RlbC5uYW1lO1xuICB2YXIgY29sbGVjdGlvbk5hbWUgPSBtb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgdmFyIGNhY2hlQnlNb2RlbCA9IGNhY2hlQnlUeXBlW2NvbGxlY3Rpb25OYW1lXTtcbiAgdmFyIGNhY2hlQnlMb2NhbElkO1xuICBpZiAoY2FjaGVCeU1vZGVsKSB7XG4gICAgY2FjaGVCeUxvY2FsSWQgPSBjYWNoZUJ5TW9kZWxbbW9kZWxOYW1lXSB8fCB7fTtcbiAgfVxuICByZXR1cm4gY2FjaGVCeUxvY2FsSWQ7XG59XG5cbnV0aWwuZXh0ZW5kKFF1ZXJ5LnByb3RvdHlwZSwge1xuICBleGVjdXRlOiBmdW5jdGlvbihjYikge1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICB0aGlzLl9leGVjdXRlSW5NZW1vcnkoY2IpO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG4gIF9kdW1wOiBmdW5jdGlvbihhc0pzb24pIHtcbiAgICByZXR1cm4gYXNKc29uID8gJ3t9JyA6IHt9O1xuICB9LFxuICBzb3J0RnVuYzogZnVuY3Rpb24oZmllbGRzKSB7XG4gICAgdmFyIHNvcnRGdW5jID0gZnVuY3Rpb24oYXNjZW5kaW5nLCBmaWVsZCkge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKHYxLCB2Mikge1xuICAgICAgICB2YXIgZDEgPSB2MVtmaWVsZF0sXG4gICAgICAgICAgZDIgPSB2MltmaWVsZF0sXG4gICAgICAgICAgcmVzO1xuICAgICAgICBpZiAodHlwZW9mIGQxID09ICdzdHJpbmcnIHx8IGQxIGluc3RhbmNlb2YgU3RyaW5nICYmXG4gICAgICAgICAgdHlwZW9mIGQyID09ICdzdHJpbmcnIHx8IGQyIGluc3RhbmNlb2YgU3RyaW5nKSB7XG4gICAgICAgICAgcmVzID0gYXNjZW5kaW5nID8gZDEubG9jYWxlQ29tcGFyZShkMikgOiBkMi5sb2NhbGVDb21wYXJlKGQxKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBpZiAoZDEgaW5zdGFuY2VvZiBEYXRlKSBkMSA9IGQxLmdldFRpbWUoKTtcbiAgICAgICAgICBpZiAoZDIgaW5zdGFuY2VvZiBEYXRlKSBkMiA9IGQyLmdldFRpbWUoKTtcbiAgICAgICAgICBpZiAoYXNjZW5kaW5nKSByZXMgPSBkMSAtIGQyO1xuICAgICAgICAgIGVsc2UgcmVzID0gZDIgLSBkMTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzO1xuICAgICAgfVxuICAgIH07XG4gICAgdmFyIHMgPSB1dGlsO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZmllbGRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgZmllbGQgPSBmaWVsZHNbaV07XG4gICAgICBzID0gcy50aGVuQnkoc29ydEZ1bmMoZmllbGQuYXNjZW5kaW5nLCBmaWVsZC5maWVsZCkpO1xuICAgIH1cbiAgICByZXR1cm4gcyA9PSB1dGlsID8gbnVsbCA6IHM7XG4gIH0sXG4gIF9zb3J0UmVzdWx0czogZnVuY3Rpb24ocmVzKSB7XG4gICAgdmFyIG9yZGVyID0gdGhpcy5vcHRzLm9yZGVyO1xuICAgIGlmIChyZXMgJiYgb3JkZXIpIHtcbiAgICAgIHZhciBmaWVsZHMgPSBvcmRlci5tYXAoZnVuY3Rpb24ob3JkZXJpbmcpIHtcbiAgICAgICAgdmFyIHNwbHQgPSBvcmRlcmluZy5zcGxpdCgnLScpLFxuICAgICAgICAgIGFzY2VuZGluZyA9IHRydWUsXG4gICAgICAgICAgZmllbGQgPSBudWxsO1xuICAgICAgICBpZiAoc3BsdC5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgZmllbGQgPSBzcGx0WzFdO1xuICAgICAgICAgIGFzY2VuZGluZyA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGZpZWxkID0gc3BsdFswXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ge2ZpZWxkOiBmaWVsZCwgYXNjZW5kaW5nOiBhc2NlbmRpbmd9O1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgIHZhciBzb3J0RnVuYyA9IHRoaXMuc29ydEZ1bmMoZmllbGRzKTtcbiAgICAgIGlmIChyZXMuaW1tdXRhYmxlKSByZXMgPSByZXMubXV0YWJsZUNvcHkoKTtcbiAgICAgIGlmIChzb3J0RnVuYykgcmVzLnNvcnQoc29ydEZ1bmMpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xuICB9LFxuICAvKipcbiAgICogUmV0dXJuIGFsbCBtb2RlbCBpbnN0YW5jZXMgaW4gdGhlIGNhY2hlLlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2dldENhY2hlQnlMb2NhbElkOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5kZXNjZW5kYW50cy5yZWR1Y2UoZnVuY3Rpb24obWVtbywgY2hpbGRNb2RlbCkge1xuICAgICAgcmV0dXJuIHV0aWwuZXh0ZW5kKG1lbW8sIGNhY2hlRm9yTW9kZWwoY2hpbGRNb2RlbCkpO1xuICAgIH0sIHV0aWwuZXh0ZW5kKHt9LCBjYWNoZUZvck1vZGVsKHRoaXMubW9kZWwpKSk7XG4gIH0sXG4gIF9leGVjdXRlSW5NZW1vcnk6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgdmFyIF9leGVjdXRlSW5NZW1vcnkgPSBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMubW9kZWxcbiAgICAgICAgLl9pbmRleElzSW5zdGFsbGVkXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBjYWNoZUJ5TG9jYWxJZCA9IHRoaXMuX2dldENhY2hlQnlMb2NhbElkKCk7XG4gICAgICAgICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhjYWNoZUJ5TG9jYWxJZCk7XG4gICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgIHZhciByZXMgPSBbXTtcbiAgICAgICAgICB2YXIgZXJyO1xuICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIGsgPSBrZXlzW2ldO1xuICAgICAgICAgICAgdmFyIG9iaiA9IGNhY2hlQnlMb2NhbElkW2tdO1xuICAgICAgICAgICAgdmFyIG1hdGNoZXMgPSBzZWxmLm9iamVjdE1hdGNoZXNRdWVyeShvYmopO1xuICAgICAgICAgICAgaWYgKHR5cGVvZihtYXRjaGVzKSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICBlcnIgPSBlcnJvcihtYXRjaGVzKTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBpZiAobWF0Y2hlcykgcmVzLnB1c2gob2JqKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgcmVzID0gdGhpcy5fc29ydFJlc3VsdHMocmVzKTtcbiAgICAgICAgICBpZiAoZXJyKSBsb2coJ0Vycm9yIGV4ZWN1dGluZyBxdWVyeScsIGVycik7XG4gICAgICAgICAgY2FsbGJhY2soZXJyLCBlcnIgPyBudWxsIDogY29uc3RydWN0UXVlcnlTZXQocmVzLCB0aGlzLm1vZGVsKSk7XG4gICAgICAgIH0uYmluZCh0aGlzKSlcbiAgICAgICAgLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgIHZhciBfZXJyID0gJ1VuYWJsZSB0byBleGVjdXRlIHF1ZXJ5IGR1ZSB0byBmYWlsZWQgaW5kZXggaW5zdGFsbGF0aW9uIG9uIE1vZGVsIFwiJyArXG4gICAgICAgICAgICB0aGlzLm1vZGVsLm5hbWUgKyAnXCInO1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoX2VyciwgZXJyKTtcbiAgICAgICAgICBjYWxsYmFjayhfZXJyKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9LmJpbmQodGhpcyk7XG4gICAgaWYgKHRoaXMub3B0cy5pZ25vcmVJbnN0YWxsZWQpIHtcbiAgICAgIF9leGVjdXRlSW5NZW1vcnkoKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBzaWVzdGEuX2FmdGVySW5zdGFsbChfZXhlY3V0ZUluTWVtb3J5KTtcbiAgICB9XG4gIH0sXG4gIGNsZWFyT3JkZXJpbmc6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMub3B0cy5vcmRlciA9IG51bGw7XG4gIH0sXG4gIG9iamVjdE1hdGNoZXNPclF1ZXJ5OiBmdW5jdGlvbihvYmosIG9yUXVlcnkpIHtcbiAgICBmb3IgKHZhciBpZHggaW4gb3JRdWVyeSkge1xuICAgICAgaWYgKG9yUXVlcnkuaGFzT3duUHJvcGVydHkoaWR4KSkge1xuICAgICAgICB2YXIgcXVlcnkgPSBvclF1ZXJ5W2lkeF07XG4gICAgICAgIGlmICh0aGlzLm9iamVjdE1hdGNoZXNCYXNlUXVlcnkob2JqLCBxdWVyeSkpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH0sXG4gIG9iamVjdE1hdGNoZXNBbmRRdWVyeTogZnVuY3Rpb24ob2JqLCBhbmRRdWVyeSkge1xuICAgIGZvciAodmFyIGlkeCBpbiBhbmRRdWVyeSkge1xuICAgICAgaWYgKGFuZFF1ZXJ5Lmhhc093blByb3BlcnR5KGlkeCkpIHtcbiAgICAgICAgdmFyIHF1ZXJ5ID0gYW5kUXVlcnlbaWR4XTtcbiAgICAgICAgaWYgKCF0aGlzLm9iamVjdE1hdGNoZXNCYXNlUXVlcnkob2JqLCBxdWVyeSkpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH0sXG4gIHNwbGl0TWF0Y2hlczogZnVuY3Rpb24ob2JqLCB1bnByb2Nlc3NlZEZpZWxkLCB2YWx1ZSkge1xuICAgIHZhciBvcCA9ICdlJztcbiAgICB2YXIgZmllbGRzID0gdW5wcm9jZXNzZWRGaWVsZC5zcGxpdCgnLicpO1xuICAgIHZhciBzcGx0ID0gZmllbGRzW2ZpZWxkcy5sZW5ndGggLSAxXS5zcGxpdCgnX18nKTtcbiAgICBpZiAoc3BsdC5sZW5ndGggPT0gMikge1xuICAgICAgdmFyIGZpZWxkID0gc3BsdFswXTtcbiAgICAgIG9wID0gc3BsdFsxXTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBmaWVsZCA9IHNwbHRbMF07XG4gICAgfVxuICAgIGZpZWxkc1tmaWVsZHMubGVuZ3RoIC0gMV0gPSBmaWVsZDtcbiAgICBmaWVsZHMuc2xpY2UoMCwgZmllbGRzLmxlbmd0aCAtIDEpLmZvckVhY2goZnVuY3Rpb24oZikge1xuICAgICAgaWYgKHV0aWwuaXNBcnJheShvYmopKSB7XG4gICAgICAgIG9iaiA9IHV0aWwucGx1Y2sob2JqLCBmKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBvYmogPSBvYmpbZl07XG4gICAgICB9XG4gICAgfSk7XG4gICAgLy8gSWYgd2UgZ2V0IHRvIHRoZSBwb2ludCB3aGVyZSB3ZSdyZSBhYm91dCB0byBpbmRleCBudWxsIG9yIHVuZGVmaW5lZCB3ZSBzdG9wIC0gb2J2aW91c2x5IHRoaXMgb2JqZWN0IGRvZXNcbiAgICAvLyBub3QgbWF0Y2ggdGhlIHF1ZXJ5LlxuICAgIHZhciBub3ROdWxsT3JVbmRlZmluZWQgPSBvYmogIT0gdW5kZWZpbmVkO1xuICAgIGlmIChub3ROdWxsT3JVbmRlZmluZWQpIHtcbiAgICAgIGlmICh1dGlsLmlzQXJyYXkob2JqKSkge1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHZhciB2YWwgPSBvYmpbZmllbGRdO1xuICAgICAgICB2YXIgaW52YWxpZCA9IHV0aWwuaXNBcnJheSh2YWwpID8gZmFsc2UgOiB2YWwgPT09IG51bGwgfHwgdmFsID09PSB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgICB2YXIgY29tcGFyYXRvciA9IFF1ZXJ5LmNvbXBhcmF0b3JzW29wXSxcbiAgICAgICAgb3B0cyA9IHtvYmplY3Q6IG9iaiwgZmllbGQ6IGZpZWxkLCB2YWx1ZTogdmFsdWUsIGludmFsaWQ6IGludmFsaWR9O1xuICAgICAgaWYgKCFjb21wYXJhdG9yKSB7XG4gICAgICAgIHJldHVybiAnTm8gY29tcGFyYXRvciByZWdpc3RlcmVkIGZvciBxdWVyeSBvcGVyYXRpb24gXCInICsgb3AgKyAnXCInO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGNvbXBhcmF0b3Iob3B0cyk7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfSxcbiAgb2JqZWN0TWF0Y2hlczogZnVuY3Rpb24ob2JqLCB1bnByb2Nlc3NlZEZpZWxkLCB2YWx1ZSwgcXVlcnkpIHtcbiAgICBpZiAodW5wcm9jZXNzZWRGaWVsZCA9PSAnJG9yJykge1xuICAgICAgdmFyICRvciA9IHF1ZXJ5Wyckb3InXTtcbiAgICAgIGlmICghdXRpbC5pc0FycmF5KCRvcikpIHtcbiAgICAgICAgJG9yID0gT2JqZWN0LmtleXMoJG9yKS5tYXAoZnVuY3Rpb24oaykge1xuICAgICAgICAgIHZhciBub3JtYWxpc2VkID0ge307XG4gICAgICAgICAgbm9ybWFsaXNlZFtrXSA9ICRvcltrXTtcbiAgICAgICAgICByZXR1cm4gbm9ybWFsaXNlZDtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBpZiAoIXRoaXMub2JqZWN0TWF0Y2hlc09yUXVlcnkob2JqLCAkb3IpKSByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGVsc2UgaWYgKHVucHJvY2Vzc2VkRmllbGQgPT0gJyRhbmQnKSB7XG4gICAgICBpZiAoIXRoaXMub2JqZWN0TWF0Y2hlc0FuZFF1ZXJ5KG9iaiwgcXVlcnlbJyRhbmQnXSkpIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICB2YXIgbWF0Y2hlcyA9IHRoaXMuc3BsaXRNYXRjaGVzKG9iaiwgdW5wcm9jZXNzZWRGaWVsZCwgdmFsdWUpO1xuICAgICAgaWYgKHR5cGVvZiBtYXRjaGVzICE9ICdib29sZWFuJykgcmV0dXJuIG1hdGNoZXM7XG4gICAgICBpZiAoIW1hdGNoZXMpIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH0sXG4gIG9iamVjdE1hdGNoZXNCYXNlUXVlcnk6IGZ1bmN0aW9uKG9iaiwgcXVlcnkpIHtcbiAgICB2YXIgZmllbGRzID0gT2JqZWN0LmtleXMocXVlcnkpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZmllbGRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgdW5wcm9jZXNzZWRGaWVsZCA9IGZpZWxkc1tpXSxcbiAgICAgICAgdmFsdWUgPSBxdWVyeVt1bnByb2Nlc3NlZEZpZWxkXTtcbiAgICAgIHZhciBydCA9IHRoaXMub2JqZWN0TWF0Y2hlcyhvYmosIHVucHJvY2Vzc2VkRmllbGQsIHZhbHVlLCBxdWVyeSk7XG4gICAgICBpZiAodHlwZW9mIHJ0ICE9ICdib29sZWFuJykgcmV0dXJuIHJ0O1xuICAgICAgaWYgKCFydCkgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSxcbiAgb2JqZWN0TWF0Y2hlc1F1ZXJ5OiBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gdGhpcy5vYmplY3RNYXRjaGVzQmFzZVF1ZXJ5KG9iaiwgdGhpcy5xdWVyeSk7XG4gIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFF1ZXJ5O1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL1F1ZXJ5LmpzXG4gKiogbW9kdWxlIGlkID0gMTVcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gIFByb21pc2UgPSB1dGlsLlByb21pc2UsXG4gIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICBNb2RlbEluc3RhbmNlID0gcmVxdWlyZSgnLi9Nb2RlbEluc3RhbmNlJyk7XG5cbi8qXG4gVE9ETzogVXNlIEVTNiBQcm94eSBpbnN0ZWFkLlxuIEV2ZW50dWFsbHkgcXVlcnkgc2V0cyBzaG91bGQgdXNlIEVTNiBQcm94aWVzIHdoaWNoIHdpbGwgYmUgbXVjaCBtb3JlIG5hdHVyYWwgYW5kIHJvYnVzdC4gRS5nLiBubyBuZWVkIGZvciB0aGUgYmVsb3dcbiAqL1xudmFyIEFSUkFZX01FVEhPRFMgPSBbJ3B1c2gnLCAnc29ydCcsICdyZXZlcnNlJywgJ3NwbGljZScsICdzaGlmdCcsICd1bnNoaWZ0J10sXG4gIE5VTUJFUl9NRVRIT0RTID0gWyd0b1N0cmluZycsICd0b0V4cG9uZW50aWFsJywgJ3RvRml4ZWQnLCAndG9QcmVjaXNpb24nLCAndmFsdWVPZiddLFxuICBOVU1CRVJfUFJPUEVSVElFUyA9IFsnTUFYX1ZBTFVFJywgJ01JTl9WQUxVRScsICdORUdBVElWRV9JTkZJTklUWScsICdOYU4nLCAnUE9TSVRJVkVfSU5GSU5JVFknXSxcbiAgU1RSSU5HX01FVEhPRFMgPSBbJ2NoYXJBdCcsICdjaGFyQ29kZUF0JywgJ2NvbmNhdCcsICdmcm9tQ2hhckNvZGUnLCAnaW5kZXhPZicsICdsYXN0SW5kZXhPZicsICdsb2NhbGVDb21wYXJlJyxcbiAgICAnbWF0Y2gnLCAncmVwbGFjZScsICdzZWFyY2gnLCAnc2xpY2UnLCAnc3BsaXQnLCAnc3Vic3RyJywgJ3N1YnN0cmluZycsICd0b0xvY2FsZUxvd2VyQ2FzZScsICd0b0xvY2FsZVVwcGVyQ2FzZScsXG4gICAgJ3RvTG93ZXJDYXNlJywgJ3RvU3RyaW5nJywgJ3RvVXBwZXJDYXNlJywgJ3RyaW0nLCAndmFsdWVPZiddLFxuICBTVFJJTkdfUFJPUEVSVElFUyA9IFsnbGVuZ3RoJ107XG5cbi8qKlxuICogUmV0dXJuIHRoZSBwcm9wZXJ0eSBuYW1lcyBmb3IgYSBnaXZlbiBvYmplY3QuIEhhbmRsZXMgc3BlY2lhbCBjYXNlcyBzdWNoIGFzIHN0cmluZ3MgYW5kIG51bWJlcnMgdGhhdCBkbyBub3QgaGF2ZVxuICogdGhlIGdldE93blByb3BlcnR5TmFtZXMgZnVuY3Rpb24uXG4gKiBUaGUgc3BlY2lhbCBjYXNlcyBhcmUgdmVyeSBtdWNoIGhhY2tzLiBUaGlzIGhhY2sgY2FuIGJlIHJlbW92ZWQgb25jZSB0aGUgUHJveHkgb2JqZWN0IGlzIG1vcmUgd2lkZWx5IGFkb3B0ZWQuXG4gKiBAcGFyYW0gb2JqZWN0XG4gKiBAcmV0dXJucyB7QXJyYXl9XG4gKi9cbmZ1bmN0aW9uIGdldFByb3BlcnR5TmFtZXMob2JqZWN0KSB7XG4gIHZhciBwcm9wZXJ0eU5hbWVzO1xuICBpZiAodHlwZW9mIG9iamVjdCA9PSAnc3RyaW5nJyB8fCBvYmplY3QgaW5zdGFuY2VvZiBTdHJpbmcpIHtcbiAgICBwcm9wZXJ0eU5hbWVzID0gU1RSSU5HX01FVEhPRFMuY29uY2F0KFNUUklOR19QUk9QRVJUSUVTKTtcbiAgfVxuICBlbHNlIGlmICh0eXBlb2Ygb2JqZWN0ID09ICdudW1iZXInIHx8IG9iamVjdCBpbnN0YW5jZW9mIE51bWJlcikge1xuICAgIHByb3BlcnR5TmFtZXMgPSBOVU1CRVJfTUVUSE9EUy5jb25jYXQoTlVNQkVSX1BST1BFUlRJRVMpO1xuICB9XG4gIGVsc2Uge1xuICAgIHByb3BlcnR5TmFtZXMgPSBvYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcygpO1xuICB9XG4gIHJldHVybiBwcm9wZXJ0eU5hbWVzO1xufVxuXG4vKipcbiAqIERlZmluZSBhIHByb3h5IHByb3BlcnR5IHRvIGF0dHJpYnV0ZXMgb24gb2JqZWN0cyBpbiB0aGUgYXJyYXlcbiAqIEBwYXJhbSBhcnJcbiAqIEBwYXJhbSBwcm9wXG4gKi9cbmZ1bmN0aW9uIGRlZmluZUF0dHJpYnV0ZShhcnIsIHByb3ApIHtcbiAgaWYgKCEocHJvcCBpbiBhcnIpKSB7IC8vIGUuZy4gd2UgY2Fubm90IHJlZGVmaW5lIC5sZW5ndGhcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoYXJyLCBwcm9wLCB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gcXVlcnlTZXQodXRpbC5wbHVjayhhcnIsIHByb3ApKTtcbiAgICAgIH0sXG4gICAgICBzZXQ6IGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgaWYgKHV0aWwuaXNBcnJheSh2KSkge1xuICAgICAgICAgIGlmICh0aGlzLmxlbmd0aCAhPSB2Lmxlbmd0aCkgdGhyb3cgZXJyb3Ioe21lc3NhZ2U6ICdNdXN0IGJlIHNhbWUgbGVuZ3RoJ30pO1xuICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpc1tpXVtwcm9wXSA9IHZbaV07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzW2ldW3Byb3BdID0gdjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc1Byb21pc2Uob2JqKSB7XG4gIC8vIFRPRE86IERvbid0IHRoaW5rIHRoaXMgaXMgdmVyeSByb2J1c3QuXG4gIHJldHVybiBvYmoudGhlbiAmJiBvYmouY2F0Y2g7XG59XG5cbi8qKlxuICogRGVmaW5lIGEgcHJveHkgbWV0aG9kIG9uIHRoZSBhcnJheSBpZiBub3QgYWxyZWFkeSBpbiBleGlzdGVuY2UuXG4gKiBAcGFyYW0gYXJyXG4gKiBAcGFyYW0gcHJvcFxuICovXG5mdW5jdGlvbiBkZWZpbmVNZXRob2QoYXJyLCBwcm9wKSB7XG4gIGlmICghKHByb3AgaW4gYXJyKSkgeyAvLyBlLmcuIHdlIGRvbid0IHdhbnQgdG8gcmVkZWZpbmUgdG9TdHJpbmdcbiAgICBhcnJbcHJvcF0gPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBhcmdzID0gYXJndW1lbnRzLFxuICAgICAgICByZXMgPSB0aGlzLm1hcChmdW5jdGlvbihwKSB7XG4gICAgICAgICAgcmV0dXJuIHBbcHJvcF0uYXBwbHkocCwgYXJncyk7XG4gICAgICAgIH0pO1xuICAgICAgdmFyIGFyZVByb21pc2VzID0gZmFsc2U7XG4gICAgICBpZiAocmVzLmxlbmd0aCkgYXJlUHJvbWlzZXMgPSBpc1Byb21pc2UocmVzWzBdKTtcbiAgICAgIHJldHVybiBhcmVQcm9taXNlcyA/IFByb21pc2UuYWxsKHJlcykgOiBxdWVyeVNldChyZXMpO1xuICAgIH07XG4gIH1cbn1cblxuLyoqXG4gKiBUcmFuc2Zvcm0gdGhlIGFycmF5IGludG8gYSBxdWVyeSBzZXQuXG4gKiBSZW5kZXJzIHRoZSBhcnJheSBpbW11dGFibGUuXG4gKiBAcGFyYW0gYXJyXG4gKiBAcGFyYW0gbW9kZWwgLSBUaGUgbW9kZWwgd2l0aCB3aGljaCB0byBwcm94eSB0b1xuICovXG5mdW5jdGlvbiBtb2RlbFF1ZXJ5U2V0KGFyciwgbW9kZWwpIHtcbiAgYXJyID0gdXRpbC5leHRlbmQoW10sIGFycik7XG4gIHZhciBhdHRyaWJ1dGVOYW1lcyA9IG1vZGVsLl9hdHRyaWJ1dGVOYW1lcyxcbiAgICByZWxhdGlvbnNoaXBOYW1lcyA9IG1vZGVsLl9yZWxhdGlvbnNoaXBOYW1lcyxcbiAgICBuYW1lcyA9IGF0dHJpYnV0ZU5hbWVzLmNvbmNhdChyZWxhdGlvbnNoaXBOYW1lcykuY29uY2F0KGluc3RhbmNlTWV0aG9kcyk7XG4gIG5hbWVzLmZvckVhY2goZGVmaW5lQXR0cmlidXRlLmJpbmQoZGVmaW5lQXR0cmlidXRlLCBhcnIpKTtcbiAgdmFyIGluc3RhbmNlTWV0aG9kcyA9IE9iamVjdC5rZXlzKE1vZGVsSW5zdGFuY2UucHJvdG90eXBlKTtcbiAgaW5zdGFuY2VNZXRob2RzLmZvckVhY2goZGVmaW5lTWV0aG9kLmJpbmQoZGVmaW5lTWV0aG9kLCBhcnIpKTtcbiAgcmV0dXJuIHJlbmRlckltbXV0YWJsZShhcnIpO1xufVxuXG4vKipcbiAqIFRyYW5zZm9ybSB0aGUgYXJyYXkgaW50byBhIHF1ZXJ5IHNldCwgYmFzZWQgb24gd2hhdGV2ZXIgaXMgaW4gaXQuXG4gKiBOb3RlIHRoYXQgYWxsIG9iamVjdHMgbXVzdCBiZSBvZiB0aGUgc2FtZSB0eXBlLiBUaGlzIGZ1bmN0aW9uIHdpbGwgdGFrZSB0aGUgZmlyc3Qgb2JqZWN0IGFuZCBkZWNpZGUgaG93IHRvIHByb3h5XG4gKiBiYXNlZCBvbiB0aGF0LlxuICogQHBhcmFtIGFyclxuICovXG5mdW5jdGlvbiBxdWVyeVNldChhcnIpIHtcbiAgaWYgKGFyci5sZW5ndGgpIHtcbiAgICB2YXIgcmVmZXJlbmNlT2JqZWN0ID0gYXJyWzBdLFxuICAgICAgcHJvcGVydHlOYW1lcyA9IGdldFByb3BlcnR5TmFtZXMocmVmZXJlbmNlT2JqZWN0KTtcbiAgICBwcm9wZXJ0eU5hbWVzLmZvckVhY2goZnVuY3Rpb24ocHJvcCkge1xuICAgICAgaWYgKHR5cGVvZiByZWZlcmVuY2VPYmplY3RbcHJvcF0gPT0gJ2Z1bmN0aW9uJykgZGVmaW5lTWV0aG9kKGFyciwgcHJvcCwgYXJndW1lbnRzKTtcbiAgICAgIGVsc2UgZGVmaW5lQXR0cmlidXRlKGFyciwgcHJvcCk7XG4gICAgfSk7XG4gIH1cbiAgcmV0dXJuIHJlbmRlckltbXV0YWJsZShhcnIpO1xufVxuXG5mdW5jdGlvbiB0aHJvd0ltbXV0YWJsZUVycm9yKCkge1xuICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBtb2RpZnkgYSBxdWVyeSBzZXQnKTtcbn1cblxuLyoqXG4gKiBSZW5kZXIgYW4gYXJyYXkgaW1tdXRhYmxlIGJ5IHJlcGxhY2luZyBhbnkgZnVuY3Rpb25zIHRoYXQgY2FuIG11dGF0ZSBpdC5cbiAqIEBwYXJhbSBhcnJcbiAqL1xuZnVuY3Rpb24gcmVuZGVySW1tdXRhYmxlKGFycikge1xuICBBUlJBWV9NRVRIT0RTLmZvckVhY2goZnVuY3Rpb24ocCkge1xuICAgIGFycltwXSA9IHRocm93SW1tdXRhYmxlRXJyb3I7XG4gIH0pO1xuICBhcnIuaW1tdXRhYmxlID0gdHJ1ZTtcbiAgYXJyLm11dGFibGVDb3B5ID0gYXJyLmFzQXJyYXkgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgbXV0YWJsZUFyciA9IHRoaXMubWFwKGZ1bmN0aW9uKHgpIHtyZXR1cm4geH0pO1xuICAgIG11dGFibGVBcnIuYXNRdWVyeVNldCA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHF1ZXJ5U2V0KHRoaXMpO1xuICAgIH07XG4gICAgbXV0YWJsZUFyci5hc01vZGVsUXVlcnlTZXQgPSBmdW5jdGlvbihtb2RlbCkge1xuICAgICAgcmV0dXJuIG1vZGVsUXVlcnlTZXQodGhpcywgbW9kZWwpO1xuICAgIH07XG4gICAgcmV0dXJuIG11dGFibGVBcnI7XG4gIH07XG4gIHJldHVybiBhcnI7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbW9kZWxRdWVyeVNldDtcblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9RdWVyeVNldC5qc1xuICoqIG1vZHVsZSBpZCA9IDE2XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCIvKipcbiAqIERlYWQgc2ltcGxlIGxvZ2dpbmcgc2VydmljZSBiYXNlZCBvbiB2aXNpb25tZWRpYS9kZWJ1Z1xuICogQG1vZHVsZSBsb2dcbiAqL1xuXG52YXIgZGVidWcgPSByZXF1aXJlKCdkZWJ1ZycpLFxuICBhcmdzYXJyYXkgPSByZXF1aXJlKCdhcmdzYXJyYXknKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihuYW1lKSB7XG4gIHZhciBsb2cgPSBkZWJ1Zygnc2llc3RhOicgKyBuYW1lKTtcbiAgdmFyIGZuID0gYXJnc2FycmF5KGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICBsb2cuY2FsbChsb2csIGFyZ3MpO1xuICB9KTtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGZuLCAnZW5hYmxlZCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGRlYnVnLmVuYWJsZWQobmFtZSk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIGZuO1xufTtcblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9sb2cuanNcbiAqKiBtb2R1bGUgaWQgPSAxN1xuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyksXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgZXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJyksXG4gIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICBNb2RlbEV2ZW50VHlwZSA9IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLFxuICBldmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpLFxuICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKTtcblxuZnVuY3Rpb24gTW9kZWxJbnN0YW5jZShtb2RlbCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHRoaXMubW9kZWwgPSBtb2RlbDtcblxuICB1dGlsLnN1YlByb3BlcnRpZXModGhpcywgdGhpcy5tb2RlbCwgW1xuICAgICdjb2xsZWN0aW9uJyxcbiAgICAnY29sbGVjdGlvbk5hbWUnLFxuICAgICdfYXR0cmlidXRlTmFtZXMnLFxuICAgIHtcbiAgICAgIG5hbWU6ICdpZEZpZWxkJyxcbiAgICAgIHByb3BlcnR5OiAnaWQnXG4gICAgfSxcbiAgICB7XG4gICAgICBuYW1lOiAnbW9kZWxOYW1lJyxcbiAgICAgIHByb3BlcnR5OiAnbmFtZSdcbiAgICB9XG4gIF0pO1xuXG4gIGV2ZW50cy5Qcm94eUV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICBfcmVsYXRpb25zaGlwTmFtZXM6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBwcm94aWVzID0gT2JqZWN0LmtleXMoc2VsZi5fX3Byb3hpZXMgfHwge30pLm1hcChmdW5jdGlvbih4KSB7XG4gICAgICAgICAgcmV0dXJuIHNlbGYuX19wcm94aWVzW3hdXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcHJveGllcy5tYXAoZnVuY3Rpb24ocCkge1xuICAgICAgICAgIGlmIChwLmlzRm9yd2FyZCkge1xuICAgICAgICAgICAgcmV0dXJuIHAuZm9yd2FyZE5hbWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBwLnJldmVyc2VOYW1lO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0sXG4gICAgZGlydHk6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmIChzaWVzdGEuZXh0LnN0b3JhZ2VFbmFibGVkKSB7XG4gICAgICAgICAgcmV0dXJuIHNlbGYubG9jYWxJZCBpbiBzaWVzdGEuZXh0LnN0b3JhZ2UuX3Vuc2F2ZWRPYmplY3RzSGFzaDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0sXG4gICAgLy8gVGhpcyBpcyBmb3IgUHJveHlFdmVudEVtaXR0ZXIuXG4gICAgZXZlbnQ6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxvY2FsSWRcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuXG4gIHRoaXMucmVtb3ZlZCA9IGZhbHNlO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIG9yIG5vdCBldmVudHMgKHNldCwgcmVtb3ZlIGV0YykgYXJlIGVtaXR0ZWQgZm9yIHRoaXMgbW9kZWwgaW5zdGFuY2UuXG4gICAqXG4gICAqIFRoaXMgaXMgdXNlZCBhcyBhIHdheSBvZiBjb250cm9sbGluZyB3aGF0IGV2ZW50cyBhcmUgZW1pdHRlZCB3aGVuIHRoZSBtb2RlbCBpbnN0YW5jZSBpcyBjcmVhdGVkLiBFLmcuIHdlIGRvbid0XG4gICAqIHdhbnQgdG8gc2VuZCBhIG1ldHJpYyBzaGl0IHRvbiBvZiAnc2V0JyBldmVudHMgaWYgd2UncmUgbmV3bHkgY3JlYXRpbmcgYW4gaW5zdGFuY2UuIFdlIG9ubHkgd2FudCB0byBzZW5kIHRoZVxuICAgKiAnbmV3JyBldmVudCBvbmNlIGNvbnN0cnVjdGVkLlxuICAgKlxuICAgKiBUaGlzIGlzIHByb2JhYmx5IGEgYml0IG9mIGEgaGFjayBhbmQgc2hvdWxkIGJlIHJlbW92ZWQgZXZlbnR1YWxseS5cbiAgICogQHR5cGUge2Jvb2xlYW59XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICB0aGlzLl9lbWl0RXZlbnRzID0gZmFsc2U7XG59XG5cbk1vZGVsSW5zdGFuY2UucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShldmVudHMuUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlKTtcblxudXRpbC5leHRlbmQoTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUsIHtcbiAgZ2V0OiBmdW5jdGlvbihjYikge1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICBjYihudWxsLCB0aGlzKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuICBlbWl0OiBmdW5jdGlvbih0eXBlLCBvcHRzKSB7XG4gICAgaWYgKHR5cGVvZiB0eXBlID09ICdvYmplY3QnKSBvcHRzID0gdHlwZTtcbiAgICBlbHNlIG9wdHMudHlwZSA9IHR5cGU7XG4gICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgdXRpbC5leHRlbmQob3B0cywge1xuICAgICAgY29sbGVjdGlvbjogdGhpcy5jb2xsZWN0aW9uTmFtZSxcbiAgICAgIG1vZGVsOiB0aGlzLm1vZGVsLm5hbWUsXG4gICAgICBsb2NhbElkOiB0aGlzLmxvY2FsSWQsXG4gICAgICBvYmo6IHRoaXNcbiAgICB9KTtcbiAgICBtb2RlbEV2ZW50cy5lbWl0KG9wdHMpO1xuICB9LFxuICByZW1vdmU6IGZ1bmN0aW9uKGNiLCBub3RpZmljYXRpb24pIHtcbiAgICBfLmVhY2godGhpcy5fcmVsYXRpb25zaGlwTmFtZXMsIGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIGlmICh1dGlsLmlzQXJyYXkodGhpc1tuYW1lXSkpIHtcbiAgICAgICAgdGhpc1tuYW1lXSA9IFtdO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHRoaXNbbmFtZV0gPSBudWxsO1xuICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG4gICAgbm90aWZpY2F0aW9uID0gbm90aWZpY2F0aW9uID09IG51bGwgPyB0cnVlIDogbm90aWZpY2F0aW9uO1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICBjYWNoZS5yZW1vdmUodGhpcyk7XG4gICAgICB0aGlzLnJlbW92ZWQgPSB0cnVlO1xuICAgICAgaWYgKG5vdGlmaWNhdGlvbikge1xuICAgICAgICB0aGlzLmVtaXQobW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuUmVtb3ZlLCB7XG4gICAgICAgICAgb2xkOiB0aGlzXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgdmFyIHJlbW92ZSA9IHRoaXMubW9kZWwucmVtb3ZlO1xuICAgICAgaWYgKHJlbW92ZSkge1xuICAgICAgICB2YXIgcGFyYW1OYW1lcyA9IHV0aWwucGFyYW1OYW1lcyhyZW1vdmUpO1xuICAgICAgICBpZiAocGFyYW1OYW1lcy5sZW5ndGgpIHtcbiAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgcmVtb3ZlLmNhbGwodGhpcywgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICBjYihlcnIsIHNlbGYpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHJlbW92ZS5jYWxsKHRoaXMpO1xuICAgICAgICAgIGNiKG51bGwsIHRoaXMpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY2IobnVsbCwgdGhpcyk7XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgcmVzdG9yZTogZnVuY3Rpb24oY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgdmFyIF9maW5pc2ggPSBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICB0aGlzLmVtaXQobW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuTmV3LCB7XG4gICAgICAgICAgICBuZXc6IHRoaXNcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBjYihlcnIsIHRoaXMpO1xuICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgaWYgKHRoaXMucmVtb3ZlZCkge1xuICAgICAgICBjYWNoZS5pbnNlcnQodGhpcyk7XG4gICAgICAgIHRoaXMucmVtb3ZlZCA9IGZhbHNlO1xuICAgICAgICB2YXIgaW5pdCA9IHRoaXMubW9kZWwuaW5pdDtcbiAgICAgICAgaWYgKGluaXQpIHtcbiAgICAgICAgICB2YXIgcGFyYW1OYW1lcyA9IHV0aWwucGFyYW1OYW1lcyhpbml0KTtcbiAgICAgICAgICB2YXIgZnJvbVN0b3JhZ2UgPSB0cnVlO1xuICAgICAgICAgIGlmIChwYXJhbU5hbWVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgIGluaXQuY2FsbCh0aGlzLCBmcm9tU3RvcmFnZSwgX2ZpbmlzaCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaW5pdC5jYWxsKHRoaXMsIGZyb21TdG9yYWdlKTtcbiAgICAgICAgICAgIF9maW5pc2goKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgX2ZpbmlzaCgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfVxufSk7XG5cbi8vIEluc3BlY3Rpb25cbnV0aWwuZXh0ZW5kKE1vZGVsSW5zdGFuY2UucHJvdG90eXBlLCB7XG4gIGdldEF0dHJpYnV0ZXM6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB1dGlsLmV4dGVuZCh7fSwgdGhpcy5fX3ZhbHVlcyk7XG4gIH0sXG4gIGlzSW5zdGFuY2VPZjogZnVuY3Rpb24obW9kZWwpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbCA9PSBtb2RlbDtcbiAgfSxcbiAgaXNBOiBmdW5jdGlvbihtb2RlbCkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsID09IG1vZGVsIHx8IHRoaXMubW9kZWwuaXNEZXNjZW5kYW50T2YobW9kZWwpO1xuICB9XG59KTtcblxuLy8gRHVtcFxudXRpbC5leHRlbmQoTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUsIHtcbiAgX2R1bXBTdHJpbmc6IGZ1bmN0aW9uKHJldmVyc2VSZWxhdGlvbnNoaXBzKSB7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHRoaXMuX2R1bXAocmV2ZXJzZVJlbGF0aW9uc2hpcHMsIG51bGwsIDQpKTtcbiAgfSxcbiAgX2R1bXA6IGZ1bmN0aW9uKHJldmVyc2VSZWxhdGlvbnNoaXBzKSB7XG4gICAgdmFyIGR1bXBlZCA9IHV0aWwuZXh0ZW5kKHt9LCB0aGlzLl9fdmFsdWVzKTtcbiAgICBkdW1wZWQuX3JldiA9IHRoaXMuX3JldjtcbiAgICBkdW1wZWQubG9jYWxJZCA9IHRoaXMubG9jYWxJZDtcbiAgICByZXR1cm4gZHVtcGVkO1xuICB9XG59KTtcblxuZnVuY3Rpb24gZGVmYXVsdFNlcmlhbGlzZXIoYXR0ck5hbWUsIHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZTtcbn1cblxuLy8gU2VyaWFsaXNhdGlvblxudXRpbC5leHRlbmQoTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUsIHtcbiAgX2RlZmF1bHRTZXJpYWxpc2U6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICB2YXIgc2VyaWFsaXNlZCA9IHt9O1xuICAgIHZhciBpbmNsdWRlTnVsbEF0dHJpYnV0ZXMgPSBvcHRzLmluY2x1ZGVOdWxsQXR0cmlidXRlcyAhPT0gdW5kZWZpbmVkID8gb3B0cy5pbmNsdWRlTnVsbEF0dHJpYnV0ZXMgOiB0cnVlLFxuICAgICAgaW5jbHVkZU51bGxSZWxhdGlvbnNoaXBzID0gb3B0cy5pbmNsdWRlTnVsbFJlbGF0aW9uc2hpcHMgIT09IHVuZGVmaW5lZCA/IG9wdHMuaW5jbHVkZU51bGxSZWxhdGlvbnNoaXBzIDogdHJ1ZTtcbiAgICB2YXIgc2VyaWFsaXNhYmxlRmllbGRzID0gdGhpcy5tb2RlbC5zZXJpYWxpc2FibGVGaWVsZHMgfHxcbiAgICAgIHRoaXMuX2F0dHJpYnV0ZU5hbWVzLmNvbmNhdC5hcHBseSh0aGlzLl9hdHRyaWJ1dGVOYW1lcywgdGhpcy5fcmVsYXRpb25zaGlwTmFtZXMpLmNvbmNhdCh0aGlzLmlkKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGVOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uKGF0dHJOYW1lKSB7XG4gICAgICBpZiAoc2VyaWFsaXNhYmxlRmllbGRzLmluZGV4T2YoYXR0ck5hbWUpID4gLTEpIHtcbiAgICAgICAgdmFyIGF0dHJEZWZpbml0aW9uID0gdGhpcy5tb2RlbC5fYXR0cmlidXRlRGVmaW5pdGlvbldpdGhOYW1lKGF0dHJOYW1lKSB8fCB7fTtcbiAgICAgICAgdmFyIHNlcmlhbGlzZXI7XG4gICAgICAgIGlmIChhdHRyRGVmaW5pdGlvbi5zZXJpYWxpc2UpIHNlcmlhbGlzZXIgPSBhdHRyRGVmaW5pdGlvbi5zZXJpYWxpc2UuYmluZCh0aGlzKTtcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgdmFyIHNlcmlhbGlzZUZpZWxkID0gdGhpcy5tb2RlbC5zZXJpYWxpc2VGaWVsZCB8fCBkZWZhdWx0U2VyaWFsaXNlcjtcbiAgICAgICAgICBzZXJpYWxpc2VyID0gc2VyaWFsaXNlRmllbGQuYmluZCh0aGlzLCBhdHRyTmFtZSk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHZhbCA9IHRoaXNbYXR0ck5hbWVdO1xuICAgICAgICBpZiAodmFsID09PSBudWxsKSB7XG4gICAgICAgICAgaWYgKGluY2x1ZGVOdWxsQXR0cmlidXRlcykge1xuICAgICAgICAgICAgc2VyaWFsaXNlZFthdHRyTmFtZV0gPSBzZXJpYWxpc2VyKHZhbCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHZhbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgc2VyaWFsaXNlZFthdHRyTmFtZV0gPSBzZXJpYWxpc2VyKHZhbCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpO1xuICAgIHRoaXMuX3JlbGF0aW9uc2hpcE5hbWVzLmZvckVhY2goZnVuY3Rpb24ocmVsTmFtZSkge1xuICAgICAgaWYgKHNlcmlhbGlzYWJsZUZpZWxkcy5pbmRleE9mKHJlbE5hbWUpID4gLTEpIHtcbiAgICAgICAgdmFyIHZhbCA9IHRoaXNbcmVsTmFtZV0sXG4gICAgICAgICAgcmVsID0gdGhpcy5tb2RlbC5yZWxhdGlvbnNoaXBzW3JlbE5hbWVdO1xuXG4gICAgICAgIGlmIChyZWwgJiYgIXJlbC5pc1JldmVyc2UpIHtcbiAgICAgICAgICB2YXIgc2VyaWFsaXNlcjtcbiAgICAgICAgICBpZiAocmVsLnNlcmlhbGlzZSkge1xuICAgICAgICAgICAgc2VyaWFsaXNlciA9IHJlbC5zZXJpYWxpc2UuYmluZCh0aGlzKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB2YXIgc2VyaWFsaXNlRmllbGQgPSB0aGlzLm1vZGVsLnNlcmlhbGlzZUZpZWxkO1xuICAgICAgICAgICAgaWYgKCFzZXJpYWxpc2VGaWVsZCkge1xuICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KHZhbCkpIHZhbCA9IHV0aWwucGx1Y2sodmFsLCB0aGlzLm1vZGVsLmlkKTtcbiAgICAgICAgICAgICAgZWxzZSBpZiAodmFsKSB2YWwgPSB2YWxbdGhpcy5tb2RlbC5pZF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzZXJpYWxpc2VGaWVsZCA9IHNlcmlhbGlzZUZpZWxkIHx8IGRlZmF1bHRTZXJpYWxpc2VyO1xuICAgICAgICAgICAgc2VyaWFsaXNlciA9IHNlcmlhbGlzZUZpZWxkLmJpbmQodGhpcywgcmVsTmFtZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICh2YWwgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGlmIChpbmNsdWRlTnVsbFJlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgICAgICAgc2VyaWFsaXNlZFtyZWxOYW1lXSA9IHNlcmlhbGlzZXIodmFsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSBpZiAodXRpbC5pc0FycmF5KHZhbCkpIHtcbiAgICAgICAgICAgIGlmICgoaW5jbHVkZU51bGxSZWxhdGlvbnNoaXBzICYmICF2YWwubGVuZ3RoKSB8fCB2YWwubGVuZ3RoKSB7XG4gICAgICAgICAgICAgIHNlcmlhbGlzZWRbcmVsTmFtZV0gPSBzZXJpYWxpc2VyKHZhbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2UgaWYgKHZhbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBzZXJpYWxpc2VkW3JlbE5hbWVdID0gc2VyaWFsaXNlcih2YWwpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG4gICAgcmV0dXJuIHNlcmlhbGlzZWQ7XG4gIH0sXG4gIHNlcmlhbGlzZTogZnVuY3Rpb24ob3B0cykge1xuICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgIGlmICghdGhpcy5tb2RlbC5zZXJpYWxpc2UpIHJldHVybiB0aGlzLl9kZWZhdWx0U2VyaWFsaXNlKG9wdHMpO1xuICAgIGVsc2UgcmV0dXJuIHRoaXMubW9kZWwuc2VyaWFsaXNlKHRoaXMsIG9wdHMpO1xuICB9XG59KTtcblxudXRpbC5leHRlbmQoTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUsIHtcbiAgLyoqXG4gICAqIEVtaXQgYW4gZXZlbnQgaW5kaWNhdGluZyB0aGF0IHRoaXMgaW5zdGFuY2UgaGFzIGp1c3QgYmVlbiBjcmVhdGVkLlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2VtaXROZXc6IGZ1bmN0aW9uKCkge1xuICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgICAgY29sbGVjdGlvbjogdGhpcy5tb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgIG1vZGVsOiB0aGlzLm1vZGVsLm5hbWUsXG4gICAgICBsb2NhbElkOiB0aGlzLmxvY2FsSWQsXG4gICAgICBuZXc6IHRoaXMsXG4gICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5OZXcsXG4gICAgICBvYmo6IHRoaXNcbiAgICB9KTtcbiAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gTW9kZWxJbnN0YW5jZTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL01vZGVsSW5zdGFuY2UuanNcbiAqKiBtb2R1bGUgaWQgPSAxOFxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIE1vZGVsSW5zdGFuY2UgPSByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKSxcbiAgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSgnZ3JhcGgnKSxcbiAgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyksXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuZnVuY3Rpb24gU2llc3RhRXJyb3Iob3B0cykge1xuICB0aGlzLm9wdHMgPSBvcHRzO1xufVxuXG5TaWVzdGFFcnJvci5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHRoaXMub3B0cywgbnVsbCwgNCk7XG59O1xuXG4vKipcbiAqIEVuY2Fwc3VsYXRlcyB0aGUgaWRlYSBvZiBtYXBwaW5nIGFycmF5cyBvZiBkYXRhIG9udG8gdGhlIG9iamVjdCBncmFwaCBvciBhcnJheXMgb2Ygb2JqZWN0cy5cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKiBAcGFyYW0gb3B0cy5tb2RlbFxuICogQHBhcmFtIG9wdHMuZGF0YVxuICogQHBhcmFtIG9wdHMub2JqZWN0c1xuICogQHBhcmFtIG9wdHMuZGlzYWJsZU5vdGlmaWNhdGlvbnNcbiAqL1xuZnVuY3Rpb24gTWFwcGluZ09wZXJhdGlvbihvcHRzKSB7XG4gIHRoaXMuX29wdHMgPSBvcHRzO1xuXG4gIHV0aWwuZXh0ZW5kRnJvbU9wdHModGhpcywgb3B0cywge1xuICAgIG1vZGVsOiBudWxsLFxuICAgIGRhdGE6IG51bGwsXG4gICAgb2JqZWN0czogW10sXG4gICAgZGlzYWJsZWV2ZW50czogZmFsc2UsXG4gICAgX2lnbm9yZUluc3RhbGxlZDogZmFsc2UsXG4gICAgZnJvbVN0b3JhZ2U6IGZhbHNlXG4gIH0pO1xuXG4gIHV0aWwuZXh0ZW5kKHRoaXMsIHtcbiAgICBlcnJvcnM6IFtdLFxuICAgIHN1YlRhc2tSZXN1bHRzOiB7fSxcbiAgICBfbmV3T2JqZWN0czogW11cbiAgfSk7XG5cblxuICB0aGlzLm1vZGVsLl9pbnN0YWxsUmV2ZXJzZVBsYWNlaG9sZGVycygpO1xuICB0aGlzLmRhdGEgPSB0aGlzLnByZXByb2Nlc3NEYXRhKCk7XG59XG5cbnV0aWwuZXh0ZW5kKE1hcHBpbmdPcGVyYXRpb24ucHJvdG90eXBlLCB7XG4gIG1hcEF0dHJpYnV0ZXM6IGZ1bmN0aW9uKCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5kYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgZGF0dW0gPSB0aGlzLmRhdGFbaV0sXG4gICAgICAgIG9iamVjdCA9IHRoaXMub2JqZWN0c1tpXTtcbiAgICAgIC8vIE5vIHBvaW50IG1hcHBpbmcgb2JqZWN0IG9udG8gaXRzZWxmLiBUaGlzIGhhcHBlbnMgaWYgYSBNb2RlbEluc3RhbmNlIGlzIHBhc3NlZCBhcyBhIHJlbGF0aW9uc2hpcC5cbiAgICAgIGlmIChkYXR1bSAhPSBvYmplY3QpIHtcbiAgICAgICAgaWYgKG9iamVjdCkgeyAvLyBJZiBvYmplY3QgaXMgZmFsc3ksIHRoZW4gdGhlcmUgd2FzIGFuIGVycm9yIGxvb2tpbmcgdXAgdGhhdCBvYmplY3QvY3JlYXRpbmcgaXQuXG4gICAgICAgICAgdmFyIGZpZWxkcyA9IHRoaXMubW9kZWwuX2F0dHJpYnV0ZU5hbWVzO1xuICAgICAgICAgIGZpZWxkcy5mb3JFYWNoKGZ1bmN0aW9uKGYpIHtcbiAgICAgICAgICAgIGlmIChkYXR1bVtmXSAhPT0gdW5kZWZpbmVkKSB7IC8vIG51bGwgaXMgZmluZVxuICAgICAgICAgICAgICAvLyBJZiBldmVudHMgYXJlIGRpc2FibGVkIHdlIHVwZGF0ZSBfX3ZhbHVlcyBvYmplY3QgZGlyZWN0bHkuIFRoaXMgYXZvaWRzIHRyaWdnZXJpbmdcbiAgICAgICAgICAgICAgLy8gZXZlbnRzIHdoaWNoIGFyZSBidWlsdCBpbnRvIHRoZSBzZXQgZnVuY3Rpb24gb2YgdGhlIHByb3BlcnR5LlxuICAgICAgICAgICAgICBpZiAodGhpcy5kaXNhYmxlZXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgb2JqZWN0Ll9fdmFsdWVzW2ZdID0gZGF0dW1bZl07XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgb2JqZWN0W2ZdID0gZGF0dW1bZl07XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgIC8vIFBvdWNoREIgcmV2aXNpb24gKGlmIHVzaW5nIHN0b3JhZ2UgbW9kdWxlKS5cbiAgICAgICAgICAvLyBUT0RPOiBDYW4gdGhpcyBiZSBwdWxsZWQgb3V0IG9mIGNvcmU/XG4gICAgICAgICAgaWYgKGRhdHVtLl9yZXYpIG9iamVjdC5fcmV2ID0gZGF0dW0uX3JldjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgX21hcDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBlcnI7XG4gICAgdGhpcy5tYXBBdHRyaWJ1dGVzKCk7XG4gICAgdmFyIHJlbGF0aW9uc2hpcEZpZWxkcyA9IE9iamVjdC5rZXlzKHNlbGYuc3ViVGFza1Jlc3VsdHMpO1xuICAgIHJlbGF0aW9uc2hpcEZpZWxkcy5mb3JFYWNoKGZ1bmN0aW9uKGYpIHtcbiAgICAgIHZhciByZXMgPSBzZWxmLnN1YlRhc2tSZXN1bHRzW2ZdO1xuICAgICAgdmFyIGluZGV4ZXMgPSByZXMuaW5kZXhlcyxcbiAgICAgICAgb2JqZWN0cyA9IHJlcy5vYmplY3RzO1xuICAgICAgdmFyIHJlbGF0ZWREYXRhID0gc2VsZi5nZXRSZWxhdGVkRGF0YShmKS5yZWxhdGVkRGF0YTtcbiAgICAgIHZhciB1bmZsYXR0ZW5lZE9iamVjdHMgPSB1dGlsLnVuZmxhdHRlbkFycmF5KG9iamVjdHMsIHJlbGF0ZWREYXRhKTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdW5mbGF0dGVuZWRPYmplY3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBpZHggPSBpbmRleGVzW2ldO1xuICAgICAgICAvLyBFcnJvcnMgYXJlIHBsdWNrZWQgZnJvbSB0aGUgc3Vib3BlcmF0aW9ucy5cbiAgICAgICAgdmFyIGVycm9yID0gc2VsZi5lcnJvcnNbaWR4XTtcbiAgICAgICAgZXJyID0gZXJyb3IgPyBlcnJvcltmXSA6IG51bGw7XG4gICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgdmFyIHJlbGF0ZWQgPSB1bmZsYXR0ZW5lZE9iamVjdHNbaV07IC8vIENhbiBiZSBhcnJheSBvciBzY2FsYXIuXG4gICAgICAgICAgdmFyIG9iamVjdCA9IHNlbGYub2JqZWN0c1tpZHhdO1xuICAgICAgICAgIGlmIChvYmplY3QpIHtcbiAgICAgICAgICAgIGVyciA9IG9iamVjdC5fX3Byb3hpZXNbZl0uc2V0KHJlbGF0ZWQsIHtkaXNhYmxlZXZlbnRzOiBzZWxmLmRpc2FibGVldmVudHN9KTtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgaWYgKCFzZWxmLmVycm9yc1tpZHhdKSBzZWxmLmVycm9yc1tpZHhdID0ge307XG4gICAgICAgICAgICAgIHNlbGYuZXJyb3JzW2lkeF1bZl0gPSBlcnI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG4gIC8qKlxuICAgKiBGaWd1cmUgb3V0IHdoaWNoIGRhdGEgaXRlbXMgcmVxdWlyZSBhIGNhY2hlIGxvb2t1cC5cbiAgICogQHJldHVybnMge3tyZW1vdGVMb29rdXBzOiBBcnJheSwgbG9jYWxMb29rdXBzOiBBcnJheX19XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfc29ydExvb2t1cHM6IGZ1bmN0aW9uKCkge1xuICAgIHZhciByZW1vdGVMb29rdXBzID0gW107XG4gICAgdmFyIGxvY2FsTG9va3VwcyA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5kYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoIXRoaXMub2JqZWN0c1tpXSkge1xuICAgICAgICB2YXIgbG9va3VwO1xuICAgICAgICB2YXIgZGF0dW0gPSB0aGlzLmRhdGFbaV07XG4gICAgICAgIHZhciBpc1NjYWxhciA9IHR5cGVvZiBkYXR1bSA9PSAnc3RyaW5nJyB8fCB0eXBlb2YgZGF0dW0gPT0gJ251bWJlcicgfHwgZGF0dW0gaW5zdGFuY2VvZiBTdHJpbmc7XG4gICAgICAgIGlmIChkYXR1bSkge1xuICAgICAgICAgIGlmIChpc1NjYWxhcikge1xuICAgICAgICAgICAgbG9va3VwID0ge1xuICAgICAgICAgICAgICBpbmRleDogaSxcbiAgICAgICAgICAgICAgZGF0dW06IHt9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgbG9va3VwLmRhdHVtW3RoaXMubW9kZWwuaWRdID0gZGF0dW07XG4gICAgICAgICAgICByZW1vdGVMb29rdXBzLnB1c2gobG9va3VwKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGRhdHVtIGluc3RhbmNlb2YgTW9kZWxJbnN0YW5jZSkgeyAvLyBXZSB3b24ndCBuZWVkIHRvIHBlcmZvcm0gYW55IG1hcHBpbmcuXG4gICAgICAgICAgICB0aGlzLm9iamVjdHNbaV0gPSBkYXR1bTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGRhdHVtLmxvY2FsSWQpIHtcbiAgICAgICAgICAgIGxvY2FsTG9va3Vwcy5wdXNoKHtcbiAgICAgICAgICAgICAgaW5kZXg6IGksXG4gICAgICAgICAgICAgIGRhdHVtOiBkYXR1bVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSBlbHNlIGlmIChkYXR1bVt0aGlzLm1vZGVsLmlkXSkge1xuICAgICAgICAgICAgcmVtb3RlTG9va3Vwcy5wdXNoKHtcbiAgICAgICAgICAgICAgaW5kZXg6IGksXG4gICAgICAgICAgICAgIGRhdHVtOiBkYXR1bVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMub2JqZWN0c1tpXSA9IHRoaXMuX2luc3RhbmNlKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMub2JqZWN0c1tpXSA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtyZW1vdGVMb29rdXBzOiByZW1vdGVMb29rdXBzLCBsb2NhbExvb2t1cHM6IGxvY2FsTG9va3Vwc307XG4gIH0sXG4gIF9wZXJmb3JtTG9jYWxMb29rdXBzOiBmdW5jdGlvbihsb2NhbExvb2t1cHMpIHtcbiAgICB2YXIgbG9jYWxJZGVudGlmaWVycyA9IHV0aWwucGx1Y2sodXRpbC5wbHVjayhsb2NhbExvb2t1cHMsICdkYXR1bScpLCAnbG9jYWxJZCcpLFxuICAgICAgbG9jYWxPYmplY3RzID0gY2FjaGUuZ2V0VmlhTG9jYWxJZChsb2NhbElkZW50aWZpZXJzKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxvY2FsSWRlbnRpZmllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBvYmogPSBsb2NhbE9iamVjdHNbaV07XG4gICAgICB2YXIgbG9jYWxJZCA9IGxvY2FsSWRlbnRpZmllcnNbaV07XG4gICAgICB2YXIgbG9va3VwID0gbG9jYWxMb29rdXBzW2ldO1xuICAgICAgaWYgKCFvYmopIHtcbiAgICAgICAgLy8gSWYgdGhlcmUgYXJlIG11bHRpcGxlIG1hcHBpbmcgb3BlcmF0aW9ucyBnb2luZyBvbiwgdGhlcmUgbWF5IGJlXG4gICAgICAgIG9iaiA9IGNhY2hlLmdldCh7bG9jYWxJZDogbG9jYWxJZH0pO1xuICAgICAgICBpZiAoIW9iaikgb2JqID0gdGhpcy5faW5zdGFuY2Uoe2xvY2FsSWQ6IGxvY2FsSWR9LCAhdGhpcy5kaXNhYmxlZXZlbnRzKTtcbiAgICAgICAgdGhpcy5vYmplY3RzW2xvb2t1cC5pbmRleF0gPSBvYmo7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm9iamVjdHNbbG9va3VwLmluZGV4XSA9IG9iajtcbiAgICAgIH1cbiAgICB9XG5cbiAgfSxcbiAgX3BlcmZvcm1SZW1vdGVMb29rdXBzOiBmdW5jdGlvbihyZW1vdGVMb29rdXBzKSB7XG4gICAgdmFyIHJlbW90ZUlkZW50aWZpZXJzID0gdXRpbC5wbHVjayh1dGlsLnBsdWNrKHJlbW90ZUxvb2t1cHMsICdkYXR1bScpLCB0aGlzLm1vZGVsLmlkKSxcbiAgICAgIHJlbW90ZU9iamVjdHMgPSBjYWNoZS5nZXRWaWFSZW1vdGVJZChyZW1vdGVJZGVudGlmaWVycywge21vZGVsOiB0aGlzLm1vZGVsfSk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZW1vdGVPYmplY3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgb2JqID0gcmVtb3RlT2JqZWN0c1tpXSxcbiAgICAgICAgbG9va3VwID0gcmVtb3RlTG9va3Vwc1tpXTtcbiAgICAgIGlmIChvYmopIHtcbiAgICAgICAgdGhpcy5vYmplY3RzW2xvb2t1cC5pbmRleF0gPSBvYmo7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgZGF0YSA9IHt9O1xuICAgICAgICB2YXIgcmVtb3RlSWQgPSByZW1vdGVJZGVudGlmaWVyc1tpXTtcbiAgICAgICAgZGF0YVt0aGlzLm1vZGVsLmlkXSA9IHJlbW90ZUlkO1xuICAgICAgICB2YXIgY2FjaGVRdWVyeSA9IHtcbiAgICAgICAgICBtb2RlbDogdGhpcy5tb2RlbFxuICAgICAgICB9O1xuICAgICAgICBjYWNoZVF1ZXJ5W3RoaXMubW9kZWwuaWRdID0gcmVtb3RlSWQ7XG4gICAgICAgIHZhciBjYWNoZWQgPSBjYWNoZS5nZXQoY2FjaGVRdWVyeSk7XG4gICAgICAgIGlmIChjYWNoZWQpIHtcbiAgICAgICAgICB0aGlzLm9iamVjdHNbbG9va3VwLmluZGV4XSA9IGNhY2hlZDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLm9iamVjdHNbbG9va3VwLmluZGV4XSA9IHRoaXMuX2luc3RhbmNlKCk7XG4gICAgICAgICAgLy8gSXQncyBpbXBvcnRhbnQgdGhhdCB3ZSBtYXAgdGhlIHJlbW90ZSBpZGVudGlmaWVyIGhlcmUgdG8gZW5zdXJlIHRoYXQgaXQgZW5kc1xuICAgICAgICAgIC8vIHVwIGluIHRoZSBjYWNoZS5cbiAgICAgICAgICB0aGlzLm9iamVjdHNbbG9va3VwLmluZGV4XVt0aGlzLm1vZGVsLmlkXSA9IHJlbW90ZUlkO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAvKipcbiAgICogRm9yIGluZGljZXMgd2hlcmUgbm8gb2JqZWN0IGlzIHByZXNlbnQsIHBlcmZvcm0gY2FjaGUgbG9va3VwcywgY3JlYXRpbmcgYSBuZXcgb2JqZWN0IGlmIG5lY2Vzc2FyeS5cbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9sb29rdXA6IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLm1vZGVsLnNpbmdsZXRvbikge1xuICAgICAgdGhpcy5fbG9va3VwU2luZ2xldG9uKCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdmFyIGxvb2t1cHMgPSB0aGlzLl9zb3J0TG9va3VwcygpLFxuICAgICAgICByZW1vdGVMb29rdXBzID0gbG9va3Vwcy5yZW1vdGVMb29rdXBzLFxuICAgICAgICBsb2NhbExvb2t1cHMgPSBsb29rdXBzLmxvY2FsTG9va3VwcztcbiAgICAgIHRoaXMuX3BlcmZvcm1Mb2NhbExvb2t1cHMobG9jYWxMb29rdXBzKTtcbiAgICAgIHRoaXMuX3BlcmZvcm1SZW1vdGVMb29rdXBzKHJlbW90ZUxvb2t1cHMpO1xuICAgIH1cbiAgfSxcbiAgX2xvb2t1cFNpbmdsZXRvbjogZnVuY3Rpb24oKSB7XG4gICAgLy8gUGljayBhIHJhbmRvbSBsb2NhbElkIGZyb20gdGhlIGFycmF5IG9mIGRhdGEgYmVpbmcgbWFwcGVkIG9udG8gdGhlIHNpbmdsZXRvbiBvYmplY3QuIE5vdGUgdGhhdCB0aGV5IHNob3VsZFxuICAgIC8vIGFsd2F5cyBiZSB0aGUgc2FtZS4gVGhpcyBpcyBqdXN0IGEgcHJlY2F1dGlvbi5cbiAgICB2YXIgbG9jYWxJZGVudGlmaWVycyA9IHV0aWwucGx1Y2sodGhpcy5kYXRhLCAnbG9jYWxJZCcpLCBsb2NhbElkO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsb2NhbElkZW50aWZpZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAobG9jYWxJZGVudGlmaWVyc1tpXSkge1xuICAgICAgICBsb2NhbElkID0ge2xvY2FsSWQ6IGxvY2FsSWRlbnRpZmllcnNbaV19O1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gVGhlIG1hcHBpbmcgb3BlcmF0aW9uIGlzIHJlc3BvbnNpYmxlIGZvciBjcmVhdGluZyBzaW5nbGV0b24gaW5zdGFuY2VzIGlmIHRoZXkgZG8gbm90IGFscmVhZHkgZXhpc3QuXG4gICAgdmFyIHNpbmdsZXRvbiA9IGNhY2hlLmdldFNpbmdsZXRvbih0aGlzLm1vZGVsKSB8fCB0aGlzLl9pbnN0YW5jZShsb2NhbElkKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgdGhpcy5vYmplY3RzW2ldID0gc2luZ2xldG9uO1xuICAgIH1cbiAgfSxcbiAgX2luc3RhbmNlOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgbW9kZWwgPSB0aGlzLm1vZGVsLFxuICAgICAgbW9kZWxJbnN0YW5jZSA9IG1vZGVsLl9pbnN0YW5jZS5hcHBseShtb2RlbCwgYXJndW1lbnRzKTtcbiAgICB0aGlzLl9uZXdPYmplY3RzLnB1c2gobW9kZWxJbnN0YW5jZSk7XG4gICAgcmV0dXJuIG1vZGVsSW5zdGFuY2U7XG4gIH0sXG5cbiAgcHJlcHJvY2Vzc0RhdGE6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBkYXRhID0gdXRpbC5leHRlbmQoW10sIHRoaXMuZGF0YSk7XG4gICAgcmV0dXJuIGRhdGEubWFwKGZ1bmN0aW9uKGRhdHVtKSB7XG4gICAgICBpZiAoZGF0dW0pIHtcbiAgICAgICAgaWYgKCF1dGlsLmlzU3RyaW5nKGRhdHVtKSkge1xuICAgICAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMoZGF0dW0pO1xuICAgICAgICAgIGtleXMuZm9yRWFjaChmdW5jdGlvbihrKSB7XG4gICAgICAgICAgICB2YXIgaXNSZWxhdGlvbnNoaXAgPSB0aGlzLm1vZGVsLl9yZWxhdGlvbnNoaXBOYW1lcy5pbmRleE9mKGspID4gLTE7XG5cbiAgICAgICAgICAgIGlmIChpc1JlbGF0aW9uc2hpcCkge1xuICAgICAgICAgICAgICB2YXIgdmFsID0gZGF0dW1ba107XG4gICAgICAgICAgICAgIGlmICh2YWwgaW5zdGFuY2VvZiBNb2RlbEluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgZGF0dW1ba10gPSB7bG9jYWxJZDogdmFsLmxvY2FsSWR9O1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gZGF0dW07XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgc3RhcnQ6IGZ1bmN0aW9uKGRvbmUpIHtcbiAgICB2YXIgZGF0YSA9IHRoaXMuZGF0YTtcbiAgICBpZiAoZGF0YS5sZW5ndGgpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgIHZhciB0YXNrcyA9IFtdO1xuICAgICAgdGhpcy5fbG9va3VwKCk7XG4gICAgICB0YXNrcy5wdXNoKHRoaXMuX2V4ZWN1dGVTdWJPcGVyYXRpb25zLmJpbmQodGhpcykpO1xuICAgICAgdXRpbC5wYXJhbGxlbCh0YXNrcywgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgIGlmIChlcnIpIGNvbnNvbGUuZXJyb3IoZXJyKTtcbiAgICAgICAgc2VsZi5fbWFwKCk7XG4gICAgICAgIC8vIFVzZXJzIGFyZSBhbGxvd2VkIHRvIGFkZCBhIGN1c3RvbSBpbml0IG1ldGhvZCB0byB0aGUgbWV0aG9kcyBvYmplY3Qgd2hlbiBkZWZpbmluZyBhIE1vZGVsLCBvZiB0aGUgZm9ybTpcbiAgICAgICAgLy9cbiAgICAgICAgLy9cbiAgICAgICAgLy8gaW5pdDogZnVuY3Rpb24gKFtkb25lXSkge1xuICAgICAgICAvLyAgICAgLy8gLi4uXG4gICAgICAgIC8vICB9XG4gICAgICAgIC8vXG4gICAgICAgIC8vXG4gICAgICAgIC8vIElmIGRvbmUgaXMgcGFzc2VkLCB0aGVuIF9faW5pdCBtdXN0IGJlIGV4ZWN1dGVkIGFzeW5jaHJvbm91c2x5LCBhbmQgdGhlIG1hcHBpbmcgb3BlcmF0aW9uIHdpbGwgbm90XG4gICAgICAgIC8vIGZpbmlzaCB1bnRpbCBhbGwgaW5pdHMgaGF2ZSBleGVjdXRlZC5cbiAgICAgICAgLy9cbiAgICAgICAgLy8gSGVyZSB3ZSBlbnN1cmUgdGhlIGV4ZWN1dGlvbiBvZiBhbGwgb2YgdGhlbVxuICAgICAgICB2YXIgZnJvbVN0b3JhZ2UgPSB0aGlzLmZyb21TdG9yYWdlO1xuICAgICAgICB2YXIgaW5pdFRhc2tzID0gc2VsZi5fbmV3T2JqZWN0cy5yZWR1Y2UoZnVuY3Rpb24obWVtbywgbykge1xuICAgICAgICAgIHZhciBpbml0ID0gby5tb2RlbC5pbml0O1xuICAgICAgICAgIGlmIChpbml0KSB7XG4gICAgICAgICAgICB2YXIgcGFyYW1OYW1lcyA9IHV0aWwucGFyYW1OYW1lcyhpbml0KTtcbiAgICAgICAgICAgIGlmIChwYXJhbU5hbWVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgbWVtby5wdXNoKGluaXQuYmluZChvLCBmcm9tU3RvcmFnZSwgZG9uZSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIGluaXQuY2FsbChvLCBmcm9tU3RvcmFnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIG8uX2VtaXRFdmVudHMgPSB0cnVlO1xuICAgICAgICAgIG8uX2VtaXROZXcoKTtcbiAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgfSwgW10pO1xuICAgICAgICB1dGlsLnBhcmFsbGVsKGluaXRUYXNrcywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgZG9uZShzZWxmLmVycm9ycy5sZW5ndGggPyBzZWxmLmVycm9ycyA6IG51bGwsIHNlbGYub2JqZWN0cyk7XG4gICAgICAgIH0pO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZG9uZShudWxsLCBbXSk7XG4gICAgfVxuICB9LFxuICBnZXRSZWxhdGVkRGF0YTogZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBpbmRleGVzID0gW107XG4gICAgdmFyIHJlbGF0ZWREYXRhID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBkYXR1bSA9IHRoaXMuZGF0YVtpXTtcbiAgICAgIGlmIChkYXR1bSkge1xuICAgICAgICB2YXIgdmFsID0gZGF0dW1bbmFtZV07XG4gICAgICAgIGlmICh2YWwpIHtcbiAgICAgICAgICBpbmRleGVzLnB1c2goaSk7XG4gICAgICAgICAgcmVsYXRlZERhdGEucHVzaCh2YWwpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICBpbmRleGVzOiBpbmRleGVzLFxuICAgICAgcmVsYXRlZERhdGE6IHJlbGF0ZWREYXRhXG4gICAgfTtcbiAgfVxuICAsXG4gIHByb2Nlc3NFcnJvcnNGcm9tVGFzazogZnVuY3Rpb24ocmVsYXRpb25zaGlwTmFtZSwgZXJyb3JzLCBpbmRleGVzKSB7XG4gICAgaWYgKGVycm9ycy5sZW5ndGgpIHtcbiAgICAgIHZhciByZWxhdGVkRGF0YSA9IHRoaXMuZ2V0UmVsYXRlZERhdGEocmVsYXRpb25zaGlwTmFtZSkucmVsYXRlZERhdGE7XG4gICAgICB2YXIgdW5mbGF0dGVuZWRFcnJvcnMgPSB1dGlsLnVuZmxhdHRlbkFycmF5KGVycm9ycywgcmVsYXRlZERhdGEpO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB1bmZsYXR0ZW5lZEVycm9ycy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgaWR4ID0gaW5kZXhlc1tpXTtcbiAgICAgICAgdmFyIGVyciA9IHVuZmxhdHRlbmVkRXJyb3JzW2ldO1xuICAgICAgICB2YXIgaXNFcnJvciA9IGVycjtcbiAgICAgICAgaWYgKHV0aWwuaXNBcnJheShlcnIpKSBpc0Vycm9yID0gZXJyLnJlZHVjZShmdW5jdGlvbihtZW1vLCB4KSB7XG4gICAgICAgICAgcmV0dXJuIG1lbW8gfHwgeFxuICAgICAgICB9LCBmYWxzZSk7XG4gICAgICAgIGlmIChpc0Vycm9yKSB7XG4gICAgICAgICAgaWYgKCF0aGlzLmVycm9yc1tpZHhdKSB0aGlzLmVycm9yc1tpZHhdID0ge307XG4gICAgICAgICAgdGhpcy5lcnJvcnNbaWR4XVtyZWxhdGlvbnNoaXBOYW1lXSA9IGVycjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgX2V4ZWN1dGVTdWJPcGVyYXRpb25zOiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgIHJlbGF0aW9uc2hpcE5hbWVzID0gT2JqZWN0LmtleXModGhpcy5tb2RlbC5yZWxhdGlvbnNoaXBzKTtcbiAgICBpZiAocmVsYXRpb25zaGlwTmFtZXMubGVuZ3RoKSB7XG4gICAgICB2YXIgdGFza3MgPSByZWxhdGlvbnNoaXBOYW1lcy5yZWR1Y2UoZnVuY3Rpb24obSwgcmVsYXRpb25zaGlwTmFtZSkge1xuICAgICAgICB2YXIgcmVsYXRpb25zaGlwID0gc2VsZi5tb2RlbC5yZWxhdGlvbnNoaXBzW3JlbGF0aW9uc2hpcE5hbWVdO1xuICAgICAgICB2YXIgcmV2ZXJzZU1vZGVsID0gcmVsYXRpb25zaGlwLmZvcndhcmROYW1lID09IHJlbGF0aW9uc2hpcE5hbWUgPyByZWxhdGlvbnNoaXAucmV2ZXJzZU1vZGVsIDogcmVsYXRpb25zaGlwLmZvcndhcmRNb2RlbDtcbiAgICAgICAgLy8gTW9jayBhbnkgbWlzc2luZyBzaW5nbGV0b24gZGF0YSB0byBlbnN1cmUgdGhhdCBhbGwgc2luZ2xldG9uIGluc3RhbmNlcyBhcmUgY3JlYXRlZC5cbiAgICAgICAgaWYgKHJldmVyc2VNb2RlbC5zaW5nbGV0b24gJiYgIXJlbGF0aW9uc2hpcC5pc1JldmVyc2UpIHtcbiAgICAgICAgICB0aGlzLmRhdGEuZm9yRWFjaChmdW5jdGlvbihkYXR1bSkge1xuICAgICAgICAgICAgaWYgKCFkYXR1bVtyZWxhdGlvbnNoaXBOYW1lXSkgZGF0dW1bcmVsYXRpb25zaGlwTmFtZV0gPSB7fTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgX19yZXQgPSB0aGlzLmdldFJlbGF0ZWREYXRhKHJlbGF0aW9uc2hpcE5hbWUpLFxuICAgICAgICAgIGluZGV4ZXMgPSBfX3JldC5pbmRleGVzLFxuICAgICAgICAgIHJlbGF0ZWREYXRhID0gX19yZXQucmVsYXRlZERhdGE7XG4gICAgICAgIGlmIChyZWxhdGVkRGF0YS5sZW5ndGgpIHtcbiAgICAgICAgICB2YXIgZmxhdFJlbGF0ZWREYXRhID0gdXRpbC5mbGF0dGVuQXJyYXkocmVsYXRlZERhdGEpO1xuICAgICAgICAgIHZhciBvcCA9IG5ldyBNYXBwaW5nT3BlcmF0aW9uKHtcbiAgICAgICAgICAgIG1vZGVsOiByZXZlcnNlTW9kZWwsXG4gICAgICAgICAgICBkYXRhOiBmbGF0UmVsYXRlZERhdGEsXG4gICAgICAgICAgICBkaXNhYmxlZXZlbnRzOiBzZWxmLmRpc2FibGVldmVudHMsXG4gICAgICAgICAgICBfaWdub3JlSW5zdGFsbGVkOiBzZWxmLl9pZ25vcmVJbnN0YWxsZWQsXG4gICAgICAgICAgICBmcm9tU3RvcmFnZTogdGhpcy5mcm9tU3RvcmFnZVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wKSB7XG4gICAgICAgICAgdmFyIHRhc2s7XG4gICAgICAgICAgdGFzayA9IGZ1bmN0aW9uKGRvbmUpIHtcbiAgICAgICAgICAgIG9wLnN0YXJ0KGZ1bmN0aW9uKGVycm9ycywgb2JqZWN0cykge1xuICAgICAgICAgICAgICBzZWxmLnN1YlRhc2tSZXN1bHRzW3JlbGF0aW9uc2hpcE5hbWVdID0ge1xuICAgICAgICAgICAgICAgIGVycm9yczogZXJyb3JzLFxuICAgICAgICAgICAgICAgIG9iamVjdHM6IG9iamVjdHMsXG4gICAgICAgICAgICAgICAgaW5kZXhlczogaW5kZXhlc1xuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICBzZWxmLnByb2Nlc3NFcnJvcnNGcm9tVGFzayhyZWxhdGlvbnNoaXBOYW1lLCBvcC5lcnJvcnMsIGluZGV4ZXMpO1xuICAgICAgICAgICAgICBkb25lKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9O1xuICAgICAgICAgIG0ucHVzaCh0YXNrKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbTtcbiAgICAgIH0uYmluZCh0aGlzKSwgW10pO1xuICAgICAgdXRpbC5wYXJhbGxlbCh0YXNrcywgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2FsbGJhY2soKTtcbiAgICB9XG4gIH1cbn0pXG47XG5cbm1vZHVsZS5leHBvcnRzID0gTWFwcGluZ09wZXJhdGlvbjtcblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9tYXBwaW5nT3BlcmF0aW9uLmpzXG4gKiogbW9kdWxlIGlkID0gMTlcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsImlmICh0eXBlb2Ygc2llc3RhID09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBtb2R1bGUgPT0gJ3VuZGVmaW5lZCcpIHtcbiAgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZmluZCB3aW5kb3cuc2llc3RhLiBNYWtlIHN1cmUgeW91IGluY2x1ZGUgc2llc3RhLmNvcmUuanMgZmlyc3QuJyk7XG59XG5cbnZhciBfaSA9IHNpZXN0YS5faW50ZXJuYWwsXG4gIGNhY2hlID0gX2kuY2FjaGUsXG4gIENvbGxlY3Rpb25SZWdpc3RyeSA9IF9pLkNvbGxlY3Rpb25SZWdpc3RyeSxcbiAgbG9nID0gX2kubG9nKCdzdG9yYWdlJyksXG4gIGVycm9yID0gX2kuZXJyb3IsXG4gIHV0aWwgPSBfaS51dGlsLFxuICBldmVudHMgPSBfaS5ldmVudHM7XG5cbnZhciB1bnNhdmVkT2JqZWN0cyA9IFtdLFxuICB1bnNhdmVkT2JqZWN0c0hhc2ggPSB7fSxcbiAgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24gPSB7fTtcblxudmFyIHN0b3JhZ2UgPSB7fTtcblxuLy8gVmFyaWFibGVzIGJlZ2lubmluZyB3aXRoIHVuZGVyc2NvcmUgYXJlIHRyZWF0ZWQgYXMgc3BlY2lhbCBieSBQb3VjaERCL0NvdWNoREIgc28gd2hlbiBzZXJpYWxpc2luZyB3ZSBuZWVkIHRvXG4vLyByZXBsYWNlIHdpdGggc29tZXRoaW5nIGVsc2UuXG52YXIgVU5ERVJTQ09SRSA9IC9fL2csXG4gIFVOREVSU0NPUkVfUkVQTEFDRU1FTlQgPSAvQC9nO1xuXG5mdW5jdGlvbiBfaW5pdE1ldGEoKSB7XG4gIHJldHVybiB7ZGF0ZUZpZWxkczogW119O1xufVxuXG5mdW5jdGlvbiBmdWxseVF1YWxpZmllZE1vZGVsTmFtZShjb2xsZWN0aW9uTmFtZSwgbW9kZWxOYW1lKSB7XG4gIHJldHVybiBjb2xsZWN0aW9uTmFtZSArICcuJyArIG1vZGVsTmFtZTtcbn1cblxuZnVuY3Rpb24gX2dyYXBoRGF0YShkYXRhLCBNb2RlbCwgY2FsbGJhY2spIHtcbiAgTW9kZWwuZ3JhcGgoZGF0YSwge1xuICAgIF9pZ25vcmVJbnN0YWxsZWQ6IHRydWUsXG4gICAgZnJvbVN0b3JhZ2U6IHRydWVcbiAgfSwgZnVuY3Rpb24oZXJyLCBpbnN0YW5jZXMpIHtcbiAgICBpZiAoZXJyKSB7XG4gICAgICBsb2coJ0Vycm9yIGxvYWRpbmcgbW9kZWxzJywgZXJyKTtcbiAgICB9XG4gICAgY2FsbGJhY2soZXJyLCBpbnN0YW5jZXMpO1xuICB9KTtcbn1cbmlmICh0eXBlb2YgUG91Y2hEQiA9PSAndW5kZWZpbmVkJykge1xuICBzaWVzdGEuZXh0LnN0b3JhZ2VFbmFibGVkID0gZmFsc2U7XG4gIGNvbnNvbGUubG9nKCdQb3VjaERCIGlzIG5vdCBwcmVzZW50IHRoZXJlZm9yZSBzdG9yYWdlIGlzIGRpc2FibGVkLicpO1xufVxuZWxzZSB7XG4gIHZhciBEQl9OQU1FID0gJ3NpZXN0YScsXG4gICAgcG91Y2ggPSBuZXcgUG91Y2hEQihEQl9OQU1FLCB7YXV0b19jb21wYWN0aW9uOiB0cnVlfSk7XG5cbiAgLyoqXG4gICAqIFNvbWV0aW1lcyBzaWVzdGEgbmVlZHMgdG8gc3RvcmUgc29tZSBleHRyYSBpbmZvcm1hdGlvbiBhYm91dCB0aGUgbW9kZWwgaW5zdGFuY2UuXG4gICAqIEBwYXJhbSBzZXJpYWxpc2VkXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBmdW5jdGlvbiBfYWRkTWV0YShzZXJpYWxpc2VkKSB7XG4gICAgLy8gUG91Y2hEQiA8PSAzLjIuMSBoYXMgYSBidWcgd2hlcmVieSBkYXRlIGZpZWxkcyBhcmUgbm90IGRlc2VyaWFsaXNlZCBwcm9wZXJseSBpZiB5b3UgdXNlIGRiLnF1ZXJ5XG4gICAgLy8gdGhlcmVmb3JlIHdlIG5lZWQgdG8gYWRkIGV4dHJhIGluZm8gdG8gdGhlIG9iamVjdCBmb3IgZGVzZXJpYWxpc2luZyBkYXRlcyBtYW51YWxseS5cbiAgICBzZXJpYWxpc2VkLnNpZXN0YV9tZXRhID0gX2luaXRNZXRhKCk7XG4gICAgZm9yICh2YXIgcHJvcCBpbiBzZXJpYWxpc2VkKSB7XG4gICAgICBpZiAoc2VyaWFsaXNlZC5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICBpZiAoc2VyaWFsaXNlZFtwcm9wXSBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgICAgICBzZXJpYWxpc2VkLnNpZXN0YV9tZXRhLmRhdGVGaWVsZHMucHVzaChwcm9wKTtcbiAgICAgICAgICBzZXJpYWxpc2VkW3Byb3BdID0gc2VyaWFsaXNlZFtwcm9wXS5nZXRUaW1lKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBfcHJvY2Vzc01ldGEoZGF0dW0pIHtcbiAgICB2YXIgbWV0YSA9IGRhdHVtLnNpZXN0YV9tZXRhIHx8IF9pbml0TWV0YSgpO1xuICAgIG1ldGEuZGF0ZUZpZWxkcy5mb3JFYWNoKGZ1bmN0aW9uKGRhdGVGaWVsZCkge1xuICAgICAgdmFyIHZhbHVlID0gZGF0dW1bZGF0ZUZpZWxkXTtcbiAgICAgIGlmICghKHZhbHVlIGluc3RhbmNlb2YgRGF0ZSkpIHtcbiAgICAgICAgZGF0dW1bZGF0ZUZpZWxkXSA9IG5ldyBEYXRlKHZhbHVlKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBkZWxldGUgZGF0dW0uc2llc3RhX21ldGE7XG4gIH1cblxuICBmdW5jdGlvbiBjb25zdHJ1Y3RJbmRleERlc2lnbkRvYyhjb2xsZWN0aW9uTmFtZSwgbW9kZWxOYW1lKSB7XG4gICAgdmFyIGZ1bGx5UXVhbGlmaWVkTmFtZSA9IGZ1bGx5UXVhbGlmaWVkTW9kZWxOYW1lKGNvbGxlY3Rpb25OYW1lLCBtb2RlbE5hbWUpO1xuICAgIHZhciB2aWV3cyA9IHt9O1xuICAgIHZpZXdzW2Z1bGx5UXVhbGlmaWVkTmFtZV0gPSB7XG4gICAgICBtYXA6IGZ1bmN0aW9uKGRvYykge1xuICAgICAgICBpZiAoZG9jLmNvbGxlY3Rpb24gPT0gJyQxJyAmJiBkb2MubW9kZWwgPT0gJyQyJykgZW1pdChkb2MuY29sbGVjdGlvbiArICcuJyArIGRvYy5tb2RlbCwgZG9jKTtcbiAgICAgIH0udG9TdHJpbmcoKS5yZXBsYWNlKCckMScsIGNvbGxlY3Rpb25OYW1lKS5yZXBsYWNlKCckMicsIG1vZGVsTmFtZSlcbiAgICB9O1xuICAgIHJldHVybiB7XG4gICAgICBfaWQ6ICdfZGVzaWduLycgKyBmdWxseVF1YWxpZmllZE5hbWUsXG4gICAgICB2aWV3czogdmlld3NcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gY29uc3RydWN0QWxsSW5kZXgoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIF9pZDogJ19kZXNpZ24vYWxsJyxcbiAgICAgIHZpZXdzOiB7XG4gICAgICAgIGFsbDoge1xuICAgICAgICAgIG1hcDogZnVuY3Rpb24oZG9jKSB7XG4gICAgICAgICAgICBpZiAoZG9jLm1vZGVsKSB7XG4gICAgICAgICAgICAgIGVtaXQoZG9jLmNvbGxlY3Rpb24gKyAnLicgKyBkb2MubW9kZWwsIGRvYyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfS50b1N0cmluZygpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEVuc3VyZSB0aGF0IHRoZSBQb3VjaERCIGluZGV4IGZvciB0aGUgZ2l2ZW4gbW9kZWwgZXhpc3RzLCBjcmVhdGluZyBpdCBpZiBub3QuXG4gICAqIEBwYXJhbSBtb2RlbFxuICAgKiBAcGFyYW0gY2JcbiAgICovXG4gIGZ1bmN0aW9uIGVuc3VyZUluZGV4SW5zdGFsbGVkKG1vZGVsLCBjYikge1xuICAgIGZ1bmN0aW9uIGZuKHJlc3ApIHtcbiAgICAgIHZhciBlcnI7XG4gICAgICBpZiAoIXJlc3Aub2spIHtcbiAgICAgICAgaWYgKHJlc3Auc3RhdHVzID09IDQwOSkge1xuICAgICAgICAgIGVyciA9IG51bGw7XG4gICAgICAgICAgbW9kZWwuaW5kZXhJbnN0YWxsZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjYihlcnIpO1xuICAgIH1cblxuICAgIHBvdWNoXG4gICAgICAucHV0KGNvbnN0cnVjdEluZGV4RGVzaWduRG9jKG1vZGVsLmNvbGxlY3Rpb25OYW1lLCBtb2RlbC5uYW1lKSlcbiAgICAgIC50aGVuKGZuKVxuICAgICAgLmNhdGNoKGZuKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldEFsbE1vZGVscygpIHtcbiAgICB2YXIgYWxsTW9kZWxzID0gW107XG4gICAgdmFyIHJlZ2lzdHJ5ID0gc2llc3RhLl9pbnRlcm5hbC5Db2xsZWN0aW9uUmVnaXN0cnk7XG4gICAgcmVnaXN0cnkuY29sbGVjdGlvbk5hbWVzLmZvckVhY2goZnVuY3Rpb24oY29sbGVjdGlvbk5hbWUpIHtcbiAgICAgIHZhciBjb2xsID0gcmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdO1xuICAgICAgdmFyIG1vZGVscyA9IGNvbGwuX21vZGVscztcbiAgICAgIGZvciAodmFyIG1vZGVsTmFtZSBpbiBtb2RlbHMpIHtcbiAgICAgICAgaWYgKG1vZGVscy5oYXNPd25Qcm9wZXJ0eShtb2RlbE5hbWUpKSB7XG4gICAgICAgICAgdmFyIG1vZGVsID0gY29sbFttb2RlbE5hbWVdO1xuICAgICAgICAgIGFsbE1vZGVscy5wdXNoKG1vZGVsKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBhbGxNb2RlbHM7XG4gIH1cblxuICBmdW5jdGlvbiBjb25zdHJ1Y3RJbmRleGVzRm9yQWxsTW9kZWxzKG1vZGVscykge1xuICAgIHJldHVybiBtb2RlbHMubWFwKGZ1bmN0aW9uKG1vZGVsKSB7XG4gICAgICByZXR1cm4gY29uc3RydWN0SW5kZXhEZXNpZ25Eb2MobW9kZWwuY29sbGVjdGlvbk5hbWUsIG1vZGVsLm5hbWUpO1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gX19lbnN1cmVJbmRleGVzKGluZGV4ZXMsIGNiKSB7XG4gICAgZnVuY3Rpb24gZm4ocmVzcCkge1xuICAgICAgdmFyIGVycm9ycyA9IFtdO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXNwLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciByZXNwb25zZSA9IHJlc3BbaV07XG4gICAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgICAvLyBDb25mbGljdCBtZWFucyBhbHJlYWR5IGV4aXN0cywgYW5kIHRoaXMgaXMgZmluZSFcbiAgICAgICAgICB2YXIgaXNDb25mbGljdCA9IHJlc3BvbnNlLnN0YXR1cyA9PSA0MDk7XG4gICAgICAgICAgaWYgKCFpc0NvbmZsaWN0KSBlcnJvcnMucHVzaChyZXNwb25zZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGNiKGVycm9ycy5sZW5ndGggPyBlcnJvcignbXVsdGlwbGUgZXJyb3JzJywge2Vycm9yczogZXJyb3JzfSkgOiBudWxsKTtcbiAgICB9XG5cbiAgICBwb3VjaFxuICAgICAgLmJ1bGtEb2NzKGluZGV4ZXMpXG4gICAgICAudGhlbihmbilcbiAgICAgIC5jYXRjaChmbik7XG4gIH1cblxuICBmdW5jdGlvbiBlbnN1cmVJbmRleGVzRm9yQWxsKGNiKSB7XG4gICAgdmFyIG1vZGVscyA9IGdldEFsbE1vZGVscygpO1xuICAgIHZhciBpbmRleGVzID0gW2NvbnN0cnVjdEFsbEluZGV4KCldO1xuICAgIF9fZW5zdXJlSW5kZXhlcyhpbmRleGVzLCBjYik7XG4gIH1cblxuICAvKipcbiAgICogU2VyaWFsaXNlIGEgbW9kZWwgaW50byBhIGZvcm1hdCB0aGF0IFBvdWNoREIgYnVsa0RvY3MgQVBJIGNhbiBwcm9jZXNzXG4gICAqIEBwYXJhbSB7TW9kZWxJbnN0YW5jZX0gbW9kZWxJbnN0YW5jZVxuICAgKi9cbiAgZnVuY3Rpb24gX3NlcmlhbGlzZShtb2RlbEluc3RhbmNlKSB7XG4gICAgdmFyIHNlcmlhbGlzZWQgPSB7fTtcbiAgICB2YXIgX192YWx1ZXMgPSBtb2RlbEluc3RhbmNlLl9fdmFsdWVzO1xuICAgIHNlcmlhbGlzZWQgPSB1dGlsLmV4dGVuZChzZXJpYWxpc2VkLCBfX3ZhbHVlcyk7XG4gICAgT2JqZWN0LmtleXMoc2VyaWFsaXNlZCkuZm9yRWFjaChmdW5jdGlvbihrKSB7XG4gICAgICBzZXJpYWxpc2VkW2sucmVwbGFjZShVTkRFUlNDT1JFLCAnQCcpXSA9IF9fdmFsdWVzW2tdO1xuICAgIH0pO1xuICAgIF9hZGRNZXRhKHNlcmlhbGlzZWQpO1xuICAgIHNlcmlhbGlzZWRbJ2NvbGxlY3Rpb24nXSA9IG1vZGVsSW5zdGFuY2UuY29sbGVjdGlvbk5hbWU7XG4gICAgc2VyaWFsaXNlZFsnbW9kZWwnXSA9IG1vZGVsSW5zdGFuY2UubW9kZWxOYW1lO1xuICAgIHNlcmlhbGlzZWRbJ19pZCddID0gbW9kZWxJbnN0YW5jZS5sb2NhbElkO1xuICAgIGlmIChtb2RlbEluc3RhbmNlLnJlbW92ZWQpIHNlcmlhbGlzZWRbJ19kZWxldGVkJ10gPSB0cnVlO1xuICAgIHZhciByZXYgPSBtb2RlbEluc3RhbmNlLl9yZXY7XG4gICAgaWYgKHJldikgc2VyaWFsaXNlZFsnX3JldiddID0gcmV2O1xuICAgIHNlcmlhbGlzZWQgPSBtb2RlbEluc3RhbmNlLl9yZWxhdGlvbnNoaXBOYW1lcy5yZWR1Y2UoZnVuY3Rpb24obWVtbywgbikge1xuICAgICAgdmFyIHZhbCA9IG1vZGVsSW5zdGFuY2Vbbl07XG4gICAgICBpZiAoc2llc3RhLmlzQXJyYXkodmFsKSkge1xuICAgICAgICBtZW1vW25dID0gdXRpbC5wbHVjayh2YWwsICdsb2NhbElkJyk7XG4gICAgICB9XG4gICAgICBlbHNlIGlmICh2YWwpIHtcbiAgICAgICAgbWVtb1tuXSA9IHZhbC5sb2NhbElkO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG1lbW87XG4gICAgfSwgc2VyaWFsaXNlZCk7XG4gICAgcmV0dXJuIHNlcmlhbGlzZWQ7XG4gIH1cblxuICBmdW5jdGlvbiBfcHJlcGFyZURhdHVtKHJhd0RhdHVtLCBtb2RlbCkge1xuICAgIF9wcm9jZXNzTWV0YShyYXdEYXR1bSk7XG4gICAgZGVsZXRlIHJhd0RhdHVtLmNvbGxlY3Rpb247XG4gICAgZGVsZXRlIHJhd0RhdHVtLm1vZGVsO1xuICAgIHJhd0RhdHVtLmxvY2FsSWQgPSByYXdEYXR1bS5faWQ7XG4gICAgZGVsZXRlIHJhd0RhdHVtLl9pZDtcbiAgICB2YXIgZGF0dW0gPSB7fTtcbiAgICBPYmplY3Qua2V5cyhyYXdEYXR1bSkuZm9yRWFjaChmdW5jdGlvbihrKSB7XG4gICAgICBkYXR1bVtrLnJlcGxhY2UoVU5ERVJTQ09SRV9SRVBMQUNFTUVOVCwgJ18nKV0gPSByYXdEYXR1bVtrXTtcbiAgICB9KTtcblxuICAgIHZhciByZWxhdGlvbnNoaXBOYW1lcyA9IG1vZGVsLl9yZWxhdGlvbnNoaXBOYW1lcztcbiAgICByZWxhdGlvbnNoaXBOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uKHIpIHtcbiAgICAgIHZhciBsb2NhbElkID0gZGF0dW1bcl07XG4gICAgICBpZiAobG9jYWxJZCkge1xuICAgICAgICBpZiAoc2llc3RhLmlzQXJyYXkobG9jYWxJZCkpIHtcbiAgICAgICAgICBkYXR1bVtyXSA9IGxvY2FsSWQubWFwKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgIHJldHVybiB7bG9jYWxJZDogeH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBkYXR1bVtyXSA9IHtsb2NhbElkOiBsb2NhbElkfTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgfSk7XG4gICAgcmV0dXJuIGRhdHVtO1xuICB9XG5cblxuICB2YXIgYWxsO1xuXG4gIGZ1bmN0aW9uIF9sb2FkUG91Y2goY2IpIHtcbiAgICBpZiAoIWFsbCkge1xuICAgICAgcG91Y2hcbiAgICAgICAgLnF1ZXJ5KCdhbGwnKVxuICAgICAgICAudGhlbihmdW5jdGlvbihyZXNwKSB7XG4gICAgICAgICAgYWxsID0ge307XG4gICAgICAgICAgdmFyIHJvd3MgPSByZXNwLnJvd3M7XG4gICAgICAgICAgcm93cy5mb3JFYWNoKGZ1bmN0aW9uKHJvdykge1xuICAgICAgICAgICAgdmFyIGtleSA9IHJvdy5rZXk7XG4gICAgICAgICAgICBpZiAoIWFsbFtrZXldKSBhbGxba2V5XSA9IFtdO1xuICAgICAgICAgICAgYWxsW2tleV0ucHVzaChyb3cudmFsdWUpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGNiKG51bGwsIGFsbCk7XG4gICAgICAgIH0pLmNhdGNoKGNiKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBjYihudWxsLCBhbGwpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIF9nZXREYXRhRnJvbVBvdWNoKGNvbGxlY3Rpb25OYW1lLCBtb2RlbE5hbWUsIGNiKSB7XG4gICAgX2xvYWRQb3VjaChmdW5jdGlvbihlcnIsIGFsbCkge1xuICAgICAgaWYgKGVycikge1xuICAgICAgICBjYihlcnIpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHZhciBmdWxseVF1YWxpZmllZE5hbWUgPSBmdWxseVF1YWxpZmllZE1vZGVsTmFtZShjb2xsZWN0aW9uTmFtZSwgbW9kZWxOYW1lKSxcbiAgICAgICAgICBNb2RlbCA9IENvbGxlY3Rpb25SZWdpc3RyeVtjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXSxcbiAgICAgICAgICByb3dzID0gYWxsW2Z1bGx5UXVhbGlmaWVkTmFtZV0gfHwgW10sXG4gICAgICAgICAgZGF0YSA9IHJvd3MubWFwKGZ1bmN0aW9uKHJvdykge1xuICAgICAgICAgICAgcmV0dXJuIF9wcmVwYXJlRGF0dW0ocm93LCBNb2RlbCk7XG4gICAgICAgICAgfSksXG4gICAgICAgICAgbG9hZGVkID0ge307XG5cbiAgICAgICAgZGF0YS5tYXAoZnVuY3Rpb24oZGF0dW0pIHtcbiAgICAgICAgICB2YXIgcmVtb3RlSWQgPSBkYXR1bVtNb2RlbC5pZF07XG4gICAgICAgICAgaWYgKHJlbW90ZUlkKSB7XG4gICAgICAgICAgICBpZiAobG9hZGVkW3JlbW90ZUlkXSkge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdEdXBsaWNhdGVzIGRldGVjdGVkIGluIHN0b3JhZ2UuIFlvdSBoYXZlIGVuY291bnRlcmVkIGEgc2VyaW91cyBidWcuIFBsZWFzZSByZXBvcnQgdGhpcy4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICBsb2FkZWRbcmVtb3RlSWRdID0gZGF0dW07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgY2IobnVsbCwgZGF0YSk7XG4gICAgICB9XG5cblxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqXG4gICAqIEBwYXJhbSBvcHRzXG4gICAqIEBwYXJhbSBbb3B0cy5jb2xsZWN0aW9uTmFtZV1cbiAgICogQHBhcmFtIFtvcHRzLm1vZGVsTmFtZV1cbiAgICogQHBhcmFtIFtvcHRzLm1vZGVsXVxuICAgKiBAcGFyYW0gY2FsbGJhY2tcbiAgICogQHByaXZhdGVcbiAgICovXG4gIGZ1bmN0aW9uIGxvYWRNb2RlbChvcHRzLCBjYWxsYmFjaykge1xuICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG9wdHMuY29sbGVjdGlvbk5hbWUsXG4gICAgICBtb2RlbE5hbWUgPSBvcHRzLm1vZGVsTmFtZSxcbiAgICAgIG1vZGVsID0gb3B0cy5tb2RlbDtcbiAgICBpZiAobW9kZWwpIHtcbiAgICAgIGNvbGxlY3Rpb25OYW1lID0gbW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgICBtb2RlbE5hbWUgPSBtb2RlbC5uYW1lO1xuICAgIH1cbiAgICB2YXIgZnVsbHlRdWFsaWZpZWROYW1lID0gZnVsbHlRdWFsaWZpZWRNb2RlbE5hbWUoY29sbGVjdGlvbk5hbWUsIG1vZGVsTmFtZSk7XG4gICAgdmFyIE1vZGVsID0gQ29sbGVjdGlvblJlZ2lzdHJ5W2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdO1xuICAgIHN0b3JhZ2UuX2dldERhdGFGcm9tUG91Y2goY29sbGVjdGlvbk5hbWUsIG1vZGVsTmFtZSwgZnVuY3Rpb24oZXJyLCBkYXRhKSB7XG4gICAgICBpZiAoIWVycilcbiAgICAgICAgc3RvcmFnZS5fZ3JhcGhEYXRhKGRhdGEsIE1vZGVsLCBjYWxsYmFjayk7XG4gICAgICBlbHNlIGNhbGxiYWNrKGVycik7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogTG9hZCBhbGwgZGF0YSBmcm9tIFBvdWNoREIuXG4gICAqL1xuICBmdW5jdGlvbiBfbG9hZChjYikge1xuICAgIGlmIChzYXZpbmcpIHRocm93IG5ldyBFcnJvcignbm90IGxvYWRlZCB5ZXQgaG93IGNhbiBpIHNhdmUnKTtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgaWYgKHNpZXN0YS5leHQuc3RvcmFnZUVuYWJsZWQpIHtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lcyA9IENvbGxlY3Rpb25SZWdpc3RyeS5jb2xsZWN0aW9uTmFtZXM7XG4gICAgICAgIHZhciB0YXNrcyA9IFtdO1xuICAgICAgICBjb2xsZWN0aW9uTmFtZXMuZm9yRWFjaChmdW5jdGlvbihjb2xsZWN0aW9uTmFtZSkge1xuICAgICAgICAgIHZhciBjb2xsZWN0aW9uID0gQ29sbGVjdGlvblJlZ2lzdHJ5W2NvbGxlY3Rpb25OYW1lXSxcbiAgICAgICAgICAgIG1vZGVsTmFtZXMgPSBPYmplY3Qua2V5cyhjb2xsZWN0aW9uLl9tb2RlbHMpO1xuICAgICAgICAgIG1vZGVsTmFtZXMuZm9yRWFjaChmdW5jdGlvbihtb2RlbE5hbWUpIHtcbiAgICAgICAgICAgIHRhc2tzLnB1c2goZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgICAgICAgLy8gV2UgY2FsbCBmcm9tIHN0b3JhZ2UgdG8gYWxsb3cgZm9yIHJlcGxhY2VtZW50IG9mIF9sb2FkTW9kZWwgZm9yIHBlcmZvcm1hbmNlIGV4dGVuc2lvbi5cbiAgICAgICAgICAgICAgc3RvcmFnZS5sb2FkTW9kZWwoe1xuICAgICAgICAgICAgICAgIGNvbGxlY3Rpb25OYW1lOiBjb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICBtb2RlbE5hbWU6IG1vZGVsTmFtZVxuICAgICAgICAgICAgICB9LCBjYik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHV0aWwuc2VyaWVzKHRhc2tzLCBmdW5jdGlvbihlcnIsIHJlc3VsdHMpIHtcbiAgICAgICAgICB2YXIgbjtcbiAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgdmFyIGluc3RhbmNlcyA9IFtdO1xuICAgICAgICAgICAgcmVzdWx0cy5mb3JFYWNoKGZ1bmN0aW9uKHIpIHtcbiAgICAgICAgICAgICAgaW5zdGFuY2VzID0gaW5zdGFuY2VzLmNvbmNhdChyKVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBuID0gaW5zdGFuY2VzLmxlbmd0aDtcbiAgICAgICAgICAgIGlmIChsb2cpIHtcbiAgICAgICAgICAgICAgbG9nKCdMb2FkZWQgJyArIG4udG9TdHJpbmcoKSArICcgaW5zdGFuY2VzLiBDYWNoZSBzaXplIGlzICcgKyBjYWNoZS5jb3VudCgpLCB7XG4gICAgICAgICAgICAgICAgcmVtb3RlOiBjYWNoZS5fcmVtb3RlQ2FjaGUoKSxcbiAgICAgICAgICAgICAgICBsb2NhbENhY2hlOiBjYWNoZS5fbG9jYWxDYWNoZSgpXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2llc3RhLm9uKCdTaWVzdGEnLCBsaXN0ZW5lcik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY2IoZXJyLCBuKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY2IoKTtcbiAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpO1xuICB9XG5cbiAgZnVuY3Rpb24gc2F2ZUNvbmZsaWN0cyhvYmplY3RzLCBjYikge1xuICAgIHBvdWNoLmFsbERvY3Moe2tleXM6IHV0aWwucGx1Y2sob2JqZWN0cywgJ2xvY2FsSWQnKX0pXG4gICAgICAudGhlbihmdW5jdGlvbihyZXNwKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVzcC5yb3dzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgb2JqZWN0c1tpXS5fcmV2ID0gcmVzcC5yb3dzW2ldLnZhbHVlLnJldjtcbiAgICAgICAgfVxuICAgICAgICBzYXZlVG9Qb3VjaChvYmplY3RzLCBjYik7XG4gICAgICB9KVxuICAgICAgLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICBjYihlcnIpO1xuICAgICAgfSlcbiAgfVxuXG4gIGZ1bmN0aW9uIHNhdmVUb1BvdWNoKG9iamVjdHMsIGNiKSB7XG4gICAgdmFyIGNvbmZsaWN0cyA9IFtdO1xuICAgIHZhciBzZXJpYWxpc2VkRG9jcyA9IG9iamVjdHMubWFwKF9zZXJpYWxpc2UpO1xuICAgIHBvdWNoLmJ1bGtEb2NzKHNlcmlhbGlzZWREb2NzKS50aGVuKGZ1bmN0aW9uKHJlc3ApIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVzcC5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgcmVzcG9uc2UgPSByZXNwW2ldO1xuICAgICAgICB2YXIgb2JqID0gb2JqZWN0c1tpXTtcbiAgICAgICAgaWYgKHJlc3BvbnNlLm9rKSB7XG4gICAgICAgICAgb2JqLl9yZXYgPSByZXNwb25zZS5yZXY7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAocmVzcG9uc2Uuc3RhdHVzID09IDQwOSkge1xuICAgICAgICAgIGNvbmZsaWN0cy5wdXNoKG9iaik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgbG9nKCdFcnJvciBzYXZpbmcgb2JqZWN0IHdpdGggbG9jYWxJZD1cIicgKyBvYmoubG9jYWxJZCArICdcIicsIHJlc3BvbnNlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGNvbmZsaWN0cy5sZW5ndGgpIHtcbiAgICAgICAgc2F2ZUNvbmZsaWN0cyhjb25mbGljdHMsIGNiKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBjYigpO1xuICAgICAgfVxuICAgIH0sIGZ1bmN0aW9uKGVycikge1xuICAgICAgY2IoZXJyKTtcbiAgICB9KTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIFNhdmUgYWxsIG1vZGVsRXZlbnRzIGRvd24gdG8gUG91Y2hEQi5cbiAgICovXG4gIGZ1bmN0aW9uIHNhdmUoY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgc2llc3RhLl9hZnRlckluc3RhbGwoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBpbnN0YW5jZXMgPSB1bnNhdmVkT2JqZWN0cztcbiAgICAgICAgdW5zYXZlZE9iamVjdHMgPSBbXTtcbiAgICAgICAgdW5zYXZlZE9iamVjdHNIYXNoID0ge307XG4gICAgICAgIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uID0ge307XG4gICAgICAgIHNhdmVUb1BvdWNoKGluc3RhbmNlcywgY2IpO1xuICAgICAgfSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGxpc3RlbmVyKG4pIHtcbiAgICB2YXIgY2hhbmdlZE9iamVjdCA9IG4ub2JqLFxuICAgICAgaWRlbnQgPSBjaGFuZ2VkT2JqZWN0LmxvY2FsSWQ7XG4gICAgaWYgKCFjaGFuZ2VkT2JqZWN0KSB7XG4gICAgICB0aHJvdyBuZXcgX2kuZXJyb3IuSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gb2JqIGZpZWxkIGluIG5vdGlmaWNhdGlvbiByZWNlaXZlZCBieSBzdG9yYWdlIGV4dGVuc2lvbicpO1xuICAgIH1cbiAgICBpZiAoIShpZGVudCBpbiB1bnNhdmVkT2JqZWN0c0hhc2gpKSB7XG4gICAgICB1bnNhdmVkT2JqZWN0c0hhc2hbaWRlbnRdID0gY2hhbmdlZE9iamVjdDtcbiAgICAgIHVuc2F2ZWRPYmplY3RzLnB1c2goY2hhbmdlZE9iamVjdCk7XG4gICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBjaGFuZ2VkT2JqZWN0LmNvbGxlY3Rpb25OYW1lO1xuICAgICAgaWYgKCF1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uTmFtZV0pIHtcbiAgICAgICAgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdID0ge307XG4gICAgICB9XG4gICAgICB2YXIgbW9kZWxOYW1lID0gY2hhbmdlZE9iamVjdC5tb2RlbC5uYW1lO1xuICAgICAgaWYgKCF1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXSkge1xuICAgICAgICB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXSA9IHt9O1xuICAgICAgfVxuICAgICAgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV1baWRlbnRdID0gY2hhbmdlZE9iamVjdDtcbiAgICB9XG4gIH1cblxuICB1dGlsLmV4dGVuZChzdG9yYWdlLCB7XG4gICAgX2dldERhdGFGcm9tUG91Y2g6IF9nZXREYXRhRnJvbVBvdWNoLFxuICAgIF9ncmFwaERhdGE6IF9ncmFwaERhdGEsXG4gICAgX2xvYWQ6IF9sb2FkLFxuICAgIGxvYWRNb2RlbDogbG9hZE1vZGVsLFxuICAgIHNhdmU6IHNhdmUsXG4gICAgX3NlcmlhbGlzZTogX3NlcmlhbGlzZSxcbiAgICBlbnN1cmVJbmRleGVzRm9yQWxsOiBlbnN1cmVJbmRleGVzRm9yQWxsLFxuICAgIGVuc3VyZUluZGV4SW5zdGFsbGVkOiBlbnN1cmVJbmRleEluc3RhbGxlZCxcbiAgICBfcmVzZXQ6IGZ1bmN0aW9uKGNiKSB7XG4gICAgICBzaWVzdGEucmVtb3ZlTGlzdGVuZXIoJ1NpZXN0YScsIGxpc3RlbmVyKTtcbiAgICAgIHVuc2F2ZWRPYmplY3RzID0gW107XG4gICAgICB1bnNhdmVkT2JqZWN0c0hhc2ggPSB7fTtcbiAgICAgIGFsbCA9IHVuZGVmaW5lZDtcbiAgICAgIHBvdWNoLmRlc3Ryb3koZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgcG91Y2ggPSBuZXcgUG91Y2hEQihEQl9OQU1FKTtcbiAgICAgICAgfVxuICAgICAgICBsb2coJ1Jlc2V0IGNvbXBsZXRlJyk7XG4gICAgICAgIGNiKGVycik7XG4gICAgICB9KVxuICAgIH1cblxuICB9KTtcblxuICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhzdG9yYWdlLCB7XG4gICAgX3Vuc2F2ZWRPYmplY3RzOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdW5zYXZlZE9iamVjdHNcbiAgICAgIH1cbiAgICB9LFxuICAgIF91bnNhdmVkT2JqZWN0c0hhc2g6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB1bnNhdmVkT2JqZWN0c0hhc2hcbiAgICAgIH1cbiAgICB9LFxuICAgIF91bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbjoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uXG4gICAgICB9XG4gICAgfSxcbiAgICBfcG91Y2g6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBwb3VjaFxuICAgICAgfVxuICAgIH1cbiAgfSk7XG5cbiAgaWYgKCFzaWVzdGEuZXh0KSBzaWVzdGEuZXh0ID0ge307XG4gIHNpZXN0YS5leHQuc3RvcmFnZSA9IHN0b3JhZ2U7XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoc2llc3RhLmV4dCwge1xuICAgIHN0b3JhZ2VFbmFibGVkOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoc2llc3RhLmV4dC5fc3RvcmFnZUVuYWJsZWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHJldHVybiBzaWVzdGEuZXh0Ll9zdG9yYWdlRW5hYmxlZDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gISFzaWVzdGEuZXh0LnN0b3JhZ2U7XG4gICAgICB9LFxuICAgICAgc2V0OiBmdW5jdGlvbih2KSB7XG4gICAgICAgIHNpZXN0YS5leHQuX3N0b3JhZ2VFbmFibGVkID0gdjtcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfVxuICB9KTtcblxuICB2YXIgaW50ZXJ2YWwsIHNhdmluZywgYXV0b3NhdmVJbnRlcnZhbCA9IDEwMDA7XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoc2llc3RhLCB7XG4gICAgYXV0b3NhdmU6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAhIWludGVydmFsO1xuICAgICAgfSxcbiAgICAgIHNldDogZnVuY3Rpb24oYXV0b3NhdmUpIHtcbiAgICAgICAgaWYgKGF1dG9zYXZlKSB7XG4gICAgICAgICAgaWYgKCFpbnRlcnZhbCkge1xuICAgICAgICAgICAgaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgLy8gQ2hlZWt5IHdheSBvZiBhdm9pZGluZyBtdWx0aXBsZSBzYXZlcyBoYXBwZW5pbmcuLi5cbiAgICAgICAgICAgICAgaWYgKCFzYXZpbmcpIHtcbiAgICAgICAgICAgICAgICBzYXZpbmcgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHNpZXN0YS5zYXZlKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgZXZlbnRzLmVtaXQoJ3NhdmVkJyk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBzYXZpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgc2llc3RhLmF1dG9zYXZlSW50ZXJ2YWwpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBpZiAoaW50ZXJ2YWwpIHtcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwoaW50ZXJ2YWwpO1xuICAgICAgICAgICAgaW50ZXJ2YWwgPSBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgYXV0b3NhdmVJbnRlcnZhbDoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGF1dG9zYXZlSW50ZXJ2YWw7XG4gICAgICB9LFxuICAgICAgc2V0OiBmdW5jdGlvbihfYXV0b3NhdmVJbnRlcnZhbCkge1xuICAgICAgICBhdXRvc2F2ZUludGVydmFsID0gX2F1dG9zYXZlSW50ZXJ2YWw7XG4gICAgICAgIGlmIChpbnRlcnZhbCkge1xuICAgICAgICAgIC8vIFJlc2V0IGludGVydmFsXG4gICAgICAgICAgc2llc3RhLmF1dG9zYXZlID0gZmFsc2U7XG4gICAgICAgICAgc2llc3RhLmF1dG9zYXZlID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgZGlydHk6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciB1bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvbiA9IHNpZXN0YS5leHQuc3RvcmFnZS5fdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb247XG4gICAgICAgIHJldHVybiAhIU9iamVjdC5rZXlzKHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uKS5sZW5ndGg7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH1cbiAgfSk7XG5cbiAgdXRpbC5leHRlbmQoc2llc3RhLCB7XG4gICAgc2F2ZTogc2F2ZSxcbiAgICBzZXRQb3VjaDogZnVuY3Rpb24oX3ApIHtcbiAgICAgIGlmIChzaWVzdGEuX2NhbkNoYW5nZSkgcG91Y2ggPSBfcDtcbiAgICAgIGVsc2UgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgY2hhbmdlIFBvdWNoREIgaW5zdGFuY2Ugd2hlbiBhbiBvYmplY3QgZ3JhcGggZXhpc3RzLicpO1xuICAgIH1cbiAgfSk7XG5cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBzdG9yYWdlO1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL3N0b3JhZ2UvaW5kZXguanNcbiAqKiBtb2R1bGUgaWQgPSAyMFxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG52YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xudmFyIHVuZGVmaW5lZDtcblxudmFyIGlzUGxhaW5PYmplY3QgPSBmdW5jdGlvbiBpc1BsYWluT2JqZWN0KG9iaikge1xuICAgIFwidXNlIHN0cmljdFwiO1xuICAgIGlmICghb2JqIHx8IHRvU3RyaW5nLmNhbGwob2JqKSAhPT0gJ1tvYmplY3QgT2JqZWN0XScgfHwgb2JqLm5vZGVUeXBlIHx8IG9iai5zZXRJbnRlcnZhbCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIGhhc19vd25fY29uc3RydWN0b3IgPSBoYXNPd24uY2FsbChvYmosICdjb25zdHJ1Y3RvcicpO1xuICAgIHZhciBoYXNfaXNfcHJvcGVydHlfb2ZfbWV0aG9kID0gb2JqLmNvbnN0cnVjdG9yICYmIG9iai5jb25zdHJ1Y3Rvci5wcm90b3R5cGUgJiYgaGFzT3duLmNhbGwob2JqLmNvbnN0cnVjdG9yLnByb3RvdHlwZSwgJ2lzUHJvdG90eXBlT2YnKTtcbiAgICAvLyBOb3Qgb3duIGNvbnN0cnVjdG9yIHByb3BlcnR5IG11c3QgYmUgT2JqZWN0XG4gICAgaWYgKG9iai5jb25zdHJ1Y3RvciAmJiAhaGFzX293bl9jb25zdHJ1Y3RvciAmJiAhaGFzX2lzX3Byb3BlcnR5X29mX21ldGhvZCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gT3duIHByb3BlcnRpZXMgYXJlIGVudW1lcmF0ZWQgZmlyc3RseSwgc28gdG8gc3BlZWQgdXAsXG4gICAgLy8gaWYgbGFzdCBvbmUgaXMgb3duLCB0aGVuIGFsbCBwcm9wZXJ0aWVzIGFyZSBvd24uXG4gICAgdmFyIGtleTtcbiAgICBmb3IgKGtleSBpbiBvYmopIHt9XG5cbiAgICByZXR1cm4ga2V5ID09PSB1bmRlZmluZWQgfHwgaGFzT3duLmNhbGwob2JqLCBrZXkpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBleHRlbmQoKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG4gICAgdmFyIG9wdGlvbnMsIG5hbWUsIHNyYywgY29weSwgY29weUlzQXJyYXksIGNsb25lLFxuICAgICAgICB0YXJnZXQgPSBhcmd1bWVudHNbMF0sXG4gICAgICAgIGkgPSAxLFxuICAgICAgICBsZW5ndGggPSBhcmd1bWVudHMubGVuZ3RoLFxuICAgICAgICBkZWVwID0gZmFsc2U7XG5cbiAgICAvLyBIYW5kbGUgYSBkZWVwIGNvcHkgc2l0dWF0aW9uXG4gICAgaWYgKHR5cGVvZiB0YXJnZXQgPT09IFwiYm9vbGVhblwiKSB7XG4gICAgICAgIGRlZXAgPSB0YXJnZXQ7XG4gICAgICAgIHRhcmdldCA9IGFyZ3VtZW50c1sxXSB8fCB7fTtcbiAgICAgICAgLy8gc2tpcCB0aGUgYm9vbGVhbiBhbmQgdGhlIHRhcmdldFxuICAgICAgICBpID0gMjtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiB0YXJnZXQgIT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHRhcmdldCAhPT0gXCJmdW5jdGlvblwiIHx8IHRhcmdldCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGFyZ2V0ID0ge307XG4gICAgfVxuXG4gICAgZm9yICg7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgICAgICAvLyBPbmx5IGRlYWwgd2l0aCBub24tbnVsbC91bmRlZmluZWQgdmFsdWVzXG4gICAgICAgIGlmICgob3B0aW9ucyA9IGFyZ3VtZW50c1tpXSkgIT0gbnVsbCkge1xuICAgICAgICAgICAgLy8gRXh0ZW5kIHRoZSBiYXNlIG9iamVjdFxuICAgICAgICAgICAgZm9yIChuYW1lIGluIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICBzcmMgPSB0YXJnZXRbbmFtZV07XG4gICAgICAgICAgICAgICAgY29weSA9IG9wdGlvbnNbbmFtZV07XG5cbiAgICAgICAgICAgICAgICAvLyBQcmV2ZW50IG5ldmVyLWVuZGluZyBsb29wXG4gICAgICAgICAgICAgICAgaWYgKHRhcmdldCA9PT0gY29weSkge1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBSZWN1cnNlIGlmIHdlJ3JlIG1lcmdpbmcgcGxhaW4gb2JqZWN0cyBvciBhcnJheXNcbiAgICAgICAgICAgICAgICBpZiAoZGVlcCAmJiBjb3B5ICYmIChpc1BsYWluT2JqZWN0KGNvcHkpIHx8IChjb3B5SXNBcnJheSA9IEFycmF5LmlzQXJyYXkoY29weSkpKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoY29weUlzQXJyYXkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvcHlJc0FycmF5ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICBjbG9uZSA9IHNyYyAmJiBBcnJheS5pc0FycmF5KHNyYykgPyBzcmMgOiBbXTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsb25lID0gc3JjICYmIGlzUGxhaW5PYmplY3Qoc3JjKSA/IHNyYyA6IHt9O1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gTmV2ZXIgbW92ZSBvcmlnaW5hbCBvYmplY3RzLCBjbG9uZSB0aGVtXG4gICAgICAgICAgICAgICAgICAgIHRhcmdldFtuYW1lXSA9IGV4dGVuZChkZWVwLCBjbG9uZSwgY29weSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gRG9uJ3QgYnJpbmcgaW4gdW5kZWZpbmVkIHZhbHVlc1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY29weSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldFtuYW1lXSA9IGNvcHk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gUmV0dXJuIHRoZSBtb2RpZmllZCBvYmplY3RcbiAgICByZXR1cm4gdGFyZ2V0O1xufTtcblxuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL34vZXh0ZW5kL2luZGV4LmpzXG4gKiogbW9kdWxlIGlkID0gMjFcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIi8qXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQgVGhlIFBvbHltZXIgUHJvamVjdCBBdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogVGhpcyBjb2RlIG1heSBvbmx5IGJlIHVzZWQgdW5kZXIgdGhlIEJTRCBzdHlsZSBsaWNlbnNlIGZvdW5kIGF0IGh0dHA6Ly9wb2x5bWVyLmdpdGh1Yi5pby9MSUNFTlNFLnR4dFxuICogVGhlIGNvbXBsZXRlIHNldCBvZiBhdXRob3JzIG1heSBiZSBmb3VuZCBhdCBodHRwOi8vcG9seW1lci5naXRodWIuaW8vQVVUSE9SUy50eHRcbiAqIFRoZSBjb21wbGV0ZSBzZXQgb2YgY29udHJpYnV0b3JzIG1heSBiZSBmb3VuZCBhdCBodHRwOi8vcG9seW1lci5naXRodWIuaW8vQ09OVFJJQlVUT1JTLnR4dFxuICogQ29kZSBkaXN0cmlidXRlZCBieSBHb29nbGUgYXMgcGFydCBvZiB0aGUgcG9seW1lciBwcm9qZWN0IGlzIGFsc29cbiAqIHN1YmplY3QgdG8gYW4gYWRkaXRpb25hbCBJUCByaWdodHMgZ3JhbnQgZm91bmQgYXQgaHR0cDovL3BvbHltZXIuZ2l0aHViLmlvL1BBVEVOVFMudHh0XG4gKi9cblxuKGZ1bmN0aW9uKGdsb2JhbCkge1xuICAndXNlIHN0cmljdCc7XG5cbiAgdmFyIHRlc3RpbmdFeHBvc2VDeWNsZUNvdW50ID0gZ2xvYmFsLnRlc3RpbmdFeHBvc2VDeWNsZUNvdW50O1xuXG4gIC8vIERldGVjdCBhbmQgZG8gYmFzaWMgc2FuaXR5IGNoZWNraW5nIG9uIE9iamVjdC9BcnJheS5vYnNlcnZlLlxuICBmdW5jdGlvbiBkZXRlY3RPYmplY3RPYnNlcnZlKCkge1xuICAgIGlmICh0eXBlb2YgT2JqZWN0Lm9ic2VydmUgIT09ICdmdW5jdGlvbicgfHxcbiAgICAgICAgdHlwZW9mIEFycmF5Lm9ic2VydmUgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgcmVjb3JkcyA9IFtdO1xuXG4gICAgZnVuY3Rpb24gY2FsbGJhY2socmVjcykge1xuICAgICAgcmVjb3JkcyA9IHJlY3M7XG4gICAgfVxuXG4gICAgdmFyIHRlc3QgPSB7fTtcbiAgICB2YXIgYXJyID0gW107XG4gICAgT2JqZWN0Lm9ic2VydmUodGVzdCwgY2FsbGJhY2spO1xuICAgIEFycmF5Lm9ic2VydmUoYXJyLCBjYWxsYmFjayk7XG4gICAgdGVzdC5pZCA9IDE7XG4gICAgdGVzdC5pZCA9IDI7XG4gICAgZGVsZXRlIHRlc3QuaWQ7XG4gICAgYXJyLnB1c2goMSwgMik7XG4gICAgYXJyLmxlbmd0aCA9IDA7XG5cbiAgICBPYmplY3QuZGVsaXZlckNoYW5nZVJlY29yZHMoY2FsbGJhY2spO1xuICAgIGlmIChyZWNvcmRzLmxlbmd0aCAhPT0gNSlcbiAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIGlmIChyZWNvcmRzWzBdLnR5cGUgIT0gJ2FkZCcgfHxcbiAgICAgICAgcmVjb3Jkc1sxXS50eXBlICE9ICd1cGRhdGUnIHx8XG4gICAgICAgIHJlY29yZHNbMl0udHlwZSAhPSAnZGVsZXRlJyB8fFxuICAgICAgICByZWNvcmRzWzNdLnR5cGUgIT0gJ3NwbGljZScgfHxcbiAgICAgICAgcmVjb3Jkc1s0XS50eXBlICE9ICdzcGxpY2UnKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgT2JqZWN0LnVub2JzZXJ2ZSh0ZXN0LCBjYWxsYmFjayk7XG4gICAgQXJyYXkudW5vYnNlcnZlKGFyciwgY2FsbGJhY2spO1xuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICB2YXIgaGFzT2JzZXJ2ZSA9IGRldGVjdE9iamVjdE9ic2VydmUoKTtcblxuICBmdW5jdGlvbiBkZXRlY3RFdmFsKCkge1xuICAgIC8vIERvbid0IHRlc3QgZm9yIGV2YWwgaWYgd2UncmUgcnVubmluZyBpbiBhIENocm9tZSBBcHAgZW52aXJvbm1lbnQuXG4gICAgLy8gV2UgY2hlY2sgZm9yIEFQSXMgc2V0IHRoYXQgb25seSBleGlzdCBpbiBhIENocm9tZSBBcHAgY29udGV4dC5cbiAgICBpZiAodHlwZW9mIGNocm9tZSAhPT0gJ3VuZGVmaW5lZCcgJiYgY2hyb21lLmFwcCAmJiBjaHJvbWUuYXBwLnJ1bnRpbWUpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBGaXJlZm94IE9TIEFwcHMgZG8gbm90IGFsbG93IGV2YWwuIFRoaXMgZmVhdHVyZSBkZXRlY3Rpb24gaXMgdmVyeSBoYWNreVxuICAgIC8vIGJ1dCBldmVuIGlmIHNvbWUgb3RoZXIgcGxhdGZvcm0gYWRkcyBzdXBwb3J0IGZvciB0aGlzIGZ1bmN0aW9uIHRoaXMgY29kZVxuICAgIC8vIHdpbGwgY29udGludWUgdG8gd29yay5cbiAgICBpZiAobmF2aWdhdG9yLmdldERldmljZVN0b3JhZ2UpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgdmFyIGYgPSBuZXcgRnVuY3Rpb24oJycsICdyZXR1cm4gdHJ1ZTsnKTtcbiAgICAgIHJldHVybiBmKCk7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICB2YXIgaGFzRXZhbCA9IGRldGVjdEV2YWwoKTtcblxuICBmdW5jdGlvbiBpc0luZGV4KHMpIHtcbiAgICByZXR1cm4gK3MgPT09IHMgPj4+IDAgJiYgcyAhPT0gJyc7XG4gIH1cblxuICBmdW5jdGlvbiB0b051bWJlcihzKSB7XG4gICAgcmV0dXJuICtzO1xuICB9XG5cbiAgdmFyIG51bWJlcklzTmFOID0gZ2xvYmFsLk51bWJlci5pc05hTiB8fCBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmIGdsb2JhbC5pc05hTih2YWx1ZSk7XG4gIH1cblxuXG4gIHZhciBjcmVhdGVPYmplY3QgPSAoJ19fcHJvdG9fXycgaW4ge30pID9cbiAgICBmdW5jdGlvbihvYmopIHsgcmV0dXJuIG9iajsgfSA6XG4gICAgZnVuY3Rpb24ob2JqKSB7XG4gICAgICB2YXIgcHJvdG8gPSBvYmouX19wcm90b19fO1xuICAgICAgaWYgKCFwcm90bylcbiAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgIHZhciBuZXdPYmplY3QgPSBPYmplY3QuY3JlYXRlKHByb3RvKTtcbiAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKG9iaikuZm9yRWFjaChmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShuZXdPYmplY3QsIG5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Iob2JqLCBuYW1lKSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBuZXdPYmplY3Q7XG4gICAgfTtcblxuICB2YXIgaWRlbnRTdGFydCA9ICdbXFwkX2EtekEtWl0nO1xuICB2YXIgaWRlbnRQYXJ0ID0gJ1tcXCRfYS16QS1aMC05XSc7XG5cblxuICB2YXIgTUFYX0RJUlRZX0NIRUNLX0NZQ0xFUyA9IDEwMDA7XG5cbiAgZnVuY3Rpb24gZGlydHlDaGVjayhvYnNlcnZlcikge1xuICAgIHZhciBjeWNsZXMgPSAwO1xuICAgIHdoaWxlIChjeWNsZXMgPCBNQVhfRElSVFlfQ0hFQ0tfQ1lDTEVTICYmIG9ic2VydmVyLmNoZWNrXygpKSB7XG4gICAgICBjeWNsZXMrKztcbiAgICB9XG4gICAgaWYgKHRlc3RpbmdFeHBvc2VDeWNsZUNvdW50KVxuICAgICAgZ2xvYmFsLmRpcnR5Q2hlY2tDeWNsZUNvdW50ID0gY3ljbGVzO1xuXG4gICAgcmV0dXJuIGN5Y2xlcyA+IDA7XG4gIH1cblxuICBmdW5jdGlvbiBvYmplY3RJc0VtcHR5KG9iamVjdCkge1xuICAgIGZvciAodmFyIHByb3AgaW4gb2JqZWN0KVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgZnVuY3Rpb24gZGlmZklzRW1wdHkoZGlmZikge1xuICAgIHJldHVybiBvYmplY3RJc0VtcHR5KGRpZmYuYWRkZWQpICYmXG4gICAgICAgICAgIG9iamVjdElzRW1wdHkoZGlmZi5yZW1vdmVkKSAmJlxuICAgICAgICAgICBvYmplY3RJc0VtcHR5KGRpZmYuY2hhbmdlZCk7XG4gIH1cblxuICBmdW5jdGlvbiBkaWZmT2JqZWN0RnJvbU9sZE9iamVjdChvYmplY3QsIG9sZE9iamVjdCkge1xuICAgIHZhciBhZGRlZCA9IHt9O1xuICAgIHZhciByZW1vdmVkID0ge307XG4gICAgdmFyIGNoYW5nZWQgPSB7fTtcblxuICAgIGZvciAodmFyIHByb3AgaW4gb2xkT2JqZWN0KSB7XG4gICAgICB2YXIgbmV3VmFsdWUgPSBvYmplY3RbcHJvcF07XG5cbiAgICAgIGlmIChuZXdWYWx1ZSAhPT0gdW5kZWZpbmVkICYmIG5ld1ZhbHVlID09PSBvbGRPYmplY3RbcHJvcF0pXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICBpZiAoIShwcm9wIGluIG9iamVjdCkpIHtcbiAgICAgICAgcmVtb3ZlZFtwcm9wXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChuZXdWYWx1ZSAhPT0gb2xkT2JqZWN0W3Byb3BdKVxuICAgICAgICBjaGFuZ2VkW3Byb3BdID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgcHJvcCBpbiBvYmplY3QpIHtcbiAgICAgIGlmIChwcm9wIGluIG9sZE9iamVjdClcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIGFkZGVkW3Byb3BdID0gb2JqZWN0W3Byb3BdO1xuICAgIH1cblxuICAgIGlmIChBcnJheS5pc0FycmF5KG9iamVjdCkgJiYgb2JqZWN0Lmxlbmd0aCAhPT0gb2xkT2JqZWN0Lmxlbmd0aClcbiAgICAgIGNoYW5nZWQubGVuZ3RoID0gb2JqZWN0Lmxlbmd0aDtcblxuICAgIHJldHVybiB7XG4gICAgICBhZGRlZDogYWRkZWQsXG4gICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgY2hhbmdlZDogY2hhbmdlZFxuICAgIH07XG4gIH1cblxuICB2YXIgZW9tVGFza3MgPSBbXTtcbiAgZnVuY3Rpb24gcnVuRU9NVGFza3MoKSB7XG4gICAgaWYgKCFlb21UYXNrcy5sZW5ndGgpXG4gICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGVvbVRhc2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBlb21UYXNrc1tpXSgpO1xuICAgIH1cbiAgICBlb21UYXNrcy5sZW5ndGggPSAwO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgdmFyIHJ1bkVPTSA9IGhhc09ic2VydmUgPyAoZnVuY3Rpb24oKXtcbiAgICB2YXIgZW9tT2JqID0geyBwaW5nUG9uZzogdHJ1ZSB9O1xuICAgIHZhciBlb21SdW5TY2hlZHVsZWQgPSBmYWxzZTtcblxuICAgIE9iamVjdC5vYnNlcnZlKGVvbU9iaiwgZnVuY3Rpb24oKSB7XG4gICAgICBydW5FT01UYXNrcygpO1xuICAgICAgZW9tUnVuU2NoZWR1bGVkID0gZmFsc2U7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gZnVuY3Rpb24oZm4pIHtcbiAgICAgIGVvbVRhc2tzLnB1c2goZm4pO1xuICAgICAgaWYgKCFlb21SdW5TY2hlZHVsZWQpIHtcbiAgICAgICAgZW9tUnVuU2NoZWR1bGVkID0gdHJ1ZTtcbiAgICAgICAgZW9tT2JqLnBpbmdQb25nID0gIWVvbU9iai5waW5nUG9uZztcbiAgICAgIH1cbiAgICB9O1xuICB9KSgpIDpcbiAgKGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBmdW5jdGlvbihmbikge1xuICAgICAgZW9tVGFza3MucHVzaChmbik7XG4gICAgfTtcbiAgfSkoKTtcblxuICB2YXIgb2JzZXJ2ZWRPYmplY3RDYWNoZSA9IFtdO1xuXG4gIGZ1bmN0aW9uIG5ld09ic2VydmVkT2JqZWN0KCkge1xuICAgIHZhciBvYnNlcnZlcjtcbiAgICB2YXIgb2JqZWN0O1xuICAgIHZhciBkaXNjYXJkUmVjb3JkcyA9IGZhbHNlO1xuICAgIHZhciBmaXJzdCA9IHRydWU7XG5cbiAgICBmdW5jdGlvbiBjYWxsYmFjayhyZWNvcmRzKSB7XG4gICAgICBpZiAob2JzZXJ2ZXIgJiYgb2JzZXJ2ZXIuc3RhdGVfID09PSBPUEVORUQgJiYgIWRpc2NhcmRSZWNvcmRzKVxuICAgICAgICBvYnNlcnZlci5jaGVja18ocmVjb3Jkcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIG9wZW46IGZ1bmN0aW9uKG9icykge1xuICAgICAgICBpZiAob2JzZXJ2ZXIpXG4gICAgICAgICAgdGhyb3cgRXJyb3IoJ09ic2VydmVkT2JqZWN0IGluIHVzZScpO1xuXG4gICAgICAgIGlmICghZmlyc3QpXG4gICAgICAgICAgT2JqZWN0LmRlbGl2ZXJDaGFuZ2VSZWNvcmRzKGNhbGxiYWNrKTtcblxuICAgICAgICBvYnNlcnZlciA9IG9icztcbiAgICAgICAgZmlyc3QgPSBmYWxzZTtcbiAgICAgIH0sXG4gICAgICBvYnNlcnZlOiBmdW5jdGlvbihvYmosIGFycmF5T2JzZXJ2ZSkge1xuICAgICAgICBvYmplY3QgPSBvYmo7XG4gICAgICAgIGlmIChhcnJheU9ic2VydmUpXG4gICAgICAgICAgQXJyYXkub2JzZXJ2ZShvYmplY3QsIGNhbGxiYWNrKTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIE9iamVjdC5vYnNlcnZlKG9iamVjdCwgY2FsbGJhY2spO1xuICAgICAgfSxcbiAgICAgIGRlbGl2ZXI6IGZ1bmN0aW9uKGRpc2NhcmQpIHtcbiAgICAgICAgZGlzY2FyZFJlY29yZHMgPSBkaXNjYXJkO1xuICAgICAgICBPYmplY3QuZGVsaXZlckNoYW5nZVJlY29yZHMoY2FsbGJhY2spO1xuICAgICAgICBkaXNjYXJkUmVjb3JkcyA9IGZhbHNlO1xuICAgICAgfSxcbiAgICAgIGNsb3NlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgb2JzZXJ2ZXIgPSB1bmRlZmluZWQ7XG4gICAgICAgIE9iamVjdC51bm9ic2VydmUob2JqZWN0LCBjYWxsYmFjayk7XG4gICAgICAgIG9ic2VydmVkT2JqZWN0Q2FjaGUucHVzaCh0aGlzKTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgLypcbiAgICogVGhlIG9ic2VydmVkU2V0IGFic3RyYWN0aW9uIGlzIGEgcGVyZiBvcHRpbWl6YXRpb24gd2hpY2ggcmVkdWNlcyB0aGUgdG90YWxcbiAgICogbnVtYmVyIG9mIE9iamVjdC5vYnNlcnZlIG9ic2VydmF0aW9ucyBvZiBhIHNldCBvZiBvYmplY3RzLiBUaGUgaWRlYSBpcyB0aGF0XG4gICAqIGdyb3VwcyBvZiBPYnNlcnZlcnMgd2lsbCBoYXZlIHNvbWUgb2JqZWN0IGRlcGVuZGVuY2llcyBpbiBjb21tb24gYW5kIHRoaXNcbiAgICogb2JzZXJ2ZWQgc2V0IGVuc3VyZXMgdGhhdCBlYWNoIG9iamVjdCBpbiB0aGUgdHJhbnNpdGl2ZSBjbG9zdXJlIG9mXG4gICAqIGRlcGVuZGVuY2llcyBpcyBvbmx5IG9ic2VydmVkIG9uY2UuIFRoZSBvYnNlcnZlZFNldCBhY3RzIGFzIGEgd3JpdGUgYmFycmllclxuICAgKiBzdWNoIHRoYXQgd2hlbmV2ZXIgYW55IGNoYW5nZSBjb21lcyB0aHJvdWdoLCBhbGwgT2JzZXJ2ZXJzIGFyZSBjaGVja2VkIGZvclxuICAgKiBjaGFuZ2VkIHZhbHVlcy5cbiAgICpcbiAgICogTm90ZSB0aGF0IHRoaXMgb3B0aW1pemF0aW9uIGlzIGV4cGxpY2l0bHkgbW92aW5nIHdvcmsgZnJvbSBzZXR1cC10aW1lIHRvXG4gICAqIGNoYW5nZS10aW1lLlxuICAgKlxuICAgKiBUT0RPKHJhZmFlbHcpOiBJbXBsZW1lbnQgXCJnYXJiYWdlIGNvbGxlY3Rpb25cIi4gSW4gb3JkZXIgdG8gbW92ZSB3b3JrIG9mZlxuICAgKiB0aGUgY3JpdGljYWwgcGF0aCwgd2hlbiBPYnNlcnZlcnMgYXJlIGNsb3NlZCwgdGhlaXIgb2JzZXJ2ZWQgb2JqZWN0cyBhcmVcbiAgICogbm90IE9iamVjdC51bm9ic2VydmUoZCkuIEFzIGEgcmVzdWx0LCBpdCdzaWVzdGEgcG9zc2libGUgdGhhdCBpZiB0aGUgb2JzZXJ2ZWRTZXRcbiAgICogaXMga2VwdCBvcGVuLCBidXQgc29tZSBPYnNlcnZlcnMgaGF2ZSBiZWVuIGNsb3NlZCwgaXQgY291bGQgY2F1c2UgXCJsZWFrc1wiXG4gICAqIChwcmV2ZW50IG90aGVyd2lzZSBjb2xsZWN0YWJsZSBvYmplY3RzIGZyb20gYmVpbmcgY29sbGVjdGVkKS4gQXQgc29tZVxuICAgKiBwb2ludCwgd2Ugc2hvdWxkIGltcGxlbWVudCBpbmNyZW1lbnRhbCBcImdjXCIgd2hpY2gga2VlcHMgYSBsaXN0IG9mXG4gICAqIG9ic2VydmVkU2V0cyB3aGljaCBtYXkgbmVlZCBjbGVhbi11cCBhbmQgZG9lcyBzbWFsbCBhbW91bnRzIG9mIGNsZWFudXAgb24gYVxuICAgKiB0aW1lb3V0IHVudGlsIGFsbCBpcyBjbGVhbi5cbiAgICovXG5cbiAgZnVuY3Rpb24gZ2V0T2JzZXJ2ZWRPYmplY3Qob2JzZXJ2ZXIsIG9iamVjdCwgYXJyYXlPYnNlcnZlKSB7XG4gICAgdmFyIGRpciA9IG9ic2VydmVkT2JqZWN0Q2FjaGUucG9wKCkgfHwgbmV3T2JzZXJ2ZWRPYmplY3QoKTtcbiAgICBkaXIub3BlbihvYnNlcnZlcik7XG4gICAgZGlyLm9ic2VydmUob2JqZWN0LCBhcnJheU9ic2VydmUpO1xuICAgIHJldHVybiBkaXI7XG4gIH1cblxuICB2YXIgb2JzZXJ2ZWRTZXRDYWNoZSA9IFtdO1xuXG4gIGZ1bmN0aW9uIG5ld09ic2VydmVkU2V0KCkge1xuICAgIHZhciBvYnNlcnZlckNvdW50ID0gMDtcbiAgICB2YXIgb2JzZXJ2ZXJzID0gW107XG4gICAgdmFyIG9iamVjdHMgPSBbXTtcbiAgICB2YXIgcm9vdE9iajtcbiAgICB2YXIgcm9vdE9ialByb3BzO1xuXG4gICAgZnVuY3Rpb24gb2JzZXJ2ZShvYmosIHByb3ApIHtcbiAgICAgIGlmICghb2JqKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIGlmIChvYmogPT09IHJvb3RPYmopXG4gICAgICAgIHJvb3RPYmpQcm9wc1twcm9wXSA9IHRydWU7XG5cbiAgICAgIGlmIChvYmplY3RzLmluZGV4T2Yob2JqKSA8IDApIHtcbiAgICAgICAgb2JqZWN0cy5wdXNoKG9iaik7XG4gICAgICAgIE9iamVjdC5vYnNlcnZlKG9iaiwgY2FsbGJhY2spO1xuICAgICAgfVxuXG4gICAgICBvYnNlcnZlKE9iamVjdC5nZXRQcm90b3R5cGVPZihvYmopLCBwcm9wKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhbGxSb290T2JqTm9uT2JzZXJ2ZWRQcm9wcyhyZWNzKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlY3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHJlYyA9IHJlY3NbaV07XG4gICAgICAgIGlmIChyZWMub2JqZWN0ICE9PSByb290T2JqIHx8XG4gICAgICAgICAgICByb290T2JqUHJvcHNbcmVjLm5hbWVdIHx8XG4gICAgICAgICAgICByZWMudHlwZSA9PT0gJ3NldFByb3RvdHlwZScpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNhbGxiYWNrKHJlY3MpIHtcbiAgICAgIGlmIChhbGxSb290T2JqTm9uT2JzZXJ2ZWRQcm9wcyhyZWNzKSlcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICB2YXIgb2JzZXJ2ZXI7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9ic2VydmVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICBvYnNlcnZlciA9IG9ic2VydmVyc1tpXTtcbiAgICAgICAgaWYgKG9ic2VydmVyLnN0YXRlXyA9PSBPUEVORUQpIHtcbiAgICAgICAgICBvYnNlcnZlci5pdGVyYXRlT2JqZWN0c18ob2JzZXJ2ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYnNlcnZlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgb2JzZXJ2ZXIgPSBvYnNlcnZlcnNbaV07XG4gICAgICAgIGlmIChvYnNlcnZlci5zdGF0ZV8gPT0gT1BFTkVEKSB7XG4gICAgICAgICAgb2JzZXJ2ZXIuY2hlY2tfKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgcmVjb3JkID0ge1xuICAgICAgb2JqZWN0OiB1bmRlZmluZWQsXG4gICAgICBvYmplY3RzOiBvYmplY3RzLFxuICAgICAgb3BlbjogZnVuY3Rpb24ob2JzLCBvYmplY3QpIHtcbiAgICAgICAgaWYgKCFyb290T2JqKSB7XG4gICAgICAgICAgcm9vdE9iaiA9IG9iamVjdDtcbiAgICAgICAgICByb290T2JqUHJvcHMgPSB7fTtcbiAgICAgICAgfVxuXG4gICAgICAgIG9ic2VydmVycy5wdXNoKG9icyk7XG4gICAgICAgIG9ic2VydmVyQ291bnQrKztcbiAgICAgICAgb2JzLml0ZXJhdGVPYmplY3RzXyhvYnNlcnZlKTtcbiAgICAgIH0sXG4gICAgICBjbG9zZTogZnVuY3Rpb24ob2JzKSB7XG4gICAgICAgIG9ic2VydmVyQ291bnQtLTtcbiAgICAgICAgaWYgKG9ic2VydmVyQ291bnQgPiAwKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYmplY3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgT2JqZWN0LnVub2JzZXJ2ZShvYmplY3RzW2ldLCBjYWxsYmFjayk7XG4gICAgICAgICAgT2JzZXJ2ZXIudW5vYnNlcnZlZENvdW50Kys7XG4gICAgICAgIH1cblxuICAgICAgICBvYnNlcnZlcnMubGVuZ3RoID0gMDtcbiAgICAgICAgb2JqZWN0cy5sZW5ndGggPSAwO1xuICAgICAgICByb290T2JqID0gdW5kZWZpbmVkO1xuICAgICAgICByb290T2JqUHJvcHMgPSB1bmRlZmluZWQ7XG4gICAgICAgIG9ic2VydmVkU2V0Q2FjaGUucHVzaCh0aGlzKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmV0dXJuIHJlY29yZDtcbiAgfVxuXG4gIHZhciBsYXN0T2JzZXJ2ZWRTZXQ7XG5cbiAgdmFyIFVOT1BFTkVEID0gMDtcbiAgdmFyIE9QRU5FRCA9IDE7XG4gIHZhciBDTE9TRUQgPSAyO1xuXG4gIHZhciBuZXh0T2JzZXJ2ZXJJZCA9IDE7XG5cbiAgZnVuY3Rpb24gT2JzZXJ2ZXIoKSB7XG4gICAgdGhpcy5zdGF0ZV8gPSBVTk9QRU5FRDtcbiAgICB0aGlzLmNhbGxiYWNrXyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLnRhcmdldF8gPSB1bmRlZmluZWQ7IC8vIFRPRE8ocmFmYWVsdyk6IFNob3VsZCBiZSBXZWFrUmVmXG4gICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8gPSB1bmRlZmluZWQ7XG4gICAgdGhpcy52YWx1ZV8gPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5pZF8gPSBuZXh0T2JzZXJ2ZXJJZCsrO1xuICB9XG5cbiAgT2JzZXJ2ZXIucHJvdG90eXBlID0ge1xuICAgIG9wZW46IGZ1bmN0aW9uKGNhbGxiYWNrLCB0YXJnZXQpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBVTk9QRU5FRClcbiAgICAgICAgdGhyb3cgRXJyb3IoJ09ic2VydmVyIGhhcyBhbHJlYWR5IGJlZW4gb3BlbmVkLicpO1xuXG4gICAgICBhZGRUb0FsbCh0aGlzKTtcbiAgICAgIHRoaXMuY2FsbGJhY2tfID0gY2FsbGJhY2s7XG4gICAgICB0aGlzLnRhcmdldF8gPSB0YXJnZXQ7XG4gICAgICB0aGlzLmNvbm5lY3RfKCk7XG4gICAgICB0aGlzLnN0YXRlXyA9IE9QRU5FRDtcbiAgICAgIHJldHVybiB0aGlzLnZhbHVlXztcbiAgICB9LFxuXG4gICAgY2xvc2U6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuc3RhdGVfICE9IE9QRU5FRClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICByZW1vdmVGcm9tQWxsKHRoaXMpO1xuICAgICAgdGhpcy5kaXNjb25uZWN0XygpO1xuICAgICAgdGhpcy52YWx1ZV8gPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLmNhbGxiYWNrXyA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMudGFyZ2V0XyA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMuc3RhdGVfID0gQ0xPU0VEO1xuICAgIH0sXG5cbiAgICBkZWxpdmVyOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBPUEVORUQpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgZGlydHlDaGVjayh0aGlzKTtcbiAgICB9LFxuXG4gICAgcmVwb3J0XzogZnVuY3Rpb24oY2hhbmdlcykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgdGhpcy5jYWxsYmFja18uYXBwbHkodGhpcy50YXJnZXRfLCBjaGFuZ2VzKTtcbiAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgIE9ic2VydmVyLl9lcnJvclRocm93bkR1cmluZ0NhbGxiYWNrID0gdHJ1ZTtcbiAgICAgICAgY29uc29sZS5lcnJvcignRXhjZXB0aW9uIGNhdWdodCBkdXJpbmcgb2JzZXJ2ZXIgY2FsbGJhY2s6ICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAoZXguc3RhY2sgfHwgZXgpKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgZGlzY2FyZENoYW5nZXM6IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5jaGVja18odW5kZWZpbmVkLCB0cnVlKTtcbiAgICAgIHJldHVybiB0aGlzLnZhbHVlXztcbiAgICB9XG4gIH1cblxuICB2YXIgY29sbGVjdE9ic2VydmVycyA9ICFoYXNPYnNlcnZlO1xuICB2YXIgYWxsT2JzZXJ2ZXJzO1xuICBPYnNlcnZlci5fYWxsT2JzZXJ2ZXJzQ291bnQgPSAwO1xuXG4gIGlmIChjb2xsZWN0T2JzZXJ2ZXJzKSB7XG4gICAgYWxsT2JzZXJ2ZXJzID0gW107XG4gIH1cblxuICBmdW5jdGlvbiBhZGRUb0FsbChvYnNlcnZlcikge1xuICAgIE9ic2VydmVyLl9hbGxPYnNlcnZlcnNDb3VudCsrO1xuICAgIGlmICghY29sbGVjdE9ic2VydmVycylcbiAgICAgIHJldHVybjtcblxuICAgIGFsbE9ic2VydmVycy5wdXNoKG9ic2VydmVyKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZUZyb21BbGwob2JzZXJ2ZXIpIHtcbiAgICBPYnNlcnZlci5fYWxsT2JzZXJ2ZXJzQ291bnQtLTtcbiAgfVxuXG4gIHZhciBydW5uaW5nTWljcm90YXNrQ2hlY2twb2ludCA9IGZhbHNlO1xuXG4gIHZhciBoYXNEZWJ1Z0ZvcmNlRnVsbERlbGl2ZXJ5ID0gaGFzT2JzZXJ2ZSAmJiBoYXNFdmFsICYmIChmdW5jdGlvbigpIHtcbiAgICB0cnkge1xuICAgICAgZXZhbCgnJVJ1bk1pY3JvdGFza3MoKScpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH0pKCk7XG5cbiAgZ2xvYmFsLlBsYXRmb3JtID0gZ2xvYmFsLlBsYXRmb3JtIHx8IHt9O1xuXG4gIGdsb2JhbC5QbGF0Zm9ybS5wZXJmb3JtTWljcm90YXNrQ2hlY2twb2ludCA9IGZ1bmN0aW9uKCkge1xuICAgIGlmIChydW5uaW5nTWljcm90YXNrQ2hlY2twb2ludClcbiAgICAgIHJldHVybjtcblxuICAgIGlmIChoYXNEZWJ1Z0ZvcmNlRnVsbERlbGl2ZXJ5KSB7XG4gICAgICBldmFsKCclUnVuTWljcm90YXNrcygpJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCFjb2xsZWN0T2JzZXJ2ZXJzKVxuICAgICAgcmV0dXJuO1xuXG4gICAgcnVubmluZ01pY3JvdGFza0NoZWNrcG9pbnQgPSB0cnVlO1xuXG4gICAgdmFyIGN5Y2xlcyA9IDA7XG4gICAgdmFyIGFueUNoYW5nZWQsIHRvQ2hlY2s7XG5cbiAgICBkbyB7XG4gICAgICBjeWNsZXMrKztcbiAgICAgIHRvQ2hlY2sgPSBhbGxPYnNlcnZlcnM7XG4gICAgICBhbGxPYnNlcnZlcnMgPSBbXTtcbiAgICAgIGFueUNoYW5nZWQgPSBmYWxzZTtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0b0NoZWNrLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBvYnNlcnZlciA9IHRvQ2hlY2tbaV07XG4gICAgICAgIGlmIChvYnNlcnZlci5zdGF0ZV8gIT0gT1BFTkVEKVxuICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgIGlmIChvYnNlcnZlci5jaGVja18oKSlcbiAgICAgICAgICBhbnlDaGFuZ2VkID0gdHJ1ZTtcblxuICAgICAgICBhbGxPYnNlcnZlcnMucHVzaChvYnNlcnZlcik7XG4gICAgICB9XG4gICAgICBpZiAocnVuRU9NVGFza3MoKSlcbiAgICAgICAgYW55Q2hhbmdlZCA9IHRydWU7XG4gICAgfSB3aGlsZSAoY3ljbGVzIDwgTUFYX0RJUlRZX0NIRUNLX0NZQ0xFUyAmJiBhbnlDaGFuZ2VkKTtcblxuICAgIGlmICh0ZXN0aW5nRXhwb3NlQ3ljbGVDb3VudClcbiAgICAgIGdsb2JhbC5kaXJ0eUNoZWNrQ3ljbGVDb3VudCA9IGN5Y2xlcztcblxuICAgIHJ1bm5pbmdNaWNyb3Rhc2tDaGVja3BvaW50ID0gZmFsc2U7XG4gIH07XG5cbiAgaWYgKGNvbGxlY3RPYnNlcnZlcnMpIHtcbiAgICBnbG9iYWwuUGxhdGZvcm0uY2xlYXJPYnNlcnZlcnMgPSBmdW5jdGlvbigpIHtcbiAgICAgIGFsbE9ic2VydmVycyA9IFtdO1xuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBPYmplY3RPYnNlcnZlcihvYmplY3QpIHtcbiAgICBPYnNlcnZlci5jYWxsKHRoaXMpO1xuICAgIHRoaXMudmFsdWVfID0gb2JqZWN0O1xuICAgIHRoaXMub2xkT2JqZWN0XyA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIE9iamVjdE9ic2VydmVyLnByb3RvdHlwZSA9IGNyZWF0ZU9iamVjdCh7XG4gICAgX19wcm90b19fOiBPYnNlcnZlci5wcm90b3R5cGUsXG5cbiAgICBhcnJheU9ic2VydmU6IGZhbHNlLFxuXG4gICAgY29ubmVjdF86IGZ1bmN0aW9uKGNhbGxiYWNrLCB0YXJnZXQpIHtcbiAgICAgIGlmIChoYXNPYnNlcnZlKSB7XG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gZ2V0T2JzZXJ2ZWRPYmplY3QodGhpcywgdGhpcy52YWx1ZV8sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcnJheU9ic2VydmUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdGhpcy5jb3B5T2JqZWN0KHRoaXMudmFsdWVfKTtcbiAgICAgIH1cblxuICAgIH0sXG5cbiAgICBjb3B5T2JqZWN0OiBmdW5jdGlvbihvYmplY3QpIHtcbiAgICAgIHZhciBjb3B5ID0gQXJyYXkuaXNBcnJheShvYmplY3QpID8gW10gOiB7fTtcbiAgICAgIGZvciAodmFyIHByb3AgaW4gb2JqZWN0KSB7XG4gICAgICAgIGNvcHlbcHJvcF0gPSBvYmplY3RbcHJvcF07XG4gICAgICB9O1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkob2JqZWN0KSlcbiAgICAgICAgY29weS5sZW5ndGggPSBvYmplY3QubGVuZ3RoO1xuICAgICAgcmV0dXJuIGNvcHk7XG4gICAgfSxcblxuICAgIGNoZWNrXzogZnVuY3Rpb24oY2hhbmdlUmVjb3Jkcywgc2tpcENoYW5nZXMpIHtcbiAgICAgIHZhciBkaWZmO1xuICAgICAgdmFyIG9sZFZhbHVlcztcbiAgICAgIGlmIChoYXNPYnNlcnZlKSB7XG4gICAgICAgIGlmICghY2hhbmdlUmVjb3JkcylcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgb2xkVmFsdWVzID0ge307XG4gICAgICAgIGRpZmYgPSBkaWZmT2JqZWN0RnJvbUNoYW5nZVJlY29yZHModGhpcy52YWx1ZV8sIGNoYW5nZVJlY29yZHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkVmFsdWVzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9sZFZhbHVlcyA9IHRoaXMub2xkT2JqZWN0XztcbiAgICAgICAgZGlmZiA9IGRpZmZPYmplY3RGcm9tT2xkT2JqZWN0KHRoaXMudmFsdWVfLCB0aGlzLm9sZE9iamVjdF8pO1xuICAgICAgfVxuXG4gICAgICBpZiAoZGlmZklzRW1wdHkoZGlmZikpXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgaWYgKCFoYXNPYnNlcnZlKVxuICAgICAgICB0aGlzLm9sZE9iamVjdF8gPSB0aGlzLmNvcHlPYmplY3QodGhpcy52YWx1ZV8pO1xuXG4gICAgICB0aGlzLnJlcG9ydF8oW1xuICAgICAgICBkaWZmLmFkZGVkIHx8IHt9LFxuICAgICAgICBkaWZmLnJlbW92ZWQgfHwge30sXG4gICAgICAgIGRpZmYuY2hhbmdlZCB8fCB7fSxcbiAgICAgICAgZnVuY3Rpb24ocHJvcGVydHkpIHtcbiAgICAgICAgICByZXR1cm4gb2xkVmFsdWVzW3Byb3BlcnR5XTtcbiAgICAgICAgfVxuICAgICAgXSk7XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0sXG5cbiAgICBkaXNjb25uZWN0XzogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoaGFzT2JzZXJ2ZSkge1xuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXy5jbG9zZSgpO1xuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXyA9IHVuZGVmaW5lZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMub2xkT2JqZWN0XyA9IHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgZGVsaXZlcjogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gT1BFTkVEKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIGlmIChoYXNPYnNlcnZlKVxuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXy5kZWxpdmVyKGZhbHNlKTtcbiAgICAgIGVsc2VcbiAgICAgICAgZGlydHlDaGVjayh0aGlzKTtcbiAgICB9LFxuXG4gICAgZGlzY2FyZENoYW5nZXM6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuZGlyZWN0T2JzZXJ2ZXJfKVxuICAgICAgICB0aGlzLmRpcmVjdE9ic2VydmVyXy5kZWxpdmVyKHRydWUpO1xuICAgICAgZWxzZVxuICAgICAgICB0aGlzLm9sZE9iamVjdF8gPSB0aGlzLmNvcHlPYmplY3QodGhpcy52YWx1ZV8pO1xuXG4gICAgICByZXR1cm4gdGhpcy52YWx1ZV87XG4gICAgfVxuICB9KTtcblxuICBmdW5jdGlvbiBBcnJheU9ic2VydmVyKGFycmF5KSB7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGFycmF5KSlcbiAgICAgIHRocm93IEVycm9yKCdQcm92aWRlZCBvYmplY3QgaXMgbm90IGFuIEFycmF5Jyk7XG4gICAgT2JqZWN0T2JzZXJ2ZXIuY2FsbCh0aGlzLCBhcnJheSk7XG4gIH1cblxuICBBcnJheU9ic2VydmVyLnByb3RvdHlwZSA9IGNyZWF0ZU9iamVjdCh7XG5cbiAgICBfX3Byb3RvX186IE9iamVjdE9ic2VydmVyLnByb3RvdHlwZSxcblxuICAgIGFycmF5T2JzZXJ2ZTogdHJ1ZSxcblxuICAgIGNvcHlPYmplY3Q6IGZ1bmN0aW9uKGFycikge1xuICAgICAgcmV0dXJuIGFyci5zbGljZSgpO1xuICAgIH0sXG5cbiAgICBjaGVja186IGZ1bmN0aW9uKGNoYW5nZVJlY29yZHMpIHtcbiAgICAgIHZhciBzcGxpY2VzO1xuICAgICAgaWYgKGhhc09ic2VydmUpIHtcbiAgICAgICAgaWYgKCFjaGFuZ2VSZWNvcmRzKVxuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgc3BsaWNlcyA9IHByb2plY3RBcnJheVNwbGljZXModGhpcy52YWx1ZV8sIGNoYW5nZVJlY29yZHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3BsaWNlcyA9IGNhbGNTcGxpY2VzKHRoaXMudmFsdWVfLCAwLCB0aGlzLnZhbHVlXy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm9sZE9iamVjdF8sIDAsIHRoaXMub2xkT2JqZWN0Xy5sZW5ndGgpO1xuICAgICAgfVxuXG4gICAgICBpZiAoIXNwbGljZXMgfHwgIXNwbGljZXMubGVuZ3RoKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgIGlmICghaGFzT2JzZXJ2ZSlcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdGhpcy5jb3B5T2JqZWN0KHRoaXMudmFsdWVfKTtcblxuICAgICAgdGhpcy5yZXBvcnRfKFtzcGxpY2VzXSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH0pO1xuXG4gIEFycmF5T2JzZXJ2ZXIuYXBwbHlTcGxpY2VzID0gZnVuY3Rpb24ocHJldmlvdXMsIGN1cnJlbnQsIHNwbGljZXMpIHtcbiAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24oc3BsaWNlKSB7XG4gICAgICB2YXIgc3BsaWNlQXJncyA9IFtzcGxpY2UuaW5kZXgsIHNwbGljZS5yZW1vdmVkLmxlbmd0aF07XG4gICAgICB2YXIgYWRkSW5kZXggPSBzcGxpY2UuaW5kZXg7XG4gICAgICB3aGlsZSAoYWRkSW5kZXggPCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCkge1xuICAgICAgICBzcGxpY2VBcmdzLnB1c2goY3VycmVudFthZGRJbmRleF0pO1xuICAgICAgICBhZGRJbmRleCsrO1xuICAgICAgfVxuXG4gICAgICBBcnJheS5wcm90b3R5cGUuc3BsaWNlLmFwcGx5KHByZXZpb3VzLCBzcGxpY2VBcmdzKTtcbiAgICB9KTtcbiAgfTtcblxuICB2YXIgb2JzZXJ2ZXJTZW50aW5lbCA9IHt9O1xuXG4gIHZhciBleHBlY3RlZFJlY29yZFR5cGVzID0ge1xuICAgIGFkZDogdHJ1ZSxcbiAgICB1cGRhdGU6IHRydWUsXG4gICAgZGVsZXRlOiB0cnVlXG4gIH07XG5cbiAgZnVuY3Rpb24gZGlmZk9iamVjdEZyb21DaGFuZ2VSZWNvcmRzKG9iamVjdCwgY2hhbmdlUmVjb3Jkcywgb2xkVmFsdWVzKSB7XG4gICAgdmFyIGFkZGVkID0ge307XG4gICAgdmFyIHJlbW92ZWQgPSB7fTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hhbmdlUmVjb3Jkcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHJlY29yZCA9IGNoYW5nZVJlY29yZHNbaV07XG4gICAgICBpZiAoIWV4cGVjdGVkUmVjb3JkVHlwZXNbcmVjb3JkLnR5cGVdKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1Vua25vd24gY2hhbmdlUmVjb3JkIHR5cGU6ICcgKyByZWNvcmQudHlwZSk7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IocmVjb3JkKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmICghKHJlY29yZC5uYW1lIGluIG9sZFZhbHVlcykpXG4gICAgICAgIG9sZFZhbHVlc1tyZWNvcmQubmFtZV0gPSByZWNvcmQub2xkVmFsdWU7XG5cbiAgICAgIGlmIChyZWNvcmQudHlwZSA9PSAndXBkYXRlJylcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIGlmIChyZWNvcmQudHlwZSA9PSAnYWRkJykge1xuICAgICAgICBpZiAocmVjb3JkLm5hbWUgaW4gcmVtb3ZlZClcbiAgICAgICAgICBkZWxldGUgcmVtb3ZlZFtyZWNvcmQubmFtZV07XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBhZGRlZFtyZWNvcmQubmFtZV0gPSB0cnVlO1xuXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyB0eXBlID0gJ2RlbGV0ZSdcbiAgICAgIGlmIChyZWNvcmQubmFtZSBpbiBhZGRlZCkge1xuICAgICAgICBkZWxldGUgYWRkZWRbcmVjb3JkLm5hbWVdO1xuICAgICAgICBkZWxldGUgb2xkVmFsdWVzW3JlY29yZC5uYW1lXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlbW92ZWRbcmVjb3JkLm5hbWVdID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKHZhciBwcm9wIGluIGFkZGVkKVxuICAgICAgYWRkZWRbcHJvcF0gPSBvYmplY3RbcHJvcF07XG5cbiAgICBmb3IgKHZhciBwcm9wIGluIHJlbW92ZWQpXG4gICAgICByZW1vdmVkW3Byb3BdID0gdW5kZWZpbmVkO1xuXG4gICAgdmFyIGNoYW5nZWQgPSB7fTtcbiAgICBmb3IgKHZhciBwcm9wIGluIG9sZFZhbHVlcykge1xuICAgICAgaWYgKHByb3AgaW4gYWRkZWQgfHwgcHJvcCBpbiByZW1vdmVkKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgdmFyIG5ld1ZhbHVlID0gb2JqZWN0W3Byb3BdO1xuICAgICAgaWYgKG9sZFZhbHVlc1twcm9wXSAhPT0gbmV3VmFsdWUpXG4gICAgICAgIGNoYW5nZWRbcHJvcF0gPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgYWRkZWQ6IGFkZGVkLFxuICAgICAgcmVtb3ZlZDogcmVtb3ZlZCxcbiAgICAgIGNoYW5nZWQ6IGNoYW5nZWRcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gbmV3U3BsaWNlKGluZGV4LCByZW1vdmVkLCBhZGRlZENvdW50KSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGluZGV4OiBpbmRleCxcbiAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICBhZGRlZENvdW50OiBhZGRlZENvdW50XG4gICAgfTtcbiAgfVxuXG4gIHZhciBFRElUX0xFQVZFID0gMDtcbiAgdmFyIEVESVRfVVBEQVRFID0gMTtcbiAgdmFyIEVESVRfQUREID0gMjtcbiAgdmFyIEVESVRfREVMRVRFID0gMztcblxuICBmdW5jdGlvbiBBcnJheVNwbGljZSgpIHt9XG5cbiAgQXJyYXlTcGxpY2UucHJvdG90eXBlID0ge1xuXG4gICAgLy8gTm90ZTogVGhpcyBmdW5jdGlvbiBpcyAqYmFzZWQqIG9uIHRoZSBjb21wdXRhdGlvbiBvZiB0aGUgTGV2ZW5zaHRlaW5cbiAgICAvLyBcImVkaXRcIiBkaXN0YW5jZS4gVGhlIG9uZSBjaGFuZ2UgaXMgdGhhdCBcInVwZGF0ZXNcIiBhcmUgdHJlYXRlZCBhcyB0d29cbiAgICAvLyBlZGl0cyAtIG5vdCBvbmUuIFdpdGggQXJyYXkgc3BsaWNlcywgYW4gdXBkYXRlIGlzIHJlYWxseSBhIGRlbGV0ZVxuICAgIC8vIGZvbGxvd2VkIGJ5IGFuIGFkZC4gQnkgcmV0YWluaW5nIHRoaXMsIHdlIG9wdGltaXplIGZvciBcImtlZXBpbmdcIiB0aGVcbiAgICAvLyBtYXhpbXVtIGFycmF5IGl0ZW1zIGluIHRoZSBvcmlnaW5hbCBhcnJheS4gRm9yIGV4YW1wbGU6XG4gICAgLy9cbiAgICAvLyAgICd4eHh4MTIzJyAtPiAnMTIzeXl5eSdcbiAgICAvL1xuICAgIC8vIFdpdGggMS1lZGl0IHVwZGF0ZXMsIHRoZSBzaG9ydGVzdCBwYXRoIHdvdWxkIGJlIGp1c3QgdG8gdXBkYXRlIGFsbCBzZXZlblxuICAgIC8vIGNoYXJhY3RlcnMuIFdpdGggMi1lZGl0IHVwZGF0ZXMsIHdlIGRlbGV0ZSA0LCBsZWF2ZSAzLCBhbmQgYWRkIDQuIFRoaXNcbiAgICAvLyBsZWF2ZXMgdGhlIHN1YnN0cmluZyAnMTIzJyBpbnRhY3QuXG4gICAgY2FsY0VkaXREaXN0YW5jZXM6IGZ1bmN0aW9uKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKSB7XG4gICAgICAvLyBcIkRlbGV0aW9uXCIgY29sdW1uc1xuICAgICAgdmFyIHJvd0NvdW50ID0gb2xkRW5kIC0gb2xkU3RhcnQgKyAxO1xuICAgICAgdmFyIGNvbHVtbkNvdW50ID0gY3VycmVudEVuZCAtIGN1cnJlbnRTdGFydCArIDE7XG4gICAgICB2YXIgZGlzdGFuY2VzID0gbmV3IEFycmF5KHJvd0NvdW50KTtcblxuICAgICAgLy8gXCJBZGRpdGlvblwiIHJvd3MuIEluaXRpYWxpemUgbnVsbCBjb2x1bW4uXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJvd0NvdW50OyBpKyspIHtcbiAgICAgICAgZGlzdGFuY2VzW2ldID0gbmV3IEFycmF5KGNvbHVtbkNvdW50KTtcbiAgICAgICAgZGlzdGFuY2VzW2ldWzBdID0gaTtcbiAgICAgIH1cblxuICAgICAgLy8gSW5pdGlhbGl6ZSBudWxsIHJvd1xuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBjb2x1bW5Db3VudDsgaisrKVxuICAgICAgICBkaXN0YW5jZXNbMF1bal0gPSBqO1xuXG4gICAgICBmb3IgKHZhciBpID0gMTsgaSA8IHJvd0NvdW50OyBpKyspIHtcbiAgICAgICAgZm9yICh2YXIgaiA9IDE7IGogPCBjb2x1bW5Db3VudDsgaisrKSB7XG4gICAgICAgICAgaWYgKHRoaXMuZXF1YWxzKGN1cnJlbnRbY3VycmVudFN0YXJ0ICsgaiAtIDFdLCBvbGRbb2xkU3RhcnQgKyBpIC0gMV0pKVxuICAgICAgICAgICAgZGlzdGFuY2VzW2ldW2pdID0gZGlzdGFuY2VzW2kgLSAxXVtqIC0gMV07XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB2YXIgbm9ydGggPSBkaXN0YW5jZXNbaSAtIDFdW2pdICsgMTtcbiAgICAgICAgICAgIHZhciB3ZXN0ID0gZGlzdGFuY2VzW2ldW2ogLSAxXSArIDE7XG4gICAgICAgICAgICBkaXN0YW5jZXNbaV1bal0gPSBub3J0aCA8IHdlc3QgPyBub3J0aCA6IHdlc3Q7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBkaXN0YW5jZXM7XG4gICAgfSxcblxuICAgIC8vIFRoaXMgc3RhcnRzIGF0IHRoZSBmaW5hbCB3ZWlnaHQsIGFuZCB3YWxrcyBcImJhY2t3YXJkXCIgYnkgZmluZGluZ1xuICAgIC8vIHRoZSBtaW5pbXVtIHByZXZpb3VzIHdlaWdodCByZWN1cnNpdmVseSB1bnRpbCB0aGUgb3JpZ2luIG9mIHRoZSB3ZWlnaHRcbiAgICAvLyBtYXRyaXguXG4gICAgc3BsaWNlT3BlcmF0aW9uc0Zyb21FZGl0RGlzdGFuY2VzOiBmdW5jdGlvbihkaXN0YW5jZXMpIHtcbiAgICAgIHZhciBpID0gZGlzdGFuY2VzLmxlbmd0aCAtIDE7XG4gICAgICB2YXIgaiA9IGRpc3RhbmNlc1swXS5sZW5ndGggLSAxO1xuICAgICAgdmFyIGN1cnJlbnQgPSBkaXN0YW5jZXNbaV1bal07XG4gICAgICB2YXIgZWRpdHMgPSBbXTtcbiAgICAgIHdoaWxlIChpID4gMCB8fCBqID4gMCkge1xuICAgICAgICBpZiAoaSA9PSAwKSB7XG4gICAgICAgICAgZWRpdHMucHVzaChFRElUX0FERCk7XG4gICAgICAgICAgai0tO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChqID09IDApIHtcbiAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfREVMRVRFKTtcbiAgICAgICAgICBpLS07XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIG5vcnRoV2VzdCA9IGRpc3RhbmNlc1tpIC0gMV1baiAtIDFdO1xuICAgICAgICB2YXIgd2VzdCA9IGRpc3RhbmNlc1tpIC0gMV1bal07XG4gICAgICAgIHZhciBub3J0aCA9IGRpc3RhbmNlc1tpXVtqIC0gMV07XG5cbiAgICAgICAgdmFyIG1pbjtcbiAgICAgICAgaWYgKHdlc3QgPCBub3J0aClcbiAgICAgICAgICBtaW4gPSB3ZXN0IDwgbm9ydGhXZXN0ID8gd2VzdCA6IG5vcnRoV2VzdDtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIG1pbiA9IG5vcnRoIDwgbm9ydGhXZXN0ID8gbm9ydGggOiBub3J0aFdlc3Q7XG5cbiAgICAgICAgaWYgKG1pbiA9PSBub3J0aFdlc3QpIHtcbiAgICAgICAgICBpZiAobm9ydGhXZXN0ID09IGN1cnJlbnQpIHtcbiAgICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9MRUFWRSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9VUERBVEUpO1xuICAgICAgICAgICAgY3VycmVudCA9IG5vcnRoV2VzdDtcbiAgICAgICAgICB9XG4gICAgICAgICAgaS0tO1xuICAgICAgICAgIGotLTtcbiAgICAgICAgfSBlbHNlIGlmIChtaW4gPT0gd2VzdCkge1xuICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9ERUxFVEUpO1xuICAgICAgICAgIGktLTtcbiAgICAgICAgICBjdXJyZW50ID0gd2VzdDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfQUREKTtcbiAgICAgICAgICBqLS07XG4gICAgICAgICAgY3VycmVudCA9IG5vcnRoO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGVkaXRzLnJldmVyc2UoKTtcbiAgICAgIHJldHVybiBlZGl0cztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3BsaWNlIFByb2plY3Rpb24gZnVuY3Rpb25zOlxuICAgICAqXG4gICAgICogQSBzcGxpY2UgbWFwIGlzIGEgcmVwcmVzZW50YXRpb24gb2YgaG93IGEgcHJldmlvdXMgYXJyYXkgb2YgaXRlbXNcbiAgICAgKiB3YXMgdHJhbnNmb3JtZWQgaW50byBhIG5ldyBhcnJheSBvZiBpdGVtcy4gQ29uY2VwdHVhbGx5IGl0IGlzIGEgbGlzdCBvZlxuICAgICAqIHR1cGxlcyBvZlxuICAgICAqXG4gICAgICogICA8aW5kZXgsIHJlbW92ZWQsIGFkZGVkQ291bnQ+XG4gICAgICpcbiAgICAgKiB3aGljaCBhcmUga2VwdCBpbiBhc2NlbmRpbmcgaW5kZXggb3JkZXIgb2YuIFRoZSB0dXBsZSByZXByZXNlbnRzIHRoYXQgYXRcbiAgICAgKiB0aGUgfGluZGV4fCwgfHJlbW92ZWR8IHNlcXVlbmNlIG9mIGl0ZW1zIHdlcmUgcmVtb3ZlZCwgYW5kIGNvdW50aW5nIGZvcndhcmRcbiAgICAgKiBmcm9tIHxpbmRleHwsIHxhZGRlZENvdW50fCBpdGVtcyB3ZXJlIGFkZGVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogTGFja2luZyBpbmRpdmlkdWFsIHNwbGljZSBtdXRhdGlvbiBpbmZvcm1hdGlvbiwgdGhlIG1pbmltYWwgc2V0IG9mXG4gICAgICogc3BsaWNlcyBjYW4gYmUgc3ludGhlc2l6ZWQgZ2l2ZW4gdGhlIHByZXZpb3VzIHN0YXRlIGFuZCBmaW5hbCBzdGF0ZSBvZiBhblxuICAgICAqIGFycmF5LiBUaGUgYmFzaWMgYXBwcm9hY2ggaXMgdG8gY2FsY3VsYXRlIHRoZSBlZGl0IGRpc3RhbmNlIG1hdHJpeCBhbmRcbiAgICAgKiBjaG9vc2UgdGhlIHNob3J0ZXN0IHBhdGggdGhyb3VnaCBpdC5cbiAgICAgKlxuICAgICAqIENvbXBsZXhpdHk6IE8obCAqIHApXG4gICAgICogICBsOiBUaGUgbGVuZ3RoIG9mIHRoZSBjdXJyZW50IGFycmF5XG4gICAgICogICBwOiBUaGUgbGVuZ3RoIG9mIHRoZSBvbGQgYXJyYXlcbiAgICAgKi9cbiAgICBjYWxjU3BsaWNlczogZnVuY3Rpb24oY3VycmVudCwgY3VycmVudFN0YXJ0LCBjdXJyZW50RW5kLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBvbGQsIG9sZFN0YXJ0LCBvbGRFbmQpIHtcbiAgICAgIHZhciBwcmVmaXhDb3VudCA9IDA7XG4gICAgICB2YXIgc3VmZml4Q291bnQgPSAwO1xuXG4gICAgICB2YXIgbWluTGVuZ3RoID0gTWF0aC5taW4oY3VycmVudEVuZCAtIGN1cnJlbnRTdGFydCwgb2xkRW5kIC0gb2xkU3RhcnQpO1xuICAgICAgaWYgKGN1cnJlbnRTdGFydCA9PSAwICYmIG9sZFN0YXJ0ID09IDApXG4gICAgICAgIHByZWZpeENvdW50ID0gdGhpcy5zaGFyZWRQcmVmaXgoY3VycmVudCwgb2xkLCBtaW5MZW5ndGgpO1xuXG4gICAgICBpZiAoY3VycmVudEVuZCA9PSBjdXJyZW50Lmxlbmd0aCAmJiBvbGRFbmQgPT0gb2xkLmxlbmd0aClcbiAgICAgICAgc3VmZml4Q291bnQgPSB0aGlzLnNoYXJlZFN1ZmZpeChjdXJyZW50LCBvbGQsIG1pbkxlbmd0aCAtIHByZWZpeENvdW50KTtcblxuICAgICAgY3VycmVudFN0YXJ0ICs9IHByZWZpeENvdW50O1xuICAgICAgb2xkU3RhcnQgKz0gcHJlZml4Q291bnQ7XG4gICAgICBjdXJyZW50RW5kIC09IHN1ZmZpeENvdW50O1xuICAgICAgb2xkRW5kIC09IHN1ZmZpeENvdW50O1xuXG4gICAgICBpZiAoY3VycmVudEVuZCAtIGN1cnJlbnRTdGFydCA9PSAwICYmIG9sZEVuZCAtIG9sZFN0YXJ0ID09IDApXG4gICAgICAgIHJldHVybiBbXTtcblxuICAgICAgaWYgKGN1cnJlbnRTdGFydCA9PSBjdXJyZW50RW5kKSB7XG4gICAgICAgIHZhciBzcGxpY2UgPSBuZXdTcGxpY2UoY3VycmVudFN0YXJ0LCBbXSwgMCk7XG4gICAgICAgIHdoaWxlIChvbGRTdGFydCA8IG9sZEVuZClcbiAgICAgICAgICBzcGxpY2UucmVtb3ZlZC5wdXNoKG9sZFtvbGRTdGFydCsrXSk7XG5cbiAgICAgICAgcmV0dXJuIFsgc3BsaWNlIF07XG4gICAgICB9IGVsc2UgaWYgKG9sZFN0YXJ0ID09IG9sZEVuZClcbiAgICAgICAgcmV0dXJuIFsgbmV3U3BsaWNlKGN1cnJlbnRTdGFydCwgW10sIGN1cnJlbnRFbmQgLSBjdXJyZW50U3RhcnQpIF07XG5cbiAgICAgIHZhciBvcHMgPSB0aGlzLnNwbGljZU9wZXJhdGlvbnNGcm9tRWRpdERpc3RhbmNlcyhcbiAgICAgICAgICB0aGlzLmNhbGNFZGl0RGlzdGFuY2VzKGN1cnJlbnQsIGN1cnJlbnRTdGFydCwgY3VycmVudEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZCwgb2xkU3RhcnQsIG9sZEVuZCkpO1xuXG4gICAgICB2YXIgc3BsaWNlID0gdW5kZWZpbmVkO1xuICAgICAgdmFyIHNwbGljZXMgPSBbXTtcbiAgICAgIHZhciBpbmRleCA9IGN1cnJlbnRTdGFydDtcbiAgICAgIHZhciBvbGRJbmRleCA9IG9sZFN0YXJ0O1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgc3dpdGNoKG9wc1tpXSkge1xuICAgICAgICAgIGNhc2UgRURJVF9MRUFWRTpcbiAgICAgICAgICAgIGlmIChzcGxpY2UpIHtcbiAgICAgICAgICAgICAgc3BsaWNlcy5wdXNoKHNwbGljZSk7XG4gICAgICAgICAgICAgIHNwbGljZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaW5kZXgrKztcbiAgICAgICAgICAgIG9sZEluZGV4Kys7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIEVESVRfVVBEQVRFOlxuICAgICAgICAgICAgaWYgKCFzcGxpY2UpXG4gICAgICAgICAgICAgIHNwbGljZSA9IG5ld1NwbGljZShpbmRleCwgW10sIDApO1xuXG4gICAgICAgICAgICBzcGxpY2UuYWRkZWRDb3VudCsrO1xuICAgICAgICAgICAgaW5kZXgrKztcblxuICAgICAgICAgICAgc3BsaWNlLnJlbW92ZWQucHVzaChvbGRbb2xkSW5kZXhdKTtcbiAgICAgICAgICAgIG9sZEluZGV4Kys7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIEVESVRfQUREOlxuICAgICAgICAgICAgaWYgKCFzcGxpY2UpXG4gICAgICAgICAgICAgIHNwbGljZSA9IG5ld1NwbGljZShpbmRleCwgW10sIDApO1xuXG4gICAgICAgICAgICBzcGxpY2UuYWRkZWRDb3VudCsrO1xuICAgICAgICAgICAgaW5kZXgrKztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgRURJVF9ERUxFVEU6XG4gICAgICAgICAgICBpZiAoIXNwbGljZSlcbiAgICAgICAgICAgICAgc3BsaWNlID0gbmV3U3BsaWNlKGluZGV4LCBbXSwgMCk7XG5cbiAgICAgICAgICAgIHNwbGljZS5yZW1vdmVkLnB1c2gob2xkW29sZEluZGV4XSk7XG4gICAgICAgICAgICBvbGRJbmRleCsrO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHNwbGljZSkge1xuICAgICAgICBzcGxpY2VzLnB1c2goc3BsaWNlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzcGxpY2VzO1xuICAgIH0sXG5cbiAgICBzaGFyZWRQcmVmaXg6IGZ1bmN0aW9uKGN1cnJlbnQsIG9sZCwgc2VhcmNoTGVuZ3RoKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNlYXJjaExlbmd0aDsgaSsrKVxuICAgICAgICBpZiAoIXRoaXMuZXF1YWxzKGN1cnJlbnRbaV0sIG9sZFtpXSkpXG4gICAgICAgICAgcmV0dXJuIGk7XG4gICAgICByZXR1cm4gc2VhcmNoTGVuZ3RoO1xuICAgIH0sXG5cbiAgICBzaGFyZWRTdWZmaXg6IGZ1bmN0aW9uKGN1cnJlbnQsIG9sZCwgc2VhcmNoTGVuZ3RoKSB7XG4gICAgICB2YXIgaW5kZXgxID0gY3VycmVudC5sZW5ndGg7XG4gICAgICB2YXIgaW5kZXgyID0gb2xkLmxlbmd0aDtcbiAgICAgIHZhciBjb3VudCA9IDA7XG4gICAgICB3aGlsZSAoY291bnQgPCBzZWFyY2hMZW5ndGggJiYgdGhpcy5lcXVhbHMoY3VycmVudFstLWluZGV4MV0sIG9sZFstLWluZGV4Ml0pKVxuICAgICAgICBjb3VudCsrO1xuXG4gICAgICByZXR1cm4gY291bnQ7XG4gICAgfSxcblxuICAgIGNhbGN1bGF0ZVNwbGljZXM6IGZ1bmN0aW9uKGN1cnJlbnQsIHByZXZpb3VzKSB7XG4gICAgICByZXR1cm4gdGhpcy5jYWxjU3BsaWNlcyhjdXJyZW50LCAwLCBjdXJyZW50Lmxlbmd0aCwgcHJldmlvdXMsIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmV2aW91cy5sZW5ndGgpO1xuICAgIH0sXG5cbiAgICBlcXVhbHM6IGZ1bmN0aW9uKGN1cnJlbnRWYWx1ZSwgcHJldmlvdXNWYWx1ZSkge1xuICAgICAgcmV0dXJuIGN1cnJlbnRWYWx1ZSA9PT0gcHJldmlvdXNWYWx1ZTtcbiAgICB9XG4gIH07XG5cbiAgdmFyIGFycmF5U3BsaWNlID0gbmV3IEFycmF5U3BsaWNlKCk7XG5cbiAgZnVuY3Rpb24gY2FsY1NwbGljZXMoY3VycmVudCwgY3VycmVudFN0YXJ0LCBjdXJyZW50RW5kLFxuICAgICAgICAgICAgICAgICAgICAgICBvbGQsIG9sZFN0YXJ0LCBvbGRFbmQpIHtcbiAgICByZXR1cm4gYXJyYXlTcGxpY2UuY2FsY1NwbGljZXMoY3VycmVudCwgY3VycmVudFN0YXJ0LCBjdXJyZW50RW5kLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGQsIG9sZFN0YXJ0LCBvbGRFbmQpO1xuICB9XG5cbiAgZnVuY3Rpb24gaW50ZXJzZWN0KHN0YXJ0MSwgZW5kMSwgc3RhcnQyLCBlbmQyKSB7XG4gICAgLy8gRGlzam9pbnRcbiAgICBpZiAoZW5kMSA8IHN0YXJ0MiB8fCBlbmQyIDwgc3RhcnQxKVxuICAgICAgcmV0dXJuIC0xO1xuXG4gICAgLy8gQWRqYWNlbnRcbiAgICBpZiAoZW5kMSA9PSBzdGFydDIgfHwgZW5kMiA9PSBzdGFydDEpXG4gICAgICByZXR1cm4gMDtcblxuICAgIC8vIE5vbi16ZXJvIGludGVyc2VjdCwgc3BhbjEgZmlyc3RcbiAgICBpZiAoc3RhcnQxIDwgc3RhcnQyKSB7XG4gICAgICBpZiAoZW5kMSA8IGVuZDIpXG4gICAgICAgIHJldHVybiBlbmQxIC0gc3RhcnQyOyAvLyBPdmVybGFwXG4gICAgICBlbHNlXG4gICAgICAgIHJldHVybiBlbmQyIC0gc3RhcnQyOyAvLyBDb250YWluZWRcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTm9uLXplcm8gaW50ZXJzZWN0LCBzcGFuMiBmaXJzdFxuICAgICAgaWYgKGVuZDIgPCBlbmQxKVxuICAgICAgICByZXR1cm4gZW5kMiAtIHN0YXJ0MTsgLy8gT3ZlcmxhcFxuICAgICAgZWxzZVxuICAgICAgICByZXR1cm4gZW5kMSAtIHN0YXJ0MTsgLy8gQ29udGFpbmVkXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gbWVyZ2VTcGxpY2Uoc3BsaWNlcywgaW5kZXgsIHJlbW92ZWQsIGFkZGVkQ291bnQpIHtcblxuICAgIHZhciBzcGxpY2UgPSBuZXdTcGxpY2UoaW5kZXgsIHJlbW92ZWQsIGFkZGVkQ291bnQpO1xuXG4gICAgdmFyIGluc2VydGVkID0gZmFsc2U7XG4gICAgdmFyIGluc2VydGlvbk9mZnNldCA9IDA7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNwbGljZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBjdXJyZW50ID0gc3BsaWNlc1tpXTtcbiAgICAgIGN1cnJlbnQuaW5kZXggKz0gaW5zZXJ0aW9uT2Zmc2V0O1xuXG4gICAgICBpZiAoaW5zZXJ0ZWQpXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICB2YXIgaW50ZXJzZWN0Q291bnQgPSBpbnRlcnNlY3Qoc3BsaWNlLmluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNwbGljZS5pbmRleCArIHNwbGljZS5yZW1vdmVkLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50LmluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnQuaW5kZXggKyBjdXJyZW50LmFkZGVkQ291bnQpO1xuXG4gICAgICBpZiAoaW50ZXJzZWN0Q291bnQgPj0gMCkge1xuICAgICAgICAvLyBNZXJnZSB0aGUgdHdvIHNwbGljZXNcblxuICAgICAgICBzcGxpY2VzLnNwbGljZShpLCAxKTtcbiAgICAgICAgaS0tO1xuXG4gICAgICAgIGluc2VydGlvbk9mZnNldCAtPSBjdXJyZW50LmFkZGVkQ291bnQgLSBjdXJyZW50LnJlbW92ZWQubGVuZ3RoO1xuXG4gICAgICAgIHNwbGljZS5hZGRlZENvdW50ICs9IGN1cnJlbnQuYWRkZWRDb3VudCAtIGludGVyc2VjdENvdW50O1xuICAgICAgICB2YXIgZGVsZXRlQ291bnQgPSBzcGxpY2UucmVtb3ZlZC5sZW5ndGggK1xuICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50LnJlbW92ZWQubGVuZ3RoIC0gaW50ZXJzZWN0Q291bnQ7XG5cbiAgICAgICAgaWYgKCFzcGxpY2UuYWRkZWRDb3VudCAmJiAhZGVsZXRlQ291bnQpIHtcbiAgICAgICAgICAvLyBtZXJnZWQgc3BsaWNlIGlzIGEgbm9vcC4gZGlzY2FyZC5cbiAgICAgICAgICBpbnNlcnRlZCA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIHJlbW92ZWQgPSBjdXJyZW50LnJlbW92ZWQ7XG5cbiAgICAgICAgICBpZiAoc3BsaWNlLmluZGV4IDwgY3VycmVudC5pbmRleCkge1xuICAgICAgICAgICAgLy8gc29tZSBwcmVmaXggb2Ygc3BsaWNlLnJlbW92ZWQgaXMgcHJlcGVuZGVkIHRvIGN1cnJlbnQucmVtb3ZlZC5cbiAgICAgICAgICAgIHZhciBwcmVwZW5kID0gc3BsaWNlLnJlbW92ZWQuc2xpY2UoMCwgY3VycmVudC5pbmRleCAtIHNwbGljZS5pbmRleCk7XG4gICAgICAgICAgICBBcnJheS5wcm90b3R5cGUucHVzaC5hcHBseShwcmVwZW5kLCByZW1vdmVkKTtcbiAgICAgICAgICAgIHJlbW92ZWQgPSBwcmVwZW5kO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChzcGxpY2UuaW5kZXggKyBzcGxpY2UucmVtb3ZlZC5sZW5ndGggPiBjdXJyZW50LmluZGV4ICsgY3VycmVudC5hZGRlZENvdW50KSB7XG4gICAgICAgICAgICAvLyBzb21lIHN1ZmZpeCBvZiBzcGxpY2UucmVtb3ZlZCBpcyBhcHBlbmRlZCB0byBjdXJyZW50LnJlbW92ZWQuXG4gICAgICAgICAgICB2YXIgYXBwZW5kID0gc3BsaWNlLnJlbW92ZWQuc2xpY2UoY3VycmVudC5pbmRleCArIGN1cnJlbnQuYWRkZWRDb3VudCAtIHNwbGljZS5pbmRleCk7XG4gICAgICAgICAgICBBcnJheS5wcm90b3R5cGUucHVzaC5hcHBseShyZW1vdmVkLCBhcHBlbmQpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHNwbGljZS5yZW1vdmVkID0gcmVtb3ZlZDtcbiAgICAgICAgICBpZiAoY3VycmVudC5pbmRleCA8IHNwbGljZS5pbmRleCkge1xuICAgICAgICAgICAgc3BsaWNlLmluZGV4ID0gY3VycmVudC5pbmRleDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoc3BsaWNlLmluZGV4IDwgY3VycmVudC5pbmRleCkge1xuICAgICAgICAvLyBJbnNlcnQgc3BsaWNlIGhlcmUuXG5cbiAgICAgICAgaW5zZXJ0ZWQgPSB0cnVlO1xuXG4gICAgICAgIHNwbGljZXMuc3BsaWNlKGksIDAsIHNwbGljZSk7XG4gICAgICAgIGkrKztcblxuICAgICAgICB2YXIgb2Zmc2V0ID0gc3BsaWNlLmFkZGVkQ291bnQgLSBzcGxpY2UucmVtb3ZlZC5sZW5ndGhcbiAgICAgICAgY3VycmVudC5pbmRleCArPSBvZmZzZXQ7XG4gICAgICAgIGluc2VydGlvbk9mZnNldCArPSBvZmZzZXQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFpbnNlcnRlZClcbiAgICAgIHNwbGljZXMucHVzaChzcGxpY2UpO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlSW5pdGlhbFNwbGljZXMoYXJyYXksIGNoYW5nZVJlY29yZHMpIHtcbiAgICB2YXIgc3BsaWNlcyA9IFtdO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGFuZ2VSZWNvcmRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgcmVjb3JkID0gY2hhbmdlUmVjb3Jkc1tpXTtcbiAgICAgIHN3aXRjaChyZWNvcmQudHlwZSkge1xuICAgICAgICBjYXNlICdzcGxpY2UnOlxuICAgICAgICAgIG1lcmdlU3BsaWNlKHNwbGljZXMsIHJlY29yZC5pbmRleCwgcmVjb3JkLnJlbW92ZWQuc2xpY2UoKSwgcmVjb3JkLmFkZGVkQ291bnQpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdhZGQnOlxuICAgICAgICBjYXNlICd1cGRhdGUnOlxuICAgICAgICBjYXNlICdkZWxldGUnOlxuICAgICAgICAgIGlmICghaXNJbmRleChyZWNvcmQubmFtZSkpXG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB2YXIgaW5kZXggPSB0b051bWJlcihyZWNvcmQubmFtZSk7XG4gICAgICAgICAgaWYgKGluZGV4IDwgMClcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIG1lcmdlU3BsaWNlKHNwbGljZXMsIGluZGV4LCBbcmVjb3JkLm9sZFZhbHVlXSwgMSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgY29uc29sZS5lcnJvcignVW5leHBlY3RlZCByZWNvcmQgdHlwZTogJyArIEpTT04uc3RyaW5naWZ5KHJlY29yZCkpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBzcGxpY2VzO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJvamVjdEFycmF5U3BsaWNlcyhhcnJheSwgY2hhbmdlUmVjb3Jkcykge1xuICAgIHZhciBzcGxpY2VzID0gW107XG5cbiAgICBjcmVhdGVJbml0aWFsU3BsaWNlcyhhcnJheSwgY2hhbmdlUmVjb3JkcykuZm9yRWFjaChmdW5jdGlvbihzcGxpY2UpIHtcbiAgICAgIGlmIChzcGxpY2UuYWRkZWRDb3VudCA9PSAxICYmIHNwbGljZS5yZW1vdmVkLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgIGlmIChzcGxpY2UucmVtb3ZlZFswXSAhPT0gYXJyYXlbc3BsaWNlLmluZGV4XSlcbiAgICAgICAgICBzcGxpY2VzLnB1c2goc3BsaWNlKTtcblxuICAgICAgICByZXR1cm5cbiAgICAgIH07XG5cbiAgICAgIHNwbGljZXMgPSBzcGxpY2VzLmNvbmNhdChjYWxjU3BsaWNlcyhhcnJheSwgc3BsaWNlLmluZGV4LCBzcGxpY2UuaW5kZXggKyBzcGxpY2UuYWRkZWRDb3VudCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcGxpY2UucmVtb3ZlZCwgMCwgc3BsaWNlLnJlbW92ZWQubGVuZ3RoKSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gc3BsaWNlcztcbiAgfVxuXG4gLy8gRXhwb3J0IHRoZSBvYnNlcnZlLWpzIG9iamVjdCBmb3IgKipOb2RlLmpzKiosIHdpdGhcbi8vIGJhY2t3YXJkcy1jb21wYXRpYmlsaXR5IGZvciB0aGUgb2xkIGByZXF1aXJlKClgIEFQSS4gSWYgd2UncmUgaW5cbi8vIHRoZSBicm93c2VyLCBleHBvcnQgYXMgYSBnbG9iYWwgb2JqZWN0LlxudmFyIGV4cG9zZSA9IGdsb2JhbDtcbmlmICh0eXBlb2YgZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbmlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuZXhwb3NlID0gZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzO1xufVxuZXhwb3NlID0gZXhwb3J0cztcbn1cbmV4cG9zZS5PYnNlcnZlciA9IE9ic2VydmVyO1xuZXhwb3NlLk9ic2VydmVyLnJ1bkVPTV8gPSBydW5FT007XG5leHBvc2UuT2JzZXJ2ZXIub2JzZXJ2ZXJTZW50aW5lbF8gPSBvYnNlcnZlclNlbnRpbmVsOyAvLyBmb3IgdGVzdGluZy5cbmV4cG9zZS5PYnNlcnZlci5oYXNPYmplY3RPYnNlcnZlID0gaGFzT2JzZXJ2ZTtcbmV4cG9zZS5BcnJheU9ic2VydmVyID0gQXJyYXlPYnNlcnZlcjtcbmV4cG9zZS5BcnJheU9ic2VydmVyLmNhbGN1bGF0ZVNwbGljZXMgPSBmdW5jdGlvbihjdXJyZW50LCBwcmV2aW91cykge1xucmV0dXJuIGFycmF5U3BsaWNlLmNhbGN1bGF0ZVNwbGljZXMoY3VycmVudCwgcHJldmlvdXMpO1xufTtcbmV4cG9zZS5QbGF0Zm9ybSA9IGdsb2JhbC5QbGF0Zm9ybTtcbmV4cG9zZS5BcnJheVNwbGljZSA9IEFycmF5U3BsaWNlO1xuZXhwb3NlLk9iamVjdE9ic2VydmVyID0gT2JqZWN0T2JzZXJ2ZXI7XG59KSh0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJyAmJiBnbG9iYWwgJiYgdHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlID8gZ2xvYmFsIDogdGhpcyB8fCB3aW5kb3cpO1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlLmpzXG4gKiogbW9kdWxlIGlkID0gMjJcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG5cbmZ1bmN0aW9uIENvbmRpdGlvbihmbiwgbGF6eSkge1xuICBpZiAobGF6eSA9PT0gdW5kZWZpbmVkIHx8IGxhenkgPT09IG51bGwpIHtcbiAgICBsYXp5ID0gdHJ1ZTtcbiAgfVxuICBmbiA9IGZuIHx8IGZ1bmN0aW9uKGRvbmUpIHtcbiAgICBkb25lKCk7XG4gIH07XG5cbiAgdGhpcy5fcHJvbWlzZSA9IG5ldyB1dGlsLlByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgdGhpcy5mbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5leGVjdXRlZCA9IHRydWU7XG4gICAgICB2YXIgbnVtQ29tcGxldGUgPSAwO1xuICAgICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICAgIHZhciBlcnJvcnMgPSBbXTtcbiAgICAgIGlmICh1dGlsLmlzQXJyYXkoZm4pKSB7XG4gICAgICAgIHZhciBjaGVja0NvbXBsZXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKG51bUNvbXBsZXRlLmxlbmd0aCA9PSBmbi5sZW5ndGgpIHtcbiAgICAgICAgICAgIGlmIChlcnJvcnMubGVuZ3RoKSB0aGlzLl9wcm9taXNlLnJlamVjdChlcnJvcnMpO1xuICAgICAgICAgICAgZWxzZSB0aGlzLl9wcm9taXNlLnJlc29sdmUobnVsbCwgcmVzdWx0cyk7XG4gICAgICAgICAgfVxuICAgICAgICB9LmJpbmQodGhpcyk7XG5cbiAgICAgICAgZm4uZm9yRWFjaChmdW5jdGlvbihjb25kLCBpZHgpIHtcbiAgICAgICAgICBjb25kLnRoZW4oZnVuY3Rpb24ocmVzKSB7XG4gICAgICAgICAgICByZXN1bHRzW2lkeF0gPSByZXM7XG4gICAgICAgICAgICBudW1Db21wbGV0ZSsrO1xuICAgICAgICAgICAgY2hlY2tDb21wbGV0ZSgpO1xuICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgZXJyb3JzW2lkeF0gPSBlcnI7XG4gICAgICAgICAgICBudW1Db21wbGV0ZSsrO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBmbihmdW5jdGlvbihlcnIsIHJlcykge1xuICAgICAgICAgIGlmIChlcnIpIHJlamVjdChlcnIpO1xuICAgICAgICAgIGVsc2UgcmVzb2x2ZShyZXMpO1xuICAgICAgICB9LmJpbmQodGhpcykpXG4gICAgICB9XG4gICAgfVxuICB9LmJpbmQodGhpcykpO1xuXG4gIGlmICghbGF6eSkgdGhpcy5fZXhlY3V0ZSgpO1xuICB0aGlzLmV4ZWN1dGVkID0gZmFsc2U7XG59XG5cbkNvbmRpdGlvbi5wcm90b3R5cGUgPSB7XG4gIF9leGVjdXRlOiBmdW5jdGlvbigpIHtcbiAgICBpZiAoIXRoaXMuZXhlY3V0ZWQpIHRoaXMuZm4oKTtcbiAgfSxcbiAgdGhlbjogZnVuY3Rpb24oc3VjY2VzcywgZmFpbCkge1xuICAgIHRoaXMuX2V4ZWN1dGUoKTtcbiAgICByZXR1cm4gdGhpcy5fcHJvbWlzZS50aGVuKHN1Y2Nlc3MsIGZhaWwpO1xuICB9LFxuICBjYXRjaDogZnVuY3Rpb24oZmFpbCkge1xuICAgIHRoaXMuX2V4ZWN1dGUoKTtcbiAgICByZXR1cm4gdGhpcy5fcHJvbWlzZS5jYXRjaChmYWlsKTtcbiAgfSxcbiAgcmVzb2x2ZTogZnVuY3Rpb24gKHJlcykge1xuICAgIHRoaXMuZXhlY3V0ZWQgPSB0cnVlO1xuICAgIHRoaXMuX3Byb21pc2UucmVzb2x2ZShyZXMpO1xuICB9LFxuICByZWplY3Q6IGZ1bmN0aW9uIChlcnIpIHtcbiAgICB0aGlzLmV4ZWN1dGVkID0gdHJ1ZTtcbiAgICB0aGlzLl9wcm9taXNlLnJlamVjdChlcnIpO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENvbmRpdGlvbjtcblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9Db25kaXRpb24uanNcbiAqKiBtb2R1bGUgaWQgPSAyM1xuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuLyoqXG4gKiBBY3RzIGFzIGEgcGxhY2Vob2xkZXIgZm9yIHZhcmlvdXMgb2JqZWN0cyBlLmcuIGxhenkgcmVnaXN0cmF0aW9uIG9mIG1vZGVscy5cbiAqIEBwYXJhbSBbb3B0c11cbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBQbGFjZWhvbGRlcihvcHRzKSB7XG4gIHV0aWwuZXh0ZW5kKHRoaXMsIG9wdHMgfHwge30pO1xuICB0aGlzLmlzUGxhY2Vob2xkZXIgPSB0cnVlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFBsYWNlaG9sZGVyO1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL1BsYWNlaG9sZGVyLmpzXG4gKiogbW9kdWxlIGlkID0gMjRcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdtb2RlbCcpLFxuICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gIFJlbGF0aW9uc2hpcFR5cGUgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFR5cGUnKSxcbiAgUXVlcnkgPSByZXF1aXJlKCcuL1F1ZXJ5JyksXG4gIE1vZGVsSW5zdGFuY2UgPSByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKSxcbiAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICBndWlkID0gdXRpbC5ndWlkLFxuICBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKSxcbiAgZXh0ZW5kID0gcmVxdWlyZSgnZXh0ZW5kJyksXG4gIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICB3cmFwQXJyYXkgPSByZXF1aXJlKCcuL2V2ZW50cycpLndyYXBBcnJheSxcbiAgT25lVG9NYW55UHJveHkgPSByZXF1aXJlKCcuL09uZVRvTWFueVByb3h5JyksXG4gIE9uZVRvT25lUHJveHkgPSByZXF1aXJlKCcuL09uZVRvT25lUHJveHknKSxcbiAgTWFueVRvTWFueVByb3h5ID0gcmVxdWlyZSgnLi9NYW55VG9NYW55UHJveHknKSxcbiAgUmVhY3RpdmVRdWVyeSA9IHJlcXVpcmUoJy4vUmVhY3RpdmVRdWVyeScpLFxuICBNb2RlbEV2ZW50VHlwZSA9IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlO1xuXG5mdW5jdGlvbiBNb2RlbEluc3RhbmNlRmFjdG9yeShtb2RlbCkge1xuICB0aGlzLm1vZGVsID0gbW9kZWw7XG59XG5cbk1vZGVsSW5zdGFuY2VGYWN0b3J5LnByb3RvdHlwZSA9IHtcbiAgX2dldExvY2FsSWQ6IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICB2YXIgbG9jYWxJZDtcbiAgICBpZiAoZGF0YSkge1xuICAgICAgbG9jYWxJZCA9IGRhdGEubG9jYWxJZCA/IGRhdGEubG9jYWxJZCA6IGd1aWQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbG9jYWxJZCA9IGd1aWQoKTtcbiAgICB9XG4gICAgcmV0dXJuIGxvY2FsSWQ7XG4gIH0sXG4gIC8qKlxuICAgKiBDb25maWd1cmUgYXR0cmlidXRlc1xuICAgKiBAcGFyYW0gbW9kZWxJbnN0YW5jZVxuICAgKiBAcGFyYW0gZGF0YVxuICAgKiBAcHJpdmF0ZVxuICAgKi9cblxuICBfaW5zdGFsbEF0dHJpYnV0ZXM6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UsIGRhdGEpIHtcbiAgICB2YXIgTW9kZWwgPSB0aGlzLm1vZGVsLFxuICAgICAgYXR0cmlidXRlTmFtZXMgPSBNb2RlbC5fYXR0cmlidXRlTmFtZXMsXG4gICAgICBpZHggPSBhdHRyaWJ1dGVOYW1lcy5pbmRleE9mKE1vZGVsLmlkKTtcbiAgICB1dGlsLmV4dGVuZChtb2RlbEluc3RhbmNlLCB7XG4gICAgICBfX3ZhbHVlczogdXRpbC5leHRlbmQoTW9kZWwuYXR0cmlidXRlcy5yZWR1Y2UoZnVuY3Rpb24obSwgYSkge1xuICAgICAgICBpZiAoYS5kZWZhdWx0ICE9PSB1bmRlZmluZWQpIG1bYS5uYW1lXSA9IGEuZGVmYXVsdDtcbiAgICAgICAgcmV0dXJuIG07XG4gICAgICB9LCB7fSksIGRhdGEgfHwge30pXG4gICAgfSk7XG4gICAgaWYgKGlkeCA+IC0xKSBhdHRyaWJ1dGVOYW1lcy5zcGxpY2UoaWR4LCAxKTtcbiAgICBhdHRyaWJ1dGVOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uKGF0dHJpYnV0ZU5hbWUpIHtcbiAgICAgIHZhciBhdHRyaWJ1dGVEZWZpbml0aW9uID0gTW9kZWwuX2F0dHJpYnV0ZURlZmluaXRpb25XaXRoTmFtZShhdHRyaWJ1dGVOYW1lKTtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShtb2RlbEluc3RhbmNlLCBhdHRyaWJ1dGVOYW1lLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIHZhbHVlID0gbW9kZWxJbnN0YW5jZS5fX3ZhbHVlc1thdHRyaWJ1dGVOYW1lXTtcbiAgICAgICAgICByZXR1cm4gdmFsdWUgPT09IHVuZGVmaW5lZCA/IG51bGwgOiB2YWx1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbih2KSB7XG4gICAgICAgICAgaWYgKGF0dHJpYnV0ZURlZmluaXRpb24ucGFyc2UpIHtcbiAgICAgICAgICAgIHYgPSBhdHRyaWJ1dGVEZWZpbml0aW9uLnBhcnNlLmNhbGwobW9kZWxJbnN0YW5jZSwgdik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChNb2RlbC5wYXJzZUF0dHJpYnV0ZSkge1xuICAgICAgICAgICAgdiA9IE1vZGVsLnBhcnNlQXR0cmlidXRlLmNhbGwobW9kZWxJbnN0YW5jZSwgYXR0cmlidXRlTmFtZSwgdik7XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhciBvbGQgPSBtb2RlbEluc3RhbmNlLl9fdmFsdWVzW2F0dHJpYnV0ZU5hbWVdO1xuICAgICAgICAgIHZhciBwcm9wZXJ0eURlcGVuZGVuY2llcyA9IHRoaXMuX3Byb3BlcnR5RGVwZW5kZW5jaWVzW2F0dHJpYnV0ZU5hbWVdIHx8IFtdO1xuICAgICAgICAgIHByb3BlcnR5RGVwZW5kZW5jaWVzID0gcHJvcGVydHlEZXBlbmRlbmNpZXMubWFwKGZ1bmN0aW9uKGRlcGVuZGFudCkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgcHJvcDogZGVwZW5kYW50LFxuICAgICAgICAgICAgICBvbGQ6IHRoaXNbZGVwZW5kYW50XVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICAgICAgICBtb2RlbEluc3RhbmNlLl9fdmFsdWVzW2F0dHJpYnV0ZU5hbWVdID0gdjtcbiAgICAgICAgICBwcm9wZXJ0eURlcGVuZGVuY2llcy5mb3JFYWNoKGZ1bmN0aW9uKGRlcCkge1xuICAgICAgICAgICAgdmFyIHByb3BlcnR5TmFtZSA9IGRlcC5wcm9wO1xuICAgICAgICAgICAgdmFyIG5ld18gPSB0aGlzW3Byb3BlcnR5TmFtZV07XG4gICAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICAgICAgY29sbGVjdGlvbjogTW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgIG1vZGVsOiBNb2RlbC5uYW1lLFxuICAgICAgICAgICAgICBsb2NhbElkOiBtb2RlbEluc3RhbmNlLmxvY2FsSWQsXG4gICAgICAgICAgICAgIG5ldzogbmV3XyxcbiAgICAgICAgICAgICAgb2xkOiBkZXAub2xkLFxuICAgICAgICAgICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TZXQsXG4gICAgICAgICAgICAgIGZpZWxkOiBwcm9wZXJ0eU5hbWUsXG4gICAgICAgICAgICAgIG9iajogbW9kZWxJbnN0YW5jZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICB2YXIgZSA9IHtcbiAgICAgICAgICAgIGNvbGxlY3Rpb246IE1vZGVsLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgbW9kZWw6IE1vZGVsLm5hbWUsXG4gICAgICAgICAgICBsb2NhbElkOiBtb2RlbEluc3RhbmNlLmxvY2FsSWQsXG4gICAgICAgICAgICBuZXc6IHYsXG4gICAgICAgICAgICBvbGQ6IG9sZCxcbiAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNldCxcbiAgICAgICAgICAgIGZpZWxkOiBhdHRyaWJ1dGVOYW1lLFxuICAgICAgICAgICAgb2JqOiBtb2RlbEluc3RhbmNlXG4gICAgICAgICAgfTtcbiAgICAgICAgICB3aW5kb3cubGFzdEVtaXNzaW9uID0gZTtcbiAgICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KGUpO1xuICAgICAgICAgIGlmICh1dGlsLmlzQXJyYXkodikpIHtcbiAgICAgICAgICAgIHdyYXBBcnJheSh2LCBhdHRyaWJ1dGVOYW1lLCBtb2RlbEluc3RhbmNlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH0sXG4gIF9pbnN0YWxsTWV0aG9kczogZnVuY3Rpb24obW9kZWxJbnN0YW5jZSkge1xuICAgIHZhciBNb2RlbCA9IHRoaXMubW9kZWw7XG4gICAgT2JqZWN0LmtleXMoTW9kZWwubWV0aG9kcykuZm9yRWFjaChmdW5jdGlvbihtZXRob2ROYW1lKSB7XG4gICAgICBpZiAobW9kZWxJbnN0YW5jZVttZXRob2ROYW1lXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIG1vZGVsSW5zdGFuY2VbbWV0aG9kTmFtZV0gPSBNb2RlbC5tZXRob2RzW21ldGhvZE5hbWVdLmJpbmQobW9kZWxJbnN0YW5jZSk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgbG9nKCdBIG1ldGhvZCB3aXRoIG5hbWUgXCInICsgbWV0aG9kTmFtZSArICdcIiBhbHJlYWR5IGV4aXN0cy4gSWdub3JpbmcgaXQuJyk7XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgX2luc3RhbGxQcm9wZXJ0aWVzOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlKSB7XG4gICAgdmFyIF9wcm9wZXJ0eU5hbWVzID0gT2JqZWN0LmtleXModGhpcy5tb2RlbC5wcm9wZXJ0aWVzKSxcbiAgICAgIF9wcm9wZXJ0eURlcGVuZGVuY2llcyA9IHt9O1xuICAgIF9wcm9wZXJ0eU5hbWVzLmZvckVhY2goZnVuY3Rpb24ocHJvcE5hbWUpIHtcbiAgICAgIHZhciBwcm9wRGVmID0gdGhpcy5tb2RlbC5wcm9wZXJ0aWVzW3Byb3BOYW1lXTtcbiAgICAgIHZhciBkZXBlbmRlbmNpZXMgPSBwcm9wRGVmLmRlcGVuZGVuY2llcyB8fCBbXTtcbiAgICAgIGRlcGVuZGVuY2llcy5mb3JFYWNoKGZ1bmN0aW9uKGF0dHIpIHtcbiAgICAgICAgaWYgKCFfcHJvcGVydHlEZXBlbmRlbmNpZXNbYXR0cl0pIF9wcm9wZXJ0eURlcGVuZGVuY2llc1thdHRyXSA9IFtdO1xuICAgICAgICBfcHJvcGVydHlEZXBlbmRlbmNpZXNbYXR0cl0ucHVzaChwcm9wTmFtZSk7XG4gICAgICB9KTtcbiAgICAgIGRlbGV0ZSBwcm9wRGVmLmRlcGVuZGVuY2llcztcbiAgICAgIGlmIChtb2RlbEluc3RhbmNlW3Byb3BOYW1lXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShtb2RlbEluc3RhbmNlLCBwcm9wTmFtZSwgcHJvcERlZik7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgbG9nKCdBIHByb3BlcnR5L21ldGhvZCB3aXRoIG5hbWUgXCInICsgcHJvcE5hbWUgKyAnXCIgYWxyZWFkeSBleGlzdHMuIElnbm9yaW5nIGl0LicpO1xuICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICBtb2RlbEluc3RhbmNlLl9wcm9wZXJ0eURlcGVuZGVuY2llcyA9IF9wcm9wZXJ0eURlcGVuZGVuY2llcztcbiAgfSxcbiAgX2luc3RhbGxSZW1vdGVJZDogZnVuY3Rpb24obW9kZWxJbnN0YW5jZSkge1xuICAgIHZhciBNb2RlbCA9IHRoaXMubW9kZWw7XG4gICAgdmFyIGlkRmllbGQgPSBNb2RlbC5pZDtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobW9kZWxJbnN0YW5jZSwgaWRGaWVsZCwge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIG1vZGVsSW5zdGFuY2UuX192YWx1ZXNbTW9kZWwuaWRdIHx8IG51bGw7XG4gICAgICB9LFxuICAgICAgc2V0OiBmdW5jdGlvbih2KSB7XG4gICAgICAgIHZhciBvbGQgPSBtb2RlbEluc3RhbmNlW01vZGVsLmlkXTtcbiAgICAgICAgbW9kZWxJbnN0YW5jZS5fX3ZhbHVlc1tNb2RlbC5pZF0gPSB2O1xuICAgICAgICBtb2RlbEV2ZW50cy5lbWl0KHtcbiAgICAgICAgICBjb2xsZWN0aW9uOiBNb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICBtb2RlbDogTW9kZWwubmFtZSxcbiAgICAgICAgICBsb2NhbElkOiBtb2RlbEluc3RhbmNlLmxvY2FsSWQsXG4gICAgICAgICAgbmV3OiB2LFxuICAgICAgICAgIG9sZDogb2xkLFxuICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNldCxcbiAgICAgICAgICBmaWVsZDogTW9kZWwuaWQsXG4gICAgICAgICAgb2JqOiBtb2RlbEluc3RhbmNlXG4gICAgICAgIH0pO1xuICAgICAgICBjYWNoZS5yZW1vdGVJbnNlcnQobW9kZWxJbnN0YW5jZSwgdiwgb2xkKTtcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSk7XG4gIH0sXG4gIC8qKlxuICAgKiBAcGFyYW0gZGVmaW5pdGlvbiAtIERlZmluaXRpb24gb2YgYSByZWxhdGlvbnNoaXBcbiAgICogQHBhcmFtIG1vZGVsSW5zdGFuY2UgLSBJbnN0YW5jZSBvZiB3aGljaCB0byBpbnN0YWxsIHRoZSByZWxhdGlvbnNoaXAuXG4gICAqL1xuICBfaW5zdGFsbFJlbGF0aW9uc2hpcDogZnVuY3Rpb24oZGVmaW5pdGlvbiwgbW9kZWxJbnN0YW5jZSkge1xuICAgIHZhciBwcm94eTtcbiAgICB2YXIgdHlwZSA9IGRlZmluaXRpb24udHlwZTtcbiAgICBpZiAodHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvTWFueSkge1xuICAgICAgcHJveHkgPSBuZXcgT25lVG9NYW55UHJveHkoZGVmaW5pdGlvbik7XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5PbmVUb09uZSkge1xuICAgICAgcHJveHkgPSBuZXcgT25lVG9PbmVQcm94eShkZWZpbml0aW9uKTtcbiAgICB9XG4gICAgZWxzZSBpZiAodHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk1hbnlUb01hbnkpIHtcbiAgICAgIHByb3h5ID0gbmV3IE1hbnlUb01hbnlQcm94eShkZWZpbml0aW9uKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gc3VjaCByZWxhdGlvbnNoaXAgdHlwZTogJyArIHR5cGUpO1xuICAgIH1cbiAgICBwcm94eS5pbnN0YWxsKG1vZGVsSW5zdGFuY2UpO1xuICB9LFxuICBfaW5zdGFsbFJlbGF0aW9uc2hpcFByb3hpZXM6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UpIHtcbiAgICB2YXIgbW9kZWwgPSB0aGlzLm1vZGVsO1xuICAgIGZvciAodmFyIG5hbWUgaW4gbW9kZWwucmVsYXRpb25zaGlwcykge1xuICAgICAgaWYgKG1vZGVsLnJlbGF0aW9uc2hpcHMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgdmFyIGRlZmluaXRpb24gPSB1dGlsLmV4dGVuZCh7fSwgbW9kZWwucmVsYXRpb25zaGlwc1tuYW1lXSk7XG4gICAgICAgIHRoaXMuX2luc3RhbGxSZWxhdGlvbnNoaXAoZGVmaW5pdGlvbiwgbW9kZWxJbnN0YW5jZSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICBfcmVnaXN0ZXJJbnN0YW5jZTogZnVuY3Rpb24obW9kZWxJbnN0YW5jZSwgc2hvdWxkUmVnaXN0ZXJDaGFuZ2UpIHtcbiAgICBjYWNoZS5pbnNlcnQobW9kZWxJbnN0YW5jZSk7XG4gICAgc2hvdWxkUmVnaXN0ZXJDaGFuZ2UgPSBzaG91bGRSZWdpc3RlckNoYW5nZSA9PT0gdW5kZWZpbmVkID8gdHJ1ZSA6IHNob3VsZFJlZ2lzdGVyQ2hhbmdlO1xuICAgIGlmIChzaG91bGRSZWdpc3RlckNoYW5nZSkgbW9kZWxJbnN0YW5jZS5fZW1pdE5ldygpO1xuICB9LFxuICBfaW5zdGFsbExvY2FsSWQ6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UsIGRhdGEpIHtcbiAgICBtb2RlbEluc3RhbmNlLmxvY2FsSWQgPSB0aGlzLl9nZXRMb2NhbElkKGRhdGEpO1xuICB9LFxuICAvKipcbiAgICogQ29udmVydCByYXcgZGF0YSBpbnRvIGEgTW9kZWxJbnN0YW5jZVxuICAgKiBAcmV0dXJucyB7TW9kZWxJbnN0YW5jZX1cbiAgICovXG4gIF9pbnN0YW5jZTogZnVuY3Rpb24oZGF0YSwgc2hvdWxkUmVnaXN0ZXJDaGFuZ2UpIHtcbiAgICBpZiAoIXRoaXMubW9kZWwuX3JlbGF0aW9uc2hpcHNJbnN0YWxsZWQgfHwgIXRoaXMubW9kZWwuX3JldmVyc2VSZWxhdGlvbnNoaXBzSW5zdGFsbGVkKSB7XG4gICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTW9kZWwgbXVzdCBiZSBmdWxseSBpbnN0YWxsZWQgYmVmb3JlIGNyZWF0aW5nIGFueSBtb2RlbHMnKTtcbiAgICB9XG4gICAgdmFyIG1vZGVsSW5zdGFuY2UgPSBuZXcgTW9kZWxJbnN0YW5jZSh0aGlzLm1vZGVsKTtcbiAgICB0aGlzLl9pbnN0YWxsTG9jYWxJZChtb2RlbEluc3RhbmNlLCBkYXRhKTtcbiAgICB0aGlzLl9pbnN0YWxsQXR0cmlidXRlcyhtb2RlbEluc3RhbmNlLCBkYXRhKTtcbiAgICB0aGlzLl9pbnN0YWxsTWV0aG9kcyhtb2RlbEluc3RhbmNlKTtcbiAgICB0aGlzLl9pbnN0YWxsUHJvcGVydGllcyhtb2RlbEluc3RhbmNlKTtcbiAgICB0aGlzLl9pbnN0YWxsUmVtb3RlSWQobW9kZWxJbnN0YW5jZSk7XG4gICAgdGhpcy5faW5zdGFsbFJlbGF0aW9uc2hpcFByb3hpZXMobW9kZWxJbnN0YW5jZSk7XG4gICAgdGhpcy5fcmVnaXN0ZXJJbnN0YW5jZShtb2RlbEluc3RhbmNlLCBzaG91bGRSZWdpc3RlckNoYW5nZSk7XG4gICAgcmV0dXJuIG1vZGVsSW5zdGFuY2U7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTW9kZWxJbnN0YW5jZUZhY3Rvcnk7XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvaW5zdGFuY2VGYWN0b3J5LmpzXG4gKiogbW9kdWxlIGlkID0gMjVcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciBhcmdzYXJyYXkgPSByZXF1aXJlKCdhcmdzYXJyYXknKTtcblxuLyoqXG4gKiBDbGFzcyBmb3IgZmFjaWxpdGF0aW5nIFwiY2hhaW5lZFwiIGJlaGF2aW91ciBlLmc6XG4gKlxuICogdmFyIGNhbmNlbCA9IFVzZXJzXG4gKiAgLm9uKCduZXcnLCBmdW5jdGlvbiAodXNlcikge1xuICAgKiAgICAgLy8gLi4uXG4gICAqICAgfSlcbiAqICAucXVlcnkoeyRvcjoge2FnZV9fZ3RlOiAyMCwgYWdlX19sdGU6IDMwfX0pXG4gKiAgLm9uKCcqJywgZnVuY3Rpb24gKGNoYW5nZSkge1xuICAgKiAgICAgLy8gLi5cbiAgICogICB9KTtcbiAqXG4gKiBAcGFyYW0gb3B0c1xuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIENoYWluKG9wdHMpIHtcbiAgdGhpcy5vcHRzID0gb3B0cztcbn1cblxuQ2hhaW4ucHJvdG90eXBlID0ge1xuICAvKipcbiAgICogQ29uc3RydWN0IGEgbGluayBpbiB0aGUgY2hhaW4gb2YgY2FsbHMuXG4gICAqIEBwYXJhbSBvcHRzXG4gICAqIEBwYXJhbSBvcHRzLmZuXG4gICAqIEBwYXJhbSBvcHRzLnR5cGVcbiAgICovXG4gIF9oYW5kbGVyTGluazogZnVuY3Rpb24ob3B0cykge1xuICAgIHZhciBmaXJzdExpbms7XG4gICAgZmlyc3RMaW5rID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgdHlwID0gb3B0cy50eXBlO1xuICAgICAgaWYgKG9wdHMuZm4pXG4gICAgICAgIHRoaXMuX3JlbW92ZUxpc3RlbmVyKG9wdHMuZm4sIHR5cCk7XG4gICAgICBpZiAoZmlyc3RMaW5rLl9wYXJlbnRMaW5rKSBmaXJzdExpbmsuX3BhcmVudExpbmsoKTsgLy8gQ2FuY2VsIGxpc3RlbmVycyBhbGwgdGhlIHdheSB1cCB0aGUgY2hhaW4uXG4gICAgfS5iaW5kKHRoaXMpO1xuICAgIE9iamVjdC5rZXlzKHRoaXMub3B0cykuZm9yRWFjaChmdW5jdGlvbihwcm9wKSB7XG4gICAgICB2YXIgZnVuYyA9IHRoaXMub3B0c1twcm9wXTtcbiAgICAgIGZpcnN0TGlua1twcm9wXSA9IGFyZ3NhcnJheShmdW5jdGlvbihhcmdzKSB7XG4gICAgICAgIHZhciBsaW5rID0gZnVuYy5hcHBseShmdW5jLl9fc2llc3RhX2JvdW5kX29iamVjdCwgYXJncyk7XG4gICAgICAgIGxpbmsuX3BhcmVudExpbmsgPSBmaXJzdExpbms7XG4gICAgICAgIHJldHVybiBsaW5rO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICAgIGZpcnN0TGluay5fcGFyZW50TGluayA9IG51bGw7XG4gICAgcmV0dXJuIGZpcnN0TGluaztcbiAgfSxcbiAgLyoqXG4gICAqIENvbnN0cnVjdCBhIGxpbmsgaW4gdGhlIGNoYWluIG9mIGNhbGxzLlxuICAgKiBAcGFyYW0gb3B0c1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2xlYW5dXG4gICAqL1xuICBfbGluazogZnVuY3Rpb24ob3B0cywgY2xlYW4pIHtcbiAgICB2YXIgY2hhaW4gPSB0aGlzO1xuICAgIGNsZWFuID0gY2xlYW4gfHwgZnVuY3Rpb24oKSB7fTtcbiAgICB2YXIgbGluaztcbiAgICBsaW5rID0gZnVuY3Rpb24oKSB7XG4gICAgICBjbGVhbigpO1xuICAgICAgaWYgKGxpbmsuX3BhcmVudExpbmspIGxpbmsuX3BhcmVudExpbmsoKTsgLy8gQ2FuY2VsIGxpc3RlbmVycyBhbGwgdGhlIHdheSB1cCB0aGUgY2hhaW4uXG4gICAgfS5iaW5kKHRoaXMpO1xuICAgIGxpbmsuX19zaWVzdGFfaXNMaW5rID0gdHJ1ZTtcbiAgICBsaW5rLm9wdHMgPSBvcHRzO1xuICAgIGxpbmsuY2xlYW4gPSBjbGVhbjtcbiAgICBPYmplY3Qua2V5cyhvcHRzKS5mb3JFYWNoKGZ1bmN0aW9uKHByb3ApIHtcbiAgICAgIHZhciBmdW5jID0gb3B0c1twcm9wXTtcbiAgICAgIGxpbmtbcHJvcF0gPSBhcmdzYXJyYXkoZnVuY3Rpb24oYXJncykge1xuICAgICAgICB2YXIgcG9zc2libGVMaW5rID0gZnVuYy5hcHBseShmdW5jLl9fc2llc3RhX2JvdW5kX29iamVjdCwgYXJncyk7XG4gICAgICAgIGlmICghcG9zc2libGVMaW5rIHx8ICFwb3NzaWJsZUxpbmsuX19zaWVzdGFfaXNMaW5rKSB7IC8vIFBhdGNoIGluIGEgbGluayBpbiB0aGUgY2hhaW4gdG8gYXZvaWQgaXQgYmVpbmcgYnJva2VuLCBiYXNpbmcgb2ZmIHRoZSBjdXJyZW50IGxpbmtcbiAgICAgICAgICBuZXh0TGluayA9IGNoYWluLl9saW5rKGxpbmsub3B0cyk7XG4gICAgICAgICAgZm9yICh2YXIgcHJvcCBpbiBwb3NzaWJsZUxpbmspIHtcbiAgICAgICAgICAgIC8vbm9pbnNwZWN0aW9uIEpTVW5maWx0ZXJlZEZvckluTG9vcFxuICAgICAgICAgICAgaWYgKHBvc3NpYmxlTGlua1twcm9wXSBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICAgICAgICAgIC8vbm9pbnNwZWN0aW9uIEpTVW5maWx0ZXJlZEZvckluTG9vcFxuICAgICAgICAgICAgICBuZXh0TGlua1twcm9wXSA9IHBvc3NpYmxlTGlua1twcm9wXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgdmFyIG5leHRMaW5rID0gcG9zc2libGVMaW5rO1xuICAgICAgICB9XG4gICAgICAgIG5leHRMaW5rLl9wYXJlbnRMaW5rID0gbGluaztcbiAgICAgICAgLy8gSW5oZXJpdCBtZXRob2RzIGZyb20gdGhlIHBhcmVudCBsaW5rIGlmIHRob3NlIG1ldGhvZHMgZG9uJ3QgYWxyZWFkeSBleGlzdC5cbiAgICAgICAgZm9yIChwcm9wIGluIGxpbmspIHtcbiAgICAgICAgICBpZiAobGlua1twcm9wXSBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICAgICAgICBuZXh0TGlua1twcm9wXSA9IGxpbmtbcHJvcF0uYmluZChsaW5rKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5leHRMaW5rO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICAgIGxpbmsuX3BhcmVudExpbmsgPSBudWxsO1xuICAgIHJldHVybiBsaW5rO1xuICB9XG59O1xubW9kdWxlLmV4cG9ydHMgPSBDaGFpbjtcblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9DaGFpbi5qc1xuICoqIG1vZHVsZSBpZCA9IDI2XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJcbi8qKlxuICogVGhpcyBpcyB0aGUgd2ViIGJyb3dzZXIgaW1wbGVtZW50YXRpb24gb2YgYGRlYnVnKClgLlxuICpcbiAqIEV4cG9zZSBgZGVidWcoKWAgYXMgdGhlIG1vZHVsZS5cbiAqL1xuXG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2RlYnVnJyk7XG5leHBvcnRzLmxvZyA9IGxvZztcbmV4cG9ydHMuZm9ybWF0QXJncyA9IGZvcm1hdEFyZ3M7XG5leHBvcnRzLnNhdmUgPSBzYXZlO1xuZXhwb3J0cy5sb2FkID0gbG9hZDtcbmV4cG9ydHMudXNlQ29sb3JzID0gdXNlQ29sb3JzO1xuXG4vKipcbiAqIFVzZSBjaHJvbWUuc3RvcmFnZS5sb2NhbCBpZiB3ZSBhcmUgaW4gYW4gYXBwXG4gKi9cblxudmFyIHN0b3JhZ2U7XG5cbmlmICh0eXBlb2YgY2hyb21lICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgY2hyb21lLnN0b3JhZ2UgIT09ICd1bmRlZmluZWQnKVxuICBzdG9yYWdlID0gY2hyb21lLnN0b3JhZ2UubG9jYWw7XG5lbHNlXG4gIHN0b3JhZ2UgPSB3aW5kb3cubG9jYWxTdG9yYWdlO1xuXG4vKipcbiAqIENvbG9ycy5cbiAqL1xuXG5leHBvcnRzLmNvbG9ycyA9IFtcbiAgJ2xpZ2h0c2VhZ3JlZW4nLFxuICAnZm9yZXN0Z3JlZW4nLFxuICAnZ29sZGVucm9kJyxcbiAgJ2RvZGdlcmJsdWUnLFxuICAnZGFya29yY2hpZCcsXG4gICdjcmltc29uJ1xuXTtcblxuLyoqXG4gKiBDdXJyZW50bHkgb25seSBXZWJLaXQtYmFzZWQgV2ViIEluc3BlY3RvcnMsIEZpcmVmb3ggPj0gdjMxLFxuICogYW5kIHRoZSBGaXJlYnVnIGV4dGVuc2lvbiAoYW55IEZpcmVmb3ggdmVyc2lvbikgYXJlIGtub3duXG4gKiB0byBzdXBwb3J0IFwiJWNcIiBDU1MgY3VzdG9taXphdGlvbnMuXG4gKlxuICogVE9ETzogYWRkIGEgYGxvY2FsU3RvcmFnZWAgdmFyaWFibGUgdG8gZXhwbGljaXRseSBlbmFibGUvZGlzYWJsZSBjb2xvcnNcbiAqL1xuXG5mdW5jdGlvbiB1c2VDb2xvcnMoKSB7XG4gIC8vIGlzIHdlYmtpdD8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMTY0NTk2MDYvMzc2NzczXG4gIHJldHVybiAoJ1dlYmtpdEFwcGVhcmFuY2UnIGluIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZSkgfHxcbiAgICAvLyBpcyBmaXJlYnVnPyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8zOTgxMjAvMzc2NzczXG4gICAgKHdpbmRvdy5jb25zb2xlICYmIChjb25zb2xlLmZpcmVidWcgfHwgKGNvbnNvbGUuZXhjZXB0aW9uICYmIGNvbnNvbGUudGFibGUpKSkgfHxcbiAgICAvLyBpcyBmaXJlZm94ID49IHYzMT9cbiAgICAvLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1Rvb2xzL1dlYl9Db25zb2xlI1N0eWxpbmdfbWVzc2FnZXNcbiAgICAobmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLm1hdGNoKC9maXJlZm94XFwvKFxcZCspLykgJiYgcGFyc2VJbnQoUmVnRXhwLiQxLCAxMCkgPj0gMzEpO1xufVxuXG4vKipcbiAqIE1hcCAlaiB0byBgSlNPTi5zdHJpbmdpZnkoKWAsIHNpbmNlIG5vIFdlYiBJbnNwZWN0b3JzIGRvIHRoYXQgYnkgZGVmYXVsdC5cbiAqL1xuXG5leHBvcnRzLmZvcm1hdHRlcnMuaiA9IGZ1bmN0aW9uKHYpIHtcbiAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHYpO1xufTtcblxuXG4vKipcbiAqIENvbG9yaXplIGxvZyBhcmd1bWVudHMgaWYgZW5hYmxlZC5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGZvcm1hdEFyZ3MoKSB7XG4gIHZhciBhcmdzID0gYXJndW1lbnRzO1xuICB2YXIgdXNlQ29sb3JzID0gdGhpcy51c2VDb2xvcnM7XG5cbiAgYXJnc1swXSA9ICh1c2VDb2xvcnMgPyAnJWMnIDogJycpXG4gICAgKyB0aGlzLm5hbWVzcGFjZVxuICAgICsgKHVzZUNvbG9ycyA/ICcgJWMnIDogJyAnKVxuICAgICsgYXJnc1swXVxuICAgICsgKHVzZUNvbG9ycyA/ICclYyAnIDogJyAnKVxuICAgICsgJysnICsgZXhwb3J0cy5odW1hbml6ZSh0aGlzLmRpZmYpO1xuXG4gIGlmICghdXNlQ29sb3JzKSByZXR1cm4gYXJncztcblxuICB2YXIgYyA9ICdjb2xvcjogJyArIHRoaXMuY29sb3I7XG4gIGFyZ3MgPSBbYXJnc1swXSwgYywgJ2NvbG9yOiBpbmhlcml0J10uY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3MsIDEpKTtcblxuICAvLyB0aGUgZmluYWwgXCIlY1wiIGlzIHNvbWV3aGF0IHRyaWNreSwgYmVjYXVzZSB0aGVyZSBjb3VsZCBiZSBvdGhlclxuICAvLyBhcmd1bWVudHMgcGFzc2VkIGVpdGhlciBiZWZvcmUgb3IgYWZ0ZXIgdGhlICVjLCBzbyB3ZSBuZWVkIHRvXG4gIC8vIGZpZ3VyZSBvdXQgdGhlIGNvcnJlY3QgaW5kZXggdG8gaW5zZXJ0IHRoZSBDU1MgaW50b1xuICB2YXIgaW5kZXggPSAwO1xuICB2YXIgbGFzdEMgPSAwO1xuICBhcmdzWzBdLnJlcGxhY2UoLyVbYS16JV0vZywgZnVuY3Rpb24obWF0Y2gpIHtcbiAgICBpZiAoJyUlJyA9PT0gbWF0Y2gpIHJldHVybjtcbiAgICBpbmRleCsrO1xuICAgIGlmICgnJWMnID09PSBtYXRjaCkge1xuICAgICAgLy8gd2Ugb25seSBhcmUgaW50ZXJlc3RlZCBpbiB0aGUgKmxhc3QqICVjXG4gICAgICAvLyAodGhlIHVzZXIgbWF5IGhhdmUgcHJvdmlkZWQgdGhlaXIgb3duKVxuICAgICAgbGFzdEMgPSBpbmRleDtcbiAgICB9XG4gIH0pO1xuXG4gIGFyZ3Muc3BsaWNlKGxhc3RDLCAwLCBjKTtcbiAgcmV0dXJuIGFyZ3M7XG59XG5cbi8qKlxuICogSW52b2tlcyBgY29uc29sZS5sb2coKWAgd2hlbiBhdmFpbGFibGUuXG4gKiBOby1vcCB3aGVuIGBjb25zb2xlLmxvZ2AgaXMgbm90IGEgXCJmdW5jdGlvblwiLlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gbG9nKCkge1xuICAvLyB0aGlzIGhhY2tlcnkgaXMgcmVxdWlyZWQgZm9yIElFOC85LCB3aGVyZVxuICAvLyB0aGUgYGNvbnNvbGUubG9nYCBmdW5jdGlvbiBkb2Vzbid0IGhhdmUgJ2FwcGx5J1xuICByZXR1cm4gJ29iamVjdCcgPT09IHR5cGVvZiBjb25zb2xlXG4gICAgJiYgY29uc29sZS5sb2dcbiAgICAmJiBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHkuY2FsbChjb25zb2xlLmxvZywgY29uc29sZSwgYXJndW1lbnRzKTtcbn1cblxuLyoqXG4gKiBTYXZlIGBuYW1lc3BhY2VzYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlc1xuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gc2F2ZShuYW1lc3BhY2VzKSB7XG4gIHRyeSB7XG4gICAgaWYgKG51bGwgPT0gbmFtZXNwYWNlcykge1xuICAgICAgc3RvcmFnZS5yZW1vdmVJdGVtKCdkZWJ1ZycpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdG9yYWdlLmRlYnVnID0gbmFtZXNwYWNlcztcbiAgICB9XG4gIH0gY2F0Y2goZSkge31cbn1cblxuLyoqXG4gKiBMb2FkIGBuYW1lc3BhY2VzYC5cbiAqXG4gKiBAcmV0dXJuIHtTdHJpbmd9IHJldHVybnMgdGhlIHByZXZpb3VzbHkgcGVyc2lzdGVkIGRlYnVnIG1vZGVzXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBsb2FkKCkge1xuICB2YXIgcjtcbiAgdHJ5IHtcbiAgICByID0gc3RvcmFnZS5kZWJ1ZztcbiAgfSBjYXRjaChlKSB7fVxuICByZXR1cm4gcjtcbn1cblxuLyoqXG4gKiBFbmFibGUgbmFtZXNwYWNlcyBsaXN0ZWQgaW4gYGxvY2FsU3RvcmFnZS5kZWJ1Z2AgaW5pdGlhbGx5LlxuICovXG5cbmV4cG9ydHMuZW5hYmxlKGxvYWQoKSk7XG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vfi9kZWJ1Zy9icm93c2VyLmpzXG4gKiogbW9kdWxlIGlkID0gMjdcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBhcmdzQXJyYXk7XG5cbmZ1bmN0aW9uIGFyZ3NBcnJheShmdW4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBpZiAobGVuKSB7XG4gICAgICB2YXIgYXJncyA9IFtdO1xuICAgICAgdmFyIGkgPSAtMTtcbiAgICAgIHdoaWxlICgrK2kgPCBsZW4pIHtcbiAgICAgICAgYXJnc1tpXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmdW4uY2FsbCh0aGlzLCBhcmdzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGZ1bi5jYWxsKHRoaXMsIFtdKTtcbiAgICB9XG4gIH07XG59XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL34vYXJnc2FycmF5L2luZGV4LmpzXG4gKiogbW9kdWxlIGlkID0gMjhcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciBuZXh0VGljayA9IHJlcXVpcmUoJ3Byb2Nlc3MvYnJvd3Nlci5qcycpLm5leHRUaWNrO1xudmFyIGFwcGx5ID0gRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5O1xudmFyIHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xudmFyIGltbWVkaWF0ZUlkcyA9IHt9O1xudmFyIG5leHRJbW1lZGlhdGVJZCA9IDA7XG5cbi8vIERPTSBBUElzLCBmb3IgY29tcGxldGVuZXNzXG5cbmV4cG9ydHMuc2V0VGltZW91dCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gbmV3IFRpbWVvdXQoYXBwbHkuY2FsbChzZXRUaW1lb3V0LCB3aW5kb3csIGFyZ3VtZW50cyksIGNsZWFyVGltZW91dCk7XG59O1xuZXhwb3J0cy5zZXRJbnRlcnZhbCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gbmV3IFRpbWVvdXQoYXBwbHkuY2FsbChzZXRJbnRlcnZhbCwgd2luZG93LCBhcmd1bWVudHMpLCBjbGVhckludGVydmFsKTtcbn07XG5leHBvcnRzLmNsZWFyVGltZW91dCA9XG5leHBvcnRzLmNsZWFySW50ZXJ2YWwgPSBmdW5jdGlvbih0aW1lb3V0KSB7IHRpbWVvdXQuY2xvc2UoKTsgfTtcblxuZnVuY3Rpb24gVGltZW91dChpZCwgY2xlYXJGbikge1xuICB0aGlzLl9pZCA9IGlkO1xuICB0aGlzLl9jbGVhckZuID0gY2xlYXJGbjtcbn1cblRpbWVvdXQucHJvdG90eXBlLnVucmVmID0gVGltZW91dC5wcm90b3R5cGUucmVmID0gZnVuY3Rpb24oKSB7fTtcblRpbWVvdXQucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuX2NsZWFyRm4uY2FsbCh3aW5kb3csIHRoaXMuX2lkKTtcbn07XG5cbi8vIERvZXMgbm90IHN0YXJ0IHRoZSB0aW1lLCBqdXN0IHNldHMgdXAgdGhlIG1lbWJlcnMgbmVlZGVkLlxuZXhwb3J0cy5lbnJvbGwgPSBmdW5jdGlvbihpdGVtLCBtc2Vjcykge1xuICBjbGVhclRpbWVvdXQoaXRlbS5faWRsZVRpbWVvdXRJZCk7XG4gIGl0ZW0uX2lkbGVUaW1lb3V0ID0gbXNlY3M7XG59O1xuXG5leHBvcnRzLnVuZW5yb2xsID0gZnVuY3Rpb24oaXRlbSkge1xuICBjbGVhclRpbWVvdXQoaXRlbS5faWRsZVRpbWVvdXRJZCk7XG4gIGl0ZW0uX2lkbGVUaW1lb3V0ID0gLTE7XG59O1xuXG5leHBvcnRzLl91bnJlZkFjdGl2ZSA9IGV4cG9ydHMuYWN0aXZlID0gZnVuY3Rpb24oaXRlbSkge1xuICBjbGVhclRpbWVvdXQoaXRlbS5faWRsZVRpbWVvdXRJZCk7XG5cbiAgdmFyIG1zZWNzID0gaXRlbS5faWRsZVRpbWVvdXQ7XG4gIGlmIChtc2VjcyA+PSAwKSB7XG4gICAgaXRlbS5faWRsZVRpbWVvdXRJZCA9IHNldFRpbWVvdXQoZnVuY3Rpb24gb25UaW1lb3V0KCkge1xuICAgICAgaWYgKGl0ZW0uX29uVGltZW91dClcbiAgICAgICAgaXRlbS5fb25UaW1lb3V0KCk7XG4gICAgfSwgbXNlY3MpO1xuICB9XG59O1xuXG4vLyBUaGF0J3Mgbm90IGhvdyBub2RlLmpzIGltcGxlbWVudHMgaXQgYnV0IHRoZSBleHBvc2VkIGFwaSBpcyB0aGUgc2FtZS5cbmV4cG9ydHMuc2V0SW1tZWRpYXRlID0gdHlwZW9mIHNldEltbWVkaWF0ZSA9PT0gXCJmdW5jdGlvblwiID8gc2V0SW1tZWRpYXRlIDogZnVuY3Rpb24oZm4pIHtcbiAgdmFyIGlkID0gbmV4dEltbWVkaWF0ZUlkKys7XG4gIHZhciBhcmdzID0gYXJndW1lbnRzLmxlbmd0aCA8IDIgPyBmYWxzZSA6IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcblxuICBpbW1lZGlhdGVJZHNbaWRdID0gdHJ1ZTtcblxuICBuZXh0VGljayhmdW5jdGlvbiBvbk5leHRUaWNrKCkge1xuICAgIGlmIChpbW1lZGlhdGVJZHNbaWRdKSB7XG4gICAgICAvLyBmbi5jYWxsKCkgaXMgZmFzdGVyIHNvIHdlIG9wdGltaXplIGZvciB0aGUgY29tbW9uIHVzZS1jYXNlXG4gICAgICAvLyBAc2VlIGh0dHA6Ly9qc3BlcmYuY29tL2NhbGwtYXBwbHktc2VndVxuICAgICAgaWYgKGFyZ3MpIHtcbiAgICAgICAgZm4uYXBwbHkobnVsbCwgYXJncyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmbi5jYWxsKG51bGwpO1xuICAgICAgfVxuICAgICAgLy8gUHJldmVudCBpZHMgZnJvbSBsZWFraW5nXG4gICAgICBleHBvcnRzLmNsZWFySW1tZWRpYXRlKGlkKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBpZDtcbn07XG5cbmV4cG9ydHMuY2xlYXJJbW1lZGlhdGUgPSB0eXBlb2YgY2xlYXJJbW1lZGlhdGUgPT09IFwiZnVuY3Rpb25cIiA/IGNsZWFySW1tZWRpYXRlIDogZnVuY3Rpb24oaWQpIHtcbiAgZGVsZXRlIGltbWVkaWF0ZUlkc1tpZF07XG59O1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogKHdlYnBhY2spL34vbm9kZS1saWJzLWJyb3dzZXIvfi90aW1lcnMtYnJvd3NlcmlmeS9tYWluLmpzXG4gKiogbW9kdWxlIGlkID0gMjlcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogKHdlYnBhY2spL34vbm9kZS1saWJzLWJyb3dzZXIvfi9ldmVudHMvZXZlbnRzLmpzXG4gKiogbW9kdWxlIGlkID0gMzBcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIiFmdW5jdGlvbihlKXtpZihcIm9iamVjdFwiPT10eXBlb2YgZXhwb3J0cyYmXCJ1bmRlZmluZWRcIiE9dHlwZW9mIG1vZHVsZSltb2R1bGUuZXhwb3J0cz1lKCk7ZWxzZSBpZihcImZ1bmN0aW9uXCI9PXR5cGVvZiBkZWZpbmUmJmRlZmluZS5hbWQpZGVmaW5lKFtdLGUpO2Vsc2V7dmFyIGY7XCJ1bmRlZmluZWRcIiE9dHlwZW9mIHdpbmRvdz9mPXdpbmRvdzpcInVuZGVmaW5lZFwiIT10eXBlb2YgZ2xvYmFsP2Y9Z2xvYmFsOlwidW5kZWZpbmVkXCIhPXR5cGVvZiBzZWxmJiYoZj1zZWxmKSxmLlByb21pc2U9ZSgpfX0oZnVuY3Rpb24oKXt2YXIgZGVmaW5lLG1vZHVsZSxleHBvcnRzO3JldHVybiAoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSh7MTpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4ndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gSU5URVJOQUw7XG5cbmZ1bmN0aW9uIElOVEVSTkFMKCkge31cbn0se31dLDI6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xuJ3VzZSBzdHJpY3QnO1xudmFyIFByb21pc2UgPSBfZGVyZXFfKCcuL3Byb21pc2UnKTtcbnZhciByZWplY3QgPSBfZGVyZXFfKCcuL3JlamVjdCcpO1xudmFyIHJlc29sdmUgPSBfZGVyZXFfKCcuL3Jlc29sdmUnKTtcbnZhciBJTlRFUk5BTCA9IF9kZXJlcV8oJy4vSU5URVJOQUwnKTtcbnZhciBoYW5kbGVycyA9IF9kZXJlcV8oJy4vaGFuZGxlcnMnKTtcbm1vZHVsZS5leHBvcnRzID0gYWxsO1xuZnVuY3Rpb24gYWxsKGl0ZXJhYmxlKSB7XG4gIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoaXRlcmFibGUpICE9PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgcmV0dXJuIHJlamVjdChuZXcgVHlwZUVycm9yKCdtdXN0IGJlIGFuIGFycmF5JykpO1xuICB9XG5cbiAgdmFyIGxlbiA9IGl0ZXJhYmxlLmxlbmd0aDtcbiAgdmFyIGNhbGxlZCA9IGZhbHNlO1xuICBpZiAoIWxlbikge1xuICAgIHJldHVybiByZXNvbHZlKFtdKTtcbiAgfVxuXG4gIHZhciB2YWx1ZXMgPSBuZXcgQXJyYXkobGVuKTtcbiAgdmFyIHJlc29sdmVkID0gMDtcbiAgdmFyIGkgPSAtMTtcbiAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShJTlRFUk5BTCk7XG4gIFxuICB3aGlsZSAoKytpIDwgbGVuKSB7XG4gICAgYWxsUmVzb2x2ZXIoaXRlcmFibGVbaV0sIGkpO1xuICB9XG4gIHJldHVybiBwcm9taXNlO1xuICBmdW5jdGlvbiBhbGxSZXNvbHZlcih2YWx1ZSwgaSkge1xuICAgIHJlc29sdmUodmFsdWUpLnRoZW4ocmVzb2x2ZUZyb21BbGwsIGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgaWYgKCFjYWxsZWQpIHtcbiAgICAgICAgY2FsbGVkID0gdHJ1ZTtcbiAgICAgICAgaGFuZGxlcnMucmVqZWN0KHByb21pc2UsIGVycm9yKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBmdW5jdGlvbiByZXNvbHZlRnJvbUFsbChvdXRWYWx1ZSkge1xuICAgICAgdmFsdWVzW2ldID0gb3V0VmFsdWU7XG4gICAgICBpZiAoKytyZXNvbHZlZCA9PT0gbGVuICYgIWNhbGxlZCkge1xuICAgICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgICBoYW5kbGVycy5yZXNvbHZlKHByb21pc2UsIHZhbHVlcyk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG59LHtcIi4vSU5URVJOQUxcIjoxLFwiLi9oYW5kbGVyc1wiOjMsXCIuL3Byb21pc2VcIjo1LFwiLi9yZWplY3RcIjo4LFwiLi9yZXNvbHZlXCI6OX1dLDM6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xuJ3VzZSBzdHJpY3QnO1xudmFyIHRyeUNhdGNoID0gX2RlcmVxXygnLi90cnlDYXRjaCcpO1xudmFyIHJlc29sdmVUaGVuYWJsZSA9IF9kZXJlcV8oJy4vcmVzb2x2ZVRoZW5hYmxlJyk7XG52YXIgc3RhdGVzID0gX2RlcmVxXygnLi9zdGF0ZXMnKTtcblxuZXhwb3J0cy5yZXNvbHZlID0gZnVuY3Rpb24gKHNlbGYsIHZhbHVlKSB7XG4gIHZhciByZXN1bHQgPSB0cnlDYXRjaChnZXRUaGVuLCB2YWx1ZSk7XG4gIGlmIChyZXN1bHQuc3RhdHVzID09PSAnZXJyb3InKSB7XG4gICAgcmV0dXJuIGV4cG9ydHMucmVqZWN0KHNlbGYsIHJlc3VsdC52YWx1ZSk7XG4gIH1cbiAgdmFyIHRoZW5hYmxlID0gcmVzdWx0LnZhbHVlO1xuXG4gIGlmICh0aGVuYWJsZSkge1xuICAgIHJlc29sdmVUaGVuYWJsZS5zYWZlbHkoc2VsZiwgdGhlbmFibGUpO1xuICB9IGVsc2Uge1xuICAgIHNlbGYuc3RhdGUgPSBzdGF0ZXMuRlVMRklMTEVEO1xuICAgIHNlbGYub3V0Y29tZSA9IHZhbHVlO1xuICAgIHZhciBpID0gLTE7XG4gICAgdmFyIGxlbiA9IHNlbGYucXVldWUubGVuZ3RoO1xuICAgIHdoaWxlICgrK2kgPCBsZW4pIHtcbiAgICAgIHNlbGYucXVldWVbaV0uY2FsbEZ1bGZpbGxlZCh2YWx1ZSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBzZWxmO1xufTtcbmV4cG9ydHMucmVqZWN0ID0gZnVuY3Rpb24gKHNlbGYsIGVycm9yKSB7XG4gIHNlbGYuc3RhdGUgPSBzdGF0ZXMuUkVKRUNURUQ7XG4gIHNlbGYub3V0Y29tZSA9IGVycm9yO1xuICB2YXIgaSA9IC0xO1xuICB2YXIgbGVuID0gc2VsZi5xdWV1ZS5sZW5ndGg7XG4gIHdoaWxlICgrK2kgPCBsZW4pIHtcbiAgICBzZWxmLnF1ZXVlW2ldLmNhbGxSZWplY3RlZChlcnJvcik7XG4gIH1cbiAgcmV0dXJuIHNlbGY7XG59O1xuXG5mdW5jdGlvbiBnZXRUaGVuKG9iaikge1xuICAvLyBNYWtlIHN1cmUgd2Ugb25seSBhY2Nlc3MgdGhlIGFjY2Vzc29yIG9uY2UgYXMgcmVxdWlyZWQgYnkgdGhlIHNwZWNcbiAgdmFyIHRoZW4gPSBvYmogJiYgb2JqLnRoZW47XG4gIGlmIChvYmogJiYgdHlwZW9mIG9iaiA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIHRoZW4gPT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gYXBweVRoZW4oKSB7XG4gICAgICB0aGVuLmFwcGx5KG9iaiwgYXJndW1lbnRzKTtcbiAgICB9O1xuICB9XG59XG59LHtcIi4vcmVzb2x2ZVRoZW5hYmxlXCI6MTAsXCIuL3N0YXRlc1wiOjExLFwiLi90cnlDYXRjaFwiOjEyfV0sNDpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG5tb2R1bGUuZXhwb3J0cyA9IGV4cG9ydHMgPSBfZGVyZXFfKCcuL3Byb21pc2UnKTtcblxuZXhwb3J0cy5yZXNvbHZlID0gX2RlcmVxXygnLi9yZXNvbHZlJyk7XG5leHBvcnRzLnJlamVjdCA9IF9kZXJlcV8oJy4vcmVqZWN0Jyk7XG5leHBvcnRzLmFsbCA9IF9kZXJlcV8oJy4vYWxsJyk7XG5leHBvcnRzLnJhY2UgPSBfZGVyZXFfKCcuL3JhY2UnKTtcbn0se1wiLi9hbGxcIjoyLFwiLi9wcm9taXNlXCI6NSxcIi4vcmFjZVwiOjcsXCIuL3JlamVjdFwiOjgsXCIuL3Jlc29sdmVcIjo5fV0sNTpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciB1bndyYXAgPSBfZGVyZXFfKCcuL3Vud3JhcCcpO1xudmFyIElOVEVSTkFMID0gX2RlcmVxXygnLi9JTlRFUk5BTCcpO1xudmFyIHJlc29sdmVUaGVuYWJsZSA9IF9kZXJlcV8oJy4vcmVzb2x2ZVRoZW5hYmxlJyk7XG52YXIgc3RhdGVzID0gX2RlcmVxXygnLi9zdGF0ZXMnKTtcbnZhciBRdWV1ZUl0ZW0gPSBfZGVyZXFfKCcuL3F1ZXVlSXRlbScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFByb21pc2U7XG5mdW5jdGlvbiBQcm9taXNlKHJlc29sdmVyKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBQcm9taXNlKSkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlcik7XG4gIH1cbiAgaWYgKHR5cGVvZiByZXNvbHZlciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3Jlc29sdmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuICB9XG4gIHRoaXMuc3RhdGUgPSBzdGF0ZXMuUEVORElORztcbiAgdGhpcy5xdWV1ZSA9IFtdO1xuICB0aGlzLm91dGNvbWUgPSB2b2lkIDA7XG4gIGlmIChyZXNvbHZlciAhPT0gSU5URVJOQUwpIHtcbiAgICByZXNvbHZlVGhlbmFibGUuc2FmZWx5KHRoaXMsIHJlc29sdmVyKTtcbiAgfVxufVxuXG5Qcm9taXNlLnByb3RvdHlwZVsnY2F0Y2gnXSA9IGZ1bmN0aW9uIChvblJlamVjdGVkKSB7XG4gIHJldHVybiB0aGlzLnRoZW4obnVsbCwgb25SZWplY3RlZCk7XG59O1xuUHJvbWlzZS5wcm90b3R5cGUudGhlbiA9IGZ1bmN0aW9uIChvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCkge1xuICBpZiAodHlwZW9mIG9uRnVsZmlsbGVkICE9PSAnZnVuY3Rpb24nICYmIHRoaXMuc3RhdGUgPT09IHN0YXRlcy5GVUxGSUxMRUQgfHxcbiAgICB0eXBlb2Ygb25SZWplY3RlZCAhPT0gJ2Z1bmN0aW9uJyAmJiB0aGlzLnN0YXRlID09PSBzdGF0ZXMuUkVKRUNURUQpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKElOVEVSTkFMKTtcblxuICBcbiAgaWYgKHRoaXMuc3RhdGUgIT09IHN0YXRlcy5QRU5ESU5HKSB7XG4gICAgdmFyIHJlc29sdmVyID0gdGhpcy5zdGF0ZSA9PT0gc3RhdGVzLkZVTEZJTExFRCA/IG9uRnVsZmlsbGVkOiBvblJlamVjdGVkO1xuICAgIHVud3JhcChwcm9taXNlLCByZXNvbHZlciwgdGhpcy5vdXRjb21lKTtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLnF1ZXVlLnB1c2gobmV3IFF1ZXVlSXRlbShwcm9taXNlLCBvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCkpO1xuICB9XG5cbiAgcmV0dXJuIHByb21pc2U7XG59O1xuXG59LHtcIi4vSU5URVJOQUxcIjoxLFwiLi9xdWV1ZUl0ZW1cIjo2LFwiLi9yZXNvbHZlVGhlbmFibGVcIjoxMCxcIi4vc3RhdGVzXCI6MTEsXCIuL3Vud3JhcFwiOjEzfV0sNjpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4ndXNlIHN0cmljdCc7XG52YXIgaGFuZGxlcnMgPSBfZGVyZXFfKCcuL2hhbmRsZXJzJyk7XG52YXIgdW53cmFwID0gX2RlcmVxXygnLi91bndyYXAnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBRdWV1ZUl0ZW07XG5mdW5jdGlvbiBRdWV1ZUl0ZW0ocHJvbWlzZSwgb25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQpIHtcbiAgdGhpcy5wcm9taXNlID0gcHJvbWlzZTtcbiAgaWYgKHR5cGVvZiBvbkZ1bGZpbGxlZCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHRoaXMub25GdWxmaWxsZWQgPSBvbkZ1bGZpbGxlZDtcbiAgICB0aGlzLmNhbGxGdWxmaWxsZWQgPSB0aGlzLm90aGVyQ2FsbEZ1bGZpbGxlZDtcbiAgfVxuICBpZiAodHlwZW9mIG9uUmVqZWN0ZWQgPT09ICdmdW5jdGlvbicpIHtcbiAgICB0aGlzLm9uUmVqZWN0ZWQgPSBvblJlamVjdGVkO1xuICAgIHRoaXMuY2FsbFJlamVjdGVkID0gdGhpcy5vdGhlckNhbGxSZWplY3RlZDtcbiAgfVxufVxuUXVldWVJdGVtLnByb3RvdHlwZS5jYWxsRnVsZmlsbGVkID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIGhhbmRsZXJzLnJlc29sdmUodGhpcy5wcm9taXNlLCB2YWx1ZSk7XG59O1xuUXVldWVJdGVtLnByb3RvdHlwZS5vdGhlckNhbGxGdWxmaWxsZWQgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgdW53cmFwKHRoaXMucHJvbWlzZSwgdGhpcy5vbkZ1bGZpbGxlZCwgdmFsdWUpO1xufTtcblF1ZXVlSXRlbS5wcm90b3R5cGUuY2FsbFJlamVjdGVkID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIGhhbmRsZXJzLnJlamVjdCh0aGlzLnByb21pc2UsIHZhbHVlKTtcbn07XG5RdWV1ZUl0ZW0ucHJvdG90eXBlLm90aGVyQ2FsbFJlamVjdGVkID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIHVud3JhcCh0aGlzLnByb21pc2UsIHRoaXMub25SZWplY3RlZCwgdmFsdWUpO1xufTtcbn0se1wiLi9oYW5kbGVyc1wiOjMsXCIuL3Vud3JhcFwiOjEzfV0sNzpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4ndXNlIHN0cmljdCc7XG52YXIgUHJvbWlzZSA9IF9kZXJlcV8oJy4vcHJvbWlzZScpO1xudmFyIHJlamVjdCA9IF9kZXJlcV8oJy4vcmVqZWN0Jyk7XG52YXIgcmVzb2x2ZSA9IF9kZXJlcV8oJy4vcmVzb2x2ZScpO1xudmFyIElOVEVSTkFMID0gX2RlcmVxXygnLi9JTlRFUk5BTCcpO1xudmFyIGhhbmRsZXJzID0gX2RlcmVxXygnLi9oYW5kbGVycycpO1xubW9kdWxlLmV4cG9ydHMgPSByYWNlO1xuZnVuY3Rpb24gcmFjZShpdGVyYWJsZSkge1xuICBpZiAoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGl0ZXJhYmxlKSAhPT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgIHJldHVybiByZWplY3QobmV3IFR5cGVFcnJvcignbXVzdCBiZSBhbiBhcnJheScpKTtcbiAgfVxuXG4gIHZhciBsZW4gPSBpdGVyYWJsZS5sZW5ndGg7XG4gIHZhciBjYWxsZWQgPSBmYWxzZTtcbiAgaWYgKCFsZW4pIHtcbiAgICByZXR1cm4gcmVzb2x2ZShbXSk7XG4gIH1cblxuICB2YXIgcmVzb2x2ZWQgPSAwO1xuICB2YXIgaSA9IC0xO1xuICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKElOVEVSTkFMKTtcbiAgXG4gIHdoaWxlICgrK2kgPCBsZW4pIHtcbiAgICByZXNvbHZlcihpdGVyYWJsZVtpXSk7XG4gIH1cbiAgcmV0dXJuIHByb21pc2U7XG4gIGZ1bmN0aW9uIHJlc29sdmVyKHZhbHVlKSB7XG4gICAgcmVzb2x2ZSh2YWx1ZSkudGhlbihmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgIGlmICghY2FsbGVkKSB7XG4gICAgICAgIGNhbGxlZCA9IHRydWU7XG4gICAgICAgIGhhbmRsZXJzLnJlc29sdmUocHJvbWlzZSwgcmVzcG9uc2UpO1xuICAgICAgfVxuICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgaWYgKCFjYWxsZWQpIHtcbiAgICAgICAgY2FsbGVkID0gdHJ1ZTtcbiAgICAgICAgaGFuZGxlcnMucmVqZWN0KHByb21pc2UsIGVycm9yKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufVxufSx7XCIuL0lOVEVSTkFMXCI6MSxcIi4vaGFuZGxlcnNcIjozLFwiLi9wcm9taXNlXCI6NSxcIi4vcmVqZWN0XCI6OCxcIi4vcmVzb2x2ZVwiOjl9XSw4OltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIFByb21pc2UgPSBfZGVyZXFfKCcuL3Byb21pc2UnKTtcbnZhciBJTlRFUk5BTCA9IF9kZXJlcV8oJy4vSU5URVJOQUwnKTtcbnZhciBoYW5kbGVycyA9IF9kZXJlcV8oJy4vaGFuZGxlcnMnKTtcbm1vZHVsZS5leHBvcnRzID0gcmVqZWN0O1xuXG5mdW5jdGlvbiByZWplY3QocmVhc29uKSB7XG5cdHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoSU5URVJOQUwpO1xuXHRyZXR1cm4gaGFuZGxlcnMucmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG59XG59LHtcIi4vSU5URVJOQUxcIjoxLFwiLi9oYW5kbGVyc1wiOjMsXCIuL3Byb21pc2VcIjo1fV0sOTpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBQcm9taXNlID0gX2RlcmVxXygnLi9wcm9taXNlJyk7XG52YXIgSU5URVJOQUwgPSBfZGVyZXFfKCcuL0lOVEVSTkFMJyk7XG52YXIgaGFuZGxlcnMgPSBfZGVyZXFfKCcuL2hhbmRsZXJzJyk7XG5tb2R1bGUuZXhwb3J0cyA9IHJlc29sdmU7XG5cbnZhciBGQUxTRSA9IGhhbmRsZXJzLnJlc29sdmUobmV3IFByb21pc2UoSU5URVJOQUwpLCBmYWxzZSk7XG52YXIgTlVMTCA9IGhhbmRsZXJzLnJlc29sdmUobmV3IFByb21pc2UoSU5URVJOQUwpLCBudWxsKTtcbnZhciBVTkRFRklORUQgPSBoYW5kbGVycy5yZXNvbHZlKG5ldyBQcm9taXNlKElOVEVSTkFMKSwgdm9pZCAwKTtcbnZhciBaRVJPID0gaGFuZGxlcnMucmVzb2x2ZShuZXcgUHJvbWlzZShJTlRFUk5BTCksIDApO1xudmFyIEVNUFRZU1RSSU5HID0gaGFuZGxlcnMucmVzb2x2ZShuZXcgUHJvbWlzZShJTlRFUk5BTCksICcnKTtcblxuZnVuY3Rpb24gcmVzb2x2ZSh2YWx1ZSkge1xuICBpZiAodmFsdWUpIHtcbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBQcm9taXNlKSB7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICAgIHJldHVybiBoYW5kbGVycy5yZXNvbHZlKG5ldyBQcm9taXNlKElOVEVSTkFMKSwgdmFsdWUpO1xuICB9XG4gIHZhciB2YWx1ZVR5cGUgPSB0eXBlb2YgdmFsdWU7XG4gIHN3aXRjaCAodmFsdWVUeXBlKSB7XG4gICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICByZXR1cm4gRkFMU0U7XG4gICAgY2FzZSAndW5kZWZpbmVkJzpcbiAgICAgIHJldHVybiBVTkRFRklORUQ7XG4gICAgY2FzZSAnb2JqZWN0JzpcbiAgICAgIHJldHVybiBOVUxMO1xuICAgIGNhc2UgJ251bWJlcic6XG4gICAgICByZXR1cm4gWkVSTztcbiAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgcmV0dXJuIEVNUFRZU1RSSU5HO1xuICB9XG59XG59LHtcIi4vSU5URVJOQUxcIjoxLFwiLi9oYW5kbGVyc1wiOjMsXCIuL3Byb21pc2VcIjo1fV0sMTA6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xuJ3VzZSBzdHJpY3QnO1xudmFyIGhhbmRsZXJzID0gX2RlcmVxXygnLi9oYW5kbGVycycpO1xudmFyIHRyeUNhdGNoID0gX2RlcmVxXygnLi90cnlDYXRjaCcpO1xuZnVuY3Rpb24gc2FmZWx5UmVzb2x2ZVRoZW5hYmxlKHNlbGYsIHRoZW5hYmxlKSB7XG4gIC8vIEVpdGhlciBmdWxmaWxsLCByZWplY3Qgb3IgcmVqZWN0IHdpdGggZXJyb3JcbiAgdmFyIGNhbGxlZCA9IGZhbHNlO1xuICBmdW5jdGlvbiBvbkVycm9yKHZhbHVlKSB7XG4gICAgaWYgKGNhbGxlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjYWxsZWQgPSB0cnVlO1xuICAgIGhhbmRsZXJzLnJlamVjdChzZWxmLCB2YWx1ZSk7XG4gIH1cblxuICBmdW5jdGlvbiBvblN1Y2Nlc3ModmFsdWUpIHtcbiAgICBpZiAoY2FsbGVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNhbGxlZCA9IHRydWU7XG4gICAgaGFuZGxlcnMucmVzb2x2ZShzZWxmLCB2YWx1ZSk7XG4gIH1cblxuICBmdW5jdGlvbiB0cnlUb1Vud3JhcCgpIHtcbiAgICB0aGVuYWJsZShvblN1Y2Nlc3MsIG9uRXJyb3IpO1xuICB9XG4gIFxuICB2YXIgcmVzdWx0ID0gdHJ5Q2F0Y2godHJ5VG9VbndyYXApO1xuICBpZiAocmVzdWx0LnN0YXR1cyA9PT0gJ2Vycm9yJykge1xuICAgIG9uRXJyb3IocmVzdWx0LnZhbHVlKTtcbiAgfVxufVxuZXhwb3J0cy5zYWZlbHkgPSBzYWZlbHlSZXNvbHZlVGhlbmFibGU7XG59LHtcIi4vaGFuZGxlcnNcIjozLFwiLi90cnlDYXRjaFwiOjEyfV0sMTE6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xuLy8gTGF6eSBtYW4ncyBzeW1ib2xzIGZvciBzdGF0ZXNcblxuZXhwb3J0cy5SRUpFQ1RFRCA9IFsnUkVKRUNURUQnXTtcbmV4cG9ydHMuRlVMRklMTEVEID0gWydGVUxGSUxMRUQnXTtcbmV4cG9ydHMuUEVORElORyA9IFsnUEVORElORyddO1xufSx7fV0sMTI6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xuJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHRyeUNhdGNoO1xuXG5mdW5jdGlvbiB0cnlDYXRjaChmdW5jLCB2YWx1ZSkge1xuICB2YXIgb3V0ID0ge307XG4gIHRyeSB7XG4gICAgb3V0LnZhbHVlID0gZnVuYyh2YWx1ZSk7XG4gICAgb3V0LnN0YXR1cyA9ICdzdWNjZXNzJztcbiAgfSBjYXRjaCAoZSkge1xuICAgIG91dC5zdGF0dXMgPSAnZXJyb3InO1xuICAgIG91dC52YWx1ZSA9IGU7XG4gIH1cbiAgcmV0dXJuIG91dDtcbn1cbn0se31dLDEzOltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIGltbWVkaWF0ZSA9IF9kZXJlcV8oJ2ltbWVkaWF0ZScpO1xudmFyIGhhbmRsZXJzID0gX2RlcmVxXygnLi9oYW5kbGVycycpO1xubW9kdWxlLmV4cG9ydHMgPSB1bndyYXA7XG5cbmZ1bmN0aW9uIHVud3JhcChwcm9taXNlLCBmdW5jLCB2YWx1ZSkge1xuICBpbW1lZGlhdGUoZnVuY3Rpb24gKCkge1xuICAgIHZhciByZXR1cm5WYWx1ZTtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuVmFsdWUgPSBmdW5jKHZhbHVlKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZXR1cm4gaGFuZGxlcnMucmVqZWN0KHByb21pc2UsIGUpO1xuICAgIH1cbiAgICBpZiAocmV0dXJuVmFsdWUgPT09IHByb21pc2UpIHtcbiAgICAgIGhhbmRsZXJzLnJlamVjdChwcm9taXNlLCBuZXcgVHlwZUVycm9yKCdDYW5ub3QgcmVzb2x2ZSBwcm9taXNlIHdpdGggaXRzZWxmJykpO1xuICAgIH0gZWxzZSB7XG4gICAgICBoYW5kbGVycy5yZXNvbHZlKHByb21pc2UsIHJldHVyblZhbHVlKTtcbiAgICB9XG4gIH0pO1xufVxufSx7XCIuL2hhbmRsZXJzXCI6MyxcImltbWVkaWF0ZVwiOjE1fV0sMTQ6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xuXG59LHt9XSwxNTpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4ndXNlIHN0cmljdCc7XG52YXIgdHlwZXMgPSBbXG4gIF9kZXJlcV8oJy4vbmV4dFRpY2snKSxcbiAgX2RlcmVxXygnLi9tdXRhdGlvbi5qcycpLFxuICBfZGVyZXFfKCcuL21lc3NhZ2VDaGFubmVsJyksXG4gIF9kZXJlcV8oJy4vc3RhdGVDaGFuZ2UnKSxcbiAgX2RlcmVxXygnLi90aW1lb3V0Jylcbl07XG52YXIgZHJhaW5pbmc7XG52YXIgcXVldWUgPSBbXTtcbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gIGRyYWluaW5nID0gdHJ1ZTtcbiAgdmFyIGksIG9sZFF1ZXVlO1xuICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICB3aGlsZSAobGVuKSB7XG4gICAgb2xkUXVldWUgPSBxdWV1ZTtcbiAgICBxdWV1ZSA9IFtdO1xuICAgIGkgPSAtMTtcbiAgICB3aGlsZSAoKytpIDwgbGVuKSB7XG4gICAgICBvbGRRdWV1ZVtpXSgpO1xuICAgIH1cbiAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gIH1cbiAgZHJhaW5pbmcgPSBmYWxzZTtcbn1cbnZhciBzY2hlZHVsZURyYWluO1xudmFyIGkgPSAtMTtcbnZhciBsZW4gPSB0eXBlcy5sZW5ndGg7XG53aGlsZSAoKysgaSA8IGxlbikge1xuICBpZiAodHlwZXNbaV0gJiYgdHlwZXNbaV0udGVzdCAmJiB0eXBlc1tpXS50ZXN0KCkpIHtcbiAgICBzY2hlZHVsZURyYWluID0gdHlwZXNbaV0uaW5zdGFsbChkcmFpblF1ZXVlKTtcbiAgICBicmVhaztcbiAgfVxufVxubW9kdWxlLmV4cG9ydHMgPSBpbW1lZGlhdGU7XG5mdW5jdGlvbiBpbW1lZGlhdGUodGFzaykge1xuICBpZiAocXVldWUucHVzaCh0YXNrKSA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICBzY2hlZHVsZURyYWluKCk7XG4gIH1cbn1cbn0se1wiLi9tZXNzYWdlQ2hhbm5lbFwiOjE2LFwiLi9tdXRhdGlvbi5qc1wiOjE3LFwiLi9uZXh0VGlja1wiOjE0LFwiLi9zdGF0ZUNoYW5nZVwiOjE4LFwiLi90aW1lb3V0XCI6MTl9XSwxNjpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4oZnVuY3Rpb24gKGdsb2JhbCl7XG4ndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMudGVzdCA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKGdsb2JhbC5zZXRJbW1lZGlhdGUpIHtcbiAgICAvLyB3ZSBjYW4gb25seSBnZXQgaGVyZSBpbiBJRTEwXG4gICAgLy8gd2hpY2ggZG9lc24ndCBoYW5kZWwgcG9zdE1lc3NhZ2Ugd2VsbFxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gdHlwZW9mIGdsb2JhbC5NZXNzYWdlQ2hhbm5lbCAhPT0gJ3VuZGVmaW5lZCc7XG59O1xuXG5leHBvcnRzLmluc3RhbGwgPSBmdW5jdGlvbiAoZnVuYykge1xuICB2YXIgY2hhbm5lbCA9IG5ldyBnbG9iYWwuTWVzc2FnZUNoYW5uZWwoKTtcbiAgY2hhbm5lbC5wb3J0MS5vbm1lc3NhZ2UgPSBmdW5jO1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIGNoYW5uZWwucG9ydDIucG9zdE1lc3NhZ2UoMCk7XG4gIH07XG59O1xufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pXG59LHt9XSwxNzpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4oZnVuY3Rpb24gKGdsb2JhbCl7XG4ndXNlIHN0cmljdCc7XG4vL2Jhc2VkIG9mZiByc3ZwIGh0dHBzOi8vZ2l0aHViLmNvbS90aWxkZWlvL3JzdnAuanNcbi8vbGljZW5zZSBodHRwczovL2dpdGh1Yi5jb20vdGlsZGVpby9yc3ZwLmpzL2Jsb2IvbWFzdGVyL0xJQ0VOU0Vcbi8vaHR0cHM6Ly9naXRodWIuY29tL3RpbGRlaW8vcnN2cC5qcy9ibG9iL21hc3Rlci9saWIvcnN2cC9hc2FwLmpzXG5cbnZhciBNdXRhdGlvbiA9IGdsb2JhbC5NdXRhdGlvbk9ic2VydmVyIHx8IGdsb2JhbC5XZWJLaXRNdXRhdGlvbk9ic2VydmVyO1xuXG5leHBvcnRzLnRlc3QgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiBNdXRhdGlvbjtcbn07XG5cbmV4cG9ydHMuaW5zdGFsbCA9IGZ1bmN0aW9uIChoYW5kbGUpIHtcbiAgdmFyIGNhbGxlZCA9IDA7XG4gIHZhciBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbihoYW5kbGUpO1xuICB2YXIgZWxlbWVudCA9IGdsb2JhbC5kb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnJyk7XG4gIG9ic2VydmVyLm9ic2VydmUoZWxlbWVudCwge1xuICAgIGNoYXJhY3RlckRhdGE6IHRydWVcbiAgfSk7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgZWxlbWVudC5kYXRhID0gKGNhbGxlZCA9ICsrY2FsbGVkICUgMik7XG4gIH07XG59O1xufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pXG59LHt9XSwxODpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4oZnVuY3Rpb24gKGdsb2JhbCl7XG4ndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMudGVzdCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuICdkb2N1bWVudCcgaW4gZ2xvYmFsICYmICdvbnJlYWR5c3RhdGVjaGFuZ2UnIGluIGdsb2JhbC5kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcbn07XG5cbmV4cG9ydHMuaW5zdGFsbCA9IGZ1bmN0aW9uIChoYW5kbGUpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcblxuICAgIC8vIENyZWF0ZSBhIDxzY3JpcHQ+IGVsZW1lbnQ7IGl0cyByZWFkeXN0YXRlY2hhbmdlIGV2ZW50IHdpbGwgYmUgZmlyZWQgYXN5bmNocm9ub3VzbHkgb25jZSBpdCBpcyBpbnNlcnRlZFxuICAgIC8vIGludG8gdGhlIGRvY3VtZW50LiBEbyBzbywgdGh1cyBxdWV1aW5nIHVwIHRoZSB0YXNrLiBSZW1lbWJlciB0byBjbGVhbiB1cCBvbmNlIGl0J3MgYmVlbiBjYWxsZWQuXG4gICAgdmFyIHNjcmlwdEVsID0gZ2xvYmFsLmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xuICAgIHNjcmlwdEVsLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIGhhbmRsZSgpO1xuXG4gICAgICBzY3JpcHRFbC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBudWxsO1xuICAgICAgc2NyaXB0RWwucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChzY3JpcHRFbCk7XG4gICAgICBzY3JpcHRFbCA9IG51bGw7XG4gICAgfTtcbiAgICBnbG9iYWwuZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmFwcGVuZENoaWxkKHNjcmlwdEVsKTtcblxuICAgIHJldHVybiBoYW5kbGU7XG4gIH07XG59O1xufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pXG59LHt9XSwxOTpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4ndXNlIHN0cmljdCc7XG5leHBvcnRzLnRlc3QgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0cnVlO1xufTtcblxuZXhwb3J0cy5pbnN0YWxsID0gZnVuY3Rpb24gKHQpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICBzZXRUaW1lb3V0KHQsIDApO1xuICB9O1xufTtcbn0se31dfSx7fSxbNF0pKDQpXG59KTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9+L2xpZS9kaXN0L2xpZS5qc1xuICoqIG1vZHVsZSBpZCA9IDMxXG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJcbi8qKlxuICogVGhpcyBpcyB0aGUgY29tbW9uIGxvZ2ljIGZvciBib3RoIHRoZSBOb2RlLmpzIGFuZCB3ZWIgYnJvd3NlclxuICogaW1wbGVtZW50YXRpb25zIG9mIGBkZWJ1ZygpYC5cbiAqXG4gKiBFeHBvc2UgYGRlYnVnKClgIGFzIHRoZSBtb2R1bGUuXG4gKi9cblxuZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gZGVidWc7XG5leHBvcnRzLmNvZXJjZSA9IGNvZXJjZTtcbmV4cG9ydHMuZGlzYWJsZSA9IGRpc2FibGU7XG5leHBvcnRzLmVuYWJsZSA9IGVuYWJsZTtcbmV4cG9ydHMuZW5hYmxlZCA9IGVuYWJsZWQ7XG5leHBvcnRzLmh1bWFuaXplID0gcmVxdWlyZSgnbXMnKTtcblxuLyoqXG4gKiBUaGUgY3VycmVudGx5IGFjdGl2ZSBkZWJ1ZyBtb2RlIG5hbWVzLCBhbmQgbmFtZXMgdG8gc2tpcC5cbiAqL1xuXG5leHBvcnRzLm5hbWVzID0gW107XG5leHBvcnRzLnNraXBzID0gW107XG5cbi8qKlxuICogTWFwIG9mIHNwZWNpYWwgXCIlblwiIGhhbmRsaW5nIGZ1bmN0aW9ucywgZm9yIHRoZSBkZWJ1ZyBcImZvcm1hdFwiIGFyZ3VtZW50LlxuICpcbiAqIFZhbGlkIGtleSBuYW1lcyBhcmUgYSBzaW5nbGUsIGxvd2VyY2FzZWQgbGV0dGVyLCBpLmUuIFwiblwiLlxuICovXG5cbmV4cG9ydHMuZm9ybWF0dGVycyA9IHt9O1xuXG4vKipcbiAqIFByZXZpb3VzbHkgYXNzaWduZWQgY29sb3IuXG4gKi9cblxudmFyIHByZXZDb2xvciA9IDA7XG5cbi8qKlxuICogUHJldmlvdXMgbG9nIHRpbWVzdGFtcC5cbiAqL1xuXG52YXIgcHJldlRpbWU7XG5cbi8qKlxuICogU2VsZWN0IGEgY29sb3IuXG4gKlxuICogQHJldHVybiB7TnVtYmVyfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gc2VsZWN0Q29sb3IoKSB7XG4gIHJldHVybiBleHBvcnRzLmNvbG9yc1twcmV2Q29sb3IrKyAlIGV4cG9ydHMuY29sb3JzLmxlbmd0aF07XG59XG5cbi8qKlxuICogQ3JlYXRlIGEgZGVidWdnZXIgd2l0aCB0aGUgZ2l2ZW4gYG5hbWVzcGFjZWAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVzcGFjZVxuICogQHJldHVybiB7RnVuY3Rpb259XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGRlYnVnKG5hbWVzcGFjZSkge1xuXG4gIC8vIGRlZmluZSB0aGUgYGRpc2FibGVkYCB2ZXJzaW9uXG4gIGZ1bmN0aW9uIGRpc2FibGVkKCkge1xuICB9XG4gIGRpc2FibGVkLmVuYWJsZWQgPSBmYWxzZTtcblxuICAvLyBkZWZpbmUgdGhlIGBlbmFibGVkYCB2ZXJzaW9uXG4gIGZ1bmN0aW9uIGVuYWJsZWQoKSB7XG5cbiAgICB2YXIgc2VsZiA9IGVuYWJsZWQ7XG5cbiAgICAvLyBzZXQgYGRpZmZgIHRpbWVzdGFtcFxuICAgIHZhciBjdXJyID0gK25ldyBEYXRlKCk7XG4gICAgdmFyIG1zID0gY3VyciAtIChwcmV2VGltZSB8fCBjdXJyKTtcbiAgICBzZWxmLmRpZmYgPSBtcztcbiAgICBzZWxmLnByZXYgPSBwcmV2VGltZTtcbiAgICBzZWxmLmN1cnIgPSBjdXJyO1xuICAgIHByZXZUaW1lID0gY3VycjtcblxuICAgIC8vIGFkZCB0aGUgYGNvbG9yYCBpZiBub3Qgc2V0XG4gICAgaWYgKG51bGwgPT0gc2VsZi51c2VDb2xvcnMpIHNlbGYudXNlQ29sb3JzID0gZXhwb3J0cy51c2VDb2xvcnMoKTtcbiAgICBpZiAobnVsbCA9PSBzZWxmLmNvbG9yICYmIHNlbGYudXNlQ29sb3JzKSBzZWxmLmNvbG9yID0gc2VsZWN0Q29sb3IoKTtcblxuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcblxuICAgIGFyZ3NbMF0gPSBleHBvcnRzLmNvZXJjZShhcmdzWzBdKTtcblxuICAgIGlmICgnc3RyaW5nJyAhPT0gdHlwZW9mIGFyZ3NbMF0pIHtcbiAgICAgIC8vIGFueXRoaW5nIGVsc2UgbGV0J3MgaW5zcGVjdCB3aXRoICVvXG4gICAgICBhcmdzID0gWyclbyddLmNvbmNhdChhcmdzKTtcbiAgICB9XG5cbiAgICAvLyBhcHBseSBhbnkgYGZvcm1hdHRlcnNgIHRyYW5zZm9ybWF0aW9uc1xuICAgIHZhciBpbmRleCA9IDA7XG4gICAgYXJnc1swXSA9IGFyZ3NbMF0ucmVwbGFjZSgvJShbYS16JV0pL2csIGZ1bmN0aW9uKG1hdGNoLCBmb3JtYXQpIHtcbiAgICAgIC8vIGlmIHdlIGVuY291bnRlciBhbiBlc2NhcGVkICUgdGhlbiBkb24ndCBpbmNyZWFzZSB0aGUgYXJyYXkgaW5kZXhcbiAgICAgIGlmIChtYXRjaCA9PT0gJyUlJykgcmV0dXJuIG1hdGNoO1xuICAgICAgaW5kZXgrKztcbiAgICAgIHZhciBmb3JtYXR0ZXIgPSBleHBvcnRzLmZvcm1hdHRlcnNbZm9ybWF0XTtcbiAgICAgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgZm9ybWF0dGVyKSB7XG4gICAgICAgIHZhciB2YWwgPSBhcmdzW2luZGV4XTtcbiAgICAgICAgbWF0Y2ggPSBmb3JtYXR0ZXIuY2FsbChzZWxmLCB2YWwpO1xuXG4gICAgICAgIC8vIG5vdyB3ZSBuZWVkIHRvIHJlbW92ZSBgYXJnc1tpbmRleF1gIHNpbmNlIGl0J3MgaW5saW5lZCBpbiB0aGUgYGZvcm1hdGBcbiAgICAgICAgYXJncy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICBpbmRleC0tO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG1hdGNoO1xuICAgIH0pO1xuXG4gICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBleHBvcnRzLmZvcm1hdEFyZ3MpIHtcbiAgICAgIGFyZ3MgPSBleHBvcnRzLmZvcm1hdEFyZ3MuYXBwbHkoc2VsZiwgYXJncyk7XG4gICAgfVxuICAgIHZhciBsb2dGbiA9IGVuYWJsZWQubG9nIHx8IGV4cG9ydHMubG9nIHx8IGNvbnNvbGUubG9nLmJpbmQoY29uc29sZSk7XG4gICAgbG9nRm4uYXBwbHkoc2VsZiwgYXJncyk7XG4gIH1cbiAgZW5hYmxlZC5lbmFibGVkID0gdHJ1ZTtcblxuICB2YXIgZm4gPSBleHBvcnRzLmVuYWJsZWQobmFtZXNwYWNlKSA/IGVuYWJsZWQgOiBkaXNhYmxlZDtcblxuICBmbi5uYW1lc3BhY2UgPSBuYW1lc3BhY2U7XG5cbiAgcmV0dXJuIGZuO1xufVxuXG4vKipcbiAqIEVuYWJsZXMgYSBkZWJ1ZyBtb2RlIGJ5IG5hbWVzcGFjZXMuIFRoaXMgY2FuIGluY2x1ZGUgbW9kZXNcbiAqIHNlcGFyYXRlZCBieSBhIGNvbG9uIGFuZCB3aWxkY2FyZHMuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVzcGFjZXNcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZW5hYmxlKG5hbWVzcGFjZXMpIHtcbiAgZXhwb3J0cy5zYXZlKG5hbWVzcGFjZXMpO1xuXG4gIHZhciBzcGxpdCA9IChuYW1lc3BhY2VzIHx8ICcnKS5zcGxpdCgvW1xccyxdKy8pO1xuICB2YXIgbGVuID0gc3BsaXQubGVuZ3RoO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICBpZiAoIXNwbGl0W2ldKSBjb250aW51ZTsgLy8gaWdub3JlIGVtcHR5IHN0cmluZ3NcbiAgICBuYW1lc3BhY2VzID0gc3BsaXRbaV0ucmVwbGFjZSgvXFwqL2csICcuKj8nKTtcbiAgICBpZiAobmFtZXNwYWNlc1swXSA9PT0gJy0nKSB7XG4gICAgICBleHBvcnRzLnNraXBzLnB1c2gobmV3IFJlZ0V4cCgnXicgKyBuYW1lc3BhY2VzLnN1YnN0cigxKSArICckJykpO1xuICAgIH0gZWxzZSB7XG4gICAgICBleHBvcnRzLm5hbWVzLnB1c2gobmV3IFJlZ0V4cCgnXicgKyBuYW1lc3BhY2VzICsgJyQnKSk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogRGlzYWJsZSBkZWJ1ZyBvdXRwdXQuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBkaXNhYmxlKCkge1xuICBleHBvcnRzLmVuYWJsZSgnJyk7XG59XG5cbi8qKlxuICogUmV0dXJucyB0cnVlIGlmIHRoZSBnaXZlbiBtb2RlIG5hbWUgaXMgZW5hYmxlZCwgZmFsc2Ugb3RoZXJ3aXNlLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBlbmFibGVkKG5hbWUpIHtcbiAgdmFyIGksIGxlbjtcbiAgZm9yIChpID0gMCwgbGVuID0gZXhwb3J0cy5za2lwcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGlmIChleHBvcnRzLnNraXBzW2ldLnRlc3QobmFtZSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgZm9yIChpID0gMCwgbGVuID0gZXhwb3J0cy5uYW1lcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGlmIChleHBvcnRzLm5hbWVzW2ldLnRlc3QobmFtZSkpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8qKlxuICogQ29lcmNlIGB2YWxgLlxuICpcbiAqIEBwYXJhbSB7TWl4ZWR9IHZhbFxuICogQHJldHVybiB7TWl4ZWR9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBjb2VyY2UodmFsKSB7XG4gIGlmICh2YWwgaW5zdGFuY2VvZiBFcnJvcikgcmV0dXJuIHZhbC5zdGFjayB8fCB2YWwubWVzc2FnZTtcbiAgcmV0dXJuIHZhbDtcbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9+L2RlYnVnL2RlYnVnLmpzXG4gKiogbW9kdWxlIGlkID0gMzJcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24obW9kdWxlKSB7XHJcblx0aWYoIW1vZHVsZS53ZWJwYWNrUG9seWZpbGwpIHtcclxuXHRcdG1vZHVsZS5kZXByZWNhdGUgPSBmdW5jdGlvbigpIHt9O1xyXG5cdFx0bW9kdWxlLnBhdGhzID0gW107XHJcblx0XHQvLyBtb2R1bGUucGFyZW50ID0gdW5kZWZpbmVkIGJ5IGRlZmF1bHRcclxuXHRcdG1vZHVsZS5jaGlsZHJlbiA9IFtdO1xyXG5cdFx0bW9kdWxlLndlYnBhY2tQb2x5ZmlsbCA9IDE7XHJcblx0fVxyXG5cdHJldHVybiBtb2R1bGU7XHJcbn1cclxuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAod2VicGFjaykvYnVpbGRpbi9tb2R1bGUuanNcbiAqKiBtb2R1bGUgaWQgPSAzM1xuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG5cbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuICAgIHZhciBjdXJyZW50UXVldWU7XG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHZhciBpID0gLTE7XG4gICAgICAgIHdoaWxlICgrK2kgPCBsZW4pIHtcbiAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtpXSgpO1xuICAgICAgICB9XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbn1cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgcXVldWUucHVzaChmdW4pO1xuICAgIGlmICghZHJhaW5pbmcpIHtcbiAgICAgICAgc2V0VGltZW91dChkcmFpblF1ZXVlLCAwKTtcbiAgICB9XG59O1xuXG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxuLy8gVE9ETyhzaHR5bG1hbilcbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogKHdlYnBhY2spL34vbm9kZS1saWJzLWJyb3dzZXIvfi9wcm9jZXNzL2Jyb3dzZXIuanNcbiAqKiBtb2R1bGUgaWQgPSAzNFxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiLyoqXG4gKiBIZWxwZXJzLlxuICovXG5cbnZhciBzID0gMTAwMDtcbnZhciBtID0gcyAqIDYwO1xudmFyIGggPSBtICogNjA7XG52YXIgZCA9IGggKiAyNDtcbnZhciB5ID0gZCAqIDM2NS4yNTtcblxuLyoqXG4gKiBQYXJzZSBvciBmb3JtYXQgdGhlIGdpdmVuIGB2YWxgLlxuICpcbiAqIE9wdGlvbnM6XG4gKlxuICogIC0gYGxvbmdgIHZlcmJvc2UgZm9ybWF0dGluZyBbZmFsc2VdXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8TnVtYmVyfSB2YWxcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHtTdHJpbmd8TnVtYmVyfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHZhbCwgb3B0aW9ucyl7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICBpZiAoJ3N0cmluZycgPT0gdHlwZW9mIHZhbCkgcmV0dXJuIHBhcnNlKHZhbCk7XG4gIHJldHVybiBvcHRpb25zLmxvbmdcbiAgICA/IGxvbmcodmFsKVxuICAgIDogc2hvcnQodmFsKTtcbn07XG5cbi8qKlxuICogUGFyc2UgdGhlIGdpdmVuIGBzdHJgIGFuZCByZXR1cm4gbWlsbGlzZWNvbmRzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcbiAqIEByZXR1cm4ge051bWJlcn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHBhcnNlKHN0cikge1xuICB2YXIgbWF0Y2ggPSAvXigoPzpcXGQrKT9cXC4/XFxkKykgKihtc3xzZWNvbmRzP3xzfG1pbnV0ZXM/fG18aG91cnM/fGh8ZGF5cz98ZHx5ZWFycz98eSk/JC9pLmV4ZWMoc3RyKTtcbiAgaWYgKCFtYXRjaCkgcmV0dXJuO1xuICB2YXIgbiA9IHBhcnNlRmxvYXQobWF0Y2hbMV0pO1xuICB2YXIgdHlwZSA9IChtYXRjaFsyXSB8fCAnbXMnKS50b0xvd2VyQ2FzZSgpO1xuICBzd2l0Y2ggKHR5cGUpIHtcbiAgICBjYXNlICd5ZWFycyc6XG4gICAgY2FzZSAneWVhcic6XG4gICAgY2FzZSAneSc6XG4gICAgICByZXR1cm4gbiAqIHk7XG4gICAgY2FzZSAnZGF5cyc6XG4gICAgY2FzZSAnZGF5JzpcbiAgICBjYXNlICdkJzpcbiAgICAgIHJldHVybiBuICogZDtcbiAgICBjYXNlICdob3Vycyc6XG4gICAgY2FzZSAnaG91cic6XG4gICAgY2FzZSAnaCc6XG4gICAgICByZXR1cm4gbiAqIGg7XG4gICAgY2FzZSAnbWludXRlcyc6XG4gICAgY2FzZSAnbWludXRlJzpcbiAgICBjYXNlICdtJzpcbiAgICAgIHJldHVybiBuICogbTtcbiAgICBjYXNlICdzZWNvbmRzJzpcbiAgICBjYXNlICdzZWNvbmQnOlxuICAgIGNhc2UgJ3MnOlxuICAgICAgcmV0dXJuIG4gKiBzO1xuICAgIGNhc2UgJ21zJzpcbiAgICAgIHJldHVybiBuO1xuICB9XG59XG5cbi8qKlxuICogU2hvcnQgZm9ybWF0IGZvciBgbXNgLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBtc1xuICogQHJldHVybiB7U3RyaW5nfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gc2hvcnQobXMpIHtcbiAgaWYgKG1zID49IGQpIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gZCkgKyAnZCc7XG4gIGlmIChtcyA+PSBoKSByZXR1cm4gTWF0aC5yb3VuZChtcyAvIGgpICsgJ2gnO1xuICBpZiAobXMgPj0gbSkgcmV0dXJuIE1hdGgucm91bmQobXMgLyBtKSArICdtJztcbiAgaWYgKG1zID49IHMpIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gcykgKyAncyc7XG4gIHJldHVybiBtcyArICdtcyc7XG59XG5cbi8qKlxuICogTG9uZyBmb3JtYXQgZm9yIGBtc2AuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1zXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBsb25nKG1zKSB7XG4gIHJldHVybiBwbHVyYWwobXMsIGQsICdkYXknKVxuICAgIHx8IHBsdXJhbChtcywgaCwgJ2hvdXInKVxuICAgIHx8IHBsdXJhbChtcywgbSwgJ21pbnV0ZScpXG4gICAgfHwgcGx1cmFsKG1zLCBzLCAnc2Vjb25kJylcbiAgICB8fCBtcyArICcgbXMnO1xufVxuXG4vKipcbiAqIFBsdXJhbGl6YXRpb24gaGVscGVyLlxuICovXG5cbmZ1bmN0aW9uIHBsdXJhbChtcywgbiwgbmFtZSkge1xuICBpZiAobXMgPCBuKSByZXR1cm47XG4gIGlmIChtcyA8IG4gKiAxLjUpIHJldHVybiBNYXRoLmZsb29yKG1zIC8gbikgKyAnICcgKyBuYW1lO1xuICByZXR1cm4gTWF0aC5jZWlsKG1zIC8gbikgKyAnICcgKyBuYW1lICsgJ3MnO1xufVxuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL34vZGVidWcvfi9tcy9pbmRleC5qc1xuICoqIG1vZHVsZSBpZCA9IDM1XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iXSwic291cmNlUm9vdCI6IiIsImZpbGUiOiI2N2Y4YWVjYTc5YTJiZWU4YTNjNy5qcyJ9