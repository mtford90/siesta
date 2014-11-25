/*global describe,it,beforeEach */
var Operation, OperationQueue, Logger, _;

var s = require('../../core/index'),
    chai = require('chai'),
    assert = chai.assert,
    _ = require('../../core/util')._;

var Operation = require('../../core/operation/operation').Operation,
    OperationQueue = require('../../core/operation/queue').OperationQueue,
    Logger = require('../../core/operation/log');

describe('LocalCacheLogger', function () {
    it('set level', function () {
        var logger = Logger.loggerWithName('myLogger');
        var myOtherLogger = Logger.loggerWithName('myOtherLogger');
        assert.ok(logger.info.isEnabled);
        assert.ok(myOtherLogger.info.isEnabled);
        logger.setLevel(Logger.Level.warning);
        assert.notOk(logger.info.isEnabled);
    });

    it('override operation', function (done) {
        var op = new Operation();
        op.logLevel = Logger.Level.error;
        op.completion = function () {
            done();
        };
        op.start();
    });

    it('override queue', function () {
        var q = new OperationQueue();
        q.logLevel = Logger.Level.error;
        q.start();
    });
});
