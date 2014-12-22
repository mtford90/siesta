var s = require('../core/index'),
    assert = require('chai').assert;


var Query = require('../core/query').Query
    , Collection = require('../core/collection').Collection;

describe.only('storage', function () {

    beforeEach(function () {
        s.reset(true);
    });

    describe('serialisation', function () {

        describe('attributes only', function () {
            var collection, Car;

            beforeEach(function (done) {
                s.reset(true);
                collection = new Collection('myCollection');
                Car = collection.model('Car', {
                    attributes: ['colour', 'name']
                });
                collection.install(done);
            });

            it('storage', function (done) {
                Car.map({colour: 'black', name: 'bentley', id: 2})
                    .then(function (car) {
                        var serialised = s.ext.storage._serialise(car);
                        assert.equal(serialised.colour, 'black');
                        assert.equal(serialised.name, 'bentley');
                        assert.equal(serialised.id, 2);
                        assert.equal(serialised._id, car._id);
                        assert.equal(serialised.collection, 'myCollection');
                        assert.equal(serialised.model, 'Car');
                        done();
                    })
                    .catch(done)
                    .done();
            });
        });
    });

});