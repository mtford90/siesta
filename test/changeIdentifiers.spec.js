var assert = require('chai').assert,
    cache = siesta._internal.cache;

describe('change identifiers', function () {

    var Collection, Car;

    var car;

    before(function () {
        siesta.ext.storageEnabled = false;
    });
    beforeEach(function (done) {
        siesta.reset(function () {
            Collection = siesta.collection('myCollection');
            Car = Collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            Car.map({id: 'xyz', colour: 'red', name: 'ford'}, function (err, _car) {
                if (err) done(err);
                car = _car;
                done();
            })
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