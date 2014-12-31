var s = require('../core/index')
    , assert = require('chai').assert;

describe('change identifiers', function () {

    var Collection = require('../core/collection');
    var cache = require('../core/cache');
    var collection, carMapping;

    var car;

    before(function () {
        s.ext.storageEnabled = false;
    });
    beforeEach(function (done) {
        s.reset(function () {
            collection = s.collection('myCollection');
            carMapping = collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            s.install(function (err) {
                if (err) done(err);
                carMapping.map({id: 'xyz', colour: 'red', name: 'ford'}, function (err, _car) {
                    if (err) done(err);
                    car = _car;
                    done();
                })
            });
        });
    });

    it('xyz', function (done) {
        assert.equal(cache.get({id: 'xyz', model: carMapping}), car);
        car.id = 'abc';
        assert.notOk(cache.get({id: 'xyz', model: carMapping}), car);
        assert.equal(cache.get({id: 'abc', model: carMapping}), car);
        done();
    });

});