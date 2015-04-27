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
	  Collection = __webpack_require__(2),
	  Model = __webpack_require__(3),
	  error = __webpack_require__(4),
	  events = __webpack_require__(5),
	  RelationshipType = __webpack_require__(6),
	  ReactiveQuery = __webpack_require__(7),
	  ManyToManyProxy = __webpack_require__(8),
	  App = __webpack_require__(9),
	  OneToOneProxy = __webpack_require__(10),
	  OneToManyProxy = __webpack_require__(11),
	  RelationshipProxy = __webpack_require__(12),
	  modelEvents = __webpack_require__(13),
	  Query = __webpack_require__(14),
	  querySet = __webpack_require__(15),
	  Condition = __webpack_require__(16),
	  log = __webpack_require__(17);
	
	util._patchBind();
	
	// Initialise siesta object. Strange format facilities using submodules with requireJS (eventually)
	var siesta = function(ext) {
	  if (!siesta.ext) siesta.ext = {};
	  util.extend(siesta.ext, ext || {});
	  return siesta;
	};
	
	siesta.createApp = function(name) {
	  return new App(name);
	};
	
	// Expose some stuff for usage by extensions and/or users
	util.extend(siesta, {
	  RelationshipType: RelationshipType,
	  ModelEventType: modelEvents.ModelEventType,
	  log: log.Level,
	  InsertionPolicy: ReactiveQuery.InsertionPolicy,
	  _internal: {
	    log: log,
	    Condition: Condition,
	    Model: Model,
	    error: error,
	    ModelEventType: modelEvents.ModelEventType,
	    ModelInstance: __webpack_require__(18),
	    extend: __webpack_require__(22),
	    MappingOperation: __webpack_require__(19),
	    events: events,
	    ProxyEventEmitter: __webpack_require__(20),
	    modelEvents: modelEvents,
	    Collection: Collection,
	    utils: util,
	    util: util,
	    querySet: querySet,
	    observe: __webpack_require__(23),
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
	
	
	if (typeof window != 'undefined') {
	  window['siesta'] = siesta;
	}
	
	siesta.log = __webpack_require__(30);
	module.exports = siesta;
	
	(function loadExtensions() {
	  __webpack_require__(21);
	})();


/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	var observe = __webpack_require__(23).Platform,
	  Promise = __webpack_require__(34),
	  argsarray = __webpack_require__(31),
	  InternalSiestaError = __webpack_require__(4).InternalSiestaError;
	
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

	var log = __webpack_require__(17)('collection'),
	  CollectionRegistry = __webpack_require__(24),
	  InternalSiestaError = __webpack_require__(4).InternalSiestaError,
	  Model = __webpack_require__(3),
	  extend = __webpack_require__(22),
	  ProxyEventEmitter = __webpack_require__(20),
	  util = __webpack_require__(1),
	  error = __webpack_require__(4),
	  argsarray = __webpack_require__(31),
	  Condition = __webpack_require__(25);
	
	
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
	    app: null
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
	        if (this.app.storageEnabled) {
	          var unsavedObjectsByCollection = this.app.storage._unsavedObjectsByCollection,
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
	
	  this.app.collectionRegistry.register(this);
	  this._makeAvailableOnRoot();
	  ProxyEventEmitter.call(this, this.app, this.name);
	
	}
	
	Collection.prototype = Object.create(ProxyEventEmitter.prototype);
	
	util.extend(Collection.prototype, {
	  /**
	   * Means that we can access the collection on the siesta object.
	   * @private
	   */
	  _makeAvailableOnRoot: function() {
	    siesta[this.name] = this;
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
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(setImmediate) {var log = __webpack_require__(17)('model'),
	  InternalSiestaError = __webpack_require__(4).InternalSiestaError,
	  RelationshipType = __webpack_require__(6),
	  Query = __webpack_require__(14),
	  MappingOperation = __webpack_require__(19),
	  ModelInstance = __webpack_require__(18),
	  util = __webpack_require__(1),
	  argsarray = __webpack_require__(31),
	  error = __webpack_require__(4),
	  extend = __webpack_require__(22),
	  modelEvents = __webpack_require__(13),
	  Condition = __webpack_require__(16),
	  ProxyEventEmitter = __webpack_require__(20),
	  Promise = util.Promise,
	  Placeholder = __webpack_require__(26),
	  ReactiveQuery = __webpack_require__(7),
	  InstanceFactory = __webpack_require__(27);
	
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
	        if (this.app.storageEnabled) {
	          var unsavedObjectsByCollection = this.app.storage._unsavedObjectsByCollection,
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
	    app: {
	      get: function() {
	        return this.collection.app;
	      }
	    }
	  });
	  var globalEventName = this.collectionName + ':' + this.name,
	    proxied = {
	      query: this.query.bind(this)
	    };
	
	  ProxyEventEmitter.call(this, this.collection.app, globalEventName, proxied);
	
	  this.installRelationships();
	  this.installReverseRelationships();
	
	  this._indexIsInstalled = new Condition(function(done) {
	    if (this.app.storageEnabled) {
	      this.app.storage.ensureIndexInstalled(this, function(err) {
	        done(err);
	      });
	    }
	    else done();
	  }.bind(this));
	
	  this._modelLoadedFromStorage = new Condition(function(done) {
	    if (this.app.storageEnabled) {
	      this.app.storage.loadModel({model: this}, function(err) {
	        done(err);
	      });
	    }
	    else done();
	  }.bind(this));
	
	  this._storageEnabled = new Condition([this._indexIsInstalled, this._modelLoadedFromStorage]);
	
	  this._storageEnabled
	    .then(function() {
	    }.bind(this))
	    .catch(function(err) {
	      console.error('Could not enable storage for model ' + this.name + ':', err);
	    }.bind(this))
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
	    return new Promise(function(resolve, reject) {
	      Condition
	        .all
	        .apply(Condition, models.map(function(x) {return x._storageEnabled}))
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
	        var otherCollection = this.app.collectionRegistry[collectionName];
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
	
	      var existingReverseInstances = (this.app.cache._localCacheByType[reverseModel.collectionName] || {})[reverseModel.name] || {};
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
	  _query: function(query) {
	    return new Query(this, query || {});
	  },
	  query: function(query, cb) {
	    var queryInstance;
	    var promise = util.promise(cb, function(cb) {
	      this.app._ensureInstalled(function() {
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
	      this.app._ensureInstalled(function() {
	        this._graph(data, opts, cb);
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
	    var collCache = this.app.cache._localCacheByType[this.collectionName] || {};
	    var modelCache = collCache[this.name] || {};
	    return Object.keys(modelCache).reduce(function(m, localId) {
	      m[localId] = {};
	      return m;
	    }, {});
	  },
	  count: function(cb) {
	    return util.promise(cb, function(cb) {
	      this.app._ensureInstalled(function() {
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
	
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(32).setImmediate))

/***/ },
/* 4 */
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
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	var EventEmitter = __webpack_require__(33).EventEmitter,
	  util = __webpack_require__(1),
	  argsarray = __webpack_require__(31),
	  modelEvents = __webpack_require__(13),
	  Chain = __webpack_require__(28);
	
	
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
/* 6 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = {
	  OneToMany: 'OneToMany',
	  OneToOne: 'OneToOne',
	  ManyToMany: 'ManyToMany'
	};

/***/ },
/* 7 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * For those familiar with Apple's Cocoa library, reactive queries roughly map onto NSFetchedResultsController.
	 *
	 * They present a query set that 'reacts' to changes in the underlying data.
	 * @module reactiveQuery
	 */
	
	var log = __webpack_require__(17)('query:reactive'),
	  Query = __webpack_require__(14),
	  EventEmitter = __webpack_require__(33).EventEmitter,
	  Chain = __webpack_require__(28),
	  modelEvents = __webpack_require__(13),
	  InternalSiestaError = __webpack_require__(4).InternalSiestaError,
	  constructQuerySet = __webpack_require__(15),
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
	      this.model.app.events.on(name, handler);
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
	      this.model.app.events.removeListener(this._constructNotificationName(), this.handler);
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
/* 8 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * @module relationships
	 */
	
	var RelationshipProxy = __webpack_require__(12),
	  util = __webpack_require__(1),
	  modelEvents = __webpack_require__(13),
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
	          model.app.broadcast({
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
/* 9 */
/***/ function(module, exports, __webpack_require__) {

	var CollectionRegistry = __webpack_require__(24),
	  events = __webpack_require__(5),
	  modelEvents = __webpack_require__(13),
	  Cache = __webpack_require__(29),
	  util = __webpack_require__(1),
	  Model = __webpack_require__(3),
	  error = __webpack_require__(4),
	  Storage = __webpack_require__(21),
	  Query = __webpack_require__(14),
	  Collection = __webpack_require__(2);
	
	function Context(name, app) {
	  this.name = name;
	  this.collectionRegistry = new CollectionRegistry();
	  this.cache = new Cache();
	  this.app = app;
	  this.storage = new Storage(this.app);
	  this.events = events();
	  var off = this.events.removeListener.bind(this.events);
	
	  util.extend(this, {
	    on: this.events.on.bind(this.events),
	    off: off,
	    removeListener: off,
	    once: this.events.once.bind(this.events),
	    removeAllListeners: this.events.removeAllListeners.bind(this.events),
	    notify: util.next,
	    registerComparator: Query.registerComparator.bind(Query),
	    save: this.storage.save.bind(this.storage),
	    setPouch: function(p) {
	      this.storage.pouch = p;
	    }.bind(this)
	  });
	
	  var interval, saving, autosaveInterval = 500;
	  var storageEnabled;
	
	
	  if (typeof PouchDB == 'undefined') {
	    this.storageEnabled = false;
	    console.warn('PouchDB is not present therefore storage is disabled.');
	  }
	
	  Object.defineProperties(this, {
	    dirty: {
	      get: function() {
	        var unsavedObjectsByCollection = this.storage._unsavedObjectsByCollection;
	        return !!Object.keys(this.storage.unsavedObjectsByCollection).length;
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
	                this.storage.save(function(err) {
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
	    storageEnabled: {
	      get: function() {
	        if (storageEnabled !== undefined) {
	          return storageEnabled;
	        }
	        return !!this.storage;
	      },
	      set: function(v) {
	        storageEnabled = v;
	      },
	      enumerable: true
	    }
	  });
	}
	
	Context.prototype = {
	  collection: function(name, opts) {
	    opts = opts || {};
	    opts.app = this;
	    return new Collection(name, opts);
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
	          var collection = this.collectionRegistry[collectionName];
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
	        this.collectionRegistry.collectionNames.map(function(collectionName) {
	          return this.collectionRegistry[collectionName].removeAll();
	        }.bind(this))
	      ).then(function() {
	          cb(null);
	        }).catch(cb)
	    }.bind(this));
	  },
	  _ensureInstalled: function(cb) {
	    cb = cb || function() {};
	    var collectionNames = this.collectionRegistry.collectionNames;
	    var allModels = collectionNames
	      .reduce(function(memo, collectionName) {
	        var collection = this.collectionRegistry[collectionName];
	        memo = memo.concat(collection.models);
	        return memo;
	      }.bind(this), []);
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
	    this.collectionRegistry.reset();
	    var collectionNames = this.collectionRegistry.collectionNames;
	    collectionNames.reduce(function(memo, collName) {
	      var coll = this.collectionRegistry[collName];
	      Object.keys(coll._models).forEach(function(modelName) {
	        var model = coll[modelName];
	        memo.push(model._storageEnabled);
	      });
	      return memo;
	    }.bind(this), []);
	    this.removeAllListeners();
	    if (this.storageEnabled) {
	      resetStorage = resetStorage === undefined ? true : resetStorage;
	      if (resetStorage) {
	        this.storage._reset(cb);
	        this.setPouch(new PouchDB('siesta', {auto_compaction: true, adapter: 'memory'}));
	      }
	      else {
	        cb();
	      }
	    }
	    else {
	      cb();
	    }
	  },
	};
	
	function App(name) {
	  if (!name) throw new Error('App must have a name');
	  this.name = name;
	
	  this.defaultContext = new Context(name + '-default', this);
	  util.extend(this, this.defaultContext);
	
	  function copyProperty(prop) {
	    Object.defineProperty(this, prop, {
	      get: function() {
	        return this.defaultContext[prop];
	      },
	      set: function(v) {
	        this.defaultContext[prop] = v;
	      },
	      enumerable: true
	    });
	  }
	
	  var passThroughproperties = ['dirty', 'autosaveInterval', 'autosave', 'storageEnabled'];
	  passThroughproperties.forEach(copyProperty.bind(this));
	}
	
	App.prototype = Context.prototype;
	
	
	module.exports = App;


/***/ },
/* 10 */
/***/ function(module, exports, __webpack_require__) {

	var RelationshipProxy = __webpack_require__(12),
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
/* 11 */
/***/ function(module, exports, __webpack_require__) {

	var RelationshipProxy = __webpack_require__(12),
	  util = __webpack_require__(1),
	  modelEvents = __webpack_require__(13),
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
	          model.app.broadcast({
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
/* 12 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Base functionality for relationships.
	 * @module relationships
	 */
	var InternalSiestaError = __webpack_require__(4).InternalSiestaError,
	  util = __webpack_require__(1),
	  Query = __webpack_require__(14),
	  log = __webpack_require__(17),
	  modelEvents = __webpack_require__(13),
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
	    model.app.broadcast({
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
	    model.app.broadcast({
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
	          model.app.broadcast({
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
/* 13 */
/***/ function(module, exports, __webpack_require__) {

	var InternalSiestaError = __webpack_require__(4).InternalSiestaError,
	  log = __webpack_require__(17)('events'),
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
	
	function broadcastEvent(app, collectionName, modelName, opts) {
	  var genericEvent = 'Siesta',
	    collection = app.collectionRegistry[collectionName],
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
	    app.events.emit(genericEvent, opts);
	    var modelEvent = collectionName + ':' + modelName,
	      localIdEvent = opts.localId;
	    app.events.emit(collectionName, opts);
	    app.events.emit(modelEvent, opts);
	    app.events.emit(localIdEvent, opts);
	    if (model.id && opts.obj[model.id]) app.events.emit(collectionName + ':' + modelName + ':' + opts.obj[model.id], opts);
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
	            emit(modelInstance.app, {
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
/* 14 */
/***/ function(module, exports, __webpack_require__) {

	var log = __webpack_require__(17)('query'),
	  util = __webpack_require__(1),
	  error = __webpack_require__(4),
	  ModelInstance = __webpack_require__(18),
	  constructQuerySet = __webpack_require__(15);
	
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
	  var cacheByType = model.app.cache._localCacheByType;
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
/* 15 */
/***/ function(module, exports, __webpack_require__) {

	var util = __webpack_require__(1),
	  Promise = util.Promise,
	  error = __webpack_require__(4),
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
/* 16 */
/***/ function(module, exports, __webpack_require__) {

	var util = __webpack_require__(1),
	  argsarray = __webpack_require__(31);
	
	function Condition(fn, lazy) {
	  if (lazy === undefined || lazy === null) {
	    lazy = true;
	  }
	  fn = fn || function(done) {
	    done();
	  };
	
	  this._promise = new util.Promise(function(resolve, reject) {
	    this.reject = reject;
	    this.resolve = resolve;
	    this.fn = function() {
	      this.executed = true;
	      var numComplete = 0;
	      var results = [];
	      var errors = [];
	      if (util.isArray(fn)) {
	        var checkComplete = function() {
	          if (numComplete == fn.length) {
	            if (errors.length) {
	              reject(errors);
	            }
	            else {
	              resolve(results);
	            }
	          }
	        }.bind(this);
	        fn.forEach(function(cond, idx) {
	          cond
	            .then(function(res) {
	              results[idx] = res;
	              numComplete++;
	              checkComplete();
	            })
	            .catch(function(err) {
	              errors[idx] = err;
	              numComplete++;
	              checkComplete();
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
	  this.dependent = [];
	}
	
	Condition.all = argsarray(function(args) {
	  return new Condition(args);
	});
	
	Condition.prototype = {
	  _execute: function() {
	    if (!this.executed) {
	      Promise
	        .all(util.pluck(this.dependent, '_promise'))
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
	
	  }
	};
	
	module.exports = Condition;


/***/ },
/* 17 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Dead simple logging service based on visionmedia/debug
	 * @module log
	 */
	
	var debug = __webpack_require__(30),
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
/* 18 */
/***/ function(module, exports, __webpack_require__) {

	var log = __webpack_require__(17),
	  util = __webpack_require__(1),
	  error = __webpack_require__(4),
	  modelEvents = __webpack_require__(13),
	  ModelEventType = modelEvents.ModelEventType,
	  ProxyEventEmitter = __webpack_require__(20);
	
	
	function ModelInstance(model) {
	  if (!model) throw new Error('wtf');
	  var self = this;
	  this.model = model;
	
	  ProxyEventEmitter.call(this, model.app);
	
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
	        if (this.app.storageEnabled) {
	          return self.localId in this.app.storage._unsavedObjectsHash;
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
	    app: {
	      get: function() {
	        return this.model.app;
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
	    this.app.broadcast(opts);
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
	      this.app.cache.remove(this);
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
	        this.app.cache.insert(this);
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
	    this.app.broadcast({
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
	    var cache = this.model.app.cache;
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
	    var cache = this.model.app.cache;
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
	    var singleton = this.model.app.cache.getSingleton(this.model) || this._instance(localId);
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
/* 20 */
/***/ function(module, exports, __webpack_require__) {

	var ArrayObserver = __webpack_require__(23).ArrayObserver,
	  util = __webpack_require__(1),
	  argsarray = __webpack_require__(31),
	  modelEvents = __webpack_require__(13),
	  Chain = __webpack_require__(28);
	
	
	/**
	 * Listen to a particular event from the Siesta global EventEmitter.
	 * Manages its own set of listeners.
	 * @constructor
	 */
	function ProxyEventEmitter(app, event, chainOpts) {
	  if (!app) throw new Error('wtf');
	  util.extend(this, {
	    event: event,
	    app: app,
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
	    this.app.events.on(this.event, fn);
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
	            this.app.events.removeListener(event, fn);
	            _fn(e);
	          }
	        }
	        else {
	          _fn(e);
	        }
	      }.bind(this)
	    }
	    if (type) return this.app.events.on(event, fn);
	    else return this.app.events.once(event, fn);
	  },
	  _removeListener: function(fn, type) {
	    if (type) {
	      var listeners = this.listeners[type],
	        idx = listeners.indexOf(fn);
	      listeners.splice(idx, 1);
	    }
	    return this.app.events.removeListener(this.event, fn);
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
	    this.app.events.emit.call(this.app.events, this.event, payload);
	  },
	  _removeAllListeners: function(type) {
	    (this.listeners[type] || []).forEach(function(fn) {
	      this.app.events.removeListener(this.event, fn);
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
/* 21 */
/***/ function(module, exports, __webpack_require__) {

	var util = __webpack_require__(1),
	  error = __webpack_require__(4),
	  log = __webpack_require__(17)('storage');
	
	// Variables beginning with underscore are treated as special by PouchDB/CouchDB so when serialising we need to
	// replace with something else.
	var UNDERSCORE = /_/g,
	  UNDERSCORE_REPLACEMENT = /@/g;
	
	/**
	 *
	 * @param app
	 * @constructor
	 */
	function Storage(app) {
	  var name = app.name;
	
	  this.app = app;
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
	
	  this.pouch = new PouchDB(name, {auto_compaction: true})
	}
	
	Storage.prototype = {
	  /**
	   * Save all modelEvents down to PouchDB.
	   */
	  save: function(cb) {
	    return util.promise(cb, function(cb) {
	      this.app._ensureInstalled(function() {
	        var instances = this.unsavedObjects;
	        this.unsavedObjects = [];
	        this.unsavedObjectsHash = {};
	        this.unsavedObjectsByCollection = {};
	        this.saveToPouch(instances, cb);
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
	    var Model = this.app.collectionRegistry[collectionName][modelName];
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
	  _reset: function(cb) {
	    if (this._listener) this.app.removeListener('Siesta', this._listener);
	    this.unsavedObjects = [];
	    this.unsavedObjectsHash = {};
	
	    this
	      .pouch
	      .allDocs()
	      .then(function(results) {
	        var docs = results.rows.map(function(r) {
	          return {_id: r.id, _rev: r.value.rev, _deleted: true};
	        });
	
	        this.pouch
	          .bulkDocs(docs)
	          .then(function() {cb()})
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
	
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }()), __webpack_require__(36)(module)))

/***/ },
/* 24 */
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
	
	module.exports = CollectionRegistry;


/***/ },
/* 25 */
/***/ function(module, exports, __webpack_require__) {

	var util = __webpack_require__(1),
	  argsarray = __webpack_require__(31);
	
	function Condition(fn, lazy) {
	  if (lazy === undefined || lazy === null) {
	    lazy = true;
	  }
	  fn = fn || function(done) {
	    done();
	  };
	
	  this._promise = new util.Promise(function(resolve, reject) {
	    this.reject = reject;
	    this.resolve = resolve;
	    this.fn = function() {
	      this.executed = true;
	      var numComplete = 0;
	      var results = [];
	      var errors = [];
	      if (util.isArray(fn)) {
	        var checkComplete = function() {
	          if (numComplete == fn.length) {
	            if (errors.length) {
	              reject(errors);
	            }
	            else {
	              resolve(results);
	            }
	          }
	        }.bind(this);
	        fn.forEach(function(cond, idx) {
	          cond
	            .then(function(res) {
	              results[idx] = res;
	              numComplete++;
	              checkComplete();
	            })
	            .catch(function(err) {
	              errors[idx] = err;
	              numComplete++;
	              checkComplete();
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
	  this.dependent = [];
	}
	
	Condition.all = argsarray(function(args) {
	  return new Condition(args);
	});
	
	Condition.prototype = {
	  _execute: function() {
	    if (!this.executed) {
	      Promise
	        .all(util.pluck(this.dependent, '_promise'))
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
	
	  }
	};
	
	module.exports = Condition;


/***/ },
/* 26 */
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
/* 27 */
/***/ function(module, exports, __webpack_require__) {

	var log = __webpack_require__(17)('model'),
	  InternalSiestaError = __webpack_require__(4).InternalSiestaError,
	  RelationshipType = __webpack_require__(6),
	  Query = __webpack_require__(14),
	  ModelInstance = __webpack_require__(18),
	  util = __webpack_require__(1),
	  guid = util.guid,
	  extend = __webpack_require__(22),
	  modelEvents = __webpack_require__(13),
	  wrapArray = modelEvents.wrapArray,
	  OneToManyProxy = __webpack_require__(11),
	  OneToOneProxy = __webpack_require__(10),
	  ManyToManyProxy = __webpack_require__(8),
	  ReactiveQuery = __webpack_require__(7),
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
	            Model.app.broadcast({
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
	          Model.app.broadcast(e);
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
	    var cache = Model.app.cache;
	    var idField = Model.id;
	    Object.defineProperty(modelInstance, idField, {
	      get: function() {
	        return modelInstance.__values[Model.id] || null;
	      },
	      set: function(v) {
	        var old = modelInstance[Model.id];
	        modelInstance.__values[Model.id] = v;
	        Model.app.broadcast({
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
	    var cache = this.model.app.cache;
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
/* 28 */
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
/* 29 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * This is an in-memory cache for models. Models are cached by local id (_id) and remote id (defined by the mapping).
	 * Lookups are performed against the cache when mapping.
	 * @module cache
	 */
	var log = __webpack_require__(17)('cache'),
	  InternalSiestaError = __webpack_require__(4).InternalSiestaError,
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
/* 30 */
/***/ function(module, exports, __webpack_require__) {

	
	/**
	 * This is the web browser implementation of `debug()`.
	 *
	 * Expose `debug()` as the module.
	 */
	
	exports = module.exports = __webpack_require__(35);
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

	/* WEBPACK VAR INJECTION */(function(setImmediate, clearImmediate) {var nextTick = __webpack_require__(37).nextTick;
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
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(32).setImmediate, __webpack_require__(32).clearImmediate))

/***/ },
/* 33 */
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
/* 34 */
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
/* 35 */
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
	exports.humanize = __webpack_require__(38);
	
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
/* 36 */
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
/* 37 */
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
/* 38 */
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vd2VicGFjay9ib290c3RyYXAgZjg3MTZiNjZkYzljMzUwNTQxYTkiLCJ3ZWJwYWNrOi8vLy4vY29yZS9pbmRleC5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL3V0aWwuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9jb2xsZWN0aW9uLmpzIiwid2VicGFjazovLy8uL2NvcmUvbW9kZWwuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9lcnJvci5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL2V2ZW50cy5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL1JlbGF0aW9uc2hpcFR5cGUuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9SZWFjdGl2ZVF1ZXJ5LmpzIiwid2VicGFjazovLy8uL2NvcmUvTWFueVRvTWFueVByb3h5LmpzIiwid2VicGFjazovLy8uL2NvcmUvQXBwLmpzIiwid2VicGFjazovLy8uL2NvcmUvT25lVG9PbmVQcm94eS5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL09uZVRvTWFueVByb3h5LmpzIiwid2VicGFjazovLy8uL2NvcmUvUmVsYXRpb25zaGlwUHJveHkuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9tb2RlbEV2ZW50cy5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL1F1ZXJ5LmpzIiwid2VicGFjazovLy8uL2NvcmUvUXVlcnlTZXQuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9Db25kaXRpb24uanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9sb2cuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9Nb2RlbEluc3RhbmNlLmpzIiwid2VicGFjazovLy8uL2NvcmUvbWFwcGluZ09wZXJhdGlvbi5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL1Byb3h5RXZlbnRFbWl0dGVyLmpzIiwid2VicGFjazovLy8uL3N0b3JhZ2UvaW5kZXguanMiLCJ3ZWJwYWNrOi8vLy4vfi9leHRlbmQvaW5kZXguanMiLCJ3ZWJwYWNrOi8vLy4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9jb2xsZWN0aW9uUmVnaXN0cnkuanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9jb25kaXRpb24uanMiLCJ3ZWJwYWNrOi8vLy4vY29yZS9QbGFjZWhvbGRlci5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL2luc3RhbmNlRmFjdG9yeS5qcyIsIndlYnBhY2s6Ly8vLi9jb3JlL0NoYWluLmpzIiwid2VicGFjazovLy8uL2NvcmUvY2FjaGUuanMiLCJ3ZWJwYWNrOi8vLy4vfi9kZWJ1Zy9icm93c2VyLmpzIiwid2VicGFjazovLy8uL34vYXJnc2FycmF5L2luZGV4LmpzIiwid2VicGFjazovLy8od2VicGFjaykvfi9ub2RlLWxpYnMtYnJvd3Nlci9+L3RpbWVycy1icm93c2VyaWZ5L21haW4uanMiLCJ3ZWJwYWNrOi8vLyh3ZWJwYWNrKS9+L25vZGUtbGlicy1icm93c2VyL34vZXZlbnRzL2V2ZW50cy5qcyIsIndlYnBhY2s6Ly8vLi9+L2xpZS9kaXN0L2xpZS5qcyIsIndlYnBhY2s6Ly8vLi9+L2RlYnVnL2RlYnVnLmpzIiwid2VicGFjazovLy8od2VicGFjaykvYnVpbGRpbi9tb2R1bGUuanMiLCJ3ZWJwYWNrOi8vLyh3ZWJwYWNrKS9+L25vZGUtbGlicy1icm93c2VyL34vcHJvY2Vzcy9icm93c2VyLmpzIiwid2VicGFjazovLy8uL34vZGVidWcvfi9tcy9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsdUJBQWU7QUFDZjtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7O0FBR0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQSx3Qzs7Ozs7OztBQ3RDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLG9DQUFtQztBQUNuQztBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0EsRUFBQzs7QUFFRDs7O0FBR0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLEVBQUM7Ozs7Ozs7QUM1RUQ7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBLGtDQUFpQyxjQUFjO0FBQy9DLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7O0FBRUE7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0E7QUFDQSxNQUFLO0FBQ0wsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FB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Q0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0EsRUFBQzs7O0FBR0Q7Ozs7Ozs7O0FDN21CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLCtCQUE4QjtBQUM5QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7Ozs7OztBQzlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFHQTtBQUNBO0FBQ0E7OztBQUdBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7Ozs7Ozs7QUMxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHOzs7Ozs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsWUFBVyxNQUFNO0FBQ2pCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7O0FBRUg7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0EsSUFBRzs7QUFFSDtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHOzs7QUFHSDs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFDOztBQUVEO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsY0FBYSxLQUFLO0FBQ2xCLGdCQUFlO0FBQ2Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxZQUFXO0FBQ1g7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQVc7QUFDWDtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUCxJQUFHO0FBQ0g7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQSxFQUFDOztBQUVEOzs7Ozs7O0FDeFFBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLFlBQVcsT0FBTztBQUNsQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsWUFBVztBQUNYO0FBQ0EsUUFBTztBQUNQO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUCxNQUFLO0FBQ0wsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUCxNQUFLO0FBQ0wsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsWUFBVztBQUNYLFVBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7O0FBRUEsTUFBSztBQUNMO0FBQ0EsRUFBQzs7QUFFRDs7Ozs7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O0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxZQUFXLE9BQU87QUFDbEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsWUFBVztBQUNYO0FBQ0EsUUFBTztBQUNQO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQVc7QUFDWCxVQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTCxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0EsZ0JBQWUsWUFBWTtBQUMzQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQSxFQUFDOztBQUVEOzs7Ozs7O0FDN0lBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsWUFBVyxPQUFPO0FBQ2xCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7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O0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQSw0Q0FBMkMsU0FBUztBQUNwRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSxnQzs7Ozs7O0FDdkpBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGNBQWE7QUFDYjtBQUNBO0FBQ0E7QUFDQTtBQUNBLGNBQWE7QUFDYixVQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBO0FBQ0EsSUFBRzs7QUFFSDtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsRUFBQzs7QUFFRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0EsSUFBRztBQUNIOztBQUVBO0FBQ0E7O0FBRUE7Ozs7Ozs7QUNwR0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBLEc7Ozs7OztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUdBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FBR0E7QUFDQTtBQUNBO0FBQ0EsdURBQXNEO0FBQ3REO0FBQ0EsVUFBUztBQUNUO0FBQ0E7QUFDQTtBQUNBLFlBQVc7QUFDWDtBQUNBO0FBQ0EsVUFBUztBQUNULFFBQU87QUFDUDtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUDtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHOztBQUVIOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxhQUFZO0FBQ1o7QUFDQTtBQUNBOzs7QUFHQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTCxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQVc7QUFDWDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0wsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFD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RUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0Esc0JBQXFCLGlCQUFpQjtBQUN0QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0Esc0JBQXFCLHNCQUFzQjtBQUMzQztBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLHNCQUFxQixzQkFBc0I7QUFDM0M7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsd0JBQXVCLG9CQUFvQjtBQUMzQztBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsOEJBQTZCO0FBQzdCO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7O0FBRUw7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7O0FBRUw7QUFDQTtBQUNBOztBQUVBO0FBQ0EsTUFBSzs7QUFFTDtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLOztBQUVMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0EsSUFBRzs7QUFFSDs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsc0JBQXFCLG9CQUFvQjtBQUN6QztBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7O0FBRUw7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7O0FBRUEsTUFBSzs7QUFFTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSzs7QUFFTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQSx5QkFBd0I7QUFDeEIsMkJBQTBCO0FBQzFCLDJCQUEwQjtBQUMxQjtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLE1BQUs7O0FBRUw7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQTtBQUNBLE1BQUs7O0FBRUw7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSzs7QUFFTDtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxJQUFHOztBQUVIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7O0FBRUE7O0FBRUE7QUFDQTtBQUNBLE1BQUs7O0FBRUw7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsSUFBRzs7QUFFSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsTUFBSztBQUNMOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBLG9CQUFtQiwwQkFBMEI7QUFDN0M7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLHNCQUFxQixjQUFjO0FBQ25DO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLHNCQUFxQixpQkFBaUI7QUFDdEM7O0FBRUEsc0JBQXFCLGNBQWM7QUFDbkMsd0JBQXVCLGlCQUFpQjtBQUN4QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQSxNQUFLOztBQUVMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsWUFBVztBQUNYO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLE1BQUs7O0FBRUw7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsUUFBTztBQUNQOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHNCQUFxQixnQkFBZ0I7QUFDckM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7O0FBRUw7QUFDQSxzQkFBcUIsa0JBQWtCO0FBQ3ZDO0FBQ0E7QUFDQTtBQUNBLE1BQUs7O0FBRUw7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsTUFBSzs7QUFFTDtBQUNBO0FBQ0E7QUFDQSxNQUFLOztBQUVMO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLDhCQUE2QjtBQUM3QjtBQUNBLDhCQUE2QjtBQUM3QixNQUFLO0FBQ0w7QUFDQTtBQUNBLDhCQUE2QjtBQUM3QjtBQUNBLDhCQUE2QjtBQUM3QjtBQUNBOztBQUVBOztBQUVBOztBQUVBO0FBQ0E7O0FBRUEsb0JBQW1CLG9CQUFvQjtBQUN2QztBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUDs7QUFFQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUEsb0JBQW1CLDBCQUEwQjtBQUM3QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxNQUFLOztBQUVMO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esc0RBQXFEO0FBQ3JEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFDOzs7Ozs7OztBQzVuQ0Q7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0EsRUFBQzs7QUFFRDs7Ozs7OztBQ3RCQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxjQUFhO0FBQ2I7QUFDQTtBQUNBO0FBQ0E7QUFDQSxjQUFhO0FBQ2IsVUFBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7QUFDQTtBQUNBLElBQUc7O0FBRUg7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLEVBQUM7O0FBRUQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTztBQUNQO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBLElBQUc7QUFDSDs7QUFFQTtBQUNBOztBQUVBOzs7Ozs7O0FDcEdBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLCtCQUE4QjtBQUM5QjtBQUNBOztBQUVBLDhCOzs7Ozs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FB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O0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7O0FBRUg7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsRzs7Ozs7OztBQzNFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxrQkFBaUI7QUFDakI7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG9CQUFtQixTQUFTO0FBQzVCO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0EsZ0JBQWUsU0FBUztBQUN4Qjs7QUFFQTtBQUNBO0FBQ0EsZ0JBQWUsU0FBUztBQUN4QjtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSxJQUFHO0FBQ0gscUJBQW9CLFNBQVM7QUFDN0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBLElBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOzs7Ozs7O3lCQzVTQSwyREFBYSwyQkFBMkUsMkRBQTJELEtBQUssTUFBTSwwSEFBMEgsWUFBWSwwQkFBMEIsMEJBQTBCLGdCQUFnQixVQUFVLFVBQVUsMENBQTBDLDhCQUF3QixvQkFBb0IsOENBQThDLGtDQUFrQyxZQUFZLFlBQVksbUNBQW1DLGlCQUFpQixnQkFBZ0Isc0JBQXNCLG9CQUFvQiwwQ0FBMEMsWUFBWSxXQUFXLFlBQVksU0FBUyxHQUFHO0FBQ2p3Qjs7QUFFQTs7QUFFQTtBQUNBLEVBQUMsR0FBRztBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFDLEVBQUUsdUVBQXVFO0FBQzFFO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBQyxFQUFFLHFEQUFxRDtBQUN4RDs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUMsRUFBRSw4REFBOEQ7QUFDakU7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFHQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTs7QUFFQTtBQUNBOztBQUVBLEVBQUMsRUFBRSxrRkFBa0Y7QUFDckY7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUMsRUFBRSw2QkFBNkI7QUFDaEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0EsRUFBQyxFQUFFLHVFQUF1RTtBQUMxRTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUMsRUFBRSw0Q0FBNEM7QUFDL0M7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFDLEVBQUUsNENBQTRDO0FBQy9DO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFDLEVBQUUsK0JBQStCO0FBQ2xDOztBQUVBO0FBQ0E7QUFDQTtBQUNBLEVBQUMsR0FBRztBQUNKOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUMsR0FBRztBQUNKOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7QUFDQSxFQUFDLEVBQUUsOEJBQThCOztBQUVqQyxFQUFDLEdBQUc7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUMsRUFBRSwyRkFBMkY7QUFDOUY7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBQyxxSUFBcUk7QUFDdEksRUFBQyxHQUFHO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBQyxxSUFBcUk7QUFDdEksRUFBQyxHQUFHO0FBQ0o7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQSxrQ0FBaUM7QUFDakM7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxFQUFDLHFJQUFxSTtBQUN0SSxFQUFDLEdBQUc7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBQyxHQUFHLEVBQUUsR0FBRztBQUNULEVBQUM7Ozs7Ozs7OztBQ3RkRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxhQUFZO0FBQ1o7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsWUFBVyxPQUFPO0FBQ2xCLGFBQVk7QUFDWjtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLOztBQUVMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxZQUFXLE9BQU87QUFDbEI7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUEsa0JBQWlCLFNBQVM7QUFDMUIsNkJBQTRCO0FBQzVCO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxZQUFXLE9BQU87QUFDbEIsYUFBWTtBQUNaO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLDBDQUF5QyxTQUFTO0FBQ2xEO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsMENBQXlDLFNBQVM7QUFDbEQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFlBQVcsTUFBTTtBQUNqQixhQUFZO0FBQ1o7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7OztBQ3BNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7OztBQ1RBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxzQkFBcUI7QUFDckI7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0EsNEJBQTJCO0FBQzNCO0FBQ0E7QUFDQTtBQUNBLDZCQUE0QixVQUFVOzs7Ozs7O0FDekR0QztBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQVcsY0FBYztBQUN6QixZQUFXLE9BQU87QUFDbEIsYUFBWTtBQUNaO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsWUFBVyxPQUFPO0FBQ2xCLGFBQVk7QUFDWjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxZQUFXLE9BQU87QUFDbEIsYUFBWTtBQUNaO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsWUFBVyxPQUFPO0FBQ2xCLGFBQVk7QUFDWjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwic291cmNlc0NvbnRlbnQiOlsiIFx0Ly8gVGhlIG1vZHVsZSBjYWNoZVxuIFx0dmFyIGluc3RhbGxlZE1vZHVsZXMgPSB7fTtcblxuIFx0Ly8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbiBcdGZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblxuIFx0XHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcbiBcdFx0aWYoaW5zdGFsbGVkTW9kdWxlc1ttb2R1bGVJZF0pXG4gXHRcdFx0cmV0dXJuIGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdLmV4cG9ydHM7XG5cbiBcdFx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcbiBcdFx0dmFyIG1vZHVsZSA9IGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdID0ge1xuIFx0XHRcdGV4cG9ydHM6IHt9LFxuIFx0XHRcdGlkOiBtb2R1bGVJZCxcbiBcdFx0XHRsb2FkZWQ6IGZhbHNlXG4gXHRcdH07XG5cbiBcdFx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG4gXHRcdG1vZHVsZXNbbW9kdWxlSWRdLmNhbGwobW9kdWxlLmV4cG9ydHMsIG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG4gXHRcdC8vIEZsYWcgdGhlIG1vZHVsZSBhcyBsb2FkZWRcbiBcdFx0bW9kdWxlLmxvYWRlZCA9IHRydWU7XG5cbiBcdFx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcbiBcdFx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xuIFx0fVxuXG5cbiBcdC8vIGV4cG9zZSB0aGUgbW9kdWxlcyBvYmplY3QgKF9fd2VicGFja19tb2R1bGVzX18pXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLm0gPSBtb2R1bGVzO1xuXG4gXHQvLyBleHBvc2UgdGhlIG1vZHVsZSBjYWNoZVxuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5jID0gaW5zdGFsbGVkTW9kdWxlcztcblxuIFx0Ly8gX193ZWJwYWNrX3B1YmxpY19wYXRoX19cbiBcdF9fd2VicGFja19yZXF1aXJlX18ucCA9IFwiXCI7XG5cbiBcdC8vIExvYWQgZW50cnkgbW9kdWxlIGFuZCByZXR1cm4gZXhwb3J0c1xuIFx0cmV0dXJuIF9fd2VicGFja19yZXF1aXJlX18oMCk7XG5cblxuLyoqIFdFQlBBQ0sgRk9PVEVSICoqXG4gKiogd2VicGFjay9ib290c3RyYXAgZjg3MTZiNjZkYzljMzUwNTQxYTlcbiAqKi8iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICBDb2xsZWN0aW9uID0gcmVxdWlyZSgnLi9jb2xsZWN0aW9uJyksXG4gIE1vZGVsID0gcmVxdWlyZSgnLi9tb2RlbCcpLFxuICBlcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKSxcbiAgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKSxcbiAgUmVsYXRpb25zaGlwVHlwZSA9IHJlcXVpcmUoJy4vUmVsYXRpb25zaGlwVHlwZScpLFxuICBSZWFjdGl2ZVF1ZXJ5ID0gcmVxdWlyZSgnLi9SZWFjdGl2ZVF1ZXJ5JyksXG4gIE1hbnlUb01hbnlQcm94eSA9IHJlcXVpcmUoJy4vTWFueVRvTWFueVByb3h5JyksXG4gIEFwcCA9IHJlcXVpcmUoJy4vQXBwJyksXG4gIE9uZVRvT25lUHJveHkgPSByZXF1aXJlKCcuL09uZVRvT25lUHJveHknKSxcbiAgT25lVG9NYW55UHJveHkgPSByZXF1aXJlKCcuL09uZVRvTWFueVByb3h5JyksXG4gIFJlbGF0aW9uc2hpcFByb3h5ID0gcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBQcm94eScpLFxuICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgUXVlcnkgPSByZXF1aXJlKCcuL1F1ZXJ5JyksXG4gIHF1ZXJ5U2V0ID0gcmVxdWlyZSgnLi9RdWVyeVNldCcpLFxuICBDb25kaXRpb24gPSByZXF1aXJlKCcuL0NvbmRpdGlvbicpLFxuICBsb2cgPSByZXF1aXJlKCcuL2xvZycpO1xuXG51dGlsLl9wYXRjaEJpbmQoKTtcblxuLy8gSW5pdGlhbGlzZSBzaWVzdGEgb2JqZWN0LiBTdHJhbmdlIGZvcm1hdCBmYWNpbGl0aWVzIHVzaW5nIHN1Ym1vZHVsZXMgd2l0aCByZXF1aXJlSlMgKGV2ZW50dWFsbHkpXG52YXIgc2llc3RhID0gZnVuY3Rpb24oZXh0KSB7XG4gIGlmICghc2llc3RhLmV4dCkgc2llc3RhLmV4dCA9IHt9O1xuICB1dGlsLmV4dGVuZChzaWVzdGEuZXh0LCBleHQgfHwge30pO1xuICByZXR1cm4gc2llc3RhO1xufTtcblxuc2llc3RhLmNyZWF0ZUFwcCA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgcmV0dXJuIG5ldyBBcHAobmFtZSk7XG59O1xuXG4vLyBFeHBvc2Ugc29tZSBzdHVmZiBmb3IgdXNhZ2UgYnkgZXh0ZW5zaW9ucyBhbmQvb3IgdXNlcnNcbnV0aWwuZXh0ZW5kKHNpZXN0YSwge1xuICBSZWxhdGlvbnNoaXBUeXBlOiBSZWxhdGlvbnNoaXBUeXBlLFxuICBNb2RlbEV2ZW50VHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUsXG4gIGxvZzogbG9nLkxldmVsLFxuICBJbnNlcnRpb25Qb2xpY3k6IFJlYWN0aXZlUXVlcnkuSW5zZXJ0aW9uUG9saWN5LFxuICBfaW50ZXJuYWw6IHtcbiAgICBsb2c6IGxvZyxcbiAgICBDb25kaXRpb246IENvbmRpdGlvbixcbiAgICBNb2RlbDogTW9kZWwsXG4gICAgZXJyb3I6IGVycm9yLFxuICAgIE1vZGVsRXZlbnRUeXBlOiBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZSxcbiAgICBNb2RlbEluc3RhbmNlOiByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKSxcbiAgICBleHRlbmQ6IHJlcXVpcmUoJ2V4dGVuZCcpLFxuICAgIE1hcHBpbmdPcGVyYXRpb246IHJlcXVpcmUoJy4vbWFwcGluZ09wZXJhdGlvbicpLFxuICAgIGV2ZW50czogZXZlbnRzLFxuICAgIFByb3h5RXZlbnRFbWl0dGVyOiByZXF1aXJlKCcuL1Byb3h5RXZlbnRFbWl0dGVyJyksXG4gICAgbW9kZWxFdmVudHM6IG1vZGVsRXZlbnRzLFxuICAgIENvbGxlY3Rpb246IENvbGxlY3Rpb24sXG4gICAgdXRpbHM6IHV0aWwsXG4gICAgdXRpbDogdXRpbCxcbiAgICBxdWVyeVNldDogcXVlcnlTZXQsXG4gICAgb2JzZXJ2ZTogcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKSxcbiAgICBRdWVyeTogUXVlcnksXG4gICAgTWFueVRvTWFueVByb3h5OiBNYW55VG9NYW55UHJveHksXG4gICAgT25lVG9NYW55UHJveHk6IE9uZVRvTWFueVByb3h5LFxuICAgIE9uZVRvT25lUHJveHk6IE9uZVRvT25lUHJveHksXG4gICAgUmVsYXRpb25zaGlwUHJveHk6IFJlbGF0aW9uc2hpcFByb3h5XG4gIH0sXG4gIGlzQXJyYXk6IHV0aWwuaXNBcnJheSxcbiAgaXNTdHJpbmc6IHV0aWwuaXNTdHJpbmdcbn0pO1xuXG5zaWVzdGEuZXh0ID0ge307XG5cblxuaWYgKHR5cGVvZiB3aW5kb3cgIT0gJ3VuZGVmaW5lZCcpIHtcbiAgd2luZG93WydzaWVzdGEnXSA9IHNpZXN0YTtcbn1cblxuc2llc3RhLmxvZyA9IHJlcXVpcmUoJ2RlYnVnJyk7XG5tb2R1bGUuZXhwb3J0cyA9IHNpZXN0YTtcblxuKGZ1bmN0aW9uIGxvYWRFeHRlbnNpb25zKCkge1xuICByZXF1aXJlKCcuLi9zdG9yYWdlJyk7XG59KSgpO1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvaW5kZXguanNcbiAqKiBtb2R1bGUgaWQgPSAwXG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgb2JzZXJ2ZSA9IHJlcXVpcmUoJy4uL3ZlbmRvci9vYnNlcnZlLWpzL3NyYy9vYnNlcnZlJykuUGxhdGZvcm0sXG4gIFByb21pc2UgPSByZXF1aXJlKCdsaWUnKSxcbiAgYXJnc2FycmF5ID0gcmVxdWlyZSgnYXJnc2FycmF5JyksXG4gIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcjtcblxudmFyIGV4dGVuZCA9IGZ1bmN0aW9uKGxlZnQsIHJpZ2h0KSB7XG4gIGZvciAodmFyIHByb3AgaW4gcmlnaHQpIHtcbiAgICBpZiAocmlnaHQuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgIGxlZnRbcHJvcF0gPSByaWdodFtwcm9wXTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGxlZnQ7XG59O1xuXG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXksXG4gIGlzU3RyaW5nID0gZnVuY3Rpb24obykge1xuICAgIHJldHVybiB0eXBlb2YgbyA9PSAnc3RyaW5nJyB8fCBvIGluc3RhbmNlb2YgU3RyaW5nXG4gIH07XG5cbmV4dGVuZChtb2R1bGUuZXhwb3J0cywge1xuICBhcmdzYXJyYXk6IGFyZ3NhcnJheSxcbiAgLyoqXG4gICAqIFBlcmZvcm1zIGRpcnR5IGNoZWNrL09iamVjdC5vYnNlcnZlIGNhbGxiYWNrcyBkZXBlbmRpbmcgb24gdGhlIGJyb3dzZXIuXG4gICAqXG4gICAqIElmIE9iamVjdC5vYnNlcnZlIGlzIHByZXNlbnQsXG4gICAqIEBwYXJhbSBjYWxsYmFja1xuICAgKi9cbiAgbmV4dDogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICBvYnNlcnZlLnBlcmZvcm1NaWNyb3Rhc2tDaGVja3BvaW50KCk7XG4gICAgc2V0VGltZW91dChjYWxsYmFjayk7XG4gIH0sXG4gIGV4dGVuZDogZXh0ZW5kLFxuICBndWlkOiAoZnVuY3Rpb24oKSB7XG4gICAgZnVuY3Rpb24gczQoKSB7XG4gICAgICByZXR1cm4gTWF0aC5mbG9vcigoMSArIE1hdGgucmFuZG9tKCkpICogMHgxMDAwMClcbiAgICAgICAgLnRvU3RyaW5nKDE2KVxuICAgICAgICAuc3Vic3RyaW5nKDEpO1xuICAgIH1cblxuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBzNCgpICsgczQoKSArICctJyArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICtcbiAgICAgICAgczQoKSArICctJyArIHM0KCkgKyBzNCgpICsgczQoKTtcbiAgICB9O1xuICB9KSgpLFxuICBhc3NlcnQ6IGZ1bmN0aW9uKGNvbmRpdGlvbiwgbWVzc2FnZSwgY29udGV4dCkge1xuICAgIGlmICghY29uZGl0aW9uKSB7XG4gICAgICBtZXNzYWdlID0gbWVzc2FnZSB8fCBcIkFzc2VydGlvbiBmYWlsZWRcIjtcbiAgICAgIGNvbnRleHQgPSBjb250ZXh0IHx8IHt9O1xuICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IobWVzc2FnZSwgY29udGV4dCk7XG4gICAgfVxuICB9LFxuICBwbHVjazogZnVuY3Rpb24oY29sbCwga2V5KSB7XG4gICAgcmV0dXJuIGNvbGwubWFwKGZ1bmN0aW9uKG8pIHtyZXR1cm4gb1trZXldfSk7XG4gIH0sXG4gIHRoZW5CeTogKGZ1bmN0aW9uKCkge1xuICAgIC8qIG1peGluIGZvciB0aGUgYHRoZW5CeWAgcHJvcGVydHkgKi9cbiAgICBmdW5jdGlvbiBleHRlbmQoZikge1xuICAgICAgZi50aGVuQnkgPSB0YjtcbiAgICAgIHJldHVybiBmO1xuICAgIH1cblxuICAgIC8qIGFkZHMgYSBzZWNvbmRhcnkgY29tcGFyZSBmdW5jdGlvbiB0byB0aGUgdGFyZ2V0IGZ1bmN0aW9uIChgdGhpc2AgY29udGV4dClcbiAgICAgd2hpY2ggaXMgYXBwbGllZCBpbiBjYXNlIHRoZSBmaXJzdCBvbmUgcmV0dXJucyAwIChlcXVhbClcbiAgICAgcmV0dXJucyBhIG5ldyBjb21wYXJlIGZ1bmN0aW9uLCB3aGljaCBoYXMgYSBgdGhlbkJ5YCBtZXRob2QgYXMgd2VsbCAqL1xuICAgIGZ1bmN0aW9uIHRiKHkpIHtcbiAgICAgIHZhciB4ID0gdGhpcztcbiAgICAgIHJldHVybiBleHRlbmQoZnVuY3Rpb24oYSwgYikge1xuICAgICAgICByZXR1cm4geChhLCBiKSB8fCB5KGEsIGIpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGV4dGVuZDtcbiAgfSkoKSxcbiAgLyoqXG4gICAqIFRPRE86IFRoaXMgaXMgYmxvb2R5IHVnbHkuXG4gICAqIFByZXR0eSBkYW1uIHVzZWZ1bCB0byBiZSBhYmxlIHRvIGFjY2VzcyB0aGUgYm91bmQgb2JqZWN0IG9uIGEgZnVuY3Rpb24gdGhvLlxuICAgKiBTZWU6IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMTQzMDcyNjQvd2hhdC1vYmplY3QtamF2YXNjcmlwdC1mdW5jdGlvbi1pcy1ib3VuZC10by13aGF0LWlzLWl0cy10aGlzXG4gICAqL1xuICBfcGF0Y2hCaW5kOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgX2JpbmQgPSBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHkuYmluZChGdW5jdGlvbi5wcm90b3R5cGUuYmluZCk7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KEZ1bmN0aW9uLnByb3RvdHlwZSwgJ2JpbmQnLCB7XG4gICAgICB2YWx1ZTogZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIHZhciBib3VuZEZ1bmN0aW9uID0gX2JpbmQodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGJvdW5kRnVuY3Rpb24sICdfX3NpZXN0YV9ib3VuZF9vYmplY3QnLCB7XG4gICAgICAgICAgdmFsdWU6IG9iaixcbiAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgZW51bWVyYWJsZTogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBib3VuZEZ1bmN0aW9uO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuICBQcm9taXNlOiBQcm9taXNlLFxuICBwcm9taXNlOiBmdW5jdGlvbihjYiwgZm4pIHtcbiAgICBjYiA9IGNiIHx8IGZ1bmN0aW9uKCkge307XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgdmFyIF9jYiA9IGFyZ3NhcnJheShmdW5jdGlvbihhcmdzKSB7XG4gICAgICAgIHZhciBlcnIgPSBhcmdzWzBdLFxuICAgICAgICAgIHJlc3QgPSBhcmdzLnNsaWNlKDEpO1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignVW5jYXVnaHQgZXJyb3IgZHVyaW5nIHByb21pc2UgcmVqZWN0aW9uJywgZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXNvbHZlKHJlc3RbMF0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgcmVqZWN0KGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignVW5jYXVnaHQgZXJyb3IgZHVyaW5nIHByb21pc2UgcmVqZWN0aW9uJywgZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHZhciBib3VuZCA9IGNiWydfX3NpZXN0YV9ib3VuZF9vYmplY3QnXSB8fCBjYjsgLy8gUHJlc2VydmUgYm91bmQgb2JqZWN0LlxuICAgICAgICBjYi5hcHBseShib3VuZCwgYXJncyk7XG4gICAgICB9KTtcbiAgICAgIGZuKF9jYik7XG4gICAgfSlcbiAgfSxcbiAgZGVmZXI6IGZ1bmN0aW9uKCkge1xuICAgIHZhciByZXNvbHZlLCByZWplY3Q7XG4gICAgdmFyIHAgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihfcmVzb2x2ZSwgX3JlamVjdCkge1xuICAgICAgcmVzb2x2ZSA9IF9yZXNvbHZlO1xuICAgICAgcmVqZWN0ID0gX3JlamVjdDtcbiAgICB9KTtcbiAgICAvL25vaW5zcGVjdGlvbiBKU1VudXNlZEFzc2lnbm1lbnRcbiAgICBwLnJlc29sdmUgPSByZXNvbHZlO1xuICAgIC8vbm9pbnNwZWN0aW9uIEpTVW51c2VkQXNzaWdubWVudFxuICAgIHAucmVqZWN0ID0gcmVqZWN0O1xuICAgIHJldHVybiBwO1xuICB9LFxuICBzdWJQcm9wZXJ0aWVzOiBmdW5jdGlvbihvYmosIHN1Yk9iaiwgcHJvcGVydGllcykge1xuICAgIGlmICghaXNBcnJheShwcm9wZXJ0aWVzKSkge1xuICAgICAgcHJvcGVydGllcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgfVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcGVydGllcy5sZW5ndGg7IGkrKykge1xuICAgICAgKGZ1bmN0aW9uKHByb3BlcnR5KSB7XG4gICAgICAgIHZhciBvcHRzID0ge1xuICAgICAgICAgIHNldDogZmFsc2UsXG4gICAgICAgICAgbmFtZTogcHJvcGVydHksXG4gICAgICAgICAgcHJvcGVydHk6IHByb3BlcnR5XG4gICAgICAgIH07XG4gICAgICAgIGlmICghaXNTdHJpbmcocHJvcGVydHkpKSB7XG4gICAgICAgICAgZXh0ZW5kKG9wdHMsIHByb3BlcnR5KTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgZGVzYyA9IHtcbiAgICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIHN1Yk9ialtvcHRzLnByb3BlcnR5XTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgIH07XG4gICAgICAgIGlmIChvcHRzLnNldCkge1xuICAgICAgICAgIGRlc2Muc2V0ID0gZnVuY3Rpb24odikge1xuICAgICAgICAgICAgc3ViT2JqW29wdHMucHJvcGVydHldID0gdjtcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIG9wdHMubmFtZSwgZGVzYyk7XG4gICAgICB9KShwcm9wZXJ0aWVzW2ldKTtcbiAgICB9XG4gIH0sXG4gIGNhcGl0YWxpc2VGaXJzdExldHRlcjogZnVuY3Rpb24oc3RyaW5nKSB7XG4gICAgcmV0dXJuIHN0cmluZy5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHN0cmluZy5zbGljZSgxKTtcbiAgfSxcbiAgZXh0ZW5kRnJvbU9wdHM6IGZ1bmN0aW9uKG9iaiwgb3B0cywgZGVmYXVsdHMsIGVycm9yT25Vbmtub3duKSB7XG4gICAgZXJyb3JPblVua25vd24gPSBlcnJvck9uVW5rbm93biA9PSB1bmRlZmluZWQgPyB0cnVlIDogZXJyb3JPblVua25vd247XG4gICAgaWYgKGVycm9yT25Vbmtub3duKSB7XG4gICAgICB2YXIgZGVmYXVsdEtleXMgPSBPYmplY3Qua2V5cyhkZWZhdWx0cyksXG4gICAgICAgIG9wdHNLZXlzID0gT2JqZWN0LmtleXMob3B0cyk7XG4gICAgICB2YXIgdW5rbm93bktleXMgPSBvcHRzS2V5cy5maWx0ZXIoZnVuY3Rpb24obikge1xuICAgICAgICByZXR1cm4gZGVmYXVsdEtleXMuaW5kZXhPZihuKSA9PSAtMVxuICAgICAgfSk7XG4gICAgICBpZiAodW5rbm93bktleXMubGVuZ3RoKSB0aHJvdyBFcnJvcignVW5rbm93biBvcHRpb25zOiAnICsgdW5rbm93bktleXMudG9TdHJpbmcoKSk7XG4gICAgfVxuICAgIC8vIEFwcGx5IGFueSBmdW5jdGlvbnMgc3BlY2lmaWVkIGluIHRoZSBkZWZhdWx0cy5cbiAgICBPYmplY3Qua2V5cyhkZWZhdWx0cykuZm9yRWFjaChmdW5jdGlvbihrKSB7XG4gICAgICB2YXIgZCA9IGRlZmF1bHRzW2tdO1xuICAgICAgaWYgKHR5cGVvZiBkID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgZGVmYXVsdHNba10gPSBkKG9wdHNba10pO1xuICAgICAgICBkZWxldGUgb3B0c1trXTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBleHRlbmQoZGVmYXVsdHMsIG9wdHMpO1xuICAgIGV4dGVuZChvYmosIGRlZmF1bHRzKTtcbiAgfSxcbiAgaXNTdHJpbmc6IGlzU3RyaW5nLFxuICBpc0FycmF5OiBpc0FycmF5LFxuICBwcmV0dHlQcmludDogZnVuY3Rpb24obykge1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShvLCBudWxsLCA0KTtcbiAgfSxcbiAgZmxhdHRlbkFycmF5OiBmdW5jdGlvbihhcnIpIHtcbiAgICByZXR1cm4gYXJyLnJlZHVjZShmdW5jdGlvbihtZW1vLCBlKSB7XG4gICAgICBpZiAoaXNBcnJheShlKSkge1xuICAgICAgICBtZW1vID0gbWVtby5jb25jYXQoZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBtZW1vLnB1c2goZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbWVtbztcbiAgICB9LCBbXSk7XG4gIH0sXG4gIHVuZmxhdHRlbkFycmF5OiBmdW5jdGlvbihhcnIsIG1vZGVsQXJyKSB7XG4gICAgdmFyIG4gPSAwO1xuICAgIHZhciB1bmZsYXR0ZW5lZCA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbW9kZWxBcnIubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChpc0FycmF5KG1vZGVsQXJyW2ldKSkge1xuICAgICAgICB2YXIgbmV3QXJyID0gW107XG4gICAgICAgIHVuZmxhdHRlbmVkW2ldID0gbmV3QXJyO1xuICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IG1vZGVsQXJyW2ldLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgbmV3QXJyLnB1c2goYXJyW25dKTtcbiAgICAgICAgICBuKys7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHVuZmxhdHRlbmVkW2ldID0gYXJyW25dO1xuICAgICAgICBuKys7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB1bmZsYXR0ZW5lZDtcbiAgfVxufSk7XG5cbi8qKlxuICogQ29tcGFjdCBhIHNwYXJzZSBhcnJheVxuICogQHBhcmFtIGFyclxuICogQHJldHVybnMge0FycmF5fVxuICovXG5mdW5jdGlvbiBjb21wYWN0KGFycikge1xuICBhcnIgPSBhcnIgfHwgW107XG4gIHJldHVybiBhcnIuZmlsdGVyKGZ1bmN0aW9uKHgpIHtyZXR1cm4geH0pO1xufVxuXG4vKipcbiAqIEV4ZWN1dGUgdGFza3MgaW4gcGFyYWxsZWxcbiAqIEBwYXJhbSB0YXNrc1xuICogQHBhcmFtIGNiXG4gKi9cbmZ1bmN0aW9uIHBhcmFsbGVsKHRhc2tzLCBjYikge1xuICBjYiA9IGNiIHx8IGZ1bmN0aW9uKCkge307XG4gIGlmICh0YXNrcyAmJiB0YXNrcy5sZW5ndGgpIHtcbiAgICB2YXIgcmVzdWx0cyA9IFtdLCBlcnJvcnMgPSBbXSwgbnVtRmluaXNoZWQgPSAwO1xuICAgIHRhc2tzLmZvckVhY2goZnVuY3Rpb24oZm4sIGlkeCkge1xuICAgICAgcmVzdWx0c1tpZHhdID0gZmFsc2U7XG4gICAgICBmbihmdW5jdGlvbihlcnIsIHJlcykge1xuICAgICAgICBudW1GaW5pc2hlZCsrO1xuICAgICAgICBpZiAoZXJyKSBlcnJvcnNbaWR4XSA9IGVycjtcbiAgICAgICAgcmVzdWx0c1tpZHhdID0gcmVzO1xuICAgICAgICBpZiAobnVtRmluaXNoZWQgPT0gdGFza3MubGVuZ3RoKSB7XG4gICAgICAgICAgY2IoXG4gICAgICAgICAgICBlcnJvcnMubGVuZ3RoID8gY29tcGFjdChlcnJvcnMpIDogbnVsbCxcbiAgICAgICAgICAgIGNvbXBhY3QocmVzdWx0cyksXG4gICAgICAgICAgICB7cmVzdWx0czogcmVzdWx0cywgZXJyb3JzOiBlcnJvcnN9XG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH0gZWxzZSBjYigpO1xufVxuXG4vKipcbiAqIEV4ZWN1dGUgdGFza3Mgb25lIGFmdGVyIGFub3RoZXJcbiAqIEBwYXJhbSB0YXNrc1xuICogQHBhcmFtIGNiXG4gKi9cbmZ1bmN0aW9uIHNlcmllcyh0YXNrcywgY2IpIHtcbiAgY2IgPSBjYiB8fCBmdW5jdGlvbigpIHt9O1xuICBpZiAodGFza3MgJiYgdGFza3MubGVuZ3RoKSB7XG4gICAgdmFyIHJlc3VsdHMgPSBbXSwgZXJyb3JzID0gW10sIGlkeCA9IDA7XG5cbiAgICBmdW5jdGlvbiBleGVjdXRlVGFzayh0YXNrKSB7XG4gICAgICB0YXNrKGZ1bmN0aW9uKGVyciwgcmVzKSB7XG4gICAgICAgIGlmIChlcnIpIGVycm9yc1tpZHhdID0gZXJyO1xuICAgICAgICByZXN1bHRzW2lkeF0gPSByZXM7XG4gICAgICAgIGlmICghdGFza3MubGVuZ3RoKSB7XG4gICAgICAgICAgY2IoXG4gICAgICAgICAgICBlcnJvcnMubGVuZ3RoID8gY29tcGFjdChlcnJvcnMpIDogbnVsbCxcbiAgICAgICAgICAgIGNvbXBhY3QocmVzdWx0cyksXG4gICAgICAgICAgICB7cmVzdWx0czogcmVzdWx0cywgZXJyb3JzOiBlcnJvcnN9XG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBpZHgrKztcbiAgICAgICAgICBuZXh0VGFzaygpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBuZXh0VGFzaygpIHtcbiAgICAgIHZhciBuZXh0VGFzayA9IHRhc2tzLnNoaWZ0KCk7XG4gICAgICBleGVjdXRlVGFzayhuZXh0VGFzayk7XG4gICAgfVxuXG4gICAgbmV4dFRhc2soKTtcblxuICB9IGVsc2UgY2IoKTtcbn1cblxuXG5leHRlbmQobW9kdWxlLmV4cG9ydHMsIHtcbiAgY29tcGFjdDogY29tcGFjdCxcbiAgcGFyYWxsZWw6IHBhcmFsbGVsLFxuICBzZXJpZXM6IHNlcmllc1xufSk7XG5cbnZhciBGTl9BUkdTID0gL15mdW5jdGlvblxccypbXlxcKF0qXFwoXFxzKihbXlxcKV0qKVxcKS9tLFxuICBGTl9BUkdfU1BMSVQgPSAvLC8sXG4gIEZOX0FSRyA9IC9eXFxzKihfPykoLis/KVxcMVxccyokLyxcbiAgU1RSSVBfQ09NTUVOVFMgPSAvKChcXC9cXC8uKiQpfChcXC9cXCpbXFxzXFxTXSo/XFwqXFwvKSkvbWc7XG5cbmV4dGVuZChtb2R1bGUuZXhwb3J0cywge1xuICAvKipcbiAgICogUmV0dXJuIHRoZSBwYXJhbWV0ZXIgbmFtZXMgb2YgYSBmdW5jdGlvbi5cbiAgICogTm90ZTogYWRhcHRlZCBmcm9tIEFuZ3VsYXJKUyBkZXBlbmRlbmN5IGluamVjdGlvbiA6KVxuICAgKiBAcGFyYW0gZm5cbiAgICovXG4gIHBhcmFtTmFtZXM6IGZ1bmN0aW9uKGZuKSB7XG4gICAgLy8gVE9ETzogSXMgdGhlcmUgYSBtb3JlIHJvYnVzdCB3YXkgb2YgZG9pbmcgdGhpcz9cbiAgICB2YXIgcGFyYW1zID0gW10sXG4gICAgICBmblRleHQsXG4gICAgICBhcmdEZWNsO1xuICAgIGZuVGV4dCA9IGZuLnRvU3RyaW5nKCkucmVwbGFjZShTVFJJUF9DT01NRU5UUywgJycpO1xuICAgIGFyZ0RlY2wgPSBmblRleHQubWF0Y2goRk5fQVJHUyk7XG5cbiAgICBhcmdEZWNsWzFdLnNwbGl0KEZOX0FSR19TUExJVCkuZm9yRWFjaChmdW5jdGlvbihhcmcpIHtcbiAgICAgIGFyZy5yZXBsYWNlKEZOX0FSRywgZnVuY3Rpb24oYWxsLCB1bmRlcnNjb3JlLCBuYW1lKSB7XG4gICAgICAgIHBhcmFtcy5wdXNoKG5hbWUpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHBhcmFtcztcbiAgfVxufSk7XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvdXRpbC5qc1xuICoqIG1vZHVsZSBpZCA9IDFcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdjb2xsZWN0aW9uJyksXG4gIENvbGxlY3Rpb25SZWdpc3RyeSA9IHJlcXVpcmUoJy4vY29sbGVjdGlvblJlZ2lzdHJ5JyksXG4gIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgTW9kZWwgPSByZXF1aXJlKCcuL21vZGVsJyksXG4gIGV4dGVuZCA9IHJlcXVpcmUoJ2V4dGVuZCcpLFxuICBQcm94eUV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJy4vUHJveHlFdmVudEVtaXR0ZXInKSxcbiAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICBlcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKSxcbiAgYXJnc2FycmF5ID0gcmVxdWlyZSgnYXJnc2FycmF5JyksXG4gIENvbmRpdGlvbiA9IHJlcXVpcmUoJy4vY29uZGl0aW9uJyk7XG5cblxuLyoqXG4gKiBBIGNvbGxlY3Rpb24gZGVzY3JpYmVzIGEgc2V0IG9mIG1vZGVscyBhbmQgb3B0aW9uYWxseSBhIFJFU1QgQVBJIHdoaWNoIHdlIHdvdWxkXG4gKiBsaWtlIHRvIG1vZGVsLlxuICpcbiAqIEBwYXJhbSBuYW1lXG4gKiBAcGFyYW0gb3B0c1xuICogQGNvbnN0cnVjdG9yXG4gKlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGBqc1xuICogdmFyIEdpdEh1YiA9IG5ldyBzaWVzdGEoJ0dpdEh1YicpXG4gKiAvLyAuLi4gY29uZmlndXJlIG1hcHBpbmdzLCBkZXNjcmlwdG9ycyBldGMgLi4uXG4gKiBHaXRIdWIuaW5zdGFsbChmdW5jdGlvbiAoKSB7XG4gICAgICogICAgIC8vIC4uLiBjYXJyeSBvbi5cbiAgICAgKiB9KTtcbiAqIGBgYFxuICovXG5mdW5jdGlvbiBDb2xsZWN0aW9uKG5hbWUsIG9wdHMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBpZiAoIW5hbWUpIHRocm93IG5ldyBFcnJvcignQ29sbGVjdGlvbiBtdXN0IGhhdmUgYSBuYW1lJyk7XG5cbiAgb3B0cyA9IG9wdHMgfHwge307XG4gIHV0aWwuZXh0ZW5kRnJvbU9wdHModGhpcywgb3B0cywge1xuICAgIGFwcDogbnVsbFxuICB9KTtcblxuICB1dGlsLmV4dGVuZCh0aGlzLCB7XG4gICAgbmFtZTogbmFtZSxcbiAgICBfcmF3TW9kZWxzOiB7fSxcbiAgICBfbW9kZWxzOiB7fSxcbiAgICBfb3B0czogb3B0cyxcbiAgICBpbnN0YWxsZWQ6IGZhbHNlXG4gIH0pO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICBkaXJ0eToge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMuYXBwLnN0b3JhZ2VFbmFibGVkKSB7XG4gICAgICAgICAgdmFyIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uID0gdGhpcy5hcHAuc3RvcmFnZS5fdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24sXG4gICAgICAgICAgICBoYXNoID0gdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bc2VsZi5uYW1lXSB8fCB7fTtcbiAgICAgICAgICByZXR1cm4gISFPYmplY3Qua2V5cyhoYXNoKS5sZW5ndGg7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgfSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9LFxuICAgIG1vZGVsczoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX21vZGVscykubWFwKGZ1bmN0aW9uKG1vZGVsTmFtZSkge1xuICAgICAgICAgIHJldHVybiB0aGlzLl9tb2RlbHNbbW9kZWxOYW1lXTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuXG4gIHRoaXMuYXBwLmNvbGxlY3Rpb25SZWdpc3RyeS5yZWdpc3Rlcih0aGlzKTtcbiAgdGhpcy5fbWFrZUF2YWlsYWJsZU9uUm9vdCgpO1xuICBQcm94eUV2ZW50RW1pdHRlci5jYWxsKHRoaXMsIHRoaXMuYXBwLCB0aGlzLm5hbWUpO1xuXG59XG5cbkNvbGxlY3Rpb24ucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShQcm94eUV2ZW50RW1pdHRlci5wcm90b3R5cGUpO1xuXG51dGlsLmV4dGVuZChDb2xsZWN0aW9uLnByb3RvdHlwZSwge1xuICAvKipcbiAgICogTWVhbnMgdGhhdCB3ZSBjYW4gYWNjZXNzIHRoZSBjb2xsZWN0aW9uIG9uIHRoZSBzaWVzdGEgb2JqZWN0LlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX21ha2VBdmFpbGFibGVPblJvb3Q6IGZ1bmN0aW9uKCkge1xuICAgIHNpZXN0YVt0aGlzLm5hbWVdID0gdGhpcztcbiAgfSxcblxuICBfbW9kZWw6IGZ1bmN0aW9uKG5hbWUsIG9wdHMpIHtcbiAgICBpZiAobmFtZSkge1xuICAgICAgdGhpcy5fcmF3TW9kZWxzW25hbWVdID0gb3B0cztcbiAgICAgIG9wdHMgPSBleHRlbmQodHJ1ZSwge30sIG9wdHMpO1xuICAgICAgb3B0cy5uYW1lID0gbmFtZTtcbiAgICAgIG9wdHMuY29sbGVjdGlvbiA9IHRoaXM7XG4gICAgICB2YXIgbW9kZWwgPSBuZXcgTW9kZWwob3B0cyk7XG4gICAgICB0aGlzLl9tb2RlbHNbbmFtZV0gPSBtb2RlbDtcbiAgICAgIHRoaXNbbmFtZV0gPSBtb2RlbDtcbiAgICAgIHJldHVybiBtb2RlbDtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIG5hbWUgc3BlY2lmaWVkIHdoZW4gY3JlYXRpbmcgbWFwcGluZycpO1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogUmVnaXN0ZXJzIGEgbW9kZWwgd2l0aCB0aGlzIGNvbGxlY3Rpb24uXG4gICAqL1xuICBtb2RlbDogYXJnc2FycmF5KGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICBpZiAoYXJncy5sZW5ndGgpIHtcbiAgICAgIGlmIChhcmdzLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgIGlmICh1dGlsLmlzQXJyYXkoYXJnc1swXSkpIHtcbiAgICAgICAgICByZXR1cm4gYXJnc1swXS5tYXAoZnVuY3Rpb24obSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX21vZGVsKG0ubmFtZSwgbSk7XG4gICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YXIgbmFtZSwgb3B0cztcbiAgICAgICAgICBpZiAodXRpbC5pc1N0cmluZyhhcmdzWzBdKSkge1xuICAgICAgICAgICAgbmFtZSA9IGFyZ3NbMF07XG4gICAgICAgICAgICBvcHRzID0ge307XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgb3B0cyA9IGFyZ3NbMF07XG4gICAgICAgICAgICBuYW1lID0gb3B0cy5uYW1lO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gdGhpcy5fbW9kZWwobmFtZSwgb3B0cyk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICh0eXBlb2YgYXJnc1swXSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgIHJldHVybiB0aGlzLl9tb2RlbChhcmdzWzBdLCBhcmdzWzFdKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gYXJncy5tYXAoZnVuY3Rpb24obSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX21vZGVsKG0ubmFtZSwgbSk7XG4gICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9KSxcblxuICAvKipcbiAgICogRHVtcCB0aGlzIGNvbGxlY3Rpb24gYXMgSlNPTlxuICAgKiBAcGFyYW0gIHtCb29sZWFufSBhc0pzb24gV2hldGhlciBvciBub3QgdG8gYXBwbHkgSlNPTi5zdHJpbmdpZnlcbiAgICogQHJldHVybiB7U3RyaW5nfE9iamVjdH1cbiAgICogQGNsYXNzIENvbGxlY3Rpb25cbiAgICovXG4gIF9kdW1wOiBmdW5jdGlvbihhc0pzb24pIHtcbiAgICB2YXIgb2JqID0ge307XG4gICAgb2JqLmluc3RhbGxlZCA9IHRoaXMuaW5zdGFsbGVkO1xuICAgIG9iai5kb2NJZCA9IHRoaXMuX2RvY0lkO1xuICAgIG9iai5uYW1lID0gdGhpcy5uYW1lO1xuICAgIHJldHVybiBhc0pzb24gPyB1dGlsLnByZXR0eVByaW50KG9iaikgOiBvYmo7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIG51bWJlciBvZiBvYmplY3RzIGluIHRoaXMgY29sbGVjdGlvbi5cbiAgICpcbiAgICogQHBhcmFtIGNiXG4gICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgKi9cbiAgY291bnQ6IGZ1bmN0aW9uKGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIHZhciB0YXNrcyA9IE9iamVjdC5rZXlzKHRoaXMuX21vZGVscykubWFwKGZ1bmN0aW9uKG1vZGVsTmFtZSkge1xuICAgICAgICB2YXIgbSA9IHRoaXMuX21vZGVsc1ttb2RlbE5hbWVdO1xuICAgICAgICByZXR1cm4gbS5jb3VudC5iaW5kKG0pO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgIHV0aWwucGFyYWxsZWwodGFza3MsIGZ1bmN0aW9uKGVyciwgbnMpIHtcbiAgICAgICAgdmFyIG47XG4gICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgbiA9IG5zLnJlZHVjZShmdW5jdGlvbihtLCByKSB7XG4gICAgICAgICAgICByZXR1cm4gbSArIHJcbiAgICAgICAgICB9LCAwKTtcbiAgICAgICAgfVxuICAgICAgICBjYihlcnIsIG4pO1xuICAgICAgfSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcblxuICBncmFwaDogZnVuY3Rpb24oZGF0YSwgb3B0cywgY2IpIHtcbiAgICBpZiAodHlwZW9mIG9wdHMgPT0gJ2Z1bmN0aW9uJykgY2IgPSBvcHRzO1xuICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICB2YXIgdGFza3MgPSBbXSwgZXJyO1xuICAgICAgZm9yICh2YXIgbW9kZWxOYW1lIGluIGRhdGEpIHtcbiAgICAgICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkobW9kZWxOYW1lKSkge1xuICAgICAgICAgIHZhciBtb2RlbCA9IHRoaXMuX21vZGVsc1ttb2RlbE5hbWVdO1xuICAgICAgICAgIGlmIChtb2RlbCkge1xuICAgICAgICAgICAgKGZ1bmN0aW9uKG1vZGVsLCBkYXRhKSB7XG4gICAgICAgICAgICAgIHRhc2tzLnB1c2goZnVuY3Rpb24oZG9uZSkge1xuICAgICAgICAgICAgICAgIG1vZGVsLmdyYXBoKGRhdGEsIGZ1bmN0aW9uKGVyciwgbW9kZWxzKSB7XG4gICAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmVzdWx0cyA9IHt9O1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRzW21vZGVsLm5hbWVdID0gbW9kZWxzO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgZG9uZShlcnIsIHJlc3VsdHMpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pKG1vZGVsLCBkYXRhW21vZGVsTmFtZV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGVyciA9ICdObyBzdWNoIG1vZGVsIFwiJyArIG1vZGVsTmFtZSArICdcIic7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoIWVycikge1xuICAgICAgICB1dGlsLnNlcmllcyh0YXNrcywgZnVuY3Rpb24oZXJyLCByZXN1bHRzKSB7XG4gICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLnJlZHVjZShmdW5jdGlvbihtZW1vLCByZXMpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHV0aWwuZXh0ZW5kKG1lbW8sIHJlcyB8fCB7fSk7XG4gICAgICAgICAgICB9LCB7fSlcbiAgICAgICAgICB9IGVsc2UgcmVzdWx0cyA9IG51bGw7XG4gICAgICAgICAgY2IoZXJyLCByZXN1bHRzKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIGNiKGVycm9yKGVyciwge2RhdGE6IGRhdGEsIGludmFsaWRNb2RlbE5hbWU6IG1vZGVsTmFtZX0pKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuXG4gIHJlbW92ZUFsbDogZnVuY3Rpb24oY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgdXRpbC5Qcm9taXNlLmFsbChcbiAgICAgICAgT2JqZWN0LmtleXModGhpcy5fbW9kZWxzKS5tYXAoZnVuY3Rpb24obW9kZWxOYW1lKSB7XG4gICAgICAgICAgdmFyIG1vZGVsID0gdGhpcy5fbW9kZWxzW21vZGVsTmFtZV07XG4gICAgICAgICAgcmV0dXJuIG1vZGVsLnJlbW92ZUFsbCgpO1xuICAgICAgICB9LmJpbmQodGhpcykpXG4gICAgICApLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgY2IobnVsbCk7XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChjYilcbiAgICB9LmJpbmQodGhpcykpO1xuICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBDb2xsZWN0aW9uO1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvY29sbGVjdGlvbi5qc1xuICoqIG1vZHVsZSBpZCA9IDJcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdtb2RlbCcpLFxuICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gIFJlbGF0aW9uc2hpcFR5cGUgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFR5cGUnKSxcbiAgUXVlcnkgPSByZXF1aXJlKCcuL1F1ZXJ5JyksXG4gIE1hcHBpbmdPcGVyYXRpb24gPSByZXF1aXJlKCcuL21hcHBpbmdPcGVyYXRpb24nKSxcbiAgTW9kZWxJbnN0YW5jZSA9IHJlcXVpcmUoJy4vTW9kZWxJbnN0YW5jZScpLFxuICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gIGFyZ3NhcnJheSA9IHJlcXVpcmUoJ2FyZ3NhcnJheScpLFxuICBlcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKSxcbiAgZXh0ZW5kID0gcmVxdWlyZSgnZXh0ZW5kJyksXG4gIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICBDb25kaXRpb24gPSByZXF1aXJlKCcuL0NvbmRpdGlvbicpLFxuICBQcm94eUV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJy4vUHJveHlFdmVudEVtaXR0ZXInKSxcbiAgUHJvbWlzZSA9IHV0aWwuUHJvbWlzZSxcbiAgUGxhY2Vob2xkZXIgPSByZXF1aXJlKCcuL1BsYWNlaG9sZGVyJyksXG4gIFJlYWN0aXZlUXVlcnkgPSByZXF1aXJlKCcuL1JlYWN0aXZlUXVlcnknKSxcbiAgSW5zdGFuY2VGYWN0b3J5ID0gcmVxdWlyZSgnLi9pbnN0YW5jZUZhY3RvcnknKTtcblxuLyoqXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAqL1xuZnVuY3Rpb24gTW9kZWwob3B0cykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHRoaXMuX29wdHMgPSBvcHRzID8gdXRpbC5leHRlbmQoe30sIG9wdHMpIDoge307XG5cbiAgdXRpbC5leHRlbmRGcm9tT3B0cyh0aGlzLCBvcHRzLCB7XG4gICAgbWV0aG9kczoge30sXG4gICAgYXR0cmlidXRlczogW10sXG4gICAgY29sbGVjdGlvbjogbnVsbCxcbiAgICBpZDogJ2lkJyxcbiAgICByZWxhdGlvbnNoaXBzOiBbXSxcbiAgICBuYW1lOiBudWxsLFxuICAgIGluZGV4ZXM6IFtdLFxuICAgIHNpbmdsZXRvbjogZmFsc2UsXG4gICAgc3RhdGljczogdGhpcy5pbnN0YWxsU3RhdGljcy5iaW5kKHRoaXMpLFxuICAgIHByb3BlcnRpZXM6IHt9LFxuICAgIGluaXQ6IG51bGwsXG4gICAgc2VyaWFsaXNlOiBudWxsLFxuICAgIHNlcmlhbGlzZUZpZWxkOiBudWxsLFxuICAgIHNlcmlhbGlzYWJsZUZpZWxkczogbnVsbCxcbiAgICByZW1vdmU6IG51bGwsXG4gICAgcGFyc2VBdHRyaWJ1dGU6IG51bGxcbiAgfSwgZmFsc2UpO1xuXG4gIGlmICghdGhpcy5wYXJzZUF0dHJpYnV0ZSkge1xuICAgIHRoaXMucGFyc2VBdHRyaWJ1dGUgPSBmdW5jdGlvbihhdHRyTmFtZSwgdmFsdWUpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG4gIH1cblxuICB0aGlzLmF0dHJpYnV0ZXMgPSBNb2RlbC5fcHJvY2Vzc0F0dHJpYnV0ZXModGhpcy5hdHRyaWJ1dGVzKTtcblxuICB0aGlzLl9mYWN0b3J5ID0gbmV3IEluc3RhbmNlRmFjdG9yeSh0aGlzKTtcbiAgdGhpcy5faW5zdGFuY2UgPSB0aGlzLl9mYWN0b3J5Ll9pbnN0YW5jZS5iaW5kKHRoaXMuX2ZhY3RvcnkpO1xuXG4gIHV0aWwuZXh0ZW5kKHRoaXMsIHtcbiAgICBfcmVsYXRpb25zaGlwc0luc3RhbGxlZDogZmFsc2UsXG4gICAgX3JldmVyc2VSZWxhdGlvbnNoaXBzSW5zdGFsbGVkOiBmYWxzZSxcbiAgICBjaGlsZHJlbjogW11cbiAgfSk7XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXModGhpcywge1xuICAgIF9yZWxhdGlvbnNoaXBOYW1lczoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKHNlbGYucmVsYXRpb25zaGlwcyk7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0sXG4gICAgX2F0dHJpYnV0ZU5hbWVzOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgbmFtZXMgPSBbXTtcbiAgICAgICAgaWYgKHNlbGYuaWQpIHtcbiAgICAgICAgICBuYW1lcy5wdXNoKHNlbGYuaWQpO1xuICAgICAgICB9XG4gICAgICAgIHNlbGYuYXR0cmlidXRlcy5mb3JFYWNoKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICBuYW1lcy5wdXNoKHgubmFtZSlcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBuYW1lcztcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSxcbiAgICBpbnN0YWxsZWQ6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBzZWxmLl9yZWxhdGlvbnNoaXBzSW5zdGFsbGVkICYmIHNlbGYuX3JldmVyc2VSZWxhdGlvbnNoaXBzSW5zdGFsbGVkO1xuICAgICAgfSxcbiAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9LFxuICAgIGRlc2NlbmRhbnRzOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gc2VsZi5jaGlsZHJlbi5yZWR1Y2UoZnVuY3Rpb24obWVtbywgZGVzY2VuZGFudCkge1xuICAgICAgICAgIHJldHVybiBBcnJheS5wcm90b3R5cGUuY29uY2F0LmNhbGwobWVtbywgZGVzY2VuZGFudC5kZXNjZW5kYW50cyk7XG4gICAgICAgIH0uYmluZChzZWxmKSwgdXRpbC5leHRlbmQoW10sIHNlbGYuY2hpbGRyZW4pKTtcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSxcbiAgICBkaXJ0eToge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMuYXBwLnN0b3JhZ2VFbmFibGVkKSB7XG4gICAgICAgICAgdmFyIHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uID0gdGhpcy5hcHAuc3RvcmFnZS5fdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24sXG4gICAgICAgICAgICBoYXNoID0gKHVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uW3RoaXMuY29sbGVjdGlvbk5hbWVdIHx8IHt9KVt0aGlzLm5hbWVdIHx8IHt9O1xuICAgICAgICAgIHJldHVybiAhIU9iamVjdC5rZXlzKGhhc2gpLmxlbmd0aDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0sXG4gICAgY29sbGVjdGlvbk5hbWU6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNvbGxlY3Rpb24ubmFtZTtcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSxcbiAgICBhcHA6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNvbGxlY3Rpb24uYXBwO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG4gIHZhciBnbG9iYWxFdmVudE5hbWUgPSB0aGlzLmNvbGxlY3Rpb25OYW1lICsgJzonICsgdGhpcy5uYW1lLFxuICAgIHByb3hpZWQgPSB7XG4gICAgICBxdWVyeTogdGhpcy5xdWVyeS5iaW5kKHRoaXMpXG4gICAgfTtcblxuICBQcm94eUV2ZW50RW1pdHRlci5jYWxsKHRoaXMsIHRoaXMuY29sbGVjdGlvbi5hcHAsIGdsb2JhbEV2ZW50TmFtZSwgcHJveGllZCk7XG5cbiAgdGhpcy5pbnN0YWxsUmVsYXRpb25zaGlwcygpO1xuICB0aGlzLmluc3RhbGxSZXZlcnNlUmVsYXRpb25zaGlwcygpO1xuXG4gIHRoaXMuX2luZGV4SXNJbnN0YWxsZWQgPSBuZXcgQ29uZGl0aW9uKGZ1bmN0aW9uKGRvbmUpIHtcbiAgICBpZiAodGhpcy5hcHAuc3RvcmFnZUVuYWJsZWQpIHtcbiAgICAgIHRoaXMuYXBwLnN0b3JhZ2UuZW5zdXJlSW5kZXhJbnN0YWxsZWQodGhpcywgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgIGRvbmUoZXJyKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBlbHNlIGRvbmUoKTtcbiAgfS5iaW5kKHRoaXMpKTtcblxuICB0aGlzLl9tb2RlbExvYWRlZEZyb21TdG9yYWdlID0gbmV3IENvbmRpdGlvbihmdW5jdGlvbihkb25lKSB7XG4gICAgaWYgKHRoaXMuYXBwLnN0b3JhZ2VFbmFibGVkKSB7XG4gICAgICB0aGlzLmFwcC5zdG9yYWdlLmxvYWRNb2RlbCh7bW9kZWw6IHRoaXN9LCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgZG9uZShlcnIpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIGVsc2UgZG9uZSgpO1xuICB9LmJpbmQodGhpcykpO1xuXG4gIHRoaXMuX3N0b3JhZ2VFbmFibGVkID0gbmV3IENvbmRpdGlvbihbdGhpcy5faW5kZXhJc0luc3RhbGxlZCwgdGhpcy5fbW9kZWxMb2FkZWRGcm9tU3RvcmFnZV0pO1xuXG4gIHRoaXMuX3N0b3JhZ2VFbmFibGVkXG4gICAgLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgfS5iaW5kKHRoaXMpKVxuICAgIC5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0NvdWxkIG5vdCBlbmFibGUgc3RvcmFnZSBmb3IgbW9kZWwgJyArIHRoaXMubmFtZSArICc6JywgZXJyKTtcbiAgICB9LmJpbmQodGhpcykpXG59XG5cbnV0aWwuZXh0ZW5kKE1vZGVsLCB7XG4gIC8qKlxuICAgKiBOb3JtYWxpc2UgYXR0cmlidXRlcyBwYXNzZWQgdmlhIHRoZSBvcHRpb25zIGRpY3Rpb25hcnkuXG4gICAqIEBwYXJhbSBhdHRyaWJ1dGVzXG4gICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9wcm9jZXNzQXR0cmlidXRlczogZnVuY3Rpb24oYXR0cmlidXRlcykge1xuICAgIHJldHVybiBhdHRyaWJ1dGVzLnJlZHVjZShmdW5jdGlvbihtLCBhKSB7XG4gICAgICBpZiAodHlwZW9mIGEgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgbS5wdXNoKHtcbiAgICAgICAgICBuYW1lOiBhXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIG0ucHVzaChhKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtO1xuICAgIH0sIFtdKVxuICB9LFxuICBpbnN0YWxsOiBmdW5jdGlvbihtb2RlbHMsIGNiKSB7XG4gICAgY2IgPSBjYiB8fCBmdW5jdGlvbigpIHt9O1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgIENvbmRpdGlvblxuICAgICAgICAuYWxsXG4gICAgICAgIC5hcHBseShDb25kaXRpb24sIG1vZGVscy5tYXAoZnVuY3Rpb24oeCkge3JldHVybiB4Ll9zdG9yYWdlRW5hYmxlZH0pKVxuICAgICAgICAudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICBtb2RlbHMuZm9yRWFjaChmdW5jdGlvbihtKSB7XG4gICAgICAgICAgICBtLl9pbnN0YWxsUmV2ZXJzZVBsYWNlaG9sZGVycygpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGNiKCk7XG4gICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbn0pO1xuXG5Nb2RlbC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFByb3h5RXZlbnRFbWl0dGVyLnByb3RvdHlwZSk7XG5cbnV0aWwuZXh0ZW5kKE1vZGVsLnByb3RvdHlwZSwge1xuICBpbnN0YWxsU3RhdGljczogZnVuY3Rpb24oc3RhdGljcykge1xuICAgIGlmIChzdGF0aWNzKSB7XG4gICAgICBPYmplY3Qua2V5cyhzdGF0aWNzKS5mb3JFYWNoKGZ1bmN0aW9uKHN0YXRpY05hbWUpIHtcbiAgICAgICAgaWYgKHRoaXNbc3RhdGljTmFtZV0pIHtcbiAgICAgICAgICBsb2coJ1N0YXRpYyBtZXRob2Qgd2l0aCBuYW1lIFwiJyArIHN0YXRpY05hbWUgKyAnXCIgYWxyZWFkeSBleGlzdHMuIElnbm9yaW5nIGl0LicpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHRoaXNbc3RhdGljTmFtZV0gPSBzdGF0aWNzW3N0YXRpY05hbWVdLmJpbmQodGhpcyk7XG4gICAgICAgIH1cbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuICAgIHJldHVybiBzdGF0aWNzO1xuICB9LFxuICBfdmFsaWRhdGVSZWxhdGlvbnNoaXBUeXBlOiBmdW5jdGlvbihyZWxhdGlvbnNoaXApIHtcbiAgICBpZiAoIXJlbGF0aW9uc2hpcC50eXBlKSB7XG4gICAgICBpZiAodGhpcy5zaW5nbGV0b24pIHJlbGF0aW9uc2hpcC50eXBlID0gUmVsYXRpb25zaGlwVHlwZS5PbmVUb09uZTtcbiAgICAgIGVsc2UgcmVsYXRpb25zaGlwLnR5cGUgPSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvTWFueTtcbiAgICB9XG4gICAgaWYgKHRoaXMuc2luZ2xldG9uICYmIHJlbGF0aW9uc2hpcC50eXBlID09IFJlbGF0aW9uc2hpcFR5cGUuTWFueVRvTWFueSlcbiAgICAgIHRocm93IG5ldyBFcnJvcignU2luZ2xldG9uIG1vZGVsIGNhbm5vdCB1c2UgTWFueVRvTWFueSByZWxhdGlvbnNoaXAuJyk7XG4gICAgaWYgKE9iamVjdC5rZXlzKFJlbGF0aW9uc2hpcFR5cGUpLmluZGV4T2YocmVsYXRpb25zaGlwLnR5cGUpIDwgMClcbiAgICAgIHRocm93IG5ldyBFcnJvcignUmVsYXRpb25zaGlwIHR5cGUgJyArIHJlbGF0aW9uc2hpcC50eXBlICsgJyBkb2VzIG5vdCBleGlzdCcpO1xuICB9LFxuICBfZ2V0UmV2ZXJzZU1vZGVsOiBmdW5jdGlvbihyZXZlcnNlTmFtZSkge1xuICAgIHZhciByZXZlcnNlTW9kZWw7XG4gICAgaWYgKHJldmVyc2VOYW1lIGluc3RhbmNlb2YgTW9kZWwpIHJldmVyc2VNb2RlbCA9IHJldmVyc2VOYW1lO1xuICAgIGVsc2UgcmV2ZXJzZU1vZGVsID0gdGhpcy5jb2xsZWN0aW9uW3JldmVyc2VOYW1lXTtcbiAgICBpZiAoIXJldmVyc2VNb2RlbCkgeyAvLyBNYXkgaGF2ZSB1c2VkIENvbGxlY3Rpb24uTW9kZWwgZm9ybWF0LlxuICAgICAgdmFyIGFyciA9IHJldmVyc2VOYW1lLnNwbGl0KCcuJyk7XG4gICAgICBpZiAoYXJyLmxlbmd0aCA9PSAyKSB7XG4gICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IGFyclswXTtcbiAgICAgICAgcmV2ZXJzZU5hbWUgPSBhcnJbMV07XG4gICAgICAgIHZhciBvdGhlckNvbGxlY3Rpb24gPSB0aGlzLmFwcC5jb2xsZWN0aW9uUmVnaXN0cnlbY29sbGVjdGlvbk5hbWVdO1xuICAgICAgICBpZiAob3RoZXJDb2xsZWN0aW9uKVxuICAgICAgICAgIHJldmVyc2VNb2RlbCA9IG90aGVyQ29sbGVjdGlvbltyZXZlcnNlTmFtZV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXZlcnNlTW9kZWw7XG4gIH0sXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIHJldmVyc2UgbW9kZWwgb3IgYSBwbGFjZWhvbGRlciB0aGF0IHdpbGwgYmUgcmVzb2x2ZWQgbGF0ZXIuXG4gICAqIEBwYXJhbSBmb3J3YXJkTmFtZVxuICAgKiBAcGFyYW0gcmV2ZXJzZU5hbWVcbiAgICogQHJldHVybnMgeyp9XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfZ2V0UmV2ZXJzZU1vZGVsT3JQbGFjZWhvbGRlcjogZnVuY3Rpb24oZm9yd2FyZE5hbWUsIHJldmVyc2VOYW1lKSB7XG4gICAgdmFyIHJldmVyc2VNb2RlbCA9IHRoaXMuX2dldFJldmVyc2VNb2RlbChyZXZlcnNlTmFtZSk7XG4gICAgcmV0dXJuIHJldmVyc2VNb2RlbCB8fCBuZXcgUGxhY2Vob2xkZXIoe25hbWU6IHJldmVyc2VOYW1lLCByZWY6IHRoaXMsIGZvcndhcmROYW1lOiBmb3J3YXJkTmFtZX0pO1xuICB9LFxuICAvKipcbiAgICogSW5zdGFsbCByZWxhdGlvbnNoaXBzLiBSZXR1cm5zIGVycm9yIGluIGZvcm0gb2Ygc3RyaW5nIGlmIGZhaWxzLlxuICAgKiBAcmV0dXJuIHtTdHJpbmd8bnVsbH1cbiAgICovXG4gIGluc3RhbGxSZWxhdGlvbnNoaXBzOiBmdW5jdGlvbigpIHtcbiAgICBpZiAoIXRoaXMuX3JlbGF0aW9uc2hpcHNJbnN0YWxsZWQpIHtcbiAgICAgIHZhciBlcnIgPSBudWxsO1xuICAgICAgZm9yICh2YXIgbmFtZSBpbiB0aGlzLl9vcHRzLnJlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgaWYgKHRoaXMuX29wdHMucmVsYXRpb25zaGlwcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgIHZhciByZWxhdGlvbnNoaXAgPSB0aGlzLl9vcHRzLnJlbGF0aW9uc2hpcHNbbmFtZV07XG4gICAgICAgICAgLy8gSWYgYSByZXZlcnNlIHJlbGF0aW9uc2hpcCBpcyBpbnN0YWxsZWQgYmVmb3JlaGFuZCwgd2UgZG8gbm90IHdhbnQgdG8gcHJvY2VzcyB0aGVtLlxuICAgICAgICAgIHZhciBpc0ZvcndhcmQgPSAhcmVsYXRpb25zaGlwLmlzUmV2ZXJzZTtcbiAgICAgICAgICBpZiAoaXNGb3J3YXJkKSB7XG4gICAgICAgICAgICBsb2codGhpcy5uYW1lICsgJzogY29uZmlndXJpbmcgcmVsYXRpb25zaGlwICcgKyBuYW1lLCByZWxhdGlvbnNoaXApO1xuICAgICAgICAgICAgaWYgKCEoZXJyID0gdGhpcy5fdmFsaWRhdGVSZWxhdGlvbnNoaXBUeXBlKHJlbGF0aW9uc2hpcCkpKSB7XG4gICAgICAgICAgICAgIHZhciByZXZlcnNlTW9kZWxOYW1lID0gcmVsYXRpb25zaGlwLm1vZGVsO1xuICAgICAgICAgICAgICBpZiAocmV2ZXJzZU1vZGVsTmFtZSkge1xuICAgICAgICAgICAgICAgIHZhciByZXZlcnNlTW9kZWwgPSB0aGlzLl9nZXRSZXZlcnNlTW9kZWxPclBsYWNlaG9sZGVyKG5hbWUsIHJldmVyc2VNb2RlbE5hbWUpO1xuICAgICAgICAgICAgICAgIHV0aWwuZXh0ZW5kKHJlbGF0aW9uc2hpcCwge1xuICAgICAgICAgICAgICAgICAgcmV2ZXJzZU1vZGVsOiByZXZlcnNlTW9kZWwsXG4gICAgICAgICAgICAgICAgICBmb3J3YXJkTW9kZWw6IHRoaXMsXG4gICAgICAgICAgICAgICAgICBmb3J3YXJkTmFtZTogbmFtZSxcbiAgICAgICAgICAgICAgICAgIHJldmVyc2VOYW1lOiByZWxhdGlvbnNoaXAucmV2ZXJzZSB8fCAncmV2ZXJzZV8nICsgbmFtZSxcbiAgICAgICAgICAgICAgICAgIGlzUmV2ZXJzZTogZmFsc2VcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBkZWxldGUgcmVsYXRpb25zaGlwLm1vZGVsO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSByZWxhdGlvbnNoaXAucmV2ZXJzZTtcblxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGVsc2UgcmV0dXJuICdNdXN0IHBhc3MgbW9kZWwnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignUmVsYXRpb25zaGlwcyBmb3IgXCInICsgdGhpcy5uYW1lICsgJ1wiIGhhdmUgYWxyZWFkeSBiZWVuIGluc3RhbGxlZCcpO1xuICAgIH1cbiAgICBpZiAoIWVycikgdGhpcy5fcmVsYXRpb25zaGlwc0luc3RhbGxlZCA9IHRydWU7XG4gICAgcmV0dXJuIGVycjtcbiAgfSxcbiAgX2luc3RhbGxSZXZlcnNlOiBmdW5jdGlvbihyZWxhdGlvbnNoaXApIHtcbiAgICB2YXIgcmV2ZXJzZVJlbGF0aW9uc2hpcCA9IHV0aWwuZXh0ZW5kKHt9LCByZWxhdGlvbnNoaXApO1xuICAgIHJldmVyc2VSZWxhdGlvbnNoaXAuaXNSZXZlcnNlID0gdHJ1ZTtcbiAgICB2YXIgcmV2ZXJzZU1vZGVsID0gcmV2ZXJzZVJlbGF0aW9uc2hpcC5yZXZlcnNlTW9kZWw7XG4gICAgdmFyIGlzUGxhY2Vob2xkZXIgPSByZXZlcnNlTW9kZWwuaXNQbGFjZWhvbGRlcjtcbiAgICBpZiAoaXNQbGFjZWhvbGRlcikge1xuICAgICAgdmFyIG1vZGVsTmFtZSA9IHJldmVyc2VSZWxhdGlvbnNoaXAucmV2ZXJzZU1vZGVsLm5hbWU7XG4gICAgICByZXZlcnNlTW9kZWwgPSB0aGlzLl9nZXRSZXZlcnNlTW9kZWwobW9kZWxOYW1lKTtcbiAgICAgIGlmIChyZXZlcnNlTW9kZWwpIHtcbiAgICAgICAgcmV2ZXJzZVJlbGF0aW9uc2hpcC5yZXZlcnNlTW9kZWwgPSByZXZlcnNlTW9kZWw7XG4gICAgICAgIHJlbGF0aW9uc2hpcC5yZXZlcnNlTW9kZWwgPSByZXZlcnNlTW9kZWw7XG4gICAgICB9XG4gICAgfVxuXG5cbiAgICBpZiAocmV2ZXJzZU1vZGVsKSB7XG5cbiAgICAgIHZhciByZXZlcnNlTmFtZSA9IHJldmVyc2VSZWxhdGlvbnNoaXAucmV2ZXJzZU5hbWUsXG4gICAgICAgIGZvcndhcmRNb2RlbCA9IHJldmVyc2VSZWxhdGlvbnNoaXAuZm9yd2FyZE1vZGVsO1xuXG4gICAgICBpZiAocmV2ZXJzZU1vZGVsICE9IHRoaXMgfHwgcmV2ZXJzZU1vZGVsID09IGZvcndhcmRNb2RlbCkge1xuICAgICAgICBpZiAocmV2ZXJzZU1vZGVsLnNpbmdsZXRvbikge1xuICAgICAgICAgIGlmIChyZXZlcnNlUmVsYXRpb25zaGlwLnR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5NYW55VG9NYW55KSB0aHJvdyBuZXcgRXJyb3IoJ1NpbmdsZXRvbiBtb2RlbCBjYW5ub3QgYmUgcmVsYXRlZCB2aWEgcmV2ZXJzZSBNYW55VG9NYW55Jyk7XG4gICAgICAgICAgaWYgKHJldmVyc2VSZWxhdGlvbnNoaXAudHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvTWFueSkgdGhyb3cgbmV3IEVycm9yKCdTaW5nbGV0b24gbW9kZWwgY2Fubm90IGJlIHJlbGF0ZWQgdmlhIHJldmVyc2UgT25lVG9NYW55Jyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJldmVyc2VNb2RlbC5yZWxhdGlvbnNoaXBzW3JldmVyc2VOYW1lXSkge1xuICAgICAgICAgIC8vIFdlIGFyZSBvayB0byByZWRlZmluZSByZXZlcnNlIHJlbGF0aW9uc2hpcHMgd2hlcmVieSB0aGUgbW9kZWxzIGFyZSBpbiB0aGUgc2FtZSBoaWVyYXJjaHlcbiAgICAgICAgICB2YXIgaXNBbmNlc3Rvck1vZGVsID0gcmV2ZXJzZU1vZGVsLnJlbGF0aW9uc2hpcHNbcmV2ZXJzZU5hbWVdLmZvcndhcmRNb2RlbC5pc0FuY2VzdG9yT2YodGhpcyk7XG4gICAgICAgICAgdmFyIGlzRGVzY2VuZGVudE1vZGVsID0gcmV2ZXJzZU1vZGVsLnJlbGF0aW9uc2hpcHNbcmV2ZXJzZU5hbWVdLmZvcndhcmRNb2RlbC5pc0Rlc2NlbmRhbnRPZih0aGlzKTtcbiAgICAgICAgICBpZiAoIWlzQW5jZXN0b3JNb2RlbCAmJiAhaXNEZXNjZW5kZW50TW9kZWwgJiYgIWlzUGxhY2Vob2xkZXIpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignUmV2ZXJzZSByZWxhdGlvbnNoaXAgXCInICsgcmV2ZXJzZU5hbWUgKyAnXCIgYWxyZWFkeSBleGlzdHMgb24gbW9kZWwgXCInICsgcmV2ZXJzZU1vZGVsLm5hbWUgKyAnXCInKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV2ZXJzZU1vZGVsLnJlbGF0aW9uc2hpcHNbcmV2ZXJzZU5hbWVdID0gcmV2ZXJzZVJlbGF0aW9uc2hpcDtcbiAgICAgIH1cblxuICAgICAgdmFyIGV4aXN0aW5nUmV2ZXJzZUluc3RhbmNlcyA9ICh0aGlzLmFwcC5jYWNoZS5fbG9jYWxDYWNoZUJ5VHlwZVtyZXZlcnNlTW9kZWwuY29sbGVjdGlvbk5hbWVdIHx8IHt9KVtyZXZlcnNlTW9kZWwubmFtZV0gfHwge307XG4gICAgICBPYmplY3Qua2V5cyhleGlzdGluZ1JldmVyc2VJbnN0YW5jZXMpLmZvckVhY2goZnVuY3Rpb24obG9jYWxJZCkge1xuICAgICAgICB2YXIgaW5zdGFuY2NlID0gZXhpc3RpbmdSZXZlcnNlSW5zdGFuY2VzW2xvY2FsSWRdO1xuICAgICAgICB0aGlzLl9mYWN0b3J5Ll9pbnN0YWxsUmVsYXRpb25zaGlwKHJldmVyc2VSZWxhdGlvbnNoaXAsIGluc3RhbmNjZSk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgfVxuICB9LFxuICAvKipcbiAgICogQ3ljbGUgdGhyb3VnaCByZWxhdGlvbnNoaXBzIGFuZCByZXBsYWNlIGFueSBwbGFjZWhvbGRlcnMgd2l0aCB0aGUgYWN0dWFsIG1vZGVscyB3aGVyZSBwb3NzaWJsZS5cbiAgICovXG4gIF9pbnN0YWxsUmV2ZXJzZVBsYWNlaG9sZGVyczogZnVuY3Rpb24oKSB7XG4gICAgZm9yICh2YXIgZm9yd2FyZE5hbWUgaW4gdGhpcy5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICBpZiAodGhpcy5yZWxhdGlvbnNoaXBzLmhhc093blByb3BlcnR5KGZvcndhcmROYW1lKSkge1xuICAgICAgICB2YXIgcmVsYXRpb25zaGlwID0gdGhpcy5yZWxhdGlvbnNoaXBzW2ZvcndhcmROYW1lXTtcbiAgICAgICAgaWYgKHJlbGF0aW9uc2hpcC5yZXZlcnNlTW9kZWwuaXNQbGFjZWhvbGRlcikge1xuICAgICAgICAgIHRoaXMuX2luc3RhbGxSZXZlcnNlKHJlbGF0aW9uc2hpcCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIGluc3RhbGxSZXZlcnNlUmVsYXRpb25zaGlwczogZnVuY3Rpb24oKSB7XG4gICAgaWYgKCF0aGlzLl9yZXZlcnNlUmVsYXRpb25zaGlwc0luc3RhbGxlZCkge1xuICAgICAgZm9yICh2YXIgZm9yd2FyZE5hbWUgaW4gdGhpcy5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgIGlmICh0aGlzLnJlbGF0aW9uc2hpcHMuaGFzT3duUHJvcGVydHkoZm9yd2FyZE5hbWUpKSB7XG4gICAgICAgICAgdGhpcy5faW5zdGFsbFJldmVyc2UodGhpcy5yZWxhdGlvbnNoaXBzW2ZvcndhcmROYW1lXSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuX3JldmVyc2VSZWxhdGlvbnNoaXBzSW5zdGFsbGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignUmV2ZXJzZSByZWxhdGlvbnNoaXBzIGZvciBcIicgKyB0aGlzLm5hbWUgKyAnXCIgaGF2ZSBhbHJlYWR5IGJlZW4gaW5zdGFsbGVkLicpO1xuICAgIH1cbiAgfSxcbiAgX3F1ZXJ5OiBmdW5jdGlvbihxdWVyeSkge1xuICAgIHJldHVybiBuZXcgUXVlcnkodGhpcywgcXVlcnkgfHwge30pO1xuICB9LFxuICBxdWVyeTogZnVuY3Rpb24ocXVlcnksIGNiKSB7XG4gICAgdmFyIHF1ZXJ5SW5zdGFuY2U7XG4gICAgdmFyIHByb21pc2UgPSB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICB0aGlzLmFwcC5fZW5zdXJlSW5zdGFsbGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoIXRoaXMuc2luZ2xldG9uKSB7XG4gICAgICAgICAgcXVlcnlJbnN0YW5jZSA9IHRoaXMuX3F1ZXJ5KHF1ZXJ5KTtcbiAgICAgICAgICByZXR1cm4gcXVlcnlJbnN0YW5jZS5leGVjdXRlKGNiKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBxdWVyeUluc3RhbmNlID0gdGhpcy5fcXVlcnkoe19faWdub3JlSW5zdGFsbGVkOiB0cnVlfSk7XG4gICAgICAgICAgcXVlcnlJbnN0YW5jZS5leGVjdXRlKGZ1bmN0aW9uKGVyciwgb2Jqcykge1xuICAgICAgICAgICAgaWYgKGVycikgY2IoZXJyKTtcbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAvLyBDYWNoZSBhIG5ldyBzaW5nbGV0b24gYW5kIHRoZW4gcmVleGVjdXRlIHRoZSBxdWVyeVxuICAgICAgICAgICAgICBxdWVyeSA9IHV0aWwuZXh0ZW5kKHt9LCBxdWVyeSk7XG4gICAgICAgICAgICAgIHF1ZXJ5Ll9faWdub3JlSW5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgaWYgKCFvYmpzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZ3JhcGgoe30sIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgcXVlcnlJbnN0YW5jZSA9IHRoaXMuX3F1ZXJ5KHF1ZXJ5KTtcbiAgICAgICAgICAgICAgICAgICAgcXVlcnlJbnN0YW5jZS5leGVjdXRlKGNiKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjYihlcnIpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcXVlcnlJbnN0YW5jZSA9IHRoaXMuX3F1ZXJ5KHF1ZXJ5KTtcbiAgICAgICAgICAgICAgICBxdWVyeUluc3RhbmNlLmV4ZWN1dGUoY2IpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgLy8gQnkgd3JhcHBpbmcgdGhlIHByb21pc2UgaW4gYW5vdGhlciBwcm9taXNlIHdlIGNhbiBwdXNoIHRoZSBpbnZvY2F0aW9ucyB0byB0aGUgYm90dG9tIG9mIHRoZSBldmVudCBsb29wIHNvIHRoYXRcbiAgICAvLyBhbnkgZXZlbnQgaGFuZGxlcnMgYWRkZWQgdG8gdGhlIGNoYWluIGFyZSBob25vdXJlZCBzdHJhaWdodCBhd2F5LlxuICAgIHZhciBsaW5rUHJvbWlzZSA9IG5ldyB1dGlsLlByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICBwcm9taXNlLnRoZW4oYXJnc2FycmF5KGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICAgICAgc2V0SW1tZWRpYXRlKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJlc29sdmUuYXBwbHkobnVsbCwgYXJncyk7XG4gICAgICAgIH0pO1xuICAgICAgfSksIGFyZ3NhcnJheShmdW5jdGlvbihhcmdzKSB7XG4gICAgICAgIHNldEltbWVkaWF0ZShmdW5jdGlvbigpIHtcbiAgICAgICAgICByZWplY3QuYXBwbHkobnVsbCwgYXJncyk7XG4gICAgICAgIH0pXG4gICAgICB9KSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGhpcy5fbGluayh7XG4gICAgICB0aGVuOiBsaW5rUHJvbWlzZS50aGVuLmJpbmQobGlua1Byb21pc2UpLFxuICAgICAgY2F0Y2g6IGxpbmtQcm9taXNlLmNhdGNoLmJpbmQobGlua1Byb21pc2UpLFxuICAgICAgb246IGFyZ3NhcnJheShmdW5jdGlvbihhcmdzKSB7XG4gICAgICAgIHZhciBycSA9IG5ldyBSZWFjdGl2ZVF1ZXJ5KHRoaXMuX3F1ZXJ5KHF1ZXJ5KSk7XG4gICAgICAgIHJxLmluaXQoKTtcbiAgICAgICAgcnEub24uYXBwbHkocnEsIGFyZ3MpO1xuICAgICAgfS5iaW5kKHRoaXMpKVxuICAgIH0pO1xuICB9LFxuICAvKipcbiAgICogT25seSB1c2VkIGluIHRlc3RpbmcgYXQgdGhlIG1vbWVudC5cbiAgICogQHBhcmFtIHF1ZXJ5XG4gICAqIEByZXR1cm5zIHtSZWFjdGl2ZVF1ZXJ5fVxuICAgKi9cbiAgX3JlYWN0aXZlUXVlcnk6IGZ1bmN0aW9uKHF1ZXJ5KSB7XG4gICAgcmV0dXJuIG5ldyBSZWFjdGl2ZVF1ZXJ5KG5ldyBRdWVyeSh0aGlzLCBxdWVyeSB8fCB7fSkpO1xuICB9LFxuICBvbmU6IGZ1bmN0aW9uKG9wdHMsIGNiKSB7XG4gICAgaWYgKHR5cGVvZiBvcHRzID09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNiID0gb3B0cztcbiAgICAgIG9wdHMgPSB7fTtcbiAgICB9XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIHRoaXMucXVlcnkob3B0cywgZnVuY3Rpb24oZXJyLCByZXMpIHtcbiAgICAgICAgaWYgKGVycikgY2IoZXJyKTtcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgaWYgKHJlcy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICBjYihlcnJvcignTW9yZSB0aGFuIG9uZSBpbnN0YW5jZSByZXR1cm5lZCB3aGVuIGV4ZWN1dGluZyBnZXQgcXVlcnkhJykpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJlcyA9IHJlcy5sZW5ndGggPyByZXNbMF0gOiBudWxsO1xuICAgICAgICAgICAgY2IobnVsbCwgcmVzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG4gIGFsbDogZnVuY3Rpb24ocSwgY2IpIHtcbiAgICBpZiAodHlwZW9mIHEgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2IgPSBxO1xuICAgICAgcSA9IHt9O1xuICAgIH1cbiAgICBxID0gcSB8fCB7fTtcbiAgICB2YXIgcXVlcnkgPSB7fTtcbiAgICBpZiAocS5fX29yZGVyKSBxdWVyeS5fX29yZGVyID0gcS5fX29yZGVyO1xuICAgIHJldHVybiB0aGlzLnF1ZXJ5KHEsIGNiKTtcbiAgfSxcbiAgX2F0dHJpYnV0ZURlZmluaXRpb25XaXRoTmFtZTogZnVuY3Rpb24obmFtZSkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5hdHRyaWJ1dGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgYXR0cmlidXRlRGVmaW5pdGlvbiA9IHRoaXMuYXR0cmlidXRlc1tpXTtcbiAgICAgIGlmIChhdHRyaWJ1dGVEZWZpbml0aW9uLm5hbWUgPT0gbmFtZSkgcmV0dXJuIGF0dHJpYnV0ZURlZmluaXRpb247XG4gICAgfVxuICB9LFxuICBfZ3JhcGg6IGZ1bmN0aW9uKGRhdGEsIG9wdHMsIGNiKSB7XG4gICAgdmFyIF9tYXAgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBvdmVycmlkZXMgPSBvcHRzLm92ZXJyaWRlO1xuICAgICAgaWYgKG92ZXJyaWRlcykge1xuICAgICAgICBpZiAodXRpbC5pc0FycmF5KG92ZXJyaWRlcykpIG9wdHMub2JqZWN0cyA9IG92ZXJyaWRlcztcbiAgICAgICAgZWxzZSBvcHRzLm9iamVjdHMgPSBbb3ZlcnJpZGVzXTtcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSBvcHRzLm92ZXJyaWRlO1xuICAgICAgaWYgKHV0aWwuaXNBcnJheShkYXRhKSkge1xuICAgICAgICB0aGlzLl9tYXBCdWxrKGRhdGEsIG9wdHMsIGNiKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX21hcEJ1bGsoW2RhdGFdLCBvcHRzLCBmdW5jdGlvbihlcnIsIG9iamVjdHMpIHtcbiAgICAgICAgICB2YXIgb2JqO1xuICAgICAgICAgIGlmIChvYmplY3RzKSB7XG4gICAgICAgICAgICBpZiAob2JqZWN0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgb2JqID0gb2JqZWN0c1swXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZXJyID0gZXJyID8gKHV0aWwuaXNBcnJheShkYXRhKSA/IGVyciA6ICh1dGlsLmlzQXJyYXkoZXJyKSA/IGVyclswXSA6IGVycikpIDogbnVsbDtcbiAgICAgICAgICBjYihlcnIsIG9iaik7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0uYmluZCh0aGlzKTtcbiAgICBfbWFwKCk7XG4gIH0sXG4gIC8qKlxuICAgKiBNYXAgZGF0YSBpbnRvIFNpZXN0YS5cbiAgICpcbiAgICogQHBhcmFtIGRhdGEgUmF3IGRhdGEgcmVjZWl2ZWQgcmVtb3RlbHkgb3Igb3RoZXJ3aXNlXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb258b2JqZWN0fSBbb3B0c11cbiAgICogQHBhcmFtIHtib29sZWFufSBvcHRzLm92ZXJyaWRlXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gb3B0cy5faWdub3JlSW5zdGFsbGVkIC0gQSBoYWNrIHRoYXQgYWxsb3dzIG1hcHBpbmcgb250byBNb2RlbHMgZXZlbiBpZiBpbnN0YWxsIHByb2Nlc3MgaGFzIG5vdCBmaW5pc2hlZC5cbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gW2NiXSBDYWxsZWQgb25jZSBwb3VjaCBwZXJzaXN0ZW5jZSByZXR1cm5zLlxuICAgKi9cbiAgZ3JhcGg6IGZ1bmN0aW9uKGRhdGEsIG9wdHMsIGNiKSB7XG4gICAgaWYgKHR5cGVvZiBvcHRzID09ICdmdW5jdGlvbicpIGNiID0gb3B0cztcbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgdGhpcy5hcHAuX2Vuc3VyZUluc3RhbGxlZChmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5fZ3JhcGgoZGF0YSwgb3B0cywgY2IpO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuICBfbWFwQnVsazogZnVuY3Rpb24oZGF0YSwgb3B0cywgY2FsbGJhY2spIHtcbiAgICB1dGlsLmV4dGVuZChvcHRzLCB7bW9kZWw6IHRoaXMsIGRhdGE6IGRhdGF9KTtcbiAgICB2YXIgb3AgPSBuZXcgTWFwcGluZ09wZXJhdGlvbihvcHRzKTtcbiAgICBvcC5zdGFydChmdW5jdGlvbihlcnIsIG9iamVjdHMpIHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgb2JqZWN0cyB8fCBbXSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG4gIF9jb3VudENhY2hlOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgY29sbENhY2hlID0gdGhpcy5hcHAuY2FjaGUuX2xvY2FsQ2FjaGVCeVR5cGVbdGhpcy5jb2xsZWN0aW9uTmFtZV0gfHwge307XG4gICAgdmFyIG1vZGVsQ2FjaGUgPSBjb2xsQ2FjaGVbdGhpcy5uYW1lXSB8fCB7fTtcbiAgICByZXR1cm4gT2JqZWN0LmtleXMobW9kZWxDYWNoZSkucmVkdWNlKGZ1bmN0aW9uKG0sIGxvY2FsSWQpIHtcbiAgICAgIG1bbG9jYWxJZF0gPSB7fTtcbiAgICAgIHJldHVybiBtO1xuICAgIH0sIHt9KTtcbiAgfSxcbiAgY291bnQ6IGZ1bmN0aW9uKGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIHRoaXMuYXBwLl9lbnN1cmVJbnN0YWxsZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIGNiKG51bGwsIE9iamVjdC5rZXlzKHRoaXMuX2NvdW50Q2FjaGUoKSkubGVuZ3RoKTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgX2R1bXA6IGZ1bmN0aW9uKGFzSlNPTikge1xuICAgIHZhciBkdW1wZWQgPSB7fTtcbiAgICBkdW1wZWQubmFtZSA9IHRoaXMubmFtZTtcbiAgICBkdW1wZWQuYXR0cmlidXRlcyA9IHRoaXMuYXR0cmlidXRlcztcbiAgICBkdW1wZWQuaWQgPSB0aGlzLmlkO1xuICAgIGR1bXBlZC5jb2xsZWN0aW9uID0gdGhpcy5jb2xsZWN0aW9uTmFtZTtcbiAgICBkdW1wZWQucmVsYXRpb25zaGlwcyA9IHRoaXMucmVsYXRpb25zaGlwcy5tYXAoZnVuY3Rpb24ocikge1xuICAgICAgcmV0dXJuIHIuaXNGb3J3YXJkID8gci5mb3J3YXJkTmFtZSA6IHIucmV2ZXJzZU5hbWU7XG4gICAgfSk7XG4gICAgcmV0dXJuIGFzSlNPTiA/IHV0aWwucHJldHR5UHJpbnQoZHVtcGVkKSA6IGR1bXBlZDtcbiAgfSxcbiAgdG9TdHJpbmc6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiAnTW9kZWxbJyArIHRoaXMubmFtZSArICddJztcbiAgfSxcbiAgcmVtb3ZlQWxsOiBmdW5jdGlvbihjYikge1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICB0aGlzLmFsbCgpXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uKGluc3RhbmNlcykge1xuICAgICAgICAgIGluc3RhbmNlcy5yZW1vdmUoKTtcbiAgICAgICAgICBjYigpO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goY2IpO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH1cblxufSk7XG5cbi8vIFN1YmNsYXNzaW5nXG51dGlsLmV4dGVuZChNb2RlbC5wcm90b3R5cGUsIHtcbiAgY2hpbGQ6IGZ1bmN0aW9uKG5hbWVPck9wdHMsIG9wdHMpIHtcbiAgICBpZiAodHlwZW9mIG5hbWVPck9wdHMgPT0gJ3N0cmluZycpIHtcbiAgICAgIG9wdHMubmFtZSA9IG5hbWVPck9wdHM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9wdHMgPSBuYW1lO1xuICAgIH1cbiAgICB1dGlsLmV4dGVuZChvcHRzLCB7XG4gICAgICBhdHRyaWJ1dGVzOiBBcnJheS5wcm90b3R5cGUuY29uY2F0LmNhbGwob3B0cy5hdHRyaWJ1dGVzIHx8IFtdLCB0aGlzLl9vcHRzLmF0dHJpYnV0ZXMpLFxuICAgICAgcmVsYXRpb25zaGlwczogdXRpbC5leHRlbmQob3B0cy5yZWxhdGlvbnNoaXBzIHx8IHt9LCB0aGlzLl9vcHRzLnJlbGF0aW9uc2hpcHMpLFxuICAgICAgbWV0aG9kczogdXRpbC5leHRlbmQodXRpbC5leHRlbmQoe30sIHRoaXMuX29wdHMubWV0aG9kcykgfHwge30sIG9wdHMubWV0aG9kcyksXG4gICAgICBzdGF0aWNzOiB1dGlsLmV4dGVuZCh1dGlsLmV4dGVuZCh7fSwgdGhpcy5fb3B0cy5zdGF0aWNzKSB8fCB7fSwgb3B0cy5zdGF0aWNzKSxcbiAgICAgIHByb3BlcnRpZXM6IHV0aWwuZXh0ZW5kKHV0aWwuZXh0ZW5kKHt9LCB0aGlzLl9vcHRzLnByb3BlcnRpZXMpIHx8IHt9LCBvcHRzLnByb3BlcnRpZXMpLFxuICAgICAgaWQ6IG9wdHMuaWQgfHwgdGhpcy5fb3B0cy5pZCxcbiAgICAgIGluaXQ6IG9wdHMuaW5pdCB8fCB0aGlzLl9vcHRzLmluaXQsXG4gICAgICByZW1vdmU6IG9wdHMucmVtb3ZlIHx8IHRoaXMuX29wdHMucmVtb3ZlLFxuICAgICAgc2VyaWFsaXNlOiBvcHRzLnNlcmlhbGlzZSB8fCB0aGlzLl9vcHRzLnNlcmlhbGlzZSxcbiAgICAgIHNlcmlhbGlzZUZpZWxkOiBvcHRzLnNlcmlhbGlzZUZpZWxkIHx8IHRoaXMuX29wdHMuc2VyaWFsaXNlRmllbGQsXG4gICAgICBwYXJzZUF0dHJpYnV0ZTogb3B0cy5wYXJzZUF0dHJpYnV0ZSB8fCB0aGlzLl9vcHRzLnBhcnNlQXR0cmlidXRlXG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy5fb3B0cy5zZXJpYWxpc2FibGVGaWVsZHMpIHtcbiAgICAgIG9wdHMuc2VyaWFsaXNhYmxlRmllbGRzID0gQXJyYXkucHJvdG90eXBlLmNvbmNhdC5hcHBseShvcHRzLnNlcmlhbGlzYWJsZUZpZWxkcyB8fCBbXSwgdGhpcy5fb3B0cy5zZXJpYWxpc2FibGVGaWVsZHMpO1xuICAgIH1cblxuICAgIHZhciBtb2RlbCA9IHRoaXMuY29sbGVjdGlvbi5tb2RlbChvcHRzLm5hbWUsIG9wdHMpO1xuICAgIG1vZGVsLnBhcmVudCA9IHRoaXM7XG4gICAgdGhpcy5jaGlsZHJlbi5wdXNoKG1vZGVsKTtcbiAgICByZXR1cm4gbW9kZWw7XG4gIH0sXG4gIGlzQ2hpbGRPZjogZnVuY3Rpb24ocGFyZW50KSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50ID09IHBhcmVudDtcbiAgfSxcbiAgaXNQYXJlbnRPZjogZnVuY3Rpb24oY2hpbGQpIHtcbiAgICByZXR1cm4gdGhpcy5jaGlsZHJlbi5pbmRleE9mKGNoaWxkKSA+IC0xO1xuICB9LFxuICBpc0Rlc2NlbmRhbnRPZjogZnVuY3Rpb24oYW5jZXN0b3IpIHtcbiAgICB2YXIgcGFyZW50ID0gdGhpcy5wYXJlbnQ7XG4gICAgd2hpbGUgKHBhcmVudCkge1xuICAgICAgaWYgKHBhcmVudCA9PSBhbmNlc3RvcikgcmV0dXJuIHRydWU7XG4gICAgICBwYXJlbnQgPSBwYXJlbnQucGFyZW50O1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH0sXG4gIGlzQW5jZXN0b3JPZjogZnVuY3Rpb24oZGVzY2VuZGFudCkge1xuICAgIHJldHVybiB0aGlzLmRlc2NlbmRhbnRzLmluZGV4T2YoZGVzY2VuZGFudCkgPiAtMTtcbiAgfSxcbiAgaGFzQXR0cmlidXRlTmFtZWQ6IGZ1bmN0aW9uKGF0dHJpYnV0ZU5hbWUpIHtcbiAgICByZXR1cm4gdGhpcy5fYXR0cmlidXRlTmFtZXMuaW5kZXhPZihhdHRyaWJ1dGVOYW1lKSA+IC0xO1xuICB9XG59KTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IE1vZGVsO1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvbW9kZWwuanNcbiAqKiBtb2R1bGUgaWQgPSAzXG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCIvKipcbiAqIFVzZXJzIHNob3VsZCBuZXZlciBzZWUgdGhlc2UgdGhyb3duLiBBIGJ1ZyByZXBvcnQgc2hvdWxkIGJlIGZpbGVkIGlmIHNvIGFzIGl0IG1lYW5zIHNvbWUgYXNzZXJ0aW9uIGhhcyBmYWlsZWQuXG4gKiBAcGFyYW0gbWVzc2FnZVxuICogQHBhcmFtIGNvbnRleHRcbiAqIEBwYXJhbSBzc2ZcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBJbnRlcm5hbFNpZXN0YUVycm9yKG1lc3NhZ2UsIGNvbnRleHQsIHNzZikge1xuICBFcnJvci5jYWxsKHRoaXMsIG1lc3NhZ2UsIGNvbnRleHQsIHNzZik7XG4gIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG4gIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gIC8vIGNhcHR1cmUgc3RhY2sgdHJhY2VcbiAgaWYgKHNzZiAmJiBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSkge1xuICAgIEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKHRoaXMsIHNzZik7XG4gIH1cbn1cblxuSW50ZXJuYWxTaWVzdGFFcnJvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEVycm9yLnByb3RvdHlwZSk7XG5JbnRlcm5hbFNpZXN0YUVycm9yLnByb3RvdHlwZS5uYW1lID0gJ0ludGVybmFsU2llc3RhRXJyb3InO1xuSW50ZXJuYWxTaWVzdGFFcnJvci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBJbnRlcm5hbFNpZXN0YUVycm9yO1xuXG5mdW5jdGlvbiBpc1NpZXN0YUVycm9yKGVycikge1xuICBpZiAodHlwZW9mIGVyciA9PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiAnZXJyb3InIGluIGVyciAmJiAnb2snIGluIGVyciAmJiAncmVhc29uJyBpbiBlcnI7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGVyck1lc3NhZ2UsIGV4dHJhKSB7XG4gIGlmIChpc1NpZXN0YUVycm9yKGVyck1lc3NhZ2UpKSB7XG4gICAgcmV0dXJuIGVyck1lc3NhZ2U7XG4gIH1cbiAgdmFyIGVyciA9IHtcbiAgICByZWFzb246IGVyck1lc3NhZ2UsXG4gICAgZXJyb3I6IHRydWUsXG4gICAgb2s6IGZhbHNlXG4gIH07XG4gIGZvciAodmFyIHByb3AgaW4gZXh0cmEgfHwge30pIHtcbiAgICBpZiAoZXh0cmEuaGFzT3duUHJvcGVydHkocHJvcCkpIGVycltwcm9wXSA9IGV4dHJhW3Byb3BdO1xuICB9XG4gIGVyci50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh0aGlzKTtcbiAgfTtcbiAgcmV0dXJuIGVycjtcbn07XG5cbm1vZHVsZS5leHBvcnRzLkludGVybmFsU2llc3RhRXJyb3IgPSBJbnRlcm5hbFNpZXN0YUVycm9yO1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvZXJyb3IuanNcbiAqKiBtb2R1bGUgaWQgPSA0XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyLFxuICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gIGFyZ3NhcnJheSA9IHJlcXVpcmUoJ2FyZ3NhcnJheScpLFxuICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgQ2hhaW4gPSByZXF1aXJlKCcuL0NoYWluJyk7XG5cblxudmFyIGV2ZW50RW1pdHRlcmZhY3RvcnkgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGV2ZW50RW1pdHRlciA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcbiAgZXZlbnRFbWl0dGVyLnNldE1heExpc3RlbmVycygxMDApO1xuXG5cbiAgdmFyIG9sZEVtaXQgPSBldmVudEVtaXR0ZXIuZW1pdDtcblxuICAvLyBFbnN1cmUgdGhhdCBlcnJvcnMgaW4gZXZlbnQgaGFuZGxlcnMgZG8gbm90IHN0YWxsIFNpZXN0YS5cbiAgZXZlbnRFbWl0dGVyLmVtaXQgPSBmdW5jdGlvbihldmVudCwgcGF5bG9hZCkge1xuICAgIHRyeSB7XG4gICAgICBvbGRFbWl0LmNhbGwoZXZlbnRFbWl0dGVyLCBldmVudCwgcGF5bG9hZCk7XG4gICAgfVxuICAgIGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGUpO1xuICAgIH1cbiAgfTtcbiAgcmV0dXJuIGV2ZW50RW1pdHRlcjtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZXZlbnRFbWl0dGVyZmFjdG9yeTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL2V2ZW50cy5qc1xuICoqIG1vZHVsZSBpZCA9IDVcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIm1vZHVsZS5leHBvcnRzID0ge1xuICBPbmVUb01hbnk6ICdPbmVUb01hbnknLFxuICBPbmVUb09uZTogJ09uZVRvT25lJyxcbiAgTWFueVRvTWFueTogJ01hbnlUb01hbnknXG59O1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL1JlbGF0aW9uc2hpcFR5cGUuanNcbiAqKiBtb2R1bGUgaWQgPSA2XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCIvKipcbiAqIEZvciB0aG9zZSBmYW1pbGlhciB3aXRoIEFwcGxlJ3MgQ29jb2EgbGlicmFyeSwgcmVhY3RpdmUgcXVlcmllcyByb3VnaGx5IG1hcCBvbnRvIE5TRmV0Y2hlZFJlc3VsdHNDb250cm9sbGVyLlxuICpcbiAqIFRoZXkgcHJlc2VudCBhIHF1ZXJ5IHNldCB0aGF0ICdyZWFjdHMnIHRvIGNoYW5nZXMgaW4gdGhlIHVuZGVybHlpbmcgZGF0YS5cbiAqIEBtb2R1bGUgcmVhY3RpdmVRdWVyeVxuICovXG5cbnZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdxdWVyeTpyZWFjdGl2ZScpLFxuICBRdWVyeSA9IHJlcXVpcmUoJy4vUXVlcnknKSxcbiAgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyLFxuICBDaGFpbiA9IHJlcXVpcmUoJy4vQ2hhaW4nKSxcbiAgbW9kZWxFdmVudHMgPSByZXF1aXJlKCcuL21vZGVsRXZlbnRzJyksXG4gIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgY29uc3RydWN0UXVlcnlTZXQgPSByZXF1aXJlKCcuL1F1ZXJ5U2V0JyksXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuLyoqXG4gKlxuICogQHBhcmFtIHtRdWVyeX0gcXVlcnkgLSBUaGUgdW5kZXJseWluZyBxdWVyeVxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIFJlYWN0aXZlUXVlcnkocXVlcnkpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcbiAgQ2hhaW4uY2FsbCh0aGlzKTtcbiAgdXRpbC5leHRlbmQodGhpcywge1xuICAgIGluc2VydGlvblBvbGljeTogUmVhY3RpdmVRdWVyeS5JbnNlcnRpb25Qb2xpY3kuQmFjayxcbiAgICBpbml0aWFsaXNlZDogZmFsc2VcbiAgfSk7XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdxdWVyeScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3F1ZXJ5XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKHYpIHtcbiAgICAgIGlmICh2KSB7XG4gICAgICAgIHRoaXMuX3F1ZXJ5ID0gdjtcbiAgICAgICAgdGhpcy5yZXN1bHRzID0gY29uc3RydWN0UXVlcnlTZXQoW10sIHYubW9kZWwpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHRoaXMuX3F1ZXJ5ID0gbnVsbDtcbiAgICAgICAgdGhpcy5yZXN1bHRzID0gbnVsbDtcbiAgICAgIH1cbiAgICB9LFxuICAgIGNvbmZpZ3VyYWJsZTogZmFsc2UsXG4gICAgZW51bWVyYWJsZTogdHJ1ZVxuICB9KTtcblxuICBpZiAocXVlcnkpIHtcbiAgICB1dGlsLmV4dGVuZCh0aGlzLCB7XG4gICAgICBfcXVlcnk6IHF1ZXJ5LFxuICAgICAgcmVzdWx0czogY29uc3RydWN0UXVlcnlTZXQoW10sIHF1ZXJ5Lm1vZGVsKVxuICAgIH0pXG4gIH1cblxuICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0aGlzLCB7XG4gICAgaW5pdGlhbGl6ZWQ6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmluaXRpYWxpc2VkXG4gICAgICB9XG4gICAgfSxcbiAgICBtb2RlbDoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHF1ZXJ5ID0gc2VsZi5fcXVlcnk7XG4gICAgICAgIGlmIChxdWVyeSkge1xuICAgICAgICAgIHJldHVybiBxdWVyeS5tb2RlbFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgICBjb2xsZWN0aW9uOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gc2VsZi5tb2RlbC5jb2xsZWN0aW9uTmFtZVxuICAgICAgfVxuICAgIH1cbiAgfSk7XG5cblxufVxuXG5SZWFjdGl2ZVF1ZXJ5LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRXZlbnRFbWl0dGVyLnByb3RvdHlwZSk7XG51dGlsLmV4dGVuZChSZWFjdGl2ZVF1ZXJ5LnByb3RvdHlwZSwgQ2hhaW4ucHJvdG90eXBlKTtcblxudXRpbC5leHRlbmQoUmVhY3RpdmVRdWVyeSwge1xuICBJbnNlcnRpb25Qb2xpY3k6IHtcbiAgICBGcm9udDogJ0Zyb250JyxcbiAgICBCYWNrOiAnQmFjaydcbiAgfVxufSk7XG5cbnV0aWwuZXh0ZW5kKFJlYWN0aXZlUXVlcnkucHJvdG90eXBlLCB7XG4gIC8qKlxuICAgKlxuICAgKiBAcGFyYW0gY2JcbiAgICogQHBhcmFtIHtib29sfSBfaWdub3JlSW5pdCAtIGV4ZWN1dGUgcXVlcnkgYWdhaW4sIGluaXRpYWxpc2VkIG9yIG5vdC5cbiAgICogQHJldHVybnMgeyp9XG4gICAqL1xuICBpbml0OiBmdW5jdGlvbihjYiwgX2lnbm9yZUluaXQpIHtcbiAgICBpZiAodGhpcy5fcXVlcnkpIHtcbiAgICAgIHZhciBuYW1lID0gdGhpcy5fY29uc3RydWN0Tm90aWZpY2F0aW9uTmFtZSgpO1xuICAgICAgdmFyIGhhbmRsZXIgPSBmdW5jdGlvbihuKSB7XG4gICAgICAgIHRoaXMuX2hhbmRsZU5vdGlmKG4pO1xuICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgdGhpcy5oYW5kbGVyID0gaGFuZGxlcjtcbiAgICAgIHRoaXMubW9kZWwuYXBwLmV2ZW50cy5vbihuYW1lLCBoYW5kbGVyKTtcbiAgICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgIGlmICgoIXRoaXMuaW5pdGlhbGlzZWQpIHx8IF9pZ25vcmVJbml0KSB7XG4gICAgICAgICAgdGhpcy5fcXVlcnkuZXhlY3V0ZShmdW5jdGlvbihlcnIsIHJlc3VsdHMpIHtcbiAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgIGNiKG51bGwsIHRoaXMuX2FwcGx5UmVzdWx0cyhyZXN1bHRzKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGNiKG51bGwsIHRoaXMucmVzdWx0cyk7XG4gICAgICAgIH1cbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuICAgIGVsc2UgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ05vIF9xdWVyeSBkZWZpbmVkJyk7XG4gIH0sXG4gIF9hcHBseVJlc3VsdHM6IGZ1bmN0aW9uKHJlc3VsdHMpIHtcbiAgICB0aGlzLnJlc3VsdHMgPSByZXN1bHRzO1xuICAgIHRoaXMuaW5pdGlhbGlzZWQgPSB0cnVlO1xuICAgIHJldHVybiB0aGlzLnJlc3VsdHM7XG4gIH0sXG4gIGluc2VydDogZnVuY3Rpb24obmV3T2JqKSB7XG4gICAgdmFyIHJlc3VsdHMgPSB0aGlzLnJlc3VsdHMubXV0YWJsZUNvcHkoKTtcbiAgICBpZiAodGhpcy5pbnNlcnRpb25Qb2xpY3kgPT0gUmVhY3RpdmVRdWVyeS5JbnNlcnRpb25Qb2xpY3kuQmFjaykgdmFyIGlkeCA9IHJlc3VsdHMucHVzaChuZXdPYmopO1xuICAgIGVsc2UgaWR4ID0gcmVzdWx0cy51bnNoaWZ0KG5ld09iaik7XG4gICAgdGhpcy5yZXN1bHRzID0gcmVzdWx0cy5hc01vZGVsUXVlcnlTZXQodGhpcy5tb2RlbCk7XG4gICAgcmV0dXJuIGlkeDtcbiAgfSxcbiAgLyoqXG4gICAqIEV4ZWN1dGUgdGhlIHVuZGVybHlpbmcgcXVlcnkgYWdhaW4uXG4gICAqIEBwYXJhbSBjYlxuICAgKi9cbiAgdXBkYXRlOiBmdW5jdGlvbihjYikge1xuICAgIHJldHVybiB0aGlzLmluaXQoY2IsIHRydWUpXG4gIH0sXG4gIF9oYW5kbGVOb3RpZjogZnVuY3Rpb24obikge1xuICAgIGlmIChuLnR5cGUgPT0gbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuTmV3KSB7XG4gICAgICB2YXIgbmV3T2JqID0gbi5uZXc7XG4gICAgICBpZiAodGhpcy5fcXVlcnkub2JqZWN0TWF0Y2hlc1F1ZXJ5KG5ld09iaikpIHtcbiAgICAgICAgbG9nKCdOZXcgb2JqZWN0IG1hdGNoZXMnLCBuZXdPYmopO1xuICAgICAgICB2YXIgaWR4ID0gdGhpcy5pbnNlcnQobmV3T2JqKTtcbiAgICAgICAgdGhpcy5lbWl0KG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSwge1xuICAgICAgICAgIGluZGV4OiBpZHgsXG4gICAgICAgICAgYWRkZWQ6IFtuZXdPYmpdLFxuICAgICAgICAgIHR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICBvYmo6IHRoaXNcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgbG9nKCdOZXcgb2JqZWN0IGRvZXMgbm90IG1hdGNoJywgbmV3T2JqKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSBpZiAobi50eXBlID09IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNldCkge1xuICAgICAgbmV3T2JqID0gbi5vYmo7XG4gICAgICB2YXIgaW5kZXggPSB0aGlzLnJlc3VsdHMuaW5kZXhPZihuZXdPYmopLFxuICAgICAgICBhbHJlYWR5Q29udGFpbnMgPSBpbmRleCA+IC0xLFxuICAgICAgICBtYXRjaGVzID0gdGhpcy5fcXVlcnkub2JqZWN0TWF0Y2hlc1F1ZXJ5KG5ld09iaik7XG4gICAgICBpZiAobWF0Y2hlcyAmJiAhYWxyZWFkeUNvbnRhaW5zKSB7XG4gICAgICAgIGxvZygnVXBkYXRlZCBvYmplY3Qgbm93IG1hdGNoZXMhJywgbmV3T2JqKTtcbiAgICAgICAgaWR4ID0gdGhpcy5pbnNlcnQobmV3T2JqKTtcbiAgICAgICAgdGhpcy5lbWl0KG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSwge1xuICAgICAgICAgIGluZGV4OiBpZHgsXG4gICAgICAgICAgYWRkZWQ6IFtuZXdPYmpdLFxuICAgICAgICAgIHR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICBvYmo6IHRoaXNcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIGlmICghbWF0Y2hlcyAmJiBhbHJlYWR5Q29udGFpbnMpIHtcbiAgICAgICAgbG9nKCdVcGRhdGVkIG9iamVjdCBubyBsb25nZXIgbWF0Y2hlcyEnLCBuZXdPYmopO1xuICAgICAgICByZXN1bHRzID0gdGhpcy5yZXN1bHRzLm11dGFibGVDb3B5KCk7XG4gICAgICAgIHZhciByZW1vdmVkID0gcmVzdWx0cy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB0aGlzLnJlc3VsdHMgPSByZXN1bHRzLmFzTW9kZWxRdWVyeVNldCh0aGlzLm1vZGVsKTtcbiAgICAgICAgdGhpcy5lbWl0KG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSwge1xuICAgICAgICAgIGluZGV4OiBpbmRleCxcbiAgICAgICAgICBvYmo6IHRoaXMsXG4gICAgICAgICAgbmV3OiBuZXdPYmosXG4gICAgICAgICAgdHlwZTogbW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuU3BsaWNlLFxuICAgICAgICAgIHJlbW92ZWQ6IHJlbW92ZWRcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIGlmICghbWF0Y2hlcyAmJiAhYWxyZWFkeUNvbnRhaW5zKSB7XG4gICAgICAgIGxvZygnRG9lcyBub3QgY29udGFpbiwgYnV0IGRvZXNudCBtYXRjaCBzbyBub3QgaW5zZXJ0aW5nJywgbmV3T2JqKTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKG1hdGNoZXMgJiYgYWxyZWFkeUNvbnRhaW5zKSB7XG4gICAgICAgIGxvZygnTWF0Y2hlcyBidXQgYWxyZWFkeSBjb250YWlucycsIG5ld09iaik7XG4gICAgICAgIC8vIFNlbmQgdGhlIG5vdGlmaWNhdGlvbiBvdmVyLlxuICAgICAgICB0aGlzLmVtaXQobi50eXBlLCBuKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSBpZiAobi50eXBlID09IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlJlbW92ZSkge1xuICAgICAgbmV3T2JqID0gbi5vYmo7XG4gICAgICB2YXIgcmVzdWx0cyA9IHRoaXMucmVzdWx0cy5tdXRhYmxlQ29weSgpO1xuICAgICAgaW5kZXggPSByZXN1bHRzLmluZGV4T2YobmV3T2JqKTtcbiAgICAgIGlmIChpbmRleCA+IC0xKSB7XG4gICAgICAgIGxvZygnUmVtb3Zpbmcgb2JqZWN0JywgbmV3T2JqKTtcbiAgICAgICAgcmVtb3ZlZCA9IHJlc3VsdHMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgdGhpcy5yZXN1bHRzID0gY29uc3RydWN0UXVlcnlTZXQocmVzdWx0cywgdGhpcy5tb2RlbCk7XG4gICAgICAgIHRoaXMuZW1pdChtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZS5TcGxpY2UsIHtcbiAgICAgICAgICBpbmRleDogaW5kZXgsXG4gICAgICAgICAgb2JqOiB0aGlzLFxuICAgICAgICAgIHR5cGU6IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICByZW1vdmVkOiByZW1vdmVkXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGxvZygnTm8gbW9kZWxFdmVudHMgbmVjY2Vzc2FyeS4nLCBuZXdPYmopO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdVbmtub3duIGNoYW5nZSB0eXBlIFwiJyArIG4udHlwZS50b1N0cmluZygpICsgJ1wiJylcbiAgICB9XG4gICAgdGhpcy5yZXN1bHRzID0gY29uc3RydWN0UXVlcnlTZXQodGhpcy5fcXVlcnkuX3NvcnRSZXN1bHRzKHRoaXMucmVzdWx0cyksIHRoaXMubW9kZWwpO1xuICB9LFxuICBfY29uc3RydWN0Tm90aWZpY2F0aW9uTmFtZTogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY29sbGVjdGlvbk5hbWUgKyAnOicgKyB0aGlzLm1vZGVsLm5hbWU7XG4gIH0sXG4gIHRlcm1pbmF0ZTogZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMuaGFuZGxlcikge1xuICAgICAgdGhpcy5tb2RlbC5hcHAuZXZlbnRzLnJlbW92ZUxpc3RlbmVyKHRoaXMuX2NvbnN0cnVjdE5vdGlmaWNhdGlvbk5hbWUoKSwgdGhpcy5oYW5kbGVyKTtcbiAgICB9XG4gICAgdGhpcy5yZXN1bHRzID0gbnVsbDtcbiAgICB0aGlzLmhhbmRsZXIgPSBudWxsO1xuICB9LFxuICBfcmVnaXN0ZXJFdmVudEhhbmRsZXI6IGZ1bmN0aW9uKG9uLCBuYW1lLCBmbikge1xuICAgIHZhciByZW1vdmVMaXN0ZW5lciA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXI7XG4gICAgaWYgKG5hbWUudHJpbSgpID09ICcqJykge1xuICAgICAgT2JqZWN0LmtleXMobW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUpLmZvckVhY2goZnVuY3Rpb24oaykge1xuICAgICAgICBvbi5jYWxsKHRoaXMsIG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlW2tdLCBmbik7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIG9uLmNhbGwodGhpcywgbmFtZSwgZm4pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fbGluayh7XG4gICAgICAgIG9uOiB0aGlzLm9uLmJpbmQodGhpcyksXG4gICAgICAgIG9uY2U6IHRoaXMub25jZS5iaW5kKHRoaXMpLFxuICAgICAgICB1cGRhdGU6IHRoaXMudXBkYXRlLmJpbmQodGhpcyksXG4gICAgICAgIGluc2VydDogdGhpcy5pbnNlcnQuYmluZCh0aGlzKVxuICAgICAgfSxcbiAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAobmFtZS50cmltKCkgPT0gJyonKSB7XG4gICAgICAgICAgT2JqZWN0LmtleXMobW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUpLmZvckVhY2goZnVuY3Rpb24oaykge1xuICAgICAgICAgICAgcmVtb3ZlTGlzdGVuZXIuY2FsbCh0aGlzLCBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZVtrXSwgZm4pO1xuICAgICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgcmVtb3ZlTGlzdGVuZXIuY2FsbCh0aGlzLCBuYW1lLCBmbik7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gIH0sXG4gIG9uOiBmdW5jdGlvbihuYW1lLCBmbikge1xuICAgIHJldHVybiB0aGlzLl9yZWdpc3RlckV2ZW50SGFuZGxlcihFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uLCBuYW1lLCBmbik7XG4gIH0sXG4gIG9uY2U6IGZ1bmN0aW9uKG5hbWUsIGZuKSB7XG4gICAgcmV0dXJuIHRoaXMuX3JlZ2lzdGVyRXZlbnRIYW5kbGVyKEV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSwgbmFtZSwgZm4pO1xuICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBSZWFjdGl2ZVF1ZXJ5O1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvUmVhY3RpdmVRdWVyeS5qc1xuICoqIG1vZHVsZSBpZCA9IDdcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIi8qKlxuICogQG1vZHVsZSByZWxhdGlvbnNoaXBzXG4gKi9cblxudmFyIFJlbGF0aW9uc2hpcFByb3h5ID0gcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBQcm94eScpLFxuICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzID0gbW9kZWxFdmVudHMud3JhcEFycmF5LFxuICBBcnJheU9ic2VydmVyID0gcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5BcnJheU9ic2VydmVyLFxuICBNb2RlbEV2ZW50VHlwZSA9IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlO1xuXG4vKipcbiAqIFtNYW55VG9NYW55UHJveHkgZGVzY3JpcHRpb25dXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICovXG5mdW5jdGlvbiBNYW55VG9NYW55UHJveHkob3B0cykge1xuICBSZWxhdGlvbnNoaXBQcm94eS5jYWxsKHRoaXMsIG9wdHMpO1xuICB0aGlzLnJlbGF0ZWQgPSBbXTtcbiAgdGhpcy5yZWxhdGVkQ2FuY2VsTGlzdGVuZXJzID0ge307XG4gIGlmICh0aGlzLmlzUmV2ZXJzZSkge1xuICAgIHRoaXMucmVsYXRlZCA9IFtdO1xuICAgIC8vdGhpcy5mb3J3YXJkTW9kZWwub24obW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuUmVtb3ZlLCBmdW5jdGlvbihlKSB7XG4gICAgLy8gIGlmIChlLmZpZWxkID09IGUuZm9yd2FyZE5hbWUpIHtcbiAgICAvLyAgICB2YXIgaWR4ID0gdGhpcy5yZWxhdGVkLmluZGV4T2YoZS5vYmopO1xuICAgIC8vICAgIGlmIChpZHggPiAtMSkge1xuICAgIC8vICAgICAgdmFyIHJlbW92ZWQgPSB0aGlzLnJlbGF0ZWQuc3BsaWNlKGlkeCwgMSk7XG4gICAgLy8gICAgfVxuICAgIC8vICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgIC8vICAgICAgY29sbGVjdGlvbjogdGhpcy5yZXZlcnNlTW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgLy8gICAgICBtb2RlbDogdGhpcy5yZXZlcnNlTW9kZWwubmFtZSxcbiAgICAvLyAgICAgIGxvY2FsSWQ6IHRoaXMub2JqZWN0LmxvY2FsSWQsXG4gICAgLy8gICAgICBmaWVsZDogdGhpcy5yZXZlcnNlTmFtZSxcbiAgICAvLyAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgLy8gICAgICBhZGRlZDogW10sXG4gICAgLy8gICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgLy8gICAgICBpbmRleDogaWR4LFxuICAgIC8vICAgICAgb2JqOiB0aGlzLm9iamVjdFxuICAgIC8vICAgIH0pO1xuICAgIC8vICB9XG4gICAgLy99LmJpbmQodGhpcykpO1xuICB9XG59XG5cbk1hbnlUb01hbnlQcm94eS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSk7XG5cbnV0aWwuZXh0ZW5kKE1hbnlUb01hbnlQcm94eS5wcm90b3R5cGUsIHtcbiAgY2xlYXJSZXZlcnNlOiBmdW5jdGlvbihyZW1vdmVkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJlbW92ZWQuZm9yRWFjaChmdW5jdGlvbihyZW1vdmVkT2JqZWN0KSB7XG4gICAgICB2YXIgcmV2ZXJzZVByb3h5ID0gc2VsZi5yZXZlcnNlUHJveHlGb3JJbnN0YW5jZShyZW1vdmVkT2JqZWN0KTtcbiAgICAgIHZhciBpZHggPSByZXZlcnNlUHJveHkucmVsYXRlZC5pbmRleE9mKHNlbGYub2JqZWN0KTtcbiAgICAgIHJldmVyc2VQcm94eS5tYWtlQ2hhbmdlc1RvUmVsYXRlZFdpdGhvdXRPYnNlcnZhdGlvbnMoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldmVyc2VQcm94eS5zcGxpY2UoaWR4LCAxKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9LFxuICBzZXRSZXZlcnNlT2ZBZGRlZDogZnVuY3Rpb24oYWRkZWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgYWRkZWQuZm9yRWFjaChmdW5jdGlvbihhZGRlZE9iamVjdCkge1xuICAgICAgdmFyIHJldmVyc2VQcm94eSA9IHNlbGYucmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2UoYWRkZWRPYmplY3QpO1xuICAgICAgcmV2ZXJzZVByb3h5Lm1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9ucyhmdW5jdGlvbigpIHtcbiAgICAgICAgcmV2ZXJzZVByb3h5LnNwbGljZSgwLCAwLCBzZWxmLm9iamVjdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSxcbiAgd3JhcEFycmF5OiBmdW5jdGlvbihhcnIpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgd3JhcEFycmF5Rm9yQXR0cmlidXRlcyhhcnIsIHRoaXMucmV2ZXJzZU5hbWUsIHRoaXMub2JqZWN0KTtcbiAgICBpZiAoIWFyci5hcnJheU9ic2VydmVyKSB7XG4gICAgICBhcnIuYXJyYXlPYnNlcnZlciA9IG5ldyBBcnJheU9ic2VydmVyKGFycik7XG4gICAgICB2YXIgb2JzZXJ2ZXJGdW5jdGlvbiA9IGZ1bmN0aW9uKHNwbGljZXMpIHtcbiAgICAgICAgc3BsaWNlcy5mb3JFYWNoKGZ1bmN0aW9uKHNwbGljZSkge1xuICAgICAgICAgIHZhciBhZGRlZCA9IHNwbGljZS5hZGRlZENvdW50ID8gYXJyLnNsaWNlKHNwbGljZS5pbmRleCwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQpIDogW107XG4gICAgICAgICAgdmFyIHJlbW92ZWQgPSBzcGxpY2UucmVtb3ZlZDtcbiAgICAgICAgICBzZWxmLmNsZWFyUmV2ZXJzZShyZW1vdmVkKTtcbiAgICAgICAgICBzZWxmLnNldFJldmVyc2VPZkFkZGVkKGFkZGVkKTtcbiAgICAgICAgICB2YXIgbW9kZWwgPSBzZWxmLmdldEZvcndhcmRNb2RlbCgpO1xuICAgICAgICAgIG1vZGVsLmFwcC5icm9hZGNhc3Qoe1xuICAgICAgICAgICAgY29sbGVjdGlvbjogbW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICBtb2RlbDogbW9kZWwubmFtZSxcbiAgICAgICAgICAgIGxvY2FsSWQ6IHNlbGYub2JqZWN0LmxvY2FsSWQsXG4gICAgICAgICAgICBmaWVsZDogc2VsZi5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgICAgICAgcmVtb3ZlZDogcmVtb3ZlZCxcbiAgICAgICAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgIGluZGV4OiBzcGxpY2UuaW5kZXgsXG4gICAgICAgICAgICBvYmo6IHNlbGYub2JqZWN0XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfTtcbiAgICAgIGFyci5hcnJheU9ic2VydmVyLm9wZW4ob2JzZXJ2ZXJGdW5jdGlvbik7XG4gICAgfVxuICB9LFxuICBnZXQ6IGZ1bmN0aW9uKGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIGNiKG51bGwsIHRoaXMucmVsYXRlZCk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgdmFsaWRhdGU6IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSAhPSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICByZXR1cm4gJ0Nhbm5vdCBhc3NpZ24gc2NhbGFyIHRvIG1hbnkgdG8gbWFueSc7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuICBzZXQ6IGZ1bmN0aW9uKG9iaiwgb3B0cykge1xuICAgIHRoaXMuY2hlY2tJbnN0YWxsZWQoKTtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKG9iaikge1xuICAgICAgdmFyIGVycm9yTWVzc2FnZTtcbiAgICAgIGlmIChlcnJvck1lc3NhZ2UgPSB0aGlzLnZhbGlkYXRlKG9iaikpIHtcbiAgICAgICAgcmV0dXJuIGVycm9yTWVzc2FnZTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB0aGlzLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkKG9iaiwgb3B0cyk7XG4gICAgICAgIHRoaXMud3JhcEFycmF5KG9iaik7XG4gICAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkUmV2ZXJzZShvYmosIG9wdHMpO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHRoaXMuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgIHNlbGYuc2V0SWRBbmRSZWxhdGVkKG9iaiwgb3B0cyk7XG4gICAgfVxuICB9LFxuICBpbnN0YWxsOiBmdW5jdGlvbihvYmopIHtcbiAgICBSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUuaW5zdGFsbC5jYWxsKHRoaXMsIG9iaik7XG4gICAgdGhpcy53cmFwQXJyYXkodGhpcy5yZWxhdGVkKTtcbiAgICBvYmpbKCdzcGxpY2UnICsgdXRpbC5jYXBpdGFsaXNlRmlyc3RMZXR0ZXIodGhpcy5yZXZlcnNlTmFtZSkpXSA9IHRoaXMuc3BsaWNlLmJpbmQodGhpcyk7XG4gIH0sXG4gIHJlZ2lzdGVyUmVtb3ZhbExpc3RlbmVyOiBmdW5jdGlvbihvYmopIHtcbiAgICB0aGlzLnJlbGF0ZWRDYW5jZWxMaXN0ZW5lcnNbb2JqLmxvY2FsSWRdID0gb2JqLm9uKCcqJywgZnVuY3Rpb24oZSkge1xuXG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gTWFueVRvTWFueVByb3h5O1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvTWFueVRvTWFueVByb3h5LmpzXG4gKiogbW9kdWxlIGlkID0gOFxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIENvbGxlY3Rpb25SZWdpc3RyeSA9IHJlcXVpcmUoJy4vY29sbGVjdGlvblJlZ2lzdHJ5JyksXG4gIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICBDYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKSxcbiAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICBNb2RlbCA9IHJlcXVpcmUoJy4vbW9kZWwnKSxcbiAgZXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJyksXG4gIFN0b3JhZ2UgPSByZXF1aXJlKCcuLi9zdG9yYWdlJyksXG4gIFF1ZXJ5ID0gcmVxdWlyZSgnLi9RdWVyeScpLFxuICBDb2xsZWN0aW9uID0gcmVxdWlyZSgnLi9jb2xsZWN0aW9uJyk7XG5cbmZ1bmN0aW9uIENvbnRleHQobmFtZSwgYXBwKSB7XG4gIHRoaXMubmFtZSA9IG5hbWU7XG4gIHRoaXMuY29sbGVjdGlvblJlZ2lzdHJ5ID0gbmV3IENvbGxlY3Rpb25SZWdpc3RyeSgpO1xuICB0aGlzLmNhY2hlID0gbmV3IENhY2hlKCk7XG4gIHRoaXMuYXBwID0gYXBwO1xuICB0aGlzLnN0b3JhZ2UgPSBuZXcgU3RvcmFnZSh0aGlzLmFwcCk7XG4gIHRoaXMuZXZlbnRzID0gZXZlbnRzKCk7XG4gIHZhciBvZmYgPSB0aGlzLmV2ZW50cy5yZW1vdmVMaXN0ZW5lci5iaW5kKHRoaXMuZXZlbnRzKTtcblxuICB1dGlsLmV4dGVuZCh0aGlzLCB7XG4gICAgb246IHRoaXMuZXZlbnRzLm9uLmJpbmQodGhpcy5ldmVudHMpLFxuICAgIG9mZjogb2ZmLFxuICAgIHJlbW92ZUxpc3RlbmVyOiBvZmYsXG4gICAgb25jZTogdGhpcy5ldmVudHMub25jZS5iaW5kKHRoaXMuZXZlbnRzKSxcbiAgICByZW1vdmVBbGxMaXN0ZW5lcnM6IHRoaXMuZXZlbnRzLnJlbW92ZUFsbExpc3RlbmVycy5iaW5kKHRoaXMuZXZlbnRzKSxcbiAgICBub3RpZnk6IHV0aWwubmV4dCxcbiAgICByZWdpc3RlckNvbXBhcmF0b3I6IFF1ZXJ5LnJlZ2lzdGVyQ29tcGFyYXRvci5iaW5kKFF1ZXJ5KSxcbiAgICBzYXZlOiB0aGlzLnN0b3JhZ2Uuc2F2ZS5iaW5kKHRoaXMuc3RvcmFnZSksXG4gICAgc2V0UG91Y2g6IGZ1bmN0aW9uKHApIHtcbiAgICAgIHRoaXMuc3RvcmFnZS5wb3VjaCA9IHA7XG4gICAgfS5iaW5kKHRoaXMpXG4gIH0pO1xuXG4gIHZhciBpbnRlcnZhbCwgc2F2aW5nLCBhdXRvc2F2ZUludGVydmFsID0gNTAwO1xuICB2YXIgc3RvcmFnZUVuYWJsZWQ7XG5cblxuICBpZiAodHlwZW9mIFBvdWNoREIgPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICB0aGlzLnN0b3JhZ2VFbmFibGVkID0gZmFsc2U7XG4gICAgY29uc29sZS53YXJuKCdQb3VjaERCIGlzIG5vdCBwcmVzZW50IHRoZXJlZm9yZSBzdG9yYWdlIGlzIGRpc2FibGVkLicpO1xuICB9XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXModGhpcywge1xuICAgIGRpcnR5OiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgdW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24gPSB0aGlzLnN0b3JhZ2UuX3Vuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uO1xuICAgICAgICByZXR1cm4gISFPYmplY3Qua2V5cyh0aGlzLnN0b3JhZ2UudW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24pLmxlbmd0aDtcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSxcbiAgICBhdXRvc2F2ZUludGVydmFsOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gYXV0b3NhdmVJbnRlcnZhbDtcbiAgICAgIH0sXG4gICAgICBzZXQ6IGZ1bmN0aW9uKF9hdXRvc2F2ZUludGVydmFsKSB7XG4gICAgICAgIGF1dG9zYXZlSW50ZXJ2YWwgPSBfYXV0b3NhdmVJbnRlcnZhbDtcbiAgICAgICAgaWYgKGludGVydmFsKSB7XG4gICAgICAgICAgLy8gUmVzZXQgaW50ZXJ2YWxcbiAgICAgICAgICB0aGlzLmF1dG9zYXZlID0gZmFsc2U7XG4gICAgICAgICAgdGhpcy5hdXRvc2F2ZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIGF1dG9zYXZlOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gISFpbnRlcnZhbDtcbiAgICAgIH0sXG4gICAgICBzZXQ6IGZ1bmN0aW9uKGF1dG9zYXZlKSB7XG4gICAgICAgIGlmIChhdXRvc2F2ZSkge1xuICAgICAgICAgIGlmICghaW50ZXJ2YWwpIHtcbiAgICAgICAgICAgIGludGVydmFsID0gc2V0SW50ZXJ2YWwoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIC8vIENoZWVreSB3YXkgb2YgYXZvaWRpbmcgbXVsdGlwbGUgc2F2ZXMgaGFwcGVuaW5nLi4uXG4gICAgICAgICAgICAgIGlmICghc2F2aW5nKSB7XG4gICAgICAgICAgICAgICAgc2F2aW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLnN0b3JhZ2Uuc2F2ZShmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZXZlbnRzLmVtaXQoJ3NhdmVkJyk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBzYXZpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LmJpbmQodGhpcyksIHRoaXMuYXV0b3NhdmVJbnRlcnZhbCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGlmIChpbnRlcnZhbCkge1xuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChpbnRlcnZhbCk7XG4gICAgICAgICAgICBpbnRlcnZhbCA9IG51bGw7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgICBzdG9yYWdlRW5hYmxlZDoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHN0b3JhZ2VFbmFibGVkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICByZXR1cm4gc3RvcmFnZUVuYWJsZWQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuICEhdGhpcy5zdG9yYWdlO1xuICAgICAgfSxcbiAgICAgIHNldDogZnVuY3Rpb24odikge1xuICAgICAgICBzdG9yYWdlRW5hYmxlZCA9IHY7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH1cbiAgfSk7XG59XG5cbkNvbnRleHQucHJvdG90eXBlID0ge1xuICBjb2xsZWN0aW9uOiBmdW5jdGlvbihuYW1lLCBvcHRzKSB7XG4gICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgb3B0cy5hcHAgPSB0aGlzO1xuICAgIHJldHVybiBuZXcgQ29sbGVjdGlvbihuYW1lLCBvcHRzKTtcbiAgfSxcblxuICBicm9hZGNhc3Q6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICBtb2RlbEV2ZW50cy5lbWl0KHRoaXMsIG9wdHMpO1xuICB9LFxuICBncmFwaDogZnVuY3Rpb24oZGF0YSwgb3B0cywgY2IpIHtcbiAgICBpZiAodHlwZW9mIG9wdHMgPT0gJ2Z1bmN0aW9uJykgY2IgPSBvcHRzO1xuICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICB2YXIgdGFza3MgPSBbXSwgZXJyO1xuICAgICAgZm9yICh2YXIgY29sbGVjdGlvbk5hbWUgaW4gZGF0YSkge1xuICAgICAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eShjb2xsZWN0aW9uTmFtZSkpIHtcbiAgICAgICAgICB2YXIgY29sbGVjdGlvbiA9IHRoaXMuY29sbGVjdGlvblJlZ2lzdHJ5W2NvbGxlY3Rpb25OYW1lXTtcbiAgICAgICAgICBpZiAoY29sbGVjdGlvbikge1xuICAgICAgICAgICAgKGZ1bmN0aW9uKGNvbGxlY3Rpb24sIGRhdGEpIHtcbiAgICAgICAgICAgICAgdGFza3MucHVzaChmdW5jdGlvbihkb25lKSB7XG4gICAgICAgICAgICAgICAgY29sbGVjdGlvbi5ncmFwaChkYXRhLCBmdW5jdGlvbihlcnIsIHJlcykge1xuICAgICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3VsdHMgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0c1tjb2xsZWN0aW9uLm5hbWVdID0gcmVzO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgZG9uZShlcnIsIHJlc3VsdHMpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pKGNvbGxlY3Rpb24sIGRhdGFbY29sbGVjdGlvbk5hbWVdKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBlcnIgPSAnTm8gc3VjaCBjb2xsZWN0aW9uIFwiJyArIGNvbGxlY3Rpb25OYW1lICsgJ1wiJztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICghZXJyKSB7XG4gICAgICAgIHV0aWwuc2VyaWVzKHRhc2tzLCBmdW5jdGlvbihlcnIsIHJlc3VsdHMpIHtcbiAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgcmVzdWx0cyA9IHJlc3VsdHMucmVkdWNlKGZ1bmN0aW9uKG1lbW8sIHJlcykge1xuICAgICAgICAgICAgICByZXR1cm4gdXRpbC5leHRlbmQobWVtbywgcmVzKTtcbiAgICAgICAgICAgIH0sIHt9KVxuICAgICAgICAgIH0gZWxzZSByZXN1bHRzID0gbnVsbDtcbiAgICAgICAgICBjYihlcnIsIHJlc3VsdHMpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGVsc2UgY2IoZXJyb3IoZXJyLCB7ZGF0YTogZGF0YSwgaW52YWxpZENvbGxlY3Rpb25OYW1lOiBjb2xsZWN0aW9uTmFtZX0pKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuICBjb3VudDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuY2FjaGUuY291bnQoKTtcbiAgfSxcbiAgZ2V0OiBmdW5jdGlvbihpZCwgY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgY2IobnVsbCwgdGhpcy5jYWNoZS5fbG9jYWxDYWNoZSgpW2lkXSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgcmVtb3ZlQWxsOiBmdW5jdGlvbihjYikge1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICB1dGlsLlByb21pc2UuYWxsKFxuICAgICAgICB0aGlzLmNvbGxlY3Rpb25SZWdpc3RyeS5jb2xsZWN0aW9uTmFtZXMubWFwKGZ1bmN0aW9uKGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuY29sbGVjdGlvblJlZ2lzdHJ5W2NvbGxlY3Rpb25OYW1lXS5yZW1vdmVBbGwoKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKVxuICAgICAgKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGNiKG51bGwpO1xuICAgICAgICB9KS5jYXRjaChjYilcbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuICBfZW5zdXJlSW5zdGFsbGVkOiBmdW5jdGlvbihjYikge1xuICAgIGNiID0gY2IgfHwgZnVuY3Rpb24oKSB7fTtcbiAgICB2YXIgY29sbGVjdGlvbk5hbWVzID0gdGhpcy5jb2xsZWN0aW9uUmVnaXN0cnkuY29sbGVjdGlvbk5hbWVzO1xuICAgIHZhciBhbGxNb2RlbHMgPSBjb2xsZWN0aW9uTmFtZXNcbiAgICAgIC5yZWR1Y2UoZnVuY3Rpb24obWVtbywgY29sbGVjdGlvbk5hbWUpIHtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb24gPSB0aGlzLmNvbGxlY3Rpb25SZWdpc3RyeVtjb2xsZWN0aW9uTmFtZV07XG4gICAgICAgIG1lbW8gPSBtZW1vLmNvbmNhdChjb2xsZWN0aW9uLm1vZGVscyk7XG4gICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgfS5iaW5kKHRoaXMpLCBbXSk7XG4gICAgTW9kZWwuaW5zdGFsbChhbGxNb2RlbHMsIGNiKTtcbiAgfSxcbiAgX3B1c2hUYXNrOiBmdW5jdGlvbih0YXNrKSB7XG4gICAgaWYgKCF0aGlzLnF1ZXVlZFRhc2tzKSB7XG4gICAgICB0aGlzLnF1ZXVlZFRhc2tzID0gbmV3IGZ1bmN0aW9uIFF1ZXVlKCkge1xuICAgICAgICB0aGlzLnRhc2tzID0gW107XG4gICAgICAgIHRoaXMuZXhlY3V0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHRoaXMudGFza3MuZm9yRWFjaChmdW5jdGlvbihmKSB7XG4gICAgICAgICAgICBmKClcbiAgICAgICAgICB9KTtcbiAgICAgICAgICB0aGlzLnRhc2tzID0gW107XG4gICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgIH07XG4gICAgfVxuICAgIHRoaXMucXVldWVkVGFza3MudGFza3MucHVzaCh0YXNrKTtcbiAgfSxcbiAgcmVzZXQ6IGZ1bmN0aW9uKGNiLCByZXNldFN0b3JhZ2UpIHtcbiAgICBkZWxldGUgdGhpcy5xdWV1ZWRUYXNrcztcbiAgICB0aGlzLmNhY2hlLnJlc2V0KCk7XG4gICAgdGhpcy5jb2xsZWN0aW9uUmVnaXN0cnkucmVzZXQoKTtcbiAgICB2YXIgY29sbGVjdGlvbk5hbWVzID0gdGhpcy5jb2xsZWN0aW9uUmVnaXN0cnkuY29sbGVjdGlvbk5hbWVzO1xuICAgIGNvbGxlY3Rpb25OYW1lcy5yZWR1Y2UoZnVuY3Rpb24obWVtbywgY29sbE5hbWUpIHtcbiAgICAgIHZhciBjb2xsID0gdGhpcy5jb2xsZWN0aW9uUmVnaXN0cnlbY29sbE5hbWVdO1xuICAgICAgT2JqZWN0LmtleXMoY29sbC5fbW9kZWxzKS5mb3JFYWNoKGZ1bmN0aW9uKG1vZGVsTmFtZSkge1xuICAgICAgICB2YXIgbW9kZWwgPSBjb2xsW21vZGVsTmFtZV07XG4gICAgICAgIG1lbW8ucHVzaChtb2RlbC5fc3RvcmFnZUVuYWJsZWQpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gbWVtbztcbiAgICB9LmJpbmQodGhpcyksIFtdKTtcbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygpO1xuICAgIGlmICh0aGlzLnN0b3JhZ2VFbmFibGVkKSB7XG4gICAgICByZXNldFN0b3JhZ2UgPSByZXNldFN0b3JhZ2UgPT09IHVuZGVmaW5lZCA/IHRydWUgOiByZXNldFN0b3JhZ2U7XG4gICAgICBpZiAocmVzZXRTdG9yYWdlKSB7XG4gICAgICAgIHRoaXMuc3RvcmFnZS5fcmVzZXQoY2IpO1xuICAgICAgICB0aGlzLnNldFBvdWNoKG5ldyBQb3VjaERCKCdzaWVzdGEnLCB7YXV0b19jb21wYWN0aW9uOiB0cnVlLCBhZGFwdGVyOiAnbWVtb3J5J30pKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBjYigpO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGNiKCk7XG4gICAgfVxuICB9LFxufTtcblxuZnVuY3Rpb24gQXBwKG5hbWUpIHtcbiAgaWYgKCFuYW1lKSB0aHJvdyBuZXcgRXJyb3IoJ0FwcCBtdXN0IGhhdmUgYSBuYW1lJyk7XG4gIHRoaXMubmFtZSA9IG5hbWU7XG5cbiAgdGhpcy5kZWZhdWx0Q29udGV4dCA9IG5ldyBDb250ZXh0KG5hbWUgKyAnLWRlZmF1bHQnLCB0aGlzKTtcbiAgdXRpbC5leHRlbmQodGhpcywgdGhpcy5kZWZhdWx0Q29udGV4dCk7XG5cbiAgZnVuY3Rpb24gY29weVByb3BlcnR5KHByb3ApIHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgcHJvcCwge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGVmYXVsdENvbnRleHRbcHJvcF07XG4gICAgICB9LFxuICAgICAgc2V0OiBmdW5jdGlvbih2KSB7XG4gICAgICAgIHRoaXMuZGVmYXVsdENvbnRleHRbcHJvcF0gPSB2O1xuICAgICAgfSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9KTtcbiAgfVxuXG4gIHZhciBwYXNzVGhyb3VnaHByb3BlcnRpZXMgPSBbJ2RpcnR5JywgJ2F1dG9zYXZlSW50ZXJ2YWwnLCAnYXV0b3NhdmUnLCAnc3RvcmFnZUVuYWJsZWQnXTtcbiAgcGFzc1Rocm91Z2hwcm9wZXJ0aWVzLmZvckVhY2goY29weVByb3BlcnR5LmJpbmQodGhpcykpO1xufVxuXG5BcHAucHJvdG90eXBlID0gQ29udGV4dC5wcm90b3R5cGU7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBBcHA7XG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9BcHAuanNcbiAqKiBtb2R1bGUgaWQgPSA5XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgUmVsYXRpb25zaGlwUHJveHkgPSByZXF1aXJlKCcuL1JlbGF0aW9uc2hpcFByb3h5JyksXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgU2llc3RhTW9kZWwgPSByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKTtcblxuLyoqXG4gKiBbT25lVG9PbmVQcm94eSBkZXNjcmlwdGlvbl1cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKi9cbmZ1bmN0aW9uIE9uZVRvT25lUHJveHkob3B0cykge1xuICBSZWxhdGlvbnNoaXBQcm94eS5jYWxsKHRoaXMsIG9wdHMpO1xufVxuXG5cbk9uZVRvT25lUHJveHkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShSZWxhdGlvbnNoaXBQcm94eS5wcm90b3R5cGUpO1xuXG51dGlsLmV4dGVuZChPbmVUb09uZVByb3h5LnByb3RvdHlwZSwge1xuICAvKipcbiAgICogVmFsaWRhdGUgdGhlIG9iamVjdCB0aGF0IHdlJ3JlIHNldHRpbmdcbiAgICogQHBhcmFtIG9ialxuICAgKiBAcmV0dXJucyB7c3RyaW5nfG51bGx9IEFuIGVycm9yIG1lc3NhZ2Ugb3IgbnVsbFxuICAgKi9cbiAgdmFsaWRhdGU6IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSA9PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICByZXR1cm4gJ0Nhbm5vdCBhc3NpZ24gYXJyYXkgdG8gb25lIHRvIG9uZSByZWxhdGlvbnNoaXAnO1xuICAgIH1cbiAgICBlbHNlIGlmICgoIW9iaiBpbnN0YW5jZW9mIFNpZXN0YU1vZGVsKSkge1xuXG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuICBzZXQ6IGZ1bmN0aW9uKG9iaiwgb3B0cykge1xuICAgIHRoaXMuY2hlY2tJbnN0YWxsZWQoKTtcbiAgICBpZiAob2JqKSB7XG4gICAgICB2YXIgZXJyb3JNZXNzYWdlO1xuICAgICAgaWYgKGVycm9yTWVzc2FnZSA9IHRoaXMudmFsaWRhdGUob2JqKSkge1xuICAgICAgICByZXR1cm4gZXJyb3JNZXNzYWdlO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHRoaXMuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgICAgdGhpcy5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICAgICAgdGhpcy5zZXRJZEFuZFJlbGF0ZWRSZXZlcnNlKG9iaiwgb3B0cyk7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhpcy5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgdGhpcy5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICB9XG4gIH0sXG4gIGdldDogZnVuY3Rpb24oY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgY2IobnVsbCwgdGhpcy5yZWxhdGVkKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBPbmVUb09uZVByb3h5O1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL09uZVRvT25lUHJveHkuanNcbiAqKiBtb2R1bGUgaWQgPSAxMFxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIFJlbGF0aW9uc2hpcFByb3h5ID0gcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBQcm94eScpLFxuICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzID0gbW9kZWxFdmVudHMud3JhcEFycmF5LFxuICBBcnJheU9ic2VydmVyID0gcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5BcnJheU9ic2VydmVyLFxuICBNb2RlbEV2ZW50VHlwZSA9IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlO1xuXG4vKipcbiAqIEBjbGFzcyAgW09uZVRvTWFueVByb3h5IGRlc2NyaXB0aW9uXVxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0ge1t0eXBlXX0gb3B0c1xuICovXG5mdW5jdGlvbiBPbmVUb01hbnlQcm94eShvcHRzKSB7XG4gIFJlbGF0aW9uc2hpcFByb3h5LmNhbGwodGhpcywgb3B0cyk7XG4gIGlmICh0aGlzLmlzUmV2ZXJzZSkge1xuICAgIHRoaXMucmVsYXRlZCA9IFtdO1xuICAgIC8vdGhpcy5mb3J3YXJkTW9kZWwub24obW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuUmVtb3ZlLCBmdW5jdGlvbihlKSB7XG4gICAgLy8gIGlmIChlLmZpZWxkID09IGUuZm9yd2FyZE5hbWUpIHtcbiAgICAvLyAgICB2YXIgaWR4ID0gdGhpcy5yZWxhdGVkLmluZGV4T2YoZS5vYmopO1xuICAgIC8vICAgIGlmIChpZHggPiAtMSkge1xuICAgIC8vICAgICAgdmFyIHJlbW92ZWQgPSB0aGlzLnJlbGF0ZWQuc3BsaWNlKGlkeCwgMSk7XG4gICAgLy8gICAgfVxuICAgIC8vICAgIG1vZGVsRXZlbnRzLmVtaXQoe1xuICAgIC8vICAgICAgY29sbGVjdGlvbjogdGhpcy5yZXZlcnNlTW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgLy8gICAgICBtb2RlbDogdGhpcy5yZXZlcnNlTW9kZWwubmFtZSxcbiAgICAvLyAgICAgIGxvY2FsSWQ6IHRoaXMub2JqZWN0LmxvY2FsSWQsXG4gICAgLy8gICAgICBmaWVsZDogdGhpcy5yZXZlcnNlTmFtZSxcbiAgICAvLyAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgLy8gICAgICBhZGRlZDogW10sXG4gICAgLy8gICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgLy8gICAgICBpbmRleDogaWR4LFxuICAgIC8vICAgICAgb2JqOiB0aGlzLm9iamVjdFxuICAgIC8vICAgIH0pO1xuICAgIC8vICB9XG4gICAgLy99LmJpbmQodGhpcykpO1xuICB9XG59XG5cbk9uZVRvTWFueVByb3h5LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlKTtcblxudXRpbC5leHRlbmQoT25lVG9NYW55UHJveHkucHJvdG90eXBlLCB7XG4gIGNsZWFyUmV2ZXJzZTogZnVuY3Rpb24ocmVtb3ZlZCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICByZW1vdmVkLmZvckVhY2goZnVuY3Rpb24ocmVtb3ZlZE9iamVjdCkge1xuICAgICAgdmFyIHJldmVyc2VQcm94eSA9IHNlbGYucmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2UocmVtb3ZlZE9iamVjdCk7XG4gICAgICByZXZlcnNlUHJveHkuc2V0SWRBbmRSZWxhdGVkKG51bGwpO1xuICAgIH0pO1xuICB9LFxuICBzZXRSZXZlcnNlT2ZBZGRlZDogZnVuY3Rpb24oYWRkZWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgYWRkZWQuZm9yRWFjaChmdW5jdGlvbihhZGRlZCkge1xuICAgICAgdmFyIGZvcndhcmRQcm94eSA9IHNlbGYucmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2UoYWRkZWQpO1xuICAgICAgZm9yd2FyZFByb3h5LnNldElkQW5kUmVsYXRlZChzZWxmLm9iamVjdCk7XG4gICAgfSk7XG4gIH0sXG4gIHdyYXBBcnJheTogZnVuY3Rpb24oYXJyKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMoYXJyLCB0aGlzLnJldmVyc2VOYW1lLCB0aGlzLm9iamVjdCk7XG4gICAgaWYgKCFhcnIuYXJyYXlPYnNlcnZlcikge1xuICAgICAgYXJyLmFycmF5T2JzZXJ2ZXIgPSBuZXcgQXJyYXlPYnNlcnZlcihhcnIpO1xuICAgICAgdmFyIG9ic2VydmVyRnVuY3Rpb24gPSBmdW5jdGlvbihzcGxpY2VzKSB7XG4gICAgICAgIHNwbGljZXMuZm9yRWFjaChmdW5jdGlvbihzcGxpY2UpIHtcbiAgICAgICAgICB2YXIgYWRkZWQgPSBzcGxpY2UuYWRkZWRDb3VudCA/IGFyci5zbGljZShzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50KSA6IFtdO1xuICAgICAgICAgIHZhciByZW1vdmVkID0gc3BsaWNlLnJlbW92ZWQ7XG4gICAgICAgICAgc2VsZi5jbGVhclJldmVyc2UocmVtb3ZlZCk7XG4gICAgICAgICAgc2VsZi5zZXRSZXZlcnNlT2ZBZGRlZChhZGRlZCk7XG4gICAgICAgICAgdmFyIG1vZGVsID0gc2VsZi5nZXRGb3J3YXJkTW9kZWwoKTtcbiAgICAgICAgICBtb2RlbC5hcHAuYnJvYWRjYXN0KHtcbiAgICAgICAgICAgIGNvbGxlY3Rpb246IG1vZGVsLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgbW9kZWw6IG1vZGVsLm5hbWUsXG4gICAgICAgICAgICBsb2NhbElkOiBzZWxmLm9iamVjdC5sb2NhbElkLFxuICAgICAgICAgICAgZmllbGQ6IHNlbGYuZ2V0Rm9yd2FyZE5hbWUoKSxcbiAgICAgICAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICAgICAgICBhZGRlZDogYWRkZWQsXG4gICAgICAgICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICAgICAgICBpbmRleDogc3BsaWNlLmluZGV4LFxuICAgICAgICAgICAgb2JqOiBzZWxmLm9iamVjdFxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH07XG4gICAgICBhcnIuYXJyYXlPYnNlcnZlci5vcGVuKG9ic2VydmVyRnVuY3Rpb24pO1xuICAgIH1cbiAgfSxcbiAgZ2V0OiBmdW5jdGlvbihjYikge1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICBjYihudWxsLCB0aGlzLnJlbGF0ZWQpO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG4gIC8qKlxuICAgKiBWYWxpZGF0ZSB0aGUgb2JqZWN0IHRoYXQgd2UncmUgc2V0dGluZ1xuICAgKiBAcGFyYW0gb2JqXG4gICAqIEByZXR1cm5zIHtzdHJpbmd8bnVsbH0gQW4gZXJyb3IgbWVzc2FnZSBvciBudWxsXG4gICAqIEBjbGFzcyBPbmVUb01hbnlQcm94eVxuICAgKi9cbiAgdmFsaWRhdGU6IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBzdHIgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKTtcbiAgICBpZiAodGhpcy5pc0ZvcndhcmQpIHtcbiAgICAgIGlmIChzdHIgPT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgICAgICByZXR1cm4gJ0Nhbm5vdCBhc3NpZ24gYXJyYXkgZm9yd2FyZCBvbmVUb01hbnkgKCcgKyBzdHIgKyAnKTogJyArIHRoaXMuZm9yd2FyZE5hbWU7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgaWYgKHN0ciAhPSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICAgIHJldHVybiAnQ2Fubm90IHNjYWxhciB0byByZXZlcnNlIG9uZVRvTWFueSAoJyArIHN0ciArICcpOiAnICsgdGhpcy5yZXZlcnNlTmFtZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG4gIHNldDogZnVuY3Rpb24ob2JqLCBvcHRzKSB7XG4gICAgdGhpcy5jaGVja0luc3RhbGxlZCgpO1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAob2JqKSB7XG4gICAgICB2YXIgZXJyb3JNZXNzYWdlO1xuICAgICAgaWYgKGVycm9yTWVzc2FnZSA9IHRoaXMudmFsaWRhdGUob2JqKSkge1xuICAgICAgICByZXR1cm4gZXJyb3JNZXNzYWdlO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHRoaXMuY2xlYXJSZXZlcnNlUmVsYXRlZChvcHRzKTtcbiAgICAgICAgc2VsZi5zZXRJZEFuZFJlbGF0ZWQob2JqLCBvcHRzKTtcbiAgICAgICAgaWYgKHNlbGYuaXNSZXZlcnNlKSB7XG4gICAgICAgICAgdGhpcy53cmFwQXJyYXkoc2VsZi5yZWxhdGVkKTtcbiAgICAgICAgfVxuICAgICAgICBzZWxmLnNldElkQW5kUmVsYXRlZFJldmVyc2Uob2JqLCBvcHRzKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICB0aGlzLmNsZWFyUmV2ZXJzZVJlbGF0ZWQob3B0cyk7XG4gICAgICBzZWxmLnNldElkQW5kUmVsYXRlZChvYmosIG9wdHMpO1xuICAgIH1cbiAgfSxcbiAgaW5zdGFsbDogZnVuY3Rpb24ob2JqKSB7XG4gICAgUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlLmluc3RhbGwuY2FsbCh0aGlzLCBvYmopO1xuXG4gICAgaWYgKHRoaXMuaXNSZXZlcnNlKSB7XG4gICAgICBvYmpbKCdzcGxpY2UnICsgdXRpbC5jYXBpdGFsaXNlRmlyc3RMZXR0ZXIodGhpcy5yZXZlcnNlTmFtZSkpXSA9IHRoaXMuc3BsaWNlLmJpbmQodGhpcyk7XG4gICAgICB0aGlzLndyYXBBcnJheSh0aGlzLnJlbGF0ZWQpO1xuICAgIH1cblxuICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBPbmVUb01hbnlQcm94eTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL09uZVRvTWFueVByb3h5LmpzXG4gKiogbW9kdWxlIGlkID0gMTFcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIi8qKlxuICogQmFzZSBmdW5jdGlvbmFsaXR5IGZvciByZWxhdGlvbnNoaXBzLlxuICogQG1vZHVsZSByZWxhdGlvbnNoaXBzXG4gKi9cbnZhciBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgUXVlcnkgPSByZXF1aXJlKCcuL1F1ZXJ5JyksXG4gIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyksXG4gIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICB3cmFwQXJyYXlGb3JBdHRyaWJ1dGVzID0gbW9kZWxFdmVudHMud3JhcEFycmF5LFxuICBBcnJheU9ic2VydmVyID0gcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5BcnJheU9ic2VydmVyLFxuICBNb2RlbEV2ZW50VHlwZSA9IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlO1xuXG4vKipcbiAqIEBjbGFzcyAgW1JlbGF0aW9uc2hpcFByb3h5IGRlc2NyaXB0aW9uXVxuICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBSZWxhdGlvbnNoaXBQcm94eShvcHRzKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgb3B0cyA9IG9wdHMgfHwge307XG5cbiAgdXRpbC5leHRlbmQodGhpcywge1xuICAgIG9iamVjdDogbnVsbCxcbiAgICByZWxhdGVkOiBudWxsXG4gIH0pO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICBpc0ZvcndhcmQ6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAhc2VsZi5pc1JldmVyc2U7XG4gICAgICB9LFxuICAgICAgc2V0OiBmdW5jdGlvbih2KSB7XG4gICAgICAgIHNlbGYuaXNSZXZlcnNlID0gIXY7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH1cbiAgfSk7XG5cbiAgdXRpbC5leHRlbmRGcm9tT3B0cyh0aGlzLCBvcHRzLCB7XG4gICAgcmV2ZXJzZU1vZGVsOiBudWxsLFxuICAgIGZvcndhcmRNb2RlbDogbnVsbCxcbiAgICBmb3J3YXJkTmFtZTogbnVsbCxcbiAgICByZXZlcnNlTmFtZTogbnVsbCxcbiAgICBpc1JldmVyc2U6IG51bGwsXG4gICAgc2VyaWFsaXNlOiBudWxsXG4gIH0sIGZhbHNlKTtcblxuICB0aGlzLmNhbmNlbExpc3RlbnMgPSB7fTtcbn1cblxudXRpbC5leHRlbmQoUmVsYXRpb25zaGlwUHJveHksIHt9KTtcblxudXRpbC5leHRlbmQoUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlLCB7XG4gIC8qKlxuICAgKiBJbnN0YWxsIHRoaXMgcHJveHkgb24gdGhlIGdpdmVuIGluc3RhbmNlXG4gICAqIEBwYXJhbSB7TW9kZWxJbnN0YW5jZX0gbW9kZWxJbnN0YW5jZVxuICAgKi9cbiAgaW5zdGFsbDogZnVuY3Rpb24obW9kZWxJbnN0YW5jZSkge1xuICAgIGlmIChtb2RlbEluc3RhbmNlKSB7XG4gICAgICBpZiAoIXRoaXMub2JqZWN0KSB7XG4gICAgICAgIHRoaXMub2JqZWN0ID0gbW9kZWxJbnN0YW5jZTtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB2YXIgbmFtZSA9IHRoaXMuZ2V0Rm9yd2FyZE5hbWUoKTtcblxuICAgICAgICAvLyBJZiBpdCdzIGEgc3ViY2xhc3MsIGEgcHJveHkgd2lsbCBhbHJlYWR5IGV4aXN0LiBUaGVyZWZvcmUgbm8gbmVlZCB0byBpbnN0YWxsLlxuICAgICAgICBpZiAoIW1vZGVsSW5zdGFuY2UuX19wcm94aWVzW25hbWVdKSB7XG4gICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG1vZGVsSW5zdGFuY2UsIG5hbWUsIHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIHJldHVybiBzZWxmLnJlbGF0ZWQ7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2V0OiBmdW5jdGlvbih2KSB7XG4gICAgICAgICAgICAgIHNlbGYuc2V0KHYpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIG1vZGVsSW5zdGFuY2UuX19wcm94aWVzW25hbWVdID0gdGhpcztcbiAgICAgICAgICBtb2RlbEluc3RhbmNlLl9wcm94aWVzLnB1c2godGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ0FscmVhZHkgaW5zdGFsbGVkLicpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gb2JqZWN0IHBhc3NlZCB0byByZWxhdGlvbnNoaXAgaW5zdGFsbCcpO1xuICAgIH1cbiAgfVxuXG59KTtcblxuLy9ub2luc3BlY3Rpb24gSlNVbnVzZWRMb2NhbFN5bWJvbHNcbnV0aWwuZXh0ZW5kKFJlbGF0aW9uc2hpcFByb3h5LnByb3RvdHlwZSwge1xuICBzZXQ6IGZ1bmN0aW9uKG9iaiwgb3B0cykge1xuICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHN1YmNsYXNzIFJlbGF0aW9uc2hpcFByb3h5Jyk7XG4gIH0sXG4gIGdldDogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBzdWJjbGFzcyBSZWxhdGlvbnNoaXBQcm94eScpO1xuICB9XG59KTtcblxudXRpbC5leHRlbmQoUmVsYXRpb25zaGlwUHJveHkucHJvdG90eXBlLCB7XG4gIHByb3h5Rm9ySW5zdGFuY2U6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UsIHJldmVyc2UpIHtcbiAgICB2YXIgbmFtZSA9IHJldmVyc2UgPyB0aGlzLmdldFJldmVyc2VOYW1lKCkgOiB0aGlzLmdldEZvcndhcmROYW1lKCksXG4gICAgICBtb2RlbCA9IHJldmVyc2UgPyB0aGlzLnJldmVyc2VNb2RlbCA6IHRoaXMuZm9yd2FyZE1vZGVsO1xuICAgIHZhciByZXQ7XG4gICAgLy8gVGhpcyBzaG91bGQgbmV2ZXIgaGFwcGVuLiBTaG91bGQgZyAgIGV0IGNhdWdodCBpbiB0aGUgbWFwcGluZyBvcGVyYXRpb24/XG4gICAgaWYgKHV0aWwuaXNBcnJheShtb2RlbEluc3RhbmNlKSkge1xuICAgICAgcmV0ID0gbW9kZWxJbnN0YW5jZS5tYXAoZnVuY3Rpb24obykge1xuICAgICAgICByZXR1cm4gby5fX3Byb3hpZXNbbmFtZV07XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIHByb3hpZXMgPSBtb2RlbEluc3RhbmNlLl9fcHJveGllcztcbiAgICAgIHZhciBwcm94eSA9IHByb3hpZXNbbmFtZV07XG4gICAgICBpZiAoIXByb3h5KSB7XG4gICAgICAgIHZhciBlcnIgPSAnTm8gcHJveHkgd2l0aCBuYW1lIFwiJyArIG5hbWUgKyAnXCIgb24gbWFwcGluZyAnICsgbW9kZWwubmFtZTtcbiAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoZXJyKTtcbiAgICAgIH1cbiAgICAgIHJldCA9IHByb3h5O1xuICAgIH1cbiAgICByZXR1cm4gcmV0O1xuICB9LFxuICByZXZlcnNlUHJveHlGb3JJbnN0YW5jZTogZnVuY3Rpb24obW9kZWxJbnN0YW5jZSkge1xuICAgIHJldHVybiB0aGlzLnByb3h5Rm9ySW5zdGFuY2UobW9kZWxJbnN0YW5jZSwgdHJ1ZSk7XG4gIH0sXG4gIGdldFJldmVyc2VOYW1lOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5pc0ZvcndhcmQgPyB0aGlzLnJldmVyc2VOYW1lIDogdGhpcy5mb3J3YXJkTmFtZTtcbiAgfSxcbiAgZ2V0Rm9yd2FyZE5hbWU6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmlzRm9yd2FyZCA/IHRoaXMuZm9yd2FyZE5hbWUgOiB0aGlzLnJldmVyc2VOYW1lO1xuICB9LFxuICBnZXRGb3J3YXJkTW9kZWw6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmlzRm9yd2FyZCA/IHRoaXMuZm9yd2FyZE1vZGVsIDogdGhpcy5yZXZlcnNlTW9kZWw7XG4gIH0sXG4gIC8qKlxuICAgKiBDb25maWd1cmUgX2lkIGFuZCByZWxhdGVkIHdpdGggdGhlIG5ldyByZWxhdGVkIG9iamVjdC5cbiAgICogQHBhcmFtIG9ialxuICAgKiBAcGFyYW0ge29iamVjdH0gW29wdHNdXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdHMuZGlzYWJsZU5vdGlmaWNhdGlvbnNdXG4gICAqIEByZXR1cm5zIHtTdHJpbmd8dW5kZWZpbmVkfSAtIEVycm9yIG1lc3NhZ2Ugb3IgdW5kZWZpbmVkXG4gICAqL1xuICBzZXRJZEFuZFJlbGF0ZWQ6IGZ1bmN0aW9uKG9iaiwgb3B0cykge1xuICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgIGlmICghb3B0cy5kaXNhYmxlZXZlbnRzKSB2YXIgb2xkVmFsdWUgPSB0aGlzLl9nZXRPbGRWYWx1ZUZvclNldENoYW5nZUV2ZW50KCk7XG4gICAgaWYgKG9iaikge1xuICAgICAgaWYgKHV0aWwuaXNBcnJheShvYmopKSB7XG4gICAgICAgIHRoaXMucmVsYXRlZCA9IG9iajtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMucmVsYXRlZCA9IG9iajtcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICB0aGlzLnJlbGF0ZWQgPSBudWxsO1xuICAgIH1cbiAgICBpZiAoIW9wdHMuZGlzYWJsZWV2ZW50cykgdGhpcy5yZWdpc3RlclNldENoYW5nZShvYmosIG9sZFZhbHVlKTtcbiAgfSxcbiAgY2hlY2tJbnN0YWxsZWQ6IGZ1bmN0aW9uKCkge1xuICAgIGlmICghdGhpcy5vYmplY3QpIHtcbiAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdQcm94eSBtdXN0IGJlIGluc3RhbGxlZCBvbiBhbiBvYmplY3QgYmVmb3JlIGNhbiB1c2UgaXQuJyk7XG4gICAgfVxuICB9LFxuICBzcGxpY2VyOiBmdW5jdGlvbihvcHRzKSB7XG4gICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgcmV0dXJuIGZ1bmN0aW9uKGlkeCwgbnVtUmVtb3ZlKSB7XG4gICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgIGlmICghb3B0cy5kaXNhYmxlZXZlbnRzKSB7XG4gICAgICAgIHZhciBhZGRlZCA9IHRoaXMuX2dldEFkZGVkRm9yU3BsaWNlQ2hhbmdlRXZlbnQoYXJndW1lbnRzKSxcbiAgICAgICAgICByZW1vdmVkID0gdGhpcy5fZ2V0UmVtb3ZlZEZvclNwbGljZUNoYW5nZUV2ZW50KGlkeCwgbnVtUmVtb3ZlKTtcbiAgICAgIH1cbiAgICAgIHZhciBhZGQgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgICAgdmFyIHJlcyA9IHRoaXMucmVsYXRlZC5zcGxpY2UuYmluZCh0aGlzLnJlbGF0ZWQsIGlkeCwgbnVtUmVtb3ZlKS5hcHBseSh0aGlzLnJlbGF0ZWQsIGFkZCk7XG4gICAgICBpZiAoIW9wdHMuZGlzYWJsZWV2ZW50cykgdGhpcy5yZWdpc3RlclNwbGljZUNoYW5nZShpZHgsIGFkZGVkLCByZW1vdmVkKTtcbiAgICAgIHJldHVybiByZXM7XG4gICAgfS5iaW5kKHRoaXMpO1xuICB9LFxuICBjbGVhclJldmVyc2VSZWxhdGVkOiBmdW5jdGlvbihvcHRzKSB7XG4gICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICh0aGlzLnJlbGF0ZWQpIHtcbiAgICAgIHZhciByZXZlcnNlUHJveHkgPSB0aGlzLnJldmVyc2VQcm94eUZvckluc3RhbmNlKHRoaXMucmVsYXRlZCk7XG4gICAgICB2YXIgcmV2ZXJzZVByb3hpZXMgPSB1dGlsLmlzQXJyYXkocmV2ZXJzZVByb3h5KSA/IHJldmVyc2VQcm94eSA6IFtyZXZlcnNlUHJveHldO1xuICAgICAgcmV2ZXJzZVByb3hpZXMuZm9yRWFjaChmdW5jdGlvbihwKSB7XG4gICAgICAgIGlmICh1dGlsLmlzQXJyYXkocC5yZWxhdGVkKSkge1xuICAgICAgICAgIHZhciBpZHggPSBwLnJlbGF0ZWQuaW5kZXhPZihzZWxmLm9iamVjdCk7XG4gICAgICAgICAgcC5tYWtlQ2hhbmdlc1RvUmVsYXRlZFdpdGhvdXRPYnNlcnZhdGlvbnMoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBwLnNwbGljZXIob3B0cykoaWR4LCAxKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwLnNldElkQW5kUmVsYXRlZChudWxsLCBvcHRzKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9LFxuICBzZXRJZEFuZFJlbGF0ZWRSZXZlcnNlOiBmdW5jdGlvbihvYmosIG9wdHMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHJldmVyc2VQcm94eSA9IHRoaXMucmV2ZXJzZVByb3h5Rm9ySW5zdGFuY2Uob2JqKTtcbiAgICB2YXIgcmV2ZXJzZVByb3hpZXMgPSB1dGlsLmlzQXJyYXkocmV2ZXJzZVByb3h5KSA/IHJldmVyc2VQcm94eSA6IFtyZXZlcnNlUHJveHldO1xuICAgIHJldmVyc2VQcm94aWVzLmZvckVhY2goZnVuY3Rpb24ocCkge1xuICAgICAgaWYgKHV0aWwuaXNBcnJheShwLnJlbGF0ZWQpKSB7XG4gICAgICAgIHAubWFrZUNoYW5nZXNUb1JlbGF0ZWRXaXRob3V0T2JzZXJ2YXRpb25zKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHAuc3BsaWNlcihvcHRzKShwLnJlbGF0ZWQubGVuZ3RoLCAwLCBzZWxmLm9iamVjdCk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcC5jbGVhclJldmVyc2VSZWxhdGVkKG9wdHMpO1xuICAgICAgICBwLnNldElkQW5kUmVsYXRlZChzZWxmLm9iamVjdCwgb3B0cyk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG4gIG1ha2VDaGFuZ2VzVG9SZWxhdGVkV2l0aG91dE9ic2VydmF0aW9uczogZnVuY3Rpb24oZikge1xuICAgIGlmICh0aGlzLnJlbGF0ZWQpIHtcbiAgICAgIHRoaXMucmVsYXRlZC5hcnJheU9ic2VydmVyLmNsb3NlKCk7XG4gICAgICB0aGlzLnJlbGF0ZWQuYXJyYXlPYnNlcnZlciA9IG51bGw7XG4gICAgICBmKCk7XG4gICAgICB0aGlzLndyYXBBcnJheSh0aGlzLnJlbGF0ZWQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBmKCk7XG4gICAgfVxuICB9LFxuICAvKipcbiAgICogR2V0IG9sZCB2YWx1ZSB0aGF0IGlzIHNlbnQgb3V0IGluIGVtaXNzaW9ucy5cbiAgICogQHJldHVybnMgeyp9XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfZ2V0T2xkVmFsdWVGb3JTZXRDaGFuZ2VFdmVudDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIG9sZFZhbHVlID0gdGhpcy5yZWxhdGVkO1xuICAgIGlmICh1dGlsLmlzQXJyYXkob2xkVmFsdWUpICYmICFvbGRWYWx1ZS5sZW5ndGgpIHtcbiAgICAgIG9sZFZhbHVlID0gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIG9sZFZhbHVlO2dcbiAgfSxcbiAgcmVnaXN0ZXJTZXRDaGFuZ2U6IGZ1bmN0aW9uKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgIHZhciBwcm94eU9iamVjdCA9IHRoaXMub2JqZWN0O1xuICAgIGlmICghcHJveHlPYmplY3QpIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdQcm94eSBtdXN0IGhhdmUgYW4gb2JqZWN0IGFzc29jaWF0ZWQnKTtcbiAgICB2YXIgbW9kZWwgPSBwcm94eU9iamVjdC5tb2RlbDtcbiAgICB2YXIgbW9kZWxOYW1lID0gbW9kZWwubmFtZTtcbiAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBwcm94eU9iamVjdC5jb2xsZWN0aW9uTmFtZTtcbiAgICAvLyBXZSB0YWtlIFtdID09IG51bGwgPT0gdW5kZWZpbmVkIGluIHRoZSBjYXNlIG9mIHJlbGF0aW9uc2hpcHMuXG4gICAgbW9kZWwuYXBwLmJyb2FkY2FzdCh7XG4gICAgICBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uTmFtZSxcbiAgICAgIG1vZGVsOiBtb2RlbE5hbWUsXG4gICAgICBsb2NhbElkOiBwcm94eU9iamVjdC5sb2NhbElkLFxuICAgICAgZmllbGQ6IHRoaXMuZ2V0Rm9yd2FyZE5hbWUoKSxcbiAgICAgIG9sZDogb2xkVmFsdWUsXG4gICAgICBuZXc6IG5ld1ZhbHVlLFxuICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU2V0LFxuICAgICAgb2JqOiBwcm94eU9iamVjdFxuICAgIH0pO1xuICB9LFxuXG4gIF9nZXRSZW1vdmVkRm9yU3BsaWNlQ2hhbmdlRXZlbnQ6IGZ1bmN0aW9uKGlkeCwgbnVtUmVtb3ZlKSB7XG4gICAgcmV0dXJuIHRoaXMucmVsYXRlZCA/IHRoaXMucmVsYXRlZC5zbGljZShpZHgsIGlkeCArIG51bVJlbW92ZSkgOiBudWxsO1xuICB9LFxuXG4gIF9nZXRBZGRlZEZvclNwbGljZUNoYW5nZUV2ZW50OiBmdW5jdGlvbihhcmdzKSB7XG4gICAgdmFyIGFkZCA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3MsIDIpO1xuICAgIHJldHVybiBhZGQubGVuZ3RoID8gYWRkIDogW107XG4gIH0sXG5cbiAgcmVnaXN0ZXJTcGxpY2VDaGFuZ2U6IGZ1bmN0aW9uKGlkeCwgYWRkZWQsIHJlbW92ZWQpIHtcbiAgICB2YXIgbW9kZWwgPSB0aGlzLm9iamVjdC5tb2RlbCxcbiAgICAgIG1vZGVsTmFtZSA9IG1vZGVsLm5hbWUsXG4gICAgICBjb2xsID0gdGhpcy5vYmplY3QuY29sbGVjdGlvbk5hbWU7XG4gICAgbW9kZWwuYXBwLmJyb2FkY2FzdCh7XG4gICAgICBjb2xsZWN0aW9uOiBjb2xsLFxuICAgICAgbW9kZWw6IG1vZGVsTmFtZSxcbiAgICAgIGxvY2FsSWQ6IHRoaXMub2JqZWN0LmxvY2FsSWQsXG4gICAgICBmaWVsZDogdGhpcy5nZXRGb3J3YXJkTmFtZSgpLFxuICAgICAgaW5kZXg6IGlkeCxcbiAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICBhZGRlZDogYWRkZWQsXG4gICAgICB0eXBlOiBNb2RlbEV2ZW50VHlwZS5TcGxpY2UsXG4gICAgICBvYmo6IHRoaXMub2JqZWN0XG4gICAgfSk7XG4gIH0sXG4gIHdyYXBBcnJheTogZnVuY3Rpb24oYXJyKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHdyYXBBcnJheUZvckF0dHJpYnV0ZXMoYXJyLCB0aGlzLnJldmVyc2VOYW1lLCB0aGlzLm9iamVjdCk7XG4gICAgaWYgKCFhcnIuYXJyYXlPYnNlcnZlcikge1xuICAgICAgYXJyLmFycmF5T2JzZXJ2ZXIgPSBuZXcgQXJyYXlPYnNlcnZlcihhcnIpO1xuICAgICAgdmFyIG9ic2VydmVyRnVuY3Rpb24gPSBmdW5jdGlvbihzcGxpY2VzKSB7XG4gICAgICAgIHNwbGljZXMuZm9yRWFjaChmdW5jdGlvbihzcGxpY2UpIHtcbiAgICAgICAgICB2YXIgYWRkZWQgPSBzcGxpY2UuYWRkZWRDb3VudCA/IGFyci5zbGljZShzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50KSA6IFtdO1xuICAgICAgICAgIHZhciBtb2RlbCA9IHNlbGYuZ2V0Rm9yd2FyZE1vZGVsKCk7XG4gICAgICAgICAgbW9kZWwuYXBwLmJyb2FkY2FzdCh7XG4gICAgICAgICAgICBjb2xsZWN0aW9uOiBtb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgIG1vZGVsOiBtb2RlbC5uYW1lLFxuICAgICAgICAgICAgbG9jYWxJZDogc2VsZi5vYmplY3QubG9jYWxJZCxcbiAgICAgICAgICAgIGZpZWxkOiBzZWxmLmdldEZvcndhcmROYW1lKCksXG4gICAgICAgICAgICByZW1vdmVkOiBzcGxpY2UucmVtb3ZlZCxcbiAgICAgICAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgIG9iajogc2VsZi5vYmplY3RcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgICAgYXJyLmFycmF5T2JzZXJ2ZXIub3BlbihvYnNlcnZlckZ1bmN0aW9uKTtcbiAgICB9XG4gIH0sXG4gIHNwbGljZTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5zcGxpY2VyKHt9KS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICB9XG5cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJlbGF0aW9uc2hpcFByb3h5O1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvUmVsYXRpb25zaGlwUHJveHkuanNcbiAqKiBtb2R1bGUgaWQgPSAxMlxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIEludGVybmFsU2llc3RhRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJykuSW50ZXJuYWxTaWVzdGFFcnJvcixcbiAgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSgnZXZlbnRzJyksXG4gIEFycmF5T2JzZXJ2ZXIgPSByZXF1aXJlKCcuLi92ZW5kb3Ivb2JzZXJ2ZS1qcy9zcmMvb2JzZXJ2ZScpLkFycmF5T2JzZXJ2ZXIsXG4gIGV4dGVuZCA9IHJlcXVpcmUoJy4vdXRpbCcpLmV4dGVuZDtcblxuLyoqXG4gKiBDb25zdGFudHMgdGhhdCBkZXNjcmliZSBjaGFuZ2UgZXZlbnRzLlxuICogU2V0ID0+IEEgbmV3IHZhbHVlIGlzIGFzc2lnbmVkIHRvIGFuIGF0dHJpYnV0ZS9yZWxhdGlvbnNoaXBcbiAqIFNwbGljZSA9PiBBbGwgamF2YXNjcmlwdCBhcnJheSBvcGVyYXRpb25zIGFyZSBkZXNjcmliZWQgYXMgc3BsaWNlcy5cbiAqIERlbGV0ZSA9PiBVc2VkIGluIHRoZSBjYXNlIHdoZXJlIG9iamVjdHMgYXJlIHJlbW92ZWQgZnJvbSBhbiBhcnJheSwgYnV0IGFycmF5IG9yZGVyIGlzIG5vdCBrbm93biBpbiBhZHZhbmNlLlxuICogUmVtb3ZlID0+IE9iamVjdCBkZWxldGlvbiBldmVudHNcbiAqIE5ldyA9PiBPYmplY3QgY3JlYXRpb24gZXZlbnRzXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG52YXIgTW9kZWxFdmVudFR5cGUgPSB7XG4gIFNldDogJ3NldCcsXG4gIFNwbGljZTogJ3NwbGljZScsXG4gIE5ldzogJ25ldycsXG4gIFJlbW92ZTogJ3JlbW92ZSdcbn07XG5cbi8qKlxuICogUmVwcmVzZW50cyBhbiBpbmRpdmlkdWFsIGNoYW5nZS5cbiAqIEBwYXJhbSBvcHRzXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gTW9kZWxFdmVudChvcHRzKSB7XG4gIHRoaXMuX29wdHMgPSBvcHRzIHx8IHt9O1xuICBPYmplY3Qua2V5cyhvcHRzKS5mb3JFYWNoKGZ1bmN0aW9uKGspIHtcbiAgICB0aGlzW2tdID0gb3B0c1trXTtcbiAgfS5iaW5kKHRoaXMpKTtcbn1cblxuTW9kZWxFdmVudC5wcm90b3R5cGUuX2R1bXAgPSBmdW5jdGlvbihwcmV0dHkpIHtcbiAgdmFyIGR1bXBlZCA9IHt9O1xuICBkdW1wZWQuY29sbGVjdGlvbiA9ICh0eXBlb2YgdGhpcy5jb2xsZWN0aW9uKSA9PSAnc3RyaW5nJyA/IHRoaXMuY29sbGVjdGlvbiA6IHRoaXMuY29sbGVjdGlvbi5fZHVtcCgpO1xuICBkdW1wZWQubW9kZWwgPSAodHlwZW9mIHRoaXMubW9kZWwpID09ICdzdHJpbmcnID8gdGhpcy5tb2RlbCA6IHRoaXMubW9kZWwubmFtZTtcbiAgZHVtcGVkLmxvY2FsSWQgPSB0aGlzLmxvY2FsSWQ7XG4gIGR1bXBlZC5maWVsZCA9IHRoaXMuZmllbGQ7XG4gIGR1bXBlZC50eXBlID0gdGhpcy50eXBlO1xuICBpZiAodGhpcy5pbmRleCkgZHVtcGVkLmluZGV4ID0gdGhpcy5pbmRleDtcbiAgaWYgKHRoaXMuYWRkZWQpIGR1bXBlZC5hZGRlZCA9IHRoaXMuYWRkZWQubWFwKGZ1bmN0aW9uKHgpIHtyZXR1cm4geC5fZHVtcCgpfSk7XG4gIGlmICh0aGlzLnJlbW92ZWQpIGR1bXBlZC5yZW1vdmVkID0gdGhpcy5yZW1vdmVkLm1hcChmdW5jdGlvbih4KSB7cmV0dXJuIHguX2R1bXAoKX0pO1xuICBpZiAodGhpcy5vbGQpIGR1bXBlZC5vbGQgPSB0aGlzLm9sZDtcbiAgaWYgKHRoaXMubmV3KSBkdW1wZWQubmV3ID0gdGhpcy5uZXc7XG4gIHJldHVybiBwcmV0dHkgPyB1dGlsLnByZXR0eVByaW50KGR1bXBlZCkgOiBkdW1wZWQ7XG59O1xuXG5mdW5jdGlvbiBicm9hZGNhc3RFdmVudChhcHAsIGNvbGxlY3Rpb25OYW1lLCBtb2RlbE5hbWUsIG9wdHMpIHtcbiAgdmFyIGdlbmVyaWNFdmVudCA9ICdTaWVzdGEnLFxuICAgIGNvbGxlY3Rpb24gPSBhcHAuY29sbGVjdGlvblJlZ2lzdHJ5W2NvbGxlY3Rpb25OYW1lXSxcbiAgICBtb2RlbCA9IGNvbGxlY3Rpb25bbW9kZWxOYW1lXTtcbiAgaWYgKCFjb2xsZWN0aW9uKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gc3VjaCBjb2xsZWN0aW9uIFwiJyArIGNvbGxlY3Rpb25OYW1lICsgJ1wiJyk7XG4gIGlmICghbW9kZWwpIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdObyBzdWNoIG1vZGVsIFwiJyArIG1vZGVsTmFtZSArICdcIicpO1xuICB2YXIgc2hvdWxkRW1pdCA9IG9wdHMub2JqLl9lbWl0RXZlbnRzO1xuICAvLyBEb24ndCBlbWl0IHBvaW50bGVzcyBldmVudHMuXG4gIGlmIChzaG91bGRFbWl0ICYmICduZXcnIGluIG9wdHMgJiYgJ29sZCcgaW4gb3B0cykge1xuICAgIGlmIChvcHRzLm5ldyBpbnN0YW5jZW9mIERhdGUgJiYgb3B0cy5vbGQgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICBzaG91bGRFbWl0ID0gb3B0cy5uZXcuZ2V0VGltZSgpICE9IG9wdHMub2xkLmdldFRpbWUoKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBzaG91bGRFbWl0ID0gb3B0cy5uZXcgIT0gb3B0cy5vbGQ7XG4gICAgfVxuICB9XG4gIGlmIChzaG91bGRFbWl0KSB7XG4gICAgYXBwLmV2ZW50cy5lbWl0KGdlbmVyaWNFdmVudCwgb3B0cyk7XG4gICAgdmFyIG1vZGVsRXZlbnQgPSBjb2xsZWN0aW9uTmFtZSArICc6JyArIG1vZGVsTmFtZSxcbiAgICAgIGxvY2FsSWRFdmVudCA9IG9wdHMubG9jYWxJZDtcbiAgICBhcHAuZXZlbnRzLmVtaXQoY29sbGVjdGlvbk5hbWUsIG9wdHMpO1xuICAgIGFwcC5ldmVudHMuZW1pdChtb2RlbEV2ZW50LCBvcHRzKTtcbiAgICBhcHAuZXZlbnRzLmVtaXQobG9jYWxJZEV2ZW50LCBvcHRzKTtcbiAgICBpZiAobW9kZWwuaWQgJiYgb3B0cy5vYmpbbW9kZWwuaWRdKSBhcHAuZXZlbnRzLmVtaXQoY29sbGVjdGlvbk5hbWUgKyAnOicgKyBtb2RlbE5hbWUgKyAnOicgKyBvcHRzLm9ialttb2RlbC5pZF0sIG9wdHMpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHZhbGlkYXRlRXZlbnRPcHRzKG9wdHMpIHtcbiAgaWYgKCFvcHRzLm1vZGVsKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBwYXNzIGEgbW9kZWwnKTtcbiAgaWYgKCFvcHRzLmNvbGxlY3Rpb24pIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNdXN0IHBhc3MgYSBjb2xsZWN0aW9uJyk7XG4gIGlmICghb3B0cy5sb2NhbElkKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBwYXNzIGEgbG9jYWwgaWRlbnRpZmllcicpO1xuICBpZiAoIW9wdHMub2JqKSB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTXVzdCBwYXNzIHRoZSBvYmplY3QnKTtcbn1cblxuZnVuY3Rpb24gZW1pdChhcHAsIG9wdHMpIHtcbiAgdmFsaWRhdGVFdmVudE9wdHMob3B0cyk7XG4gIHZhciBjb2xsZWN0aW9uID0gb3B0cy5jb2xsZWN0aW9uO1xuICB2YXIgbW9kZWwgPSBvcHRzLm1vZGVsO1xuICB2YXIgYyA9IG5ldyBNb2RlbEV2ZW50KG9wdHMpO1xuICBicm9hZGNhc3RFdmVudChhcHAsIGNvbGxlY3Rpb24sIG1vZGVsLCBjKTtcbiAgcmV0dXJuIGM7XG59XG5cbmV4dGVuZChleHBvcnRzLCB7XG4gIE1vZGVsRXZlbnQ6IE1vZGVsRXZlbnQsXG4gIGVtaXQ6IGVtaXQsXG4gIHZhbGlkYXRlRXZlbnRPcHRzOiB2YWxpZGF0ZUV2ZW50T3B0cyxcbiAgTW9kZWxFdmVudFR5cGU6IE1vZGVsRXZlbnRUeXBlLFxuICB3cmFwQXJyYXk6IGZ1bmN0aW9uKGFycmF5LCBmaWVsZCwgbW9kZWxJbnN0YW5jZSkge1xuICAgIGlmICghYXJyYXkub2JzZXJ2ZXIpIHtcbiAgICAgIGFycmF5Lm9ic2VydmVyID0gbmV3IEFycmF5T2JzZXJ2ZXIoYXJyYXkpO1xuICAgICAgYXJyYXkub2JzZXJ2ZXIub3BlbihmdW5jdGlvbihzcGxpY2VzKSB7XG4gICAgICAgIHZhciBmaWVsZElzQXR0cmlidXRlID0gbW9kZWxJbnN0YW5jZS5fYXR0cmlidXRlTmFtZXMuaW5kZXhPZihmaWVsZCkgPiAtMTtcbiAgICAgICAgaWYgKGZpZWxkSXNBdHRyaWJ1dGUpIHtcbiAgICAgICAgICBzcGxpY2VzLmZvckVhY2goZnVuY3Rpb24oc3BsaWNlKSB7XG4gICAgICAgICAgICBlbWl0KG1vZGVsSW5zdGFuY2UuYXBwLCB7XG4gICAgICAgICAgICAgIGNvbGxlY3Rpb246IG1vZGVsSW5zdGFuY2UuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgIG1vZGVsOiBtb2RlbEluc3RhbmNlLm1vZGVsLm5hbWUsXG4gICAgICAgICAgICAgIGxvY2FsSWQ6IG1vZGVsSW5zdGFuY2UubG9jYWxJZCxcbiAgICAgICAgICAgICAgaW5kZXg6IHNwbGljZS5pbmRleCxcbiAgICAgICAgICAgICAgcmVtb3ZlZDogc3BsaWNlLnJlbW92ZWQsXG4gICAgICAgICAgICAgIGFkZGVkOiBzcGxpY2UuYWRkZWRDb3VudCA/IGFycmF5LnNsaWNlKHNwbGljZS5pbmRleCwgc3BsaWNlLmluZGV4ICsgc3BsaWNlLmFkZGVkQ291bnQpIDogW10sXG4gICAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNwbGljZSxcbiAgICAgICAgICAgICAgZmllbGQ6IGZpZWxkLFxuICAgICAgICAgICAgICBvYmo6IG1vZGVsSW5zdGFuY2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn0pO1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvbW9kZWxFdmVudHMuanNcbiAqKiBtb2R1bGUgaWQgPSAxM1xuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJykoJ3F1ZXJ5JyksXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgZXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJyksXG4gIE1vZGVsSW5zdGFuY2UgPSByZXF1aXJlKCcuL01vZGVsSW5zdGFuY2UnKSxcbiAgY29uc3RydWN0UXVlcnlTZXQgPSByZXF1aXJlKCcuL1F1ZXJ5U2V0Jyk7XG5cbi8qKlxuICogQGNsYXNzIFtRdWVyeSBkZXNjcmlwdGlvbl1cbiAqIEBwYXJhbSB7TW9kZWx9IG1vZGVsXG4gKiBAcGFyYW0ge09iamVjdH0gcXVlcnlcbiAqL1xuZnVuY3Rpb24gUXVlcnkobW9kZWwsIHF1ZXJ5KSB7XG4gIHZhciBvcHRzID0ge307XG4gIGZvciAodmFyIHByb3AgaW4gcXVlcnkpIHtcbiAgICBpZiAocXVlcnkuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgIGlmIChwcm9wLnNsaWNlKDAsIDIpID09ICdfXycpIHtcbiAgICAgICAgb3B0c1twcm9wLnNsaWNlKDIpXSA9IHF1ZXJ5W3Byb3BdO1xuICAgICAgICBkZWxldGUgcXVlcnlbcHJvcF07XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHV0aWwuZXh0ZW5kKHRoaXMsIHtcbiAgICBtb2RlbDogbW9kZWwsXG4gICAgcXVlcnk6IHF1ZXJ5LFxuICAgIG9wdHM6IG9wdHNcbiAgfSk7XG4gIG9wdHMub3JkZXIgPSBvcHRzLm9yZGVyIHx8IFtdO1xuICBpZiAoIXV0aWwuaXNBcnJheShvcHRzLm9yZGVyKSkgb3B0cy5vcmRlciA9IFtvcHRzLm9yZGVyXTtcbn1cblxuZnVuY3Rpb24gdmFsdWVBc1N0cmluZyhmaWVsZFZhbHVlKSB7XG4gIHZhciBmaWVsZEFzU3RyaW5nO1xuICBpZiAoZmllbGRWYWx1ZSA9PT0gbnVsbCkgZmllbGRBc1N0cmluZyA9ICdudWxsJztcbiAgZWxzZSBpZiAoZmllbGRWYWx1ZSA9PT0gdW5kZWZpbmVkKSBmaWVsZEFzU3RyaW5nID0gJ3VuZGVmaW5lZCc7XG4gIGVsc2UgaWYgKGZpZWxkVmFsdWUgaW5zdGFuY2VvZiBNb2RlbEluc3RhbmNlKSBmaWVsZEFzU3RyaW5nID0gZmllbGRWYWx1ZS5sb2NhbElkO1xuICBlbHNlIGZpZWxkQXNTdHJpbmcgPSBmaWVsZFZhbHVlLnRvU3RyaW5nKCk7XG4gIHJldHVybiBmaWVsZEFzU3RyaW5nO1xufVxuXG5mdW5jdGlvbiBjb250YWlucyhvcHRzKSB7XG4gIGlmICghb3B0cy5pbnZhbGlkKSB7XG4gICAgdmFyIG9iaiA9IG9wdHMub2JqZWN0O1xuICAgIGlmICh1dGlsLmlzQXJyYXkob2JqKSkge1xuICAgICAgYXJyID0gdXRpbC5wbHVjayhvYmosIG9wdHMuZmllbGQpO1xuICAgIH1cbiAgICBlbHNlXG4gICAgICB2YXIgYXJyID0gb2JqW29wdHMuZmllbGRdO1xuICAgIGlmICh1dGlsLmlzQXJyYXkoYXJyKSB8fCB1dGlsLmlzU3RyaW5nKGFycikpIHtcbiAgICAgIHJldHVybiBhcnIuaW5kZXhPZihvcHRzLnZhbHVlKSA+IC0xO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbnZhciBjb21wYXJhdG9ycyA9IHtcbiAgZTogZnVuY3Rpb24ob3B0cykge1xuICAgIHZhciBmaWVsZFZhbHVlID0gb3B0cy5vYmplY3Rbb3B0cy5maWVsZF07XG4gICAgaWYgKGxvZy5lbmFibGVkKSB7XG4gICAgICBsb2cob3B0cy5maWVsZCArICc6ICcgKyB2YWx1ZUFzU3RyaW5nKGZpZWxkVmFsdWUpICsgJyA9PSAnICsgdmFsdWVBc1N0cmluZyhvcHRzLnZhbHVlKSwge29wdHM6IG9wdHN9KTtcbiAgICB9XG4gICAgcmV0dXJuIGZpZWxkVmFsdWUgPT0gb3B0cy52YWx1ZTtcbiAgfSxcbiAgbHQ6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICBpZiAoIW9wdHMuaW52YWxpZCkgcmV0dXJuIG9wdHMub2JqZWN0W29wdHMuZmllbGRdIDwgb3B0cy52YWx1ZTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0sXG4gIGd0OiBmdW5jdGlvbihvcHRzKSB7XG4gICAgaWYgKCFvcHRzLmludmFsaWQpIHJldHVybiBvcHRzLm9iamVjdFtvcHRzLmZpZWxkXSA+IG9wdHMudmFsdWU7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9LFxuICBsdGU6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICBpZiAoIW9wdHMuaW52YWxpZCkgcmV0dXJuIG9wdHMub2JqZWN0W29wdHMuZmllbGRdIDw9IG9wdHMudmFsdWU7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9LFxuICBndGU6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICBpZiAoIW9wdHMuaW52YWxpZCkgcmV0dXJuIG9wdHMub2JqZWN0W29wdHMuZmllbGRdID49IG9wdHMudmFsdWU7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9LFxuICBjb250YWluczogY29udGFpbnMsXG4gIGluOiBjb250YWluc1xufTtcblxudXRpbC5leHRlbmQoUXVlcnksIHtcbiAgY29tcGFyYXRvcnM6IGNvbXBhcmF0b3JzLFxuICByZWdpc3RlckNvbXBhcmF0b3I6IGZ1bmN0aW9uKHN5bWJvbCwgZm4pIHtcbiAgICBpZiAoIWNvbXBhcmF0b3JzW3N5bWJvbF0pIHtcbiAgICAgIGNvbXBhcmF0b3JzW3N5bWJvbF0gPSBmbjtcbiAgICB9XG4gIH1cbn0pO1xuXG5mdW5jdGlvbiBjYWNoZUZvck1vZGVsKG1vZGVsKSB7XG4gIHZhciBjYWNoZUJ5VHlwZSA9IG1vZGVsLmFwcC5jYWNoZS5fbG9jYWxDYWNoZUJ5VHlwZTtcbiAgdmFyIG1vZGVsTmFtZSA9IG1vZGVsLm5hbWU7XG4gIHZhciBjb2xsZWN0aW9uTmFtZSA9IG1vZGVsLmNvbGxlY3Rpb25OYW1lO1xuICB2YXIgY2FjaGVCeU1vZGVsID0gY2FjaGVCeVR5cGVbY29sbGVjdGlvbk5hbWVdO1xuICB2YXIgY2FjaGVCeUxvY2FsSWQ7XG4gIGlmIChjYWNoZUJ5TW9kZWwpIHtcbiAgICBjYWNoZUJ5TG9jYWxJZCA9IGNhY2hlQnlNb2RlbFttb2RlbE5hbWVdIHx8IHt9O1xuICB9XG4gIHJldHVybiBjYWNoZUJ5TG9jYWxJZDtcbn1cblxudXRpbC5leHRlbmQoUXVlcnkucHJvdG90eXBlLCB7XG4gIGV4ZWN1dGU6IGZ1bmN0aW9uKGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIHRoaXMuX2V4ZWN1dGVJbk1lbW9yeShjYik7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgX2R1bXA6IGZ1bmN0aW9uKGFzSnNvbikge1xuICAgIHJldHVybiBhc0pzb24gPyAne30nIDoge307XG4gIH0sXG4gIHNvcnRGdW5jOiBmdW5jdGlvbihmaWVsZHMpIHtcbiAgICB2YXIgc29ydEZ1bmMgPSBmdW5jdGlvbihhc2NlbmRpbmcsIGZpZWxkKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24odjEsIHYyKSB7XG4gICAgICAgIHZhciBkMSA9IHYxW2ZpZWxkXSxcbiAgICAgICAgICBkMiA9IHYyW2ZpZWxkXSxcbiAgICAgICAgICByZXM7XG4gICAgICAgIGlmICh0eXBlb2YgZDEgPT0gJ3N0cmluZycgfHwgZDEgaW5zdGFuY2VvZiBTdHJpbmcgJiZcbiAgICAgICAgICB0eXBlb2YgZDIgPT0gJ3N0cmluZycgfHwgZDIgaW5zdGFuY2VvZiBTdHJpbmcpIHtcbiAgICAgICAgICByZXMgPSBhc2NlbmRpbmcgPyBkMS5sb2NhbGVDb21wYXJlKGQyKSA6IGQyLmxvY2FsZUNvbXBhcmUoZDEpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGlmIChkMSBpbnN0YW5jZW9mIERhdGUpIGQxID0gZDEuZ2V0VGltZSgpO1xuICAgICAgICAgIGlmIChkMiBpbnN0YW5jZW9mIERhdGUpIGQyID0gZDIuZ2V0VGltZSgpO1xuICAgICAgICAgIGlmIChhc2NlbmRpbmcpIHJlcyA9IGQxIC0gZDI7XG4gICAgICAgICAgZWxzZSByZXMgPSBkMiAtIGQxO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXM7XG4gICAgICB9XG4gICAgfTtcbiAgICB2YXIgcyA9IHV0aWw7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBmaWVsZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBmaWVsZCA9IGZpZWxkc1tpXTtcbiAgICAgIHMgPSBzLnRoZW5CeShzb3J0RnVuYyhmaWVsZC5hc2NlbmRpbmcsIGZpZWxkLmZpZWxkKSk7XG4gICAgfVxuICAgIHJldHVybiBzID09IHV0aWwgPyBudWxsIDogcztcbiAgfSxcbiAgX3NvcnRSZXN1bHRzOiBmdW5jdGlvbihyZXMpIHtcbiAgICB2YXIgb3JkZXIgPSB0aGlzLm9wdHMub3JkZXI7XG4gICAgaWYgKHJlcyAmJiBvcmRlcikge1xuICAgICAgdmFyIGZpZWxkcyA9IG9yZGVyLm1hcChmdW5jdGlvbihvcmRlcmluZykge1xuICAgICAgICB2YXIgc3BsdCA9IG9yZGVyaW5nLnNwbGl0KCctJyksXG4gICAgICAgICAgYXNjZW5kaW5nID0gdHJ1ZSxcbiAgICAgICAgICBmaWVsZCA9IG51bGw7XG4gICAgICAgIGlmIChzcGx0Lmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICBmaWVsZCA9IHNwbHRbMV07XG4gICAgICAgICAgYXNjZW5kaW5nID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgZmllbGQgPSBzcGx0WzBdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7ZmllbGQ6IGZpZWxkLCBhc2NlbmRpbmc6IGFzY2VuZGluZ307XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgdmFyIHNvcnRGdW5jID0gdGhpcy5zb3J0RnVuYyhmaWVsZHMpO1xuICAgICAgaWYgKHJlcy5pbW11dGFibGUpIHJlcyA9IHJlcy5tdXRhYmxlQ29weSgpO1xuICAgICAgaWYgKHNvcnRGdW5jKSByZXMuc29ydChzb3J0RnVuYyk7XG4gICAgfVxuICAgIHJldHVybiByZXM7XG4gIH0sXG4gIC8qKlxuICAgKiBSZXR1cm4gYWxsIG1vZGVsIGluc3RhbmNlcyBpbiB0aGUgY2FjaGUuXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfZ2V0Q2FjaGVCeUxvY2FsSWQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmRlc2NlbmRhbnRzLnJlZHVjZShmdW5jdGlvbihtZW1vLCBjaGlsZE1vZGVsKSB7XG4gICAgICByZXR1cm4gdXRpbC5leHRlbmQobWVtbywgY2FjaGVGb3JNb2RlbChjaGlsZE1vZGVsKSk7XG4gICAgfSwgdXRpbC5leHRlbmQoe30sIGNhY2hlRm9yTW9kZWwodGhpcy5tb2RlbCkpKTtcbiAgfSxcbiAgX2V4ZWN1dGVJbk1lbW9yeTogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICB2YXIgY2FjaGVCeUxvY2FsSWQgPSB0aGlzLl9nZXRDYWNoZUJ5TG9jYWxJZCgpO1xuICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMoY2FjaGVCeUxvY2FsSWQpO1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgcmVzID0gW107XG4gICAgdmFyIGVycjtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBrID0ga2V5c1tpXTtcbiAgICAgIHZhciBvYmogPSBjYWNoZUJ5TG9jYWxJZFtrXTtcbiAgICAgIHZhciBtYXRjaGVzID0gc2VsZi5vYmplY3RNYXRjaGVzUXVlcnkob2JqKTtcbiAgICAgIGlmICh0eXBlb2YobWF0Y2hlcykgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgZXJyID0gZXJyb3IobWF0Y2hlcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKG1hdGNoZXMpIHJlcy5wdXNoKG9iaik7XG4gICAgICB9XG4gICAgfVxuICAgIHJlcyA9IHRoaXMuX3NvcnRSZXN1bHRzKHJlcyk7XG4gICAgaWYgKGVycikgbG9nKCdFcnJvciBleGVjdXRpbmcgcXVlcnknLCBlcnIpO1xuICAgIGNhbGxiYWNrKGVyciwgZXJyID8gbnVsbCA6IGNvbnN0cnVjdFF1ZXJ5U2V0KHJlcywgdGhpcy5tb2RlbCkpO1xuICB9LFxuICBjbGVhck9yZGVyaW5nOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLm9wdHMub3JkZXIgPSBudWxsO1xuICB9LFxuICBvYmplY3RNYXRjaGVzT3JRdWVyeTogZnVuY3Rpb24ob2JqLCBvclF1ZXJ5KSB7XG4gICAgZm9yICh2YXIgaWR4IGluIG9yUXVlcnkpIHtcbiAgICAgIGlmIChvclF1ZXJ5Lmhhc093blByb3BlcnR5KGlkeCkpIHtcbiAgICAgICAgdmFyIHF1ZXJ5ID0gb3JRdWVyeVtpZHhdO1xuICAgICAgICBpZiAodGhpcy5vYmplY3RNYXRjaGVzQmFzZVF1ZXJ5KG9iaiwgcXVlcnkpKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9LFxuICBvYmplY3RNYXRjaGVzQW5kUXVlcnk6IGZ1bmN0aW9uKG9iaiwgYW5kUXVlcnkpIHtcbiAgICBmb3IgKHZhciBpZHggaW4gYW5kUXVlcnkpIHtcbiAgICAgIGlmIChhbmRRdWVyeS5oYXNPd25Qcm9wZXJ0eShpZHgpKSB7XG4gICAgICAgIHZhciBxdWVyeSA9IGFuZFF1ZXJ5W2lkeF07XG4gICAgICAgIGlmICghdGhpcy5vYmplY3RNYXRjaGVzQmFzZVF1ZXJ5KG9iaiwgcXVlcnkpKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9LFxuICBzcGxpdE1hdGNoZXM6IGZ1bmN0aW9uKG9iaiwgdW5wcm9jZXNzZWRGaWVsZCwgdmFsdWUpIHtcbiAgICB2YXIgb3AgPSAnZSc7XG4gICAgdmFyIGZpZWxkcyA9IHVucHJvY2Vzc2VkRmllbGQuc3BsaXQoJy4nKTtcbiAgICB2YXIgc3BsdCA9IGZpZWxkc1tmaWVsZHMubGVuZ3RoIC0gMV0uc3BsaXQoJ19fJyk7XG4gICAgaWYgKHNwbHQubGVuZ3RoID09IDIpIHtcbiAgICAgIHZhciBmaWVsZCA9IHNwbHRbMF07XG4gICAgICBvcCA9IHNwbHRbMV07XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgZmllbGQgPSBzcGx0WzBdO1xuICAgIH1cbiAgICBmaWVsZHNbZmllbGRzLmxlbmd0aCAtIDFdID0gZmllbGQ7XG4gICAgZmllbGRzLnNsaWNlKDAsIGZpZWxkcy5sZW5ndGggLSAxKS5mb3JFYWNoKGZ1bmN0aW9uKGYpIHtcbiAgICAgIGlmICh1dGlsLmlzQXJyYXkob2JqKSkge1xuICAgICAgICBvYmogPSB1dGlsLnBsdWNrKG9iaiwgZik7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgb2JqID0gb2JqW2ZdO1xuICAgICAgfVxuICAgIH0pO1xuICAgIC8vIElmIHdlIGdldCB0byB0aGUgcG9pbnQgd2hlcmUgd2UncmUgYWJvdXQgdG8gaW5kZXggbnVsbCBvciB1bmRlZmluZWQgd2Ugc3RvcCAtIG9idmlvdXNseSB0aGlzIG9iamVjdCBkb2VzXG4gICAgLy8gbm90IG1hdGNoIHRoZSBxdWVyeS5cbiAgICB2YXIgbm90TnVsbE9yVW5kZWZpbmVkID0gb2JqICE9IHVuZGVmaW5lZDtcbiAgICBpZiAobm90TnVsbE9yVW5kZWZpbmVkKSB7XG4gICAgICBpZiAodXRpbC5pc0FycmF5KG9iaikpIHtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB2YXIgdmFsID0gb2JqW2ZpZWxkXTtcbiAgICAgICAgdmFyIGludmFsaWQgPSB1dGlsLmlzQXJyYXkodmFsKSA/IGZhbHNlIDogdmFsID09PSBudWxsIHx8IHZhbCA9PT0gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgICAgdmFyIGNvbXBhcmF0b3IgPSBRdWVyeS5jb21wYXJhdG9yc1tvcF0sXG4gICAgICAgIG9wdHMgPSB7b2JqZWN0OiBvYmosIGZpZWxkOiBmaWVsZCwgdmFsdWU6IHZhbHVlLCBpbnZhbGlkOiBpbnZhbGlkfTtcbiAgICAgIGlmICghY29tcGFyYXRvcikge1xuICAgICAgICByZXR1cm4gJ05vIGNvbXBhcmF0b3IgcmVnaXN0ZXJlZCBmb3IgcXVlcnkgb3BlcmF0aW9uIFwiJyArIG9wICsgJ1wiJztcbiAgICAgIH1cbiAgICAgIHJldHVybiBjb21wYXJhdG9yKG9wdHMpO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH0sXG4gIG9iamVjdE1hdGNoZXM6IGZ1bmN0aW9uKG9iaiwgdW5wcm9jZXNzZWRGaWVsZCwgdmFsdWUsIHF1ZXJ5KSB7XG4gICAgaWYgKHVucHJvY2Vzc2VkRmllbGQgPT0gJyRvcicpIHtcbiAgICAgIHZhciAkb3IgPSBxdWVyeVsnJG9yJ107XG4gICAgICBpZiAoIXV0aWwuaXNBcnJheSgkb3IpKSB7XG4gICAgICAgICRvciA9IE9iamVjdC5rZXlzKCRvcikubWFwKGZ1bmN0aW9uKGspIHtcbiAgICAgICAgICB2YXIgbm9ybWFsaXNlZCA9IHt9O1xuICAgICAgICAgIG5vcm1hbGlzZWRba10gPSAkb3Jba107XG4gICAgICAgICAgcmV0dXJuIG5vcm1hbGlzZWQ7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgaWYgKCF0aGlzLm9iamVjdE1hdGNoZXNPclF1ZXJ5KG9iaiwgJG9yKSkgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBlbHNlIGlmICh1bnByb2Nlc3NlZEZpZWxkID09ICckYW5kJykge1xuICAgICAgaWYgKCF0aGlzLm9iamVjdE1hdGNoZXNBbmRRdWVyeShvYmosIHF1ZXJ5WyckYW5kJ10pKSByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdmFyIG1hdGNoZXMgPSB0aGlzLnNwbGl0TWF0Y2hlcyhvYmosIHVucHJvY2Vzc2VkRmllbGQsIHZhbHVlKTtcbiAgICAgIGlmICh0eXBlb2YgbWF0Y2hlcyAhPSAnYm9vbGVhbicpIHJldHVybiBtYXRjaGVzO1xuICAgICAgaWYgKCFtYXRjaGVzKSByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9LFxuICBvYmplY3RNYXRjaGVzQmFzZVF1ZXJ5OiBmdW5jdGlvbihvYmosIHF1ZXJ5KSB7XG4gICAgdmFyIGZpZWxkcyA9IE9iamVjdC5rZXlzKHF1ZXJ5KTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZpZWxkcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHVucHJvY2Vzc2VkRmllbGQgPSBmaWVsZHNbaV0sXG4gICAgICAgIHZhbHVlID0gcXVlcnlbdW5wcm9jZXNzZWRGaWVsZF07XG4gICAgICB2YXIgcnQgPSB0aGlzLm9iamVjdE1hdGNoZXMob2JqLCB1bnByb2Nlc3NlZEZpZWxkLCB2YWx1ZSwgcXVlcnkpO1xuICAgICAgaWYgKHR5cGVvZiBydCAhPSAnYm9vbGVhbicpIHJldHVybiBydDtcbiAgICAgIGlmICghcnQpIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH0sXG4gIG9iamVjdE1hdGNoZXNRdWVyeTogZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIHRoaXMub2JqZWN0TWF0Y2hlc0Jhc2VRdWVyeShvYmosIHRoaXMucXVlcnkpO1xuICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBRdWVyeTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL1F1ZXJ5LmpzXG4gKiogbW9kdWxlIGlkID0gMTRcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gIFByb21pc2UgPSB1dGlsLlByb21pc2UsXG4gIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLFxuICBNb2RlbEluc3RhbmNlID0gcmVxdWlyZSgnLi9Nb2RlbEluc3RhbmNlJyk7XG5cbi8qXG4gVE9ETzogVXNlIEVTNiBQcm94eSBpbnN0ZWFkLlxuIEV2ZW50dWFsbHkgcXVlcnkgc2V0cyBzaG91bGQgdXNlIEVTNiBQcm94aWVzIHdoaWNoIHdpbGwgYmUgbXVjaCBtb3JlIG5hdHVyYWwgYW5kIHJvYnVzdC4gRS5nLiBubyBuZWVkIGZvciB0aGUgYmVsb3dcbiAqL1xudmFyIEFSUkFZX01FVEhPRFMgPSBbJ3B1c2gnLCAnc29ydCcsICdyZXZlcnNlJywgJ3NwbGljZScsICdzaGlmdCcsICd1bnNoaWZ0J10sXG4gIE5VTUJFUl9NRVRIT0RTID0gWyd0b1N0cmluZycsICd0b0V4cG9uZW50aWFsJywgJ3RvRml4ZWQnLCAndG9QcmVjaXNpb24nLCAndmFsdWVPZiddLFxuICBOVU1CRVJfUFJPUEVSVElFUyA9IFsnTUFYX1ZBTFVFJywgJ01JTl9WQUxVRScsICdORUdBVElWRV9JTkZJTklUWScsICdOYU4nLCAnUE9TSVRJVkVfSU5GSU5JVFknXSxcbiAgU1RSSU5HX01FVEhPRFMgPSBbJ2NoYXJBdCcsICdjaGFyQ29kZUF0JywgJ2NvbmNhdCcsICdmcm9tQ2hhckNvZGUnLCAnaW5kZXhPZicsICdsYXN0SW5kZXhPZicsICdsb2NhbGVDb21wYXJlJyxcbiAgICAnbWF0Y2gnLCAncmVwbGFjZScsICdzZWFyY2gnLCAnc2xpY2UnLCAnc3BsaXQnLCAnc3Vic3RyJywgJ3N1YnN0cmluZycsICd0b0xvY2FsZUxvd2VyQ2FzZScsICd0b0xvY2FsZVVwcGVyQ2FzZScsXG4gICAgJ3RvTG93ZXJDYXNlJywgJ3RvU3RyaW5nJywgJ3RvVXBwZXJDYXNlJywgJ3RyaW0nLCAndmFsdWVPZiddLFxuICBTVFJJTkdfUFJPUEVSVElFUyA9IFsnbGVuZ3RoJ107XG5cbi8qKlxuICogUmV0dXJuIHRoZSBwcm9wZXJ0eSBuYW1lcyBmb3IgYSBnaXZlbiBvYmplY3QuIEhhbmRsZXMgc3BlY2lhbCBjYXNlcyBzdWNoIGFzIHN0cmluZ3MgYW5kIG51bWJlcnMgdGhhdCBkbyBub3QgaGF2ZVxuICogdGhlIGdldE93blByb3BlcnR5TmFtZXMgZnVuY3Rpb24uXG4gKiBUaGUgc3BlY2lhbCBjYXNlcyBhcmUgdmVyeSBtdWNoIGhhY2tzLiBUaGlzIGhhY2sgY2FuIGJlIHJlbW92ZWQgb25jZSB0aGUgUHJveHkgb2JqZWN0IGlzIG1vcmUgd2lkZWx5IGFkb3B0ZWQuXG4gKiBAcGFyYW0gb2JqZWN0XG4gKiBAcmV0dXJucyB7QXJyYXl9XG4gKi9cbmZ1bmN0aW9uIGdldFByb3BlcnR5TmFtZXMob2JqZWN0KSB7XG4gIHZhciBwcm9wZXJ0eU5hbWVzO1xuICBpZiAodHlwZW9mIG9iamVjdCA9PSAnc3RyaW5nJyB8fCBvYmplY3QgaW5zdGFuY2VvZiBTdHJpbmcpIHtcbiAgICBwcm9wZXJ0eU5hbWVzID0gU1RSSU5HX01FVEhPRFMuY29uY2F0KFNUUklOR19QUk9QRVJUSUVTKTtcbiAgfVxuICBlbHNlIGlmICh0eXBlb2Ygb2JqZWN0ID09ICdudW1iZXInIHx8IG9iamVjdCBpbnN0YW5jZW9mIE51bWJlcikge1xuICAgIHByb3BlcnR5TmFtZXMgPSBOVU1CRVJfTUVUSE9EUy5jb25jYXQoTlVNQkVSX1BST1BFUlRJRVMpO1xuICB9XG4gIGVsc2Uge1xuICAgIHByb3BlcnR5TmFtZXMgPSBvYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcygpO1xuICB9XG4gIHJldHVybiBwcm9wZXJ0eU5hbWVzO1xufVxuXG4vKipcbiAqIERlZmluZSBhIHByb3h5IHByb3BlcnR5IHRvIGF0dHJpYnV0ZXMgb24gb2JqZWN0cyBpbiB0aGUgYXJyYXlcbiAqIEBwYXJhbSBhcnJcbiAqIEBwYXJhbSBwcm9wXG4gKi9cbmZ1bmN0aW9uIGRlZmluZUF0dHJpYnV0ZShhcnIsIHByb3ApIHtcbiAgaWYgKCEocHJvcCBpbiBhcnIpKSB7IC8vIGUuZy4gd2UgY2Fubm90IHJlZGVmaW5lIC5sZW5ndGhcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoYXJyLCBwcm9wLCB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gcXVlcnlTZXQodXRpbC5wbHVjayhhcnIsIHByb3ApKTtcbiAgICAgIH0sXG4gICAgICBzZXQ6IGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgaWYgKHV0aWwuaXNBcnJheSh2KSkge1xuICAgICAgICAgIGlmICh0aGlzLmxlbmd0aCAhPSB2Lmxlbmd0aCkgdGhyb3cgZXJyb3Ioe21lc3NhZ2U6ICdNdXN0IGJlIHNhbWUgbGVuZ3RoJ30pO1xuICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpc1tpXVtwcm9wXSA9IHZbaV07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzW2ldW3Byb3BdID0gdjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc1Byb21pc2Uob2JqKSB7XG4gIC8vIFRPRE86IERvbid0IHRoaW5rIHRoaXMgaXMgdmVyeSByb2J1c3QuXG4gIHJldHVybiBvYmoudGhlbiAmJiBvYmouY2F0Y2g7XG59XG5cbi8qKlxuICogRGVmaW5lIGEgcHJveHkgbWV0aG9kIG9uIHRoZSBhcnJheSBpZiBub3QgYWxyZWFkeSBpbiBleGlzdGVuY2UuXG4gKiBAcGFyYW0gYXJyXG4gKiBAcGFyYW0gcHJvcFxuICovXG5mdW5jdGlvbiBkZWZpbmVNZXRob2QoYXJyLCBwcm9wKSB7XG4gIGlmICghKHByb3AgaW4gYXJyKSkgeyAvLyBlLmcuIHdlIGRvbid0IHdhbnQgdG8gcmVkZWZpbmUgdG9TdHJpbmdcbiAgICBhcnJbcHJvcF0gPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBhcmdzID0gYXJndW1lbnRzLFxuICAgICAgICByZXMgPSB0aGlzLm1hcChmdW5jdGlvbihwKSB7XG4gICAgICAgICAgcmV0dXJuIHBbcHJvcF0uYXBwbHkocCwgYXJncyk7XG4gICAgICAgIH0pO1xuICAgICAgdmFyIGFyZVByb21pc2VzID0gZmFsc2U7XG4gICAgICBpZiAocmVzLmxlbmd0aCkgYXJlUHJvbWlzZXMgPSBpc1Byb21pc2UocmVzWzBdKTtcbiAgICAgIHJldHVybiBhcmVQcm9taXNlcyA/IFByb21pc2UuYWxsKHJlcykgOiBxdWVyeVNldChyZXMpO1xuICAgIH07XG4gIH1cbn1cblxuLyoqXG4gKiBUcmFuc2Zvcm0gdGhlIGFycmF5IGludG8gYSBxdWVyeSBzZXQuXG4gKiBSZW5kZXJzIHRoZSBhcnJheSBpbW11dGFibGUuXG4gKiBAcGFyYW0gYXJyXG4gKiBAcGFyYW0gbW9kZWwgLSBUaGUgbW9kZWwgd2l0aCB3aGljaCB0byBwcm94eSB0b1xuICovXG5mdW5jdGlvbiBtb2RlbFF1ZXJ5U2V0KGFyciwgbW9kZWwpIHtcbiAgYXJyID0gdXRpbC5leHRlbmQoW10sIGFycik7XG4gIHZhciBhdHRyaWJ1dGVOYW1lcyA9IG1vZGVsLl9hdHRyaWJ1dGVOYW1lcyxcbiAgICByZWxhdGlvbnNoaXBOYW1lcyA9IG1vZGVsLl9yZWxhdGlvbnNoaXBOYW1lcyxcbiAgICBuYW1lcyA9IGF0dHJpYnV0ZU5hbWVzLmNvbmNhdChyZWxhdGlvbnNoaXBOYW1lcykuY29uY2F0KGluc3RhbmNlTWV0aG9kcyk7XG4gIG5hbWVzLmZvckVhY2goZGVmaW5lQXR0cmlidXRlLmJpbmQoZGVmaW5lQXR0cmlidXRlLCBhcnIpKTtcbiAgdmFyIGluc3RhbmNlTWV0aG9kcyA9IE9iamVjdC5rZXlzKE1vZGVsSW5zdGFuY2UucHJvdG90eXBlKTtcbiAgaW5zdGFuY2VNZXRob2RzLmZvckVhY2goZGVmaW5lTWV0aG9kLmJpbmQoZGVmaW5lTWV0aG9kLCBhcnIpKTtcbiAgcmV0dXJuIHJlbmRlckltbXV0YWJsZShhcnIpO1xufVxuXG4vKipcbiAqIFRyYW5zZm9ybSB0aGUgYXJyYXkgaW50byBhIHF1ZXJ5IHNldCwgYmFzZWQgb24gd2hhdGV2ZXIgaXMgaW4gaXQuXG4gKiBOb3RlIHRoYXQgYWxsIG9iamVjdHMgbXVzdCBiZSBvZiB0aGUgc2FtZSB0eXBlLiBUaGlzIGZ1bmN0aW9uIHdpbGwgdGFrZSB0aGUgZmlyc3Qgb2JqZWN0IGFuZCBkZWNpZGUgaG93IHRvIHByb3h5XG4gKiBiYXNlZCBvbiB0aGF0LlxuICogQHBhcmFtIGFyclxuICovXG5mdW5jdGlvbiBxdWVyeVNldChhcnIpIHtcbiAgaWYgKGFyci5sZW5ndGgpIHtcbiAgICB2YXIgcmVmZXJlbmNlT2JqZWN0ID0gYXJyWzBdLFxuICAgICAgcHJvcGVydHlOYW1lcyA9IGdldFByb3BlcnR5TmFtZXMocmVmZXJlbmNlT2JqZWN0KTtcbiAgICBwcm9wZXJ0eU5hbWVzLmZvckVhY2goZnVuY3Rpb24ocHJvcCkge1xuICAgICAgaWYgKHR5cGVvZiByZWZlcmVuY2VPYmplY3RbcHJvcF0gPT0gJ2Z1bmN0aW9uJykgZGVmaW5lTWV0aG9kKGFyciwgcHJvcCwgYXJndW1lbnRzKTtcbiAgICAgIGVsc2UgZGVmaW5lQXR0cmlidXRlKGFyciwgcHJvcCk7XG4gICAgfSk7XG4gIH1cbiAgcmV0dXJuIHJlbmRlckltbXV0YWJsZShhcnIpO1xufVxuXG5mdW5jdGlvbiB0aHJvd0ltbXV0YWJsZUVycm9yKCkge1xuICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBtb2RpZnkgYSBxdWVyeSBzZXQnKTtcbn1cblxuLyoqXG4gKiBSZW5kZXIgYW4gYXJyYXkgaW1tdXRhYmxlIGJ5IHJlcGxhY2luZyBhbnkgZnVuY3Rpb25zIHRoYXQgY2FuIG11dGF0ZSBpdC5cbiAqIEBwYXJhbSBhcnJcbiAqL1xuZnVuY3Rpb24gcmVuZGVySW1tdXRhYmxlKGFycikge1xuICBBUlJBWV9NRVRIT0RTLmZvckVhY2goZnVuY3Rpb24ocCkge1xuICAgIGFycltwXSA9IHRocm93SW1tdXRhYmxlRXJyb3I7XG4gIH0pO1xuICBhcnIuaW1tdXRhYmxlID0gdHJ1ZTtcbiAgYXJyLm11dGFibGVDb3B5ID0gYXJyLmFzQXJyYXkgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgbXV0YWJsZUFyciA9IHRoaXMubWFwKGZ1bmN0aW9uKHgpIHtyZXR1cm4geH0pO1xuICAgIG11dGFibGVBcnIuYXNRdWVyeVNldCA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHF1ZXJ5U2V0KHRoaXMpO1xuICAgIH07XG4gICAgbXV0YWJsZUFyci5hc01vZGVsUXVlcnlTZXQgPSBmdW5jdGlvbihtb2RlbCkge1xuICAgICAgcmV0dXJuIG1vZGVsUXVlcnlTZXQodGhpcywgbW9kZWwpO1xuICAgIH07XG4gICAgcmV0dXJuIG11dGFibGVBcnI7XG4gIH07XG4gIHJldHVybiBhcnI7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbW9kZWxRdWVyeVNldDtcblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9RdWVyeVNldC5qc1xuICoqIG1vZHVsZSBpZCA9IDE1XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxuICBhcmdzYXJyYXkgPSByZXF1aXJlKCdhcmdzYXJyYXknKTtcblxuZnVuY3Rpb24gQ29uZGl0aW9uKGZuLCBsYXp5KSB7XG4gIGlmIChsYXp5ID09PSB1bmRlZmluZWQgfHwgbGF6eSA9PT0gbnVsbCkge1xuICAgIGxhenkgPSB0cnVlO1xuICB9XG4gIGZuID0gZm4gfHwgZnVuY3Rpb24oZG9uZSkge1xuICAgIGRvbmUoKTtcbiAgfTtcblxuICB0aGlzLl9wcm9taXNlID0gbmV3IHV0aWwuUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICB0aGlzLnJlamVjdCA9IHJlamVjdDtcbiAgICB0aGlzLnJlc29sdmUgPSByZXNvbHZlO1xuICAgIHRoaXMuZm4gPSBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuZXhlY3V0ZWQgPSB0cnVlO1xuICAgICAgdmFyIG51bUNvbXBsZXRlID0gMDtcbiAgICAgIHZhciByZXN1bHRzID0gW107XG4gICAgICB2YXIgZXJyb3JzID0gW107XG4gICAgICBpZiAodXRpbC5pc0FycmF5KGZuKSkge1xuICAgICAgICB2YXIgY2hlY2tDb21wbGV0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGlmIChudW1Db21wbGV0ZSA9PSBmbi5sZW5ndGgpIHtcbiAgICAgICAgICAgIGlmIChlcnJvcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgIHJlamVjdChlcnJvcnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIHJlc29sdmUocmVzdWx0cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgIGZuLmZvckVhY2goZnVuY3Rpb24oY29uZCwgaWR4KSB7XG4gICAgICAgICAgY29uZFxuICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24ocmVzKSB7XG4gICAgICAgICAgICAgIHJlc3VsdHNbaWR4XSA9IHJlcztcbiAgICAgICAgICAgICAgbnVtQ29tcGxldGUrKztcbiAgICAgICAgICAgICAgY2hlY2tDb21wbGV0ZSgpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgZXJyb3JzW2lkeF0gPSBlcnI7XG4gICAgICAgICAgICAgIG51bUNvbXBsZXRlKys7XG4gICAgICAgICAgICAgIGNoZWNrQ29tcGxldGUoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBmbihmdW5jdGlvbihlcnIsIHJlcykge1xuICAgICAgICAgIGlmIChlcnIpIHJlamVjdChlcnIpO1xuICAgICAgICAgIGVsc2UgcmVzb2x2ZShyZXMpO1xuICAgICAgICB9LmJpbmQodGhpcykpXG4gICAgICB9XG4gICAgfVxuICB9LmJpbmQodGhpcykpO1xuXG4gIGlmICghbGF6eSkgdGhpcy5fZXhlY3V0ZSgpO1xuICB0aGlzLmV4ZWN1dGVkID0gZmFsc2U7XG4gIHRoaXMuZGVwZW5kZW50ID0gW107XG59XG5cbkNvbmRpdGlvbi5hbGwgPSBhcmdzYXJyYXkoZnVuY3Rpb24oYXJncykge1xuICByZXR1cm4gbmV3IENvbmRpdGlvbihhcmdzKTtcbn0pO1xuXG5Db25kaXRpb24ucHJvdG90eXBlID0ge1xuICBfZXhlY3V0ZTogZnVuY3Rpb24oKSB7XG4gICAgaWYgKCF0aGlzLmV4ZWN1dGVkKSB7XG4gICAgICBQcm9taXNlXG4gICAgICAgIC5hbGwodXRpbC5wbHVjayh0aGlzLmRlcGVuZGVudCwgJ19wcm9taXNlJykpXG4gICAgICAgIC50aGVuKHRoaXMuZm4pXG4gICAgICAgIC5jYXRjaCh0aGlzLnJlamVjdC5iaW5kKHRoaXMpKTtcbiAgICAgIHRoaXMuZGVwZW5kZW50LmZvckVhY2goZnVuY3Rpb24oZCkge1xuICAgICAgICBkLl9leGVjdXRlKCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG4gIHRoZW46IGZ1bmN0aW9uKHN1Y2Nlc3MsIGZhaWwpIHtcbiAgICB0aGlzLl9leGVjdXRlKCk7XG4gICAgdGhpcy5fcHJvbWlzZS50aGVuKHN1Y2Nlc3MsIGZhaWwpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuICBjYXRjaDogZnVuY3Rpb24oZmFpbCkge1xuICAgIHRoaXMuX2V4ZWN1dGUoKTtcbiAgICB0aGlzLl9wcm9taXNlLmNhdGNoKGZhaWwpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuICByZXNvbHZlOiBmdW5jdGlvbihyZXMpIHtcbiAgICB0aGlzLmV4ZWN1dGVkID0gdHJ1ZTtcbiAgICB0aGlzLl9wcm9taXNlLnJlc29sdmUocmVzKTtcbiAgfSxcbiAgcmVqZWN0OiBmdW5jdGlvbihlcnIpIHtcbiAgICB0aGlzLmV4ZWN1dGVkID0gdHJ1ZTtcbiAgICB0aGlzLl9wcm9taXNlLnJlamVjdChlcnIpO1xuICB9LFxuICBkZXBlbmRlbnRPbjogZnVuY3Rpb24oY29uZCkge1xuICAgIHRoaXMuZGVwZW5kZW50LnB1c2goY29uZCk7XG4gIH0sXG4gIHJlc2V0OiBmdW5jdGlvbigpIHtcblxuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENvbmRpdGlvbjtcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL0NvbmRpdGlvbi5qc1xuICoqIG1vZHVsZSBpZCA9IDE2XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCIvKipcbiAqIERlYWQgc2ltcGxlIGxvZ2dpbmcgc2VydmljZSBiYXNlZCBvbiB2aXNpb25tZWRpYS9kZWJ1Z1xuICogQG1vZHVsZSBsb2dcbiAqL1xuXG52YXIgZGVidWcgPSByZXF1aXJlKCdkZWJ1ZycpLFxuICBhcmdzYXJyYXkgPSByZXF1aXJlKCdhcmdzYXJyYXknKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihuYW1lKSB7XG4gIHZhciBsb2cgPSBkZWJ1Zygnc2llc3RhOicgKyBuYW1lKTtcbiAgdmFyIGZuID0gYXJnc2FycmF5KGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICBsb2cuY2FsbChsb2csIGFyZ3MpO1xuICB9KTtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGZuLCAnZW5hYmxlZCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGRlYnVnLmVuYWJsZWQobmFtZSk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIGZuO1xufTtcblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9sb2cuanNcbiAqKiBtb2R1bGUgaWQgPSAxN1xuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIGxvZyA9IHJlcXVpcmUoJy4vbG9nJyksXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgZXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJyksXG4gIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICBNb2RlbEV2ZW50VHlwZSA9IG1vZGVsRXZlbnRzLk1vZGVsRXZlbnRUeXBlLFxuICBQcm94eUV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJy4vUHJveHlFdmVudEVtaXR0ZXInKTtcblxuXG5mdW5jdGlvbiBNb2RlbEluc3RhbmNlKG1vZGVsKSB7XG4gIGlmICghbW9kZWwpIHRocm93IG5ldyBFcnJvcignd3RmJyk7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdGhpcy5tb2RlbCA9IG1vZGVsO1xuXG4gIFByb3h5RXZlbnRFbWl0dGVyLmNhbGwodGhpcywgbW9kZWwuYXBwKTtcblxuICB0aGlzLl9fcHJveGllcyA9IHt9O1xuICB0aGlzLl9wcm94aWVzID0gW107XG5cbiAgdXRpbC5zdWJQcm9wZXJ0aWVzKHRoaXMsIHRoaXMubW9kZWwsIFtcbiAgICAnY29sbGVjdGlvbicsXG4gICAgJ2NvbGxlY3Rpb25OYW1lJyxcbiAgICAnX2F0dHJpYnV0ZU5hbWVzJyxcbiAgICB7XG4gICAgICBuYW1lOiAnaWRGaWVsZCcsXG4gICAgICBwcm9wZXJ0eTogJ2lkJ1xuICAgIH0sXG4gICAge1xuICAgICAgbmFtZTogJ21vZGVsTmFtZScsXG4gICAgICBwcm9wZXJ0eTogJ25hbWUnXG4gICAgfVxuICBdKTtcblxuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICBfcmVsYXRpb25zaGlwTmFtZXM6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBwcm94aWVzID0gT2JqZWN0LmtleXMoc2VsZi5fX3Byb3hpZXMgfHwge30pLm1hcChmdW5jdGlvbih4KSB7XG4gICAgICAgICAgcmV0dXJuIHNlbGYuX19wcm94aWVzW3hdXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcHJveGllcy5tYXAoZnVuY3Rpb24ocCkge1xuICAgICAgICAgIGlmIChwLmlzRm9yd2FyZCkge1xuICAgICAgICAgICAgcmV0dXJuIHAuZm9yd2FyZE5hbWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBwLnJldmVyc2VOYW1lO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0sXG4gICAgZGlydHk6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLmFwcC5zdG9yYWdlRW5hYmxlZCkge1xuICAgICAgICAgIHJldHVybiBzZWxmLmxvY2FsSWQgaW4gdGhpcy5hcHAuc3RvcmFnZS5fdW5zYXZlZE9iamVjdHNIYXNoO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSxcbiAgICAvLyBUaGlzIGlzIGZvciBQcm94eUV2ZW50RW1pdHRlci5cbiAgICBldmVudDoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubG9jYWxJZFxuICAgICAgfVxuICAgIH0sXG4gICAgYXBwOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5tb2RlbC5hcHA7XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICB0aGlzLnJlbW92ZWQgPSBmYWxzZTtcblxuICAvKipcbiAgICogV2hldGhlciBvciBub3QgZXZlbnRzIChzZXQsIHJlbW92ZSBldGMpIGFyZSBlbWl0dGVkIGZvciB0aGlzIG1vZGVsIGluc3RhbmNlLlxuICAgKlxuICAgKiBUaGlzIGlzIHVzZWQgYXMgYSB3YXkgb2YgY29udHJvbGxpbmcgd2hhdCBldmVudHMgYXJlIGVtaXR0ZWQgd2hlbiB0aGUgbW9kZWwgaW5zdGFuY2UgaXMgY3JlYXRlZC4gRS5nLiB3ZSBkb24ndFxuICAgKiB3YW50IHRvIHNlbmQgYSBtZXRyaWMgc2hpdCB0b24gb2YgJ3NldCcgZXZlbnRzIGlmIHdlJ3JlIG5ld2x5IGNyZWF0aW5nIGFuIGluc3RhbmNlLiBXZSBvbmx5IHdhbnQgdG8gc2VuZCB0aGVcbiAgICogJ25ldycgZXZlbnQgb25jZSBjb25zdHJ1Y3RlZC5cbiAgICpcbiAgICogVGhpcyBpcyBwcm9iYWJseSBhIGJpdCBvZiBhIGhhY2sgYW5kIHNob3VsZCBiZSByZW1vdmVkIGV2ZW50dWFsbHkuXG4gICAqIEB0eXBlIHtib29sZWFufVxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgdGhpcy5fZW1pdEV2ZW50cyA9IGZhbHNlO1xuXG5cbn1cblxuTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFByb3h5RXZlbnRFbWl0dGVyLnByb3RvdHlwZSk7XG5cbnV0aWwuZXh0ZW5kKE1vZGVsSW5zdGFuY2UucHJvdG90eXBlLCB7XG4gIGdldDogZnVuY3Rpb24oY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgY2IobnVsbCwgdGhpcyk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgZW1pdDogZnVuY3Rpb24odHlwZSwgb3B0cykge1xuICAgIGlmICh0eXBlb2YgdHlwZSA9PSAnb2JqZWN0Jykgb3B0cyA9IHR5cGU7XG4gICAgZWxzZSBvcHRzLnR5cGUgPSB0eXBlO1xuICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgIHV0aWwuZXh0ZW5kKG9wdHMsIHtcbiAgICAgIGNvbGxlY3Rpb246IHRoaXMuY29sbGVjdGlvbk5hbWUsXG4gICAgICBtb2RlbDogdGhpcy5tb2RlbC5uYW1lLFxuICAgICAgbG9jYWxJZDogdGhpcy5sb2NhbElkLFxuICAgICAgb2JqOiB0aGlzXG4gICAgfSk7XG4gICAgdGhpcy5hcHAuYnJvYWRjYXN0KG9wdHMpO1xuICB9LFxuICByZW1vdmU6IGZ1bmN0aW9uKGNiLCBub3RpZmljYXRpb24pIHtcbiAgICBfLmVhY2godGhpcy5fcmVsYXRpb25zaGlwTmFtZXMsIGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIGlmICh1dGlsLmlzQXJyYXkodGhpc1tuYW1lXSkpIHtcbiAgICAgICAgdGhpc1tuYW1lXSA9IFtdO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHRoaXNbbmFtZV0gPSBudWxsO1xuICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG4gICAgbm90aWZpY2F0aW9uID0gbm90aWZpY2F0aW9uID09IG51bGwgPyB0cnVlIDogbm90aWZpY2F0aW9uO1xuICAgIHJldHVybiB1dGlsLnByb21pc2UoY2IsIGZ1bmN0aW9uKGNiKSB7XG4gICAgICB0aGlzLmFwcC5jYWNoZS5yZW1vdmUodGhpcyk7XG4gICAgICB0aGlzLnJlbW92ZWQgPSB0cnVlO1xuICAgICAgaWYgKG5vdGlmaWNhdGlvbikge1xuICAgICAgICB0aGlzLmVtaXQobW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuUmVtb3ZlLCB7XG4gICAgICAgICAgb2xkOiB0aGlzXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgdmFyIHJlbW92ZSA9IHRoaXMubW9kZWwucmVtb3ZlO1xuICAgICAgaWYgKHJlbW92ZSkge1xuICAgICAgICB2YXIgcGFyYW1OYW1lcyA9IHV0aWwucGFyYW1OYW1lcyhyZW1vdmUpO1xuICAgICAgICBpZiAocGFyYW1OYW1lcy5sZW5ndGgpIHtcbiAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgcmVtb3ZlLmNhbGwodGhpcywgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICBjYihlcnIsIHNlbGYpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHJlbW92ZS5jYWxsKHRoaXMpO1xuICAgICAgICAgIGNiKG51bGwsIHRoaXMpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY2IobnVsbCwgdGhpcyk7XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgcmVzdG9yZTogZnVuY3Rpb24oY2IpIHtcbiAgICByZXR1cm4gdXRpbC5wcm9taXNlKGNiLCBmdW5jdGlvbihjYikge1xuICAgICAgdmFyIF9maW5pc2ggPSBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICB0aGlzLmVtaXQobW9kZWxFdmVudHMuTW9kZWxFdmVudFR5cGUuTmV3LCB7XG4gICAgICAgICAgICBuZXc6IHRoaXNcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBjYihlcnIsIHRoaXMpO1xuICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgaWYgKHRoaXMucmVtb3ZlZCkge1xuICAgICAgICB0aGlzLmFwcC5jYWNoZS5pbnNlcnQodGhpcyk7XG4gICAgICAgIHRoaXMucmVtb3ZlZCA9IGZhbHNlO1xuICAgICAgICB2YXIgaW5pdCA9IHRoaXMubW9kZWwuaW5pdDtcbiAgICAgICAgaWYgKGluaXQpIHtcbiAgICAgICAgICB2YXIgcGFyYW1OYW1lcyA9IHV0aWwucGFyYW1OYW1lcyhpbml0KTtcbiAgICAgICAgICB2YXIgZnJvbVN0b3JhZ2UgPSB0cnVlO1xuICAgICAgICAgIGlmIChwYXJhbU5hbWVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgIGluaXQuY2FsbCh0aGlzLCBmcm9tU3RvcmFnZSwgX2ZpbmlzaCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaW5pdC5jYWxsKHRoaXMsIGZyb21TdG9yYWdlKTtcbiAgICAgICAgICAgIF9maW5pc2goKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgX2ZpbmlzaCgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfVxufSk7XG5cbi8vIEluc3BlY3Rpb25cbnV0aWwuZXh0ZW5kKE1vZGVsSW5zdGFuY2UucHJvdG90eXBlLCB7XG4gIGdldEF0dHJpYnV0ZXM6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB1dGlsLmV4dGVuZCh7fSwgdGhpcy5fX3ZhbHVlcyk7XG4gIH0sXG4gIGlzSW5zdGFuY2VPZjogZnVuY3Rpb24obW9kZWwpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbCA9PSBtb2RlbDtcbiAgfSxcbiAgaXNBOiBmdW5jdGlvbihtb2RlbCkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsID09IG1vZGVsIHx8IHRoaXMubW9kZWwuaXNEZXNjZW5kYW50T2YobW9kZWwpO1xuICB9XG59KTtcblxuLy8gRHVtcFxudXRpbC5leHRlbmQoTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUsIHtcbiAgX2R1bXBTdHJpbmc6IGZ1bmN0aW9uKHJldmVyc2VSZWxhdGlvbnNoaXBzKSB7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHRoaXMuX2R1bXAocmV2ZXJzZVJlbGF0aW9uc2hpcHMsIG51bGwsIDQpKTtcbiAgfSxcbiAgX2R1bXA6IGZ1bmN0aW9uKHJldmVyc2VSZWxhdGlvbnNoaXBzKSB7XG4gICAgdmFyIGR1bXBlZCA9IHV0aWwuZXh0ZW5kKHt9LCB0aGlzLl9fdmFsdWVzKTtcbiAgICBkdW1wZWQuX3JldiA9IHRoaXMuX3JldjtcbiAgICBkdW1wZWQubG9jYWxJZCA9IHRoaXMubG9jYWxJZDtcbiAgICByZXR1cm4gZHVtcGVkO1xuICB9XG59KTtcblxuZnVuY3Rpb24gZGVmYXVsdFNlcmlhbGlzZXIoYXR0ck5hbWUsIHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZTtcbn1cblxuLy8gU2VyaWFsaXNhdGlvblxudXRpbC5leHRlbmQoTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUsIHtcbiAgX2RlZmF1bHRTZXJpYWxpc2U6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICB2YXIgc2VyaWFsaXNlZCA9IHt9O1xuICAgIHZhciBpbmNsdWRlTnVsbEF0dHJpYnV0ZXMgPSBvcHRzLmluY2x1ZGVOdWxsQXR0cmlidXRlcyAhPT0gdW5kZWZpbmVkID8gb3B0cy5pbmNsdWRlTnVsbEF0dHJpYnV0ZXMgOiB0cnVlLFxuICAgICAgaW5jbHVkZU51bGxSZWxhdGlvbnNoaXBzID0gb3B0cy5pbmNsdWRlTnVsbFJlbGF0aW9uc2hpcHMgIT09IHVuZGVmaW5lZCA/IG9wdHMuaW5jbHVkZU51bGxSZWxhdGlvbnNoaXBzIDogdHJ1ZTtcbiAgICB2YXIgc2VyaWFsaXNhYmxlRmllbGRzID0gdGhpcy5tb2RlbC5zZXJpYWxpc2FibGVGaWVsZHMgfHxcbiAgICAgIHRoaXMuX2F0dHJpYnV0ZU5hbWVzLmNvbmNhdC5hcHBseSh0aGlzLl9hdHRyaWJ1dGVOYW1lcywgdGhpcy5fcmVsYXRpb25zaGlwTmFtZXMpLmNvbmNhdCh0aGlzLmlkKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGVOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uKGF0dHJOYW1lKSB7XG4gICAgICBpZiAoc2VyaWFsaXNhYmxlRmllbGRzLmluZGV4T2YoYXR0ck5hbWUpID4gLTEpIHtcbiAgICAgICAgdmFyIGF0dHJEZWZpbml0aW9uID0gdGhpcy5tb2RlbC5fYXR0cmlidXRlRGVmaW5pdGlvbldpdGhOYW1lKGF0dHJOYW1lKSB8fCB7fTtcbiAgICAgICAgdmFyIHNlcmlhbGlzZXI7XG4gICAgICAgIGlmIChhdHRyRGVmaW5pdGlvbi5zZXJpYWxpc2UpIHNlcmlhbGlzZXIgPSBhdHRyRGVmaW5pdGlvbi5zZXJpYWxpc2UuYmluZCh0aGlzKTtcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgdmFyIHNlcmlhbGlzZUZpZWxkID0gdGhpcy5tb2RlbC5zZXJpYWxpc2VGaWVsZCB8fCBkZWZhdWx0U2VyaWFsaXNlcjtcbiAgICAgICAgICBzZXJpYWxpc2VyID0gc2VyaWFsaXNlRmllbGQuYmluZCh0aGlzLCBhdHRyTmFtZSk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHZhbCA9IHRoaXNbYXR0ck5hbWVdO1xuICAgICAgICBpZiAodmFsID09PSBudWxsKSB7XG4gICAgICAgICAgaWYgKGluY2x1ZGVOdWxsQXR0cmlidXRlcykge1xuICAgICAgICAgICAgc2VyaWFsaXNlZFthdHRyTmFtZV0gPSBzZXJpYWxpc2VyKHZhbCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHZhbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgc2VyaWFsaXNlZFthdHRyTmFtZV0gPSBzZXJpYWxpc2VyKHZhbCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpO1xuICAgIHRoaXMuX3JlbGF0aW9uc2hpcE5hbWVzLmZvckVhY2goZnVuY3Rpb24ocmVsTmFtZSkge1xuICAgICAgaWYgKHNlcmlhbGlzYWJsZUZpZWxkcy5pbmRleE9mKHJlbE5hbWUpID4gLTEpIHtcbiAgICAgICAgdmFyIHZhbCA9IHRoaXNbcmVsTmFtZV0sXG4gICAgICAgICAgcmVsID0gdGhpcy5tb2RlbC5yZWxhdGlvbnNoaXBzW3JlbE5hbWVdO1xuXG4gICAgICAgIGlmIChyZWwgJiYgIXJlbC5pc1JldmVyc2UpIHtcbiAgICAgICAgICB2YXIgc2VyaWFsaXNlcjtcbiAgICAgICAgICBpZiAocmVsLnNlcmlhbGlzZSkge1xuICAgICAgICAgICAgc2VyaWFsaXNlciA9IHJlbC5zZXJpYWxpc2UuYmluZCh0aGlzKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB2YXIgc2VyaWFsaXNlRmllbGQgPSB0aGlzLm1vZGVsLnNlcmlhbGlzZUZpZWxkO1xuICAgICAgICAgICAgaWYgKCFzZXJpYWxpc2VGaWVsZCkge1xuICAgICAgICAgICAgICBpZiAodXRpbC5pc0FycmF5KHZhbCkpIHZhbCA9IHV0aWwucGx1Y2sodmFsLCB0aGlzLm1vZGVsLmlkKTtcbiAgICAgICAgICAgICAgZWxzZSBpZiAodmFsKSB2YWwgPSB2YWxbdGhpcy5tb2RlbC5pZF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzZXJpYWxpc2VGaWVsZCA9IHNlcmlhbGlzZUZpZWxkIHx8IGRlZmF1bHRTZXJpYWxpc2VyO1xuICAgICAgICAgICAgc2VyaWFsaXNlciA9IHNlcmlhbGlzZUZpZWxkLmJpbmQodGhpcywgcmVsTmFtZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICh2YWwgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGlmIChpbmNsdWRlTnVsbFJlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgICAgICAgc2VyaWFsaXNlZFtyZWxOYW1lXSA9IHNlcmlhbGlzZXIodmFsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSBpZiAodXRpbC5pc0FycmF5KHZhbCkpIHtcbiAgICAgICAgICAgIGlmICgoaW5jbHVkZU51bGxSZWxhdGlvbnNoaXBzICYmICF2YWwubGVuZ3RoKSB8fCB2YWwubGVuZ3RoKSB7XG4gICAgICAgICAgICAgIHNlcmlhbGlzZWRbcmVsTmFtZV0gPSBzZXJpYWxpc2VyKHZhbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2UgaWYgKHZhbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBzZXJpYWxpc2VkW3JlbE5hbWVdID0gc2VyaWFsaXNlcih2YWwpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG4gICAgcmV0dXJuIHNlcmlhbGlzZWQ7XG4gIH0sXG4gIHNlcmlhbGlzZTogZnVuY3Rpb24ob3B0cykge1xuICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgIGlmICghdGhpcy5tb2RlbC5zZXJpYWxpc2UpIHJldHVybiB0aGlzLl9kZWZhdWx0U2VyaWFsaXNlKG9wdHMpO1xuICAgIGVsc2UgcmV0dXJuIHRoaXMubW9kZWwuc2VyaWFsaXNlKHRoaXMsIG9wdHMpO1xuICB9XG59KTtcblxudXRpbC5leHRlbmQoTW9kZWxJbnN0YW5jZS5wcm90b3R5cGUsIHtcbiAgLyoqXG4gICAqIEVtaXQgYW4gZXZlbnQgaW5kaWNhdGluZyB0aGF0IHRoaXMgaW5zdGFuY2UgaGFzIGp1c3QgYmVlbiBjcmVhdGVkLlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2VtaXROZXc6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuYXBwLmJyb2FkY2FzdCh7XG4gICAgICBjb2xsZWN0aW9uOiB0aGlzLm1vZGVsLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgbW9kZWw6IHRoaXMubW9kZWwubmFtZSxcbiAgICAgIGxvY2FsSWQ6IHRoaXMubG9jYWxJZCxcbiAgICAgIG5ldzogdGhpcyxcbiAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLk5ldyxcbiAgICAgIG9iajogdGhpc1xuICAgIH0pO1xuICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBNb2RlbEluc3RhbmNlO1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvTW9kZWxJbnN0YW5jZS5qc1xuICoqIG1vZHVsZSBpZCA9IDE4XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgTW9kZWxJbnN0YW5jZSA9IHJlcXVpcmUoJy4vTW9kZWxJbnN0YW5jZScpLFxuICBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdncmFwaCcpLFxuICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG5cbmZ1bmN0aW9uIFNpZXN0YUVycm9yKG9wdHMpIHtcbiAgdGhpcy5vcHRzID0gb3B0cztcbn1cblxuU2llc3RhRXJyb3IucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBKU09OLnN0cmluZ2lmeSh0aGlzLm9wdHMsIG51bGwsIDQpO1xufTtcblxuLyoqXG4gKiBFbmNhcHN1bGF0ZXMgdGhlIGlkZWEgb2YgbWFwcGluZyBhcnJheXMgb2YgZGF0YSBvbnRvIHRoZSBvYmplY3QgZ3JhcGggb3IgYXJyYXlzIG9mIG9iamVjdHMuXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICogQHBhcmFtIG9wdHMubW9kZWxcbiAqIEBwYXJhbSBvcHRzLmRhdGFcbiAqIEBwYXJhbSBvcHRzLm9iamVjdHNcbiAqIEBwYXJhbSBvcHRzLmRpc2FibGVOb3RpZmljYXRpb25zXG4gKi9cbmZ1bmN0aW9uIE1hcHBpbmdPcGVyYXRpb24ob3B0cykge1xuICB0aGlzLl9vcHRzID0gb3B0cztcblxuICB1dGlsLmV4dGVuZEZyb21PcHRzKHRoaXMsIG9wdHMsIHtcbiAgICBtb2RlbDogbnVsbCxcbiAgICBkYXRhOiBudWxsLFxuICAgIG9iamVjdHM6IFtdLFxuICAgIGRpc2FibGVldmVudHM6IGZhbHNlLFxuICAgIF9pZ25vcmVJbnN0YWxsZWQ6IGZhbHNlLFxuICAgIGZyb21TdG9yYWdlOiBmYWxzZVxuICB9KTtcblxuICB1dGlsLmV4dGVuZCh0aGlzLCB7XG4gICAgZXJyb3JzOiBbXSxcbiAgICBzdWJUYXNrUmVzdWx0czoge30sXG4gICAgX25ld09iamVjdHM6IFtdXG4gIH0pO1xuXG4gIHRoaXMubW9kZWwuX2luc3RhbGxSZXZlcnNlUGxhY2Vob2xkZXJzKCk7XG4gIHRoaXMuZGF0YSA9IHRoaXMucHJlcHJvY2Vzc0RhdGEoKTtcbn1cblxudXRpbC5leHRlbmQoTWFwcGluZ09wZXJhdGlvbi5wcm90b3R5cGUsIHtcbiAgbWFwQXR0cmlidXRlczogZnVuY3Rpb24oKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBkYXR1bSA9IHRoaXMuZGF0YVtpXSxcbiAgICAgICAgb2JqZWN0ID0gdGhpcy5vYmplY3RzW2ldO1xuICAgICAgLy8gTm8gcG9pbnQgbWFwcGluZyBvYmplY3Qgb250byBpdHNlbGYuIFRoaXMgaGFwcGVucyBpZiBhIE1vZGVsSW5zdGFuY2UgaXMgcGFzc2VkIGFzIGEgcmVsYXRpb25zaGlwLlxuICAgICAgaWYgKGRhdHVtICE9IG9iamVjdCkge1xuICAgICAgICBpZiAob2JqZWN0KSB7IC8vIElmIG9iamVjdCBpcyBmYWxzeSwgdGhlbiB0aGVyZSB3YXMgYW4gZXJyb3IgbG9va2luZyB1cCB0aGF0IG9iamVjdC9jcmVhdGluZyBpdC5cbiAgICAgICAgICB2YXIgZmllbGRzID0gdGhpcy5tb2RlbC5fYXR0cmlidXRlTmFtZXM7XG4gICAgICAgICAgZmllbGRzLmZvckVhY2goZnVuY3Rpb24oZikge1xuICAgICAgICAgICAgaWYgKGRhdHVtW2ZdICE9PSB1bmRlZmluZWQpIHsgLy8gbnVsbCBpcyBmaW5lXG4gICAgICAgICAgICAgIC8vIElmIGV2ZW50cyBhcmUgZGlzYWJsZWQgd2UgdXBkYXRlIF9fdmFsdWVzIG9iamVjdCBkaXJlY3RseS4gVGhpcyBhdm9pZHMgdHJpZ2dlcmluZ1xuICAgICAgICAgICAgICAvLyBldmVudHMgd2hpY2ggYXJlIGJ1aWx0IGludG8gdGhlIHNldCBmdW5jdGlvbiBvZiB0aGUgcHJvcGVydHkuXG4gICAgICAgICAgICAgIGlmICh0aGlzLmRpc2FibGVldmVudHMpIHtcbiAgICAgICAgICAgICAgICBvYmplY3QuX192YWx1ZXNbZl0gPSBkYXR1bVtmXTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgb2JqZWN0W2ZdID0gZGF0dW1bZl07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICB0aGlzLmVycm9yc1tpXSA9IGU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAvLyBQb3VjaERCIHJldmlzaW9uIChpZiB1c2luZyBzdG9yYWdlIG1vZHVsZSkuXG4gICAgICAgICAgLy8gVE9ETzogQ2FuIHRoaXMgYmUgcHVsbGVkIG91dCBvZiBjb3JlP1xuICAgICAgICAgIGlmIChkYXR1bS5fcmV2KSBvYmplY3QuX3JldiA9IGRhdHVtLl9yZXY7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIF9tYXA6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgZXJyO1xuICAgIHRoaXMubWFwQXR0cmlidXRlcygpO1xuICAgIHZhciByZWxhdGlvbnNoaXBGaWVsZHMgPSBPYmplY3Qua2V5cyhzZWxmLnN1YlRhc2tSZXN1bHRzKTtcbiAgICByZWxhdGlvbnNoaXBGaWVsZHMuZm9yRWFjaChmdW5jdGlvbihmKSB7XG4gICAgICB2YXIgcmVzID0gc2VsZi5zdWJUYXNrUmVzdWx0c1tmXTtcbiAgICAgIHZhciBpbmRleGVzID0gcmVzLmluZGV4ZXMsXG4gICAgICAgIG9iamVjdHMgPSByZXMub2JqZWN0cztcbiAgICAgIHZhciByZWxhdGVkRGF0YSA9IHNlbGYuZ2V0UmVsYXRlZERhdGEoZikucmVsYXRlZERhdGE7XG4gICAgICB2YXIgdW5mbGF0dGVuZWRPYmplY3RzID0gdXRpbC51bmZsYXR0ZW5BcnJheShvYmplY3RzLCByZWxhdGVkRGF0YSk7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHVuZmxhdHRlbmVkT2JqZWN0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgaWR4ID0gaW5kZXhlc1tpXTtcbiAgICAgICAgLy8gRXJyb3JzIGFyZSBwbHVja2VkIGZyb20gdGhlIHN1Ym9wZXJhdGlvbnMuXG4gICAgICAgIHZhciBlcnJvciA9IHNlbGYuZXJyb3JzW2lkeF07XG4gICAgICAgIGVyciA9IGVycm9yID8gZXJyb3JbZl0gOiBudWxsO1xuICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgIHZhciByZWxhdGVkID0gdW5mbGF0dGVuZWRPYmplY3RzW2ldOyAvLyBDYW4gYmUgYXJyYXkgb3Igc2NhbGFyLlxuICAgICAgICAgIHZhciBvYmplY3QgPSBzZWxmLm9iamVjdHNbaWR4XTtcbiAgICAgICAgICBpZiAob2JqZWN0KSB7XG4gICAgICAgICAgICBlcnIgPSBvYmplY3QuX19wcm94aWVzW2ZdLnNldChyZWxhdGVkLCB7XG4gICAgICAgICAgICAgIGRpc2FibGVldmVudHM6IHNlbGYuZGlzYWJsZWV2ZW50c1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgIGlmICghc2VsZi5lcnJvcnNbaWR4XSkgc2VsZi5lcnJvcnNbaWR4XSA9IHt9O1xuICAgICAgICAgICAgICBzZWxmLmVycm9yc1tpZHhdW2ZdID0gZXJyO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9LFxuICAvKipcbiAgICogRmlndXJlIG91dCB3aGljaCBkYXRhIGl0ZW1zIHJlcXVpcmUgYSBjYWNoZSBsb29rdXAuXG4gICAqIEByZXR1cm5zIHt7cmVtb3RlTG9va3VwczogQXJyYXksIGxvY2FsTG9va3VwczogQXJyYXl9fVxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3NvcnRMb29rdXBzOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgcmVtb3RlTG9va3VwcyA9IFtdO1xuICAgIHZhciBsb2NhbExvb2t1cHMgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKCF0aGlzLm9iamVjdHNbaV0pIHtcbiAgICAgICAgdmFyIGxvb2t1cDtcbiAgICAgICAgdmFyIGRhdHVtID0gdGhpcy5kYXRhW2ldO1xuICAgICAgICB2YXIgaXNTY2FsYXIgPSB0eXBlb2YgZGF0dW0gPT0gJ3N0cmluZycgfHwgdHlwZW9mIGRhdHVtID09ICdudW1iZXInIHx8IGRhdHVtIGluc3RhbmNlb2YgU3RyaW5nO1xuICAgICAgICBpZiAoZGF0dW0pIHtcbiAgICAgICAgICBpZiAoaXNTY2FsYXIpIHtcbiAgICAgICAgICAgIGxvb2t1cCA9IHtcbiAgICAgICAgICAgICAgaW5kZXg6IGksXG4gICAgICAgICAgICAgIGRhdHVtOiB7fVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGxvb2t1cC5kYXR1bVt0aGlzLm1vZGVsLmlkXSA9IGRhdHVtO1xuICAgICAgICAgICAgcmVtb3RlTG9va3Vwcy5wdXNoKGxvb2t1cCk7XG4gICAgICAgICAgfSBlbHNlIGlmIChkYXR1bSBpbnN0YW5jZW9mIE1vZGVsSW5zdGFuY2UpIHsgLy8gV2Ugd29uJ3QgbmVlZCB0byBwZXJmb3JtIGFueSBtYXBwaW5nLlxuICAgICAgICAgICAgdGhpcy5vYmplY3RzW2ldID0gZGF0dW07XG4gICAgICAgICAgfSBlbHNlIGlmIChkYXR1bS5sb2NhbElkKSB7XG4gICAgICAgICAgICBsb2NhbExvb2t1cHMucHVzaCh7XG4gICAgICAgICAgICAgIGluZGV4OiBpLFxuICAgICAgICAgICAgICBkYXR1bTogZGF0dW1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0gZWxzZSBpZiAoZGF0dW1bdGhpcy5tb2RlbC5pZF0pIHtcbiAgICAgICAgICAgIHJlbW90ZUxvb2t1cHMucHVzaCh7XG4gICAgICAgICAgICAgIGluZGV4OiBpLFxuICAgICAgICAgICAgICBkYXR1bTogZGF0dW1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLm9iamVjdHNbaV0gPSB0aGlzLl9pbnN0YW5jZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLm9iamVjdHNbaV0gPSBudWxsO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7cmVtb3RlTG9va3VwczogcmVtb3RlTG9va3VwcywgbG9jYWxMb29rdXBzOiBsb2NhbExvb2t1cHN9O1xuICB9LFxuICBfcGVyZm9ybUxvY2FsTG9va3VwczogZnVuY3Rpb24obG9jYWxMb29rdXBzKSB7XG4gICAgdmFyIGNhY2hlID0gdGhpcy5tb2RlbC5hcHAuY2FjaGU7XG4gICAgdmFyIGxvY2FsSWRlbnRpZmllcnMgPSB1dGlsLnBsdWNrKHV0aWwucGx1Y2sobG9jYWxMb29rdXBzLCAnZGF0dW0nKSwgJ2xvY2FsSWQnKSxcbiAgICAgIGxvY2FsT2JqZWN0cyA9IGNhY2hlLmdldFZpYUxvY2FsSWQobG9jYWxJZGVudGlmaWVycyk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsb2NhbElkZW50aWZpZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgb2JqID0gbG9jYWxPYmplY3RzW2ldO1xuICAgICAgdmFyIGxvY2FsSWQgPSBsb2NhbElkZW50aWZpZXJzW2ldO1xuICAgICAgdmFyIGxvb2t1cCA9IGxvY2FsTG9va3Vwc1tpXTtcbiAgICAgIGlmICghb2JqKSB7XG4gICAgICAgIC8vIElmIHRoZXJlIGFyZSBtdWx0aXBsZSBtYXBwaW5nIG9wZXJhdGlvbnMgZ29pbmcgb24sIHRoZXJlIG1heSBiZVxuICAgICAgICBvYmogPSBjYWNoZS5nZXQoe2xvY2FsSWQ6IGxvY2FsSWR9KTtcbiAgICAgICAgaWYgKCFvYmopIG9iaiA9IHRoaXMuX2luc3RhbmNlKHtsb2NhbElkOiBsb2NhbElkfSwgIXRoaXMuZGlzYWJsZWV2ZW50cyk7XG4gICAgICAgIHRoaXMub2JqZWN0c1tsb29rdXAuaW5kZXhdID0gb2JqO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5vYmplY3RzW2xvb2t1cC5pbmRleF0gPSBvYmo7XG4gICAgICB9XG4gICAgfVxuXG4gIH0sXG4gIF9wZXJmb3JtUmVtb3RlTG9va3VwczogZnVuY3Rpb24ocmVtb3RlTG9va3Vwcykge1xuICAgIHZhciBjYWNoZSA9IHRoaXMubW9kZWwuYXBwLmNhY2hlO1xuICAgIHZhciByZW1vdGVJZGVudGlmaWVycyA9IHV0aWwucGx1Y2sodXRpbC5wbHVjayhyZW1vdGVMb29rdXBzLCAnZGF0dW0nKSwgdGhpcy5tb2RlbC5pZCksXG4gICAgICByZW1vdGVPYmplY3RzID0gY2FjaGUuZ2V0VmlhUmVtb3RlSWQocmVtb3RlSWRlbnRpZmllcnMsIHttb2RlbDogdGhpcy5tb2RlbH0pO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVtb3RlT2JqZWN0cy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIG9iaiA9IHJlbW90ZU9iamVjdHNbaV0sXG4gICAgICAgIGxvb2t1cCA9IHJlbW90ZUxvb2t1cHNbaV07XG4gICAgICBpZiAob2JqKSB7XG4gICAgICAgIHRoaXMub2JqZWN0c1tsb29rdXAuaW5kZXhdID0gb2JqO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGRhdGEgPSB7fTtcbiAgICAgICAgdmFyIHJlbW90ZUlkID0gcmVtb3RlSWRlbnRpZmllcnNbaV07XG4gICAgICAgIGRhdGFbdGhpcy5tb2RlbC5pZF0gPSByZW1vdGVJZDtcbiAgICAgICAgdmFyIGNhY2hlUXVlcnkgPSB7XG4gICAgICAgICAgbW9kZWw6IHRoaXMubW9kZWxcbiAgICAgICAgfTtcbiAgICAgICAgY2FjaGVRdWVyeVt0aGlzLm1vZGVsLmlkXSA9IHJlbW90ZUlkO1xuICAgICAgICB2YXIgY2FjaGVkID0gY2FjaGUuZ2V0KGNhY2hlUXVlcnkpO1xuICAgICAgICBpZiAoY2FjaGVkKSB7XG4gICAgICAgICAgdGhpcy5vYmplY3RzW2xvb2t1cC5pbmRleF0gPSBjYWNoZWQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5vYmplY3RzW2xvb2t1cC5pbmRleF0gPSB0aGlzLl9pbnN0YW5jZSgpO1xuICAgICAgICAgIC8vIEl0J3MgaW1wb3J0YW50IHRoYXQgd2UgbWFwIHRoZSByZW1vdGUgaWRlbnRpZmllciBoZXJlIHRvIGVuc3VyZSB0aGF0IGl0IGVuZHNcbiAgICAgICAgICAvLyB1cCBpbiB0aGUgY2FjaGUuXG4gICAgICAgICAgdGhpcy5vYmplY3RzW2xvb2t1cC5pbmRleF1bdGhpcy5tb2RlbC5pZF0gPSByZW1vdGVJZDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgLyoqXG4gICAqIEZvciBpbmRpY2VzIHdoZXJlIG5vIG9iamVjdCBpcyBwcmVzZW50LCBwZXJmb3JtIGNhY2hlIGxvb2t1cHMsIGNyZWF0aW5nIGEgbmV3IG9iamVjdCBpZiBuZWNlc3NhcnkuXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfbG9va3VwOiBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5tb2RlbC5zaW5nbGV0b24pIHtcbiAgICAgIHRoaXMuX2xvb2t1cFNpbmdsZXRvbigpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHZhciBsb29rdXBzID0gdGhpcy5fc29ydExvb2t1cHMoKSxcbiAgICAgICAgcmVtb3RlTG9va3VwcyA9IGxvb2t1cHMucmVtb3RlTG9va3VwcyxcbiAgICAgICAgbG9jYWxMb29rdXBzID0gbG9va3Vwcy5sb2NhbExvb2t1cHM7XG4gICAgICB0aGlzLl9wZXJmb3JtTG9jYWxMb29rdXBzKGxvY2FsTG9va3Vwcyk7XG4gICAgICB0aGlzLl9wZXJmb3JtUmVtb3RlTG9va3VwcyhyZW1vdGVMb29rdXBzKTtcbiAgICB9XG4gIH0sXG4gIF9sb29rdXBTaW5nbGV0b246IGZ1bmN0aW9uKCkge1xuICAgIC8vIFBpY2sgYSByYW5kb20gbG9jYWxJZCBmcm9tIHRoZSBhcnJheSBvZiBkYXRhIGJlaW5nIG1hcHBlZCBvbnRvIHRoZSBzaW5nbGV0b24gb2JqZWN0LiBOb3RlIHRoYXQgdGhleSBzaG91bGRcbiAgICAvLyBhbHdheXMgYmUgdGhlIHNhbWUuIFRoaXMgaXMganVzdCBhIHByZWNhdXRpb24uXG4gICAgdmFyIGxvY2FsSWRlbnRpZmllcnMgPSB1dGlsLnBsdWNrKHRoaXMuZGF0YSwgJ2xvY2FsSWQnKSwgbG9jYWxJZDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbG9jYWxJZGVudGlmaWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGxvY2FsSWRlbnRpZmllcnNbaV0pIHtcbiAgICAgICAgbG9jYWxJZCA9IHtsb2NhbElkOiBsb2NhbElkZW50aWZpZXJzW2ldfTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIFRoZSBtYXBwaW5nIG9wZXJhdGlvbiBpcyByZXNwb25zaWJsZSBmb3IgY3JlYXRpbmcgc2luZ2xldG9uIGluc3RhbmNlcyBpZiB0aGV5IGRvIG5vdCBhbHJlYWR5IGV4aXN0LlxuICAgIHZhciBzaW5nbGV0b24gPSB0aGlzLm1vZGVsLmFwcC5jYWNoZS5nZXRTaW5nbGV0b24odGhpcy5tb2RlbCkgfHwgdGhpcy5faW5zdGFuY2UobG9jYWxJZCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgIHRoaXMub2JqZWN0c1tpXSA9IHNpbmdsZXRvbjtcbiAgICB9XG4gIH0sXG4gIF9pbnN0YW5jZTogZnVuY3Rpb24oKSB7XG4gICAgdmFyIG1vZGVsID0gdGhpcy5tb2RlbCxcbiAgICAgIG1vZGVsSW5zdGFuY2UgPSBtb2RlbC5faW5zdGFuY2UuYXBwbHkobW9kZWwsIGFyZ3VtZW50cyk7XG4gICAgdGhpcy5fbmV3T2JqZWN0cy5wdXNoKG1vZGVsSW5zdGFuY2UpO1xuICAgIHJldHVybiBtb2RlbEluc3RhbmNlO1xuICB9LFxuXG4gIHByZXByb2Nlc3NEYXRhOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgZGF0YSA9IHV0aWwuZXh0ZW5kKFtdLCB0aGlzLmRhdGEpO1xuICAgIHJldHVybiBkYXRhLm1hcChmdW5jdGlvbihkYXR1bSkge1xuICAgICAgaWYgKGRhdHVtKSB7XG4gICAgICAgIGlmICghdXRpbC5pc1N0cmluZyhkYXR1bSkpIHtcbiAgICAgICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKGRhdHVtKTtcbiAgICAgICAgICBrZXlzLmZvckVhY2goZnVuY3Rpb24oaykge1xuICAgICAgICAgICAgdmFyIGlzUmVsYXRpb25zaGlwID0gdGhpcy5tb2RlbC5fcmVsYXRpb25zaGlwTmFtZXMuaW5kZXhPZihrKSA+IC0xO1xuXG4gICAgICAgICAgICBpZiAoaXNSZWxhdGlvbnNoaXApIHtcbiAgICAgICAgICAgICAgdmFyIHZhbCA9IGRhdHVtW2tdO1xuICAgICAgICAgICAgICBpZiAodmFsIGluc3RhbmNlb2YgTW9kZWxJbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgIGRhdHVtW2tdID0ge2xvY2FsSWQ6IHZhbC5sb2NhbElkfTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGRhdHVtO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG4gIHN0YXJ0OiBmdW5jdGlvbihkb25lKSB7XG4gICAgdmFyIGRhdGEgPSB0aGlzLmRhdGE7XG4gICAgaWYgKGRhdGEubGVuZ3RoKSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICB2YXIgdGFza3MgPSBbXTtcbiAgICAgIHRoaXMuX2xvb2t1cCgpO1xuICAgICAgdGFza3MucHVzaCh0aGlzLl9leGVjdXRlU3ViT3BlcmF0aW9ucy5iaW5kKHRoaXMpKTtcbiAgICAgIHV0aWwucGFyYWxsZWwodGFza3MsIGZ1bmN0aW9uKGVycikge1xuICAgICAgICBpZiAoZXJyKSBjb25zb2xlLmVycm9yKGVycik7XG5cbiAgICAgICAgc2VsZi5fbWFwKCk7XG4gICAgICAgIC8vIFVzZXJzIGFyZSBhbGxvd2VkIHRvIGFkZCBhIGN1c3RvbSBpbml0IG1ldGhvZCB0byB0aGUgbWV0aG9kcyBvYmplY3Qgd2hlbiBkZWZpbmluZyBhIE1vZGVsLCBvZiB0aGUgZm9ybTpcbiAgICAgICAgLy9cbiAgICAgICAgLy9cbiAgICAgICAgLy8gaW5pdDogZnVuY3Rpb24gKFtkb25lXSkge1xuICAgICAgICAvLyAgICAgLy8gLi4uXG4gICAgICAgIC8vICB9XG4gICAgICAgIC8vXG4gICAgICAgIC8vXG4gICAgICAgIC8vIElmIGRvbmUgaXMgcGFzc2VkLCB0aGVuIF9faW5pdCBtdXN0IGJlIGV4ZWN1dGVkIGFzeW5jaHJvbm91c2x5LCBhbmQgdGhlIG1hcHBpbmcgb3BlcmF0aW9uIHdpbGwgbm90XG4gICAgICAgIC8vIGZpbmlzaCB1bnRpbCBhbGwgaW5pdHMgaGF2ZSBleGVjdXRlZC5cbiAgICAgICAgLy9cbiAgICAgICAgLy8gSGVyZSB3ZSBlbnN1cmUgdGhlIGV4ZWN1dGlvbiBvZiBhbGwgb2YgdGhlbVxuICAgICAgICB2YXIgZnJvbVN0b3JhZ2UgPSB0aGlzLmZyb21TdG9yYWdlO1xuICAgICAgICB2YXIgaW5pdFRhc2tzID0gc2VsZi5fbmV3T2JqZWN0cy5yZWR1Y2UoZnVuY3Rpb24obWVtbywgbykge1xuICAgICAgICAgIHZhciBpbml0ID0gby5tb2RlbC5pbml0O1xuICAgICAgICAgIGlmIChpbml0KSB7XG4gICAgICAgICAgICB2YXIgcGFyYW1OYW1lcyA9IHV0aWwucGFyYW1OYW1lcyhpbml0KTtcbiAgICAgICAgICAgIGlmIChwYXJhbU5hbWVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgbWVtby5wdXNoKGluaXQuYmluZChvLCBmcm9tU3RvcmFnZSwgZG9uZSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIGluaXQuY2FsbChvLCBmcm9tU3RvcmFnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIG8uX2VtaXRFdmVudHMgPSB0cnVlO1xuICAgICAgICAgIG8uX2VtaXROZXcoKTtcbiAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgfSwgW10pO1xuICAgICAgICB1dGlsLnBhcmFsbGVsKGluaXRUYXNrcywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgZG9uZShzZWxmLmVycm9ycy5sZW5ndGggPyBzZWxmLmVycm9ycyA6IG51bGwsIHNlbGYub2JqZWN0cyk7XG4gICAgICAgIH0pO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZG9uZShudWxsLCBbXSk7XG4gICAgfVxuXG4gIH0sXG4gIGdldFJlbGF0ZWREYXRhOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIGluZGV4ZXMgPSBbXTtcbiAgICB2YXIgcmVsYXRlZERhdGEgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGRhdHVtID0gdGhpcy5kYXRhW2ldO1xuICAgICAgaWYgKGRhdHVtKSB7XG4gICAgICAgIHZhciB2YWwgPSBkYXR1bVtuYW1lXTtcbiAgICAgICAgaWYgKHZhbCkge1xuICAgICAgICAgIGluZGV4ZXMucHVzaChpKTtcbiAgICAgICAgICByZWxhdGVkRGF0YS5wdXNoKHZhbCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIGluZGV4ZXM6IGluZGV4ZXMsXG4gICAgICByZWxhdGVkRGF0YTogcmVsYXRlZERhdGFcbiAgICB9O1xuICB9LFxuICBwcm9jZXNzRXJyb3JzRnJvbVRhc2s6IGZ1bmN0aW9uKHJlbGF0aW9uc2hpcE5hbWUsIGVycm9ycywgaW5kZXhlcykge1xuICAgIGlmIChlcnJvcnMubGVuZ3RoKSB7XG4gICAgICB2YXIgcmVsYXRlZERhdGEgPSB0aGlzLmdldFJlbGF0ZWREYXRhKHJlbGF0aW9uc2hpcE5hbWUpLnJlbGF0ZWREYXRhO1xuICAgICAgdmFyIHVuZmxhdHRlbmVkRXJyb3JzID0gdXRpbC51bmZsYXR0ZW5BcnJheShlcnJvcnMsIHJlbGF0ZWREYXRhKTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdW5mbGF0dGVuZWRFcnJvcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGlkeCA9IGluZGV4ZXNbaV07XG4gICAgICAgIHZhciBlcnIgPSB1bmZsYXR0ZW5lZEVycm9yc1tpXTtcbiAgICAgICAgdmFyIGlzRXJyb3IgPSBlcnI7XG4gICAgICAgIGlmICh1dGlsLmlzQXJyYXkoZXJyKSkgaXNFcnJvciA9IGVyci5yZWR1Y2UoZnVuY3Rpb24obWVtbywgeCkge1xuICAgICAgICAgIHJldHVybiBtZW1vIHx8IHhcbiAgICAgICAgfSwgZmFsc2UpO1xuICAgICAgICBpZiAoaXNFcnJvcikge1xuICAgICAgICAgIGlmICghdGhpcy5lcnJvcnNbaWR4XSkgdGhpcy5lcnJvcnNbaWR4XSA9IHt9O1xuICAgICAgICAgIHRoaXMuZXJyb3JzW2lkeF1bcmVsYXRpb25zaGlwTmFtZV0gPSBlcnI7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIF9leGVjdXRlU3ViT3BlcmF0aW9uczogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICB2YXIgc2VsZiA9IHRoaXMsXG4gICAgICByZWxhdGlvbnNoaXBOYW1lcyA9IE9iamVjdC5rZXlzKHRoaXMubW9kZWwucmVsYXRpb25zaGlwcyk7XG4gICAgaWYgKHJlbGF0aW9uc2hpcE5hbWVzLmxlbmd0aCkge1xuICAgICAgdmFyIHRhc2tzID0gcmVsYXRpb25zaGlwTmFtZXMucmVkdWNlKGZ1bmN0aW9uKG0sIHJlbGF0aW9uc2hpcE5hbWUpIHtcbiAgICAgICAgdmFyIHJlbGF0aW9uc2hpcCA9IHNlbGYubW9kZWwucmVsYXRpb25zaGlwc1tyZWxhdGlvbnNoaXBOYW1lXTtcbiAgICAgICAgdmFyIHJldmVyc2VNb2RlbCA9IHJlbGF0aW9uc2hpcC5mb3J3YXJkTmFtZSA9PSByZWxhdGlvbnNoaXBOYW1lID8gcmVsYXRpb25zaGlwLnJldmVyc2VNb2RlbCA6IHJlbGF0aW9uc2hpcC5mb3J3YXJkTW9kZWw7XG4gICAgICAgIC8vIE1vY2sgYW55IG1pc3Npbmcgc2luZ2xldG9uIGRhdGEgdG8gZW5zdXJlIHRoYXQgYWxsIHNpbmdsZXRvbiBpbnN0YW5jZXMgYXJlIGNyZWF0ZWQuXG4gICAgICAgIGlmIChyZXZlcnNlTW9kZWwuc2luZ2xldG9uICYmICFyZWxhdGlvbnNoaXAuaXNSZXZlcnNlKSB7XG4gICAgICAgICAgdGhpcy5kYXRhLmZvckVhY2goZnVuY3Rpb24oZGF0dW0pIHtcbiAgICAgICAgICAgIGlmICghZGF0dW1bcmVsYXRpb25zaGlwTmFtZV0pIGRhdHVtW3JlbGF0aW9uc2hpcE5hbWVdID0ge307XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIF9fcmV0ID0gdGhpcy5nZXRSZWxhdGVkRGF0YShyZWxhdGlvbnNoaXBOYW1lKSxcbiAgICAgICAgICBpbmRleGVzID0gX19yZXQuaW5kZXhlcyxcbiAgICAgICAgICByZWxhdGVkRGF0YSA9IF9fcmV0LnJlbGF0ZWREYXRhO1xuICAgICAgICBpZiAocmVsYXRlZERhdGEubGVuZ3RoKSB7XG4gICAgICAgICAgdmFyIGZsYXRSZWxhdGVkRGF0YSA9IHV0aWwuZmxhdHRlbkFycmF5KHJlbGF0ZWREYXRhKTtcbiAgICAgICAgICB2YXIgb3AgPSBuZXcgTWFwcGluZ09wZXJhdGlvbih7XG4gICAgICAgICAgICBtb2RlbDogcmV2ZXJzZU1vZGVsLFxuICAgICAgICAgICAgZGF0YTogZmxhdFJlbGF0ZWREYXRhLFxuICAgICAgICAgICAgZGlzYWJsZWV2ZW50czogc2VsZi5kaXNhYmxlZXZlbnRzLFxuICAgICAgICAgICAgX2lnbm9yZUluc3RhbGxlZDogc2VsZi5faWdub3JlSW5zdGFsbGVkLFxuICAgICAgICAgICAgZnJvbVN0b3JhZ2U6IHRoaXMuZnJvbVN0b3JhZ2VcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcCkge1xuICAgICAgICAgIHZhciB0YXNrO1xuICAgICAgICAgIHRhc2sgPSBmdW5jdGlvbihkb25lKSB7XG4gICAgICAgICAgICBvcC5zdGFydChmdW5jdGlvbihlcnJvcnMsIG9iamVjdHMpIHtcbiAgICAgICAgICAgICAgc2VsZi5zdWJUYXNrUmVzdWx0c1tyZWxhdGlvbnNoaXBOYW1lXSA9IHtcbiAgICAgICAgICAgICAgICBlcnJvcnM6IGVycm9ycyxcbiAgICAgICAgICAgICAgICBvYmplY3RzOiBvYmplY3RzLFxuICAgICAgICAgICAgICAgIGluZGV4ZXM6IGluZGV4ZXNcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgc2VsZi5wcm9jZXNzRXJyb3JzRnJvbVRhc2socmVsYXRpb25zaGlwTmFtZSwgb3AuZXJyb3JzLCBpbmRleGVzKTtcbiAgICAgICAgICAgICAgZG9uZSgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfTtcbiAgICAgICAgICBtLnB1c2godGFzayk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG07XG4gICAgICB9LmJpbmQodGhpcyksIFtdKTtcbiAgICAgIHV0aWwucGFyYWxsZWwodGFza3MsIGZ1bmN0aW9uKGVycikge1xuICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNhbGxiYWNrKCk7XG4gICAgfVxuICB9XG59KVxuO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1hcHBpbmdPcGVyYXRpb247XG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9tYXBwaW5nT3BlcmF0aW9uLmpzXG4gKiogbW9kdWxlIGlkID0gMTlcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciBBcnJheU9ic2VydmVyID0gcmVxdWlyZSgnLi4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUnKS5BcnJheU9ic2VydmVyLFxuICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gIGFyZ3NhcnJheSA9IHJlcXVpcmUoJ2FyZ3NhcnJheScpLFxuICBtb2RlbEV2ZW50cyA9IHJlcXVpcmUoJy4vbW9kZWxFdmVudHMnKSxcbiAgQ2hhaW4gPSByZXF1aXJlKCcuL0NoYWluJyk7XG5cblxuLyoqXG4gKiBMaXN0ZW4gdG8gYSBwYXJ0aWN1bGFyIGV2ZW50IGZyb20gdGhlIFNpZXN0YSBnbG9iYWwgRXZlbnRFbWl0dGVyLlxuICogTWFuYWdlcyBpdHMgb3duIHNldCBvZiBsaXN0ZW5lcnMuXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gUHJveHlFdmVudEVtaXR0ZXIoYXBwLCBldmVudCwgY2hhaW5PcHRzKSB7XG4gIGlmICghYXBwKSB0aHJvdyBuZXcgRXJyb3IoJ3d0ZicpO1xuICB1dGlsLmV4dGVuZCh0aGlzLCB7XG4gICAgZXZlbnQ6IGV2ZW50LFxuICAgIGFwcDogYXBwLFxuICAgIGxpc3RlbmVyczoge31cbiAgfSk7XG4gIHZhciBkZWZhdWx0Q2hhaW5PcHRzID0ge307XG5cbiAgZGVmYXVsdENoYWluT3B0cy5vbiA9IHRoaXMub24uYmluZCh0aGlzKTtcbiAgZGVmYXVsdENoYWluT3B0cy5vbmNlID0gdGhpcy5vbmNlLmJpbmQodGhpcyk7XG5cbiAgQ2hhaW4uY2FsbCh0aGlzLCB1dGlsLmV4dGVuZChkZWZhdWx0Q2hhaW5PcHRzLCBjaGFpbk9wdHMgfHwge30pKTtcbn1cblxuUHJveHlFdmVudEVtaXR0ZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShDaGFpbi5wcm90b3R5cGUpO1xuXG51dGlsLmV4dGVuZChQcm94eUV2ZW50RW1pdHRlci5wcm90b3R5cGUsIHtcbiAgb246IGZ1bmN0aW9uKHR5cGUsIGZuKSB7XG4gICAgaWYgKHR5cGVvZiB0eXBlID09ICdmdW5jdGlvbicpIHtcbiAgICAgIGZuID0gdHlwZTtcbiAgICAgIHR5cGUgPSBudWxsO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGlmICh0eXBlLnRyaW0oKSA9PSAnKicpIHR5cGUgPSBudWxsO1xuICAgICAgdmFyIF9mbiA9IGZuO1xuICAgICAgZm4gPSBmdW5jdGlvbihlKSB7XG4gICAgICAgIGUgPSBlIHx8IHt9O1xuICAgICAgICBpZiAodHlwZSkge1xuICAgICAgICAgIGlmIChlLnR5cGUgPT0gdHlwZSkge1xuICAgICAgICAgICAgX2ZuKGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBfZm4oZSk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5saXN0ZW5lcnM7XG4gICAgICBpZiAodHlwZSkge1xuICAgICAgICBpZiAoIWxpc3RlbmVyc1t0eXBlXSkgbGlzdGVuZXJzW3R5cGVdID0gW107XG4gICAgICAgIGxpc3RlbmVyc1t0eXBlXS5wdXNoKGZuKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5hcHAuZXZlbnRzLm9uKHRoaXMuZXZlbnQsIGZuKTtcbiAgICByZXR1cm4gdGhpcy5faGFuZGxlckxpbmsoe1xuICAgICAgZm46IGZuLFxuICAgICAgdHlwZTogdHlwZSxcbiAgICAgIGV4dGVuZDogdGhpcy5wcm94eUNoYWluT3B0c1xuICAgIH0pO1xuICB9LFxuICBvbmNlOiBmdW5jdGlvbih0eXBlLCBmbikge1xuICAgIHZhciBldmVudCA9IHRoaXMuZXZlbnQ7XG4gICAgaWYgKHR5cGVvZiB0eXBlID09ICdmdW5jdGlvbicpIHtcbiAgICAgIGZuID0gdHlwZTtcbiAgICAgIHR5cGUgPSBudWxsO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGlmICh0eXBlLnRyaW0oKSA9PSAnKicpIHR5cGUgPSBudWxsO1xuICAgICAgdmFyIF9mbiA9IGZuO1xuICAgICAgZm4gPSBmdW5jdGlvbihlKSB7XG4gICAgICAgIGUgPSBlIHx8IHt9O1xuICAgICAgICBpZiAodHlwZSkge1xuICAgICAgICAgIGlmIChlLnR5cGUgPT0gdHlwZSkge1xuICAgICAgICAgICAgdGhpcy5hcHAuZXZlbnRzLnJlbW92ZUxpc3RlbmVyKGV2ZW50LCBmbik7XG4gICAgICAgICAgICBfZm4oZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIF9mbihlKTtcbiAgICAgICAgfVxuICAgICAgfS5iaW5kKHRoaXMpXG4gICAgfVxuICAgIGlmICh0eXBlKSByZXR1cm4gdGhpcy5hcHAuZXZlbnRzLm9uKGV2ZW50LCBmbik7XG4gICAgZWxzZSByZXR1cm4gdGhpcy5hcHAuZXZlbnRzLm9uY2UoZXZlbnQsIGZuKTtcbiAgfSxcbiAgX3JlbW92ZUxpc3RlbmVyOiBmdW5jdGlvbihmbiwgdHlwZSkge1xuICAgIGlmICh0eXBlKSB7XG4gICAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5saXN0ZW5lcnNbdHlwZV0sXG4gICAgICAgIGlkeCA9IGxpc3RlbmVycy5pbmRleE9mKGZuKTtcbiAgICAgIGxpc3RlbmVycy5zcGxpY2UoaWR4LCAxKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYXBwLmV2ZW50cy5yZW1vdmVMaXN0ZW5lcih0aGlzLmV2ZW50LCBmbik7XG4gIH0sXG4gIGVtaXQ6IGZ1bmN0aW9uKHR5cGUsIHBheWxvYWQpIHtcbiAgICBpZiAodHlwZW9mIHR5cGUgPT0gJ29iamVjdCcpIHtcbiAgICAgIHBheWxvYWQgPSB0eXBlO1xuICAgICAgdHlwZSA9IG51bGw7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgcGF5bG9hZCA9IHBheWxvYWQgfHwge307XG4gICAgICBwYXlsb2FkLnR5cGUgPSB0eXBlO1xuICAgIH1cbiAgICB0aGlzLmFwcC5ldmVudHMuZW1pdC5jYWxsKHRoaXMuYXBwLmV2ZW50cywgdGhpcy5ldmVudCwgcGF5bG9hZCk7XG4gIH0sXG4gIF9yZW1vdmVBbGxMaXN0ZW5lcnM6IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICAodGhpcy5saXN0ZW5lcnNbdHlwZV0gfHwgW10pLmZvckVhY2goZnVuY3Rpb24oZm4pIHtcbiAgICAgIHRoaXMuYXBwLmV2ZW50cy5yZW1vdmVMaXN0ZW5lcih0aGlzLmV2ZW50LCBmbik7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLmxpc3RlbmVyc1t0eXBlXSA9IFtdO1xuICB9LFxuICByZW1vdmVBbGxMaXN0ZW5lcnM6IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICBpZiAodHlwZSkge1xuICAgICAgdGhpcy5fcmVtb3ZlQWxsTGlzdGVuZXJzKHR5cGUpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGZvciAodHlwZSBpbiB0aGlzLmxpc3RlbmVycykge1xuICAgICAgICBpZiAodGhpcy5saXN0ZW5lcnMuaGFzT3duUHJvcGVydHkodHlwZSkpIHtcbiAgICAgICAgICB0aGlzLl9yZW1vdmVBbGxMaXN0ZW5lcnModHlwZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFByb3h5RXZlbnRFbWl0dGVyO1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvUHJveHlFdmVudEVtaXR0ZXIuanNcbiAqKiBtb2R1bGUgaWQgPSAyMFxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuLi9jb3JlL3V0aWwnKSxcbiAgZXJyb3IgPSByZXF1aXJlKCcuLi9jb3JlL2Vycm9yJyksXG4gIGxvZyA9IHJlcXVpcmUoJy4uL2NvcmUvbG9nJykoJ3N0b3JhZ2UnKTtcblxuLy8gVmFyaWFibGVzIGJlZ2lubmluZyB3aXRoIHVuZGVyc2NvcmUgYXJlIHRyZWF0ZWQgYXMgc3BlY2lhbCBieSBQb3VjaERCL0NvdWNoREIgc28gd2hlbiBzZXJpYWxpc2luZyB3ZSBuZWVkIHRvXG4vLyByZXBsYWNlIHdpdGggc29tZXRoaW5nIGVsc2UuXG52YXIgVU5ERVJTQ09SRSA9IC9fL2csXG4gIFVOREVSU0NPUkVfUkVQTEFDRU1FTlQgPSAvQC9nO1xuXG4vKipcbiAqXG4gKiBAcGFyYW0gYXBwXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gU3RvcmFnZShhcHApIHtcbiAgdmFyIG5hbWUgPSBhcHAubmFtZTtcblxuICB0aGlzLmFwcCA9IGFwcDtcbiAgdGhpcy51bnNhdmVkT2JqZWN0cyA9IFtdO1xuICB0aGlzLnVuc2F2ZWRPYmplY3RzSGFzaCA9IHt9O1xuICB0aGlzLnVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uID0ge307XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXModGhpcywge1xuICAgIF91bnNhdmVkT2JqZWN0czoge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudW5zYXZlZE9iamVjdHNcbiAgICAgIH1cbiAgICB9LFxuICAgIF91bnNhdmVkT2JqZWN0c0hhc2g6IHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnVuc2F2ZWRPYmplY3RzSGFzaFxuICAgICAgfVxuICAgIH0sXG4gICAgX3Vuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy51bnNhdmVkT2JqZWN0c0J5Q29sbGVjdGlvblxuICAgICAgfVxuICAgIH0sXG4gICAgX3BvdWNoOiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5wb3VjaFxuICAgICAgfVxuICAgIH1cbiAgfSk7XG5cbiAgdGhpcy5wb3VjaCA9IG5ldyBQb3VjaERCKG5hbWUsIHthdXRvX2NvbXBhY3Rpb246IHRydWV9KVxufVxuXG5TdG9yYWdlLnByb3RvdHlwZSA9IHtcbiAgLyoqXG4gICAqIFNhdmUgYWxsIG1vZGVsRXZlbnRzIGRvd24gdG8gUG91Y2hEQi5cbiAgICovXG4gIHNhdmU6IGZ1bmN0aW9uKGNiKSB7XG4gICAgcmV0dXJuIHV0aWwucHJvbWlzZShjYiwgZnVuY3Rpb24oY2IpIHtcbiAgICAgIHRoaXMuYXBwLl9lbnN1cmVJbnN0YWxsZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBpbnN0YW5jZXMgPSB0aGlzLnVuc2F2ZWRPYmplY3RzO1xuICAgICAgICB0aGlzLnVuc2F2ZWRPYmplY3RzID0gW107XG4gICAgICAgIHRoaXMudW5zYXZlZE9iamVjdHNIYXNoID0ge307XG4gICAgICAgIHRoaXMudW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb24gPSB7fTtcbiAgICAgICAgdGhpcy5zYXZlVG9Qb3VjaChpbnN0YW5jZXMsIGNiKTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcbiAgc2F2ZVRvUG91Y2g6IGZ1bmN0aW9uKG9iamVjdHMsIGNiKSB7XG4gICAgdmFyIGNvbmZsaWN0cyA9IFtdO1xuICAgIHZhciBzZXJpYWxpc2VkRG9jcyA9IG9iamVjdHMubWFwKHRoaXMuX3NlcmlhbGlzZS5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLnBvdWNoLmJ1bGtEb2NzKHNlcmlhbGlzZWREb2NzKS50aGVuKGZ1bmN0aW9uKHJlc3ApIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVzcC5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgcmVzcG9uc2UgPSByZXNwW2ldO1xuICAgICAgICB2YXIgb2JqID0gb2JqZWN0c1tpXTtcbiAgICAgICAgaWYgKHJlc3BvbnNlLm9rKSB7XG4gICAgICAgICAgb2JqLl9yZXYgPSByZXNwb25zZS5yZXY7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAocmVzcG9uc2Uuc3RhdHVzID09IDQwOSkge1xuICAgICAgICAgIGNvbmZsaWN0cy5wdXNoKG9iaik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgbG9nKCdFcnJvciBzYXZpbmcgb2JqZWN0IHdpdGggbG9jYWxJZD1cIicgKyBvYmoubG9jYWxJZCArICdcIicsIHJlc3BvbnNlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGNvbmZsaWN0cy5sZW5ndGgpIHtcbiAgICAgICAgdGhpcy5zYXZlQ29uZmxpY3RzKGNvbmZsaWN0cywgY2IpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNiKCk7XG4gICAgICB9XG4gICAgfSwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICBjYihlcnIpO1xuICAgIH0pO1xuICB9LFxuICBzYXZlQ29uZmxpY3RzOiBmdW5jdGlvbihvYmplY3RzLCBjYikge1xuICAgIHRoaXNcbiAgICAgIC5wb3VjaFxuICAgICAgLmFsbERvY3Moe2tleXM6IHV0aWwucGx1Y2sob2JqZWN0cywgJ2xvY2FsSWQnKX0pXG4gICAgICAudGhlbihmdW5jdGlvbihyZXNwKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVzcC5yb3dzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgb2JqZWN0c1tpXS5fcmV2ID0gcmVzcC5yb3dzW2ldLnZhbHVlLnJldjtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnNhdmVUb1BvdWNoKG9iamVjdHMsIGNiKTtcbiAgICAgIH0pXG4gICAgICAuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgIGNiKGVycik7XG4gICAgICB9KVxuICB9LFxuICAvKipcbiAgICogRW5zdXJlIHRoYXQgdGhlIFBvdWNoREIgaW5kZXggZm9yIHRoZSBnaXZlbiBtb2RlbCBleGlzdHMsIGNyZWF0aW5nIGl0IGlmIG5vdC5cbiAgICogQHBhcmFtIG1vZGVsXG4gICAqIEBwYXJhbSBjYlxuICAgKi9cbiAgZW5zdXJlSW5kZXhJbnN0YWxsZWQ6IGZ1bmN0aW9uKG1vZGVsLCBjYikge1xuICAgIGZ1bmN0aW9uIGZuKHJlc3ApIHtcbiAgICAgIHZhciBlcnI7XG4gICAgICBpZiAoIXJlc3Aub2spIHtcbiAgICAgICAgaWYgKHJlc3Auc3RhdHVzID09IDQwOSkge1xuICAgICAgICAgIGVyciA9IG51bGw7XG4gICAgICAgICAgbW9kZWwuaW5kZXhJbnN0YWxsZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjYihlcnIpO1xuICAgIH1cblxuICAgIHRoaXNcbiAgICAgIC5wb3VjaFxuICAgICAgLnB1dCh0aGlzLmNvbnN0cnVjdEluZGV4RGVzaWduRG9jKG1vZGVsLmNvbGxlY3Rpb25OYW1lLCBtb2RlbC5uYW1lKSlcbiAgICAgIC50aGVuKGZuKVxuICAgICAgLmNhdGNoKGZuKTtcbiAgfSxcbiAgLyoqXG4gICAqXG4gICAqIEBwYXJhbSBvcHRzXG4gICAqIEBwYXJhbSBbb3B0cy5jb2xsZWN0aW9uTmFtZV1cbiAgICogQHBhcmFtIFtvcHRzLm1vZGVsTmFtZV1cbiAgICogQHBhcmFtIFtvcHRzLm1vZGVsXVxuICAgKiBAcGFyYW0gY2JcbiAgICogQHByaXZhdGVcbiAgICovXG4gIGxvYWRNb2RlbDogZnVuY3Rpb24ob3B0cywgY2IpIHtcbiAgICB2YXIgbG9hZGVkID0ge307XG4gICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gb3B0cy5jb2xsZWN0aW9uTmFtZSxcbiAgICAgIG1vZGVsTmFtZSA9IG9wdHMubW9kZWxOYW1lLFxuICAgICAgbW9kZWwgPSBvcHRzLm1vZGVsO1xuICAgIGlmIChtb2RlbCkge1xuICAgICAgY29sbGVjdGlvbk5hbWUgPSBtb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgIG1vZGVsTmFtZSA9IG1vZGVsLm5hbWU7XG4gICAgfVxuXG4gICAgdmFyIGZ1bGx5UXVhbGlmaWVkTmFtZSA9IHRoaXMuZnVsbHlRdWFsaWZpZWRNb2RlbE5hbWUoY29sbGVjdGlvbk5hbWUsIG1vZGVsTmFtZSk7XG4gICAgdmFyIE1vZGVsID0gdGhpcy5hcHAuY29sbGVjdGlvblJlZ2lzdHJ5W2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdO1xuICAgIHRoaXNcbiAgICAgIC5wb3VjaFxuICAgICAgLnF1ZXJ5KGZ1bGx5UXVhbGlmaWVkTmFtZSlcbiAgICAgIC50aGVuKGZ1bmN0aW9uKHJlc3ApIHtcbiAgICAgICAgdmFyIHJvd3MgPSByZXNwLnJvd3M7XG4gICAgICAgIHZhciBkYXRhID0gdXRpbC5wbHVjayhyb3dzLCAndmFsdWUnKS5tYXAoZnVuY3Rpb24oZGF0dW0pIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5fcHJlcGFyZURhdHVtKGRhdHVtLCBNb2RlbCk7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICAgICAgZGF0YS5tYXAoZnVuY3Rpb24oZGF0dW0pIHtcbiAgICAgICAgICB2YXIgcmVtb3RlSWQgPSBkYXR1bVtNb2RlbC5pZF07XG4gICAgICAgICAgaWYgKHJlbW90ZUlkKSB7XG4gICAgICAgICAgICBpZiAobG9hZGVkW3JlbW90ZUlkXSkge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdEdXBsaWNhdGVzIGRldGVjdGVkIGluIHN0b3JhZ2UuIFlvdSBoYXZlIGVuY291bnRlcmVkIGEgc2VyaW91cyBidWcuIFBsZWFzZSByZXBvcnQgdGhpcy4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICBsb2FkZWRbcmVtb3RlSWRdID0gZGF0dW07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBNb2RlbC5fZ3JhcGgoZGF0YSwge1xuICAgICAgICAgIF9pZ25vcmVJbnN0YWxsZWQ6IHRydWUsXG4gICAgICAgICAgZGlzYWJsZWV2ZW50czogdHJ1ZSxcbiAgICAgICAgICBmcm9tU3RvcmFnZTogdHJ1ZVxuICAgICAgICB9LCBmdW5jdGlvbihlcnIsIGluc3RhbmNlcykge1xuICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICB0aGlzLl9saXN0ZW5lciA9IHRoaXMubGlzdGVuZXIuYmluZCh0aGlzKTtcbiAgICAgICAgICAgIG1vZGVsLm9uKCcqJywgdGhpcy5fbGlzdGVuZXIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGxvYWRpbmcgbW9kZWxzJywgZXJyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY2IoZXJyLCBpbnN0YW5jZXMpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgfS5iaW5kKHRoaXMpKVxuICAgICAgLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICBjYihlcnIpO1xuICAgICAgfSk7XG5cbiAgfSxcbiAgX3ByZXBhcmVEYXR1bTogZnVuY3Rpb24ocmF3RGF0dW0sIG1vZGVsKSB7XG4gICAgdGhpcy5fcHJvY2Vzc01ldGEocmF3RGF0dW0pO1xuICAgIGRlbGV0ZSByYXdEYXR1bS5jb2xsZWN0aW9uO1xuICAgIGRlbGV0ZSByYXdEYXR1bS5tb2RlbDtcbiAgICByYXdEYXR1bS5sb2NhbElkID0gcmF3RGF0dW0uX2lkO1xuICAgIGRlbGV0ZSByYXdEYXR1bS5faWQ7XG4gICAgdmFyIGRhdHVtID0ge307XG4gICAgT2JqZWN0LmtleXMocmF3RGF0dW0pLmZvckVhY2goZnVuY3Rpb24oaykge1xuICAgICAgZGF0dW1bay5yZXBsYWNlKFVOREVSU0NPUkVfUkVQTEFDRU1FTlQsICdfJyldID0gcmF3RGF0dW1ba107XG4gICAgfSk7XG5cbiAgICB2YXIgcmVsYXRpb25zaGlwTmFtZXMgPSBtb2RlbC5fcmVsYXRpb25zaGlwTmFtZXM7XG4gICAgcmVsYXRpb25zaGlwTmFtZXMuZm9yRWFjaChmdW5jdGlvbihyKSB7XG4gICAgICB2YXIgbG9jYWxJZCA9IGRhdHVtW3JdO1xuICAgICAgaWYgKGxvY2FsSWQpIHtcbiAgICAgICAgaWYgKHNpZXN0YS5pc0FycmF5KGxvY2FsSWQpKSB7XG4gICAgICAgICAgZGF0dW1bcl0gPSBsb2NhbElkLm1hcChmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICByZXR1cm4ge2xvY2FsSWQ6IHh9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgZGF0dW1bcl0gPSB7bG9jYWxJZDogbG9jYWxJZH07XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgIH0pO1xuICAgIHJldHVybiBkYXR1bTtcbiAgfSxcbiAgX3Byb2Nlc3NNZXRhOiBmdW5jdGlvbihkYXR1bSkge1xuICAgIHZhciBtZXRhID0gZGF0dW0uc2llc3RhX21ldGEgfHwgdGhpcy5faW5pdE1ldGEoKTtcbiAgICBtZXRhLmRhdGVGaWVsZHMuZm9yRWFjaChmdW5jdGlvbihkYXRlRmllbGQpIHtcbiAgICAgIHZhciB2YWx1ZSA9IGRhdHVtW2RhdGVGaWVsZF07XG4gICAgICBpZiAoISh2YWx1ZSBpbnN0YW5jZW9mIERhdGUpKSB7XG4gICAgICAgIGRhdHVtW2RhdGVGaWVsZF0gPSBuZXcgRGF0ZSh2YWx1ZSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgZGVsZXRlIGRhdHVtLnNpZXN0YV9tZXRhO1xuICB9LFxuXG4gIF9pbml0TWV0YTogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHtkYXRlRmllbGRzOiBbXX07XG4gIH0sXG5cbiAgLyoqXG4gICAqIFNvbWV0aW1lcyBzaWVzdGEgbmVlZHMgdG8gc3RvcmUgc29tZSBleHRyYSBpbmZvcm1hdGlvbiBhYm91dCB0aGUgbW9kZWwgaW5zdGFuY2UuXG4gICAqIEBwYXJhbSBzZXJpYWxpc2VkXG4gICAqL1xuICBfYWRkTWV0YTogZnVuY3Rpb24oc2VyaWFsaXNlZCkge1xuICAgIHNlcmlhbGlzZWQuc2llc3RhX21ldGEgPSB0aGlzLl9pbml0TWV0YSgpO1xuICAgIGZvciAodmFyIHByb3AgaW4gc2VyaWFsaXNlZCkge1xuICAgICAgaWYgKHNlcmlhbGlzZWQuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgaWYgKHNlcmlhbGlzZWRbcHJvcF0gaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICAgICAgc2VyaWFsaXNlZC5zaWVzdGFfbWV0YS5kYXRlRmllbGRzLnB1c2gocHJvcCk7XG4gICAgICAgICAgc2VyaWFsaXNlZFtwcm9wXSA9IHNlcmlhbGlzZWRbcHJvcF0uZ2V0VGltZSgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIGxpc3RlbmVyOiBmdW5jdGlvbihuKSB7XG4gICAgdmFyIGNoYW5nZWRPYmplY3QgPSBuLm9iaixcbiAgICAgIGlkZW50ID0gY2hhbmdlZE9iamVjdC5sb2NhbElkO1xuICAgIGlmICghY2hhbmdlZE9iamVjdCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBvYmogZmllbGQgaW4gbm90aWZpY2F0aW9uIHJlY2VpdmVkIGJ5IHN0b3JhZ2UgZXh0ZW5zaW9uJyk7XG4gICAgfVxuICAgIGlmICghKGlkZW50IGluIHRoaXMudW5zYXZlZE9iamVjdHNIYXNoKSkge1xuICAgICAgdGhpcy51bnNhdmVkT2JqZWN0c0hhc2hbaWRlbnRdID0gY2hhbmdlZE9iamVjdDtcbiAgICAgIHRoaXMudW5zYXZlZE9iamVjdHMucHVzaChjaGFuZ2VkT2JqZWN0KTtcbiAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IGNoYW5nZWRPYmplY3QuY29sbGVjdGlvbk5hbWU7XG4gICAgICBpZiAoIXRoaXMudW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdKSB7XG4gICAgICAgIHRoaXMudW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdID0ge307XG4gICAgICB9XG4gICAgICB2YXIgbW9kZWxOYW1lID0gY2hhbmdlZE9iamVjdC5tb2RlbC5uYW1lO1xuICAgICAgaWYgKCF0aGlzLnVuc2F2ZWRPYmplY3RzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdKSB7XG4gICAgICAgIHRoaXMudW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV0gPSB7fTtcbiAgICAgIH1cbiAgICAgIHRoaXMudW5zYXZlZE9iamVjdHNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV1baWRlbnRdID0gY2hhbmdlZE9iamVjdDtcbiAgICB9XG4gIH0sXG4gIF9yZXNldDogZnVuY3Rpb24oY2IpIHtcbiAgICBpZiAodGhpcy5fbGlzdGVuZXIpIHRoaXMuYXBwLnJlbW92ZUxpc3RlbmVyKCdTaWVzdGEnLCB0aGlzLl9saXN0ZW5lcik7XG4gICAgdGhpcy51bnNhdmVkT2JqZWN0cyA9IFtdO1xuICAgIHRoaXMudW5zYXZlZE9iamVjdHNIYXNoID0ge307XG5cbiAgICB0aGlzXG4gICAgICAucG91Y2hcbiAgICAgIC5hbGxEb2NzKClcbiAgICAgIC50aGVuKGZ1bmN0aW9uKHJlc3VsdHMpIHtcbiAgICAgICAgdmFyIGRvY3MgPSByZXN1bHRzLnJvd3MubWFwKGZ1bmN0aW9uKHIpIHtcbiAgICAgICAgICByZXR1cm4ge19pZDogci5pZCwgX3Jldjogci52YWx1ZS5yZXYsIF9kZWxldGVkOiB0cnVlfTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5wb3VjaFxuICAgICAgICAgIC5idWxrRG9jcyhkb2NzKVxuICAgICAgICAgIC50aGVuKGZ1bmN0aW9uKCkge2NiKCl9KVxuICAgICAgICAgIC5jYXRjaChjYik7XG4gICAgICB9LmJpbmQodGhpcykpXG4gICAgICAuY2F0Y2goY2IpO1xuICB9LFxuICAvKipcbiAgICogU2VyaWFsaXNlIGEgbW9kZWwgaW50byBhIGZvcm1hdCB0aGF0IFBvdWNoREIgYnVsa0RvY3MgQVBJIGNhbiBwcm9jZXNzXG4gICAqIEBwYXJhbSB7TW9kZWxJbnN0YW5jZX0gbW9kZWxJbnN0YW5jZVxuICAgKi9cbiAgX3NlcmlhbGlzZTogZnVuY3Rpb24obW9kZWxJbnN0YW5jZSkge1xuICAgIHZhciBzZXJpYWxpc2VkID0ge307XG4gICAgdmFyIF9fdmFsdWVzID0gbW9kZWxJbnN0YW5jZS5fX3ZhbHVlcztcbiAgICBzZXJpYWxpc2VkID0gdXRpbC5leHRlbmQoc2VyaWFsaXNlZCwgX192YWx1ZXMpO1xuICAgIE9iamVjdC5rZXlzKHNlcmlhbGlzZWQpLmZvckVhY2goZnVuY3Rpb24oaykge1xuICAgICAgc2VyaWFsaXNlZFtrLnJlcGxhY2UoVU5ERVJTQ09SRSwgJ0AnKV0gPSBfX3ZhbHVlc1trXTtcbiAgICB9KTtcbiAgICB0aGlzLl9hZGRNZXRhKHNlcmlhbGlzZWQpO1xuICAgIHNlcmlhbGlzZWRbJ2NvbGxlY3Rpb24nXSA9IG1vZGVsSW5zdGFuY2UuY29sbGVjdGlvbk5hbWU7XG4gICAgc2VyaWFsaXNlZFsnbW9kZWwnXSA9IG1vZGVsSW5zdGFuY2UubW9kZWxOYW1lO1xuICAgIHNlcmlhbGlzZWRbJ19pZCddID0gbW9kZWxJbnN0YW5jZS5sb2NhbElkO1xuICAgIGlmIChtb2RlbEluc3RhbmNlLnJlbW92ZWQpIHNlcmlhbGlzZWRbJ19kZWxldGVkJ10gPSB0cnVlO1xuICAgIHZhciByZXYgPSBtb2RlbEluc3RhbmNlLl9yZXY7XG4gICAgaWYgKHJldikgc2VyaWFsaXNlZFsnX3JldiddID0gcmV2O1xuICAgIHNlcmlhbGlzZWQgPSBtb2RlbEluc3RhbmNlLl9yZWxhdGlvbnNoaXBOYW1lcy5yZWR1Y2UoZnVuY3Rpb24obWVtbywgbikge1xuICAgICAgdmFyIHZhbCA9IG1vZGVsSW5zdGFuY2Vbbl07XG4gICAgICBpZiAoc2llc3RhLmlzQXJyYXkodmFsKSkge1xuICAgICAgICBtZW1vW25dID0gdXRpbC5wbHVjayh2YWwsICdsb2NhbElkJyk7XG4gICAgICB9XG4gICAgICBlbHNlIGlmICh2YWwpIHtcbiAgICAgICAgbWVtb1tuXSA9IHZhbC5sb2NhbElkO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG1lbW87XG4gICAgfSwgc2VyaWFsaXNlZCk7XG4gICAgcmV0dXJuIHNlcmlhbGlzZWQ7XG4gIH0sXG4gIGNvbnN0cnVjdEluZGV4RGVzaWduRG9jOiBmdW5jdGlvbihjb2xsZWN0aW9uTmFtZSwgbW9kZWxOYW1lKSB7XG4gICAgdmFyIGZ1bGx5UXVhbGlmaWVkTmFtZSA9IHRoaXMuZnVsbHlRdWFsaWZpZWRNb2RlbE5hbWUoY29sbGVjdGlvbk5hbWUsIG1vZGVsTmFtZSk7XG4gICAgdmFyIHZpZXdzID0ge307XG4gICAgdmlld3NbZnVsbHlRdWFsaWZpZWROYW1lXSA9IHtcbiAgICAgIG1hcDogZnVuY3Rpb24oZG9jKSB7XG4gICAgICAgIGlmIChkb2MuY29sbGVjdGlvbiA9PSAnJDEnICYmIGRvYy5tb2RlbCA9PSAnJDInKSBlbWl0KGRvYy5jb2xsZWN0aW9uICsgJy4nICsgZG9jLm1vZGVsLCBkb2MpO1xuICAgICAgfS50b1N0cmluZygpLnJlcGxhY2UoJyQxJywgY29sbGVjdGlvbk5hbWUpLnJlcGxhY2UoJyQyJywgbW9kZWxOYW1lKVxuICAgIH07XG4gICAgcmV0dXJuIHtcbiAgICAgIF9pZDogJ19kZXNpZ24vJyArIGZ1bGx5UXVhbGlmaWVkTmFtZSxcbiAgICAgIHZpZXdzOiB2aWV3c1xuICAgIH07XG4gIH0sXG4gIGZ1bGx5UXVhbGlmaWVkTW9kZWxOYW1lOiBmdW5jdGlvbihjb2xsZWN0aW9uTmFtZSwgbW9kZWxOYW1lKSB7XG4gICAgcmV0dXJuIGNvbGxlY3Rpb25OYW1lICsgJy4nICsgbW9kZWxOYW1lO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFN0b3JhZ2U7XG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vc3RvcmFnZS9pbmRleC5qc1xuICoqIG1vZHVsZSBpZCA9IDIxXG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcbnZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG52YXIgdW5kZWZpbmVkO1xuXG52YXIgaXNQbGFpbk9iamVjdCA9IGZ1bmN0aW9uIGlzUGxhaW5PYmplY3Qob2JqKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG4gICAgaWYgKCFvYmogfHwgdG9TdHJpbmcuY2FsbChvYmopICE9PSAnW29iamVjdCBPYmplY3RdJyB8fCBvYmoubm9kZVR5cGUgfHwgb2JqLnNldEludGVydmFsKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgaGFzX293bl9jb25zdHJ1Y3RvciA9IGhhc093bi5jYWxsKG9iaiwgJ2NvbnN0cnVjdG9yJyk7XG4gICAgdmFyIGhhc19pc19wcm9wZXJ0eV9vZl9tZXRob2QgPSBvYmouY29uc3RydWN0b3IgJiYgb2JqLmNvbnN0cnVjdG9yLnByb3RvdHlwZSAmJiBoYXNPd24uY2FsbChvYmouY29uc3RydWN0b3IucHJvdG90eXBlLCAnaXNQcm90b3R5cGVPZicpO1xuICAgIC8vIE5vdCBvd24gY29uc3RydWN0b3IgcHJvcGVydHkgbXVzdCBiZSBPYmplY3RcbiAgICBpZiAob2JqLmNvbnN0cnVjdG9yICYmICFoYXNfb3duX2NvbnN0cnVjdG9yICYmICFoYXNfaXNfcHJvcGVydHlfb2ZfbWV0aG9kKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBPd24gcHJvcGVydGllcyBhcmUgZW51bWVyYXRlZCBmaXJzdGx5LCBzbyB0byBzcGVlZCB1cCxcbiAgICAvLyBpZiBsYXN0IG9uZSBpcyBvd24sIHRoZW4gYWxsIHByb3BlcnRpZXMgYXJlIG93bi5cbiAgICB2YXIga2V5O1xuICAgIGZvciAoa2V5IGluIG9iaikge31cblxuICAgIHJldHVybiBrZXkgPT09IHVuZGVmaW5lZCB8fCBoYXNPd24uY2FsbChvYmosIGtleSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGV4dGVuZCgpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcbiAgICB2YXIgb3B0aW9ucywgbmFtZSwgc3JjLCBjb3B5LCBjb3B5SXNBcnJheSwgY2xvbmUsXG4gICAgICAgIHRhcmdldCA9IGFyZ3VtZW50c1swXSxcbiAgICAgICAgaSA9IDEsXG4gICAgICAgIGxlbmd0aCA9IGFyZ3VtZW50cy5sZW5ndGgsXG4gICAgICAgIGRlZXAgPSBmYWxzZTtcblxuICAgIC8vIEhhbmRsZSBhIGRlZXAgY29weSBzaXR1YXRpb25cbiAgICBpZiAodHlwZW9mIHRhcmdldCA9PT0gXCJib29sZWFuXCIpIHtcbiAgICAgICAgZGVlcCA9IHRhcmdldDtcbiAgICAgICAgdGFyZ2V0ID0gYXJndW1lbnRzWzFdIHx8IHt9O1xuICAgICAgICAvLyBza2lwIHRoZSBib29sZWFuIGFuZCB0aGUgdGFyZ2V0XG4gICAgICAgIGkgPSAyO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHRhcmdldCAhPT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgdGFyZ2V0ICE9PSBcImZ1bmN0aW9uXCIgfHwgdGFyZ2V0ID09IHVuZGVmaW5lZCkge1xuICAgICAgICB0YXJnZXQgPSB7fTtcbiAgICB9XG5cbiAgICBmb3IgKDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgICAgIC8vIE9ubHkgZGVhbCB3aXRoIG5vbi1udWxsL3VuZGVmaW5lZCB2YWx1ZXNcbiAgICAgICAgaWYgKChvcHRpb25zID0gYXJndW1lbnRzW2ldKSAhPSBudWxsKSB7XG4gICAgICAgICAgICAvLyBFeHRlbmQgdGhlIGJhc2Ugb2JqZWN0XG4gICAgICAgICAgICBmb3IgKG5hbWUgaW4gb3B0aW9ucykge1xuICAgICAgICAgICAgICAgIHNyYyA9IHRhcmdldFtuYW1lXTtcbiAgICAgICAgICAgICAgICBjb3B5ID0gb3B0aW9uc1tuYW1lXTtcblxuICAgICAgICAgICAgICAgIC8vIFByZXZlbnQgbmV2ZXItZW5kaW5nIGxvb3BcbiAgICAgICAgICAgICAgICBpZiAodGFyZ2V0ID09PSBjb3B5KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIFJlY3Vyc2UgaWYgd2UncmUgbWVyZ2luZyBwbGFpbiBvYmplY3RzIG9yIGFycmF5c1xuICAgICAgICAgICAgICAgIGlmIChkZWVwICYmIGNvcHkgJiYgKGlzUGxhaW5PYmplY3QoY29weSkgfHwgKGNvcHlJc0FycmF5ID0gQXJyYXkuaXNBcnJheShjb3B5KSkpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjb3B5SXNBcnJheSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29weUlzQXJyYXkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsb25lID0gc3JjICYmIEFycmF5LmlzQXJyYXkoc3JjKSA/IHNyYyA6IFtdO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2xvbmUgPSBzcmMgJiYgaXNQbGFpbk9iamVjdChzcmMpID8gc3JjIDoge307XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBOZXZlciBtb3ZlIG9yaWdpbmFsIG9iamVjdHMsIGNsb25lIHRoZW1cbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W25hbWVdID0gZXh0ZW5kKGRlZXAsIGNsb25lLCBjb3B5KTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBEb24ndCBicmluZyBpbiB1bmRlZmluZWQgdmFsdWVzXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjb3B5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W25hbWVdID0gY29weTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZXR1cm4gdGhlIG1vZGlmaWVkIG9iamVjdFxuICAgIHJldHVybiB0YXJnZXQ7XG59O1xuXG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vfi9leHRlbmQvaW5kZXguanNcbiAqKiBtb2R1bGUgaWQgPSAyMlxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiLypcbiAqIENvcHlyaWdodCAoYykgMjAxNCBUaGUgUG9seW1lciBQcm9qZWN0IEF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiBUaGlzIGNvZGUgbWF5IG9ubHkgYmUgdXNlZCB1bmRlciB0aGUgQlNEIHN0eWxlIGxpY2Vuc2UgZm91bmQgYXQgaHR0cDovL3BvbHltZXIuZ2l0aHViLmlvL0xJQ0VOU0UudHh0XG4gKiBUaGUgY29tcGxldGUgc2V0IG9mIGF1dGhvcnMgbWF5IGJlIGZvdW5kIGF0IGh0dHA6Ly9wb2x5bWVyLmdpdGh1Yi5pby9BVVRIT1JTLnR4dFxuICogVGhlIGNvbXBsZXRlIHNldCBvZiBjb250cmlidXRvcnMgbWF5IGJlIGZvdW5kIGF0IGh0dHA6Ly9wb2x5bWVyLmdpdGh1Yi5pby9DT05UUklCVVRPUlMudHh0XG4gKiBDb2RlIGRpc3RyaWJ1dGVkIGJ5IEdvb2dsZSBhcyBwYXJ0IG9mIHRoZSBwb2x5bWVyIHByb2plY3QgaXMgYWxzb1xuICogc3ViamVjdCB0byBhbiBhZGRpdGlvbmFsIElQIHJpZ2h0cyBncmFudCBmb3VuZCBhdCBodHRwOi8vcG9seW1lci5naXRodWIuaW8vUEFURU5UUy50eHRcbiAqL1xuXG4oZnVuY3Rpb24oZ2xvYmFsKSB7XG4gICd1c2Ugc3RyaWN0JztcblxuICB2YXIgdGVzdGluZ0V4cG9zZUN5Y2xlQ291bnQgPSBnbG9iYWwudGVzdGluZ0V4cG9zZUN5Y2xlQ291bnQ7XG5cbiAgLy8gRGV0ZWN0IGFuZCBkbyBiYXNpYyBzYW5pdHkgY2hlY2tpbmcgb24gT2JqZWN0L0FycmF5Lm9ic2VydmUuXG4gIGZ1bmN0aW9uIGRldGVjdE9iamVjdE9ic2VydmUoKSB7XG4gICAgaWYgKHR5cGVvZiBPYmplY3Qub2JzZXJ2ZSAhPT0gJ2Z1bmN0aW9uJyB8fFxuICAgICAgICB0eXBlb2YgQXJyYXkub2JzZXJ2ZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHZhciByZWNvcmRzID0gW107XG5cbiAgICBmdW5jdGlvbiBjYWxsYmFjayhyZWNzKSB7XG4gICAgICByZWNvcmRzID0gcmVjcztcbiAgICB9XG5cbiAgICB2YXIgdGVzdCA9IHt9O1xuICAgIHZhciBhcnIgPSBbXTtcbiAgICBPYmplY3Qub2JzZXJ2ZSh0ZXN0LCBjYWxsYmFjayk7XG4gICAgQXJyYXkub2JzZXJ2ZShhcnIsIGNhbGxiYWNrKTtcbiAgICB0ZXN0LmlkID0gMTtcbiAgICB0ZXN0LmlkID0gMjtcbiAgICBkZWxldGUgdGVzdC5pZDtcbiAgICBhcnIucHVzaCgxLCAyKTtcbiAgICBhcnIubGVuZ3RoID0gMDtcblxuICAgIE9iamVjdC5kZWxpdmVyQ2hhbmdlUmVjb3JkcyhjYWxsYmFjayk7XG4gICAgaWYgKHJlY29yZHMubGVuZ3RoICE9PSA1KVxuICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgaWYgKHJlY29yZHNbMF0udHlwZSAhPSAnYWRkJyB8fFxuICAgICAgICByZWNvcmRzWzFdLnR5cGUgIT0gJ3VwZGF0ZScgfHxcbiAgICAgICAgcmVjb3Jkc1syXS50eXBlICE9ICdkZWxldGUnIHx8XG4gICAgICAgIHJlY29yZHNbM10udHlwZSAhPSAnc3BsaWNlJyB8fFxuICAgICAgICByZWNvcmRzWzRdLnR5cGUgIT0gJ3NwbGljZScpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBPYmplY3QudW5vYnNlcnZlKHRlc3QsIGNhbGxiYWNrKTtcbiAgICBBcnJheS51bm9ic2VydmUoYXJyLCBjYWxsYmFjayk7XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHZhciBoYXNPYnNlcnZlID0gZGV0ZWN0T2JqZWN0T2JzZXJ2ZSgpO1xuXG4gIGZ1bmN0aW9uIGRldGVjdEV2YWwoKSB7XG4gICAgLy8gRG9uJ3QgdGVzdCBmb3IgZXZhbCBpZiB3ZSdyZSBydW5uaW5nIGluIGEgQ2hyb21lIEFwcCBlbnZpcm9ubWVudC5cbiAgICAvLyBXZSBjaGVjayBmb3IgQVBJcyBzZXQgdGhhdCBvbmx5IGV4aXN0IGluIGEgQ2hyb21lIEFwcCBjb250ZXh0LlxuICAgIGlmICh0eXBlb2YgY2hyb21lICE9PSAndW5kZWZpbmVkJyAmJiBjaHJvbWUuYXBwICYmIGNocm9tZS5hcHAucnVudGltZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIEZpcmVmb3ggT1MgQXBwcyBkbyBub3QgYWxsb3cgZXZhbC4gVGhpcyBmZWF0dXJlIGRldGVjdGlvbiBpcyB2ZXJ5IGhhY2t5XG4gICAgLy8gYnV0IGV2ZW4gaWYgc29tZSBvdGhlciBwbGF0Zm9ybSBhZGRzIHN1cHBvcnQgZm9yIHRoaXMgZnVuY3Rpb24gdGhpcyBjb2RlXG4gICAgLy8gd2lsbCBjb250aW51ZSB0byB3b3JrLlxuICAgIGlmIChuYXZpZ2F0b3IuZ2V0RGV2aWNlU3RvcmFnZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICB2YXIgZiA9IG5ldyBGdW5jdGlvbignJywgJ3JldHVybiB0cnVlOycpO1xuICAgICAgcmV0dXJuIGYoKTtcbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIHZhciBoYXNFdmFsID0gZGV0ZWN0RXZhbCgpO1xuXG4gIGZ1bmN0aW9uIGlzSW5kZXgocykge1xuICAgIHJldHVybiArcyA9PT0gcyA+Pj4gMCAmJiBzICE9PSAnJztcbiAgfVxuXG4gIGZ1bmN0aW9uIHRvTnVtYmVyKHMpIHtcbiAgICByZXR1cm4gK3M7XG4gIH1cblxuICB2YXIgbnVtYmVySXNOYU4gPSBnbG9iYWwuTnVtYmVyLmlzTmFOIHx8IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgJiYgZ2xvYmFsLmlzTmFOKHZhbHVlKTtcbiAgfVxuXG5cbiAgdmFyIGNyZWF0ZU9iamVjdCA9ICgnX19wcm90b19fJyBpbiB7fSkgP1xuICAgIGZ1bmN0aW9uKG9iaikgeyByZXR1cm4gb2JqOyB9IDpcbiAgICBmdW5jdGlvbihvYmopIHtcbiAgICAgIHZhciBwcm90byA9IG9iai5fX3Byb3RvX187XG4gICAgICBpZiAoIXByb3RvKVxuICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgdmFyIG5ld09iamVjdCA9IE9iamVjdC5jcmVhdGUocHJvdG8pO1xuICAgICAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMob2JqKS5mb3JFYWNoKGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG5ld09iamVjdCwgbmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihvYmosIG5hbWUpKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIG5ld09iamVjdDtcbiAgICB9O1xuXG4gIHZhciBpZGVudFN0YXJ0ID0gJ1tcXCRfYS16QS1aXSc7XG4gIHZhciBpZGVudFBhcnQgPSAnW1xcJF9hLXpBLVowLTldJztcblxuXG4gIHZhciBNQVhfRElSVFlfQ0hFQ0tfQ1lDTEVTID0gMTAwMDtcblxuICBmdW5jdGlvbiBkaXJ0eUNoZWNrKG9ic2VydmVyKSB7XG4gICAgdmFyIGN5Y2xlcyA9IDA7XG4gICAgd2hpbGUgKGN5Y2xlcyA8IE1BWF9ESVJUWV9DSEVDS19DWUNMRVMgJiYgb2JzZXJ2ZXIuY2hlY2tfKCkpIHtcbiAgICAgIGN5Y2xlcysrO1xuICAgIH1cbiAgICBpZiAodGVzdGluZ0V4cG9zZUN5Y2xlQ291bnQpXG4gICAgICBnbG9iYWwuZGlydHlDaGVja0N5Y2xlQ291bnQgPSBjeWNsZXM7XG5cbiAgICByZXR1cm4gY3ljbGVzID4gMDtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9iamVjdElzRW1wdHkob2JqZWN0KSB7XG4gICAgZm9yICh2YXIgcHJvcCBpbiBvYmplY3QpXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBmdW5jdGlvbiBkaWZmSXNFbXB0eShkaWZmKSB7XG4gICAgcmV0dXJuIG9iamVjdElzRW1wdHkoZGlmZi5hZGRlZCkgJiZcbiAgICAgICAgICAgb2JqZWN0SXNFbXB0eShkaWZmLnJlbW92ZWQpICYmXG4gICAgICAgICAgIG9iamVjdElzRW1wdHkoZGlmZi5jaGFuZ2VkKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRpZmZPYmplY3RGcm9tT2xkT2JqZWN0KG9iamVjdCwgb2xkT2JqZWN0KSB7XG4gICAgdmFyIGFkZGVkID0ge307XG4gICAgdmFyIHJlbW92ZWQgPSB7fTtcbiAgICB2YXIgY2hhbmdlZCA9IHt9O1xuXG4gICAgZm9yICh2YXIgcHJvcCBpbiBvbGRPYmplY3QpIHtcbiAgICAgIHZhciBuZXdWYWx1ZSA9IG9iamVjdFtwcm9wXTtcblxuICAgICAgaWYgKG5ld1ZhbHVlICE9PSB1bmRlZmluZWQgJiYgbmV3VmFsdWUgPT09IG9sZE9iamVjdFtwcm9wXSlcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIGlmICghKHByb3AgaW4gb2JqZWN0KSkge1xuICAgICAgICByZW1vdmVkW3Byb3BdID0gdW5kZWZpbmVkO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKG5ld1ZhbHVlICE9PSBvbGRPYmplY3RbcHJvcF0pXG4gICAgICAgIGNoYW5nZWRbcHJvcF0gPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBwcm9wIGluIG9iamVjdCkge1xuICAgICAgaWYgKHByb3AgaW4gb2xkT2JqZWN0KVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgYWRkZWRbcHJvcF0gPSBvYmplY3RbcHJvcF07XG4gICAgfVxuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkob2JqZWN0KSAmJiBvYmplY3QubGVuZ3RoICE9PSBvbGRPYmplY3QubGVuZ3RoKVxuICAgICAgY2hhbmdlZC5sZW5ndGggPSBvYmplY3QubGVuZ3RoO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGFkZGVkOiBhZGRlZCxcbiAgICAgIHJlbW92ZWQ6IHJlbW92ZWQsXG4gICAgICBjaGFuZ2VkOiBjaGFuZ2VkXG4gICAgfTtcbiAgfVxuXG4gIHZhciBlb21UYXNrcyA9IFtdO1xuICBmdW5jdGlvbiBydW5FT01UYXNrcygpIHtcbiAgICBpZiAoIWVvbVRhc2tzLmxlbmd0aClcbiAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZW9tVGFza3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIGVvbVRhc2tzW2ldKCk7XG4gICAgfVxuICAgIGVvbVRhc2tzLmxlbmd0aCA9IDA7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICB2YXIgcnVuRU9NID0gaGFzT2JzZXJ2ZSA/IChmdW5jdGlvbigpe1xuICAgIHZhciBlb21PYmogPSB7IHBpbmdQb25nOiB0cnVlIH07XG4gICAgdmFyIGVvbVJ1blNjaGVkdWxlZCA9IGZhbHNlO1xuXG4gICAgT2JqZWN0Lm9ic2VydmUoZW9tT2JqLCBmdW5jdGlvbigpIHtcbiAgICAgIHJ1bkVPTVRhc2tzKCk7XG4gICAgICBlb21SdW5TY2hlZHVsZWQgPSBmYWxzZTtcbiAgICB9KTtcblxuICAgIHJldHVybiBmdW5jdGlvbihmbikge1xuICAgICAgZW9tVGFza3MucHVzaChmbik7XG4gICAgICBpZiAoIWVvbVJ1blNjaGVkdWxlZCkge1xuICAgICAgICBlb21SdW5TY2hlZHVsZWQgPSB0cnVlO1xuICAgICAgICBlb21PYmoucGluZ1BvbmcgPSAhZW9tT2JqLnBpbmdQb25nO1xuICAgICAgfVxuICAgIH07XG4gIH0pKCkgOlxuICAoZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKGZuKSB7XG4gICAgICBlb21UYXNrcy5wdXNoKGZuKTtcbiAgICB9O1xuICB9KSgpO1xuXG4gIHZhciBvYnNlcnZlZE9iamVjdENhY2hlID0gW107XG5cbiAgZnVuY3Rpb24gbmV3T2JzZXJ2ZWRPYmplY3QoKSB7XG4gICAgdmFyIG9ic2VydmVyO1xuICAgIHZhciBvYmplY3Q7XG4gICAgdmFyIGRpc2NhcmRSZWNvcmRzID0gZmFsc2U7XG4gICAgdmFyIGZpcnN0ID0gdHJ1ZTtcblxuICAgIGZ1bmN0aW9uIGNhbGxiYWNrKHJlY29yZHMpIHtcbiAgICAgIGlmIChvYnNlcnZlciAmJiBvYnNlcnZlci5zdGF0ZV8gPT09IE9QRU5FRCAmJiAhZGlzY2FyZFJlY29yZHMpXG4gICAgICAgIG9ic2VydmVyLmNoZWNrXyhyZWNvcmRzKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgb3BlbjogZnVuY3Rpb24ob2JzKSB7XG4gICAgICAgIGlmIChvYnNlcnZlcilcbiAgICAgICAgICB0aHJvdyBFcnJvcignT2JzZXJ2ZWRPYmplY3QgaW4gdXNlJyk7XG5cbiAgICAgICAgaWYgKCFmaXJzdClcbiAgICAgICAgICBPYmplY3QuZGVsaXZlckNoYW5nZVJlY29yZHMoY2FsbGJhY2spO1xuXG4gICAgICAgIG9ic2VydmVyID0gb2JzO1xuICAgICAgICBmaXJzdCA9IGZhbHNlO1xuICAgICAgfSxcbiAgICAgIG9ic2VydmU6IGZ1bmN0aW9uKG9iaiwgYXJyYXlPYnNlcnZlKSB7XG4gICAgICAgIG9iamVjdCA9IG9iajtcbiAgICAgICAgaWYgKGFycmF5T2JzZXJ2ZSlcbiAgICAgICAgICBBcnJheS5vYnNlcnZlKG9iamVjdCwgY2FsbGJhY2spO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgT2JqZWN0Lm9ic2VydmUob2JqZWN0LCBjYWxsYmFjayk7XG4gICAgICB9LFxuICAgICAgZGVsaXZlcjogZnVuY3Rpb24oZGlzY2FyZCkge1xuICAgICAgICBkaXNjYXJkUmVjb3JkcyA9IGRpc2NhcmQ7XG4gICAgICAgIE9iamVjdC5kZWxpdmVyQ2hhbmdlUmVjb3JkcyhjYWxsYmFjayk7XG4gICAgICAgIGRpc2NhcmRSZWNvcmRzID0gZmFsc2U7XG4gICAgICB9LFxuICAgICAgY2xvc2U6IGZ1bmN0aW9uKCkge1xuICAgICAgICBvYnNlcnZlciA9IHVuZGVmaW5lZDtcbiAgICAgICAgT2JqZWN0LnVub2JzZXJ2ZShvYmplY3QsIGNhbGxiYWNrKTtcbiAgICAgICAgb2JzZXJ2ZWRPYmplY3RDYWNoZS5wdXNoKHRoaXMpO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICAvKlxuICAgKiBUaGUgb2JzZXJ2ZWRTZXQgYWJzdHJhY3Rpb24gaXMgYSBwZXJmIG9wdGltaXphdGlvbiB3aGljaCByZWR1Y2VzIHRoZSB0b3RhbFxuICAgKiBudW1iZXIgb2YgT2JqZWN0Lm9ic2VydmUgb2JzZXJ2YXRpb25zIG9mIGEgc2V0IG9mIG9iamVjdHMuIFRoZSBpZGVhIGlzIHRoYXRcbiAgICogZ3JvdXBzIG9mIE9ic2VydmVycyB3aWxsIGhhdmUgc29tZSBvYmplY3QgZGVwZW5kZW5jaWVzIGluIGNvbW1vbiBhbmQgdGhpc1xuICAgKiBvYnNlcnZlZCBzZXQgZW5zdXJlcyB0aGF0IGVhY2ggb2JqZWN0IGluIHRoZSB0cmFuc2l0aXZlIGNsb3N1cmUgb2ZcbiAgICogZGVwZW5kZW5jaWVzIGlzIG9ubHkgb2JzZXJ2ZWQgb25jZS4gVGhlIG9ic2VydmVkU2V0IGFjdHMgYXMgYSB3cml0ZSBiYXJyaWVyXG4gICAqIHN1Y2ggdGhhdCB3aGVuZXZlciBhbnkgY2hhbmdlIGNvbWVzIHRocm91Z2gsIGFsbCBPYnNlcnZlcnMgYXJlIGNoZWNrZWQgZm9yXG4gICAqIGNoYW5nZWQgdmFsdWVzLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgdGhpcyBvcHRpbWl6YXRpb24gaXMgZXhwbGljaXRseSBtb3Zpbmcgd29yayBmcm9tIHNldHVwLXRpbWUgdG9cbiAgICogY2hhbmdlLXRpbWUuXG4gICAqXG4gICAqIFRPRE8ocmFmYWVsdyk6IEltcGxlbWVudCBcImdhcmJhZ2UgY29sbGVjdGlvblwiLiBJbiBvcmRlciB0byBtb3ZlIHdvcmsgb2ZmXG4gICAqIHRoZSBjcml0aWNhbCBwYXRoLCB3aGVuIE9ic2VydmVycyBhcmUgY2xvc2VkLCB0aGVpciBvYnNlcnZlZCBvYmplY3RzIGFyZVxuICAgKiBub3QgT2JqZWN0LnVub2JzZXJ2ZShkKS4gQXMgYSByZXN1bHQsIGl0J3NpZXN0YSBwb3NzaWJsZSB0aGF0IGlmIHRoZSBvYnNlcnZlZFNldFxuICAgKiBpcyBrZXB0IG9wZW4sIGJ1dCBzb21lIE9ic2VydmVycyBoYXZlIGJlZW4gY2xvc2VkLCBpdCBjb3VsZCBjYXVzZSBcImxlYWtzXCJcbiAgICogKHByZXZlbnQgb3RoZXJ3aXNlIGNvbGxlY3RhYmxlIG9iamVjdHMgZnJvbSBiZWluZyBjb2xsZWN0ZWQpLiBBdCBzb21lXG4gICAqIHBvaW50LCB3ZSBzaG91bGQgaW1wbGVtZW50IGluY3JlbWVudGFsIFwiZ2NcIiB3aGljaCBrZWVwcyBhIGxpc3Qgb2ZcbiAgICogb2JzZXJ2ZWRTZXRzIHdoaWNoIG1heSBuZWVkIGNsZWFuLXVwIGFuZCBkb2VzIHNtYWxsIGFtb3VudHMgb2YgY2xlYW51cCBvbiBhXG4gICAqIHRpbWVvdXQgdW50aWwgYWxsIGlzIGNsZWFuLlxuICAgKi9cblxuICBmdW5jdGlvbiBnZXRPYnNlcnZlZE9iamVjdChvYnNlcnZlciwgb2JqZWN0LCBhcnJheU9ic2VydmUpIHtcbiAgICB2YXIgZGlyID0gb2JzZXJ2ZWRPYmplY3RDYWNoZS5wb3AoKSB8fCBuZXdPYnNlcnZlZE9iamVjdCgpO1xuICAgIGRpci5vcGVuKG9ic2VydmVyKTtcbiAgICBkaXIub2JzZXJ2ZShvYmplY3QsIGFycmF5T2JzZXJ2ZSk7XG4gICAgcmV0dXJuIGRpcjtcbiAgfVxuXG4gIHZhciBvYnNlcnZlZFNldENhY2hlID0gW107XG5cbiAgZnVuY3Rpb24gbmV3T2JzZXJ2ZWRTZXQoKSB7XG4gICAgdmFyIG9ic2VydmVyQ291bnQgPSAwO1xuICAgIHZhciBvYnNlcnZlcnMgPSBbXTtcbiAgICB2YXIgb2JqZWN0cyA9IFtdO1xuICAgIHZhciByb290T2JqO1xuICAgIHZhciByb290T2JqUHJvcHM7XG5cbiAgICBmdW5jdGlvbiBvYnNlcnZlKG9iaiwgcHJvcCkge1xuICAgICAgaWYgKCFvYmopXG4gICAgICAgIHJldHVybjtcblxuICAgICAgaWYgKG9iaiA9PT0gcm9vdE9iailcbiAgICAgICAgcm9vdE9ialByb3BzW3Byb3BdID0gdHJ1ZTtcblxuICAgICAgaWYgKG9iamVjdHMuaW5kZXhPZihvYmopIDwgMCkge1xuICAgICAgICBvYmplY3RzLnB1c2gob2JqKTtcbiAgICAgICAgT2JqZWN0Lm9ic2VydmUob2JqLCBjYWxsYmFjayk7XG4gICAgICB9XG5cbiAgICAgIG9ic2VydmUoT2JqZWN0LmdldFByb3RvdHlwZU9mKG9iaiksIHByb3ApO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFsbFJvb3RPYmpOb25PYnNlcnZlZFByb3BzKHJlY3MpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVjcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgcmVjID0gcmVjc1tpXTtcbiAgICAgICAgaWYgKHJlYy5vYmplY3QgIT09IHJvb3RPYmogfHxcbiAgICAgICAgICAgIHJvb3RPYmpQcm9wc1tyZWMubmFtZV0gfHxcbiAgICAgICAgICAgIHJlYy50eXBlID09PSAnc2V0UHJvdG90eXBlJykge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2FsbGJhY2socmVjcykge1xuICAgICAgaWYgKGFsbFJvb3RPYmpOb25PYnNlcnZlZFByb3BzKHJlY3MpKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIHZhciBvYnNlcnZlcjtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2JzZXJ2ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIG9ic2VydmVyID0gb2JzZXJ2ZXJzW2ldO1xuICAgICAgICBpZiAob2JzZXJ2ZXIuc3RhdGVfID09IE9QRU5FRCkge1xuICAgICAgICAgIG9ic2VydmVyLml0ZXJhdGVPYmplY3RzXyhvYnNlcnZlKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9ic2VydmVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICBvYnNlcnZlciA9IG9ic2VydmVyc1tpXTtcbiAgICAgICAgaWYgKG9ic2VydmVyLnN0YXRlXyA9PSBPUEVORUQpIHtcbiAgICAgICAgICBvYnNlcnZlci5jaGVja18oKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHZhciByZWNvcmQgPSB7XG4gICAgICBvYmplY3Q6IHVuZGVmaW5lZCxcbiAgICAgIG9iamVjdHM6IG9iamVjdHMsXG4gICAgICBvcGVuOiBmdW5jdGlvbihvYnMsIG9iamVjdCkge1xuICAgICAgICBpZiAoIXJvb3RPYmopIHtcbiAgICAgICAgICByb290T2JqID0gb2JqZWN0O1xuICAgICAgICAgIHJvb3RPYmpQcm9wcyA9IHt9O1xuICAgICAgICB9XG5cbiAgICAgICAgb2JzZXJ2ZXJzLnB1c2gob2JzKTtcbiAgICAgICAgb2JzZXJ2ZXJDb3VudCsrO1xuICAgICAgICBvYnMuaXRlcmF0ZU9iamVjdHNfKG9ic2VydmUpO1xuICAgICAgfSxcbiAgICAgIGNsb3NlOiBmdW5jdGlvbihvYnMpIHtcbiAgICAgICAgb2JzZXJ2ZXJDb3VudC0tO1xuICAgICAgICBpZiAob2JzZXJ2ZXJDb3VudCA+IDApIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9iamVjdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBPYmplY3QudW5vYnNlcnZlKG9iamVjdHNbaV0sIGNhbGxiYWNrKTtcbiAgICAgICAgICBPYnNlcnZlci51bm9ic2VydmVkQ291bnQrKztcbiAgICAgICAgfVxuXG4gICAgICAgIG9ic2VydmVycy5sZW5ndGggPSAwO1xuICAgICAgICBvYmplY3RzLmxlbmd0aCA9IDA7XG4gICAgICAgIHJvb3RPYmogPSB1bmRlZmluZWQ7XG4gICAgICAgIHJvb3RPYmpQcm9wcyA9IHVuZGVmaW5lZDtcbiAgICAgICAgb2JzZXJ2ZWRTZXRDYWNoZS5wdXNoKHRoaXMpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gcmVjb3JkO1xuICB9XG5cbiAgdmFyIGxhc3RPYnNlcnZlZFNldDtcblxuICB2YXIgVU5PUEVORUQgPSAwO1xuICB2YXIgT1BFTkVEID0gMTtcbiAgdmFyIENMT1NFRCA9IDI7XG5cbiAgdmFyIG5leHRPYnNlcnZlcklkID0gMTtcblxuICBmdW5jdGlvbiBPYnNlcnZlcigpIHtcbiAgICB0aGlzLnN0YXRlXyA9IFVOT1BFTkVEO1xuICAgIHRoaXMuY2FsbGJhY2tfID0gdW5kZWZpbmVkO1xuICAgIHRoaXMudGFyZ2V0XyA9IHVuZGVmaW5lZDsgLy8gVE9ETyhyYWZhZWx3KTogU2hvdWxkIGJlIFdlYWtSZWZcbiAgICB0aGlzLmRpcmVjdE9ic2VydmVyXyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLnZhbHVlXyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLmlkXyA9IG5leHRPYnNlcnZlcklkKys7XG4gIH1cblxuICBPYnNlcnZlci5wcm90b3R5cGUgPSB7XG4gICAgb3BlbjogZnVuY3Rpb24oY2FsbGJhY2ssIHRhcmdldCkge1xuICAgICAgaWYgKHRoaXMuc3RhdGVfICE9IFVOT1BFTkVEKVxuICAgICAgICB0aHJvdyBFcnJvcignT2JzZXJ2ZXIgaGFzIGFscmVhZHkgYmVlbiBvcGVuZWQuJyk7XG5cbiAgICAgIGFkZFRvQWxsKHRoaXMpO1xuICAgICAgdGhpcy5jYWxsYmFja18gPSBjYWxsYmFjaztcbiAgICAgIHRoaXMudGFyZ2V0XyA9IHRhcmdldDtcbiAgICAgIHRoaXMuY29ubmVjdF8oKTtcbiAgICAgIHRoaXMuc3RhdGVfID0gT1BFTkVEO1xuICAgICAgcmV0dXJuIHRoaXMudmFsdWVfO1xuICAgIH0sXG5cbiAgICBjbG9zZTogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5zdGF0ZV8gIT0gT1BFTkVEKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIHJlbW92ZUZyb21BbGwodGhpcyk7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RfKCk7XG4gICAgICB0aGlzLnZhbHVlXyA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMuY2FsbGJhY2tfID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy50YXJnZXRfID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5zdGF0ZV8gPSBDTE9TRUQ7XG4gICAgfSxcblxuICAgIGRlbGl2ZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuc3RhdGVfICE9IE9QRU5FRClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICBkaXJ0eUNoZWNrKHRoaXMpO1xuICAgIH0sXG5cbiAgICByZXBvcnRfOiBmdW5jdGlvbihjaGFuZ2VzKSB7XG4gICAgICB0cnkge1xuICAgICAgICB0aGlzLmNhbGxiYWNrXy5hcHBseSh0aGlzLnRhcmdldF8sIGNoYW5nZXMpO1xuICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgT2JzZXJ2ZXIuX2Vycm9yVGhyb3duRHVyaW5nQ2FsbGJhY2sgPSB0cnVlO1xuICAgICAgICBjb25zb2xlLmVycm9yKCdFeGNlcHRpb24gY2F1Z2h0IGR1cmluZyBvYnNlcnZlciBjYWxsYmFjazogJyArXG4gICAgICAgICAgICAgICAgICAgICAgIChleC5zdGFjayB8fCBleCkpO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBkaXNjYXJkQ2hhbmdlczogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLmNoZWNrXyh1bmRlZmluZWQsIHRydWUpO1xuICAgICAgcmV0dXJuIHRoaXMudmFsdWVfO1xuICAgIH1cbiAgfVxuXG4gIHZhciBjb2xsZWN0T2JzZXJ2ZXJzID0gIWhhc09ic2VydmU7XG4gIHZhciBhbGxPYnNlcnZlcnM7XG4gIE9ic2VydmVyLl9hbGxPYnNlcnZlcnNDb3VudCA9IDA7XG5cbiAgaWYgKGNvbGxlY3RPYnNlcnZlcnMpIHtcbiAgICBhbGxPYnNlcnZlcnMgPSBbXTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZFRvQWxsKG9ic2VydmVyKSB7XG4gICAgT2JzZXJ2ZXIuX2FsbE9ic2VydmVyc0NvdW50Kys7XG4gICAgaWYgKCFjb2xsZWN0T2JzZXJ2ZXJzKVxuICAgICAgcmV0dXJuO1xuXG4gICAgYWxsT2JzZXJ2ZXJzLnB1c2gob2JzZXJ2ZXIpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVtb3ZlRnJvbUFsbChvYnNlcnZlcikge1xuICAgIE9ic2VydmVyLl9hbGxPYnNlcnZlcnNDb3VudC0tO1xuICB9XG5cbiAgdmFyIHJ1bm5pbmdNaWNyb3Rhc2tDaGVja3BvaW50ID0gZmFsc2U7XG5cbiAgdmFyIGhhc0RlYnVnRm9yY2VGdWxsRGVsaXZlcnkgPSBoYXNPYnNlcnZlICYmIGhhc0V2YWwgJiYgKGZ1bmN0aW9uKCkge1xuICAgIHRyeSB7XG4gICAgICBldmFsKCclUnVuTWljcm90YXNrcygpJyk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIChleCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfSkoKTtcblxuICBnbG9iYWwuUGxhdGZvcm0gPSBnbG9iYWwuUGxhdGZvcm0gfHwge307XG5cbiAgZ2xvYmFsLlBsYXRmb3JtLnBlcmZvcm1NaWNyb3Rhc2tDaGVja3BvaW50ID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKHJ1bm5pbmdNaWNyb3Rhc2tDaGVja3BvaW50KVxuICAgICAgcmV0dXJuO1xuXG4gICAgaWYgKGhhc0RlYnVnRm9yY2VGdWxsRGVsaXZlcnkpIHtcbiAgICAgIGV2YWwoJyVSdW5NaWNyb3Rhc2tzKCknKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIWNvbGxlY3RPYnNlcnZlcnMpXG4gICAgICByZXR1cm47XG5cbiAgICBydW5uaW5nTWljcm90YXNrQ2hlY2twb2ludCA9IHRydWU7XG5cbiAgICB2YXIgY3ljbGVzID0gMDtcbiAgICB2YXIgYW55Q2hhbmdlZCwgdG9DaGVjaztcblxuICAgIGRvIHtcbiAgICAgIGN5Y2xlcysrO1xuICAgICAgdG9DaGVjayA9IGFsbE9ic2VydmVycztcbiAgICAgIGFsbE9ic2VydmVycyA9IFtdO1xuICAgICAgYW55Q2hhbmdlZCA9IGZhbHNlO1xuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRvQ2hlY2subGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIG9ic2VydmVyID0gdG9DaGVja1tpXTtcbiAgICAgICAgaWYgKG9ic2VydmVyLnN0YXRlXyAhPSBPUEVORUQpXG4gICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgaWYgKG9ic2VydmVyLmNoZWNrXygpKVxuICAgICAgICAgIGFueUNoYW5nZWQgPSB0cnVlO1xuXG4gICAgICAgIGFsbE9ic2VydmVycy5wdXNoKG9ic2VydmVyKTtcbiAgICAgIH1cbiAgICAgIGlmIChydW5FT01UYXNrcygpKVxuICAgICAgICBhbnlDaGFuZ2VkID0gdHJ1ZTtcbiAgICB9IHdoaWxlIChjeWNsZXMgPCBNQVhfRElSVFlfQ0hFQ0tfQ1lDTEVTICYmIGFueUNoYW5nZWQpO1xuXG4gICAgaWYgKHRlc3RpbmdFeHBvc2VDeWNsZUNvdW50KVxuICAgICAgZ2xvYmFsLmRpcnR5Q2hlY2tDeWNsZUNvdW50ID0gY3ljbGVzO1xuXG4gICAgcnVubmluZ01pY3JvdGFza0NoZWNrcG9pbnQgPSBmYWxzZTtcbiAgfTtcblxuICBpZiAoY29sbGVjdE9ic2VydmVycykge1xuICAgIGdsb2JhbC5QbGF0Zm9ybS5jbGVhck9ic2VydmVycyA9IGZ1bmN0aW9uKCkge1xuICAgICAgYWxsT2JzZXJ2ZXJzID0gW107XG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIE9iamVjdE9ic2VydmVyKG9iamVjdCkge1xuICAgIE9ic2VydmVyLmNhbGwodGhpcyk7XG4gICAgdGhpcy52YWx1ZV8gPSBvYmplY3Q7XG4gICAgdGhpcy5vbGRPYmplY3RfID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgT2JqZWN0T2JzZXJ2ZXIucHJvdG90eXBlID0gY3JlYXRlT2JqZWN0KHtcbiAgICBfX3Byb3RvX186IE9ic2VydmVyLnByb3RvdHlwZSxcblxuICAgIGFycmF5T2JzZXJ2ZTogZmFsc2UsXG5cbiAgICBjb25uZWN0XzogZnVuY3Rpb24oY2FsbGJhY2ssIHRhcmdldCkge1xuICAgICAgaWYgKGhhc09ic2VydmUpIHtcbiAgICAgICAgdGhpcy5kaXJlY3RPYnNlcnZlcl8gPSBnZXRPYnNlcnZlZE9iamVjdCh0aGlzLCB0aGlzLnZhbHVlXyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFycmF5T2JzZXJ2ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm9sZE9iamVjdF8gPSB0aGlzLmNvcHlPYmplY3QodGhpcy52YWx1ZV8pO1xuICAgICAgfVxuXG4gICAgfSxcblxuICAgIGNvcHlPYmplY3Q6IGZ1bmN0aW9uKG9iamVjdCkge1xuICAgICAgdmFyIGNvcHkgPSBBcnJheS5pc0FycmF5KG9iamVjdCkgPyBbXSA6IHt9O1xuICAgICAgZm9yICh2YXIgcHJvcCBpbiBvYmplY3QpIHtcbiAgICAgICAgY29weVtwcm9wXSA9IG9iamVjdFtwcm9wXTtcbiAgICAgIH07XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShvYmplY3QpKVxuICAgICAgICBjb3B5Lmxlbmd0aCA9IG9iamVjdC5sZW5ndGg7XG4gICAgICByZXR1cm4gY29weTtcbiAgICB9LFxuXG4gICAgY2hlY2tfOiBmdW5jdGlvbihjaGFuZ2VSZWNvcmRzLCBza2lwQ2hhbmdlcykge1xuICAgICAgdmFyIGRpZmY7XG4gICAgICB2YXIgb2xkVmFsdWVzO1xuICAgICAgaWYgKGhhc09ic2VydmUpIHtcbiAgICAgICAgaWYgKCFjaGFuZ2VSZWNvcmRzKVxuICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICBvbGRWYWx1ZXMgPSB7fTtcbiAgICAgICAgZGlmZiA9IGRpZmZPYmplY3RGcm9tQ2hhbmdlUmVjb3Jkcyh0aGlzLnZhbHVlXywgY2hhbmdlUmVjb3JkcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGRWYWx1ZXMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb2xkVmFsdWVzID0gdGhpcy5vbGRPYmplY3RfO1xuICAgICAgICBkaWZmID0gZGlmZk9iamVjdEZyb21PbGRPYmplY3QodGhpcy52YWx1ZV8sIHRoaXMub2xkT2JqZWN0Xyk7XG4gICAgICB9XG5cbiAgICAgIGlmIChkaWZmSXNFbXB0eShkaWZmKSlcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICBpZiAoIWhhc09ic2VydmUpXG4gICAgICAgIHRoaXMub2xkT2JqZWN0XyA9IHRoaXMuY29weU9iamVjdCh0aGlzLnZhbHVlXyk7XG5cbiAgICAgIHRoaXMucmVwb3J0XyhbXG4gICAgICAgIGRpZmYuYWRkZWQgfHwge30sXG4gICAgICAgIGRpZmYucmVtb3ZlZCB8fCB7fSxcbiAgICAgICAgZGlmZi5jaGFuZ2VkIHx8IHt9LFxuICAgICAgICBmdW5jdGlvbihwcm9wZXJ0eSkge1xuICAgICAgICAgIHJldHVybiBvbGRWYWx1ZXNbcHJvcGVydHldO1xuICAgICAgICB9XG4gICAgICBdKTtcblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSxcblxuICAgIGRpc2Nvbm5lY3RfOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmIChoYXNPYnNlcnZlKSB7XG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfLmNsb3NlKCk7XG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfID0gdW5kZWZpbmVkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5vbGRPYmplY3RfID0gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBkZWxpdmVyOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLnN0YXRlXyAhPSBPUEVORUQpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgaWYgKGhhc09ic2VydmUpXG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfLmRlbGl2ZXIoZmFsc2UpO1xuICAgICAgZWxzZVxuICAgICAgICBkaXJ0eUNoZWNrKHRoaXMpO1xuICAgIH0sXG5cbiAgICBkaXNjYXJkQ2hhbmdlczogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5kaXJlY3RPYnNlcnZlcl8pXG4gICAgICAgIHRoaXMuZGlyZWN0T2JzZXJ2ZXJfLmRlbGl2ZXIodHJ1ZSk7XG4gICAgICBlbHNlXG4gICAgICAgIHRoaXMub2xkT2JqZWN0XyA9IHRoaXMuY29weU9iamVjdCh0aGlzLnZhbHVlXyk7XG5cbiAgICAgIHJldHVybiB0aGlzLnZhbHVlXztcbiAgICB9XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIEFycmF5T2JzZXJ2ZXIoYXJyYXkpIHtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoYXJyYXkpKVxuICAgICAgdGhyb3cgRXJyb3IoJ1Byb3ZpZGVkIG9iamVjdCBpcyBub3QgYW4gQXJyYXknKTtcbiAgICBPYmplY3RPYnNlcnZlci5jYWxsKHRoaXMsIGFycmF5KTtcbiAgfVxuXG4gIEFycmF5T2JzZXJ2ZXIucHJvdG90eXBlID0gY3JlYXRlT2JqZWN0KHtcblxuICAgIF9fcHJvdG9fXzogT2JqZWN0T2JzZXJ2ZXIucHJvdG90eXBlLFxuXG4gICAgYXJyYXlPYnNlcnZlOiB0cnVlLFxuXG4gICAgY29weU9iamVjdDogZnVuY3Rpb24oYXJyKSB7XG4gICAgICByZXR1cm4gYXJyLnNsaWNlKCk7XG4gICAgfSxcblxuICAgIGNoZWNrXzogZnVuY3Rpb24oY2hhbmdlUmVjb3Jkcykge1xuICAgICAgdmFyIHNwbGljZXM7XG4gICAgICBpZiAoaGFzT2JzZXJ2ZSkge1xuICAgICAgICBpZiAoIWNoYW5nZVJlY29yZHMpXG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICBzcGxpY2VzID0gcHJvamVjdEFycmF5U3BsaWNlcyh0aGlzLnZhbHVlXywgY2hhbmdlUmVjb3Jkcyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzcGxpY2VzID0gY2FsY1NwbGljZXModGhpcy52YWx1ZV8sIDAsIHRoaXMudmFsdWVfLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMub2xkT2JqZWN0XywgMCwgdGhpcy5vbGRPYmplY3RfLmxlbmd0aCk7XG4gICAgICB9XG5cbiAgICAgIGlmICghc3BsaWNlcyB8fCAhc3BsaWNlcy5sZW5ndGgpXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgaWYgKCFoYXNPYnNlcnZlKVxuICAgICAgICB0aGlzLm9sZE9iamVjdF8gPSB0aGlzLmNvcHlPYmplY3QodGhpcy52YWx1ZV8pO1xuXG4gICAgICB0aGlzLnJlcG9ydF8oW3NwbGljZXNdKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfSk7XG5cbiAgQXJyYXlPYnNlcnZlci5hcHBseVNwbGljZXMgPSBmdW5jdGlvbihwcmV2aW91cywgY3VycmVudCwgc3BsaWNlcykge1xuICAgIHNwbGljZXMuZm9yRWFjaChmdW5jdGlvbihzcGxpY2UpIHtcbiAgICAgIHZhciBzcGxpY2VBcmdzID0gW3NwbGljZS5pbmRleCwgc3BsaWNlLnJlbW92ZWQubGVuZ3RoXTtcbiAgICAgIHZhciBhZGRJbmRleCA9IHNwbGljZS5pbmRleDtcbiAgICAgIHdoaWxlIChhZGRJbmRleCA8IHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50KSB7XG4gICAgICAgIHNwbGljZUFyZ3MucHVzaChjdXJyZW50W2FkZEluZGV4XSk7XG4gICAgICAgIGFkZEluZGV4Kys7XG4gICAgICB9XG5cbiAgICAgIEFycmF5LnByb3RvdHlwZS5zcGxpY2UuYXBwbHkocHJldmlvdXMsIHNwbGljZUFyZ3MpO1xuICAgIH0pO1xuICB9O1xuXG4gIHZhciBvYnNlcnZlclNlbnRpbmVsID0ge307XG5cbiAgdmFyIGV4cGVjdGVkUmVjb3JkVHlwZXMgPSB7XG4gICAgYWRkOiB0cnVlLFxuICAgIHVwZGF0ZTogdHJ1ZSxcbiAgICBkZWxldGU6IHRydWVcbiAgfTtcblxuICBmdW5jdGlvbiBkaWZmT2JqZWN0RnJvbUNoYW5nZVJlY29yZHMob2JqZWN0LCBjaGFuZ2VSZWNvcmRzLCBvbGRWYWx1ZXMpIHtcbiAgICB2YXIgYWRkZWQgPSB7fTtcbiAgICB2YXIgcmVtb3ZlZCA9IHt9O1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGFuZ2VSZWNvcmRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgcmVjb3JkID0gY2hhbmdlUmVjb3Jkc1tpXTtcbiAgICAgIGlmICghZXhwZWN0ZWRSZWNvcmRUeXBlc1tyZWNvcmQudHlwZV0pIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignVW5rbm93biBjaGFuZ2VSZWNvcmQgdHlwZTogJyArIHJlY29yZC50eXBlKTtcbiAgICAgICAgY29uc29sZS5lcnJvcihyZWNvcmQpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKCEocmVjb3JkLm5hbWUgaW4gb2xkVmFsdWVzKSlcbiAgICAgICAgb2xkVmFsdWVzW3JlY29yZC5uYW1lXSA9IHJlY29yZC5vbGRWYWx1ZTtcblxuICAgICAgaWYgKHJlY29yZC50eXBlID09ICd1cGRhdGUnKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgaWYgKHJlY29yZC50eXBlID09ICdhZGQnKSB7XG4gICAgICAgIGlmIChyZWNvcmQubmFtZSBpbiByZW1vdmVkKVxuICAgICAgICAgIGRlbGV0ZSByZW1vdmVkW3JlY29yZC5uYW1lXTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGFkZGVkW3JlY29yZC5uYW1lXSA9IHRydWU7XG5cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIHR5cGUgPSAnZGVsZXRlJ1xuICAgICAgaWYgKHJlY29yZC5uYW1lIGluIGFkZGVkKSB7XG4gICAgICAgIGRlbGV0ZSBhZGRlZFtyZWNvcmQubmFtZV07XG4gICAgICAgIGRlbGV0ZSBvbGRWYWx1ZXNbcmVjb3JkLm5hbWVdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVtb3ZlZFtyZWNvcmQubmFtZV0gPSB0cnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAodmFyIHByb3AgaW4gYWRkZWQpXG4gICAgICBhZGRlZFtwcm9wXSA9IG9iamVjdFtwcm9wXTtcblxuICAgIGZvciAodmFyIHByb3AgaW4gcmVtb3ZlZClcbiAgICAgIHJlbW92ZWRbcHJvcF0gPSB1bmRlZmluZWQ7XG5cbiAgICB2YXIgY2hhbmdlZCA9IHt9O1xuICAgIGZvciAodmFyIHByb3AgaW4gb2xkVmFsdWVzKSB7XG4gICAgICBpZiAocHJvcCBpbiBhZGRlZCB8fCBwcm9wIGluIHJlbW92ZWQpXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICB2YXIgbmV3VmFsdWUgPSBvYmplY3RbcHJvcF07XG4gICAgICBpZiAob2xkVmFsdWVzW3Byb3BdICE9PSBuZXdWYWx1ZSlcbiAgICAgICAgY2hhbmdlZFtwcm9wXSA9IG5ld1ZhbHVlO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBhZGRlZDogYWRkZWQsXG4gICAgICByZW1vdmVkOiByZW1vdmVkLFxuICAgICAgY2hhbmdlZDogY2hhbmdlZFxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBuZXdTcGxpY2UoaW5kZXgsIHJlbW92ZWQsIGFkZGVkQ291bnQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgaW5kZXg6IGluZGV4LFxuICAgICAgcmVtb3ZlZDogcmVtb3ZlZCxcbiAgICAgIGFkZGVkQ291bnQ6IGFkZGVkQ291bnRcbiAgICB9O1xuICB9XG5cbiAgdmFyIEVESVRfTEVBVkUgPSAwO1xuICB2YXIgRURJVF9VUERBVEUgPSAxO1xuICB2YXIgRURJVF9BREQgPSAyO1xuICB2YXIgRURJVF9ERUxFVEUgPSAzO1xuXG4gIGZ1bmN0aW9uIEFycmF5U3BsaWNlKCkge31cblxuICBBcnJheVNwbGljZS5wcm90b3R5cGUgPSB7XG5cbiAgICAvLyBOb3RlOiBUaGlzIGZ1bmN0aW9uIGlzICpiYXNlZCogb24gdGhlIGNvbXB1dGF0aW9uIG9mIHRoZSBMZXZlbnNodGVpblxuICAgIC8vIFwiZWRpdFwiIGRpc3RhbmNlLiBUaGUgb25lIGNoYW5nZSBpcyB0aGF0IFwidXBkYXRlc1wiIGFyZSB0cmVhdGVkIGFzIHR3b1xuICAgIC8vIGVkaXRzIC0gbm90IG9uZS4gV2l0aCBBcnJheSBzcGxpY2VzLCBhbiB1cGRhdGUgaXMgcmVhbGx5IGEgZGVsZXRlXG4gICAgLy8gZm9sbG93ZWQgYnkgYW4gYWRkLiBCeSByZXRhaW5pbmcgdGhpcywgd2Ugb3B0aW1pemUgZm9yIFwia2VlcGluZ1wiIHRoZVxuICAgIC8vIG1heGltdW0gYXJyYXkgaXRlbXMgaW4gdGhlIG9yaWdpbmFsIGFycmF5LiBGb3IgZXhhbXBsZTpcbiAgICAvL1xuICAgIC8vICAgJ3h4eHgxMjMnIC0+ICcxMjN5eXl5J1xuICAgIC8vXG4gICAgLy8gV2l0aCAxLWVkaXQgdXBkYXRlcywgdGhlIHNob3J0ZXN0IHBhdGggd291bGQgYmUganVzdCB0byB1cGRhdGUgYWxsIHNldmVuXG4gICAgLy8gY2hhcmFjdGVycy4gV2l0aCAyLWVkaXQgdXBkYXRlcywgd2UgZGVsZXRlIDQsIGxlYXZlIDMsIGFuZCBhZGQgNC4gVGhpc1xuICAgIC8vIGxlYXZlcyB0aGUgc3Vic3RyaW5nICcxMjMnIGludGFjdC5cbiAgICBjYWxjRWRpdERpc3RhbmNlczogZnVuY3Rpb24oY3VycmVudCwgY3VycmVudFN0YXJ0LCBjdXJyZW50RW5kLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGQsIG9sZFN0YXJ0LCBvbGRFbmQpIHtcbiAgICAgIC8vIFwiRGVsZXRpb25cIiBjb2x1bW5zXG4gICAgICB2YXIgcm93Q291bnQgPSBvbGRFbmQgLSBvbGRTdGFydCArIDE7XG4gICAgICB2YXIgY29sdW1uQ291bnQgPSBjdXJyZW50RW5kIC0gY3VycmVudFN0YXJ0ICsgMTtcbiAgICAgIHZhciBkaXN0YW5jZXMgPSBuZXcgQXJyYXkocm93Q291bnQpO1xuXG4gICAgICAvLyBcIkFkZGl0aW9uXCIgcm93cy4gSW5pdGlhbGl6ZSBudWxsIGNvbHVtbi5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcm93Q291bnQ7IGkrKykge1xuICAgICAgICBkaXN0YW5jZXNbaV0gPSBuZXcgQXJyYXkoY29sdW1uQ291bnQpO1xuICAgICAgICBkaXN0YW5jZXNbaV1bMF0gPSBpO1xuICAgICAgfVxuXG4gICAgICAvLyBJbml0aWFsaXplIG51bGwgcm93XG4gICAgICBmb3IgKHZhciBqID0gMDsgaiA8IGNvbHVtbkNvdW50OyBqKyspXG4gICAgICAgIGRpc3RhbmNlc1swXVtqXSA9IGo7XG5cbiAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgcm93Q291bnQ7IGkrKykge1xuICAgICAgICBmb3IgKHZhciBqID0gMTsgaiA8IGNvbHVtbkNvdW50OyBqKyspIHtcbiAgICAgICAgICBpZiAodGhpcy5lcXVhbHMoY3VycmVudFtjdXJyZW50U3RhcnQgKyBqIC0gMV0sIG9sZFtvbGRTdGFydCArIGkgLSAxXSkpXG4gICAgICAgICAgICBkaXN0YW5jZXNbaV1bal0gPSBkaXN0YW5jZXNbaSAtIDFdW2ogLSAxXTtcbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHZhciBub3J0aCA9IGRpc3RhbmNlc1tpIC0gMV1bal0gKyAxO1xuICAgICAgICAgICAgdmFyIHdlc3QgPSBkaXN0YW5jZXNbaV1baiAtIDFdICsgMTtcbiAgICAgICAgICAgIGRpc3RhbmNlc1tpXVtqXSA9IG5vcnRoIDwgd2VzdCA/IG5vcnRoIDogd2VzdDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGRpc3RhbmNlcztcbiAgICB9LFxuXG4gICAgLy8gVGhpcyBzdGFydHMgYXQgdGhlIGZpbmFsIHdlaWdodCwgYW5kIHdhbGtzIFwiYmFja3dhcmRcIiBieSBmaW5kaW5nXG4gICAgLy8gdGhlIG1pbmltdW0gcHJldmlvdXMgd2VpZ2h0IHJlY3Vyc2l2ZWx5IHVudGlsIHRoZSBvcmlnaW4gb2YgdGhlIHdlaWdodFxuICAgIC8vIG1hdHJpeC5cbiAgICBzcGxpY2VPcGVyYXRpb25zRnJvbUVkaXREaXN0YW5jZXM6IGZ1bmN0aW9uKGRpc3RhbmNlcykge1xuICAgICAgdmFyIGkgPSBkaXN0YW5jZXMubGVuZ3RoIC0gMTtcbiAgICAgIHZhciBqID0gZGlzdGFuY2VzWzBdLmxlbmd0aCAtIDE7XG4gICAgICB2YXIgY3VycmVudCA9IGRpc3RhbmNlc1tpXVtqXTtcbiAgICAgIHZhciBlZGl0cyA9IFtdO1xuICAgICAgd2hpbGUgKGkgPiAwIHx8IGogPiAwKSB7XG4gICAgICAgIGlmIChpID09IDApIHtcbiAgICAgICAgICBlZGl0cy5wdXNoKEVESVRfQUREKTtcbiAgICAgICAgICBqLS07XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGogPT0gMCkge1xuICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9ERUxFVEUpO1xuICAgICAgICAgIGktLTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgbm9ydGhXZXN0ID0gZGlzdGFuY2VzW2kgLSAxXVtqIC0gMV07XG4gICAgICAgIHZhciB3ZXN0ID0gZGlzdGFuY2VzW2kgLSAxXVtqXTtcbiAgICAgICAgdmFyIG5vcnRoID0gZGlzdGFuY2VzW2ldW2ogLSAxXTtcblxuICAgICAgICB2YXIgbWluO1xuICAgICAgICBpZiAod2VzdCA8IG5vcnRoKVxuICAgICAgICAgIG1pbiA9IHdlc3QgPCBub3J0aFdlc3QgPyB3ZXN0IDogbm9ydGhXZXN0O1xuICAgICAgICBlbHNlXG4gICAgICAgICAgbWluID0gbm9ydGggPCBub3J0aFdlc3QgPyBub3J0aCA6IG5vcnRoV2VzdDtcblxuICAgICAgICBpZiAobWluID09IG5vcnRoV2VzdCkge1xuICAgICAgICAgIGlmIChub3J0aFdlc3QgPT0gY3VycmVudCkge1xuICAgICAgICAgICAgZWRpdHMucHVzaChFRElUX0xFQVZFKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZWRpdHMucHVzaChFRElUX1VQREFURSk7XG4gICAgICAgICAgICBjdXJyZW50ID0gbm9ydGhXZXN0O1xuICAgICAgICAgIH1cbiAgICAgICAgICBpLS07XG4gICAgICAgICAgai0tO1xuICAgICAgICB9IGVsc2UgaWYgKG1pbiA9PSB3ZXN0KSB7XG4gICAgICAgICAgZWRpdHMucHVzaChFRElUX0RFTEVURSk7XG4gICAgICAgICAgaS0tO1xuICAgICAgICAgIGN1cnJlbnQgPSB3ZXN0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGVkaXRzLnB1c2goRURJVF9BREQpO1xuICAgICAgICAgIGotLTtcbiAgICAgICAgICBjdXJyZW50ID0gbm9ydGg7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZWRpdHMucmV2ZXJzZSgpO1xuICAgICAgcmV0dXJuIGVkaXRzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTcGxpY2UgUHJvamVjdGlvbiBmdW5jdGlvbnM6XG4gICAgICpcbiAgICAgKiBBIHNwbGljZSBtYXAgaXMgYSByZXByZXNlbnRhdGlvbiBvZiBob3cgYSBwcmV2aW91cyBhcnJheSBvZiBpdGVtc1xuICAgICAqIHdhcyB0cmFuc2Zvcm1lZCBpbnRvIGEgbmV3IGFycmF5IG9mIGl0ZW1zLiBDb25jZXB0dWFsbHkgaXQgaXMgYSBsaXN0IG9mXG4gICAgICogdHVwbGVzIG9mXG4gICAgICpcbiAgICAgKiAgIDxpbmRleCwgcmVtb3ZlZCwgYWRkZWRDb3VudD5cbiAgICAgKlxuICAgICAqIHdoaWNoIGFyZSBrZXB0IGluIGFzY2VuZGluZyBpbmRleCBvcmRlciBvZi4gVGhlIHR1cGxlIHJlcHJlc2VudHMgdGhhdCBhdFxuICAgICAqIHRoZSB8aW5kZXh8LCB8cmVtb3ZlZHwgc2VxdWVuY2Ugb2YgaXRlbXMgd2VyZSByZW1vdmVkLCBhbmQgY291bnRpbmcgZm9yd2FyZFxuICAgICAqIGZyb20gfGluZGV4fCwgfGFkZGVkQ291bnR8IGl0ZW1zIHdlcmUgYWRkZWQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBMYWNraW5nIGluZGl2aWR1YWwgc3BsaWNlIG11dGF0aW9uIGluZm9ybWF0aW9uLCB0aGUgbWluaW1hbCBzZXQgb2ZcbiAgICAgKiBzcGxpY2VzIGNhbiBiZSBzeW50aGVzaXplZCBnaXZlbiB0aGUgcHJldmlvdXMgc3RhdGUgYW5kIGZpbmFsIHN0YXRlIG9mIGFuXG4gICAgICogYXJyYXkuIFRoZSBiYXNpYyBhcHByb2FjaCBpcyB0byBjYWxjdWxhdGUgdGhlIGVkaXQgZGlzdGFuY2UgbWF0cml4IGFuZFxuICAgICAqIGNob29zZSB0aGUgc2hvcnRlc3QgcGF0aCB0aHJvdWdoIGl0LlxuICAgICAqXG4gICAgICogQ29tcGxleGl0eTogTyhsICogcClcbiAgICAgKiAgIGw6IFRoZSBsZW5ndGggb2YgdGhlIGN1cnJlbnQgYXJyYXlcbiAgICAgKiAgIHA6IFRoZSBsZW5ndGggb2YgdGhlIG9sZCBhcnJheVxuICAgICAqL1xuICAgIGNhbGNTcGxpY2VzOiBmdW5jdGlvbihjdXJyZW50LCBjdXJyZW50U3RhcnQsIGN1cnJlbnRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIG9sZCwgb2xkU3RhcnQsIG9sZEVuZCkge1xuICAgICAgdmFyIHByZWZpeENvdW50ID0gMDtcbiAgICAgIHZhciBzdWZmaXhDb3VudCA9IDA7XG5cbiAgICAgIHZhciBtaW5MZW5ndGggPSBNYXRoLm1pbihjdXJyZW50RW5kIC0gY3VycmVudFN0YXJ0LCBvbGRFbmQgLSBvbGRTdGFydCk7XG4gICAgICBpZiAoY3VycmVudFN0YXJ0ID09IDAgJiYgb2xkU3RhcnQgPT0gMClcbiAgICAgICAgcHJlZml4Q291bnQgPSB0aGlzLnNoYXJlZFByZWZpeChjdXJyZW50LCBvbGQsIG1pbkxlbmd0aCk7XG5cbiAgICAgIGlmIChjdXJyZW50RW5kID09IGN1cnJlbnQubGVuZ3RoICYmIG9sZEVuZCA9PSBvbGQubGVuZ3RoKVxuICAgICAgICBzdWZmaXhDb3VudCA9IHRoaXMuc2hhcmVkU3VmZml4KGN1cnJlbnQsIG9sZCwgbWluTGVuZ3RoIC0gcHJlZml4Q291bnQpO1xuXG4gICAgICBjdXJyZW50U3RhcnQgKz0gcHJlZml4Q291bnQ7XG4gICAgICBvbGRTdGFydCArPSBwcmVmaXhDb3VudDtcbiAgICAgIGN1cnJlbnRFbmQgLT0gc3VmZml4Q291bnQ7XG4gICAgICBvbGRFbmQgLT0gc3VmZml4Q291bnQ7XG5cbiAgICAgIGlmIChjdXJyZW50RW5kIC0gY3VycmVudFN0YXJ0ID09IDAgJiYgb2xkRW5kIC0gb2xkU3RhcnQgPT0gMClcbiAgICAgICAgcmV0dXJuIFtdO1xuXG4gICAgICBpZiAoY3VycmVudFN0YXJ0ID09IGN1cnJlbnRFbmQpIHtcbiAgICAgICAgdmFyIHNwbGljZSA9IG5ld1NwbGljZShjdXJyZW50U3RhcnQsIFtdLCAwKTtcbiAgICAgICAgd2hpbGUgKG9sZFN0YXJ0IDwgb2xkRW5kKVxuICAgICAgICAgIHNwbGljZS5yZW1vdmVkLnB1c2gob2xkW29sZFN0YXJ0KytdKTtcblxuICAgICAgICByZXR1cm4gWyBzcGxpY2UgXTtcbiAgICAgIH0gZWxzZSBpZiAob2xkU3RhcnQgPT0gb2xkRW5kKVxuICAgICAgICByZXR1cm4gWyBuZXdTcGxpY2UoY3VycmVudFN0YXJ0LCBbXSwgY3VycmVudEVuZCAtIGN1cnJlbnRTdGFydCkgXTtcblxuICAgICAgdmFyIG9wcyA9IHRoaXMuc3BsaWNlT3BlcmF0aW9uc0Zyb21FZGl0RGlzdGFuY2VzKFxuICAgICAgICAgIHRoaXMuY2FsY0VkaXREaXN0YW5jZXMoY3VycmVudCwgY3VycmVudFN0YXJ0LCBjdXJyZW50RW5kLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkLCBvbGRTdGFydCwgb2xkRW5kKSk7XG5cbiAgICAgIHZhciBzcGxpY2UgPSB1bmRlZmluZWQ7XG4gICAgICB2YXIgc3BsaWNlcyA9IFtdO1xuICAgICAgdmFyIGluZGV4ID0gY3VycmVudFN0YXJ0O1xuICAgICAgdmFyIG9sZEluZGV4ID0gb2xkU3RhcnQ7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9wcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBzd2l0Y2gob3BzW2ldKSB7XG4gICAgICAgICAgY2FzZSBFRElUX0xFQVZFOlxuICAgICAgICAgICAgaWYgKHNwbGljZSkge1xuICAgICAgICAgICAgICBzcGxpY2VzLnB1c2goc3BsaWNlKTtcbiAgICAgICAgICAgICAgc3BsaWNlID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpbmRleCsrO1xuICAgICAgICAgICAgb2xkSW5kZXgrKztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgRURJVF9VUERBVEU6XG4gICAgICAgICAgICBpZiAoIXNwbGljZSlcbiAgICAgICAgICAgICAgc3BsaWNlID0gbmV3U3BsaWNlKGluZGV4LCBbXSwgMCk7XG5cbiAgICAgICAgICAgIHNwbGljZS5hZGRlZENvdW50Kys7XG4gICAgICAgICAgICBpbmRleCsrO1xuXG4gICAgICAgICAgICBzcGxpY2UucmVtb3ZlZC5wdXNoKG9sZFtvbGRJbmRleF0pO1xuICAgICAgICAgICAgb2xkSW5kZXgrKztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgRURJVF9BREQ6XG4gICAgICAgICAgICBpZiAoIXNwbGljZSlcbiAgICAgICAgICAgICAgc3BsaWNlID0gbmV3U3BsaWNlKGluZGV4LCBbXSwgMCk7XG5cbiAgICAgICAgICAgIHNwbGljZS5hZGRlZENvdW50Kys7XG4gICAgICAgICAgICBpbmRleCsrO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBFRElUX0RFTEVURTpcbiAgICAgICAgICAgIGlmICghc3BsaWNlKVxuICAgICAgICAgICAgICBzcGxpY2UgPSBuZXdTcGxpY2UoaW5kZXgsIFtdLCAwKTtcblxuICAgICAgICAgICAgc3BsaWNlLnJlbW92ZWQucHVzaChvbGRbb2xkSW5kZXhdKTtcbiAgICAgICAgICAgIG9sZEluZGV4Kys7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoc3BsaWNlKSB7XG4gICAgICAgIHNwbGljZXMucHVzaChzcGxpY2UpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHNwbGljZXM7XG4gICAgfSxcblxuICAgIHNoYXJlZFByZWZpeDogZnVuY3Rpb24oY3VycmVudCwgb2xkLCBzZWFyY2hMZW5ndGgpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2VhcmNoTGVuZ3RoOyBpKyspXG4gICAgICAgIGlmICghdGhpcy5lcXVhbHMoY3VycmVudFtpXSwgb2xkW2ldKSlcbiAgICAgICAgICByZXR1cm4gaTtcbiAgICAgIHJldHVybiBzZWFyY2hMZW5ndGg7XG4gICAgfSxcblxuICAgIHNoYXJlZFN1ZmZpeDogZnVuY3Rpb24oY3VycmVudCwgb2xkLCBzZWFyY2hMZW5ndGgpIHtcbiAgICAgIHZhciBpbmRleDEgPSBjdXJyZW50Lmxlbmd0aDtcbiAgICAgIHZhciBpbmRleDIgPSBvbGQubGVuZ3RoO1xuICAgICAgdmFyIGNvdW50ID0gMDtcbiAgICAgIHdoaWxlIChjb3VudCA8IHNlYXJjaExlbmd0aCAmJiB0aGlzLmVxdWFscyhjdXJyZW50Wy0taW5kZXgxXSwgb2xkWy0taW5kZXgyXSkpXG4gICAgICAgIGNvdW50Kys7XG5cbiAgICAgIHJldHVybiBjb3VudDtcbiAgICB9LFxuXG4gICAgY2FsY3VsYXRlU3BsaWNlczogZnVuY3Rpb24oY3VycmVudCwgcHJldmlvdXMpIHtcbiAgICAgIHJldHVybiB0aGlzLmNhbGNTcGxpY2VzKGN1cnJlbnQsIDAsIGN1cnJlbnQubGVuZ3RoLCBwcmV2aW91cywgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByZXZpb3VzLmxlbmd0aCk7XG4gICAgfSxcblxuICAgIGVxdWFsczogZnVuY3Rpb24oY3VycmVudFZhbHVlLCBwcmV2aW91c1ZhbHVlKSB7XG4gICAgICByZXR1cm4gY3VycmVudFZhbHVlID09PSBwcmV2aW91c1ZhbHVlO1xuICAgIH1cbiAgfTtcblxuICB2YXIgYXJyYXlTcGxpY2UgPSBuZXcgQXJyYXlTcGxpY2UoKTtcblxuICBmdW5jdGlvbiBjYWxjU3BsaWNlcyhjdXJyZW50LCBjdXJyZW50U3RhcnQsIGN1cnJlbnRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgIG9sZCwgb2xkU3RhcnQsIG9sZEVuZCkge1xuICAgIHJldHVybiBhcnJheVNwbGljZS5jYWxjU3BsaWNlcyhjdXJyZW50LCBjdXJyZW50U3RhcnQsIGN1cnJlbnRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZCwgb2xkU3RhcnQsIG9sZEVuZCk7XG4gIH1cblxuICBmdW5jdGlvbiBpbnRlcnNlY3Qoc3RhcnQxLCBlbmQxLCBzdGFydDIsIGVuZDIpIHtcbiAgICAvLyBEaXNqb2ludFxuICAgIGlmIChlbmQxIDwgc3RhcnQyIHx8IGVuZDIgPCBzdGFydDEpXG4gICAgICByZXR1cm4gLTE7XG5cbiAgICAvLyBBZGphY2VudFxuICAgIGlmIChlbmQxID09IHN0YXJ0MiB8fCBlbmQyID09IHN0YXJ0MSlcbiAgICAgIHJldHVybiAwO1xuXG4gICAgLy8gTm9uLXplcm8gaW50ZXJzZWN0LCBzcGFuMSBmaXJzdFxuICAgIGlmIChzdGFydDEgPCBzdGFydDIpIHtcbiAgICAgIGlmIChlbmQxIDwgZW5kMilcbiAgICAgICAgcmV0dXJuIGVuZDEgLSBzdGFydDI7IC8vIE92ZXJsYXBcbiAgICAgIGVsc2VcbiAgICAgICAgcmV0dXJuIGVuZDIgLSBzdGFydDI7IC8vIENvbnRhaW5lZFxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBOb24temVybyBpbnRlcnNlY3QsIHNwYW4yIGZpcnN0XG4gICAgICBpZiAoZW5kMiA8IGVuZDEpXG4gICAgICAgIHJldHVybiBlbmQyIC0gc3RhcnQxOyAvLyBPdmVybGFwXG4gICAgICBlbHNlXG4gICAgICAgIHJldHVybiBlbmQxIC0gc3RhcnQxOyAvLyBDb250YWluZWRcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBtZXJnZVNwbGljZShzcGxpY2VzLCBpbmRleCwgcmVtb3ZlZCwgYWRkZWRDb3VudCkge1xuXG4gICAgdmFyIHNwbGljZSA9IG5ld1NwbGljZShpbmRleCwgcmVtb3ZlZCwgYWRkZWRDb3VudCk7XG5cbiAgICB2YXIgaW5zZXJ0ZWQgPSBmYWxzZTtcbiAgICB2YXIgaW5zZXJ0aW9uT2Zmc2V0ID0gMDtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3BsaWNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGN1cnJlbnQgPSBzcGxpY2VzW2ldO1xuICAgICAgY3VycmVudC5pbmRleCArPSBpbnNlcnRpb25PZmZzZXQ7XG5cbiAgICAgIGlmIChpbnNlcnRlZClcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIHZhciBpbnRlcnNlY3RDb3VudCA9IGludGVyc2VjdChzcGxpY2UuaW5kZXgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3BsaWNlLmluZGV4ICsgc3BsaWNlLnJlbW92ZWQubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnQuaW5kZXgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudC5pbmRleCArIGN1cnJlbnQuYWRkZWRDb3VudCk7XG5cbiAgICAgIGlmIChpbnRlcnNlY3RDb3VudCA+PSAwKSB7XG4gICAgICAgIC8vIE1lcmdlIHRoZSB0d28gc3BsaWNlc1xuXG4gICAgICAgIHNwbGljZXMuc3BsaWNlKGksIDEpO1xuICAgICAgICBpLS07XG5cbiAgICAgICAgaW5zZXJ0aW9uT2Zmc2V0IC09IGN1cnJlbnQuYWRkZWRDb3VudCAtIGN1cnJlbnQucmVtb3ZlZC5sZW5ndGg7XG5cbiAgICAgICAgc3BsaWNlLmFkZGVkQ291bnQgKz0gY3VycmVudC5hZGRlZENvdW50IC0gaW50ZXJzZWN0Q291bnQ7XG4gICAgICAgIHZhciBkZWxldGVDb3VudCA9IHNwbGljZS5yZW1vdmVkLmxlbmd0aCArXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnQucmVtb3ZlZC5sZW5ndGggLSBpbnRlcnNlY3RDb3VudDtcblxuICAgICAgICBpZiAoIXNwbGljZS5hZGRlZENvdW50ICYmICFkZWxldGVDb3VudCkge1xuICAgICAgICAgIC8vIG1lcmdlZCBzcGxpY2UgaXMgYSBub29wLiBkaXNjYXJkLlxuICAgICAgICAgIGluc2VydGVkID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YXIgcmVtb3ZlZCA9IGN1cnJlbnQucmVtb3ZlZDtcblxuICAgICAgICAgIGlmIChzcGxpY2UuaW5kZXggPCBjdXJyZW50LmluZGV4KSB7XG4gICAgICAgICAgICAvLyBzb21lIHByZWZpeCBvZiBzcGxpY2UucmVtb3ZlZCBpcyBwcmVwZW5kZWQgdG8gY3VycmVudC5yZW1vdmVkLlxuICAgICAgICAgICAgdmFyIHByZXBlbmQgPSBzcGxpY2UucmVtb3ZlZC5zbGljZSgwLCBjdXJyZW50LmluZGV4IC0gc3BsaWNlLmluZGV4KTtcbiAgICAgICAgICAgIEFycmF5LnByb3RvdHlwZS5wdXNoLmFwcGx5KHByZXBlbmQsIHJlbW92ZWQpO1xuICAgICAgICAgICAgcmVtb3ZlZCA9IHByZXBlbmQ7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHNwbGljZS5pbmRleCArIHNwbGljZS5yZW1vdmVkLmxlbmd0aCA+IGN1cnJlbnQuaW5kZXggKyBjdXJyZW50LmFkZGVkQ291bnQpIHtcbiAgICAgICAgICAgIC8vIHNvbWUgc3VmZml4IG9mIHNwbGljZS5yZW1vdmVkIGlzIGFwcGVuZGVkIHRvIGN1cnJlbnQucmVtb3ZlZC5cbiAgICAgICAgICAgIHZhciBhcHBlbmQgPSBzcGxpY2UucmVtb3ZlZC5zbGljZShjdXJyZW50LmluZGV4ICsgY3VycmVudC5hZGRlZENvdW50IC0gc3BsaWNlLmluZGV4KTtcbiAgICAgICAgICAgIEFycmF5LnByb3RvdHlwZS5wdXNoLmFwcGx5KHJlbW92ZWQsIGFwcGVuZCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgc3BsaWNlLnJlbW92ZWQgPSByZW1vdmVkO1xuICAgICAgICAgIGlmIChjdXJyZW50LmluZGV4IDwgc3BsaWNlLmluZGV4KSB7XG4gICAgICAgICAgICBzcGxpY2UuaW5kZXggPSBjdXJyZW50LmluZGV4O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChzcGxpY2UuaW5kZXggPCBjdXJyZW50LmluZGV4KSB7XG4gICAgICAgIC8vIEluc2VydCBzcGxpY2UgaGVyZS5cblxuICAgICAgICBpbnNlcnRlZCA9IHRydWU7XG5cbiAgICAgICAgc3BsaWNlcy5zcGxpY2UoaSwgMCwgc3BsaWNlKTtcbiAgICAgICAgaSsrO1xuXG4gICAgICAgIHZhciBvZmZzZXQgPSBzcGxpY2UuYWRkZWRDb3VudCAtIHNwbGljZS5yZW1vdmVkLmxlbmd0aFxuICAgICAgICBjdXJyZW50LmluZGV4ICs9IG9mZnNldDtcbiAgICAgICAgaW5zZXJ0aW9uT2Zmc2V0ICs9IG9mZnNldDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIWluc2VydGVkKVxuICAgICAgc3BsaWNlcy5wdXNoKHNwbGljZSk7XG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVJbml0aWFsU3BsaWNlcyhhcnJheSwgY2hhbmdlUmVjb3Jkcykge1xuICAgIHZhciBzcGxpY2VzID0gW107XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoYW5nZVJlY29yZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciByZWNvcmQgPSBjaGFuZ2VSZWNvcmRzW2ldO1xuICAgICAgc3dpdGNoKHJlY29yZC50eXBlKSB7XG4gICAgICAgIGNhc2UgJ3NwbGljZSc6XG4gICAgICAgICAgbWVyZ2VTcGxpY2Uoc3BsaWNlcywgcmVjb3JkLmluZGV4LCByZWNvcmQucmVtb3ZlZC5zbGljZSgpLCByZWNvcmQuYWRkZWRDb3VudCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2FkZCc6XG4gICAgICAgIGNhc2UgJ3VwZGF0ZSc6XG4gICAgICAgIGNhc2UgJ2RlbGV0ZSc6XG4gICAgICAgICAgaWYgKCFpc0luZGV4KHJlY29yZC5uYW1lKSlcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIHZhciBpbmRleCA9IHRvTnVtYmVyKHJlY29yZC5uYW1lKTtcbiAgICAgICAgICBpZiAoaW5kZXggPCAwKVxuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgbWVyZ2VTcGxpY2Uoc3BsaWNlcywgaW5kZXgsIFtyZWNvcmQub2xkVmFsdWVdLCAxKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCdVbmV4cGVjdGVkIHJlY29yZCB0eXBlOiAnICsgSlNPTi5zdHJpbmdpZnkocmVjb3JkKSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHNwbGljZXM7XG4gIH1cblxuICBmdW5jdGlvbiBwcm9qZWN0QXJyYXlTcGxpY2VzKGFycmF5LCBjaGFuZ2VSZWNvcmRzKSB7XG4gICAgdmFyIHNwbGljZXMgPSBbXTtcblxuICAgIGNyZWF0ZUluaXRpYWxTcGxpY2VzKGFycmF5LCBjaGFuZ2VSZWNvcmRzKS5mb3JFYWNoKGZ1bmN0aW9uKHNwbGljZSkge1xuICAgICAgaWYgKHNwbGljZS5hZGRlZENvdW50ID09IDEgJiYgc3BsaWNlLnJlbW92ZWQubGVuZ3RoID09IDEpIHtcbiAgICAgICAgaWYgKHNwbGljZS5yZW1vdmVkWzBdICE9PSBhcnJheVtzcGxpY2UuaW5kZXhdKVxuICAgICAgICAgIHNwbGljZXMucHVzaChzcGxpY2UpO1xuXG4gICAgICAgIHJldHVyblxuICAgICAgfTtcblxuICAgICAgc3BsaWNlcyA9IHNwbGljZXMuY29uY2F0KGNhbGNTcGxpY2VzKGFycmF5LCBzcGxpY2UuaW5kZXgsIHNwbGljZS5pbmRleCArIHNwbGljZS5hZGRlZENvdW50LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNwbGljZS5yZW1vdmVkLCAwLCBzcGxpY2UucmVtb3ZlZC5sZW5ndGgpKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBzcGxpY2VzO1xuICB9XG5cbiAvLyBFeHBvcnQgdGhlIG9ic2VydmUtanMgb2JqZWN0IGZvciAqKk5vZGUuanMqKiwgd2l0aFxuLy8gYmFja3dhcmRzLWNvbXBhdGliaWxpdHkgZm9yIHRoZSBvbGQgYHJlcXVpcmUoKWAgQVBJLiBJZiB3ZSdyZSBpblxuLy8gdGhlIGJyb3dzZXIsIGV4cG9ydCBhcyBhIGdsb2JhbCBvYmplY3QuXG52YXIgZXhwb3NlID0gZ2xvYmFsO1xuaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG5leHBvc2UgPSBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHM7XG59XG5leHBvc2UgPSBleHBvcnRzO1xufVxuZXhwb3NlLk9ic2VydmVyID0gT2JzZXJ2ZXI7XG5leHBvc2UuT2JzZXJ2ZXIucnVuRU9NXyA9IHJ1bkVPTTtcbmV4cG9zZS5PYnNlcnZlci5vYnNlcnZlclNlbnRpbmVsXyA9IG9ic2VydmVyU2VudGluZWw7IC8vIGZvciB0ZXN0aW5nLlxuZXhwb3NlLk9ic2VydmVyLmhhc09iamVjdE9ic2VydmUgPSBoYXNPYnNlcnZlO1xuZXhwb3NlLkFycmF5T2JzZXJ2ZXIgPSBBcnJheU9ic2VydmVyO1xuZXhwb3NlLkFycmF5T2JzZXJ2ZXIuY2FsY3VsYXRlU3BsaWNlcyA9IGZ1bmN0aW9uKGN1cnJlbnQsIHByZXZpb3VzKSB7XG5yZXR1cm4gYXJyYXlTcGxpY2UuY2FsY3VsYXRlU3BsaWNlcyhjdXJyZW50LCBwcmV2aW91cyk7XG59O1xuZXhwb3NlLlBsYXRmb3JtID0gZ2xvYmFsLlBsYXRmb3JtO1xuZXhwb3NlLkFycmF5U3BsaWNlID0gQXJyYXlTcGxpY2U7XG5leHBvc2UuT2JqZWN0T2JzZXJ2ZXIgPSBPYmplY3RPYnNlcnZlcjtcbn0pKHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnICYmIGdsb2JhbCAmJiB0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUgPyBnbG9iYWwgOiB0aGlzIHx8IHdpbmRvdyk7XG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vdmVuZG9yL29ic2VydmUtanMvc3JjL29ic2VydmUuanNcbiAqKiBtb2R1bGUgaWQgPSAyM1xuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuZnVuY3Rpb24gQ29sbGVjdGlvblJlZ2lzdHJ5KCkge1xuICBpZiAoIXRoaXMpIHJldHVybiBuZXcgQ29sbGVjdGlvblJlZ2lzdHJ5KCk7XG4gIHRoaXMuY29sbGVjdGlvbk5hbWVzID0gW107XG59XG5cbnV0aWwuZXh0ZW5kKENvbGxlY3Rpb25SZWdpc3RyeS5wcm90b3R5cGUsIHtcbiAgcmVnaXN0ZXI6IGZ1bmN0aW9uKGNvbGxlY3Rpb24pIHtcbiAgICB2YXIgbmFtZSA9IGNvbGxlY3Rpb24ubmFtZTtcbiAgICB0aGlzW25hbWVdID0gY29sbGVjdGlvbjtcbiAgICB0aGlzLmNvbGxlY3Rpb25OYW1lcy5wdXNoKG5hbWUpO1xuICB9LFxuICByZXNldDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMuY29sbGVjdGlvbk5hbWVzLmZvckVhY2goZnVuY3Rpb24obmFtZSkge1xuICAgICAgZGVsZXRlIHNlbGZbbmFtZV07XG4gICAgfSk7XG4gICAgdGhpcy5jb2xsZWN0aW9uTmFtZXMgPSBbXTtcbiAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gQ29sbGVjdGlvblJlZ2lzdHJ5O1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvY29sbGVjdGlvblJlZ2lzdHJ5LmpzXG4gKiogbW9kdWxlIGlkID0gMjRcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXG4gIGFyZ3NhcnJheSA9IHJlcXVpcmUoJ2FyZ3NhcnJheScpO1xuXG5mdW5jdGlvbiBDb25kaXRpb24oZm4sIGxhenkpIHtcbiAgaWYgKGxhenkgPT09IHVuZGVmaW5lZCB8fCBsYXp5ID09PSBudWxsKSB7XG4gICAgbGF6eSA9IHRydWU7XG4gIH1cbiAgZm4gPSBmbiB8fCBmdW5jdGlvbihkb25lKSB7XG4gICAgZG9uZSgpO1xuICB9O1xuXG4gIHRoaXMuX3Byb21pc2UgPSBuZXcgdXRpbC5Qcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgIHRoaXMucmVqZWN0ID0gcmVqZWN0O1xuICAgIHRoaXMucmVzb2x2ZSA9IHJlc29sdmU7XG4gICAgdGhpcy5mbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5leGVjdXRlZCA9IHRydWU7XG4gICAgICB2YXIgbnVtQ29tcGxldGUgPSAwO1xuICAgICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICAgIHZhciBlcnJvcnMgPSBbXTtcbiAgICAgIGlmICh1dGlsLmlzQXJyYXkoZm4pKSB7XG4gICAgICAgIHZhciBjaGVja0NvbXBsZXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKG51bUNvbXBsZXRlID09IGZuLmxlbmd0aCkge1xuICAgICAgICAgICAgaWYgKGVycm9ycy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgcmVqZWN0KGVycm9ycyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgcmVzb2x2ZShyZXN1bHRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgICAgZm4uZm9yRWFjaChmdW5jdGlvbihjb25kLCBpZHgpIHtcbiAgICAgICAgICBjb25kXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbihyZXMpIHtcbiAgICAgICAgICAgICAgcmVzdWx0c1tpZHhdID0gcmVzO1xuICAgICAgICAgICAgICBudW1Db21wbGV0ZSsrO1xuICAgICAgICAgICAgICBjaGVja0NvbXBsZXRlKCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICBlcnJvcnNbaWR4XSA9IGVycjtcbiAgICAgICAgICAgICAgbnVtQ29tcGxldGUrKztcbiAgICAgICAgICAgICAgY2hlY2tDb21wbGV0ZSgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGZuKGZ1bmN0aW9uKGVyciwgcmVzKSB7XG4gICAgICAgICAgaWYgKGVycikgcmVqZWN0KGVycik7XG4gICAgICAgICAgZWxzZSByZXNvbHZlKHJlcyk7XG4gICAgICAgIH0uYmluZCh0aGlzKSlcbiAgICAgIH1cbiAgICB9XG4gIH0uYmluZCh0aGlzKSk7XG5cbiAgaWYgKCFsYXp5KSB0aGlzLl9leGVjdXRlKCk7XG4gIHRoaXMuZXhlY3V0ZWQgPSBmYWxzZTtcbiAgdGhpcy5kZXBlbmRlbnQgPSBbXTtcbn1cblxuQ29uZGl0aW9uLmFsbCA9IGFyZ3NhcnJheShmdW5jdGlvbihhcmdzKSB7XG4gIHJldHVybiBuZXcgQ29uZGl0aW9uKGFyZ3MpO1xufSk7XG5cbkNvbmRpdGlvbi5wcm90b3R5cGUgPSB7XG4gIF9leGVjdXRlOiBmdW5jdGlvbigpIHtcbiAgICBpZiAoIXRoaXMuZXhlY3V0ZWQpIHtcbiAgICAgIFByb21pc2VcbiAgICAgICAgLmFsbCh1dGlsLnBsdWNrKHRoaXMuZGVwZW5kZW50LCAnX3Byb21pc2UnKSlcbiAgICAgICAgLnRoZW4odGhpcy5mbilcbiAgICAgICAgLmNhdGNoKHRoaXMucmVqZWN0LmJpbmQodGhpcykpO1xuICAgICAgdGhpcy5kZXBlbmRlbnQuZm9yRWFjaChmdW5jdGlvbihkKSB7XG4gICAgICAgIGQuX2V4ZWN1dGUoKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcbiAgdGhlbjogZnVuY3Rpb24oc3VjY2VzcywgZmFpbCkge1xuICAgIHRoaXMuX2V4ZWN1dGUoKTtcbiAgICB0aGlzLl9wcm9taXNlLnRoZW4oc3VjY2VzcywgZmFpbCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG4gIGNhdGNoOiBmdW5jdGlvbihmYWlsKSB7XG4gICAgdGhpcy5fZXhlY3V0ZSgpO1xuICAgIHRoaXMuX3Byb21pc2UuY2F0Y2goZmFpbCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG4gIHJlc29sdmU6IGZ1bmN0aW9uKHJlcykge1xuICAgIHRoaXMuZXhlY3V0ZWQgPSB0cnVlO1xuICAgIHRoaXMuX3Byb21pc2UucmVzb2x2ZShyZXMpO1xuICB9LFxuICByZWplY3Q6IGZ1bmN0aW9uKGVycikge1xuICAgIHRoaXMuZXhlY3V0ZWQgPSB0cnVlO1xuICAgIHRoaXMuX3Byb21pc2UucmVqZWN0KGVycik7XG4gIH0sXG4gIGRlcGVuZGVudE9uOiBmdW5jdGlvbihjb25kKSB7XG4gICAgdGhpcy5kZXBlbmRlbnQucHVzaChjb25kKTtcbiAgfSxcbiAgcmVzZXQ6IGZ1bmN0aW9uKCkge1xuXG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ29uZGl0aW9uO1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvY29uZGl0aW9uLmpzXG4gKiogbW9kdWxlIGlkID0gMjVcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG5cbi8qKlxuICogQWN0cyBhcyBhIHBsYWNlaG9sZGVyIGZvciB2YXJpb3VzIG9iamVjdHMgZS5nLiBsYXp5IHJlZ2lzdHJhdGlvbiBvZiBtb2RlbHMuXG4gKiBAcGFyYW0gW29wdHNdXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gUGxhY2Vob2xkZXIob3B0cykge1xuICB1dGlsLmV4dGVuZCh0aGlzLCBvcHRzIHx8IHt9KTtcbiAgdGhpcy5pc1BsYWNlaG9sZGVyID0gdHJ1ZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBQbGFjZWhvbGRlcjtcblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vY29yZS9QbGFjZWhvbGRlci5qc1xuICoqIG1vZHVsZSBpZCA9IDI2XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgbG9nID0gcmVxdWlyZSgnLi9sb2cnKSgnbW9kZWwnKSxcbiAgSW50ZXJuYWxTaWVzdGFFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3InKS5JbnRlcm5hbFNpZXN0YUVycm9yLFxuICBSZWxhdGlvbnNoaXBUeXBlID0gcmVxdWlyZSgnLi9SZWxhdGlvbnNoaXBUeXBlJyksXG4gIFF1ZXJ5ID0gcmVxdWlyZSgnLi9RdWVyeScpLFxuICBNb2RlbEluc3RhbmNlID0gcmVxdWlyZSgnLi9Nb2RlbEluc3RhbmNlJyksXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcbiAgZ3VpZCA9IHV0aWwuZ3VpZCxcbiAgZXh0ZW5kID0gcmVxdWlyZSgnZXh0ZW5kJyksXG4gIG1vZGVsRXZlbnRzID0gcmVxdWlyZSgnLi9tb2RlbEV2ZW50cycpLFxuICB3cmFwQXJyYXkgPSBtb2RlbEV2ZW50cy53cmFwQXJyYXksXG4gIE9uZVRvTWFueVByb3h5ID0gcmVxdWlyZSgnLi9PbmVUb01hbnlQcm94eScpLFxuICBPbmVUb09uZVByb3h5ID0gcmVxdWlyZSgnLi9PbmVUb09uZVByb3h5JyksXG4gIE1hbnlUb01hbnlQcm94eSA9IHJlcXVpcmUoJy4vTWFueVRvTWFueVByb3h5JyksXG4gIFJlYWN0aXZlUXVlcnkgPSByZXF1aXJlKCcuL1JlYWN0aXZlUXVlcnknKSxcbiAgTW9kZWxFdmVudFR5cGUgPSBtb2RlbEV2ZW50cy5Nb2RlbEV2ZW50VHlwZTtcblxuZnVuY3Rpb24gTW9kZWxJbnN0YW5jZUZhY3RvcnkobW9kZWwpIHtcbiAgdGhpcy5tb2RlbCA9IG1vZGVsO1xufVxuXG5Nb2RlbEluc3RhbmNlRmFjdG9yeS5wcm90b3R5cGUgPSB7XG4gIF9nZXRMb2NhbElkOiBmdW5jdGlvbihkYXRhKSB7XG4gICAgdmFyIGxvY2FsSWQ7XG4gICAgaWYgKGRhdGEpIHtcbiAgICAgIGxvY2FsSWQgPSBkYXRhLmxvY2FsSWQgPyBkYXRhLmxvY2FsSWQgOiBndWlkKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvY2FsSWQgPSBndWlkKCk7XG4gICAgfVxuICAgIHJldHVybiBsb2NhbElkO1xuICB9LFxuICAvKipcbiAgICogQ29uZmlndXJlIGF0dHJpYnV0ZXNcbiAgICogQHBhcmFtIG1vZGVsSW5zdGFuY2VcbiAgICogQHBhcmFtIGRhdGFcbiAgICogQHByaXZhdGVcbiAgICovXG5cbiAgX2luc3RhbGxBdHRyaWJ1dGVzOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlLCBkYXRhKSB7XG4gICAgdmFyIE1vZGVsID0gdGhpcy5tb2RlbCxcbiAgICAgIGF0dHJpYnV0ZU5hbWVzID0gTW9kZWwuX2F0dHJpYnV0ZU5hbWVzLFxuICAgICAgaWR4ID0gYXR0cmlidXRlTmFtZXMuaW5kZXhPZihNb2RlbC5pZCk7XG4gICAgdXRpbC5leHRlbmQobW9kZWxJbnN0YW5jZSwge1xuICAgICAgX192YWx1ZXM6IHV0aWwuZXh0ZW5kKE1vZGVsLmF0dHJpYnV0ZXMucmVkdWNlKGZ1bmN0aW9uKG0sIGEpIHtcbiAgICAgICAgaWYgKGEuZGVmYXVsdCAhPT0gdW5kZWZpbmVkKSBtW2EubmFtZV0gPSBhLmRlZmF1bHQ7XG4gICAgICAgIHJldHVybiBtO1xuICAgICAgfSwge30pLCBkYXRhIHx8IHt9KVxuICAgIH0pO1xuICAgIGlmIChpZHggPiAtMSkgYXR0cmlidXRlTmFtZXMuc3BsaWNlKGlkeCwgMSk7XG5cbiAgICBhdHRyaWJ1dGVOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uKGF0dHJpYnV0ZU5hbWUpIHtcbiAgICAgIHZhciBhdHRyaWJ1dGVEZWZpbml0aW9uID0gTW9kZWwuX2F0dHJpYnV0ZURlZmluaXRpb25XaXRoTmFtZShhdHRyaWJ1dGVOYW1lKTtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShtb2RlbEluc3RhbmNlLCBhdHRyaWJ1dGVOYW1lLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIHZhbHVlID0gbW9kZWxJbnN0YW5jZS5fX3ZhbHVlc1thdHRyaWJ1dGVOYW1lXTtcbiAgICAgICAgICByZXR1cm4gdmFsdWUgPT09IHVuZGVmaW5lZCA/IG51bGwgOiB2YWx1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbih2KSB7XG4gICAgICAgICAgaWYgKGF0dHJpYnV0ZURlZmluaXRpb24ucGFyc2UpIHtcbiAgICAgICAgICAgIHYgPSBhdHRyaWJ1dGVEZWZpbml0aW9uLnBhcnNlLmNhbGwobW9kZWxJbnN0YW5jZSwgdik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChNb2RlbC5wYXJzZUF0dHJpYnV0ZSkge1xuICAgICAgICAgICAgdiA9IE1vZGVsLnBhcnNlQXR0cmlidXRlLmNhbGwobW9kZWxJbnN0YW5jZSwgYXR0cmlidXRlTmFtZSwgdik7XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhciBvbGQgPSBtb2RlbEluc3RhbmNlLl9fdmFsdWVzW2F0dHJpYnV0ZU5hbWVdO1xuICAgICAgICAgIHZhciBwcm9wZXJ0eURlcGVuZGVuY2llcyA9IHRoaXMuX3Byb3BlcnR5RGVwZW5kZW5jaWVzW2F0dHJpYnV0ZU5hbWVdIHx8IFtdO1xuICAgICAgICAgIHByb3BlcnR5RGVwZW5kZW5jaWVzID0gcHJvcGVydHlEZXBlbmRlbmNpZXMubWFwKGZ1bmN0aW9uKGRlcGVuZGFudCkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgdmFyIG9sZFByb3BlcnR5VmFsdWUgPSB0aGlzW2RlcGVuZGFudF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdVbmNhdWdodCBlcnJvciBkdXJpbmcgcHJvcGVydHkgYWNjZXNzIGZvciBtb2RlbCBcIicgKyBtb2RlbEluc3RhbmNlLm1vZGVsLm5hbWUgKyAnXCInLCBlKTtcbiAgICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIHByb3A6IGRlcGVuZGFudCxcbiAgICAgICAgICAgICAgb2xkOiBvbGRQcm9wZXJ0eVZhbHVlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfS5iaW5kKHRoaXMpKTtcblxuICAgICAgICAgIG1vZGVsSW5zdGFuY2UuX192YWx1ZXNbYXR0cmlidXRlTmFtZV0gPSB2O1xuICAgICAgICAgIHByb3BlcnR5RGVwZW5kZW5jaWVzLmZvckVhY2goZnVuY3Rpb24oZGVwKSB7XG4gICAgICAgICAgICB2YXIgcHJvcGVydHlOYW1lID0gZGVwLnByb3A7XG4gICAgICAgICAgICB2YXIgbmV3XyA9IHRoaXNbcHJvcGVydHlOYW1lXTtcbiAgICAgICAgICAgIE1vZGVsLmFwcC5icm9hZGNhc3Qoe1xuICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBNb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgbW9kZWw6IE1vZGVsLm5hbWUsXG4gICAgICAgICAgICAgIGxvY2FsSWQ6IG1vZGVsSW5zdGFuY2UubG9jYWxJZCxcbiAgICAgICAgICAgICAgbmV3OiBuZXdfLFxuICAgICAgICAgICAgICBvbGQ6IGRlcC5vbGQsXG4gICAgICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNldCxcbiAgICAgICAgICAgICAgZmllbGQ6IHByb3BlcnR5TmFtZSxcbiAgICAgICAgICAgICAgb2JqOiBtb2RlbEluc3RhbmNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICAgIHZhciBlID0ge1xuICAgICAgICAgICAgY29sbGVjdGlvbjogTW9kZWwuY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICBtb2RlbDogTW9kZWwubmFtZSxcbiAgICAgICAgICAgIGxvY2FsSWQ6IG1vZGVsSW5zdGFuY2UubG9jYWxJZCxcbiAgICAgICAgICAgIG5ldzogdixcbiAgICAgICAgICAgIG9sZDogb2xkLFxuICAgICAgICAgICAgdHlwZTogTW9kZWxFdmVudFR5cGUuU2V0LFxuICAgICAgICAgICAgZmllbGQ6IGF0dHJpYnV0ZU5hbWUsXG4gICAgICAgICAgICBvYmo6IG1vZGVsSW5zdGFuY2VcbiAgICAgICAgICB9O1xuICAgICAgICAgIHdpbmRvdy5sYXN0RW1pc3Npb24gPSBlO1xuICAgICAgICAgIE1vZGVsLmFwcC5icm9hZGNhc3QoZSk7XG4gICAgICAgICAgaWYgKHV0aWwuaXNBcnJheSh2KSkge1xuICAgICAgICAgICAgd3JhcEFycmF5KHYsIGF0dHJpYnV0ZU5hbWUsIG1vZGVsSW5zdGFuY2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSxcbiAgX2luc3RhbGxNZXRob2RzOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlKSB7XG4gICAgdmFyIE1vZGVsID0gdGhpcy5tb2RlbDtcbiAgICBPYmplY3Qua2V5cyhNb2RlbC5tZXRob2RzKS5mb3JFYWNoKGZ1bmN0aW9uKG1ldGhvZE5hbWUpIHtcbiAgICAgIGlmIChtb2RlbEluc3RhbmNlW21ldGhvZE5hbWVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgbW9kZWxJbnN0YW5jZVttZXRob2ROYW1lXSA9IE1vZGVsLm1ldGhvZHNbbWV0aG9kTmFtZV0uYmluZChtb2RlbEluc3RhbmNlKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBsb2coJ0EgbWV0aG9kIHdpdGggbmFtZSBcIicgKyBtZXRob2ROYW1lICsgJ1wiIGFscmVhZHkgZXhpc3RzLiBJZ25vcmluZyBpdC4nKTtcbiAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuICBfaW5zdGFsbFByb3BlcnRpZXM6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UpIHtcbiAgICB2YXIgX3Byb3BlcnR5TmFtZXMgPSBPYmplY3Qua2V5cyh0aGlzLm1vZGVsLnByb3BlcnRpZXMpLFxuICAgICAgX3Byb3BlcnR5RGVwZW5kZW5jaWVzID0ge307XG4gICAgX3Byb3BlcnR5TmFtZXMuZm9yRWFjaChmdW5jdGlvbihwcm9wTmFtZSkge1xuICAgICAgdmFyIHByb3BEZWYgPSB0aGlzLm1vZGVsLnByb3BlcnRpZXNbcHJvcE5hbWVdO1xuICAgICAgdmFyIGRlcGVuZGVuY2llcyA9IHByb3BEZWYuZGVwZW5kZW5jaWVzIHx8IFtdO1xuICAgICAgZGVwZW5kZW5jaWVzLmZvckVhY2goZnVuY3Rpb24oYXR0cikge1xuICAgICAgICBpZiAoIV9wcm9wZXJ0eURlcGVuZGVuY2llc1thdHRyXSkgX3Byb3BlcnR5RGVwZW5kZW5jaWVzW2F0dHJdID0gW107XG4gICAgICAgIF9wcm9wZXJ0eURlcGVuZGVuY2llc1thdHRyXS5wdXNoKHByb3BOYW1lKTtcbiAgICAgIH0pO1xuICAgICAgZGVsZXRlIHByb3BEZWYuZGVwZW5kZW5jaWVzO1xuICAgICAgaWYgKG1vZGVsSW5zdGFuY2VbcHJvcE5hbWVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG1vZGVsSW5zdGFuY2UsIHByb3BOYW1lLCBwcm9wRGVmKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBsb2coJ0EgcHJvcGVydHkvbWV0aG9kIHdpdGggbmFtZSBcIicgKyBwcm9wTmFtZSArICdcIiBhbHJlYWR5IGV4aXN0cy4gSWdub3JpbmcgaXQuJyk7XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIG1vZGVsSW5zdGFuY2UuX3Byb3BlcnR5RGVwZW5kZW5jaWVzID0gX3Byb3BlcnR5RGVwZW5kZW5jaWVzO1xuICB9LFxuICBfaW5zdGFsbFJlbW90ZUlkOiBmdW5jdGlvbihtb2RlbEluc3RhbmNlKSB7XG4gICAgdmFyIE1vZGVsID0gdGhpcy5tb2RlbDtcbiAgICB2YXIgY2FjaGUgPSBNb2RlbC5hcHAuY2FjaGU7XG4gICAgdmFyIGlkRmllbGQgPSBNb2RlbC5pZDtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobW9kZWxJbnN0YW5jZSwgaWRGaWVsZCwge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIG1vZGVsSW5zdGFuY2UuX192YWx1ZXNbTW9kZWwuaWRdIHx8IG51bGw7XG4gICAgICB9LFxuICAgICAgc2V0OiBmdW5jdGlvbih2KSB7XG4gICAgICAgIHZhciBvbGQgPSBtb2RlbEluc3RhbmNlW01vZGVsLmlkXTtcbiAgICAgICAgbW9kZWxJbnN0YW5jZS5fX3ZhbHVlc1tNb2RlbC5pZF0gPSB2O1xuICAgICAgICBNb2RlbC5hcHAuYnJvYWRjYXN0KHtcbiAgICAgICAgICBjb2xsZWN0aW9uOiBNb2RlbC5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICBtb2RlbDogTW9kZWwubmFtZSxcbiAgICAgICAgICBsb2NhbElkOiBtb2RlbEluc3RhbmNlLmxvY2FsSWQsXG4gICAgICAgICAgbmV3OiB2LFxuICAgICAgICAgIG9sZDogb2xkLFxuICAgICAgICAgIHR5cGU6IE1vZGVsRXZlbnRUeXBlLlNldCxcbiAgICAgICAgICBmaWVsZDogTW9kZWwuaWQsXG4gICAgICAgICAgb2JqOiBtb2RlbEluc3RhbmNlXG4gICAgICAgIH0pO1xuICAgICAgICBjYWNoZS5yZW1vdGVJbnNlcnQobW9kZWxJbnN0YW5jZSwgdiwgb2xkKTtcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSk7XG4gIH0sXG4gIC8qKlxuICAgKiBAcGFyYW0gZGVmaW5pdGlvbiAtIERlZmluaXRpb24gb2YgYSByZWxhdGlvbnNoaXBcbiAgICogQHBhcmFtIG1vZGVsSW5zdGFuY2UgLSBJbnN0YW5jZSBvZiB3aGljaCB0byBpbnN0YWxsIHRoZSByZWxhdGlvbnNoaXAuXG4gICAqL1xuICBfaW5zdGFsbFJlbGF0aW9uc2hpcDogZnVuY3Rpb24oZGVmaW5pdGlvbiwgbW9kZWxJbnN0YW5jZSkge1xuICAgIHZhciBwcm94eTtcbiAgICB2YXIgdHlwZSA9IGRlZmluaXRpb24udHlwZTtcbiAgICBpZiAodHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk9uZVRvTWFueSkge1xuICAgICAgcHJveHkgPSBuZXcgT25lVG9NYW55UHJveHkoZGVmaW5pdGlvbik7XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGUgPT0gUmVsYXRpb25zaGlwVHlwZS5PbmVUb09uZSkge1xuICAgICAgcHJveHkgPSBuZXcgT25lVG9PbmVQcm94eShkZWZpbml0aW9uKTtcbiAgICB9XG4gICAgZWxzZSBpZiAodHlwZSA9PSBSZWxhdGlvbnNoaXBUeXBlLk1hbnlUb01hbnkpIHtcbiAgICAgIHByb3h5ID0gbmV3IE1hbnlUb01hbnlQcm94eShkZWZpbml0aW9uKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gc3VjaCByZWxhdGlvbnNoaXAgdHlwZTogJyArIHR5cGUpO1xuICAgIH1cbiAgICBwcm94eS5pbnN0YWxsKG1vZGVsSW5zdGFuY2UpO1xuICB9LFxuICBfaW5zdGFsbFJlbGF0aW9uc2hpcFByb3hpZXM6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UpIHtcbiAgICB2YXIgbW9kZWwgPSB0aGlzLm1vZGVsO1xuICAgIGZvciAodmFyIG5hbWUgaW4gbW9kZWwucmVsYXRpb25zaGlwcykge1xuICAgICAgaWYgKG1vZGVsLnJlbGF0aW9uc2hpcHMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgdmFyIGRlZmluaXRpb24gPSB1dGlsLmV4dGVuZCh7fSwgbW9kZWwucmVsYXRpb25zaGlwc1tuYW1lXSk7XG4gICAgICAgIHRoaXMuX2luc3RhbGxSZWxhdGlvbnNoaXAoZGVmaW5pdGlvbiwgbW9kZWxJbnN0YW5jZSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICBfcmVnaXN0ZXJJbnN0YW5jZTogZnVuY3Rpb24obW9kZWxJbnN0YW5jZSwgc2hvdWxkUmVnaXN0ZXJDaGFuZ2UpIHtcbiAgICB2YXIgY2FjaGUgPSB0aGlzLm1vZGVsLmFwcC5jYWNoZTtcbiAgICBjYWNoZS5pbnNlcnQobW9kZWxJbnN0YW5jZSk7XG4gICAgc2hvdWxkUmVnaXN0ZXJDaGFuZ2UgPSBzaG91bGRSZWdpc3RlckNoYW5nZSA9PT0gdW5kZWZpbmVkID8gdHJ1ZSA6IHNob3VsZFJlZ2lzdGVyQ2hhbmdlO1xuICAgIGlmIChzaG91bGRSZWdpc3RlckNoYW5nZSkgbW9kZWxJbnN0YW5jZS5fZW1pdE5ldygpO1xuICB9LFxuICBfaW5zdGFsbExvY2FsSWQ6IGZ1bmN0aW9uKG1vZGVsSW5zdGFuY2UsIGRhdGEpIHtcbiAgICBtb2RlbEluc3RhbmNlLmxvY2FsSWQgPSB0aGlzLl9nZXRMb2NhbElkKGRhdGEpO1xuICB9LFxuICAvKipcbiAgICogQ29udmVydCByYXcgZGF0YSBpbnRvIGEgTW9kZWxJbnN0YW5jZVxuICAgKiBAcmV0dXJucyB7TW9kZWxJbnN0YW5jZX1cbiAgICovXG4gIF9pbnN0YW5jZTogZnVuY3Rpb24oZGF0YSwgc2hvdWxkUmVnaXN0ZXJDaGFuZ2UpIHtcbiAgICB2YXIgbW9kZWxJbnN0YW5jZSA9IG5ldyBNb2RlbEluc3RhbmNlKHRoaXMubW9kZWwpO1xuICAgIHRoaXMuX2luc3RhbGxMb2NhbElkKG1vZGVsSW5zdGFuY2UsIGRhdGEpO1xuICAgIHRoaXMuX2luc3RhbGxBdHRyaWJ1dGVzKG1vZGVsSW5zdGFuY2UsIGRhdGEpO1xuICAgIHRoaXMuX2luc3RhbGxNZXRob2RzKG1vZGVsSW5zdGFuY2UpO1xuICAgIHRoaXMuX2luc3RhbGxQcm9wZXJ0aWVzKG1vZGVsSW5zdGFuY2UpO1xuICAgIHRoaXMuX2luc3RhbGxSZW1vdGVJZChtb2RlbEluc3RhbmNlKTtcbiAgICB0aGlzLl9pbnN0YWxsUmVsYXRpb25zaGlwUHJveGllcyhtb2RlbEluc3RhbmNlKTtcbiAgICB0aGlzLl9yZWdpc3Rlckluc3RhbmNlKG1vZGVsSW5zdGFuY2UsIHNob3VsZFJlZ2lzdGVyQ2hhbmdlKTtcbiAgICByZXR1cm4gbW9kZWxJbnN0YW5jZTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBNb2RlbEluc3RhbmNlRmFjdG9yeTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL2luc3RhbmNlRmFjdG9yeS5qc1xuICoqIG1vZHVsZSBpZCA9IDI3XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCJ2YXIgYXJnc2FycmF5ID0gcmVxdWlyZSgnYXJnc2FycmF5Jyk7XG5cbi8qKlxuICogQ2xhc3MgZm9yIGZhY2lsaXRhdGluZyBcImNoYWluZWRcIiBiZWhhdmlvdXIgZS5nOlxuICpcbiAqIHZhciBjYW5jZWwgPSBVc2Vyc1xuICogIC5vbignbmV3JywgZnVuY3Rpb24gKHVzZXIpIHtcbiAgICogICAgIC8vIC4uLlxuICAgKiAgIH0pXG4gKiAgLnF1ZXJ5KHskb3I6IHthZ2VfX2d0ZTogMjAsIGFnZV9fbHRlOiAzMH19KVxuICogIC5vbignKicsIGZ1bmN0aW9uIChjaGFuZ2UpIHtcbiAgICogICAgIC8vIC4uXG4gICAqICAgfSk7XG4gKlxuICogQHBhcmFtIG9wdHNcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBDaGFpbihvcHRzKSB7XG4gIHRoaXMub3B0cyA9IG9wdHM7XG59XG5cbkNoYWluLnByb3RvdHlwZSA9IHtcbiAgLyoqXG4gICAqIENvbnN0cnVjdCBhIGxpbmsgaW4gdGhlIGNoYWluIG9mIGNhbGxzLlxuICAgKiBAcGFyYW0gb3B0c1xuICAgKiBAcGFyYW0gb3B0cy5mblxuICAgKiBAcGFyYW0gb3B0cy50eXBlXG4gICAqL1xuICBfaGFuZGxlckxpbms6IGZ1bmN0aW9uKG9wdHMpIHtcbiAgICB2YXIgZmlyc3RMaW5rO1xuICAgIGZpcnN0TGluayA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHR5cCA9IG9wdHMudHlwZTtcbiAgICAgIGlmIChvcHRzLmZuKVxuICAgICAgICB0aGlzLl9yZW1vdmVMaXN0ZW5lcihvcHRzLmZuLCB0eXApO1xuICAgICAgaWYgKGZpcnN0TGluay5fcGFyZW50TGluaykgZmlyc3RMaW5rLl9wYXJlbnRMaW5rKCk7IC8vIENhbmNlbCBsaXN0ZW5lcnMgYWxsIHRoZSB3YXkgdXAgdGhlIGNoYWluLlxuICAgIH0uYmluZCh0aGlzKTtcbiAgICBPYmplY3Qua2V5cyh0aGlzLm9wdHMpLmZvckVhY2goZnVuY3Rpb24ocHJvcCkge1xuICAgICAgdmFyIGZ1bmMgPSB0aGlzLm9wdHNbcHJvcF07XG4gICAgICBmaXJzdExpbmtbcHJvcF0gPSBhcmdzYXJyYXkoZnVuY3Rpb24oYXJncykge1xuICAgICAgICB2YXIgbGluayA9IGZ1bmMuYXBwbHkoZnVuYy5fX3NpZXN0YV9ib3VuZF9vYmplY3QsIGFyZ3MpO1xuICAgICAgICBsaW5rLl9wYXJlbnRMaW5rID0gZmlyc3RMaW5rO1xuICAgICAgICByZXR1cm4gbGluaztcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgICBmaXJzdExpbmsuX3BhcmVudExpbmsgPSBudWxsO1xuICAgIHJldHVybiBmaXJzdExpbms7XG4gIH0sXG4gIC8qKlxuICAgKiBDb25zdHJ1Y3QgYSBsaW5rIGluIHRoZSBjaGFpbiBvZiBjYWxscy5cbiAgICogQHBhcmFtIG9wdHNcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NsZWFuXVxuICAgKi9cbiAgX2xpbms6IGZ1bmN0aW9uKG9wdHMsIGNsZWFuKSB7XG4gICAgdmFyIGNoYWluID0gdGhpcztcbiAgICBjbGVhbiA9IGNsZWFuIHx8IGZ1bmN0aW9uKCkge307XG4gICAgdmFyIGxpbms7XG4gICAgbGluayA9IGZ1bmN0aW9uKCkge1xuICAgICAgY2xlYW4oKTtcbiAgICAgIGlmIChsaW5rLl9wYXJlbnRMaW5rKSBsaW5rLl9wYXJlbnRMaW5rKCk7IC8vIENhbmNlbCBsaXN0ZW5lcnMgYWxsIHRoZSB3YXkgdXAgdGhlIGNoYWluLlxuICAgIH0uYmluZCh0aGlzKTtcbiAgICBsaW5rLl9fc2llc3RhX2lzTGluayA9IHRydWU7XG4gICAgbGluay5vcHRzID0gb3B0cztcbiAgICBsaW5rLmNsZWFuID0gY2xlYW47XG4gICAgT2JqZWN0LmtleXMob3B0cykuZm9yRWFjaChmdW5jdGlvbihwcm9wKSB7XG4gICAgICB2YXIgZnVuYyA9IG9wdHNbcHJvcF07XG4gICAgICBsaW5rW3Byb3BdID0gYXJnc2FycmF5KGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICAgICAgdmFyIHBvc3NpYmxlTGluayA9IGZ1bmMuYXBwbHkoZnVuYy5fX3NpZXN0YV9ib3VuZF9vYmplY3QsIGFyZ3MpO1xuICAgICAgICBpZiAoIXBvc3NpYmxlTGluayB8fCAhcG9zc2libGVMaW5rLl9fc2llc3RhX2lzTGluaykgeyAvLyBQYXRjaCBpbiBhIGxpbmsgaW4gdGhlIGNoYWluIHRvIGF2b2lkIGl0IGJlaW5nIGJyb2tlbiwgYmFzaW5nIG9mZiB0aGUgY3VycmVudCBsaW5rXG4gICAgICAgICAgbmV4dExpbmsgPSBjaGFpbi5fbGluayhsaW5rLm9wdHMpO1xuICAgICAgICAgIGZvciAodmFyIHByb3AgaW4gcG9zc2libGVMaW5rKSB7XG4gICAgICAgICAgICAvL25vaW5zcGVjdGlvbiBKU1VuZmlsdGVyZWRGb3JJbkxvb3BcbiAgICAgICAgICAgIGlmIChwb3NzaWJsZUxpbmtbcHJvcF0gaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgICAgICAgICAgICAvL25vaW5zcGVjdGlvbiBKU1VuZmlsdGVyZWRGb3JJbkxvb3BcbiAgICAgICAgICAgICAgbmV4dExpbmtbcHJvcF0gPSBwb3NzaWJsZUxpbmtbcHJvcF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHZhciBuZXh0TGluayA9IHBvc3NpYmxlTGluaztcbiAgICAgICAgfVxuICAgICAgICBuZXh0TGluay5fcGFyZW50TGluayA9IGxpbms7XG4gICAgICAgIC8vIEluaGVyaXQgbWV0aG9kcyBmcm9tIHRoZSBwYXJlbnQgbGluayBpZiB0aG9zZSBtZXRob2RzIGRvbid0IGFscmVhZHkgZXhpc3QuXG4gICAgICAgIGZvciAocHJvcCBpbiBsaW5rKSB7XG4gICAgICAgICAgaWYgKGxpbmtbcHJvcF0gaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgICAgICAgICAgbmV4dExpbmtbcHJvcF0gPSBsaW5rW3Byb3BdLmJpbmQobGluayk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXh0TGluaztcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgICBsaW5rLl9wYXJlbnRMaW5rID0gbnVsbDtcbiAgICByZXR1cm4gbGluaztcbiAgfVxufTtcbm1vZHVsZS5leHBvcnRzID0gQ2hhaW47XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL2NvcmUvQ2hhaW4uanNcbiAqKiBtb2R1bGUgaWQgPSAyOFxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiLyoqXG4gKiBUaGlzIGlzIGFuIGluLW1lbW9yeSBjYWNoZSBmb3IgbW9kZWxzLiBNb2RlbHMgYXJlIGNhY2hlZCBieSBsb2NhbCBpZCAoX2lkKSBhbmQgcmVtb3RlIGlkIChkZWZpbmVkIGJ5IHRoZSBtYXBwaW5nKS5cbiAqIExvb2t1cHMgYXJlIHBlcmZvcm1lZCBhZ2FpbnN0IHRoZSBjYWNoZSB3aGVuIG1hcHBpbmcuXG4gKiBAbW9kdWxlIGNhY2hlXG4gKi9cbnZhciBsb2cgPSByZXF1aXJlKCcuL2xvZycpKCdjYWNoZScpLFxuICBJbnRlcm5hbFNpZXN0YUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpLkludGVybmFsU2llc3RhRXJyb3IsXG4gIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuXG5mdW5jdGlvbiBDYWNoZSgpIHtcbiAgdGhpcy5yZXNldCgpO1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ19sb2NhbENhY2hlQnlUeXBlJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5sb2NhbDtcbiAgICB9XG4gIH0pO1xufVxuXG5DYWNoZS5wcm90b3R5cGUgPSB7XG4gIHJlc2V0OiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnJlbW90ZSA9IHt9O1xuICAgIHRoaXMubG9jYWxCeUlkID0ge307XG4gICAgdGhpcy5sb2NhbCA9IHt9O1xuICB9LFxuICAvKipcbiAgICogUmV0dXJuIHRoZSBvYmplY3QgaW4gdGhlIGNhY2hlIGdpdmVuIGEgbG9jYWwgaWQgKF9pZClcbiAgICogQHBhcmFtICB7U3RyaW5nfEFycmF5fSBsb2NhbElkXG4gICAqIEByZXR1cm4ge01vZGVsSW5zdGFuY2V9XG4gICAqL1xuICBnZXRWaWFMb2NhbElkOiBmdW5jdGlvbiBnZXRWaWFMb2NhbElkKGxvY2FsSWQpIHtcbiAgICBpZiAodXRpbC5pc0FycmF5KGxvY2FsSWQpKSByZXR1cm4gbG9jYWxJZC5tYXAoZnVuY3Rpb24oeCkge3JldHVybiB0aGlzLmxvY2FsQnlJZFt4XX0uYmluZCh0aGlzKSk7XG4gICAgZWxzZSByZXR1cm4gdGhpcy5sb2NhbEJ5SWRbbG9jYWxJZF07XG4gIH0sXG4gIC8qKlxuICAgKiBHaXZlbiBhIHJlbW90ZSBpZGVudGlmaWVyIGFuZCBhbiBvcHRpb25zIG9iamVjdCB0aGF0IGRlc2NyaWJlcyBtYXBwaW5nL2NvbGxlY3Rpb24sXG4gICAqIHJldHVybiB0aGUgbW9kZWwgaWYgY2FjaGVkLlxuICAgKiBAcGFyYW0gIHtTdHJpbmd8QXJyYXl9IHJlbW90ZUlkXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0c1xuICAgKiBAcGFyYW0gIHtPYmplY3R9IG9wdHMubW9kZWxcbiAgICogQHJldHVybiB7TW9kZWxJbnN0YW5jZX1cbiAgICovXG4gIGdldFZpYVJlbW90ZUlkOiBmdW5jdGlvbihyZW1vdGVJZCwgb3B0cykge1xuICAgIHZhciBjID0gKHRoaXMucmVtb3RlW29wdHMubW9kZWwuY29sbGVjdGlvbk5hbWVdIHx8IHt9KVtvcHRzLm1vZGVsLm5hbWVdIHx8IHt9O1xuICAgIHJldHVybiB1dGlsLmlzQXJyYXkocmVtb3RlSWQpID8gcmVtb3RlSWQubWFwKGZ1bmN0aW9uKHgpIHtyZXR1cm4gY1t4XX0pIDogY1tyZW1vdGVJZF07XG4gIH0sXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIHNpbmdsZXRvbiBvYmplY3QgZ2l2ZW4gYSBzaW5nbGV0b24gbW9kZWwuXG4gICAqIEBwYXJhbSAge01vZGVsfSBtb2RlbFxuICAgKiBAcmV0dXJuIHtNb2RlbEluc3RhbmNlfVxuICAgKi9cbiAgZ2V0U2luZ2xldG9uOiBmdW5jdGlvbihtb2RlbCkge1xuICAgIHZhciBtb2RlbE5hbWUgPSBtb2RlbC5uYW1lO1xuICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG1vZGVsLmNvbGxlY3Rpb25OYW1lO1xuICAgIHZhciBjb2xsZWN0aW9uQ2FjaGUgPSB0aGlzLmxvY2FsW2NvbGxlY3Rpb25OYW1lXTtcbiAgICBpZiAoY29sbGVjdGlvbkNhY2hlKSB7XG4gICAgICB2YXIgdHlwZUNhY2hlID0gY29sbGVjdGlvbkNhY2hlW21vZGVsTmFtZV07XG4gICAgICBpZiAodHlwZUNhY2hlKSB7XG4gICAgICAgIHZhciBvYmpzID0gW107XG4gICAgICAgIGZvciAodmFyIHByb3AgaW4gdHlwZUNhY2hlKSB7XG4gICAgICAgICAgaWYgKHR5cGVDYWNoZS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgb2Jqcy5wdXNoKHR5cGVDYWNoZVtwcm9wXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChvYmpzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICB2YXIgZXJyU3RyID0gJ0Egc2luZ2xldG9uIG1vZGVsIGhhcyBtb3JlIHRoYW4gMSBvYmplY3QgaW4gdGhlIGNhY2hlISBUaGlzIGlzIGEgc2VyaW91cyBlcnJvci4gJyArXG4gICAgICAgICAgICAnRWl0aGVyIGEgbW9kZWwgaGFzIGJlZW4gbW9kaWZpZWQgYWZ0ZXIgb2JqZWN0cyBoYXZlIGFscmVhZHkgYmVlbiBjcmVhdGVkLCBvciBzb21ldGhpbmcgaGFzIGdvbmUnICtcbiAgICAgICAgICAgICd2ZXJ5IHdyb25nLiBQbGVhc2UgZmlsZSBhIGJ1ZyByZXBvcnQgaWYgdGhlIGxhdHRlci4nO1xuICAgICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKGVyclN0cik7XG4gICAgICAgIH0gZWxzZSBpZiAob2Jqcy5sZW5ndGgpIHtcbiAgICAgICAgICByZXR1cm4gb2Jqc1swXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcbiAgLyoqXG4gICAqIEluc2VydCBhbiBvYmplY3QgaW50byB0aGUgY2FjaGUgdXNpbmcgYSByZW1vdGUgaWRlbnRpZmllciBkZWZpbmVkIGJ5IHRoZSBtYXBwaW5nLlxuICAgKiBAcGFyYW0gIHtNb2RlbEluc3RhbmNlfSBvYmpcbiAgICogQHBhcmFtICB7U3RyaW5nfSByZW1vdGVJZFxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IFtwcmV2aW91c1JlbW90ZUlkXSBJZiByZW1vdGUgaWQgaGFzIGJlZW4gY2hhbmdlZCwgdGhpcyBpcyB0aGUgb2xkIHJlbW90ZSBpZGVudGlmaWVyXG4gICAqL1xuICByZW1vdGVJbnNlcnQ6IGZ1bmN0aW9uKG9iaiwgcmVtb3RlSWQsIHByZXZpb3VzUmVtb3RlSWQpIHtcbiAgICBpZiAob2JqKSB7XG4gICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSBvYmoubW9kZWwuY29sbGVjdGlvbk5hbWU7XG4gICAgICBpZiAoY29sbGVjdGlvbk5hbWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLnJlbW90ZVtjb2xsZWN0aW9uTmFtZV0pIHtcbiAgICAgICAgICB0aGlzLnJlbW90ZVtjb2xsZWN0aW9uTmFtZV0gPSB7fTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgdHlwZSA9IG9iai5tb2RlbC5uYW1lO1xuICAgICAgICBpZiAodHlwZSkge1xuICAgICAgICAgIGlmICghdGhpcy5yZW1vdGVbY29sbGVjdGlvbk5hbWVdW3R5cGVdKSB7XG4gICAgICAgICAgICB0aGlzLnJlbW90ZVtjb2xsZWN0aW9uTmFtZV1bdHlwZV0gPSB7fTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHByZXZpb3VzUmVtb3RlSWQpIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3RlW2NvbGxlY3Rpb25OYW1lXVt0eXBlXVtwcmV2aW91c1JlbW90ZUlkXSA9IG51bGw7XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhciBjYWNoZWRPYmplY3QgPSB0aGlzLnJlbW90ZVtjb2xsZWN0aW9uTmFtZV1bdHlwZV1bcmVtb3RlSWRdO1xuICAgICAgICAgIGlmICghY2FjaGVkT2JqZWN0KSB7XG4gICAgICAgICAgICB0aGlzLnJlbW90ZVtjb2xsZWN0aW9uTmFtZV1bdHlwZV1bcmVtb3RlSWRdID0gb2JqO1xuICAgICAgICAgICAgbG9nKCdSZW1vdGUgY2FjaGUgaW5zZXJ0OiAnICsgb2JqLl9kdW1wKHRydWUpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gU29tZXRoaW5nIGhhcyBnb25lIHJlYWxseSB3cm9uZy4gT25seSBvbmUgb2JqZWN0IGZvciBhIHBhcnRpY3VsYXIgY29sbGVjdGlvbi90eXBlL3JlbW90ZWlkIGNvbWJvXG4gICAgICAgICAgICAvLyBzaG91bGQgZXZlciBleGlzdC5cbiAgICAgICAgICAgIGlmIChvYmogIT0gY2FjaGVkT2JqZWN0KSB7XG4gICAgICAgICAgICAgIHZhciBtZXNzYWdlID0gJ09iamVjdCAnICsgY29sbGVjdGlvbk5hbWUudG9TdHJpbmcoKSArICc6JyArIHR5cGUudG9TdHJpbmcoKSArICdbJyArIG9iai5tb2RlbC5pZCArICc9XCInICsgcmVtb3RlSWQgKyAnXCJdIGFscmVhZHkgZXhpc3RzIGluIHRoZSBjYWNoZS4nICtcbiAgICAgICAgICAgICAgICAnIFRoaXMgaXMgYSBzZXJpb3VzIGVycm9yLCBwbGVhc2UgZmlsZSBhIGJ1ZyByZXBvcnQgaWYgeW91IGFyZSBleHBlcmllbmNpbmcgdGhpcyBvdXQgaW4gdGhlIHdpbGQnO1xuICAgICAgICAgICAgICBsb2cobWVzc2FnZSwge1xuICAgICAgICAgICAgICAgIG9iajogb2JqLFxuICAgICAgICAgICAgICAgIGNhY2hlZE9iamVjdDogY2FjaGVkT2JqZWN0XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihtZXNzYWdlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEludGVybmFsU2llc3RhRXJyb3IoJ01vZGVsIGhhcyBubyB0eXBlJywge1xuICAgICAgICAgICAgbW9kZWw6IG9iai5tb2RlbCxcbiAgICAgICAgICAgIG9iajogb2JqXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBJbnRlcm5hbFNpZXN0YUVycm9yKCdNb2RlbCBoYXMgbm8gY29sbGVjdGlvbicsIHtcbiAgICAgICAgICBtb2RlbDogb2JqLm1vZGVsLFxuICAgICAgICAgIG9iajogb2JqXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgbXNnID0gJ011c3QgcGFzcyBhbiBvYmplY3Qgd2hlbiBpbnNlcnRpbmcgdG8gY2FjaGUnO1xuICAgICAgbG9nKG1zZyk7XG4gICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihtc2cpO1xuICAgIH1cbiAgfSxcbiAgLyoqXG4gICAqIFF1ZXJ5IHRoZSBjYWNoZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG9wdHMgT2JqZWN0IGRlc2NyaWJpbmcgdGhlIHF1ZXJ5XG4gICAqIEByZXR1cm4ge01vZGVsSW5zdGFuY2V9XG4gICAqIEBleGFtcGxlXG4gICAqIGBgYGpzXG4gICAqIGNhY2hlLmdldCh7X2lkOiAnNSd9KTsgLy8gUXVlcnkgYnkgbG9jYWwgaWRcbiAgICogY2FjaGUuZ2V0KHtyZW1vdGVJZDogJzUnLCBtYXBwaW5nOiBteU1hcHBpbmd9KTsgLy8gUXVlcnkgYnkgcmVtb3RlIGlkXG4gICAqIGBgYFxuICAgKi9cbiAgZ2V0OiBmdW5jdGlvbihvcHRzKSB7XG4gICAgbG9nKCdnZXQnLCBvcHRzKTtcbiAgICB2YXIgb2JqLCBpZEZpZWxkLCByZW1vdGVJZDtcbiAgICB2YXIgbG9jYWxJZCA9IG9wdHMubG9jYWxJZDtcbiAgICBpZiAobG9jYWxJZCkge1xuICAgICAgb2JqID0gdGhpcy5nZXRWaWFMb2NhbElkKGxvY2FsSWQpO1xuICAgICAgaWYgKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKG9wdHMubW9kZWwpIHtcbiAgICAgICAgICBpZEZpZWxkID0gb3B0cy5tb2RlbC5pZDtcbiAgICAgICAgICByZW1vdGVJZCA9IG9wdHNbaWRGaWVsZF07XG4gICAgICAgICAgbG9nKGlkRmllbGQgKyAnPScgKyByZW1vdGVJZCk7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuZ2V0VmlhUmVtb3RlSWQocmVtb3RlSWQsIG9wdHMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChvcHRzLm1vZGVsKSB7XG4gICAgICBpZEZpZWxkID0gb3B0cy5tb2RlbC5pZDtcbiAgICAgIHJlbW90ZUlkID0gb3B0c1tpZEZpZWxkXTtcbiAgICAgIGlmIChyZW1vdGVJZCkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRWaWFSZW1vdGVJZChyZW1vdGVJZCwgb3B0cyk7XG4gICAgICB9IGVsc2UgaWYgKG9wdHMubW9kZWwuc2luZ2xldG9uKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldFNpbmdsZXRvbihvcHRzLm1vZGVsKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbG9nKCdJbnZhbGlkIG9wdHMgdG8gY2FjaGUnLCB7XG4gICAgICAgIG9wdHM6IG9wdHNcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcbiAgX3JlbW90ZUNhY2hlOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5yZW1vdGVcbiAgfSxcbiAgX2xvY2FsQ2FjaGU6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmxvY2FsQnlJZDtcbiAgfSxcbiAgLyoqXG4gICAqIEluc2VydCBhbiBvYmplY3QgaW50byB0aGUgY2FjaGUuXG4gICAqIEBwYXJhbSAge01vZGVsSW5zdGFuY2V9IG9ialxuICAgKiBAdGhyb3dzIHtJbnRlcm5hbFNpZXN0YUVycm9yfSBBbiBvYmplY3Qgd2l0aCBfaWQvcmVtb3RlSWQgYWxyZWFkeSBleGlzdHMuIE5vdCB0aHJvd24gaWYgc2FtZSBvYmhlY3QuXG4gICAqL1xuICBpbnNlcnQ6IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBsb2NhbElkID0gb2JqLmxvY2FsSWQ7XG4gICAgaWYgKGxvY2FsSWQpIHtcbiAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG9iai5tb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgIHZhciBtb2RlbE5hbWUgPSBvYmoubW9kZWwubmFtZTtcbiAgICAgIGlmICghdGhpcy5sb2NhbEJ5SWRbbG9jYWxJZF0pIHtcbiAgICAgICAgdGhpcy5sb2NhbEJ5SWRbbG9jYWxJZF0gPSBvYmo7XG4gICAgICAgIGlmICghdGhpcy5sb2NhbFtjb2xsZWN0aW9uTmFtZV0pIHRoaXMubG9jYWxbY29sbGVjdGlvbk5hbWVdID0ge307XG4gICAgICAgIGlmICghdGhpcy5sb2NhbFtjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXSkgdGhpcy5sb2NhbFtjb2xsZWN0aW9uTmFtZV1bbW9kZWxOYW1lXSA9IHt9O1xuICAgICAgICB0aGlzLmxvY2FsW2NvbGxlY3Rpb25OYW1lXVttb2RlbE5hbWVdW2xvY2FsSWRdID0gb2JqO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gU29tZXRoaW5nIGhhcyBnb25lIGJhZGx5IHdyb25nIGhlcmUuIFR3byBvYmplY3RzIHNob3VsZCBuZXZlciBleGlzdCB3aXRoIHRoZSBzYW1lIF9pZFxuICAgICAgICBpZiAodGhpcy5sb2NhbEJ5SWRbbG9jYWxJZF0gIT0gb2JqKSB7XG4gICAgICAgICAgdmFyIG1lc3NhZ2UgPSAnT2JqZWN0IHdpdGggbG9jYWxJZD1cIicgKyBsb2NhbElkLnRvU3RyaW5nKCkgKyAnXCIgaXMgYWxyZWFkeSBpbiB0aGUgY2FjaGUuICcgK1xuICAgICAgICAgICAgJ1RoaXMgaXMgYSBzZXJpb3VzIGVycm9yLiBQbGVhc2UgZmlsZSBhIGJ1ZyByZXBvcnQgaWYgeW91IGFyZSBleHBlcmllbmNpbmcgdGhpcyBvdXQgaW4gdGhlIHdpbGQnO1xuICAgICAgICAgIGxvZyhtZXNzYWdlKTtcbiAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxTaWVzdGFFcnJvcihtZXNzYWdlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB2YXIgaWRGaWVsZCA9IG9iai5pZEZpZWxkO1xuICAgIHZhciByZW1vdGVJZCA9IG9ialtpZEZpZWxkXTtcbiAgICBpZiAocmVtb3RlSWQpIHtcbiAgICAgIHRoaXMucmVtb3RlSW5zZXJ0KG9iaiwgcmVtb3RlSWQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2coJ05vIHJlbW90ZSBpZCAoXCInICsgaWRGaWVsZCArICdcIikgc28gd29udCBiZSBwbGFjaW5nIGluIHRoZSByZW1vdGUgY2FjaGUnLCBvYmopO1xuICAgIH1cbiAgfSxcbiAgLyoqXG4gICAqIFJldHVybnMgdHJ1ZSBpZiBvYmplY3QgaXMgaW4gdGhlIGNhY2hlXG4gICAqIEBwYXJhbSAge01vZGVsSW5zdGFuY2V9IG9ialxuICAgKiBAcmV0dXJuIHtib29sZWFufVxuICAgKi9cbiAgY29udGFpbnM6IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBxID0ge1xuICAgICAgbG9jYWxJZDogb2JqLmxvY2FsSWRcbiAgICB9O1xuICAgIHZhciBtb2RlbCA9IG9iai5tb2RlbDtcbiAgICBpZiAobW9kZWwuaWQpIHtcbiAgICAgIGlmIChvYmpbbW9kZWwuaWRdKSB7XG4gICAgICAgIHEubW9kZWwgPSBtb2RlbDtcbiAgICAgICAgcVttb2RlbC5pZF0gPSBvYmpbbW9kZWwuaWRdO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gISF0aGlzLmdldChxKTtcbiAgfSxcblxuICAvKipcbiAgICogUmVtb3ZlcyB0aGUgb2JqZWN0IGZyb20gdGhlIGNhY2hlIChpZiBpdCdzIGFjdHVhbGx5IGluIHRoZSBjYWNoZSkgb3RoZXJ3aXNlcyB0aHJvd3MgYW4gZXJyb3IuXG4gICAqIEBwYXJhbSAge01vZGVsSW5zdGFuY2V9IG9ialxuICAgKiBAdGhyb3dzIHtJbnRlcm5hbFNpZXN0YUVycm9yfSBJZiBvYmplY3QgYWxyZWFkeSBpbiB0aGUgY2FjaGUuXG4gICAqL1xuICByZW1vdmU6IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmICh0aGlzLmNvbnRhaW5zKG9iaikpIHtcbiAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IG9iai5tb2RlbC5jb2xsZWN0aW9uTmFtZTtcbiAgICAgIHZhciBtb2RlbE5hbWUgPSBvYmoubW9kZWwubmFtZTtcbiAgICAgIHZhciBsb2NhbElkID0gb2JqLmxvY2FsSWQ7XG4gICAgICBpZiAoIW1vZGVsTmFtZSkgdGhyb3cgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gbWFwcGluZyBuYW1lJyk7XG4gICAgICBpZiAoIWNvbGxlY3Rpb25OYW1lKSB0aHJvdyBJbnRlcm5hbFNpZXN0YUVycm9yKCdObyBjb2xsZWN0aW9uIG5hbWUnKTtcbiAgICAgIGlmICghbG9jYWxJZCkgdGhyb3cgSW50ZXJuYWxTaWVzdGFFcnJvcignTm8gbG9jYWxJZCcpO1xuICAgICAgZGVsZXRlIHRoaXMubG9jYWxbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV1bbG9jYWxJZF07XG4gICAgICBkZWxldGUgdGhpcy5sb2NhbEJ5SWRbbG9jYWxJZF07XG4gICAgICBpZiAob2JqLm1vZGVsLmlkKSB7XG4gICAgICAgIHZhciByZW1vdGVJZCA9IG9ialtvYmoubW9kZWwuaWRdO1xuICAgICAgICBpZiAocmVtb3RlSWQpIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5yZW1vdGVbY29sbGVjdGlvbk5hbWVdW21vZGVsTmFtZV1bcmVtb3RlSWRdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIGNvdW50OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5sb2NhbEJ5SWQpLmxlbmd0aDtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDYWNoZTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9jb3JlL2NhY2hlLmpzXG4gKiogbW9kdWxlIGlkID0gMjlcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIlxuLyoqXG4gKiBUaGlzIGlzIHRoZSB3ZWIgYnJvd3NlciBpbXBsZW1lbnRhdGlvbiBvZiBgZGVidWcoKWAuXG4gKlxuICogRXhwb3NlIGBkZWJ1ZygpYCBhcyB0aGUgbW9kdWxlLlxuICovXG5cbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vZGVidWcnKTtcbmV4cG9ydHMubG9nID0gbG9nO1xuZXhwb3J0cy5mb3JtYXRBcmdzID0gZm9ybWF0QXJncztcbmV4cG9ydHMuc2F2ZSA9IHNhdmU7XG5leHBvcnRzLmxvYWQgPSBsb2FkO1xuZXhwb3J0cy51c2VDb2xvcnMgPSB1c2VDb2xvcnM7XG5cbi8qKlxuICogVXNlIGNocm9tZS5zdG9yYWdlLmxvY2FsIGlmIHdlIGFyZSBpbiBhbiBhcHBcbiAqL1xuXG52YXIgc3RvcmFnZTtcblxuaWYgKHR5cGVvZiBjaHJvbWUgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBjaHJvbWUuc3RvcmFnZSAhPT0gJ3VuZGVmaW5lZCcpXG4gIHN0b3JhZ2UgPSBjaHJvbWUuc3RvcmFnZS5sb2NhbDtcbmVsc2VcbiAgc3RvcmFnZSA9IHdpbmRvdy5sb2NhbFN0b3JhZ2U7XG5cbi8qKlxuICogQ29sb3JzLlxuICovXG5cbmV4cG9ydHMuY29sb3JzID0gW1xuICAnbGlnaHRzZWFncmVlbicsXG4gICdmb3Jlc3RncmVlbicsXG4gICdnb2xkZW5yb2QnLFxuICAnZG9kZ2VyYmx1ZScsXG4gICdkYXJrb3JjaGlkJyxcbiAgJ2NyaW1zb24nXG5dO1xuXG4vKipcbiAqIEN1cnJlbnRseSBvbmx5IFdlYktpdC1iYXNlZCBXZWIgSW5zcGVjdG9ycywgRmlyZWZveCA+PSB2MzEsXG4gKiBhbmQgdGhlIEZpcmVidWcgZXh0ZW5zaW9uIChhbnkgRmlyZWZveCB2ZXJzaW9uKSBhcmUga25vd25cbiAqIHRvIHN1cHBvcnQgXCIlY1wiIENTUyBjdXN0b21pemF0aW9ucy5cbiAqXG4gKiBUT0RPOiBhZGQgYSBgbG9jYWxTdG9yYWdlYCB2YXJpYWJsZSB0byBleHBsaWNpdGx5IGVuYWJsZS9kaXNhYmxlIGNvbG9yc1xuICovXG5cbmZ1bmN0aW9uIHVzZUNvbG9ycygpIHtcbiAgLy8gaXMgd2Via2l0PyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8xNjQ1OTYwNi8zNzY3NzNcbiAgcmV0dXJuICgnV2Via2l0QXBwZWFyYW5jZScgaW4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlKSB8fFxuICAgIC8vIGlzIGZpcmVidWc/IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzM5ODEyMC8zNzY3NzNcbiAgICAod2luZG93LmNvbnNvbGUgJiYgKGNvbnNvbGUuZmlyZWJ1ZyB8fCAoY29uc29sZS5leGNlcHRpb24gJiYgY29uc29sZS50YWJsZSkpKSB8fFxuICAgIC8vIGlzIGZpcmVmb3ggPj0gdjMxP1xuICAgIC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvVG9vbHMvV2ViX0NvbnNvbGUjU3R5bGluZ19tZXNzYWdlc1xuICAgIChuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkubWF0Y2goL2ZpcmVmb3hcXC8oXFxkKykvKSAmJiBwYXJzZUludChSZWdFeHAuJDEsIDEwKSA+PSAzMSk7XG59XG5cbi8qKlxuICogTWFwICVqIHRvIGBKU09OLnN0cmluZ2lmeSgpYCwgc2luY2Ugbm8gV2ViIEluc3BlY3RvcnMgZG8gdGhhdCBieSBkZWZhdWx0LlxuICovXG5cbmV4cG9ydHMuZm9ybWF0dGVycy5qID0gZnVuY3Rpb24odikge1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodik7XG59O1xuXG5cbi8qKlxuICogQ29sb3JpemUgbG9nIGFyZ3VtZW50cyBpZiBlbmFibGVkLlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZm9ybWF0QXJncygpIHtcbiAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gIHZhciB1c2VDb2xvcnMgPSB0aGlzLnVzZUNvbG9ycztcblxuICBhcmdzWzBdID0gKHVzZUNvbG9ycyA/ICclYycgOiAnJylcbiAgICArIHRoaXMubmFtZXNwYWNlXG4gICAgKyAodXNlQ29sb3JzID8gJyAlYycgOiAnICcpXG4gICAgKyBhcmdzWzBdXG4gICAgKyAodXNlQ29sb3JzID8gJyVjICcgOiAnICcpXG4gICAgKyAnKycgKyBleHBvcnRzLmh1bWFuaXplKHRoaXMuZGlmZik7XG5cbiAgaWYgKCF1c2VDb2xvcnMpIHJldHVybiBhcmdzO1xuXG4gIHZhciBjID0gJ2NvbG9yOiAnICsgdGhpcy5jb2xvcjtcbiAgYXJncyA9IFthcmdzWzBdLCBjLCAnY29sb3I6IGluaGVyaXQnXS5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJncywgMSkpO1xuXG4gIC8vIHRoZSBmaW5hbCBcIiVjXCIgaXMgc29tZXdoYXQgdHJpY2t5LCBiZWNhdXNlIHRoZXJlIGNvdWxkIGJlIG90aGVyXG4gIC8vIGFyZ3VtZW50cyBwYXNzZWQgZWl0aGVyIGJlZm9yZSBvciBhZnRlciB0aGUgJWMsIHNvIHdlIG5lZWQgdG9cbiAgLy8gZmlndXJlIG91dCB0aGUgY29ycmVjdCBpbmRleCB0byBpbnNlcnQgdGhlIENTUyBpbnRvXG4gIHZhciBpbmRleCA9IDA7XG4gIHZhciBsYXN0QyA9IDA7XG4gIGFyZ3NbMF0ucmVwbGFjZSgvJVthLXolXS9nLCBmdW5jdGlvbihtYXRjaCkge1xuICAgIGlmICgnJSUnID09PSBtYXRjaCkgcmV0dXJuO1xuICAgIGluZGV4Kys7XG4gICAgaWYgKCclYycgPT09IG1hdGNoKSB7XG4gICAgICAvLyB3ZSBvbmx5IGFyZSBpbnRlcmVzdGVkIGluIHRoZSAqbGFzdCogJWNcbiAgICAgIC8vICh0aGUgdXNlciBtYXkgaGF2ZSBwcm92aWRlZCB0aGVpciBvd24pXG4gICAgICBsYXN0QyA9IGluZGV4O1xuICAgIH1cbiAgfSk7XG5cbiAgYXJncy5zcGxpY2UobGFzdEMsIDAsIGMpO1xuICByZXR1cm4gYXJncztcbn1cblxuLyoqXG4gKiBJbnZva2VzIGBjb25zb2xlLmxvZygpYCB3aGVuIGF2YWlsYWJsZS5cbiAqIE5vLW9wIHdoZW4gYGNvbnNvbGUubG9nYCBpcyBub3QgYSBcImZ1bmN0aW9uXCIuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBsb2coKSB7XG4gIC8vIHRoaXMgaGFja2VyeSBpcyByZXF1aXJlZCBmb3IgSUU4LzksIHdoZXJlXG4gIC8vIHRoZSBgY29uc29sZS5sb2dgIGZ1bmN0aW9uIGRvZXNuJ3QgaGF2ZSAnYXBwbHknXG4gIHJldHVybiAnb2JqZWN0JyA9PT0gdHlwZW9mIGNvbnNvbGVcbiAgICAmJiBjb25zb2xlLmxvZ1xuICAgICYmIEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseS5jYWxsKGNvbnNvbGUubG9nLCBjb25zb2xlLCBhcmd1bWVudHMpO1xufVxuXG4vKipcbiAqIFNhdmUgYG5hbWVzcGFjZXNgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VzXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzYXZlKG5hbWVzcGFjZXMpIHtcbiAgdHJ5IHtcbiAgICBpZiAobnVsbCA9PSBuYW1lc3BhY2VzKSB7XG4gICAgICBzdG9yYWdlLnJlbW92ZUl0ZW0oJ2RlYnVnJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0b3JhZ2UuZGVidWcgPSBuYW1lc3BhY2VzO1xuICAgIH1cbiAgfSBjYXRjaChlKSB7fVxufVxuXG4vKipcbiAqIExvYWQgYG5hbWVzcGFjZXNgLlxuICpcbiAqIEByZXR1cm4ge1N0cmluZ30gcmV0dXJucyB0aGUgcHJldmlvdXNseSBwZXJzaXN0ZWQgZGVidWcgbW9kZXNcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGxvYWQoKSB7XG4gIHZhciByO1xuICB0cnkge1xuICAgIHIgPSBzdG9yYWdlLmRlYnVnO1xuICB9IGNhdGNoKGUpIHt9XG4gIHJldHVybiByO1xufVxuXG4vKipcbiAqIEVuYWJsZSBuYW1lc3BhY2VzIGxpc3RlZCBpbiBgbG9jYWxTdG9yYWdlLmRlYnVnYCBpbml0aWFsbHkuXG4gKi9cblxuZXhwb3J0cy5lbmFibGUobG9hZCgpKTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9+L2RlYnVnL2Jyb3dzZXIuanNcbiAqKiBtb2R1bGUgaWQgPSAzMFxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGFyZ3NBcnJheTtcblxuZnVuY3Rpb24gYXJnc0FycmF5KGZ1bikge1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHZhciBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGlmIChsZW4pIHtcbiAgICAgIHZhciBhcmdzID0gW107XG4gICAgICB2YXIgaSA9IC0xO1xuICAgICAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgICAgICBhcmdzW2ldID0gYXJndW1lbnRzW2ldO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZ1bi5jYWxsKHRoaXMsIGFyZ3MpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZnVuLmNhbGwodGhpcywgW10pO1xuICAgIH1cbiAgfTtcbn1cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vfi9hcmdzYXJyYXkvaW5kZXguanNcbiAqKiBtb2R1bGUgaWQgPSAzMVxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIG5leHRUaWNrID0gcmVxdWlyZSgncHJvY2Vzcy9icm93c2VyLmpzJykubmV4dFRpY2s7XG52YXIgYXBwbHkgPSBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHk7XG52YXIgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG52YXIgaW1tZWRpYXRlSWRzID0ge307XG52YXIgbmV4dEltbWVkaWF0ZUlkID0gMDtcblxuLy8gRE9NIEFQSXMsIGZvciBjb21wbGV0ZW5lc3NcblxuZXhwb3J0cy5zZXRUaW1lb3V0ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBuZXcgVGltZW91dChhcHBseS5jYWxsKHNldFRpbWVvdXQsIHdpbmRvdywgYXJndW1lbnRzKSwgY2xlYXJUaW1lb3V0KTtcbn07XG5leHBvcnRzLnNldEludGVydmFsID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBuZXcgVGltZW91dChhcHBseS5jYWxsKHNldEludGVydmFsLCB3aW5kb3csIGFyZ3VtZW50cyksIGNsZWFySW50ZXJ2YWwpO1xufTtcbmV4cG9ydHMuY2xlYXJUaW1lb3V0ID1cbmV4cG9ydHMuY2xlYXJJbnRlcnZhbCA9IGZ1bmN0aW9uKHRpbWVvdXQpIHsgdGltZW91dC5jbG9zZSgpOyB9O1xuXG5mdW5jdGlvbiBUaW1lb3V0KGlkLCBjbGVhckZuKSB7XG4gIHRoaXMuX2lkID0gaWQ7XG4gIHRoaXMuX2NsZWFyRm4gPSBjbGVhckZuO1xufVxuVGltZW91dC5wcm90b3R5cGUudW5yZWYgPSBUaW1lb3V0LnByb3RvdHlwZS5yZWYgPSBmdW5jdGlvbigpIHt9O1xuVGltZW91dC5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5fY2xlYXJGbi5jYWxsKHdpbmRvdywgdGhpcy5faWQpO1xufTtcblxuLy8gRG9lcyBub3Qgc3RhcnQgdGhlIHRpbWUsIGp1c3Qgc2V0cyB1cCB0aGUgbWVtYmVycyBuZWVkZWQuXG5leHBvcnRzLmVucm9sbCA9IGZ1bmN0aW9uKGl0ZW0sIG1zZWNzKSB7XG4gIGNsZWFyVGltZW91dChpdGVtLl9pZGxlVGltZW91dElkKTtcbiAgaXRlbS5faWRsZVRpbWVvdXQgPSBtc2Vjcztcbn07XG5cbmV4cG9ydHMudW5lbnJvbGwgPSBmdW5jdGlvbihpdGVtKSB7XG4gIGNsZWFyVGltZW91dChpdGVtLl9pZGxlVGltZW91dElkKTtcbiAgaXRlbS5faWRsZVRpbWVvdXQgPSAtMTtcbn07XG5cbmV4cG9ydHMuX3VucmVmQWN0aXZlID0gZXhwb3J0cy5hY3RpdmUgPSBmdW5jdGlvbihpdGVtKSB7XG4gIGNsZWFyVGltZW91dChpdGVtLl9pZGxlVGltZW91dElkKTtcblxuICB2YXIgbXNlY3MgPSBpdGVtLl9pZGxlVGltZW91dDtcbiAgaWYgKG1zZWNzID49IDApIHtcbiAgICBpdGVtLl9pZGxlVGltZW91dElkID0gc2V0VGltZW91dChmdW5jdGlvbiBvblRpbWVvdXQoKSB7XG4gICAgICBpZiAoaXRlbS5fb25UaW1lb3V0KVxuICAgICAgICBpdGVtLl9vblRpbWVvdXQoKTtcbiAgICB9LCBtc2Vjcyk7XG4gIH1cbn07XG5cbi8vIFRoYXQncyBub3QgaG93IG5vZGUuanMgaW1wbGVtZW50cyBpdCBidXQgdGhlIGV4cG9zZWQgYXBpIGlzIHRoZSBzYW1lLlxuZXhwb3J0cy5zZXRJbW1lZGlhdGUgPSB0eXBlb2Ygc2V0SW1tZWRpYXRlID09PSBcImZ1bmN0aW9uXCIgPyBzZXRJbW1lZGlhdGUgOiBmdW5jdGlvbihmbikge1xuICB2YXIgaWQgPSBuZXh0SW1tZWRpYXRlSWQrKztcbiAgdmFyIGFyZ3MgPSBhcmd1bWVudHMubGVuZ3RoIDwgMiA/IGZhbHNlIDogc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuXG4gIGltbWVkaWF0ZUlkc1tpZF0gPSB0cnVlO1xuXG4gIG5leHRUaWNrKGZ1bmN0aW9uIG9uTmV4dFRpY2soKSB7XG4gICAgaWYgKGltbWVkaWF0ZUlkc1tpZF0pIHtcbiAgICAgIC8vIGZuLmNhbGwoKSBpcyBmYXN0ZXIgc28gd2Ugb3B0aW1pemUgZm9yIHRoZSBjb21tb24gdXNlLWNhc2VcbiAgICAgIC8vIEBzZWUgaHR0cDovL2pzcGVyZi5jb20vY2FsbC1hcHBseS1zZWd1XG4gICAgICBpZiAoYXJncykge1xuICAgICAgICBmbi5hcHBseShudWxsLCBhcmdzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZuLmNhbGwobnVsbCk7XG4gICAgICB9XG4gICAgICAvLyBQcmV2ZW50IGlkcyBmcm9tIGxlYWtpbmdcbiAgICAgIGV4cG9ydHMuY2xlYXJJbW1lZGlhdGUoaWQpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGlkO1xufTtcblxuZXhwb3J0cy5jbGVhckltbWVkaWF0ZSA9IHR5cGVvZiBjbGVhckltbWVkaWF0ZSA9PT0gXCJmdW5jdGlvblwiID8gY2xlYXJJbW1lZGlhdGUgOiBmdW5jdGlvbihpZCkge1xuICBkZWxldGUgaW1tZWRpYXRlSWRzW2lkXTtcbn07XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAod2VicGFjaykvfi9ub2RlLWxpYnMtYnJvd3Nlci9+L3RpbWVycy1icm93c2VyaWZ5L21haW4uanNcbiAqKiBtb2R1bGUgaWQgPSAzMlxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIHZhciBtO1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghZW1pdHRlci5fZXZlbnRzIHx8ICFlbWl0dGVyLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gMDtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbihlbWl0dGVyLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IDE7XG4gIGVsc2VcbiAgICByZXQgPSBlbWl0dGVyLl9ldmVudHNbdHlwZV0ubGVuZ3RoO1xuICByZXR1cm4gcmV0O1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAod2VicGFjaykvfi9ub2RlLWxpYnMtYnJvd3Nlci9+L2V2ZW50cy9ldmVudHMuanNcbiAqKiBtb2R1bGUgaWQgPSAzM1xuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiIWZ1bmN0aW9uKGUpe2lmKFwib2JqZWN0XCI9PXR5cGVvZiBleHBvcnRzJiZcInVuZGVmaW5lZFwiIT10eXBlb2YgbW9kdWxlKW1vZHVsZS5leHBvcnRzPWUoKTtlbHNlIGlmKFwiZnVuY3Rpb25cIj09dHlwZW9mIGRlZmluZSYmZGVmaW5lLmFtZClkZWZpbmUoW10sZSk7ZWxzZXt2YXIgZjtcInVuZGVmaW5lZFwiIT10eXBlb2Ygd2luZG93P2Y9d2luZG93OlwidW5kZWZpbmVkXCIhPXR5cGVvZiBnbG9iYWw/Zj1nbG9iYWw6XCJ1bmRlZmluZWRcIiE9dHlwZW9mIHNlbGYmJihmPXNlbGYpLGYuUHJvbWlzZT1lKCl9fShmdW5jdGlvbigpe3ZhciBkZWZpbmUsbW9kdWxlLGV4cG9ydHM7cmV0dXJuIChmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pKHsxOltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBJTlRFUk5BTDtcblxuZnVuY3Rpb24gSU5URVJOQUwoKSB7fVxufSx7fV0sMjpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4ndXNlIHN0cmljdCc7XG52YXIgUHJvbWlzZSA9IF9kZXJlcV8oJy4vcHJvbWlzZScpO1xudmFyIHJlamVjdCA9IF9kZXJlcV8oJy4vcmVqZWN0Jyk7XG52YXIgcmVzb2x2ZSA9IF9kZXJlcV8oJy4vcmVzb2x2ZScpO1xudmFyIElOVEVSTkFMID0gX2RlcmVxXygnLi9JTlRFUk5BTCcpO1xudmFyIGhhbmRsZXJzID0gX2RlcmVxXygnLi9oYW5kbGVycycpO1xubW9kdWxlLmV4cG9ydHMgPSBhbGw7XG5mdW5jdGlvbiBhbGwoaXRlcmFibGUpIHtcbiAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChpdGVyYWJsZSkgIT09ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICByZXR1cm4gcmVqZWN0KG5ldyBUeXBlRXJyb3IoJ211c3QgYmUgYW4gYXJyYXknKSk7XG4gIH1cblxuICB2YXIgbGVuID0gaXRlcmFibGUubGVuZ3RoO1xuICB2YXIgY2FsbGVkID0gZmFsc2U7XG4gIGlmICghbGVuKSB7XG4gICAgcmV0dXJuIHJlc29sdmUoW10pO1xuICB9XG5cbiAgdmFyIHZhbHVlcyA9IG5ldyBBcnJheShsZW4pO1xuICB2YXIgcmVzb2x2ZWQgPSAwO1xuICB2YXIgaSA9IC0xO1xuICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKElOVEVSTkFMKTtcbiAgXG4gIHdoaWxlICgrK2kgPCBsZW4pIHtcbiAgICBhbGxSZXNvbHZlcihpdGVyYWJsZVtpXSwgaSk7XG4gIH1cbiAgcmV0dXJuIHByb21pc2U7XG4gIGZ1bmN0aW9uIGFsbFJlc29sdmVyKHZhbHVlLCBpKSB7XG4gICAgcmVzb2x2ZSh2YWx1ZSkudGhlbihyZXNvbHZlRnJvbUFsbCwgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICBpZiAoIWNhbGxlZCkge1xuICAgICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgICBoYW5kbGVycy5yZWplY3QocHJvbWlzZSwgZXJyb3IpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGZ1bmN0aW9uIHJlc29sdmVGcm9tQWxsKG91dFZhbHVlKSB7XG4gICAgICB2YWx1ZXNbaV0gPSBvdXRWYWx1ZTtcbiAgICAgIGlmICgrK3Jlc29sdmVkID09PSBsZW4gJiAhY2FsbGVkKSB7XG4gICAgICAgIGNhbGxlZCA9IHRydWU7XG4gICAgICAgIGhhbmRsZXJzLnJlc29sdmUocHJvbWlzZSwgdmFsdWVzKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbn0se1wiLi9JTlRFUk5BTFwiOjEsXCIuL2hhbmRsZXJzXCI6MyxcIi4vcHJvbWlzZVwiOjUsXCIuL3JlamVjdFwiOjgsXCIuL3Jlc29sdmVcIjo5fV0sMzpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4ndXNlIHN0cmljdCc7XG52YXIgdHJ5Q2F0Y2ggPSBfZGVyZXFfKCcuL3RyeUNhdGNoJyk7XG52YXIgcmVzb2x2ZVRoZW5hYmxlID0gX2RlcmVxXygnLi9yZXNvbHZlVGhlbmFibGUnKTtcbnZhciBzdGF0ZXMgPSBfZGVyZXFfKCcuL3N0YXRlcycpO1xuXG5leHBvcnRzLnJlc29sdmUgPSBmdW5jdGlvbiAoc2VsZiwgdmFsdWUpIHtcbiAgdmFyIHJlc3VsdCA9IHRyeUNhdGNoKGdldFRoZW4sIHZhbHVlKTtcbiAgaWYgKHJlc3VsdC5zdGF0dXMgPT09ICdlcnJvcicpIHtcbiAgICByZXR1cm4gZXhwb3J0cy5yZWplY3Qoc2VsZiwgcmVzdWx0LnZhbHVlKTtcbiAgfVxuICB2YXIgdGhlbmFibGUgPSByZXN1bHQudmFsdWU7XG5cbiAgaWYgKHRoZW5hYmxlKSB7XG4gICAgcmVzb2x2ZVRoZW5hYmxlLnNhZmVseShzZWxmLCB0aGVuYWJsZSk7XG4gIH0gZWxzZSB7XG4gICAgc2VsZi5zdGF0ZSA9IHN0YXRlcy5GVUxGSUxMRUQ7XG4gICAgc2VsZi5vdXRjb21lID0gdmFsdWU7XG4gICAgdmFyIGkgPSAtMTtcbiAgICB2YXIgbGVuID0gc2VsZi5xdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgICAgc2VsZi5xdWV1ZVtpXS5jYWxsRnVsZmlsbGVkKHZhbHVlKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHNlbGY7XG59O1xuZXhwb3J0cy5yZWplY3QgPSBmdW5jdGlvbiAoc2VsZiwgZXJyb3IpIHtcbiAgc2VsZi5zdGF0ZSA9IHN0YXRlcy5SRUpFQ1RFRDtcbiAgc2VsZi5vdXRjb21lID0gZXJyb3I7XG4gIHZhciBpID0gLTE7XG4gIHZhciBsZW4gPSBzZWxmLnF1ZXVlLmxlbmd0aDtcbiAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgIHNlbGYucXVldWVbaV0uY2FsbFJlamVjdGVkKGVycm9yKTtcbiAgfVxuICByZXR1cm4gc2VsZjtcbn07XG5cbmZ1bmN0aW9uIGdldFRoZW4ob2JqKSB7XG4gIC8vIE1ha2Ugc3VyZSB3ZSBvbmx5IGFjY2VzcyB0aGUgYWNjZXNzb3Igb25jZSBhcyByZXF1aXJlZCBieSB0aGUgc3BlY1xuICB2YXIgdGhlbiA9IG9iaiAmJiBvYmoudGhlbjtcbiAgaWYgKG9iaiAmJiB0eXBlb2Ygb2JqID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgdGhlbiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiBmdW5jdGlvbiBhcHB5VGhlbigpIHtcbiAgICAgIHRoZW4uYXBwbHkob2JqLCBhcmd1bWVudHMpO1xuICAgIH07XG4gIH1cbn1cbn0se1wiLi9yZXNvbHZlVGhlbmFibGVcIjoxMCxcIi4vc3RhdGVzXCI6MTEsXCIuL3RyeUNhdGNoXCI6MTJ9XSw0OltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbm1vZHVsZS5leHBvcnRzID0gZXhwb3J0cyA9IF9kZXJlcV8oJy4vcHJvbWlzZScpO1xuXG5leHBvcnRzLnJlc29sdmUgPSBfZGVyZXFfKCcuL3Jlc29sdmUnKTtcbmV4cG9ydHMucmVqZWN0ID0gX2RlcmVxXygnLi9yZWplY3QnKTtcbmV4cG9ydHMuYWxsID0gX2RlcmVxXygnLi9hbGwnKTtcbmV4cG9ydHMucmFjZSA9IF9kZXJlcV8oJy4vcmFjZScpO1xufSx7XCIuL2FsbFwiOjIsXCIuL3Byb21pc2VcIjo1LFwiLi9yYWNlXCI6NyxcIi4vcmVqZWN0XCI6OCxcIi4vcmVzb2x2ZVwiOjl9XSw1OltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIHVud3JhcCA9IF9kZXJlcV8oJy4vdW53cmFwJyk7XG52YXIgSU5URVJOQUwgPSBfZGVyZXFfKCcuL0lOVEVSTkFMJyk7XG52YXIgcmVzb2x2ZVRoZW5hYmxlID0gX2RlcmVxXygnLi9yZXNvbHZlVGhlbmFibGUnKTtcbnZhciBzdGF0ZXMgPSBfZGVyZXFfKCcuL3N0YXRlcycpO1xudmFyIFF1ZXVlSXRlbSA9IF9kZXJlcV8oJy4vcXVldWVJdGVtJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gUHJvbWlzZTtcbmZ1bmN0aW9uIFByb21pc2UocmVzb2x2ZXIpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFByb21pc2UpKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmVyKTtcbiAgfVxuICBpZiAodHlwZW9mIHJlc29sdmVyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcigncmVzb2x2ZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG4gIH1cbiAgdGhpcy5zdGF0ZSA9IHN0YXRlcy5QRU5ESU5HO1xuICB0aGlzLnF1ZXVlID0gW107XG4gIHRoaXMub3V0Y29tZSA9IHZvaWQgMDtcbiAgaWYgKHJlc29sdmVyICE9PSBJTlRFUk5BTCkge1xuICAgIHJlc29sdmVUaGVuYWJsZS5zYWZlbHkodGhpcywgcmVzb2x2ZXIpO1xuICB9XG59XG5cblByb21pc2UucHJvdG90eXBlWydjYXRjaCddID0gZnVuY3Rpb24gKG9uUmVqZWN0ZWQpIHtcbiAgcmV0dXJuIHRoaXMudGhlbihudWxsLCBvblJlamVjdGVkKTtcbn07XG5Qcm9taXNlLnByb3RvdHlwZS50aGVuID0gZnVuY3Rpb24gKG9uRnVsZmlsbGVkLCBvblJlamVjdGVkKSB7XG4gIGlmICh0eXBlb2Ygb25GdWxmaWxsZWQgIT09ICdmdW5jdGlvbicgJiYgdGhpcy5zdGF0ZSA9PT0gc3RhdGVzLkZVTEZJTExFRCB8fFxuICAgIHR5cGVvZiBvblJlamVjdGVkICE9PSAnZnVuY3Rpb24nICYmIHRoaXMuc3RhdGUgPT09IHN0YXRlcy5SRUpFQ1RFRCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoSU5URVJOQUwpO1xuXG4gIFxuICBpZiAodGhpcy5zdGF0ZSAhPT0gc3RhdGVzLlBFTkRJTkcpIHtcbiAgICB2YXIgcmVzb2x2ZXIgPSB0aGlzLnN0YXRlID09PSBzdGF0ZXMuRlVMRklMTEVEID8gb25GdWxmaWxsZWQ6IG9uUmVqZWN0ZWQ7XG4gICAgdW53cmFwKHByb21pc2UsIHJlc29sdmVyLCB0aGlzLm91dGNvbWUpO1xuICB9IGVsc2Uge1xuICAgIHRoaXMucXVldWUucHVzaChuZXcgUXVldWVJdGVtKHByb21pc2UsIG9uRnVsZmlsbGVkLCBvblJlamVjdGVkKSk7XG4gIH1cblxuICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbn0se1wiLi9JTlRFUk5BTFwiOjEsXCIuL3F1ZXVlSXRlbVwiOjYsXCIuL3Jlc29sdmVUaGVuYWJsZVwiOjEwLFwiLi9zdGF0ZXNcIjoxMSxcIi4vdW53cmFwXCI6MTN9XSw2OltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbid1c2Ugc3RyaWN0JztcbnZhciBoYW5kbGVycyA9IF9kZXJlcV8oJy4vaGFuZGxlcnMnKTtcbnZhciB1bndyYXAgPSBfZGVyZXFfKCcuL3Vud3JhcCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFF1ZXVlSXRlbTtcbmZ1bmN0aW9uIFF1ZXVlSXRlbShwcm9taXNlLCBvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCkge1xuICB0aGlzLnByb21pc2UgPSBwcm9taXNlO1xuICBpZiAodHlwZW9mIG9uRnVsZmlsbGVkID09PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhpcy5vbkZ1bGZpbGxlZCA9IG9uRnVsZmlsbGVkO1xuICAgIHRoaXMuY2FsbEZ1bGZpbGxlZCA9IHRoaXMub3RoZXJDYWxsRnVsZmlsbGVkO1xuICB9XG4gIGlmICh0eXBlb2Ygb25SZWplY3RlZCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHRoaXMub25SZWplY3RlZCA9IG9uUmVqZWN0ZWQ7XG4gICAgdGhpcy5jYWxsUmVqZWN0ZWQgPSB0aGlzLm90aGVyQ2FsbFJlamVjdGVkO1xuICB9XG59XG5RdWV1ZUl0ZW0ucHJvdG90eXBlLmNhbGxGdWxmaWxsZWQgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgaGFuZGxlcnMucmVzb2x2ZSh0aGlzLnByb21pc2UsIHZhbHVlKTtcbn07XG5RdWV1ZUl0ZW0ucHJvdG90eXBlLm90aGVyQ2FsbEZ1bGZpbGxlZCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICB1bndyYXAodGhpcy5wcm9taXNlLCB0aGlzLm9uRnVsZmlsbGVkLCB2YWx1ZSk7XG59O1xuUXVldWVJdGVtLnByb3RvdHlwZS5jYWxsUmVqZWN0ZWQgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgaGFuZGxlcnMucmVqZWN0KHRoaXMucHJvbWlzZSwgdmFsdWUpO1xufTtcblF1ZXVlSXRlbS5wcm90b3R5cGUub3RoZXJDYWxsUmVqZWN0ZWQgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgdW53cmFwKHRoaXMucHJvbWlzZSwgdGhpcy5vblJlamVjdGVkLCB2YWx1ZSk7XG59O1xufSx7XCIuL2hhbmRsZXJzXCI6MyxcIi4vdW53cmFwXCI6MTN9XSw3OltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbid1c2Ugc3RyaWN0JztcbnZhciBQcm9taXNlID0gX2RlcmVxXygnLi9wcm9taXNlJyk7XG52YXIgcmVqZWN0ID0gX2RlcmVxXygnLi9yZWplY3QnKTtcbnZhciByZXNvbHZlID0gX2RlcmVxXygnLi9yZXNvbHZlJyk7XG52YXIgSU5URVJOQUwgPSBfZGVyZXFfKCcuL0lOVEVSTkFMJyk7XG52YXIgaGFuZGxlcnMgPSBfZGVyZXFfKCcuL2hhbmRsZXJzJyk7XG5tb2R1bGUuZXhwb3J0cyA9IHJhY2U7XG5mdW5jdGlvbiByYWNlKGl0ZXJhYmxlKSB7XG4gIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoaXRlcmFibGUpICE9PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgcmV0dXJuIHJlamVjdChuZXcgVHlwZUVycm9yKCdtdXN0IGJlIGFuIGFycmF5JykpO1xuICB9XG5cbiAgdmFyIGxlbiA9IGl0ZXJhYmxlLmxlbmd0aDtcbiAgdmFyIGNhbGxlZCA9IGZhbHNlO1xuICBpZiAoIWxlbikge1xuICAgIHJldHVybiByZXNvbHZlKFtdKTtcbiAgfVxuXG4gIHZhciByZXNvbHZlZCA9IDA7XG4gIHZhciBpID0gLTE7XG4gIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoSU5URVJOQUwpO1xuICBcbiAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgIHJlc29sdmVyKGl0ZXJhYmxlW2ldKTtcbiAgfVxuICByZXR1cm4gcHJvbWlzZTtcbiAgZnVuY3Rpb24gcmVzb2x2ZXIodmFsdWUpIHtcbiAgICByZXNvbHZlKHZhbHVlKS50aGVuKGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgaWYgKCFjYWxsZWQpIHtcbiAgICAgICAgY2FsbGVkID0gdHJ1ZTtcbiAgICAgICAgaGFuZGxlcnMucmVzb2x2ZShwcm9taXNlLCByZXNwb25zZSk7XG4gICAgICB9XG4gICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICBpZiAoIWNhbGxlZCkge1xuICAgICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgICBoYW5kbGVycy5yZWplY3QocHJvbWlzZSwgZXJyb3IpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG59LHtcIi4vSU5URVJOQUxcIjoxLFwiLi9oYW5kbGVyc1wiOjMsXCIuL3Byb21pc2VcIjo1LFwiLi9yZWplY3RcIjo4LFwiLi9yZXNvbHZlXCI6OX1dLDg6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgUHJvbWlzZSA9IF9kZXJlcV8oJy4vcHJvbWlzZScpO1xudmFyIElOVEVSTkFMID0gX2RlcmVxXygnLi9JTlRFUk5BTCcpO1xudmFyIGhhbmRsZXJzID0gX2RlcmVxXygnLi9oYW5kbGVycycpO1xubW9kdWxlLmV4cG9ydHMgPSByZWplY3Q7XG5cbmZ1bmN0aW9uIHJlamVjdChyZWFzb24pIHtcblx0dmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShJTlRFUk5BTCk7XG5cdHJldHVybiBoYW5kbGVycy5yZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbn1cbn0se1wiLi9JTlRFUk5BTFwiOjEsXCIuL2hhbmRsZXJzXCI6MyxcIi4vcHJvbWlzZVwiOjV9XSw5OltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIFByb21pc2UgPSBfZGVyZXFfKCcuL3Byb21pc2UnKTtcbnZhciBJTlRFUk5BTCA9IF9kZXJlcV8oJy4vSU5URVJOQUwnKTtcbnZhciBoYW5kbGVycyA9IF9kZXJlcV8oJy4vaGFuZGxlcnMnKTtcbm1vZHVsZS5leHBvcnRzID0gcmVzb2x2ZTtcblxudmFyIEZBTFNFID0gaGFuZGxlcnMucmVzb2x2ZShuZXcgUHJvbWlzZShJTlRFUk5BTCksIGZhbHNlKTtcbnZhciBOVUxMID0gaGFuZGxlcnMucmVzb2x2ZShuZXcgUHJvbWlzZShJTlRFUk5BTCksIG51bGwpO1xudmFyIFVOREVGSU5FRCA9IGhhbmRsZXJzLnJlc29sdmUobmV3IFByb21pc2UoSU5URVJOQUwpLCB2b2lkIDApO1xudmFyIFpFUk8gPSBoYW5kbGVycy5yZXNvbHZlKG5ldyBQcm9taXNlKElOVEVSTkFMKSwgMCk7XG52YXIgRU1QVFlTVFJJTkcgPSBoYW5kbGVycy5yZXNvbHZlKG5ldyBQcm9taXNlKElOVEVSTkFMKSwgJycpO1xuXG5mdW5jdGlvbiByZXNvbHZlKHZhbHVlKSB7XG4gIGlmICh2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFByb21pc2UpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGhhbmRsZXJzLnJlc29sdmUobmV3IFByb21pc2UoSU5URVJOQUwpLCB2YWx1ZSk7XG4gIH1cbiAgdmFyIHZhbHVlVHlwZSA9IHR5cGVvZiB2YWx1ZTtcbiAgc3dpdGNoICh2YWx1ZVR5cGUpIHtcbiAgICBjYXNlICdib29sZWFuJzpcbiAgICAgIHJldHVybiBGQUxTRTtcbiAgICBjYXNlICd1bmRlZmluZWQnOlxuICAgICAgcmV0dXJuIFVOREVGSU5FRDtcbiAgICBjYXNlICdvYmplY3QnOlxuICAgICAgcmV0dXJuIE5VTEw7XG4gICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgIHJldHVybiBaRVJPO1xuICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICByZXR1cm4gRU1QVFlTVFJJTkc7XG4gIH1cbn1cbn0se1wiLi9JTlRFUk5BTFwiOjEsXCIuL2hhbmRsZXJzXCI6MyxcIi4vcHJvbWlzZVwiOjV9XSwxMDpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4ndXNlIHN0cmljdCc7XG52YXIgaGFuZGxlcnMgPSBfZGVyZXFfKCcuL2hhbmRsZXJzJyk7XG52YXIgdHJ5Q2F0Y2ggPSBfZGVyZXFfKCcuL3RyeUNhdGNoJyk7XG5mdW5jdGlvbiBzYWZlbHlSZXNvbHZlVGhlbmFibGUoc2VsZiwgdGhlbmFibGUpIHtcbiAgLy8gRWl0aGVyIGZ1bGZpbGwsIHJlamVjdCBvciByZWplY3Qgd2l0aCBlcnJvclxuICB2YXIgY2FsbGVkID0gZmFsc2U7XG4gIGZ1bmN0aW9uIG9uRXJyb3IodmFsdWUpIHtcbiAgICBpZiAoY2FsbGVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNhbGxlZCA9IHRydWU7XG4gICAgaGFuZGxlcnMucmVqZWN0KHNlbGYsIHZhbHVlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uU3VjY2Vzcyh2YWx1ZSkge1xuICAgIGlmIChjYWxsZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY2FsbGVkID0gdHJ1ZTtcbiAgICBoYW5kbGVycy5yZXNvbHZlKHNlbGYsIHZhbHVlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRyeVRvVW53cmFwKCkge1xuICAgIHRoZW5hYmxlKG9uU3VjY2Vzcywgb25FcnJvcik7XG4gIH1cbiAgXG4gIHZhciByZXN1bHQgPSB0cnlDYXRjaCh0cnlUb1Vud3JhcCk7XG4gIGlmIChyZXN1bHQuc3RhdHVzID09PSAnZXJyb3InKSB7XG4gICAgb25FcnJvcihyZXN1bHQudmFsdWUpO1xuICB9XG59XG5leHBvcnRzLnNhZmVseSA9IHNhZmVseVJlc29sdmVUaGVuYWJsZTtcbn0se1wiLi9oYW5kbGVyc1wiOjMsXCIuL3RyeUNhdGNoXCI6MTJ9XSwxMTpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4vLyBMYXp5IG1hbidzIHN5bWJvbHMgZm9yIHN0YXRlc1xuXG5leHBvcnRzLlJFSkVDVEVEID0gWydSRUpFQ1RFRCddO1xuZXhwb3J0cy5GVUxGSUxMRUQgPSBbJ0ZVTEZJTExFRCddO1xuZXhwb3J0cy5QRU5ESU5HID0gWydQRU5ESU5HJ107XG59LHt9XSwxMjpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG4ndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gdHJ5Q2F0Y2g7XG5cbmZ1bmN0aW9uIHRyeUNhdGNoKGZ1bmMsIHZhbHVlKSB7XG4gIHZhciBvdXQgPSB7fTtcbiAgdHJ5IHtcbiAgICBvdXQudmFsdWUgPSBmdW5jKHZhbHVlKTtcbiAgICBvdXQuc3RhdHVzID0gJ3N1Y2Nlc3MnO1xuICB9IGNhdGNoIChlKSB7XG4gICAgb3V0LnN0YXR1cyA9ICdlcnJvcic7XG4gICAgb3V0LnZhbHVlID0gZTtcbiAgfVxuICByZXR1cm4gb3V0O1xufVxufSx7fV0sMTM6W2Z1bmN0aW9uKF9kZXJlcV8sbW9kdWxlLGV4cG9ydHMpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgaW1tZWRpYXRlID0gX2RlcmVxXygnaW1tZWRpYXRlJyk7XG52YXIgaGFuZGxlcnMgPSBfZGVyZXFfKCcuL2hhbmRsZXJzJyk7XG5tb2R1bGUuZXhwb3J0cyA9IHVud3JhcDtcblxuZnVuY3Rpb24gdW53cmFwKHByb21pc2UsIGZ1bmMsIHZhbHVlKSB7XG4gIGltbWVkaWF0ZShmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJldHVyblZhbHVlO1xuICAgIHRyeSB7XG4gICAgICByZXR1cm5WYWx1ZSA9IGZ1bmModmFsdWUpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiBoYW5kbGVycy5yZWplY3QocHJvbWlzZSwgZSk7XG4gICAgfVxuICAgIGlmIChyZXR1cm5WYWx1ZSA9PT0gcHJvbWlzZSkge1xuICAgICAgaGFuZGxlcnMucmVqZWN0KHByb21pc2UsIG5ldyBUeXBlRXJyb3IoJ0Nhbm5vdCByZXNvbHZlIHByb21pc2Ugd2l0aCBpdHNlbGYnKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGhhbmRsZXJzLnJlc29sdmUocHJvbWlzZSwgcmV0dXJuVmFsdWUpO1xuICAgIH1cbiAgfSk7XG59XG59LHtcIi4vaGFuZGxlcnNcIjozLFwiaW1tZWRpYXRlXCI6MTV9XSwxNDpbZnVuY3Rpb24oX2RlcmVxXyxtb2R1bGUsZXhwb3J0cyl7XG5cbn0se31dLDE1OltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbid1c2Ugc3RyaWN0JztcbnZhciB0eXBlcyA9IFtcbiAgX2RlcmVxXygnLi9uZXh0VGljaycpLFxuICBfZGVyZXFfKCcuL211dGF0aW9uLmpzJyksXG4gIF9kZXJlcV8oJy4vbWVzc2FnZUNoYW5uZWwnKSxcbiAgX2RlcmVxXygnLi9zdGF0ZUNoYW5nZScpLFxuICBfZGVyZXFfKCcuL3RpbWVvdXQnKVxuXTtcbnZhciBkcmFpbmluZztcbnZhciBxdWV1ZSA9IFtdO1xuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgZHJhaW5pbmcgPSB0cnVlO1xuICB2YXIgaSwgb2xkUXVldWU7XG4gIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gIHdoaWxlIChsZW4pIHtcbiAgICBvbGRRdWV1ZSA9IHF1ZXVlO1xuICAgIHF1ZXVlID0gW107XG4gICAgaSA9IC0xO1xuICAgIHdoaWxlICgrK2kgPCBsZW4pIHtcbiAgICAgIG9sZFF1ZXVlW2ldKCk7XG4gICAgfVxuICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgfVxuICBkcmFpbmluZyA9IGZhbHNlO1xufVxudmFyIHNjaGVkdWxlRHJhaW47XG52YXIgaSA9IC0xO1xudmFyIGxlbiA9IHR5cGVzLmxlbmd0aDtcbndoaWxlICgrKyBpIDwgbGVuKSB7XG4gIGlmICh0eXBlc1tpXSAmJiB0eXBlc1tpXS50ZXN0ICYmIHR5cGVzW2ldLnRlc3QoKSkge1xuICAgIHNjaGVkdWxlRHJhaW4gPSB0eXBlc1tpXS5pbnN0YWxsKGRyYWluUXVldWUpO1xuICAgIGJyZWFrO1xuICB9XG59XG5tb2R1bGUuZXhwb3J0cyA9IGltbWVkaWF0ZTtcbmZ1bmN0aW9uIGltbWVkaWF0ZSh0YXNrKSB7XG4gIGlmIChxdWV1ZS5wdXNoKHRhc2spID09PSAxICYmICFkcmFpbmluZykge1xuICAgIHNjaGVkdWxlRHJhaW4oKTtcbiAgfVxufVxufSx7XCIuL21lc3NhZ2VDaGFubmVsXCI6MTYsXCIuL211dGF0aW9uLmpzXCI6MTcsXCIuL25leHRUaWNrXCI6MTQsXCIuL3N0YXRlQ2hhbmdlXCI6MTgsXCIuL3RpbWVvdXRcIjoxOX1dLDE2OltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy50ZXN0ID0gZnVuY3Rpb24gKCkge1xuICBpZiAoZ2xvYmFsLnNldEltbWVkaWF0ZSkge1xuICAgIC8vIHdlIGNhbiBvbmx5IGdldCBoZXJlIGluIElFMTBcbiAgICAvLyB3aGljaCBkb2Vzbid0IGhhbmRlbCBwb3N0TWVzc2FnZSB3ZWxsXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0eXBlb2YgZ2xvYmFsLk1lc3NhZ2VDaGFubmVsICE9PSAndW5kZWZpbmVkJztcbn07XG5cbmV4cG9ydHMuaW5zdGFsbCA9IGZ1bmN0aW9uIChmdW5jKSB7XG4gIHZhciBjaGFubmVsID0gbmV3IGdsb2JhbC5NZXNzYWdlQ2hhbm5lbCgpO1xuICBjaGFubmVsLnBvcnQxLm9ubWVzc2FnZSA9IGZ1bmM7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgY2hhbm5lbC5wb3J0Mi5wb3N0TWVzc2FnZSgwKTtcbiAgfTtcbn07XG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSlcbn0se31dLDE3OltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0Jztcbi8vYmFzZWQgb2ZmIHJzdnAgaHR0cHM6Ly9naXRodWIuY29tL3RpbGRlaW8vcnN2cC5qc1xuLy9saWNlbnNlIGh0dHBzOi8vZ2l0aHViLmNvbS90aWxkZWlvL3JzdnAuanMvYmxvYi9tYXN0ZXIvTElDRU5TRVxuLy9odHRwczovL2dpdGh1Yi5jb20vdGlsZGVpby9yc3ZwLmpzL2Jsb2IvbWFzdGVyL2xpYi9yc3ZwL2FzYXAuanNcblxudmFyIE11dGF0aW9uID0gZ2xvYmFsLk11dGF0aW9uT2JzZXJ2ZXIgfHwgZ2xvYmFsLldlYktpdE11dGF0aW9uT2JzZXJ2ZXI7XG5cbmV4cG9ydHMudGVzdCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIE11dGF0aW9uO1xufTtcblxuZXhwb3J0cy5pbnN0YWxsID0gZnVuY3Rpb24gKGhhbmRsZSkge1xuICB2YXIgY2FsbGVkID0gMDtcbiAgdmFyIG9ic2VydmVyID0gbmV3IE11dGF0aW9uKGhhbmRsZSk7XG4gIHZhciBlbGVtZW50ID0gZ2xvYmFsLmRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcnKTtcbiAgb2JzZXJ2ZXIub2JzZXJ2ZShlbGVtZW50LCB7XG4gICAgY2hhcmFjdGVyRGF0YTogdHJ1ZVxuICB9KTtcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICBlbGVtZW50LmRhdGEgPSAoY2FsbGVkID0gKytjYWxsZWQgJSAyKTtcbiAgfTtcbn07XG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSlcbn0se31dLDE4OltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy50ZXN0ID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gJ2RvY3VtZW50JyBpbiBnbG9iYWwgJiYgJ29ucmVhZHlzdGF0ZWNoYW5nZScgaW4gZ2xvYmFsLmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xufTtcblxuZXhwb3J0cy5pbnN0YWxsID0gZnVuY3Rpb24gKGhhbmRsZSkge1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuXG4gICAgLy8gQ3JlYXRlIGEgPHNjcmlwdD4gZWxlbWVudDsgaXRzIHJlYWR5c3RhdGVjaGFuZ2UgZXZlbnQgd2lsbCBiZSBmaXJlZCBhc3luY2hyb25vdXNseSBvbmNlIGl0IGlzIGluc2VydGVkXG4gICAgLy8gaW50byB0aGUgZG9jdW1lbnQuIERvIHNvLCB0aHVzIHF1ZXVpbmcgdXAgdGhlIHRhc2suIFJlbWVtYmVyIHRvIGNsZWFuIHVwIG9uY2UgaXQncyBiZWVuIGNhbGxlZC5cbiAgICB2YXIgc2NyaXB0RWwgPSBnbG9iYWwuZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG4gICAgc2NyaXB0RWwub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24gKCkge1xuICAgICAgaGFuZGxlKCk7XG5cbiAgICAgIHNjcmlwdEVsLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IG51bGw7XG4gICAgICBzY3JpcHRFbC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHNjcmlwdEVsKTtcbiAgICAgIHNjcmlwdEVsID0gbnVsbDtcbiAgICB9O1xuICAgIGdsb2JhbC5kb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuYXBwZW5kQ2hpbGQoc2NyaXB0RWwpO1xuXG4gICAgcmV0dXJuIGhhbmRsZTtcbiAgfTtcbn07XG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSlcbn0se31dLDE5OltmdW5jdGlvbihfZGVyZXFfLG1vZHVsZSxleHBvcnRzKXtcbid1c2Ugc3RyaWN0JztcbmV4cG9ydHMudGVzdCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRydWU7XG59O1xuXG5leHBvcnRzLmluc3RhbGwgPSBmdW5jdGlvbiAodCkge1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHNldFRpbWVvdXQodCwgMCk7XG4gIH07XG59O1xufSx7fV19LHt9LFs0XSkoNClcbn0pO1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL34vbGllL2Rpc3QvbGllLmpzXG4gKiogbW9kdWxlIGlkID0gMzRcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIlxuLyoqXG4gKiBUaGlzIGlzIHRoZSBjb21tb24gbG9naWMgZm9yIGJvdGggdGhlIE5vZGUuanMgYW5kIHdlYiBicm93c2VyXG4gKiBpbXBsZW1lbnRhdGlvbnMgb2YgYGRlYnVnKClgLlxuICpcbiAqIEV4cG9zZSBgZGVidWcoKWAgYXMgdGhlIG1vZHVsZS5cbiAqL1xuXG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBkZWJ1ZztcbmV4cG9ydHMuY29lcmNlID0gY29lcmNlO1xuZXhwb3J0cy5kaXNhYmxlID0gZGlzYWJsZTtcbmV4cG9ydHMuZW5hYmxlID0gZW5hYmxlO1xuZXhwb3J0cy5lbmFibGVkID0gZW5hYmxlZDtcbmV4cG9ydHMuaHVtYW5pemUgPSByZXF1aXJlKCdtcycpO1xuXG4vKipcbiAqIFRoZSBjdXJyZW50bHkgYWN0aXZlIGRlYnVnIG1vZGUgbmFtZXMsIGFuZCBuYW1lcyB0byBza2lwLlxuICovXG5cbmV4cG9ydHMubmFtZXMgPSBbXTtcbmV4cG9ydHMuc2tpcHMgPSBbXTtcblxuLyoqXG4gKiBNYXAgb2Ygc3BlY2lhbCBcIiVuXCIgaGFuZGxpbmcgZnVuY3Rpb25zLCBmb3IgdGhlIGRlYnVnIFwiZm9ybWF0XCIgYXJndW1lbnQuXG4gKlxuICogVmFsaWQga2V5IG5hbWVzIGFyZSBhIHNpbmdsZSwgbG93ZXJjYXNlZCBsZXR0ZXIsIGkuZS4gXCJuXCIuXG4gKi9cblxuZXhwb3J0cy5mb3JtYXR0ZXJzID0ge307XG5cbi8qKlxuICogUHJldmlvdXNseSBhc3NpZ25lZCBjb2xvci5cbiAqL1xuXG52YXIgcHJldkNvbG9yID0gMDtcblxuLyoqXG4gKiBQcmV2aW91cyBsb2cgdGltZXN0YW1wLlxuICovXG5cbnZhciBwcmV2VGltZTtcblxuLyoqXG4gKiBTZWxlY3QgYSBjb2xvci5cbiAqXG4gKiBAcmV0dXJuIHtOdW1iZXJ9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzZWxlY3RDb2xvcigpIHtcbiAgcmV0dXJuIGV4cG9ydHMuY29sb3JzW3ByZXZDb2xvcisrICUgZXhwb3J0cy5jb2xvcnMubGVuZ3RoXTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBkZWJ1Z2dlciB3aXRoIHRoZSBnaXZlbiBgbmFtZXNwYWNlYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZGVidWcobmFtZXNwYWNlKSB7XG5cbiAgLy8gZGVmaW5lIHRoZSBgZGlzYWJsZWRgIHZlcnNpb25cbiAgZnVuY3Rpb24gZGlzYWJsZWQoKSB7XG4gIH1cbiAgZGlzYWJsZWQuZW5hYmxlZCA9IGZhbHNlO1xuXG4gIC8vIGRlZmluZSB0aGUgYGVuYWJsZWRgIHZlcnNpb25cbiAgZnVuY3Rpb24gZW5hYmxlZCgpIHtcblxuICAgIHZhciBzZWxmID0gZW5hYmxlZDtcblxuICAgIC8vIHNldCBgZGlmZmAgdGltZXN0YW1wXG4gICAgdmFyIGN1cnIgPSArbmV3IERhdGUoKTtcbiAgICB2YXIgbXMgPSBjdXJyIC0gKHByZXZUaW1lIHx8IGN1cnIpO1xuICAgIHNlbGYuZGlmZiA9IG1zO1xuICAgIHNlbGYucHJldiA9IHByZXZUaW1lO1xuICAgIHNlbGYuY3VyciA9IGN1cnI7XG4gICAgcHJldlRpbWUgPSBjdXJyO1xuXG4gICAgLy8gYWRkIHRoZSBgY29sb3JgIGlmIG5vdCBzZXRcbiAgICBpZiAobnVsbCA9PSBzZWxmLnVzZUNvbG9ycykgc2VsZi51c2VDb2xvcnMgPSBleHBvcnRzLnVzZUNvbG9ycygpO1xuICAgIGlmIChudWxsID09IHNlbGYuY29sb3IgJiYgc2VsZi51c2VDb2xvcnMpIHNlbGYuY29sb3IgPSBzZWxlY3RDb2xvcigpO1xuXG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuXG4gICAgYXJnc1swXSA9IGV4cG9ydHMuY29lcmNlKGFyZ3NbMF0pO1xuXG4gICAgaWYgKCdzdHJpbmcnICE9PSB0eXBlb2YgYXJnc1swXSkge1xuICAgICAgLy8gYW55dGhpbmcgZWxzZSBsZXQncyBpbnNwZWN0IHdpdGggJW9cbiAgICAgIGFyZ3MgPSBbJyVvJ10uY29uY2F0KGFyZ3MpO1xuICAgIH1cblxuICAgIC8vIGFwcGx5IGFueSBgZm9ybWF0dGVyc2AgdHJhbnNmb3JtYXRpb25zXG4gICAgdmFyIGluZGV4ID0gMDtcbiAgICBhcmdzWzBdID0gYXJnc1swXS5yZXBsYWNlKC8lKFthLXolXSkvZywgZnVuY3Rpb24obWF0Y2gsIGZvcm1hdCkge1xuICAgICAgLy8gaWYgd2UgZW5jb3VudGVyIGFuIGVzY2FwZWQgJSB0aGVuIGRvbid0IGluY3JlYXNlIHRoZSBhcnJheSBpbmRleFxuICAgICAgaWYgKG1hdGNoID09PSAnJSUnKSByZXR1cm4gbWF0Y2g7XG4gICAgICBpbmRleCsrO1xuICAgICAgdmFyIGZvcm1hdHRlciA9IGV4cG9ydHMuZm9ybWF0dGVyc1tmb3JtYXRdO1xuICAgICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBmb3JtYXR0ZXIpIHtcbiAgICAgICAgdmFyIHZhbCA9IGFyZ3NbaW5kZXhdO1xuICAgICAgICBtYXRjaCA9IGZvcm1hdHRlci5jYWxsKHNlbGYsIHZhbCk7XG5cbiAgICAgICAgLy8gbm93IHdlIG5lZWQgdG8gcmVtb3ZlIGBhcmdzW2luZGV4XWAgc2luY2UgaXQncyBpbmxpbmVkIGluIHRoZSBgZm9ybWF0YFxuICAgICAgICBhcmdzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIGluZGV4LS07XG4gICAgICB9XG4gICAgICByZXR1cm4gbWF0Y2g7XG4gICAgfSk7XG5cbiAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGV4cG9ydHMuZm9ybWF0QXJncykge1xuICAgICAgYXJncyA9IGV4cG9ydHMuZm9ybWF0QXJncy5hcHBseShzZWxmLCBhcmdzKTtcbiAgICB9XG4gICAgdmFyIGxvZ0ZuID0gZW5hYmxlZC5sb2cgfHwgZXhwb3J0cy5sb2cgfHwgY29uc29sZS5sb2cuYmluZChjb25zb2xlKTtcbiAgICBsb2dGbi5hcHBseShzZWxmLCBhcmdzKTtcbiAgfVxuICBlbmFibGVkLmVuYWJsZWQgPSB0cnVlO1xuXG4gIHZhciBmbiA9IGV4cG9ydHMuZW5hYmxlZChuYW1lc3BhY2UpID8gZW5hYmxlZCA6IGRpc2FibGVkO1xuXG4gIGZuLm5hbWVzcGFjZSA9IG5hbWVzcGFjZTtcblxuICByZXR1cm4gZm47XG59XG5cbi8qKlxuICogRW5hYmxlcyBhIGRlYnVnIG1vZGUgYnkgbmFtZXNwYWNlcy4gVGhpcyBjYW4gaW5jbHVkZSBtb2Rlc1xuICogc2VwYXJhdGVkIGJ5IGEgY29sb24gYW5kIHdpbGRjYXJkcy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlc1xuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBlbmFibGUobmFtZXNwYWNlcykge1xuICBleHBvcnRzLnNhdmUobmFtZXNwYWNlcyk7XG5cbiAgdmFyIHNwbGl0ID0gKG5hbWVzcGFjZXMgfHwgJycpLnNwbGl0KC9bXFxzLF0rLyk7XG4gIHZhciBsZW4gPSBzcGxpdC5sZW5ndGg7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgIGlmICghc3BsaXRbaV0pIGNvbnRpbnVlOyAvLyBpZ25vcmUgZW1wdHkgc3RyaW5nc1xuICAgIG5hbWVzcGFjZXMgPSBzcGxpdFtpXS5yZXBsYWNlKC9cXCovZywgJy4qPycpO1xuICAgIGlmIChuYW1lc3BhY2VzWzBdID09PSAnLScpIHtcbiAgICAgIGV4cG9ydHMuc2tpcHMucHVzaChuZXcgUmVnRXhwKCdeJyArIG5hbWVzcGFjZXMuc3Vic3RyKDEpICsgJyQnKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGV4cG9ydHMubmFtZXMucHVzaChuZXcgUmVnRXhwKCdeJyArIG5hbWVzcGFjZXMgKyAnJCcpKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBEaXNhYmxlIGRlYnVnIG91dHB1dC5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGRpc2FibGUoKSB7XG4gIGV4cG9ydHMuZW5hYmxlKCcnKTtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIGdpdmVuIG1vZGUgbmFtZSBpcyBlbmFibGVkLCBmYWxzZSBvdGhlcndpc2UuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGVuYWJsZWQobmFtZSkge1xuICB2YXIgaSwgbGVuO1xuICBmb3IgKGkgPSAwLCBsZW4gPSBleHBvcnRzLnNraXBzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKGV4cG9ydHMuc2tpcHNbaV0udGVzdChuYW1lKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICBmb3IgKGkgPSAwLCBsZW4gPSBleHBvcnRzLm5hbWVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKGV4cG9ydHMubmFtZXNbaV0udGVzdChuYW1lKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuLyoqXG4gKiBDb2VyY2UgYHZhbGAuXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gdmFsXG4gKiBAcmV0dXJuIHtNaXhlZH1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGNvZXJjZSh2YWwpIHtcbiAgaWYgKHZhbCBpbnN0YW5jZW9mIEVycm9yKSByZXR1cm4gdmFsLnN0YWNrIHx8IHZhbC5tZXNzYWdlO1xuICByZXR1cm4gdmFsO1xufVxuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL34vZGVidWcvZGVidWcuanNcbiAqKiBtb2R1bGUgaWQgPSAzNVxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihtb2R1bGUpIHtcclxuXHRpZighbW9kdWxlLndlYnBhY2tQb2x5ZmlsbCkge1xyXG5cdFx0bW9kdWxlLmRlcHJlY2F0ZSA9IGZ1bmN0aW9uKCkge307XHJcblx0XHRtb2R1bGUucGF0aHMgPSBbXTtcclxuXHRcdC8vIG1vZHVsZS5wYXJlbnQgPSB1bmRlZmluZWQgYnkgZGVmYXVsdFxyXG5cdFx0bW9kdWxlLmNoaWxkcmVuID0gW107XHJcblx0XHRtb2R1bGUud2VicGFja1BvbHlmaWxsID0gMTtcclxuXHR9XHJcblx0cmV0dXJuIG1vZHVsZTtcclxufVxyXG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqICh3ZWJwYWNrKS9idWlsZGluL21vZHVsZS5qc1xuICoqIG1vZHVsZSBpZCA9IDM2XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBkcmFpbmluZyA9IHRydWU7XG4gICAgdmFyIGN1cnJlbnRRdWV1ZTtcbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgdmFyIGkgPSAtMTtcbiAgICAgICAgd2hpbGUgKCsraSA8IGxlbikge1xuICAgICAgICAgICAgY3VycmVudFF1ZXVlW2ldKCk7XG4gICAgICAgIH1cbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBkcmFpbmluZyA9IGZhbHNlO1xufVxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICBxdWV1ZS5wdXNoKGZ1bik7XG4gICAgaWYgKCFkcmFpbmluZykge1xuICAgICAgICBzZXRUaW1lb3V0KGRyYWluUXVldWUsIDApO1xuICAgIH1cbn07XG5cbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG4vLyBUT0RPKHNodHlsbWFuKVxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAod2VicGFjaykvfi9ub2RlLWxpYnMtYnJvd3Nlci9+L3Byb2Nlc3MvYnJvd3Nlci5qc1xuICoqIG1vZHVsZSBpZCA9IDM3XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCIvKipcbiAqIEhlbHBlcnMuXG4gKi9cblxudmFyIHMgPSAxMDAwO1xudmFyIG0gPSBzICogNjA7XG52YXIgaCA9IG0gKiA2MDtcbnZhciBkID0gaCAqIDI0O1xudmFyIHkgPSBkICogMzY1LjI1O1xuXG4vKipcbiAqIFBhcnNlIG9yIGZvcm1hdCB0aGUgZ2l2ZW4gYHZhbGAuXG4gKlxuICogT3B0aW9uczpcbiAqXG4gKiAgLSBgbG9uZ2AgdmVyYm9zZSBmb3JtYXR0aW5nIFtmYWxzZV1cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xOdW1iZXJ9IHZhbFxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEByZXR1cm4ge1N0cmluZ3xOdW1iZXJ9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odmFsLCBvcHRpb25zKXtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIGlmICgnc3RyaW5nJyA9PSB0eXBlb2YgdmFsKSByZXR1cm4gcGFyc2UodmFsKTtcbiAgcmV0dXJuIG9wdGlvbnMubG9uZ1xuICAgID8gbG9uZyh2YWwpXG4gICAgOiBzaG9ydCh2YWwpO1xufTtcblxuLyoqXG4gKiBQYXJzZSB0aGUgZ2l2ZW4gYHN0cmAgYW5kIHJldHVybiBtaWxsaXNlY29uZHMuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7TnVtYmVyfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gcGFyc2Uoc3RyKSB7XG4gIHZhciBtYXRjaCA9IC9eKCg/OlxcZCspP1xcLj9cXGQrKSAqKG1zfHNlY29uZHM/fHN8bWludXRlcz98bXxob3Vycz98aHxkYXlzP3xkfHllYXJzP3x5KT8kL2kuZXhlYyhzdHIpO1xuICBpZiAoIW1hdGNoKSByZXR1cm47XG4gIHZhciBuID0gcGFyc2VGbG9hdChtYXRjaFsxXSk7XG4gIHZhciB0eXBlID0gKG1hdGNoWzJdIHx8ICdtcycpLnRvTG93ZXJDYXNlKCk7XG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgJ3llYXJzJzpcbiAgICBjYXNlICd5ZWFyJzpcbiAgICBjYXNlICd5JzpcbiAgICAgIHJldHVybiBuICogeTtcbiAgICBjYXNlICdkYXlzJzpcbiAgICBjYXNlICdkYXknOlxuICAgIGNhc2UgJ2QnOlxuICAgICAgcmV0dXJuIG4gKiBkO1xuICAgIGNhc2UgJ2hvdXJzJzpcbiAgICBjYXNlICdob3VyJzpcbiAgICBjYXNlICdoJzpcbiAgICAgIHJldHVybiBuICogaDtcbiAgICBjYXNlICdtaW51dGVzJzpcbiAgICBjYXNlICdtaW51dGUnOlxuICAgIGNhc2UgJ20nOlxuICAgICAgcmV0dXJuIG4gKiBtO1xuICAgIGNhc2UgJ3NlY29uZHMnOlxuICAgIGNhc2UgJ3NlY29uZCc6XG4gICAgY2FzZSAncyc6XG4gICAgICByZXR1cm4gbiAqIHM7XG4gICAgY2FzZSAnbXMnOlxuICAgICAgcmV0dXJuIG47XG4gIH1cbn1cblxuLyoqXG4gKiBTaG9ydCBmb3JtYXQgZm9yIGBtc2AuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1zXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzaG9ydChtcykge1xuICBpZiAobXMgPj0gZCkgcmV0dXJuIE1hdGgucm91bmQobXMgLyBkKSArICdkJztcbiAgaWYgKG1zID49IGgpIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gaCkgKyAnaCc7XG4gIGlmIChtcyA+PSBtKSByZXR1cm4gTWF0aC5yb3VuZChtcyAvIG0pICsgJ20nO1xuICBpZiAobXMgPj0gcykgcmV0dXJuIE1hdGgucm91bmQobXMgLyBzKSArICdzJztcbiAgcmV0dXJuIG1zICsgJ21zJztcbn1cblxuLyoqXG4gKiBMb25nIGZvcm1hdCBmb3IgYG1zYC5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gbXNcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGxvbmcobXMpIHtcbiAgcmV0dXJuIHBsdXJhbChtcywgZCwgJ2RheScpXG4gICAgfHwgcGx1cmFsKG1zLCBoLCAnaG91cicpXG4gICAgfHwgcGx1cmFsKG1zLCBtLCAnbWludXRlJylcbiAgICB8fCBwbHVyYWwobXMsIHMsICdzZWNvbmQnKVxuICAgIHx8IG1zICsgJyBtcyc7XG59XG5cbi8qKlxuICogUGx1cmFsaXphdGlvbiBoZWxwZXIuXG4gKi9cblxuZnVuY3Rpb24gcGx1cmFsKG1zLCBuLCBuYW1lKSB7XG4gIGlmIChtcyA8IG4pIHJldHVybjtcbiAgaWYgKG1zIDwgbiAqIDEuNSkgcmV0dXJuIE1hdGguZmxvb3IobXMgLyBuKSArICcgJyArIG5hbWU7XG4gIHJldHVybiBNYXRoLmNlaWwobXMgLyBuKSArICcgJyArIG5hbWUgKyAncyc7XG59XG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vfi9kZWJ1Zy9+L21zL2luZGV4LmpzXG4gKiogbW9kdWxlIGlkID0gMzhcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyJdLCJzb3VyY2VSb290IjoiIiwiZmlsZSI6ImY4NzE2YjY2ZGM5YzM1MDU0MWE5LmpzIn0=