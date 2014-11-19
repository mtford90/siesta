/*global describe,it,beforeEach */
var s = require('../../src/index'),
    chai = require('chai'),
    assert = chai.assert,
    _ = require('../../src/util')._;

var Operation = require('../../src/operation/operation').Operation;


describe('Composite Operations', function () {
    var op;

    beforeEach(function () {
        op = new Operation('op');
    });

    describe('initialisation', function () {

        beforeEach(function () {
            op = new Operation('composite op', [new Operation(), new Operation()]);
        });

        describe('constructor', function () {

            it('name and operations given', function () {
                var work = [new Operation(), new Operation()];
                op = new Operation('op', work);
                assert.equal(op.name, 'op');
                assert.equal(op.work, work);
            });

            it('name, operations and completion given', function () {
                var work = [new Operation(), new Operation()];
                var completion = function () {};
                op = new Operation('op', work, completion);
                assert.equal(op.name, 'op');
                assert.equal(op.work, work);
                assert.equal(op.completion, completion);
            });

            it('operations and completion given', function () {
                var work = [new Operation(), new Operation()];
                var completion = function () {};
                op = new Operation(work, completion);
                assert.equal(op.work, work);
                assert.equal(op.completion, completion);
            });

            it('name and operation given', function () {
                var work = new Operation();
                op = new Operation('op', work);
                assert.equal(op.name, 'op');
                assert.equal(op.work, work);
            });

            it('name, operation and completion given', function () {
                var work = new Operation();
                var completion = function () {};
                op = new Operation('op', work, completion);
                assert.equal(op.name, 'op');
                assert.equal(op.work, work);
                assert.equal(op.completion, completion);
            });

            it('operation and completion given', function () {
                var work = new Operation();
                var completion = function () {};
                op = new Operation(work, completion);
                assert.equal(op.work, work);
                assert.equal(op.completion, completion);
            });

        });

        describe('initial state', function () {
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

            it('should be composite', function () {
                assert.ok(op.composite);
            });

            it('should have 2 operations remaining', function () {
                assert.equal(op.numOperationsRemaining, 2);
            })

        });


    });

});

describe('running state', function () {

    var op;

    beforeEach(function () {
        op = new Operation('op');
        op.work = [
            new Operation('op1', function (c) {setTimeout(function () {c();}, 50)}),
            new Operation('op2', function (c) {setTimeout(function () {c();}, 50)}),
            new Operation('op3', function (c) {setTimeout(function () {c();}, 50)})
        ];
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
    })
});


describe('finished state', function () {
    var op;
    beforeEach(function () {
        op = new Operation('op');

    });

    describe('no errors', function () {
        beforeEach(function (done) {
            op.work = [
                new Operation('op1', function (c) {setTimeout(function () {c(null, 'res1');}, 50)}),
                new Operation('op2', function (c) {setTimeout(function () {c(null, 'res2');}, 50)}),
                new Operation('op3', function (c) {setTimeout(function () {c(null, 'res3');}, 50)})
            ];
            op.completion = done;
            op.start();
        });

        it('should be completed', function () {
            assert.ok(op.completed);
        });

        it('should be a result', function () {
            assert.ok(op.result);
            assert.equal(op.result[0], 'res1');
            assert.equal(op.result[1], 'res2');
            assert.equal(op.result[2], 'res3');
        });

        it('should not be running', function () {
            assert.notOk(op.running);
        });

        it('should not have an error', function () {
            assert.notOk(op.error);
        });

        it('should not have failed', function () {
            assert.notOk(op.failed);
        })
    });

    describe('all errors', function () {
        beforeEach(function (done) {
            op.work = [
                new Operation('op1', function (c) {setTimeout(function () {c('error1');}, 50)}),
                new Operation('op2', function (c) {setTimeout(function () {c('error2');}, 50)}),
                new Operation('op3', function (c) {setTimeout(function () {c('error3');}, 50)})
            ];
            op.completion = done;
            op.start();
        });

        it('should be completed', function () {
            assert.ok(op.completed);
        });

        it('should not be a result', function () {
            assert.notOk(op.result);
        });

        it('should not be running', function () {
            assert.notOk(op.running);
        });

        it('should have an error', function () {
            assert.ok(op.error);
            assert.equal(op.error[0], 'error1');
            assert.equal(op.error[1], 'error2');
            assert.equal(op.error[2], 'error3');
        });

        it('should have failed', function () {
            assert.ok(op.failed);
        });

    });

    describe('some errors', function () {
        beforeEach(function (done) {
            op.work = [
                new Operation('op1', function (c) {setTimeout(function () {c('error1');}, 50)}),
                new Operation('op2', function (c) {setTimeout(function () {c(null, 'res1');}, 50)}),
                new Operation('op3', function (c) {setTimeout(function () {c('error2');}, 50)})
            ];
            op.completion = done;
            op.start();
        });

        it('should be completed', function () {
            assert.ok(op.completed);
        });

        it('should be a result', function () {
            assert.ok(op.result);
            assert.notOk(op.result[0]);
            assert.equal(op.result[1], 'res1');
            assert.notOk(op.result[2]);
        });

        it('should not be running', function () {
            assert.notOk(op.running);
        });

        it('should have an error', function () {
            assert.ok(op.error);
            assert.equal(op.error[0], 'error1');
            assert.notOk(op.error[1]);
            assert.equal(op.error[2], 'error2');
        });

        it('should have failed', function () {
            assert.ok(op.failed);
        });

    });


});
