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
    , util = require('./util');

var Logger = log.loggerWithName('ReactiveQuery');
Logger.setLevel(log.Level.trace);

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
    Object.defineProperty(this, 'initialised', { get: initialisedGet });
    Object.defineProperty(this, 'initialized', { get: initialisedGet }); // For my friends across the pond
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
                notificationCentre.on(name, this._handleNotif.bind(this));
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
    _handleNotif: function (n) {
        if (Logger.trace) Logger.trace('_handleNotif', n);
        if (n.type == changes.ChangeType.New) {
            var newObj = n.new;
            if (this._query.objectMatchesQuery(newObj)) {
                if (Logger.trace) Logger.trace('New object matches', newObj);
                this.results.push(newObj);
            }
            else {
                if (Logger.trace) Logger.trace('New object does not matche', newObj);
            }
        }
        else if (n.type == changes.ChangeType.Set) {
        }
    },
    _constructNotificationName: function () {
        return this.collection + ':' + this.mapping.type;
    },
    terminate: function () {
        notificationCentre.removeListener(this._constructNotificationName(), this._handleNotif);
        this.results = null;
    }
});

module.exports = ReactiveQuery;