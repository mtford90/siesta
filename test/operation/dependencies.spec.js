/*global describe,it,beforeEach */
var s = require('../../src/index'),
    chai = require('chai'),
    assert = chai.assert,
    _ = require('../../src/util')._;

var Operation = require('../../src/operation/operation').Operation,
    OperationQueue = require('../../src/operation/queue').OperationQueue;


describe('Dependencies', function() {
    describe('add dependencies', function() {
        it('add a single dependency', function() {
            var op1, op2;
            op1 = new Operation('op1');
            op2 = new Operation('op2');
            op1.addDependency(op2);
            assert.include(op1.dependencies, op2);
        });

        it('add multiple dependencies', function() {
            var op1 = new Operation('op1');
            var op2 = new Operation('op2');
            var op3 = new Operation('op2');
            op1.addDependency(op2, op3);
            assert.include(op1.dependencies, op2);
            assert.include(op1.dependencies, op3);
        });

        it('add a single dependency, specifying success', function() {
            var op1, op2;
            op1 = new Operation('op1');
            op2 = new Operation('op2');
            op1.addDependency(op2, true);
            assert.include(op1.dependencies, op2);
            assert.notInclude(op1.dependencies, true);
            assert.include(op1._mustSucceed, op2);
        });

        it('add multiple dependencies, specifying success', function() {
            var op1 = new Operation('op1');
            var op2 = new Operation('op2');
            var op3 = new Operation('op2');
            op1.addDependency(op2, op3, true);
            assert.include(op1.dependencies, op2);
            assert.include(op1.dependencies, op3);
            assert.include(op1._mustSucceed, op2);
            assert.include(op1._mustSucceed, op3);
        });
    });

    describe('order', function() {
        describe('one dependency', function() {
            var order, completion;

            var op1, op2;

            beforeEach(function() {
                order = [];
                completion = function() {
                    assert.instanceOf(this, Operation);
                    order.push(this.name);
                };
                op1 = new Operation('op1');
                op2 = new Operation('op2');
                op1.addDependency(op2);
            });

            it('op1 shouldnt be able to run', function() {
                assert.notOk(op1.canRun);
            });

            it('on op2 completion, op1 should be able to run', function() {
                op2.completed = true;
                assert.ok(op1.canRun);
            });

            describe('dependency hasnt finished', function() {
                beforeEach(function(done) {
                    op1.work = function(finished) {
                        setTimeout(function() {
                            finished();
                            if (order.length == 2) done();
                        }, 20);
                    };
                    op1.completion = completion;
                    op2.work = function(finished) {
                        setTimeout(function() {
                            finished();
                            if (order.length == 2) done();
                        }, 20);
                    };
                    op2.completion = completion;
                    op1.start();
                    op2.start();
                });
                it('should have finished in the correct order', function() {
                    assert.equal(order[0], 'op2');
                    assert.equal(order[1], 'op1');
                });
            });

            describe('dependency has already finished', function() {
                beforeEach(function(done) {
                    op1.completion = completion;
                    op2.completion = done;
                    op2.start();
                });
                it('op1 should be able to run', function() {
                    assert.ok(op1.canRun);
                });
                it('op1 should be able to run', function() {
                    op1.start();
                    assert.include(order, 'op1');
                })
            });
        });
        describe('multiple dependencies', function() {
            var order, completion;

            var op1, op2, op3, op4;

            beforeEach(function() {
                order = [];
                completion = function() {
                    assert.instanceOf(this, Operation);
                    order.push(this.name);
                };
                op1 = new Operation('op1');
                op2 = new Operation('op2');
                op3 = new Operation('op3');
                op4 = new Operation('op4');
                op2.addDependency(op1);
                op3.addDependency(op2);
                op4.addDependency(op3);
            });

            it('op2-4 shouldnt be able to run', function() {
                assert.notOk(op2.canRun);
                assert.notOk(op3.canRun);
                assert.notOk(op4.canRun);
            });

            it('on op2 completion, op1 should be able to run', function() {
                op2.completed = true;
                assert.ok(op1.canRun);
            });

            describe('dependency hasnt finished', function() {
                beforeEach(function(done) {
                    op1.work = function(finished) {
                        setTimeout(function() {
                            finished();
                            if (order.length == 4) done();
                        }, 20);
                    };
                    op1.completion = completion;
                    op2.work = function(finished) {
                        setTimeout(function() {
                            finished();
                            if (order.length == 4) done();
                        }, 20);
                    };
                    op2.completion = completion;
                    op3.work = function(finished) {
                        setTimeout(function() {
                            finished();
                            if (order.length == 4) done();
                        }, 20);
                    };
                    op3.completion = completion;
                    op4.work = function(finished) {
                        setTimeout(function() {
                            finished();
                            if (order.length == 4) done();
                        }, 20);
                    };
                    op4.completion = completion;
                    op1.start();
                    op2.start();
                    op3.start();
                    op4.start();
                });
                it('should have finished in the correct order', function() {
                    assert.equal(order[0], 'op1');
                    assert.equal(order[1], 'op2');
                    assert.equal(order[2], 'op3');
                    assert.equal(order[3], 'op4');
                });
            });

        });
    });

});