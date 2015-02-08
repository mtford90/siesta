var assert = require('chai').assert,
    internal = siesta._internal,
    ModelInstance = internal.ModelInstance,
    cache = internal.cache,
    RelationshipType = siesta.RelationshipType;

describe('cache...', function () {


    before(function () {
        siesta.ext.storageEnabled = false;
    });
    var Car;

    describe('insertion', function () {
        beforeEach(function (done) {
            siesta.reset(function () {
                var coll = siesta.collection('myCollection');
                Car = coll.model('Car', {
                    id: 'id',
                    attributes: ['colour', 'name']
                });
                siesta.install(done);
            });
        });
        it('by pouch id', function () {
            var car = new ModelInstance(Car);
            car._id = 'dsfsd';
            cache.insert(car);
            assert.equal(car, cache._localCache()[car._id]);
            assert.equal(car, cache._localCacheByType[car.model.collectionName][car.modelName][car._id], car);
        });

        it('by default id', function () {
            var car = new ModelInstance(Car);
            car.id = 'dsfsd';
            cache.insert(car);

            var remoteCache = cache._remoteCache();
            assert.equal(car, remoteCache[car.collectionName][car.modelName][car.id]);
        });

        it('by custom id', function () {
            var m = Car;
            m.id = 'customId';
            var car = new ModelInstance(m);
            car.customId = 'dsfsd';
            cache.insert(car);
            var remoteCache = cache._remoteCache();
            assert.equal(car, remoteCache[car.collectionName][car.modelName][car.customId]);
        });

    });

    describe('get', function () {
        beforeEach(function (done) {
            siesta.reset(function () {
                var Collection = siesta.collection('myCollection');
                Car = Collection.model('Car', {
                    id: 'id',
                    attributes: ['colour', 'name']
                });
                siesta.install(done);
            });
        });
        it('by pouch id', function () {
            var r = new ModelInstance(Car);
            r.id = 'dsfsd';
            cache.insert(r);
            var returned = cache.get({
                model: Car,
                id: 'dsfsd'
            });
            assert.equal(returned, r);
        });
        it('by rest id', function () {
            var model = new ModelInstance(Car);
            model.id = 'dsfsd';
            model._id = 'xyz';
            cache.insert(model);
            var returned = cache.get({
                model: Car,
                id: 'dsfsd'
            });
            assert.equal(returned, model);
        });
    });

    describe('full test', function () {
        var collection, Car, Person;

        beforeEach(function (done) {
            siesta.reset(function () {
                collection = siesta.collection('myCollection');
                Person = collection.model('Person', {
                    id: 'id',
                    attributes: ['name', 'age']
                });
                Car = collection.model('Car', {
                    id: 'id',
                    attributes: ['colour', 'name'],
                    relationships: {
                        owner: {
                            model: 'Person',
                            type: RelationshipType.OneToMany,
                            reverse: 'cars'
                        }
                    }
                });
                siesta.install(done);
            });

        });

        describe('errors', function () {

            it('ignore duplicate inserts if is the same object', function () {
                var person = Person._new({
                    name: 'Michael Ford',
                    age: 23,
                    id: 'xyz'
                });
                cache.insert(person);
                cache.insert(person); // Should be fine as is the exact same object.
            });

            it('cant insert object with same _id', function () {
                var person = Person._new({
                    name: 'Michael Ford',
                    age: 23,
                    id: 'xyz'
                });
                cache.insert(person);
                var duplicateObject = new ModelInstance();
                duplicateObject._id = person._id;
                assert.throws(function () {
                    cache.insert(duplicateObject);
                }, siesta.InternalsError);
            });

            it('cant insert object with same id', function () {
                var person = Person._new({
                    name: 'Michael Ford',
                    age: 23,
                    id: 'xyz'
                });
                cache.insert(person);

                assert.throws(function () {
                    cache.insert(Person._new({
                        name: 'Michael Ford',
                        age: 23,
                        id: 'xyz'
                    }));
                }, siesta.InternalsError);
            });
        });

    });


});