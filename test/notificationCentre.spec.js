
var s = require('../core/index');

var assert = require('chai').assert;
var notificationCentre = require('../core/notifications').notificationCentre;

describe('Notification Centre', function () {
    before(function () {
        s.ext.storageEnabled = false;
    });
    beforeEach(function (done) {
        s.reset(done);
    });

    describe('emissions', function () {
        it('simple emissions work', function (done) {
            notificationCentre.once('blah', function () {
                done();
            });
            notificationCentre.emit('blah');
        });

        it('emissions with payloads work', function (done) {
            var p = {};
            notificationCentre.once('blah', function (payload) {
                assert.equal(payload, p);
                done();
            });
            notificationCentre.emit('blah', p);
        });
    });





});