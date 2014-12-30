/*global describe,it,beforeEach */

var s = require('../../core/index'),
    chai = require('chai'),
    assert = chai.assert,
    _ = require('../../core/util/util')._;

var Operation = require('../../core/operation/operation').Operation;

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

