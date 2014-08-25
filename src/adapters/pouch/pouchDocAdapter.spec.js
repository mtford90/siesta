describe('pouch doc adapter', function () {

    var RestAPI, Pouch, PouchDocAdapter, RestError, RelationshipType;

    beforeEach(function () {
        module('restkit.pouchDocAdapter', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_RestAPI_, _Pouch_, _PouchDocAdapter_, _RestError_, _RelationshipType_) {
            RestAPI = _RestAPI_;
            Pouch = _Pouch_;
            PouchDocAdapter = _PouchDocAdapter_;
            RestError = _RestError_;
            RelationshipType = _RelationshipType_;
        });

        RestAPI._reset();
    });

    describe('from pouch to fount', function () {
        describe('new', function () {
            var api;
            beforeEach(function (done) {
                api = new RestAPI('myApi', function () {
                    api.registerMapping('Person', {
                        id: 'id',
                        attributes: ['name', 'age'],
                        indexes: ['name', 'age']
                    });
                }, function () {
                    done();
                });
            });

            it('absorbs properties', function () {
                var doc = {name: 'Michael', type: 'Person', api: 'myApi', age: 23, _id: 'randomId', _rev: 'randomRev'};
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
                new RestAPI('myApi', null, function () {
                    assert.throw(_.bind(PouchDocAdapter._validate, PouchDocAdapter, {api: 'myApi'}), RestError);
                    done();
                });
            });

            it('non existent API', function () {
                assert.throw(_.bind(PouchDocAdapter._validate, PouchDocAdapter, {api: 'myApi', type: 'Car'}), RestError);
            });

            it('non existent type', function (done) {
                new RestAPI('myApi', null, function () {
                    assert.throw(_.bind(PouchDocAdapter._validate, PouchDocAdapter, {api: 'myApi', type: 'Car'}), RestError);
                    done();
                });
            });

            it('valid', function (done) {
                var api = new RestAPI('myApi', function () {
                    api.registerMapping('Person', {
                        id: 'id',
                        attributes: ['name', 'age'],
                        indexes: ['name', 'age']
                    });
                }, function () {
                    var mapping = PouchDocAdapter._validate({name: 'Michael', type: 'Person', api: 'myApi', age: 23});
                    console.log('mapping:', mapping);
                    assert.ok(mapping);
                    done();
                });
            });

        });
    });

    describe('from fount to pouch', function () {

        var api, personMapping, carMapping;

        beforeEach(function (done) {
            api = new RestAPI('myApi', function () {
                personMapping = api.registerMapping('Person', {
                    id: 'id',
                    attributes: ['name', 'age'],
                    indexes: ['name', 'age']
                });
                carMapping = api.registerMapping('Car', {
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


});