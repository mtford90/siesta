
var s = require('../index');

var assert = require('chai').assert;
var notificationCentre = require('../src/notificationCentre').notificationCentre;

describe('Notification Centre', function () {
    beforeEach(function () {
        s.reset(true);
    });

    describe('emissions', function () {
        it('simple emissions work', function (done) {
            notificationCentre.on('blah', function () {
                done();
            });
            notificationCentre.emit('blah');
        });

        it('emissions with payloads work', function (done) {
            var p = {};
            notificationCentre.on('blah', function (payload) {
                assert.equal(payload, p);
                done();
            });
            notificationCentre.emit('blah', p);
        });
    });





});