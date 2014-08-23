describe('mapping relationships', function () {

    var Pouch,  RestObject, RestAPI, RestError, RelationshipType;

    beforeEach(function () {
        module('restkit.mapping', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });
        module('restkit.relationship', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Pouch_, _Mapping_, _RestObject_, _RestAPI_, _RestError_, _RelationshipType_) {
            Pouch = _Pouch_;
            RestObject = _RestObject_;
            RestAPI = _RestAPI_;
            RestError = _RestError_;
            RelationshipType = _RelationshipType_;
        });

        Pouch.reset();

    });

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
                configureAPI(RelationshipType.OneToOne, function (err) {
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

            it('is a one-to-one key relationship', function () {
                var carRelationships = carMapping.relationships;
                var r = carRelationships[0];
                inject(function (OneToOneRelationship) {
                    assert.instanceOf(r, OneToOneRelationship);
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