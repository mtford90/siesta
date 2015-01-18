//var assert = require('chai').assert,
//    defer = require('../core/util');
//
//describe('custom promises', function () {
//    describe('resolve', function () {
//        it('simple', function (done) {
//            var deferred = defer();
//            deferred.promise.then(done);
//            deferred.resolve();
//        });
//        it('with obj', function (done) {
//            var deferred = defer();
//            var o = {};
//            deferred.promise.then(function (res) {
//                assert.equal(res, o);
//                done();
//            });
//            deferred.resolve(o);
//        });
//        it('chained', function (done) {
//            var deferred = defer(),
//                o = {},
//                order = [];
//            deferred.promise
//                .then(function (res) {
//                    order.push(1);
//                    assert.equal(res, o);
//                })
//                .then(function (res) {
//                    assert.notOk(res, 'Nothing should be passed along');
//                    order.push(2);
//                })
//                .then(function (res) {
//                    assert.notOk(res);
//                    order.push(3);
//                    assert.equal(order[0], 1);
//                    assert.equal(order[1], 2);
//                    assert.equal(order[2], 3);
//                    done();
//                });
//            deferred.resolve(o);
//        });
//        it('callback', function (done) {
//            var deferred = defer(done);
//            deferred.resolve();
//        });
//        it('callback with res', function (done) {
//            var o = {};
//            var deferred = defer(function (err, res) {
//                assert.notOk(err);
//                assert.equal(o, res);
//                done();
//            });
//            deferred.resolve(o);
//        });
//        it('already resolved', function (done) {
//            var deferred = defer();
//            var o = {};
//            deferred.resolve(o);
//            deferred.promise.then(function (res) {
//                assert.equal(res, o);
//                done();
//            });
//        });
//        it('already resolved, chained', function (done) {
//            var deferred = defer();
//            var o = {};
//            deferred.resolve(o);
//            deferred.promise
//                .then(function (res) {
//                    assert.equal(res, o);
//                })
//                .then(function () {
//                    done();
//                })
//        });
//    });
//
//    describe('reject', function () {
//        describe('catch', function () {
//            it('simple', function (done) {
//                var deferred = defer();
//                deferred.promise
//                    .then(function () {
//                        done('Should not have succeeded');
//                    })
//                    .catch(done);
//                deferred.reject();
//            });
//            it('simple with err', function (done) {
//                var deferred = defer();
//                var err = 'err';
//                deferred.promise
//                    .then(function () {
//                        done('Should not have succeeded');
//                    })
//                    .catch(function (_err) {
//                        assert.equal(_err, err);
//                        done();
//                    });
//                deferred.reject(err);
//            });
//            it('simple with err, chained', function (done) {
//                var deferred = defer();
//                var success = function () {
//                    done('Should not have succeeded');
//                };
//                var err = 'err';
//                deferred.promise
//                    .then(success)
//                    .then(success)
//                    .then(success)
//                    .catch(function (_err) {
//                        assert.equal(_err, err, 'error should be passed along');
//                        done();
//                    });
//                deferred.reject(err);
//            });
//            it('callback', function (done) {
//                var deferred = defer(function (err) {
//                    assert.ok(err);
//                    done();
//                });
//                deferred.reject();
//            });
//            it('callback with res', function (done) {
//                var o = {};
//                var deferred = defer(function (err, res) {
//                    assert.equal(err, o);
//                    assert.notOk(res);
//                    done();
//                });
//                deferred.reject(o);
//            });
//            it('already rejected', function (done) {
//                var deferred = defer();
//                var o = {};
//                deferred.reject(o);
//                deferred.promise
//                    .catch(function (err) {
//                        assert.equal(err, o);
//                        done();
//                    })
//            });
//            it('already rejected, chained', function (done) {
//                var deferred = defer();
//                var o = {};
//                deferred.reject(o);
//                var success = function () {
//                    done('Should not have succeeded');
//                };
//                deferred.promise
//                    .then(success)
//                    .then(success)
//                    .then(success)
//                    .catch(function (err) {
//                        assert.equal(err, o);
//                        done();
//                    })
//            });
//        });
//        describe('then', function () {
//            it('simple', function (done) {
//                var deferred = defer();
//                deferred.promise
//                    .then(function () {
//                        done('Should not have succeeded');
//                    }, done);
//                deferred.reject();
//            });
//            it('simple with err', function (done) {
//                var deferred = defer();
//                var err = 'err';
//                deferred.promise
//                    .then(function () {
//                        done('Should not have succeeded');
//                    }, function (_err) {
//                        assert.equal(_err, err);
//                        done();
//                    });
//                deferred.reject(err);
//            });
//            it('already rejected', function (done) {
//                var deferred = defer();
//                var err = 'err';
//                deferred.reject(err);
//                deferred.promise
//                    .then(function () {
//                        done('Should not have succeeded');
//                    }, function (_err) {
//                        assert.equal(_err, err);
//                        done();
//                    });
//            });
//            it('simple with err, chained', function (done) {
//                var deferred = defer();
//                var success = function () {
//                    done('Should not have succeeded');
//                };
//                var err = 'err',
//                    order = [];
//                deferred.promise
//                    .then(success, function (_err) {
//                        assert.equal(_err, err, 'error should be passed along');
//                        order.push(1);
//                    })
//                    .then(success, function (_err) {
//                        assert.equal(_err, err, 'error should be passed along');
//                        order.push(2);
//                    })
//                    .then(success, function (_err) {
//                        assert.equal(_err, err, 'error should be passed along');
//                        order.push(3);
//                        assert.equal(order[0], 1);
//                        assert.equal(order[1], 2);
//                        assert.equal(order[2], 3);
//                        done();
//                    });
//                deferred.reject(err);
//            });
//            it('already rejected, chained', function (done) {
//                var deferred = defer();
//                var success = function () {
//                    done('Should not have succeeded');
//                };
//                var err = 'err',
//                    order = [];
//                deferred.reject(err);
//                deferred.promise
//                    .then(success, function (_err) {
//                        assert.equal(_err, err, 'error should be passed along');
//                        order.push(1);
//                    })
//                    .then(success, function (_err) {
//                        assert.equal(_err, err, 'error should be passed along');
//                        order.push(2);
//                    })
//                    .then(success, function (_err) {
//                        assert.equal(_err, err, 'error should be passed along');
//                        order.push(3);
//                        assert.equal(order[0], 1);
//                        assert.equal(order[1], 2);
//                        assert.equal(order[2], 3);
//                        done();
//                    });
//            });
//        });
//    });
//
//    describe('error', function () {
//        it('simple', function (done) {
//            var deferred = defer(),
//                error = Error('wtf!');
//            deferred.promise
//                .then(function () {
//                    throw error;
//                })
//                .catch(function (err) {
//                    assert.equal(err, error, 'Should catch the error and pass to catch');
//                    done();
//                });
//            deferred.resolve();
//        });
//        it('chained', function (done) {
//            var deferred = defer(),
//                error = Error('wtf!');
//            deferred.promise
//                .then(function () {})
//                .then(function () {})
//                .then(function () {
//                    throw error;
//                })
//                .catch(function (err) {
//                    assert.equal(err, error, 'Should catch the error and pass to catch');
//                    done();
//                });
//            deferred.resolve();
//        });
//        it('chained, error in middle', function (done) {
//            var deferred = defer(),
//                error = Error('wtf!');
//            deferred.promise
//                .then(function () {})
//                .then(function () {
//                    throw error;
//                })
//                .then(function () {})
//                .catch(function (err) {
//                    assert.equal(err, error, 'Should catch the error and pass to catch');
//                    done();
//                });
//            deferred.resolve();
//        });
//        it('already errored', function (done) {
//            var deferred = defer(),
//                error = Error('wtf!');
//            var promise = deferred.promise
//                .then(function () {})
//                .then(function () {
//                    throw error;
//                });
//            deferred.resolve();
//            promise.then(function () {})
//                .catch(function (err) {
//                    assert.equal(err, error, 'Should catch the error and pass to catch');
//                    done();
//                });
//        });
//    });
//
//});