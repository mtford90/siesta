/**
 * Solves the common problem of maintaining the order of a set of a models and querying on that order.
 *
 * The same as ReactiveQuery but enables manual reordering of models and maintains an index field.
 */

var ReactiveQuery = require('./reactiveQuery'),
    log = require('./operation/log'),
    util = require('./util'),
    _ = util._;

function PositionalReactiveQuery(query) {
    ReactiveQuery.call(this, query);
    this.indexField = 'index';
}

PositionalReactiveQuery.prototype = Object.create(ReactiveQuery.prototype);

_.extend(PositionalReactiveQuery.prototype, {
    _configureIndexes: function () {
        for (var i = 0; i < this.results.length; i++) {
            var modelInstance = this.results[i];
            modelInstance[this.indexField] = i;
        }
    },
    init: function (cb) {
        var deferred = util.defer(cb);
        ReactiveQuery.prototype.init.call(this, function (err) {
            if (!err) {
                if (!this.model.hasAttributeNamed(this.indexField)) {
                    err = 'Model "' + this.model.type + '" does not have an attribute named "' + this.indexField + '"';
                }
                else {
                    this._configureIndexes();
                    this._query.clearOrdering();
                }
            }
            deferred.finish(err);
        }.bind(this));
        return deferred.promise;
    },
    orderBy: function (field, cb) {
        var deferred = util.defer(cb);
        ReactiveQuery.prototype.orderBy.call(this, field, function (err) {
            if (!err) {
                // We do not want to reorder on every update. Ordering is handled by the user instead with
                // positional reactive queries.
                if (this.initialised) {
                    this._query.clearOrdering();
                }
            }
            deferred.finish(err);
        }.bind(this));
        return deferred.promise;
    },
    clearOrdering: function (cb) {
        this._query.clearOrdering();
        var deferred = util.defer(cb);
        deferred.resolve();
        return deferred.promise;
    },
    _handleNotif: function (n) {
        // We don't want to keep executing the query each time index changes. We're changing
        // the index ourselves.
        if (n.field != this.indexField) {
            ReactiveQuery.prototype._handleNotif.call(this, n);
        }
    }
});

module.exports = PositionalReactiveQuery;