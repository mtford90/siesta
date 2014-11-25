/*globals describe,it */
var http = require('../http');
var siesta = require('../core/index')({http: http});

describe('qwerty', function () {
    it('red', function () {
        assert.ok(http);
        assert.ok(siesta);
        assert.equal(siesta.ext.http, http);
    });
});

