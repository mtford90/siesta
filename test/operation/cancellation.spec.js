/*global describe,it,beforeEach */

var s = require('../../core/index'),
    chai = require('chai'),
    assert = chai.assert,
    _ = require('../../core/util')._;

// '../../core/operation/operation'
var Operation = require('../../core/operation/operation').Operation;


describe('Cancellation', function() {
    var op;



    beforeEach(function() {
        op = new Operation('op');
    });

    describe('single', function() {
        it('cancels', function(done) {
            op.work = function(finished) {
                var token = setInterval(function() {
                    if (op.cancelled) {
                        clearTimeout(token);
                        finished();
                    }
                }, 20);
            };
            op.completion = function() {
                assert.ok(op.cancelled);
                assert.notOk(op.failed);
                assert.ok(op.completed);
                assert.notOk(op.running);
                done();
            };
            op.start();
            setTimeout(function() {
                op.cancel();
                assert.ok(op.running, 'should not finish straight away');
                assert.notOk(op.completed, 'should not complete straight away');
            }, 50);
        });
    });

    describe('composite', function() {
        var op;

        describe('start and then cancel', function() {
            beforeEach(function(done) {
                var work = function(finished) {
                    var token = setInterval(function() {
                        if (op.cancelled) {
                            clearTimeout(token);
                            finished();
                        }
                    }, 20);
                };
                op = new Operation([new Operation('op1', work), new Operation('op2', work), new Operation('op2', work)]);
                op.start();
                op.cancel(done);
            });
            it('composite op is cancelled', function() {
                assert.ok(op.cancelled);
                assert.notOk(op.failed);
                assert.ok(op.completed);
                assert.notOk(op.running);
            });
            it('all subops are cancelled', function() {
                _.each(op.work, function(subOp) {
                    assert.ok(subOp.cancelled);
                    assert.notOk(subOp.failed);
                    assert.ok(subOp.completed);
                    assert.notOk(subOp.running);
                })
            });
        });

        describe('cancel and then start', function() {
            beforeEach(function(done) {
                var work = function(finished) {
                    var token = setInterval(function() {
                        if (op.cancelled) {
                            clearTimeout(token);
                            finished();
                        }
                    }, 20);
                };
                op = new Operation([new Operation('op1', work), new Operation('op2', work), new Operation('op2', work)]);
                op.cancel(done);
                op.start();
            });
            it('composite op is cancelled', function() {
                assert.ok(op.cancelled);
                assert.notOk(op.failed);
                assert.ok(op.completed);
                assert.notOk(op.running);
            });
            it('all subops are cancelled', function() {
                _.each(op.work, function(subOp) {
                    assert.ok(subOp.cancelled);
                    assert.notOk(subOp.failed);
                    assert.ok(subOp.completed);
                    assert.notOk(subOp.running);
                })
            });
        });


    });

    describe('dependencies', function() {
        it('fails if dependency is cancelled', function(done) {
            var dependency = new Operation('dependent');
            op.addDependency(dependency, true);
            dependency.cancel();
            op.completion = function() {
                assert.ok(op.failedDueToDependency);
                assert.include(op.failedDueToCancellationOfDependency, dependency);
                done();
            };
            op.start();
        });
    });

});