var s = require('../core/index'),
    assert = require('chai').assert;

var defer = require('../core/util/promise');

describe('custom promises', function () {
    it('simple resolve', function (done) {
        var deferred = defer();
        deferred.promise.then(done);
        deferred.resolve();
    });
    it('resolve with obj', function (done) {
        var deferred = defer();
        var o = {};
        deferred.promise.then(function (res) {
            assert.equal(res, o);
            done();
        });
        deferred.resolve(o);
    });
    it('chained promises', function (done) {
        var deferred = defer(),
            o = {},
            order = [];
        deferred.promise
            .then(function (res) {
                order.push(1);
                assert.equal(res, o);
            })
            .then(function (res) {
                assert.notOk(res, 'Nothing should be passed along');
                order.push(2);
            })
            .then(function (res) {
                assert.notOk(res);
                order.push(3);
                assert.equal(order[0], 1);
                assert.equal(order[1], 2);
                assert.equal(order[2], 3);
                done();
            });
        deferred.resolve(o);
    });
    it('simple reject', function (done) {
        var deferred = defer();
        deferred.promise
            .then(function () {
                done('Should not have succeeded');
            })
            .catch(done);
        deferred.reject();
    });
    it('simple reject with err', function (done) {
        var deferred = defer();
        var err = 'err';
        deferred.promise
            .then(function () {
                done('Should not have succeeded');
            })
            .catch(function (_err) {
                assert.equal(_err, err);
                done();
            });
        deferred.reject(err);
    });
    it('simple reject with err, chained', function (done) {
        var deferred = defer();
        var success = function () {
            done('Should not have succeeded');
        };
        var err = 'err';
        deferred.promise
            .then(success)
            .then(success)
            .then(success)
            .catch(function (_err) {
                assert.equal(_err, err);
                done();
            });
        deferred.reject();
    });

    describe('Q.js compat', function () {
        it('awesome', function () {

        });
    });
});