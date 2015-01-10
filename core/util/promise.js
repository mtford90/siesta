/**
 * A crazy simple promise library.
 * @module util.promise
 */

function s(pass) {
    return function (res) {
        this.res = res;
        try {
            this.success.forEach(function (s) {s(pass ? res : undefined)});
        }
        catch (err) {
            e.call(this, err);
        }
    }
}

function f(err) {
    this._fail = err;
    this.error = err;
    this.failure.forEach(function (s) {s(err)});
    this.errors.forEach(function (s) {s(err)});
}

function e(err) {
    this.error = err;
    this.errors.forEach(function (s) {s(err)});
}

function Promise() {
    _.extend(this, {
        success: [],
        failure: [],
        errors: [],
        /**
         * @type Promise
         */
        _nextPromise: null
    });
    Object.defineProperty(this, 'nextPromise', {
        get: function () {
            if (!this._nextPromise) {
                this._nextPromise = new Promise();
                this.success.push(s(false).bind(this._nextPromise));
                this.failure.push(f.bind(this._nextPromise));
                this.errors.push(e.bind(this._nextPromise));
                this._nextPromise._fail = this._fail;
                this._nextPromise.error = this.error;
                this._nextPromise.res = this.res;
            }
            return this._nextPromise;
        }
    });
}
var fail = function (error) {
    if (error) {
        if (this.error) error(this.error);
        else this.errors.push(error);
    }
    return this.nextPromise;
};
_.extend(Promise.prototype, {
    then: function (success, failure) {
        if (success) {
            if (this.res) success(this.res);
            else this.success.push(success);
        }
        if (failure) {
            if (this._fail) failure(this._fail);
            else this.failure.push(failure);
        }
        return this.nextPromise;
    },
    catch: fail,
    fail: fail,
    done: function (success, failure) {
        this.then(success).catch(failure);
    }
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
        if (this == window) throw 'wtf';
        if (err) this.reject(err);
        else this.resolve(res);
    }
});

module.exports = function (cb) {
    return new Deferred(cb);
};