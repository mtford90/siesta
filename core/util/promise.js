/**
 * A crazy simple promise library.
 * @module util.promise
 */

var _ = require('underscore');

function s(pass) {
    return function (res) {
        try {
            this.success.forEach(function (s) {s(pass ? res : undefined)});
        }
        catch (err) {
            e.call(this, err);
        }
    };
}

function f(err) {
    this.failure.forEach(function (s) {s(err)});
    this.errors.forEach(function (s) {s(err)});
}

function e(err) {
    this.errors.forEach(function (s) {s(err)});
}

function Promise() {
    _.extend(this, {
        success: [],
        failure: [],
        errors: [],
        nextPromise: null
    });
}
_.extend(Promise.prototype, {
    then: function (success, failure) {
        if (success) this.success.push(success);
        if (failure) this.failure.push(failure);
        if (!this.nextPromise) {
            this.nextPromise = new Promise();
            this.success.push(s(false).bind(this.nextPromise));
            this.failure.push(f.bind(this.nextPromise));
            this.errors.push(e.bind(this.nextPromise));
        }
        return this.nextPromise;
    },
    catch: function (error) {
        if (error) this.errors.push(error);
    },
    done: function () {}
});

function Deferred(cb) {
    _.extend(this, {
        cb: cb || function () {},
        promise: new Promise()
    });
}

_.extend(Deferred.prototype, {
    resolve: function (res) {
        s(true).call(this.promise, res);
        this.cb(null, res);
    },
    reject: function (err) {
        f.call(this.promise, err);
        this.cb(err ? err : true);
    },
    finish: function (err, res) {
        if (err) this.reject(err);
        else this.resolve(res);
    }
});

module.exports = function (cb) {
    return new Deferred(cb);
};