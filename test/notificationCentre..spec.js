
var s = require('../index')
    , assert = require('chai').assert
    , _ = require('underscore');

describe('Notification Centre', function () {


    var sut = s.NotificationCentre;


    beforeEach(function () {
        s.reset(true);
    });

    it('register listener', function () {
        var listener = function () {};
        sut.registerListener('notification', listener);
        assert.include(sut.listeners.notification, listener);
    });

    it('deregister listener', function () {
        var listener = function () {};
        sut.registerListener('notification', listener);
        assert.include(sut.listeners.notification, listener);
        sut.deregisterListener('notification', listener);
    });


//    it('broadcast', function (done) {
//        var payload = {};
//        var listener = function (n, p) {
//            assert.equal(n, 'notification');
//            assert.equal(p, payload);
//            done();
//        };
//        sut.registerListener('notification', listener);
//        sut.broadcast('notification', payload);
//    })

});