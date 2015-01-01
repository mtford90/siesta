/**
 * A custom promise library. More lightweight than q.js but works with it.
 * @module util.promise
 */

var _ = require('underscore');


function Promise(deferred) {
    _.extend(this, {
        then: deferred.then.bind(deferred),
        catch: deferred.then.bind(deferred),
        success_p: [],
        failure: [],
        error: []
    });
    this.deferred = deferred;
}

_.extend(Promise.prototype, {
    done: function () {}
});

function Deferred(cb) {
    this.cb = cb || function () {};
    this.promise = new Promise(this);
}

_.extend(Deferred.prototype, {
    resolve: function (res) {
        deferred.promise.success_fn.forEach(function (fn) {
            fn(res);
        });
        deferred.promise.success_p.forEach(function (p) {

        });
        cb(res);
    },
    reject: function (err) {
        cb(err);
    },
    finish: function (err, res) {
        if (err) deferred.reject(err);
        else deferred.resolve(res);
    }
});

module.exports = function (cb) {
    return new Deferred(cb)
};