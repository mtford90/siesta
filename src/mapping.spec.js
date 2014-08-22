describe('mapping!', function () {

    var Index, Pouch, Indexes, RawQuery, Mapping, RestObject, RestAPI, RestError, RelationshipType, RelatedObjectProxy;

    beforeEach(function () {
        module('restkit.mapping', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });
        module('restkit.relationship', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Index_, _Pouch_, _Indexes_, _RawQuery_, _Mapping_, _RestObject_, _RestAPI_, _RestError_, _RelationshipType_, _RelatedObjectProxy_) {
            Index = _Index_;
            Indexes = _Indexes_;
            Pouch = _Pouch_;
            RawQuery = _RawQuery_;
            Mapping = _Mapping_;
            RestObject = _RestObject_;
            RestAPI = _RestAPI_;
            RestError = _RestError_;
            RelationshipType = _RelationshipType_;
            RelatedObjectProxy = _RelatedObjectProxy_;
        });

        Pouch.reset();

    });

    it('_fields', function () {
        var m = new Mapping({
            type: 'type',
            id: 'id',
            attributes: ['field1', 'field2']
        });
        assert.include(m._fields, 'id');
        assert.include(m._fields, 'field1');
        assert.include(m._fields, 'field2');
        assert.notInclude(m._fields, 'type');
    });

    it('attributes', function () {
        var m = new Mapping({
            type: 'type',
            id: 'id',
            attributes: ['field1', 'field2']
        });
        assert.include(m.attributes, 'field1');
        assert.include(m.attributes, 'field2');
    });

    it('type', function () {
        var m = new Mapping({
            type: 'type',
            id: 'id',
            attributes: ['field1', 'field2']
        });
        assert.equal(m.type, 'type');
    });

    it('id', function () {
        var m = new Mapping({
            type: 'type',
            id: 'id',
            attributes: ['field1', 'field2']
        });
        assert.equal(m.id, 'id');
    });

    it('installation', function (done) {
        var m = new Mapping({
            type: 'Type',
            id: 'id',
            attributes: ['field1', 'field2'],
            api: 'myApi'
        });
        m.install(function (err) {
            if (err) done(err);
            assert.equal(Index.indexes.length, 8);
            done();
        });
    });

    describe('validation', function () {
        it('no type', function () {
            var m = new Mapping({
                id: 'id',
                attributes: ['field1', 'field2'],
                api: 'myApi'
            });
            var errors = m._validate();
            console.log('errors:', errors);
            assert.equal(1, errors.length);
        });
        it('no api', function () {
            var m = new Mapping({
                id: 'id',
                attributes: ['field1', 'field2'],
                type: 'Car'
            });
            var errors = m._validate();
            console.log('errors:', errors);
            assert.equal(1, errors.length);
        });
    });

    describe('queries', function () {
        var api, mapping;
        beforeEach(function (done) {
            api = new RestAPI('myApi', function (err) {
                if (err) done(err);
                mapping = api.registerMapping('Car', {
                    id: 'id',
                    attributes: ['color', 'name']
                });
            }, function (err) {
                if (err) done(err);
                Pouch.getPouch().bulkDocs([
                    {
                        type: 'Car',
                        id: 4,
                        color: 'red',
                        name: 'Aston Martin',
                        api: 'myApi'
                    },
                    {
                        type: 'Car',
                        id: 5,
                        color: 'blue',
                        name: 'Ford',
                        api: 'myApi'
                    }
                ], function (err) {
                    done(err);
                });
            });
        });

        it('all', function (done) {
            mapping.all(function (err, cars) {
                if (err) done(err);
                assert.equal(cars.length, 2);
                _.each(cars, function (car) {
                    assert.instanceOf(car, RestObject);
                });
                done();
            });
        });

        it('query', function (done) {
            mapping.query({color: 'red'}, function (err, cars) {
                if (err) done(err);
                assert.equal(cars.length, 1);
                _.each(cars, function (car) {
                    assert.instanceOf(car, RestObject);
                });
                done();
            });
        });

        it('get', function (done) {
            mapping.get(4, function (err, car) {
                if (err) done(err);
                assert.ok(car);
                assert.instanceOf(car, RestObject);
                assert.equal(car.color, 'red');
                done();
            });
        });

    });

    describe('mapping', function () {


        describe('new object', function () {

            describe('no relationships', function () {
                var api, carMapping;

                beforeEach(function (done) {
                    api = new RestAPI('myApi', function (err, version) {
                        if (err) done(err);
                        carMapping = api.registerMapping('Car', {
                            id: 'id',
                            attributes: ['colour', 'name']
                        });
                    }, function () {
                        done();
                    });
                });
                it('valid', function () {
                    var r = carMapping._new({colour: 'red', name: 'Aston Martin', invalidField: 'invalid', id: 'xyz'});
                    assert.equal(r.colour, 'red');
                    assert.equal(r.name, 'Aston Martin');
                    assert.equal(r.id, 'xyz');
                    assert.ok(r._id);
                    assert.notOk(r.invalidField);
                });
                it('no id should cause an error', function () {
                    var invocation = _.bind(carMapping._new, carMapping, {colour: 'red', name: 'Aston Martin', invalidField: 'invalid'});
                    assert.throws(invocation, RestError);
                });

            });

            describe('relationships', function () {
                var api, carMapping, personMapping;

                function configureAPI(type, reverseName, done) {
                    api = new RestAPI('myApi', function (err, version) {
                        if (err) done(err);

                        carMapping = api.registerMapping('Car', {
                            id: 'id',
                            attributes: ['colour', 'name'],
                            relationships: {
                                owner: {
                                    mapping: 'Person',
                                    type: type,
                                    reverse: reverseName
                                }
                            }
                        });
                        personMapping = api.registerMapping('Person', {
                            id: 'id',
                            attributes: ['age', 'name']
                        });
                    }, function () {
                        done();
                    });
                }

                beforeEach(function (done) {
                    configureAPI(RelationshipType.ForeignKey, 'cars', done);
                });

                describe('installation of proxies', function () {
                    it('installs related object proxies', function () {
                        var personObject = personMapping._new({
                            name: 'Michael Ford',
                            age: 23,
                            id: 'remotePersonId'
                        });
                        assert.ok(personObject._id);
                        var carObject = carMapping._new({
                            colour: 'red',
                            name: 'Aston Martin',
                            invalidField: 'invalid',
                            id: 'remoteCarId',
                            owner: personObject._id
                        });
                        assert.instanceOf(carObject.owner, RelatedObjectProxy);
                        assert.equal(carObject.owner._id, personObject._id);
                    });
                });



            });
        });


    });

    describe('relationships', function () {
        describe('valid', function () {
            var api, carMapping, personMapping;

            function configureAPI(type, done) {
                api = new RestAPI('myApi', function (err, version) {
                    if (err) done(err);
                    carMapping = api.registerMapping('Car', {
                        id: 'id',
                        attributes: ['colour', 'name'],
                        relationships: {
                            owner: {
                                mapping: 'Person',
                                type: type,
                                reverse: 'cars'
                            }
                        }
                    });
                    personMapping = api.registerMapping('Person', {
                        id: 'id',
                        attributes: ['name', 'age']
                    });
                }, function (err) {
                    done(err);
                });
            }

            describe('Valid Foreign Key', function () {

                beforeEach(function (done) {
                    configureAPI(RelationshipType.ForeignKey, function (err) {
                        if (err) done(err);

                        done();
                    });
                });

                it('one relationship in car mapping', function () {
                    var carRelationships = carMapping.relationships;
                    assert.equal(carRelationships.length, 1);
                });

                it('one relationship in person mapping', function () {
                    var personRelationships = personMapping.relationships;
                    assert.equal(personRelationships.length, 1);
                });

                it('relationship in car and person mapping are the same', function () {
                    var carRelationships = carMapping.relationships;
                    var personRelationships = personMapping.relationships;
                    assert.equal(carRelationships[0], personRelationships[0]);
                });

                it('is a foreign key relationship', function () {
                    var carRelationships = carMapping.relationships;
                    var r = carRelationships[0];
                    inject(function (ForeignKeyRelationship) {
                        assert.instanceOf(r, ForeignKeyRelationship);
                    });
                });

                it('forward mapping is the car mapping', function () {
                    var carRelationships = carMapping.relationships;
                    var r = carRelationships[0];
                    assert.equal(r.mapping, carMapping);
                });

                it('reverse mapping is the person mapping', function () {
                    var carRelationships = carMapping.relationships;
                    var r = carRelationships[0];
                    assert.equal(r.reverseMapping, personMapping);
                });

            });

            describe('Valid OneToOne', function () {
                beforeEach(function (done) {
                    configureAPI(RelationshipType.OneToOne, done);
                });

                it('OneToOne', function () {
                    var relationships = carMapping.relationships;
                    assert.equal(relationships.length, 1);
                    var relationship = relationships[0];
                    inject(function (OneToOneRelationship) {
                        assert.instanceOf(relationship, OneToOneRelationship);
                    });
                    assert.equal(relationship.mapping, carMapping);
                    assert.equal(relationship.reverseMapping, personMapping);
                });

            });

            describe('Valid ManyToMany', function () {
                beforeEach(function (done) {
                    configureAPI(RelationshipType.ManyToMany, done);
                });

                it('ManyToMany', function () {
                    var relationships = carMapping.relationships;
                    assert.equal(relationships.length, 1);
                    var relationship = relationships[0];
                    inject(function (ManyToManyRelationship) {
                        assert.instanceOf(relationship, ManyToManyRelationship);
                    });
                    assert.equal(relationship.mapping, carMapping);
                    assert.equal(relationship.reverseMapping, personMapping);
                });

            });

        });

        describe('invalid', function () {
            it('No such mapping', function (done) {
                var carMapping;
                var api = new RestAPI('myApi', function (err, version) {
                    if (err) done(err);
                    carMapping = api.registerMapping('Car', {
                        id: 'id',
                        attributes: ['colour', 'name'],
                        relationships: {
                            owner: {
                                mapping: 'asd',
                                type: RelationshipType.ForeignKey,
                                reverse: 'cars'
                            }
                        }
                    });
                }, function (err) {
                    if (err) {
                        if (err instanceof RestError) {
                            done()
                        }
                        else {
                            done(err);
                        }
                    }
                });
            });

            it('No such relationship type', function (done) {
                var carMapping, personMapping;
                var api = new RestAPI('myApi', function (err, version) {
                    if (err) done(err);
                    carMapping = api.registerMapping('Car', {
                        id: 'id',
                        attributes: ['colour', 'name'],
                        relationships: {
                            owner: {
                                mapping: 'Person',
                                type: 'invalidtype',
                                reverse: 'cars'
                            }
                        }
                    });
                    personMapping = api.registerMapping('Person', {
                        id: 'id',
                        attributes: ['name', 'age']
                    });
                }, function (err) {
                    if (err) {
                        if (err instanceof RestError) {
                            done()
                        }
                        else {
                            done(err);
                        }
                    }
                });
            });
        });


    });


});