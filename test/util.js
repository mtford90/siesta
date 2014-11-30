// Utilities for use during testing.

var assert = require('chai').assert;
var util = require('../core/util');

/**
 * Deep equality check against two arrays.
 * @param arr1
 * @param arr2
 * @param [msg]
 */
assert.arrEqual = function (arr1, arr2, msg) {
    if (!util.isArray(arr1)) throw new chai.AssertionError(arr1.toString() + ' is not an array');
    if (!util.isArray(arr2)) throw new chai.AssertionError(arr2.toString() + ' is not an array');
    _.each(_.zip(arr1, arr2), function (x) {
        if (util.isArray(x[0]) && util.isArray(x[1])) {
            assert.arrEqual(x[0], x[1]);
        } else if (x[0] != x[1]) {
            var err = arr1.toString() + ' != ' + arr2.toString();
            if (msg) err += '(' + msg + ')';
            throw new chai.AssertionError(err);
        }
    })
};

var server;

// Avoid making multiple fake servers. Seems to cause issues...
function fakeServer() {
    if (!server)
        server = sinon.fakeServer.create();
    return server;
}

module.exports = {
    assert: assert,
    fakeServer: fakeServer
};