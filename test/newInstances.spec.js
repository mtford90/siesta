/*
 These tests deal with the creation of new ModelInstance objects.
 */

var assert = require('chai').assert,
    internal = siesta._internal,
    OneToManyProxy = internal.OneToManyProxy,
    RelationshipType = siesta.RelationshipType,
    cache = internal.cache;

describe('mapping new object', function () {

    before(function () {
        siesta.ext.storageEnabled = false;
    });

    beforeEach(function (done) {
        siesta.reset(done);
    });

    describe('fields', function () {
        var collection, Car;

        beforeEach(function (done) {
            collection = siesta.collection('myCollection');
            Car = collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            siesta.install(done);
        });

        it('valid', function () {
            var car = Car._instance();
            _.each(Car._attributeNames, function (f) {
                assert(car[f] !== undefined);
            });
        });

        describe('id field', function () {
            var car;
            beforeEach(function () {
                car = Car._instance();
            });

            it('should be present', function () {
                assert.property(car, 'id');
            });

            describe('in cache', function () {
                beforeEach(function () {
                    cache.insert(car);
                    assert.equal(car, cache.get({localId: car.localId}));
                    car.id = 'newRemoteId';
                });
                it('should update cache', function () {
                    assert.equal(car, cache.get({id: car.id, model: car.model}));
                });
                it('should remove previous', function () {
                    assert.equal(car, cache.get({id: car.id, model: car.model}));
                    car.id = 'brandNewRemoteId';
                    assert.equal(car, cache.get({id: car.id, model: car.model}));
                    assert.notOk(cache.get({id: 'newRemoteId', model: car.model}))
                });
                it('should remove all if set remoteid to null', function () {
                    assert.equal(car, cache.get({id: car.id, model: car.model}));
                    car.id = null;
                    assert.notOk(cache.get({id: 'newRemoteId', model: car.model}))
                })
            });
        });


    });

    describe('relationships', function () {
        var collection, Car, Person;

        function configureAPI(type, reverseName, done) {
            collection = siesta.collection('myCollection');
            Car = collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name'],
                relationships: {
                    owner: {
                        model: 'Person',
                        type: type,
                        reverse: reverseName
                    }
                }
            });
            Person = collection.model('Person', {
                id: 'id',
                attributes: ['age', 'name']
            });
            siesta.install(done);
        }

        beforeEach(function (done) {
            configureAPI(RelationshipType.OneToMany, 'cars', done);
        });

        describe('installation of proxies', function () {

            it('installs forward related object proxy', function () {
                var carObject = Car._instance();
                assert.instanceOf(carObject.__proxies['owner'], OneToManyProxy);
            });

            it('installs reverse related object proxy', function () {
                var personObject = Person._instance();
                assert.instanceOf(personObject.__proxies['cars'], OneToManyProxy);
            });

        });

    });


});
