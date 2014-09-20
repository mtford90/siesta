var s = require('../index')
    , assert = require('chai').assert;


describe('pouch doc adapter', function () {


    var Collection = require('../src/collection').Collection;

    var Pouch = require('../src/pouch');

    var RestError = require('../src/error').RestError;
    var RelationshipType = require('../src/relationship').RelationshipType;

    var SiestaModel = require('../src/object').SiestaModel;
    var cache = require('../src/cache');

    var pouchAdapter = require('../src/pouchAdapter');

    beforeEach(function () {
        s.reset(true);
    });

    describe('from pouch to siesta', function () {
        describe('new', function () {

            describe('simple', function () {
                var collection;
                beforeEach(function (done) {
                    collection = new Collection('myCollection');
                    collection.mapping('Person', {
                        id: 'id',
                        attributes: ['name', 'age'],
                        indexes: ['name', 'age']
                    });
                    collection.install(done);
                });

                it('absorbs properties', function () {
                    var doc = {name: 'Michael', type: 'Person', collection: 'myCollection', age: 23, _id: 'randomId', _rev: 'randomRev'};
                    var obj = Pouch.toNew(doc);
                    assert.equal(obj.name, 'Michael');
                    assert.equal(obj.age, 23);
                    assert.ok(obj.isSaved);
                });

            });

        });

        describe('toSiesta', function () {

            var collection;

            beforeEach(function (done) {
                collection = new Collection('MyOnlineCollection');
                collection.mapping('Person', {
                    id: 'photoId',
                    attributes: ['height', 'width', 'url']
                });
                collection.install(done);
            });

            it('existing', function (done) {
                collection.Person.map({name: 'Michael', age: 23}, function (err, person) {
                    if (err) done(err);
                    Pouch.getPouch().get(person._id, function (err, doc) {
                        if (err) done(err);
                        var objs = Pouch.toSiesta([doc]);
                        assert.equal(objs.length, 1);
                        assert.equal(objs[0], person);
                        done();
                    });
                });
            });

            it('new', function (done) {
                collection.Person.map({name: 'Michael', age: 23}, function (err, person) {
                    if (err) done(err);
                    Pouch.getPouch().get(person._id, function (err, doc) {
                        doc._id = 'randomid';
                        doc._rev = 'randomrev';
                        doc.id = 'randomremoteid';
                        if (err) done(err);
                        var objs = Pouch.toSiesta([doc]);
                        assert.equal(objs.length, 1);
                        assert.notEqual(objs[0], person);
                        assert.instanceOf(objs[0], SiestaModel);
                        done();
                    });
                });
            });


        });

        describe('validation', function () {
            it('No API field', function () {
                assert.throw(_.bind(Pouch._validate, Pouch, {type: 'Car'}), RestError);
            });

            it('No type field', function (done) {
                var collection = new Collection('myCollection');
                collection.install(function (err) {
                    if (err) done(err);
                    assert.throw(_.bind(Pouch._validate, Pouch, {collection: 'myCollection'}), RestError);
                    done();
                });
            });

            it('non existent API', function () {
                assert.throw(_.bind(Pouch._validate, Pouch, {collection: 'myCollection', type: 'Car'}), RestError);
            });

            it('non existent type', function (done) {
                var collection = new Collection('myCollection');
                collection.install(function (err) {
                    if (err) done(err);
                    assert.throw(_.bind(Pouch._validate, Pouch, {collection: 'myCollection', type: 'Car'}), RestError);
                    done();
                });
            });

            it('valid', function (done) {
                var collection = new Collection('myCollection');
                collection.mapping('Person', {
                    id: 'id',
                    attributes: ['name', 'age'],
                    indexes: ['name', 'age']
                });
                collection.install(function (err) {
                    if (err) done(err);
                    var mapping = Pouch._validate({name: 'Michael', type: 'Person', collection: 'myCollection', age: 23});
                    assert.ok(mapping);
                    done();
                });
            });

        });


    });

    describe('from siesta to pouch', function () {

        var collection, personMapping, carMapping;

        beforeEach(function (done) {
            collection = new Collection('myCollection');
            personMapping = collection.mapping('Person', {
                id: 'id',
                attributes: ['name', 'age'],
                indexes: ['name', 'age']
            });
            carMapping = collection.mapping('Car', {
                id: 'id',
                attributes: ['name', 'colour'],
                relationships: {
                    owner: {
                        mapping: 'Person',
                        type: RelationshipType.ForeignKey,
                        reverse: 'cars'
                    }
                }
            });
            collection.install(done);
        });

        it('should convert objects with no relationships successfully', function (done) {
            personMapping.map({name: 'Michael', age: 23, id: 'xyz'}, function (err, person) {
                if (err) done(err);
                var adapted = Pouch.from(person);
                assert.equal(adapted.name, 'Michael');
                assert.equal(adapted.age, 23);
                assert.equal(adapted.id, 'xyz');
                assert.equal(adapted._id, person._id);
                assert.equal(adapted.type, person.mapping.type);
                assert.equal(adapted.collection, person.collection);
                done();
            });
        });

        it('should convert objects with relationship successfully', function (done) {
            personMapping.map({name: 'Michael', age: 23, id: 'xyz'}, function (err, person) {
                if (err) done(err);
                carMapping.map({name: 'Aston Martin', id: 'xyz123', owner: {_id: person._id}}, function (err, car) {
                    if (err) done(err);
                    var adapted = Pouch.from(car);
                    assert.equal(adapted.name, 'Aston Martin');
                    assert.equal(adapted.id, 'xyz123');
                    assert.equal(adapted._id, car._id);
                    assert.equal(adapted.type, car.mapping.type);
                    assert.equal(adapted.collection, car.collection);
                    assert.equal(adapted.owner, person._id);
                    done();
                });
            });

        });


    });


});