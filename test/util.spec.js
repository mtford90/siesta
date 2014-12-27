var s = require('../core/index')
    , assert = require('chai').assert;


var util = require('../core/util');
var q = require('q');

describe('cb', function () {
    before(function () {
        s.ext.storageEnabled = false;
    });
    describe('no error or result', function () {
        function doSomethingWithNoErrorOrResult (callback) {
            setTimeout(callback);
        }

        it('promise returns', function (done) {
            var deferred = q.defer();
            doSomethingWithNoErrorOrResult (util.cb(null, deferred));
            deferred.promise.then(function () {
                done();
            });
        });

        it('callback returns', function (done) {
            doSomethingWithNoErrorOrResult (util.cb(done));
        });

        it('promise & callback returns', function (done) {
            var deferred = q.defer();
            var callbackReturned = false;
            var promiseReturned = false;
            doSomethingWithNoErrorOrResult(util.cb(function () {
                callbackReturned = true;
                if (callbackReturned && promiseReturned) done();
            }, deferred));
            deferred.promise.then(function () {
                promiseReturned = true;
                if (callbackReturned && promiseReturned) done();
            });
        });
    });

    describe('an error, no result', function () {
        function doSomethingWithAnError (callback) {
            setTimeout(function () {
                callback('some error');
            });
        }

        it('promise returns', function (done) {
            var deferred = q.defer();
            doSomethingWithAnError (util.cb(null, deferred));
            deferred.promise.fail(function () {
                done();
            });
        });

        it('callback returns', function (done) {
            doSomethingWithAnError (util.cb(function (err) {
                assert.ok(err);
                done();
            }));
        });

        it('promise & callback returns', function (done) {
            var deferred = q.defer();
            var callbackReturned = false;
            var promiseReturned = false;
            doSomethingWithAnError(util.cb(function (err) {
                assert.ok(err);
                callbackReturned = true;
                if (callbackReturned && promiseReturned) done();
            }, deferred));
            deferred.promise.fail(function () {
                promiseReturned = true;
                if (callbackReturned && promiseReturned) done();
            });
        });
    });

    describe('no error and a single result', function () {
        function doSomethingWithNoErrorAndASingleResult (callback) {
            setTimeout(function () {
                callback(null, 'result');
            });
        }

        it('promise returns', function (done) {
            var deferred = q.defer();
            doSomethingWithNoErrorAndASingleResult(util.cb(null, deferred));
            deferred.promise.then(function () {
                done();
            });
        });

        it('callback returns', function (done) {
            doSomethingWithNoErrorAndASingleResult (util.cb(function (err, res) {
                assert.notOk(err);
                assert.equal(res, 'result');
                done();
            }));
        });

        it('promise & callback returns', function (done) {
            var deferred = q.defer();
            var callbackReturned = false;
            var promiseReturned = false;
            doSomethingWithNoErrorAndASingleResult(util.cb(function () {
                callbackReturned = true;
                if (callbackReturned && promiseReturned) done();
            }, deferred));
            deferred.promise.then(function (res) {
                assert.equal(res, 'result');
                promiseReturned = true;
                if (callbackReturned && promiseReturned) done();
            });
        });

    });

    describe('no error and multiple results', function () {
        function doSomethingWithNoErrorAndMultipleResults (callback) {
            setTimeout(function () {
                callback(null, 'result1', 'result2', 'result3');
            });
        }

        it('promise returns', function (done) {
            var deferred = q.defer();
            doSomethingWithNoErrorAndMultipleResults(util.cb(null, deferred));
            deferred.promise.then(function () {
                done();
            });
        });

        it('callback returns', function (done) {
            doSomethingWithNoErrorAndMultipleResults (util.cb(function (err, res1, res2, res3) {
                assert.notOk(err);
                assert.equal(res1, 'result1');
                assert.equal(res2, 'result2');
                assert.equal(res3, 'result3');
                done();
            }));
        });

        it('promise & callback returns', function (done) {
            var deferred = q.defer();
            var callbackReturned = false;
            var promiseReturned = false;
            doSomethingWithNoErrorAndMultipleResults(util.cb(function (err, res1, res2, res3) {
                try {
                    assert.equal(res1, 'result1');
                    assert.equal(res2, 'result2');
                    assert.equal(res3, 'result3');
                }
                catch (e) {
                    done(e);
                }

                callbackReturned = true;
                if (callbackReturned && promiseReturned) done();
            }, deferred));
            deferred.promise.then(function (res1, res2, res3) {
                try {
                    assert.equal(res1, 'result1');
                    // Promise resolution only accepts one result...
                    assert.notOk(res2);
                    assert.notOk(res3);
                }
                catch (e) {
                    done(e);
                }
                promiseReturned = true;
                if (callbackReturned && promiseReturned) done();
            });
        });
    });





});