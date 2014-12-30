var s = require('../core/index');
var assert = require('chai').assert;

describe('cache...', function() {
    before(function () {
        s.ext.storageEnabled = false;
    });
    var mapping;

    var ModelInstance = require('../core/modelInstance');
    var RelationshipType = require('../core/relationship').RelationshipType;
    var cache = require('../core/cache');



    describe('insertion', function() {
        beforeEach(function(done) {
            s.reset(function () {
                var coll = s.collection('myCollection');
                mapping = coll.model('Car', {
                    id: 'id',
                    attributes: ['colour', 'name']
                });
                s.install(done);
            });
        });
        it('by pouch id', function() {
            var car = new ModelInstance(mapping);
            car._id = 'dsfsd';
            cache.insert(car);
            assert.equal(car, cache._localCache()[car._id]);
            assert.equal(car, cache._localCacheByType[car.model.collectionName][car.modelName][car._id], car);
        });

        it('by default id', function() {
            var car = new ModelInstance(mapping);
            car.id = 'dsfsd';
            cache.insert(car);

            var remoteCache = cache._remoteCache();
            assert.equal(car, remoteCache[car.collectionName][car.modelName][car.id]);
        });

        it('by custom id', function() {
            var m = mapping;
            m.id = 'customId';
            var car = new ModelInstance(m);
            car.customId = 'dsfsd';
            cache.insert(car);
            var remoteCache = cache._remoteCache();
            assert.equal(car, remoteCache[car.collectionName][car.modelName][car.customId]);
        });

    });

    describe('get', function() {
        beforeEach(function(done) {
            s.reset(function () {
                var coll = s.collection('myCollection');
                mapping = coll.model('Car', {
                    id: 'id',
                    attributes: ['colour', 'name']
                });
                s.install(done);
            });
        });
        it('by pouch id', function() {
            var r = new ModelInstance(mapping);
            r.id = 'dsfsd';
            cache.insert(r);
            var returned = cache.get({
                model: mapping,
                id: 'dsfsd'
            });
            assert.equal(returned, r);
        });
        it('by rest id', function() {
            var model = new ModelInstance(mapping);
            model.id = 'dsfsd';
            model._id = 'xyz';
            cache.insert(model);
            var returned = cache.get({
                model: mapping,
                id: 'dsfsd'
            });
            assert.equal(returned, model);
        });
    });

    describe('full test', function() {
        var collection, Car, Person;

        beforeEach(function(done) {
            s.reset(function () {
                collection = s.collection('myCollection');
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
                collection.baseURL = 'http://mywebsite.co.uk/';
                var desc = new s.ext.http.ResponseDescriptor({
                    method: 'GET',
                    model: Car,
                    path: '/cars/[0-9]+'
                });
                s.ext.http.DescriptorRegistry.registerResponseDescriptor(desc);
                s.install(done);
            });

        });

        describe('errors', function() {

            it('ignore duplicate inserts if is the same object', function() {
                var person = Person._new({
                    name: 'Michael Ford',
                    age: 23,
                    id: 'xyz'
                });
                cache.insert(person);
                cache.insert(person); // Should be fine as is the exact same object.
            });

            it('cant insert object with same _id', function() {
                var person = Person._new({
                    name: 'Michael Ford',
                    age: 23,
                    id: 'xyz'
                });
                cache.insert(person);
                var duplicateObject = new ModelInstance();
                duplicateObject._id = person._id;
                assert.throws(function() {
                    cache.insert(duplicateObject);
                }, s.InternalsError);
            });

            it('cant insert object with same id', function() {
                var person = Person._new({
                    name: 'Michael Ford',
                    age: 23,
                    id: 'xyz'
                });
                cache.insert(person);

                assert.throws(function() {
                    cache.insert(Person._new({
                        name: 'Michael Ford',
                        age: 23,
                        id: 'xyz'
                    }));
                }, s.InternalsError);
            });
        });

    });



});