/**
 * For those familiar with Apple's Cocoa library, reactive queries roughly map onto NSFetchedResultsController.
 *
 * They present a query set that 'reacts' to changes in the underlying data.
 * @module reactiveQuery
 */

var log = require('./log'),
    Query = require('./query'),
    _ = require('underscore'),
    EventEmitter = require('events').EventEmitter,
    events = require('./events'),
    modelEvents = require('./modelEvents'),
    InternalSiestaError = require('./error').InternalSiestaError,
    util = require('./util');

var Logger = log.loggerWithName('Query');

/**
 *
 * @param {Query} query - The underlying query
 * @constructor
 */
function ReactiveQuery(query) {
    var self = this;
    EventEmitter.call(this);

    _.extend(this, {
        _query: query,
        results: null,
        insertionPolicy: ReactiveQuery.InsertionPolicy.Back
    });

    var initialisedGet = function () {return !!self.results};
    Object.defineProperties(this, {
        initialised: {get: initialisedGet},
        initialized: {get: initialisedGet},
        model: {get: function () { return self._query.model }},
        collection: {get: function () { return self.model.collectionName }}
    });
}

ReactiveQuery.prototype = Object.create(EventEmitter.prototype);

_.extend(ReactiveQuery, {
    InsertionPolicy: {
        Front: 'Front',
        Back: 'Back'
    }
});

_.extend(ReactiveQuery.prototype, {
    init: function (cb) {
        if (Logger.trace) Logger.trace('init');
        var deferred = util.defer(cb);
        cb = deferred.finish.bind(deferred);
        this._query.execute(function (err, results) {
            if (!err) {
                this.results = results;
                if (!this.handler) {
                    var name = this._constructNotificationName();
                    var handler = function (n) {
                        this._handleNotif(n);
                    }.bind(this);
                    this.handler = handler;
                    events.on(name, handler);
                }
                if (Logger.trace) Logger.trace('Listening to ' + name);
                cb();
            }
            else {
                cb(err);
            }
        }.bind(this));
        return deferred.promise;
    },
    orderBy: function (field, cb) {
        var deferred = util.defer(cb);
        cb = deferred.finish.bind(deferred);
        this._query = this._query.orderBy(field);
        if (this.initialised) {
            this._query.execute(function (err, results) {
                if (!err) {
                    this.results = results;
                }
                cb(err);
            }.bind(this));
        }
        else {
            cb();
        }
        return deferred.promise;
    },
    clearOrdering: function (cb) {
        this._query.clearOrdering();
        if (this.initialised) {
            return this.init(cb);
        }
        else {
            var deferred = util.defer(cb);
            deferred.resolve();
            return deferred.promise;
        }
    },
    insert: function (newObj) {
        if (this.insertionPolicy == ReactiveQuery.InsertionPolicy.Back) {
            var idx = this.results.push(newObj);
        }
        else {
            idx = this.results.unshift(newObj);
        }
        return idx;
    },
    _handleNotif: function (n) {
        if (Logger.trace) Logger.trace('_handleNotif', n);
        if (!this.results) throw Error('ReactiveQuery must be initialised before receiving events.');
        if (n.type == modelEvents.ModelEventType.New) {
            var newObj = n.new;
            if (this._query.objectMatchesQuery(newObj)) {
                if (Logger.trace) Logger.trace('New object matches', newObj._dumpString());
                var idx = this.insert(newObj);
                this.emit('change', {
                    index: idx,
                    added: [newObj],
                    type: modelEvents.ModelEventType.Splice,
                    obj: this
                });
            }
            else {
                if (Logger.trace) Logger.trace('New object does not match', newObj._dumpString());
            }
        }
        else if (n.type == modelEvents.ModelEventType.Set) {
            newObj = n.obj;
            var index = this.results.indexOf(newObj),
                alreadyContains = index > -1,
                matches = this._query.objectMatchesQuery(newObj);
            if (matches && !alreadyContains) {
                if (Logger.trace) Logger.trace('Updated object now matches!', newObj._dumpString());
                idx = this.insert(newObj);
                this.emit('change', this.results, {
                    index: idx,
                    added: [newObj],
                    type: modelEvents.ModelEventType.Splice,
                    obj: this
                });
            }
            else if (!matches && alreadyContains) {
                if (Logger.trace) Logger.trace('Updated object no longer matches!', newObj._dumpString());
                var removed = this.results.splice(index, 1);
                this.emit('change', this.results, {
                    index: index,
                    obj: this,
                    new: newObj,
                    type: modelEvents.ModelEventType.Splice,
                    removed: removed
                });
            }
            else if (!matches && !alreadyContains) {
                if (Logger.trace) Logger.trace('Does not contain, but doesnt match so not inserting', newObj._dumpString());
            }
            else if (matches && alreadyContains) {
                if (Logger.trace) Logger.trace('Matches but already contains', newObj._dumpString());
                // Send the notification over. 
                this.emit('change', n);
            }
        }
        else if (n.type == modelEvents.ModelEventType.Remove) {
            newObj = n.obj;
            index = this.results.indexOf(newObj);
            if (index > -1) {
                if (Logger.trace) Logger.trace('Removing object', newObj._dumpString());
                removed = this.results.splice(index, 1);
                this.emit('change', this.results, {
                    index: index,
                    obj: this,
                    type: modelEvents.ModelEventType.Splice,
                    removed: removed
                });
            }
            else {
                if (Logger.trace) Logger.trace('No modelEvents neccessary.', newObj._dumpString());
            }
        }
        else {
            throw new InternalSiestaError('Unknown change type "' + n.type.toString() + '"')
        }
        this.results = this._query._sortResults(this.results);
    },
    _constructNotificationName: function () {
        return this.model.collectionName + ':' + this.model.name;
    },
    terminate: function () {
        events.removeListener(this._constructNotificationName(), this.handler);
        this.results = null;
        this.handler = null;
    },
    listen: function (fn) {
        this.on('change', fn);
        return function () {
            this.removeListener('change', fn);
        }.bind(this);
    },
    listenOnce: function (fn) {
        this.once('change', fn);
    }
});

module.exports = ReactiveQuery;