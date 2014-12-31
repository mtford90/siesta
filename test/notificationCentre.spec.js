
var s = require('../core/index');

var assert = require('chai').assert;
var notifications = require('../core/notifications');

describe('Notification Centre', function () {
    before(function () {
        s.ext.storageEnabled = false;
    });
    beforeEach(function (done) {
        s.reset(done);
    });

    describe('emissions', function () {
        it('simple emissions work', function (done) {
            notifications.once('blah', function () {
                done();
            });
            notifications.emit('blah');
        });

        it('emissions with payloads work', function (done) {
            var p = {};
            notifications.once('blah', function (payload) {
                assert.equal(payload, p);
                done();
            });
            notifications.emit('blah', p);
        });
    });





});