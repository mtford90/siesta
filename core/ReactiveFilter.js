/**
 * For those familiar with Apple's Cocoa library, reactive queries roughly map onto NSFetchedResultsController.
 *
 * They present a query set that 'reacts' to changes in the underlying data.
 * @module reactiveQuery
 */

var log = require('./log')('query:reactive'),
  Filter = require('./Filter'),
  EventEmitter = require('events').EventEmitter,
  Chain = require('./Chain'),
  modelEvents = require('./modelEvents'),
  InternalSiestaError = require('./error').InternalSiestaError,
  constructQuerySet = require('./FilterSet'),
  util = require('./util');

/**
 *
 * @param {Filter} query - The underlying query
 * @constructor
 */
function ReactiveFilter(query) {
  var self = this;
  EventEmitter.call(this);
  Chain.call(this);
  util.extend(this, {
    insertionPolicy: ReactiveFilter.InsertionPolicy.Back,
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
    if (this._query) {
      var name = this._constructNotificationName();
      var handler = function(n) {
        this._handleNotif(n);
      }.bind(this);
      this.handler = handler;
      this.model.context.events.on(name, handler);
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
    if (this.insertionPolicy == ReactiveFilter.InsertionPolicy.Back) var idx = results.push(newObj);
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
