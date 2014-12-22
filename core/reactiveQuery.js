/**
 * For those familiar with Apple's Cocoa library, reactive queries roughly map onto NSFetchedResultsController.
 *
 * They present a query set that 'reacts' to changes in the underlying data.
 * @module reactiveQuery
 */

var log = require('./operation/log')
    , Query = require('./query').Query
    , _ = require('underscore')
    , EventEmitter = require('events').EventEmitter
    , notificationCentre = require('./notificationCentre').notificationCentre
    , changes = require('./changes')
    , InternalSiestaError = require('./error').InternalSiestaError
    , util = require('./util');

var Logger = log.loggerWithName('ReactiveQuery');
Logger.setLevel(log.Level.warn);

/**
 *
 * @param {Query} query - The underlying query
 * @constructor
 */
function ReactiveQuery(query) {
    var self = this;
    EventEmitter.call(this);
    this._query = query;
    this.results = null;
    var initialisedGet = function () {return !!self.results};
    Object.defineProperty(this, 'initialised', {get: initialisedGet});
    Object.defineProperty(this, 'initialized', {get: initialisedGet}); // For my friends across the pond
    Object.defineProperty(this, 'mapping', {get: function () { return self._query.mapping }});
    Object.defineProperty(this, 'collection', {get: function () { return self.mapping.collection }});
}

ReactiveQuery.prototype = Object.create(EventEmitter.prototype);

_.extend(ReactiveQuery.prototype, {
    init: function (cb) {
        if (Logger.trace) Logger.trace('init');
        var deferred = window.q ? window.q.defer() : null;
        this._query.execute(function (err, results) {
            if (!err) {
                this.results = results;
                var name = this._constructNotificationName();
                var handler = this._handleNotif.bind(this);
                this.handler = handler;
                notificationCentre.on(name, handler);
                if (Logger.trace) Logger.trace('Listening to ' + name);
                if (cb) cb();
                if (deferred) deferred.resolve();
            }
            else {
                if (cb) cb(err);
                if (deferred) deferred.reject(err);
            }
        }.bind(this));
        return deferred ? deferred.promise : undefined;
    },
    orderBy: function (field) {
        this._query = this._query.orderBy(field);
        return this;
    },
    _handleNotif: function (n) {
        if (Logger.trace) Logger.trace('_handleNotif', n);
        if (!this.results) throw Error('ReactiveQuery must be initialised before receiving notifications.');
        if (n.type == changes.ChangeType.New) {
            var newObj = n.new;
            if (this._query.objectMatchesQuery(newObj)) {
                if (Logger.trace) Logger.trace('New object matches', newObj);
                var idx = this.results.push(newObj);
                this.emit('change', {
                    index: idx,
                    added: [newObj],
                    addedId: [newObj._id],
                    type: changes.ChangeType.Splice
                });
            }
            else {
                if (Logger.trace) Logger.trace('New object does not match', newObj);
            }
        }
        else if (n.type == changes.ChangeType.Set) {
            newObj = n.obj;
            var index = this.results.indexOf(newObj),
                alreadyContains = index > -1,
                matches = this._query.objectMatchesQuery(newObj);
            if (matches && !alreadyContains) {
                if (Logger.trace) Logger.trace('Updated object now matches!', newObj);
                idx = this.results.push(newObj);
                this.emit('change', this.results, {
                    index: idx,
                    added: [newObj],
                    addedId: [newObj._id],
                    type: changes.ChangeType.Splice
                });
            }
            else if (!matches && alreadyContains) {
                if (Logger.trace) Logger.trace('Updated object no longer matches!', newObj);
                var removed = this.results.splice(index, 1);
                this.emit('change', this.results, {
                    index: index,
                    obj: newObj,
                    type: changes.ChangeType.Splice,
                    removed: removed,
                    removedId: [newObj._id]
                });
            }
            else if (!matches && !alreadyContains) {
                if (Logger.trace) Logger.trace('Does not contain, but doesnt match so not inserting', newObj);
            }
            else if (matches && alreadyContains) {
                if (Logger.trace) Logger.trace('Matches but already contains', newObj);
            }
        }
        else if (n.type == changes.ChangeType.Remove) {
            newObj = n.obj;
            index = this.results.indexOf(newObj);
            if (index > -1) {
                if (Logger.trace) Logger.trace('Removing object', newObj);
                removed = this.results.splice(index, 1);
                this.emit('change', this.results, {
                    index: index,
                    obj: newObj,
                    type: changes.ChangeType.Splice,
                    removed: removed,
                    removedId: [newObj._id]
                });
            }
            else {
                if (Logger.trace) Logger.trace('No changes neccessary.', newObj);
            }
        }
        else {
            throw new InternalSiestaError('Unknown change type "' + n.type.toString() + '"')
        }
        this.results = this._query._sortResults(this.results);
    },
    _constructNotificationName: function () {
        return this.collection + ':' + this.mapping.type;
    },
    terminate: function () {
        if (Logger.trace) Logger.trace('terminate');
        notificationCentre.removeListener(this._constructNotificationName(), this.handler);
        this.results = null;
    }
});

module.exports = ReactiveQuery;