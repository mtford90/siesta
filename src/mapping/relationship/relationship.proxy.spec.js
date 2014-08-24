describe('relationship proxy', function () {

    var Store, RestAPI, RestError, Mapping, ForeignKeyRelationship, RestObject, cache, OneToOneRelationship, RelationshipType, RelatedObjectProxy;
    var api, carMapping, personMapping;

    beforeEach(function (done) {
        module('restkit.relationship', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });
        module('restkit.mapping', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Store_, _RestError_, _RelatedObjectProxy_, _RelationshipType_, _RestAPI_, _Mapping_, _ForeignKeyRelationship_, _OneToOneRelationship_, _RestObject_, _cache_) {
            RestAPI = _RestAPI_;
            Mapping = _Mapping_;
            ForeignKeyRelationship = _ForeignKeyRelationship_;
            OneToOneRelationship = _OneToOneRelationship_;
            RestObject = _RestObject_;
            cache = _cache_;
            RelationshipType = _RelationshipType_;
            RelatedObjectProxy = _RelatedObjectProxy_;
            RestError = _RestError_;
            Store = _Store_;
        });

        RestAPI._reset();

        api = new RestAPI('myApi', function (err, version) {
            if (err) done(err);
            carMapping = api.registerMapping('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            personMapping = api.registerMapping('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });
        }, function (err) {
            done(err);
        });
    });

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
                attributes: ['name', 'age']
            });
        }, function (err) {
            done(err);
        });
    }


    describe('faults', function () {
        it('not a fault if no related object', function () {
            var car = carMapping._new({colour: 'red', name: 'Aston Martin', id: 'asdasd'});
            var relationship = new ForeignKeyRelationship('owner', 'cars', carMapping, personMapping);
            var proxy = new RelatedObjectProxy(relationship, car);
            assert.notOk(proxy.isFault());
        });
        it('is not a fault if related object exists', function () {
            var person = personMapping._new({name: 'Michael Ford', id: 'asdasd'});
            var car = carMapping._new({colour: 'red', name: 'Aston Martin', id: 'asdasd'});
            var relationship = new ForeignKeyRelationship('owner', 'cars', carMapping, personMapping);
            var proxy = new RelatedObjectProxy(relationship, car);
            proxy._id = person._id;
            proxy.relatedObject = person;
            assert.notOk(proxy.isFault());
        });
        it('is a fault if related object exists, but hasnt been obtained yet', function () {
            var person = personMapping._new({name: 'Michael Ford', id: 'asdasd'});
            var car = carMapping._new({colour: 'red', name: 'Aston Martin', id: 'asdasd'});
            var relationship = new ForeignKeyRelationship('owner', 'cars', carMapping, personMapping);
            var proxy = new RelatedObjectProxy(relationship, car);
            proxy._id = person._id;
            assert.ok(proxy.isFault());
        });
    });


    describe('one-to-one', function () {

        describe('get', function () {

            describe('forward', function () {
                var proxy, person, car;
                beforeEach(function (done) {
                    person = personMapping._new({name: 'Michael Ford', id: 'asdasd'});
                    Store.put(person, function (err) {
                        if (err) done(err);
                        car = carMapping._new({colour: 'red', name: 'Aston Martin', id: 'asdasd'});
                        var relationship = new OneToOneRelationship('owner', 'car', carMapping, personMapping);
                        proxy = new RelatedObjectProxy(relationship, car);
                        car.owner = proxy;
                        proxy._id = person._id;
                        proxy.get(function (err) {
                            if (err) done(err);
                            done();
                        });
                    });
                });
                it('forward one-to-one should populate related object', function () {
                    var related = proxy.relatedObject;
                    assert.equal(related, person);
                });
            });

            describe('reverse', function () {
                var proxy, person, car;
                beforeEach(function (done) {
                    person = personMapping._new({name: 'Michael Ford', id: 'asdasd'});
                    car = carMapping._new({colour: 'red', name: 'Aston Martin', id: 'asdasd'});
                    Store.put(person, function (err) {
                        if (err) done(err);
                        Store.put(car, function (err) {
                            if (err) done(err);
                            var relationship = new OneToOneRelationship('owner', 'car', carMapping, personMapping);
                            proxy = new RelatedObjectProxy(relationship, person);
                            person.car = proxy;
                            proxy._id = car._id;
                            proxy.get(function (err) {
                                if (err) done(err);
                                done();
                            });
                        });
                    });
                });
                it('reverse one to one should populate related object', function () {
                    var related = proxy.relatedObject;
                    assert.equal(related, car);
                });
            });
        });

        describe('set', function () {
            var car, person;
            beforeEach(function (done) {
                configureAPI(RelationshipType.OneToOne, 'car', function (err) {
                    if (err) done(err);
                    car = carMapping._new({colour: 'red', name: 'Aston Martin', id: 'remoteCarId'});
                    person = personMapping._new({name: 'Michael Ford', age: 23, id: 'remotePersonId'});
                    Store.put(car, function (err) {
                        if (err) done(err);
                        Store.put(person, function (err) {
                            if (err) done(err);
                            done();
                        })
                    });
                });
            });

            describe('none pre-existing', function () {
                it('should set forward', function (done) {
                    car.owner.set(person, function (err) {
                        if (err) done(err);
                        assert.equal(car.owner._id, person._id);
                        assert.equal(car.owner.relatedObject, person);
                        car.owner.get(function (err, related) {
                            if (err) done(err);
                            assert.equal(related, person);
                            done();
                        });
                    })
                });

                it('should set backward', function (done) {
                    car.owner.set(person, function (err) {
                        if (err) done(err);
                        assert.equal(person.car._id, car._id);
                        assert.equal(person.car.relatedObject, car);
                        person.car.get(function (err, related) {
                            if (err) done(err);
                            assert.equal(related, car);
                            done();
                        });
                    });
                });
            });


            describe('pre-existing', function () {
                var anotherPerson;
                beforeEach(function (done) {
                    anotherPerson = personMapping._new({name: 'Robbie Mcdonald', age: 18, id: 'remotePersonId2'});
                    Store.put(anotherPerson, function (err) {
                        if (err) done(err);
                        car.owner.set(person, function (err) {
                            done(err);
                        });
                    });
                });
                it('should set forward', function (done) {
                    car.owner.set(anotherPerson, function (err) {
                        if (err) done(err);
                        assert.equal(car.owner._id, anotherPerson._id);
                        assert.equal(car.owner.relatedObject, anotherPerson);
                        car.owner.get(function (err, related) {
                            if (err) done(err);
                            assert.equal(related, anotherPerson);
                            done();
                        });
                    })
                });

                it('should set backward', function (done) {
                    car.owner.set(anotherPerson, function (err) {
                        if (err) done(err);
                        assert.equal(anotherPerson.car._id, car._id);
                        assert.equal(anotherPerson.car.relatedObject, car);
                        anotherPerson.car.get(function (err, related) {
                            if (err) done(err);
                            assert.equal(related, car);
                            done();
                        });
                    });
                });

                it('should clear the previous persons car', function (done) {
                    car.owner.set(anotherPerson, function (err) {
                        if (err) done(err);
                        assert.notOk(person.car._id);
                        assert.notOk(person.car.relatedObject);
                        done();
                    });
                });


            });
        })

    });


});