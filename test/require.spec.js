/*globals describe,it */
var http = require('../src/http');
var siesta = require('../src/index')({http: http});

describe('qwerty', function () {
    it('red', function () {
        assert.ok(http);
        assert.ok(siesta);
        assert.equal(siesta.ext.http, http);
    });
});