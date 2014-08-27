describe('pouch doc adapter', function () {

    var Collection, Pouch, PouchDocAdapter, RestError, RelationshipType;

    beforeEach(function () {
        module('restkit.pouchDocAdapter', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Collection_, _Pouch_, _PouchDocAdapter_, _RestError_, _RelationshipType_) {
            Collection = _Collection_;
            Pouch = _Pouch_;
            PouchDocAdapter = _PouchDocAdapter_;
            RestError = _RestError_;
            RelationshipType = _RelationshipType_;
        });

        Collection._reset();
    });

    describe('from pouch to fount', function () {
        describe('new', function () {
            var collection;
            beforeEach(function (done) {
                collection = new Collection('myCollection', function () {
                    collection.registerMapping('Person', {
                        id: 'id',
                        attributes: ['name', 'age'],
                        indexes: ['name', 'age']
                    });
                }, function () {
                    done();
                });
            });

            it('absorbs properties', function () {
                var doc = {name: 'Michael', type: 'Person', collection: 'myCollection', age: 23, _id: 'randomId', _rev: 'randomRev'};
                var obj = PouchDocAdapter.toNew(doc);
                console.log('obj:', obj);
                for (var prop in doc) {
                    if (doc.hasOwnProperty(prop)) {
                        assert.equal(obj[prop], doc[prop]);
                    }
                }
                console.log(obj);
            })
        });

        describe('validation', function () {
            it('No API field', function () {
                assert.throw(_.bind(PouchDocAdapter._validate, PouchDocAdapter, {type: 'Car'}), RestError);
            });

            it('No type field', function (done) {
                new Collection('myCollection', null, function () {
                    assert.throw(_.bind(PouchDocAdapter._validate, PouchDocAdapter, {collection: 'myCollection'}), RestError);
                    done();
                });
            });

            it('non existent API', function () {
                assert.throw(_.bind(PouchDocAdapter._validate, PouchDocAdapter, {collection: 'myCollection', type: 'Car'}), RestError);
            });

            it('non existent type', function (done) {
                new Collection('myCollection', null, function () {
                    assert.throw(_.bind(PouchDocAdapter._validate, PouchDocAdapter, {collection: 'myCollection', type: 'Car'}), RestError);
                    done();
                });
            });

            it('valid', function (done) {
                var collection = new Collection('myCollection', function () {
                    collection.registerMapping('Person', {
                        id: 'id',
                        attributes: ['name', 'age'],
                        indexes: ['name', 'age']
                    });
                }, function () {
                    var mapping = PouchDocAdapter._validate({name: 'Michael', type: 'Person', collection: 'myCollection', age: 23});
                    console.log('mapping:', mapping);
                    assert.ok(mapping);
                    done();
                });
            });

        });
    });

    describe('from fount to pouch', function () {

        var collection, personMapping, carMapping;

        beforeEach(function (done) {
            collection = new Collection('myCollection', function () {
                personMapping = collection.registerMapping('Person', {
                    id: 'id',
                    attributes: ['name', 'age'],
                    indexes: ['name', 'age']
                });
                carMapping = collection.registerMapping('Car', {
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
            }, function (err) {
                done(err)
            });
        });

        it('should convert objects with no relationships successfully', function (done) {
            personMapping.map({name: 'Michael', age: 23, id: 'xyz'}, function (err, person) {
                if (err) done(err);
                var adapted = PouchDocAdapter.from(person);
                assert.equal(adapted.name, 'Michael');
                assert.equal(adapted.age, 23);
                assert.equal(adapted.id, 'xyz');
                assert.equal(adapted._id, person._id);
                done();
            });
        });

        it('should convert objects with relationship successfully', function (done) {
            personMapping.map({name: 'Michael', age: 23, id: 'xyz'}, function (err, person) {
                if (err) done(err);
                carMapping.map({name: 'Aston Martin', id: 'xyz123', owner: {_id: person._id}}, function (err, car) {
                    if (err) done(err);
                    var adapted = PouchDocAdapter.from(car);
                    assert.equal(adapted.name, 'Aston Martin');
                    assert.equal(adapted.id, 'xyz123');
                    assert.equal(adapted._id, car._id);
                    assert.equal(adapted.owner, person._id);
                    done();
                });
            });

        });


    });
//
//    // Test that pouch stays in sync with live objects
//    describe('sync', function () {
//        var collection, personMapping;
//
//
//        describe('attributes', function () {
//            beforeEach(function (done) {
//                collection = new Collection('myCollection', function () {
//                    personMapping = collection.registerMapping('Person', {
//                        id: 'id',
//                        attributes: ['name', 'age']
//                    });
//                }, function () {
//                    done();
//                });
//            });
//
//            it('when first mapped, should have all the same fields', function (done) {
//                personMapping.map({name: 'Michael Ford', age: 23}, function (err, person) {
//                    if (err) done (err);
//                    Pouch.getPouch().get(person._id, function (err, doc) {
//                        if (err) done(err);
//                        assert.equal(doc._id, person._id);
//                        assert.equal(doc.name, person.name);
//                        assert.equal(doc.age, person.age);
//                        done();
//                    });
//                });
//            })
//        });
//
//    })


});