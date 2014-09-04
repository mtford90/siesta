var siesta = require('../index');
var assert = require('chai').assert;

describe('cache', function () {
    var mapping;



    var RestObject =  require('../src/object').RestObject;
    var Collection =  require('../src/collection').Collection;
    var ResponseDescriptor =  require('../src/responseDescriptor').ResponseDescriptor;
    var DescriptorRegistry =  require('../src/descriptorRegistry').DescriptorRegistry;
    var RelationshipType =  require('../src/relationship').RelationshipType;
    var Mapping =  require('../src/mapping').Mapping;
    var cache =  require('../src/cache');

    beforeEach(function (done) {
        siesta.reset(true, function () {
            mapping = new Mapping({
                type: 'Car',
                id: 'id',
                attributes: ['colour', 'name'],
                collection: 'myCollection'
            });
            mapping.install(function (err) {
                done(err);
            });
        });
    });

    describe('insertion', function () {
        it('by pouch id', function () {
            var r = new RestObject(mapping);
            r._id = 'dsfsd';
            cache.insert(r);
            assert.equal(r, cache._idCache()[r._id]);
        });

        it('by default id', function () {
            var r = new RestObject(mapping);
            r.id = 'dsfsd';
            cache.insert(r);

            var restCache = cache._restCache();
            assert.equal(r, restCache[r.collection][r.type][r.id]);
        });

        it('by custom id', function () {
            var m = mapping;
            m.id = 'customId';
            var r = new RestObject(m);
            r.customId = 'dsfsd';
            cache.insert(r);
            var restCache = cache._restCache();
            assert.equal(r, restCache[r.collection][r.type][r.customId]);
        });

    });

    describe('get', function () {
        it('by pouch id', function () {
            var r = new RestObject(mapping);
            r.id = 'dsfsd';
            cache.insert(r);
            var returned = cache.get({
                mapping: mapping,
                id: 'dsfsd'
            });
            assert.equal(returned, r);
        });
        it('by rest id', function () {
            var r = new RestObject(mapping);
            r.id = 'dsfsd';
            r._id = 'xyz';
            cache.insert(r);
            var returned = cache.get({
                mapping: mapping,
                id: 'dsfsd'
            });
            assert.equal(returned, r);
        });
    });

    describe('full test', function () {
        var collection, carMapping, personMapping;

        beforeEach(function (done) {
            collection = new Collection('myCollection');
            personMapping = collection.mapping('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });
            carMapping = collection.mapping('Car', {
                id: 'id',
                attributes: ['colour', 'name'],
                relationships: {
                    owner: {
                        mapping: 'Person',
                        type: RelationshipType.ForeignKey,
                        reverse: 'cars'
                    }
                }
            });
            collection.baseURL = 'http://mywebsite.co.uk/';
            var desc = new ResponseDescriptor({
                method: 'GET',
                mapping: carMapping,
                path: '/cars/(?<id>[0-9])/?'
            });
            DescriptorRegistry.registerResponseDescriptor(desc);
            collection.install(done);
        });

        describe('errors', function () {
            it('ignore duplicate inserts if is the same object', function () {
                var person = personMapping._new({name: 'Michael Ford', age: 23, id: 'xyz'});
                cache.insert(person);
                cache.insert(person); // Should be fine as is the exact same object.
            });

            it('cant insert object with same _id', function () {
                var person = personMapping._new({name: 'Michael Ford', age: 23, id: 'xyz'});
                cache.insert(person);
                var duplicateObject = new RestObject();
                duplicateObject._id = person._id;
                assert.throws(function () {
                    cache.insert(duplicateObject);
                }, siesta.RestError);
            });

            it('cant insert object with same id', function () {
                var person = personMapping._new({name: 'Michael Ford', age: 23, id: 'xyz'});
                cache.insert(person);

                assert.throws(function () {
                    cache.insert(personMapping._new({name: 'Michael Ford', age: 23, id: 'xyz'}));
                }, siesta.RestError);
            });
        });


    })

});