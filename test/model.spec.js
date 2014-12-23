var s = require('../core/index'),
    assert = require('chai').assert;

var SiestaModel = require('../core/siestaModel').SiestaModel
    , cache = require('../core/cache')
    , Collection = require('../core/collection').Collection;

describe('Models', function () {
    var mapping, collection;

    beforeEach(function (done) {
        s.reset();
        collection = new Collection('myCollection');
        mapping = collection.model({
            name: 'Car',
            id: 'id',
            attributes: ['colour', 'name'],
            collection: 'myCollection'
        });
        collection.install(done);
    });

    it('get attributes', function (done) {
        mapping.map({id: 1, colour: 'red', name: 'Aston martin'})
            .then(function (car) {
                var attributes = car.getAttributes();
                assert.equal(Object.keys(attributes).length, 3);
                assert.equal(attributes.id, 1);
                assert.equal(attributes.colour, 'red');
                assert.equal(attributes.name, 'Aston martin');
                done();
            })
            .catch(done).done();
    });

    describe('fields', function () {


        it('type field', function () {
            var r = new SiestaModel(mapping);
            assert.equal(r.type, 'Car');
        });

        it('collection field', function () {
            var r = new SiestaModel(mapping);
            assert.equal(r.collection, 'myCollection');
        });

        it('type field', function () {
            var r = new SiestaModel(mapping);
            assert.notOk(r.isSaved);
        });

    });

    describe('removal', function () {
        var car;

        describe('remote id', function () {
            function remove() {
                car = new SiestaModel(mapping);
                car.colour = 'red';
                car.name = 'Aston Martin';
                car.id = '2';
                car._id = 'xyz';
                cache.insert(car);
                assert.notOk(car.removed);
                assert.ok(cache.contains(car));
                car.remove();
                assert.notOk(cache.contains(car));
                assert.ok(car.removed);
            }

            it('deletion', function () {
                remove();
            });

            it('restore', function () {
                remove();
                car.restore();
                assert.notOk(car.removed);
                assert.ok(cache.contains(car));
            });

        });

        describe('no remote id', function () {
            function remove() {
                car = new SiestaModel(mapping);
                car.colour = 'red';
                car.name = 'Aston Martin';
                car._id = 'xyz';
                cache.insert(car);
                assert.notOk(car.removed);
                assert.ok(cache.contains(car));
                car.remove();
                assert.notOk(cache.contains(car));
                assert.ok(car.removed);
            }

            it('deletion', function () {
                remove();
            });

            it('restore', function () {
                remove();
                car.restore();
                assert.notOk(car.removed);
                assert.ok(cache.contains(car));
            });
        })


    });



});