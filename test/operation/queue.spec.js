/*global describe,it,beforeEach */
var s = require('../../core/index'),
    chai = require('chai'),
    assert = chai.assert,
    _ = require('../../core/util')._;

var Operation = require('../../core/operation/operation').Operation,
    OperationQueue = require('../../core/operation/queue').OperationQueue;

describe('OperationQueue', function () {

    var q;

    beforeEach(function () {
        q = new OperationQueue('myQueue', 2);
    });

    describe('initial state', function () {
        it('2 max concurrent', function () {
            assert.equal(q.maxConcurrentOperations, 2);
        });
        it('no queued operations', function () {
            assert.equal(q._queuedOperations.length, 0);
        });
        it('no running operations', function () {
            assert.equal(q._runningOperations.length, 0);
            assert.equal(q.numRunningOperations, 0)
        });
        it('should not be running', function () {
            assert.notOk(q.running);
        });
    });

    it('adding an operation when not running should put to the queue', function () {
        var op = new Operation();
        q.addOperation(op);
        assert.include(q._queuedOperations, op);
        assert.notInclude(q._runningOperations, op);
    });

    it('adding an operation when running should put to running', function () {
        var op = new Operation(function (done) {
            setTimeout(function () {
                done();
            }, 10)
        });
        q.start();
        q.addOperation(op);
        assert.notInclude(q._queuedOperations, op);
        assert.include(q._runningOperations, op);
    });

    it('adding an operation whilst paused and then running should put to running', function () {
        var op = new Operation(function (done) {
            setTimeout(function () {
                done();
            }, 10)
        });
        q.addOperation(op);
        q.start();
        assert.notInclude(q._queuedOperations, op);
        assert.include(q._runningOperations, op);
    });

    it('adding multiple operations whilst paused and then running should put only max concurrent to running', function () {
        var op = new Operation('op1', function (done) {setTimeout(done, 100) });
        var op1 = new Operation('op2', function (done) {setTimeout(done, 100) });
        var op2 = new Operation('op3', function (done) {setTimeout(done, 100) });
        q.addOperation(op);
        q.addOperation(op1);
        q.addOperation(op2);
        assert.equal(q._queuedOperations.length, 3);
        q.start();
        assert.equal(q._runningOperations.length, 2);
        assert.equal(q._queuedOperations.length, 1);
    });

    it('adding multiple operations whilst running should put only max concurrent to running', function () {
        var op = new Operation('op1', function (done) {setTimeout(done, 100) });
        var op1 = new Operation('op2', function (done) {setTimeout(done, 100) });
        var op2 = new Operation('op3', function (done) {setTimeout(done, 100) });
        q.start();
        q.addOperation(op);
        q.addOperation(op1);
        q.addOperation(op2);
        assert.equal(q._runningOperations.length, 2);
        assert.equal(q._queuedOperations.length, 1);
    });

    it('num running operations property is valid', function () {
        assert.equal(q.numRunningOperations, 0);
        q._runningOperations.push({});
        q._runningOperations.push({});
        assert.equal(q.numRunningOperations, 2);
    });

    describe('events', function () {

        it('observes on queue start', function (done) {
            q.onStart(function () {
                assert.equal(this, q);
                assert.ok(this._running);
                done();
            });
            q.start();
        });

        it('observes on queue stop', function (done) {
            var observer = function () {
                assert.equal(this, q);
                assert.notOk(this._running);
                done();
            };
            q.start();
            q.onStop(observer);
            q.stop();
        });

    });

    describe('stop', function () {
        var ops;

        beforeEach(function () {
            var work = function (finished) {
                var token = setInterval(function () {
                    if (this.cancelled) {
                        clearTimeout(token);
                        finished();
                    }
                }, 20);
            };
            ops = [new Operation('op1', work), new Operation('op2', work), new Operation('op3', work)];
            q.addOperation(ops);
            q.start();
        });

        it('cancel running operations', function () {
            q.stop(true);
            console.log(ops);
            assert.ok(ops[0].cancelled, 'Should cancel first running operation');
            assert.ok(ops[1].cancelled, 'Should cancel the second running operation');
            assert.notOk(ops[2].cancelled, 'Should leave the queued operation alone');
        });

        it('dont cancel all running operations', function () {
            q.stop();
            assert.notOk(ops[0].cancelled);
            assert.notOk(ops[1].cancelled);
            assert.notOk(ops[2].cancelled);
        });
    });

});
