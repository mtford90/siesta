var s = require('../core/index'),
    assert = require('chai').assert;

describe('change identifiers', function () {

    var cache = require('../core/cache');
    var Collection, Car;

    var car;

    before(function () {
        s.ext.storageEnabled = false;
    });
    beforeEach(function (done) {
        s.reset(function () {
            Collection = s.collection('myCollection');
            Car = Collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            s.install(function (err) {
                if (err) done(err);
                Car.map({id: 'xyz', colour: 'red', name: 'ford'}, function (err, _car) {
                    if (err) done(err);
                    car = _car;
                    done();
                })
            });
        });
    });

    it('xyz', function (done) {
        assert.equal(cache.get({id: 'xyz', model: Car}), car);
        car.id = 'abc';
        assert.notOk(cache.get({id: 'xyz', model: Car}), car);
        assert.equal(cache.get({id: 'abc', model: Car}), car);
        done();
    });

});