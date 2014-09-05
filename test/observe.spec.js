var s = require('../index')
    , assert = require('chai').assert;

/**
 * Assertions against the observe-js library from polymer, modified to fit browserify.
 */

describe.only('observer', function () {

    var ArrayObserver = require('observe-js').ArrayObserver;

    it('xyz', function () {
        var arr = [1, 2, 3];
        var observer = new ArrayObserver(arr);
        observer.open(function (splices) {
            splices.forEach(function (splice) {
                assert.include(splice.removed, 1);
                assert.include(splice.removed, 2);
                assert.equal(splice.index, 0);
            });
        });
        arr[0] = 4;
        arr[1] = 5;
    })


});