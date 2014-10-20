var s = require('../index')
    , assert = require('chai').assert;


describe('pouch doc adapter', function () {

    var Collection = require('../src/collection').Collection;

    var RestError = require('../src/error').RestError;
    var RelationshipType = require('../src/relationship').RelationshipType;

    var SiestaModel = require('../src/object').SiestaModel;
    var cache = require('../src/cache');
    var coreChanges = require('../src/changes');
    var ChangeType = coreChanges.ChangeType;

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
                    var obj = s.ext.storage.Pouch.toNew(doc);
                    assert.equal(obj.name, 'Michael');
                    assert.equal(obj.age, 23);
                    assert.ok(obj.isSaved);
                });

            });

        });

        describe('toSiesta', function () {

            var collection, personMapping;

            beforeEach(function (done) {
                collection = new Collection('MyOnlineCollection');
                personMapping = collection.mapping('Person', {
                    id: 'id',
                    attributes: ['age', 'name']
                });
                collection.install(done);
            });

            it('existing', function (done) {
                var doc = {name: 'Michael', age: 12, _id: 'localId', collection: 'MyOnlineCollection', type: 'Person'};
                s.ext.storage.Pouch.getPouch().put(doc, function (err, resp) {
                    if (err) done(err);
                    collection.Person.map({_id: 'localId', age: 23}, function (err, person) {
                        if (err) done(err);
                        assert.equal(person._id, doc._id);
                        collection.save(function (err) {
                            if (err) done(err);
                            s.ext.storage.Pouch.getPouch().get(person._id, function (err, doc) {
                                if (err) done(err);
                                var objs = s.ext.storage.Pouch.toSiesta([doc]);
                                assert.equal(objs.length, 1);
                                assert.equal(objs[0], person);
                                done();
                            });
                        });
                    });
                });
            });

            it('new', function (done) {
                collection.Person.map({name: 'Michael', age: 23}, function (err, person) {
                    if (err) done(err);
                    collection.save(function (err) {
                        if (err) done(err);
                        s.ext.storage.Pouch.getPouch().get(person._id, function (err, doc) {
                            if (err) done(err);
                            doc._id = 'randomid';
                            doc._rev = 'randomrev';
                            doc.id = 'randomremoteid';
                            if (err) done(err);
                            var objs = s.ext.storage.Pouch.toSiesta([doc]);
                            assert.equal(objs.length, 1);
                            assert.notEqual(objs[0], person);
                            assert.instanceOf(objs[0], SiestaModel);
                            done();
                        });
                    });
                });
            });

            it('cached', function (done) {
                collection.Person.map({name: 'Michael', age: 23, id: '2'}, function (err, person) {
                    if (err) done(err);
                    collection.save(function (err) {
                        if (err) done(err);
                        s.ext.storage.Pouch.getPouch().get(person._id, function (err, doc) {
                            if (err) done(err);
                            var objs = s.ext.storage.Pouch.toSiesta([doc]);
                            assert.equal(objs.length, 1);
                            assert.equal(objs[0], person);
                            assert.instanceOf(objs[0], SiestaModel);
                            done();
                        });
                    });
                });
            })


        });

        describe('validation', function () {
            it('No API field', function () {
                assert.throw(_.bind(s.ext.storage.Pouch._validate, s.ext.storage.Pouch, {type: 'Car'}), RestError);
            });

            it('No type field', function (done) {
                var collection = new Collection('myCollection');
                collection.install(function (err) {
                    if (err) done(err);
                    assert.throw(_.bind(s.ext.storage.Pouch._validate, s.ext.storage.Pouch, {collection: 'myCollection'}), RestError);
                    done();
                });
            });

            it('non existent API', function () {
                assert.throw(_.bind(s.ext.storage.Pouch._validate, s.ext.storage.Pouch, {collection: 'myCollection', type: 'Car'}), RestError);
            });

            it('non existent type', function (done) {
                var collection = new Collection('myCollection');
                collection.install(function (err) {
                    if (err) done(err);
                    assert.throw(_.bind(s.ext.storage.Pouch._validate, s.ext.storage.Pouch, {collection: 'myCollection', type: 'Car'}), RestError);
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
                    var mapping = s.ext.storage.Pouch._validate({name: 'Michael', type: 'Person', collection: 'myCollection', age: 23});
                    assert.ok(mapping);
                    done();
                });
            });

        });

        describe('changes', function () {
            var collection, carMapping;
            beforeEach(function (done) {
                collection = new Collection('myCollection');

                carMapping = collection.mapping('Car', {
                    id: 'id',
                    attributes: ['name', 'colour']
                });
                collection.install(done);

            });

            it('pouch adapter should apply unmerged s.ext.storage.changes', function (done) {
                var doc = {
                    collection: 'myCollection',
                    type: 'Car',
                    colour: 'red',
                    _id: 'localId',
                    name: 'Aston Martin'
                };
                s.ext.storage.Pouch.getPouch().put(doc, function (err, resp) {
                    if (err) done(err);
                    doc._rev = resp.rev;
                    s.ext.storage.changes.registerChange({
                        collection: collection._name,
                        mapping: carMapping.type,
                        field: 'colour',
                        type: ChangeType.Set,
                        new: 'blue',
                        old: 'red',
                        _id: 'localId'
                    });
                    s.ext.storage.changes.registerChange({
                        collection: collection._name,
                        mapping: carMapping.type,
                        field: 'name',
                        type: ChangeType.Set,
                        new: 'Bentley',
                        old: 'Aston Martin',
                        _id: 'localId'
                    });
                    var models = s.ext.storage.Pouch.toSiesta([doc]);
                    assert.equal(models[0].colour, 'blue');
                    assert.equal(models[0].name, 'Bentley');
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
                        type: RelationshipType.OneToMany,
                        reverse: 'cars'
                    }
                }
            });
            collection.install(done);
        });

        it('should convert objects with no relationships successfully', function (done) {
            personMapping.map({name: 'Michael', age: 23, id: 'xyz'}, function (err, person) {
                if (err) done(err);
                var adapted = s.ext.storage.Pouch.from(person);
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
                    var adapted = s.ext.storage.Pouch.from(car);
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