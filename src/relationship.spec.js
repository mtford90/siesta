describe('relationship', function () {

    var Store, RestAPI, RestError, Mapping, ForeignKeyRelationship, RestObject, cache, OneToOneRelationship, ManyToManyRelationship, RelationshipType, RelatedObjectProxy;

    beforeEach(function () {
        module('restkit.relationship', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });
        module('restkit.mapping', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Store_, _RestError_, _RelatedObjectProxy_, _RelationshipType_, _RestAPI_, _Mapping_, _ForeignKeyRelationship_, _OneToOneRelationship_, _RestObject_, _cache_, _ManyToManyRelationship_) {
            RestAPI = _RestAPI_;
            Mapping = _Mapping_;
            ForeignKeyRelationship = _ForeignKeyRelationship_;
            OneToOneRelationship = _OneToOneRelationship_;
            ManyToManyRelationship = _ManyToManyRelationship_;
            RestObject = _RestObject_;
            cache = _cache_;
            RelationshipType = _RelationshipType_;
            RelatedObjectProxy = _RelatedObjectProxy_;
            RestError = _RestError_;
            Store = _Store_;
        });

        RestAPI._reset();
    });

    describe('contributions', function () {
        var api, carMapping, personMapping, dogMapping;

        beforeEach(function (done) {
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
                dogMapping = api.registerMapping('Dog', {
                    id: 'id',
                    attributes: ['name', 'age', 'breed']
                });
            }, function (err) {
                done(err);
            });
        });

        describe('contributions', function () {
            it('should contribute to an object belonging to the forward mapping', function () {
                var obj = carMapping._new({colour: 'red', name: 'Aston Martin', id: 'asdasd'});
                var relationship = new ForeignKeyRelationship('owner', 'cars', carMapping, personMapping);
                relationship.contributeToRestObject(obj);
                assert.instanceOf(obj.owner, RelatedObjectProxy);
            });
            it('should contribute to an object belonging to a reverse mapping', function () {
                var obj = personMapping._new({name: 'Michael Ford', id: 'asdasd'});
                var relationship = new ForeignKeyRelationship('owner', 'cars', carMapping, personMapping);
                relationship.contributeToRestObject(obj);
                assert.instanceOf(obj.cars, RelatedObjectProxy);
            });
            it('should throw an error if relationship has ', function () {
                var obj = dogMapping._new({name: 'Woody', id: 'asdasd', age: 2, breed: 'Chinese Crested'});
                var relationship = new ForeignKeyRelationship('owner', 'cars', carMapping, personMapping);
                assert.throws(_.bind(relationship.contributeToRestObject, relationship, obj), RestError);
            })
        });


    });

    describe('RelatedObjectProxy', function () {

        var api, carMapping, personMapping;

        beforeEach(function (done) {
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

        describe('get', function () {
            describe('get foreign key', function () {
                describe('forward', function () {
                    var proxy, person, car;
                    beforeEach(function (done) {
                        person = personMapping._new({name: 'Michael Ford', id: 'asdasd'});
                        Store.put(person, function (err) {
                            if (err) done(err);
                            car = carMapping._new({colour: 'red', name: 'Aston Martin', id: 'asdasd'});
                            var relationship = new ForeignKeyRelationship('owner', 'cars', carMapping, personMapping);
                            proxy = new RelatedObjectProxy(relationship, car);
                            car.owner = proxy;
                            proxy._id = person._id;
                            proxy.get(function (err) {
                                if (err) done(err);
                                done();
                            });
                        });
                    });
                    it('forward foreign key should populate related object', function () {
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
                                var relationship = new ForeignKeyRelationship('owner', 'cars', carMapping, personMapping);
                                proxy = new RelatedObjectProxy(relationship, person);
                                person.cars = proxy;
                                proxy._id = [car._id];
                                proxy.get(function (err) {
                                    if (err) done(err);
                                    done();
                                });
                            });
                        });
                    });
                    it('reverse foreign key should populate related object', function () {
                        var related = proxy.relatedObject;
                        assert.include(related, car);
                    });
                });

            });

            describe('get one to one', function () {

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
        });

        describe('set relationship', function () {
            var api, carMapping, personMapping;
            var car, person;

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

            describe('foreign key', function () {
                beforeEach(function (done) {
                    configureAPI(RelationshipType.ForeignKey, 'cars', function (err) {
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
                            assert.include(person.cars._id, car._id);
                            assert.include(person.cars.relatedObject, car);
                            person.cars.get(function (err, related) {
                                if (err) done(err);
                                assert.include(related, car);
                                done();
                            });
                        });
                    });
                });

                describe('pre-existing', function () {
                    // TODO
                });


            });

//            describe('one-to-one', function () {
//                beforeEach(function (done) {
//                    configureAPI(RelationshipType.OneToOne, 'car', function (err) {
//                        if (err) done(err);
//                        car = carMapping._new({colour: 'red', name: 'Aston Martin', id: 'remoteCarId'});
//                        person = personMapping._new({name: 'Michael Ford', age: 23, id: 'remotePersonId'});
//                        Store.put(car, function (err) {
//                            if (err) done(err);
//                            Store.put(person, function (err) {
//                                if (err) done(err);
//                                done();
//                            })
//                        });
//                    });
//                });
//
//                describe('none pre-existing', function () {
//                    it('should set forward', function (done) {
//                        car.owner.set(person, function (err) {
//                            if (err) done(err);
//                            assert.equal(car.owner._id, person._id);
//                            assert.equal(car.owner.relatedObject, person);
//                            car.owner.get(function (err, related) {
//                                if (err) done(err);
//                                assert.equal(related, person);
//                                done();
//                            });
//                        })
//                    });
//
//                    it('should set backward', function (done) {
//                        car.owner.set(person, function (err) {
//                            if (err) done(err);
//                            assert.include(person.cars._id, car._id);
//                            assert.include(person.cars.relatedObject, car);
//                            person.car.get(function (err, related) {
//                                if (err) done(err);
//                                assert.equal(related, car);
//                                done();
//                            });
//                        });
//                    });
//
//                });
//
//
//            });


        });

    });

    describe('get related', function () {

        describe('ForeignKey', function () {
            var carMapping, personMapping;
            beforeEach(function (done) {
                carMapping = new Mapping({
                    type: 'Car',
                    id: 'id',
                    attributes: ['colour', 'name'],
                    api: 'myApi'
                });
                personMapping = new Mapping({
                    type: 'Person',
                    id: 'id',
                    attributes: ['name', 'age'],
                    api: 'myApi'
                });
                carMapping.install(function (err) {
                    if (err) done(err);
                    personMapping.install(done);
                });
            });

            it('forward', function (done) {
                var r = new ForeignKeyRelationship('owner', 'cars', carMapping, personMapping);
                var car = new RestObject(carMapping);
                var proxy = new RelatedObjectProxy(r, car);
                proxy._id = 'xyz123';
                car.owner = proxy;
                var person = new RestObject(personMapping);
                person._id = car.owner._id;
                cache.insert(person);
                r.getRelated(car, function (err, related) {
                    done(err);
                    assert.equal(person, related);
                });
            });

            it('reverse', function (done) {
                var r = new ForeignKeyRelationship('owner', 'cars', carMapping, personMapping);
                var car = new RestObject(carMapping);
                car._id = 'xyz123';
                var proxy = new RelatedObjectProxy(r, car);
                proxy._id = ['xyz123'];
                var person = new RestObject(personMapping);
                person.cars = proxy;
                cache.insert(person);
                cache.insert(car);
                r.getRelated(person, function (err, related) {
                    done(err);
                    assert.include(related, car);
                });
            });

        });


        describe('OneToOne', function () {
            var carMapping, personMapping;
            beforeEach(function (done) {
                carMapping = new Mapping({
                    type: 'Car',
                    id: 'id',
                    attributes: ['colour', 'name'],
                    api: 'myApi'
                });
                personMapping = new Mapping({
                    type: 'Person',
                    id: 'id',
                    attributes: ['name', 'age'],
                    api: 'myApi'
                });
                carMapping.install(function (err) {
                    if (err) done(err);
                    personMapping.install(done);
                });
            });

            it('forward', function (done) {
                var r = new OneToOneRelationship('owner', 'car', carMapping, personMapping);
                var car = new RestObject(carMapping);
                var proxy = new RelatedObjectProxy(r, car);
                proxy._id = 'xyz123';
                car.owner = proxy;
                var person = new RestObject(personMapping);
                person._id = car.owner._id;
                cache.insert(person);
                r.getRelated(car, function (err, related) {
                    done(err);
                    assert.equal(person, related);
                });
            });

            it('reverse', function (done) {
                var r = new OneToOneRelationship('owner', 'car', carMapping, personMapping);
                var car = new RestObject(carMapping);
                car._id = 'xyz123';
                var proxy = new RelatedObjectProxy(r, car);
                proxy._id = 'xyz123';
                var person = new RestObject(personMapping);
                person.car = proxy;
                cache.insert(person);
                cache.insert(car);
                r.getRelated(person, function (err, related) {
                    done(err);
                    assert.equal(car, related);
                });
            });

        });

//        describe('ManyToMany', function () {
//            var carMapping, personMapping;
//            beforeEach(function (done) {
//                carMapping = new Mapping({
//                    type: 'Car',
//                    id: 'id',
//                    attributes: ['colour', 'name'],
//                    api: 'myApi'
//                });
//                personMapping = new Mapping({
//                    type: 'Person',
//                    id: 'id',
//                    attributes: ['name', 'age'],
//                    api: 'myApi'
//                });
//                carMapping.install(function (err) {
//                    if (err) done(err);
//                    personMapping.install(done);
//                });
//            });
//
//            it('local id', function (done) {
//                var r = new ManyToManyRelationship('owners', 'cars', carMapping, personMapping);
//                var car = new RestObject(carMapping);
//                car.owners = ['4234sdfsdf', '5245tdfd'];
//                var person1 = new RestObject(personMapping);
//                var person2 = new RestObject(personMapping);
//                person1._id = car.owners[0];
//                person2._id = car.owners[1];
//                cache.insert(person1);
//                cache.insert(person2);
//                r.getRelated(car, function (err, related) {
//                    done(err);
//                    assert.include(related, person1);
//                    assert.include(related, person2);
//                });
//            });
//
//
//        });
    });

});