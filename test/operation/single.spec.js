/*global describe,it,beforeEach */
var s = require('../../src/index'),
    chai = require('chai'),
    assert = chai.assert,
    _ = require('../../src/util')._;

var Operation = require('../../src/operation/operation').Operation,
    OperationQueue = require('../../src/operation/queue').OperationQueue,
    Logger = require('../../src/operation/log').Logger;
    
describe('Operation', function () {
    var op;

    describe('initialisation', function () {

        describe('constructor', function () {
            it('name given', function () {
                op = new Operation('op');
                assert.equal(op.name, 'op');
            });

            it('name and work given', function () {
                var work = function () {};
                op = new Operation('op', work);
                assert.equal(op.name, 'op');
                assert.equal(op.work, work);
            });

            it('name, work and completion given', function () {
                var work = function () {};
                var completion = function () {};
                op = new Operation('op', work, completion);
                assert.equal(op.name, 'op');
                assert.equal(op.work, work);
                assert.equal(op.completion, completion);
            });

            it('work and completion given', function () {
                var work = function () {};
                var completion = function () {};
                op = new Operation(work, completion);
                assert.notOk(op.name);
                assert.equal(op.work, work);
                assert.equal(op.completion, completion);
            });
        });

        describe('initial state', function () {
            beforeEach(function () {
                op = new Operation();
            });
            it('should not be completed', function () {
                assert.notOk(op.completed);
            });

            it('should be no result', function () {
                assert.notOk(op.result);
            });

            it('should not be running', function () {
                assert.notOk(op.running);
            });

            it('should not have an error', function () {
                assert.notOk(op.error);
            });

            it('should not have failed', function () {
                assert.notOk(op.failed);
            });

            it('no name', function () {
                assert.notOk(op.name);
            });
        });

    });

    describe('running state', function () {

        beforeEach(function () {
            op = new Operation('op');
            op.work = function (callback) {
                setTimeout(function () {
                    callback();
                }, 50);
            };
            op.start();
        });

        it('should not be completed', function () {
            assert.notOk(op.completed);
        });

        it('should be no result', function () {
            assert.notOk(op.result);
        });

        it('should be running', function () {
            assert.ok(op.running);
        });

        it('should not have an error', function () {
            assert.notOk(op.error);
        });

        it('should not have failed', function () {
            assert.notOk(op.failed);
        });

        it('should not be cancelled', function () {
            assert.notOk(op.cancelled);
        });

        it('should not have failed due to cancellation of dependency', function () {
            assert.notOk(op.failedDueToCancellationOfDependency);
        })

    });

    describe('completion state', function () {

        describe('no error', function () {
            beforeEach(function (done) {
                op = new Operation('op');

                op.work = function (callback) {
                    callback(null, 'xyz');
                };
                op.completion = function () {
                    done();
                };
                op.start();
            });

            it('should be completed', function () {
                assert.ok(op.completed);
            });

            it('should have a result', function () {
                assert.equal(op.result, 'xyz');
            });

            it('should not be running', function () {
                assert.notOk(op.running);
            });

            it('should not have an error', function () {
                assert.notOk(op.error);
            });

            it('should not have failed', function () {
                assert.notOk(op.failed);
            });

            it('should not be cancelled', function () {
                assert.notOk(op.cancelled);
            })
        });

        describe('error', function () {
            beforeEach(function (done) {
                op = new Operation('op');

                op.work = function (callback) {
                    callback('error');
                };
                op.completion = function () {
                    done();
                };
                op.start();
            });

            it('should be completed', function () {
                assert.ok(op.completed);
            });

            it('should not have a result', function () {
                assert.notOk(op.result);
            });

            it('should not be running', function () {
                assert.notOk(op.running);
            });

            it('should have an error', function () {
                assert.equal(op.error, 'error');
            });

            it('should have failed', function () {
                assert.ok(op.failed);
            });

            it('should not be cancelled', function () {
                assert.notOk(op.cancelled);
            })
        });

    });

});
