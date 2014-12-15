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
    , q = require('q')
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
    Object.defineProperty(this, 'initialised', { get: initialisedGet });
    Object.defineProperty(this, 'initialized', { get: initialisedGet }); // For my friends across the pond
}

ReactiveQuery.prototype = Object.create(EventEmitter.prototype);

_.extend(ReactiveQuery.prototype, {
    init: function (cb) {
        var deferred = q.defer();
        this._query.execute().then(function (results) {
            this.results = results;
            if (cb) cb();
            deferred.resolve();
        }.bind(this), function (err) {
            if (cb) cb(err);
            deferred.reject(err);
        });
        return deferred.promise;
    }
});

module.exports = ReactiveQuery;