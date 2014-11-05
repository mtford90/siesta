/*global describe,it,beforeEach */

var s = require('../../index'),
    chai = require('chai'),
    assert = chai.assert,
    _ = require('../../src/util')._;

var Operation = require('../../src/operation/operation').Operation;

describe('registration', function () {
    describe('of operations', function () {

        it('xyz', function (done) {
            var op = new Operation(function (done) {
                setTimeout(function () {
                    done();
                }, 50);
            });
            op.completion = function () {
                assert.notInclude(Operation.running, op);
                done();
            };
            op.start();

            assert.include(Operation.running, op);
        });

    });
});

