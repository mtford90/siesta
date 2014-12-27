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
    init: function (cb) {
        var deferred = util.defer(cb);
        ReactiveQuery.prototype.init.call(this, function (err) {
            if (!err) {
                if (!this.model.hasAttributeNamed(this.indexField)) {
                    err = 'Model "' + this.model.type + '" does not have an attribute named "' + this.indexField + '"';
                }
            }
            if (err) deferred.reject(err);
            else deferred.resolve();
        }.bind(this));
        return deferred.promise;
    }
}); 

module.exports = PositionalReactiveQuery;