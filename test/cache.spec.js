var s = require('../core/index');
var assert = require('chai').assert;

describe('cache...', function() {
    before(function () {
        s.ext.storageEnabled = false;
    });
    var mapping;

    var sModel = require('../core/modelInstance').ModelInstance;
    var RelationshipType = require('../core/relationship').RelationshipType;
    var cache = require('../core/cache');

    beforeEach(function(done) {
        s.reset(function () {
            var coll = s.collection('myCollection');
            mapping = coll.model('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            coll.install(done);
        });
    });

    describe('insertion', function() {
        it('by pouch id', function() {
            var model = new sModel(mapping);
            model._id = 'dsfsd';
            cache.insert(model);
            assert.equal(model, cache._localCache()[model._id]);
            assert.equal(model, cache._localCacheByType[model.model.collection][model.type][model._id], model);
        });

        it('by default id', function() {
            var model = new sModel(mapping);
            model.id = 'dsfsd';
            cache.insert(model);

            var remoteCache = cache._remoteCache();
            assert.equal(model, remoteCache[model.collection][model.type][model.id]);
        });

        it('by custom id', function() {
            var m = mapping;
            m.id = 'customId';
            var r = new sModel(m);
            r.customId = 'dsfsd';
            cache.insert(r);
            var remoteCache = cache._remoteCache();
            assert.equal(r, remoteCache[r.collection][r.type][r.customId]);
        });

    });

    describe('get', function() {
        it('by pouch id', function() {
            var r = new sModel(mapping);
            r.id = 'dsfsd';
            cache.insert(r);
            var returned = cache.get({
                model: mapping,
                id: 'dsfsd'
            });
            assert.equal(returned, r);
        });
        it('by rest id', function() {
            var model = new sModel(mapping);
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
        var collection, carMapping, personMapping;

        beforeEach(function(done) {
            collection = s.collection('myCollection');
            personMapping = collection.model('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });
            carMapping = collection.model('Car', {
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
                model: carMapping,
                path: '/cars/[0-9]+'
            });
            s.ext.http.DescriptorRegistry.registerResponseDescriptor(desc);
            collection.install(done);
        });

        describe('errors', function() {
            it('ignore duplicate inserts if is the same object', function() {
                var person = personMapping._new({
                    name: 'Michael Ford',
                    age: 23,
                    id: 'xyz'
                });
                cache.insert(person);
                cache.insert(person); // Should be fine as is the exact same object.
            });

            it('cant insert object with same _id', function() {
                var person = personMapping._new({
                    name: 'Michael Ford',
                    age: 23,
                    id: 'xyz'
                });
                cache.insert(person);
                var duplicateObject = new sModel();
                duplicateObject._id = person._id;
                assert.throws(function() {
                    cache.insert(duplicateObject);
                }, s.InternalsError);
            });

            it('cant insert object with same id', function() {
                var person = personMapping._new({
                    name: 'Michael Ford',
                    age: 23,
                    id: 'xyz'
                });
                cache.insert(person);

                assert.throws(function() {
                    cache.insert(personMapping._new({
                        name: 'Michael Ford',
                        age: 23,
                        id: 'xyz'
                    }));
                }, s.InternalsError);
            });
        });

    });

    describe('deletion', function () {
        it('xyz', function () {
            
        });
    });

});