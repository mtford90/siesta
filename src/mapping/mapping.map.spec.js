describe('perform mapping', function () {

    var Pouch, RawQuery, Collection, RestError, RelationshipType, RelatedObjectProxy, RestObject, $rootScope;
    var collection, carMapping;

    beforeEach(function () {
        module('restkit.mapping', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });
        module('restkit.relationship', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Index_, _Pouch_, _Indexes_, _RawQuery_, _RestObject_, _Mapping_, _Collection_, _RestError_, _RelationshipType_, _RelatedObjectProxy_, _$rootScope_) {
            Pouch = _Pouch_;
            RawQuery = _RawQuery_;
            Collection = _Collection_;
            RelationshipType = _RelationshipType_;
            RelatedObjectProxy = _RelatedObjectProxy_;
            RestObject = _RestObject_;
            $rootScope = _$rootScope_;
        });

        Pouch.reset();

    });

    describe('no relationships', function () {
        var obj;

        beforeEach(function (done) {
            collection = new Collection('myCollection', function (err, version) {
                if (err) done(err);
                carMapping = collection.registerMapping('Car', {
                    id: 'id',
                    attributes: ['colour', 'name']
                });
            }, function (err) {
                if (err) done(err);
                carMapping.map({colour: 'red', name: 'Aston Martin', id: 'dfadf'}, function (err, _obj) {
                    if (err) {
                        console.error('Error when mapping new car:', err);
                        done(err);
                    }
                    obj = _obj;
                    done();
                });
            });
        });

        describe('new', function () {

            it('returns a restobject', function () {
                assert.instanceOf(obj, RestObject);
            });

            it('has the right fields', function () {
                assert.equal(obj.colour, 'red');
                assert.equal(obj.name, 'Aston Martin');
                assert.equal(obj.id, 'dfadf');
                assert.ok(obj._id);
            });

            it('is placed down to pouch', function (done) {
                var pouchId = obj._id;
                Pouch.getPouch().get(pouchId, function (err, resp) {
                    if (err) done(err);
                    assert.ok(resp);
                    done();
                });
            });
        });

        describe('existing', function () {

            describe('via id', function () {
                var newObj;
                beforeEach(function (done) {
                    carMapping.map({colour: 'blue', id: 'dfadf'}, function (err, obj) {
                        if (err) done(err);
                        newObj = obj;
                        done();
                    });
                });

                it('should be mapped onto the old object', function () {
                    assert.equal(newObj, obj);
                });

                it('should have the new colour', function () {
                    assert.equal(newObj.colour, 'blue');
                });
            });

            describe('via _id', function () {
                var newObj;
                beforeEach(function (done) {
                    carMapping.map({colour: 'blue', _id: obj._id}, function (err, obj) {
                        if (err) done(err);
                        newObj = obj;
                        done();
                    });
                });

                it('should be mapped onto the old object', function () {
                    assert.equal(newObj, obj);
                });

                it('should have the new colour', function () {
                    assert.equal(newObj.colour, 'blue');
                });
            });
        })

    });

    describe('with relationship', function () {

        describe('foreign key', function () {
            var personMapping;
            beforeEach(function (done) {
                collection = new Collection('myCollection', function (err, version) {
                    if (err) done(err);
                    personMapping = collection.registerMapping('Person', {
                        id: 'id',
                        attributes: ['name', 'age']
                    });
                    carMapping = collection.registerMapping('Car', {
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
                }, function (err) {
                    if (err) done(err);
                    done();
                });
            });

            // TODO: DRY up the below.

            describe('remote id', function () {

                describe('forward', function () {
                    describe('object that already exists', function () {
                        var person, car;
                        beforeEach(function (done) {
                            personMapping.map({name: 'Michael Ford', age: 23, id: 'personRemoteId'}, function (err, _person) {
                                if (err) done(err);
                                person = _person;
                                carMapping.map({name: 'Bentley', colour: 'black', owner: 'personRemoteId', id: 'carRemoteId'}, function (err, _car) {
                                    if (err) {
                                        console.error('Error when mapping car object', err);
                                        done(err);
                                    }
                                    car = _car;
                                    done();
                                });
                            });
                        });
                        it('owner of car should be michael', function (done) {
                            $rootScope.$digest(); // Ensure cache gets updated.
                            car.owner.get(function (err, owner) {
                                if (err) done(err);
                                assert.equal(owner, person);
                                done();
                            })
                        });
                        it('michael should the car', function (done) {
                            $rootScope.$digest(); // Ensure cache gets updated.
                            person.cars.get(function (err, cars) {
                                if (err) done(err);
                                assert.include(cars, car);
                                done();
                            });
                        });
                    });

                    describe('remote id of an object that doesnt exist', function () {
                        var car;
                        beforeEach(function (done) {
                            carMapping.map({name: 'Bentley', colour: 'black', owner: 'personRemoteId', id: 'carRemoteId'}, function (err, _car) {
                                console.error('done!!!!!!');
                                if (err) done(err);
                                car = _car;
                                done();
                            });
                        });
                        it('car should have a new owner and new owner should have a car', function (done) {
                            $rootScope.$digest(); // Ensure cache gets updated.
                            car.owner.get(function (err, person) {
                                if (err) done(err);
                                assert.equal(person.id, 'personRemoteId');
                                person.cars.get(function (err, cars) {
                                    if (err) done(err);
                                    assert.equal(cars.length, 1);
                                    assert.include(cars, car);
                                    done();
                                });
                            });
                        })

                    })
                });

                describe('reverse', function () {
                    describe('remoteids of objects that already exist', function () {
                        var person, cars;
                        beforeEach(function (done) {
                            var raw = [
                                {colour: 'red', name: 'Aston Martin', id: 'remoteId1'},
                                {colour: 'blue', name: 'Lambo', id: "remoteId2"},
                                {colour: 'green', name: 'Ford', id: "remoteId3"}
                            ];
                            carMapping._mapBulk(raw, function (err, objs, res) {
                                if (err) {
                                    console.error('Error bulk mapping cars:', err);
                                    done(err);
                                }
                                else {
                                    console.log('Successfully mapped cars');
                                }
                                cars = objs;
                                console.log('Mapping person');
                                personMapping.map({
                                    name: 'Michael Ford',
                                    age: 23,
                                    id: 'personRemoteId',
                                    cars: ['remoteId1', 'remoteId2', 'remoteId3']
                                }, function (err, _person) {
                                    if (err) {
                                        console.error('Error mapping person:', err);
                                        done(err);
                                    }
                                    else {
                                        console.log('Successfully mapped person');
                                    }
                                    person = _person;
                                    done();
                                });
                            });
                        });

                        it('cars should have person as their owner', function () {
                            _.each(cars, function (car) {
                                assert.equal(car.owner._id, person._id);
                            })
                        });

                        it('person should have car objects', function () {
                            dump(person.cars);
                            _.each(cars, function (car) {
                                assert.include(person.cars._id, car._id);
                                assert.include(person.cars.relatedObject, car);
                            })
                        });
                    });

                    describe('remoteids of objects that dont exist', function () {
                        var person;
                        beforeEach(function (done) {
                            personMapping.map({
                                name: 'Michael Ford',
                                age: 23,
                                id: 'personRemoteId',
                                cars: ['remoteId1', 'remoteId2', 'remoteId3']
                            }, function (err, _person) {
                                if (err) done(err);
                                person = _person;
                                done();
                            });
                        });

                        it('person has 3 new cars, and those cars are owned by the person', function (done) {
                            person.cars.get(function (err, cars) {
                                done(err);
                                assert.equal(cars.length, 3);
                                _.each(cars, function (car) {
                                    assert.equal(car.owner._id, person._id);
                                })
                            });
                        })
                    });

                    describe('mixture', function () {
                        var person, cars;
                        beforeEach(function (done) {
                            var raw = [
                                {colour: 'red', name: 'Aston Martin', id: 'remoteId1'},
                                {colour: 'green', name: 'Ford', id: "remoteId3"}
                            ];
                            carMapping._mapBulk(raw, function (err, objs, res) {
                                if (err) done(err);
                                cars = objs;
                                personMapping.map({
                                    name: 'Michael Ford',
                                    age: 23,
                                    id: 'personRemoteId',
                                    cars: ['remoteId1', 'remoteId2', 'remoteId3']
                                }, function (err, _person) {
                                    if (err) done(err);
                                    person = _person;
                                    done();
                                });
                            });
                        });

                        it('cars should have person as their owner', function () {
                            _.each(cars, function (car) {
                                assert.equal(car.owner._id, person._id);
                            })
                        });

                        it('person should have car objects', function () {
                            dump(person.cars);
                            _.each(cars, function (car) {
                                assert.include(person.cars._id, car._id);
                                assert.include(person.cars.relatedObject, car);
                            })
                        });

                        it('person has 3 new cars, and those cars are owned by the person', function (done) {
                            person.cars.get(function (err, cars) {
                                done(err);
                                assert.equal(cars.length, 3);
                                _.each(cars, function (car) {
                                    assert.equal(car.owner._id, person._id);
                                })
                            });
                        })


                    })
                })

            });

            describe('object', function () {

                describe('forward', function () {
                    var person, car;
                    beforeEach(function (done) {
                        personMapping.map({name: 'Michael Ford', age: 23, id: 'personRemoteId'}, function (err, _person) {
                            if (err) done(err);
                            person = _person;
                            carMapping.map({name: 'Bentley', colour: 'black', owner: person, id: 'carRemoteId'}, function (err, _car) {
                                if (err) done(err);
                                car = _car;
                                done();
                            });
                        });
                    });
                    it('owner of car should be michael', function (done) {
                        $rootScope.$digest(); // Ensure cache gets updated.
                        car.owner.get(function (err, owner) {
                            if (err) done(err);
                            assert.equal(owner, person);
                            done();
                        })
                    });
                    it('michael should the car', function (done) {
                        $rootScope.$digest(); // Ensure cache gets updated.
                        person.cars.get(function (err, cars) {
                            if (err) done(err);
                            assert.include(cars, car);
                            done();
                        });
                    });

                });

                describe('reverse', function () {
                    var person, cars;
                    beforeEach(function (done) {
                        var raw = [
                            {colour: 'red', name: 'Aston Martin', id: 'remoteId1'},
                            {colour: 'blue', name: 'Lambo', id: "remoteId2"},
                            {colour: 'green', name: 'Ford', id: "remoteId3"}
                        ];
                        carMapping._mapBulk(raw, function (err, objs, res) {
                            if (err) done(err);
                            cars = objs;
                            personMapping.map({
                                name: 'Michael Ford',
                                age: 23,
                                id: 'personRemoteId',
                                cars: objs
                            }, function (err, _person) {
                                if (err) done(err);
                                person = _person;
                                done();
                            });
                        });
                    });

                    it('cars should have person as their owner', function () {
                        _.each(cars, function (car) {
                            assert.equal(car.owner._id, person._id);
                        })
                    });

                    it('person should have car objects', function () {
                        dump(person.cars);
                        _.each(cars, function (car) {
                            assert.include(person.cars._id, car._id);
                            assert.include(person.cars.relatedObject, car);
                        })
                    });
                })

            });

            describe('local id within object', function () {
                describe('forward', function () {
                    var person, car;
                    beforeEach(function (done) {
                        personMapping.map({name: 'Michael Ford', age: 23, id: 'personRemoteId'}, function (err, _person) {
                            if (err) done(err);
                            person = _person;
                            carMapping.map({name: 'Bentley', colour: 'black', owner: {_id: person._id}, id: 'carRemoteId'}, function (err, _car) {
                                if (err) {
                                    console.error('Error when mapping car object', err);
                                    done(err);
                                }
                                car = _car;
                                done();
                            });
                        });
                    });
                    it('owner of car should be michael', function (done) {
                        $rootScope.$digest(); // Ensure cache gets updated.
                        car.owner.get(function (err, owner) {
                            if (err) done(err);
                            assert.equal(owner, person);
                            done();
                        })
                    });
                    it('michael should the car', function (done) {
                        $rootScope.$digest(); // Ensure cache gets updated.
                        person.cars.get(function (err, cars) {
                            if (err) done(err);
                            assert.include(cars, car);
                            done();
                        });
                    });
                });
                describe('reverse', function () {
                    var person, cars;
                    beforeEach(function (done) {
                        var raw = [
                            {colour: 'red', name: 'Aston Martin', id: 'remoteId1'},
                            {colour: 'blue', name: 'Lambo', id: "remoteId2"},
                            {colour: 'green', name: 'Ford', id: "remoteId3"}
                        ];
                        carMapping._mapBulk(raw, function (err, objs, res) {
                            if (err) {
                                console.error('Error bulk mapping cars:', err);
                                done(err);
                            }
                            else {
                                console.log('Successfully mapped cars');
                            }
                            cars = objs;
                            console.log('Mapping person');
                            personMapping.map({
                                name: 'Michael Ford',
                                age: 23,
                                id: 'personRemoteId',
                                cars: _.map(cars, function (car) {return {_id: car._id}})
                            }, function (err, _person) {
                                if (err) {
                                    console.error('Error mapping person:', err);
                                    done(err);
                                }
                                else {
                                    console.log('Successfully mapped person');
                                }
                                person = _person;
                                done();
                            });
                        });
                    });

                    it('cars should have person as their owner', function () {
                        _.each(cars, function (car) {
                            assert.equal(car.owner._id, person._id);
                        })
                    });

                    it('person should have car objects', function () {
                        dump(person.cars);
                        _.each(cars, function (car) {
                            assert.include(person.cars._id, car._id);
                            assert.include(person.cars.relatedObject, car);
                        })
                    });
                })
            });

            describe('remote id within object', function () {

                describe('forward', function () {
                    describe('object that already exists', function () {
                        var person, car;
                        beforeEach(function (done) {
                            personMapping.map({name: 'Michael Ford', age: 23, id: 'personRemoteId'}, function (err, _person) {
                                if (err) done(err);
                                person = _person;
                                carMapping.map({name: 'Bentley', colour: 'black', owner: {id: 'personRemoteId'}, id: 'carRemoteId'}, function (err, _car) {
                                    if (err) {
                                        console.error('Error when mapping car object', err);
                                        done(err);
                                    }
                                    car = _car;
                                    done();
                                });
                            });
                        });
                        it('owner of car should be michael', function (done) {
                            $rootScope.$digest(); // Ensure cache gets updated.
                            car.owner.get(function (err, owner) {
                                if (err) done(err);
                                assert.equal(owner, person);
                                done();
                            })
                        });
                        it('michael should the car', function (done) {
                            $rootScope.$digest(); // Ensure cache gets updated.
                            person.cars.get(function (err, cars) {
                                if (err) done(err);
                                assert.include(cars, car);
                                done();
                            });
                        });
                    });

                    describe('remote id of an object that doesnt exist', function () {
                        var car;
                        beforeEach(function (done) {
                            carMapping.map({name: 'Bentley', colour: 'black', owner: {id: 'personRemoteId'}, id: 'carRemoteId'}, function (err, _car) {
                                if (err) done(err);
                                car = _car;
                                done();
                            });
                        });
                        it('car should have a new owner and new owner should have a car', function (done) {
                            $rootScope.$digest(); // Ensure cache gets updated.
                            car.owner.get(function (err, person) {
                                if (err) done(err);
                                assert.equal(person.id, 'personRemoteId');
                                person.cars.get(function (err, cars) {
                                    if (err) done(err);
                                    assert.equal(cars.length, 1);
                                    assert.include(cars, car);
                                    done();
                                });
                            });
                        })

                    })
                });

                describe('reverse', function () {
                    describe('remoteids of objects that already exist', function () {
                        var person, cars;
                        beforeEach(function (done) {
                            var raw = [
                                {colour: 'red', name: 'Aston Martin', id: 'remoteId1'},
                                {colour: 'blue', name: 'Lambo', id: "remoteId2"},
                                {colour: 'green', name: 'Ford', id: "remoteId3"}
                            ];
                            carMapping._mapBulk(raw, function (err, objs, res) {
                                if (err) {
                                    console.error('Error bulk mapping cars:', err);
                                    done(err);
                                }
                                else {
                                    console.log('Successfully mapped cars');
                                }
                                cars = objs;
                                console.log('Mapping person');
                                personMapping.map({
                                    name: 'Michael Ford',
                                    age: 23,
                                    id: 'personRemoteId',
                                    cars: [{id: 'remoteId1'}, {id: 'remoteId2'}, {id: 'remoteId3'}]
                                }, function (err, _person) {
                                    if (err) {
                                        console.error('Error mapping person:', err);
                                        done(err);
                                    }
                                    else {
                                        console.log('Successfully mapped person');
                                    }
                                    person = _person;
                                    done();
                                });
                            });
                        });

                        it('cars should have person as their owner', function () {
                            _.each(cars, function (car) {
                                assert.equal(car.owner._id, person._id);
                            })
                        });

                        it('person should have car objects', function () {
                            dump(person.cars);
                            _.each(cars, function (car) {
                                assert.include(person.cars._id, car._id);
                                assert.include(person.cars.relatedObject, car);
                            })
                        });
                    });

                    describe('remoteids of objects that dont exist', function () {
                        var person;
                        beforeEach(function (done) {
                            personMapping.map({
                                name: 'Michael Ford',
                                age: 23,
                                id: 'personRemoteId',
                                cars: [{id: 'remoteId1'}, {id: 'remoteId2'}, {id: 'remoteId3'}]
                            }, function (err, _person) {
                                if (err) done(err);
                                person = _person;
                                done();
                            });
                        });

                        it('person has 3 new cars, and those cars are owned by the person', function (done) {
                            person.cars.get(function (err, cars) {
                                done(err);
                                assert.equal(cars.length, 3);
                                _.each(cars, function (car) {
                                    assert.equal(car.owner._id, person._id);
                                })
                            });
                        })
                    });

                    describe('mixture', function () {
                        var person, cars;
                        beforeEach(function (done) {
                            var raw = [
                                {colour: 'red', name: 'Aston Martin', id: 'remoteId1'},
                                {colour: 'green', name: 'Ford', id: "remoteId3"}
                            ];
                            carMapping._mapBulk(raw, function (err, objs, res) {
                                if (err) done(err);
                                cars = objs;
                                personMapping.map({
                                    name: 'Michael Ford',
                                    age: 23,
                                    id: 'personRemoteId',
                                    cars: [{id: 'remoteId1'}, {id:'remoteId2'}, {id:'remoteId3'}]
                                }, function (err, _person) {
                                    if (err) done(err);
                                    person = _person;
                                    done();
                                });
                            });
                        });

                        it('cars should have person as their owner', function () {
                            _.each(cars, function (car) {
                                assert.equal(car.owner._id, person._id);
                            })
                        });

                        it('person should have car objects', function () {
                            dump(person.cars);
                            _.each(cars, function (car) {
                                assert.include(person.cars._id, car._id);
                                assert.include(person.cars.relatedObject, car);
                            })
                        });

                        it('person has 3 new cars, and those cars are owned by the person', function (done) {
                            person.cars.get(function (err, cars) {
                                done(err);
                                assert.equal(cars.length, 3);
                                _.each(cars, function (car) {
                                    assert.equal(car.owner._id, person._id);
                                })
                            });
                        })


                    })
                })

            });



        });

        describe('one-to-one', function () {
            var personMapping;
            beforeEach(function (done) {
                collection = new Collection('myCollection', function (err, version) {
                    if (err) done(err);
                    personMapping = collection.registerMapping('Person', {
                        id: 'id',
                        attributes: ['name', 'age']
                    });
                    carMapping = collection.registerMapping('Car', {
                        id: 'id',
                        attributes: ['colour', 'name'],
                        relationships: {
                            owner: {
                                mapping: 'Person',
                                type: RelationshipType.OneToOne,
                                reverse: 'car'
                            }
                        }
                    });
                }, function (err) {
                    if (err) done(err);
                    done();
                });
            });

            // TODO: DRY up the below tests.

            describe('remote id', function () {
                describe('forward', function () {
                    describe('object that already exists', function () {
                        var person, car;
                        beforeEach(function (done) {
                            personMapping.map({name: 'Michael Ford', age: 23, id: 'personRemoteId'}, function (err, _person) {
                                if (err) done(err);
                                person = _person;
                                carMapping.map({name: 'Bentley', colour: 'black', id: 'carRemoteId', owner: 'personRemoteId'}, function (err, _car) {
                                    if (err) {
                                        console.error('Error when mapping car object', err);
                                        done(err);
                                    }
                                    car = _car;

                                    done();
                                });
                            });

                        });
                        it('owner of car should be michael', function (done) {
                            $rootScope.$digest(); // Ensure cache gets updated.
                            car.owner.get(function (err, owner) {
                                if (err) done(err);
                                assert.equal(owner, person);
                                done();
                            })
                        });
                        it('michael should own the car', function (done) {
                            $rootScope.$digest(); // Ensure cache gets updated.
                            person.car.get(function (err, personsCar) {
                                if (err) done(err);
                                assert.equal(car, personsCar);
                                done();
                            });
                        });
                    });

                    describe('remote id of an object that doesnt exist', function () {
                        var car;
                        beforeEach(function (done) {
                            carMapping.map({name: 'Bentley', colour: 'black', owner: 'personRemoteId', id: 'carRemoteId'}, function (err, _car) {
                                if (err) done(err);
                                car = _car;
                                done();
                            });
                        });
                        it('car should have a new owner and new owner should have a car', function (done) {
                            $rootScope.$digest(); // Ensure cache gets updated.
                            car.owner.get(function (err, person) {
                                if (err) done(err);
                                assert.equal(person.id, 'personRemoteId');
                                person.car.get(function (err, personsCar) {
                                    if (err) done(err);
                                    assert.equal(personsCar, car);
                                    done();
                                });
                            });
                        })

                    })
                });
                describe('reverse', function () {
                    describe('object that already exists', function () {
                        var person, car;
                        beforeEach(function (done) {
                            carMapping.map({name: 'Bentley', colour: 'black', id: 'carRemoteId'}, function (err, _car) {
                                if (err) {
                                    console.error('Error when mapping car object', err);
                                    done(err);
                                }
                                car = _car;
                                personMapping.map({name: 'Michael Ford', age: 23, car: 'carRemoteId', id: 'personRemoteId'}, function (err, _person) {
                                    if (err) done(err);
                                    person = _person;
                                    done();
                                });
                            });
                        });
                        it('owner of car should be michael', function (done) {
                            $rootScope.$digest(); // Ensure cache gets updated.
                            car.owner.get(function (err, owner) {
                                if (err) done(err);
                                assert.equal(owner, person);
                                done();
                            })
                        });
                        it('michael should own the car', function (done) {
                            $rootScope.$digest(); // Ensure cache gets updated.
                            person.car.get(function (err, personsCar) {
                                if (err) done(err);
                                assert.equal(car, personsCar);
                                done();
                            });
                        });
                    });

                    describe('remote id of an object that doesnt exist', function () {
                        var car;
                        beforeEach(function (done) {
                            carMapping.map({name: 'Bentley', colour: 'black', owner: 'personRemoteId', id: 'carRemoteId'}, function (err, _car) {
                                if (err) done(err);
                                car = _car;
                                done();
                            });
                        });
                        it('car should have a new owner and new owner should have a car', function (done) {
                            $rootScope.$digest(); // Ensure cache gets updated.
                            car.owner.get(function (err, person) {
                                if (err) done(err);
                                assert.equal(person.id, 'personRemoteId');
                                person.car.get(function (err, personsCar) {
                                    if (err) done(err);
                                    assert.equal(personsCar, car);
                                    done();
                                });
                            });
                        })

                    })
                });
            });

            describe('remote id within object', function () {
                describe('forward', function () {
                    describe('object that already exists', function () {
                        var person, car;
                        beforeEach(function (done) {
                            personMapping.map({name: 'Michael Ford', age: 23, id: 'personRemoteId'}, function (err, _person) {
                                if (err) done(err);
                                person = _person;
                                carMapping.map({name: 'Bentley', colour: 'black', id: 'carRemoteId', owner: {id: 'personRemoteId'}}, function (err, _car) {
                                    if (err) {
                                        console.error('Error when mapping car object', err);
                                        done(err);
                                    }
                                    car = _car;

                                    done();
                                });
                            });
                        });
                        it('owner of car should be michael', function (done) {
                            $rootScope.$digest(); // Ensure cache gets updated.
                            car.owner.get(function (err, owner) {
                                if (err) done(err);
                                assert.equal(owner, person);
                                done();
                            })
                        });
                        it('michael should own the car', function (done) {
                            $rootScope.$digest(); // Ensure cache gets updated.
                            person.car.get(function (err, personsCar) {
                                if (err) done(err);
                                assert.equal(car, personsCar);
                                done();
                            });
                        });
                    });

                    describe('remote id of an object that doesnt exist', function () {
                        var car;
                        beforeEach(function (done) {
                            carMapping.map({name: 'Bentley', colour: 'black', owner: {id: 'personRemoteId'}, id: 'carRemoteId'}, function (err, _car) {
                                if (err) done(err);
                                car = _car;
                                done();
                            });
                        });
                        it('car should have a new owner and new owner should have a car', function (done) {
                            $rootScope.$digest(); // Ensure cache gets updated.
                            car.owner.get(function (err, person) {
                                if (err) done(err);
                                assert.equal(person.id, 'personRemoteId');
                                person.car.get(function (err, personsCar) {
                                    if (err) done(err);
                                    assert.equal(personsCar, car);
                                    done();
                                });
                            });
                        })

                    })
                });
                describe('reverse', function () {
                    describe('object that already exists', function () {
                        var person, car;
                        beforeEach(function (done) {
                            carMapping.map({name: 'Bentley', colour: 'black', id: 'carRemoteId'}, function (err, _car) {
                                if (err) {
                                    console.error('Error when mapping car object', err);
                                    done(err);
                                }
                                car = _car;
                                personMapping.map({name: 'Michael Ford', age: 23, car: {id: 'carRemoteId'}, id: 'personRemoteId'}, function (err, _person) {
                                    if (err) done(err);
                                    person = _person;
                                    done();
                                });
                            });
                        });
                        it('owner of car should be michael', function (done) {
                            $rootScope.$digest(); // Ensure cache gets updated.
                            car.owner.get(function (err, owner) {
                                if (err) done(err);
                                assert.equal(owner, person);
                                done();
                            })
                        });
                        it('michael should own the car', function (done) {
                            $rootScope.$digest(); // Ensure cache gets updated.
                            person.car.get(function (err, personsCar) {
                                if (err) done(err);
                                assert.equal(car, personsCar);
                                done();
                            });
                        });
                    });

                    describe('remote id of an object that doesnt exist', function () {
                        var car;
                        beforeEach(function (done) {
                            carMapping.map({name: 'Bentley', colour: 'black', owner: {id: 'personRemoteId'}, id: 'carRemoteId'}, function (err, _car) {
                                if (err) done(err);
                                car = _car;
                                done();
                            });
                        });
                        it('car should have a new owner and new owner should have a car', function (done) {
                            $rootScope.$digest(); // Ensure cache gets updated.
                            car.owner.get(function (err, person) {
                                if (err) done(err);
                                assert.equal(person.id, 'personRemoteId');
                                person.car.get(function (err, personsCar) {
                                    if (err) done(err);
                                    assert.equal(personsCar, car);
                                    done();
                                });
                            });
                        })

                    })
                });
            });

            describe('_id within object', function () {
                describe('forward', function () {
                    var person, car;
                    beforeEach(function (done) {
                        personMapping.map({name: 'Michael Ford', age: 23, id: 'personRemoteId'}, function (err, _person) {
                            if (err) done(err);
                            person = _person;
                            carMapping.map({name: 'Bentley', colour: 'black', id: 'carRemoteId', owner: {_id: person._id}}, function (err, _car) {
                                if (err) {
                                    console.error('Error when mapping car object', err);
                                    done(err);
                                }
                                car = _car;

                                done();
                            });
                        });
                    });
                    it('owner of car should be michael', function (done) {
                        $rootScope.$digest(); // Ensure cache gets updated.
                        car.owner.get(function (err, owner) {
                            if (err) done(err);
                            assert.equal(owner, person);
                            done();
                        })
                    });
                    it('michael should own the car', function (done) {
                        $rootScope.$digest(); // Ensure cache gets updated.
                        person.car.get(function (err, personsCar) {
                            if (err) done(err);
                            assert.equal(car, personsCar);
                            done();
                        });
                    });
                });
                describe('reverse', function () {
                    var person, car;
                    beforeEach(function (done) {
                        carMapping.map({name: 'Bentley', colour: 'black', id: 'carRemoteId'}, function (err, _car) {
                            if (err) {
                                console.error('Error when mapping car object', err);
                                done(err);
                            }
                            car = _car;
                            personMapping.map({name: 'Michael Ford', age: 23, car: {_id: car._id}, id: 'personRemoteId'}, function (err, _person) {
                                if (err) done(err);
                                person = _person;
                                done();
                            });
                        });
                    });
                    it('owner of car should be michael', function (done) {
                        $rootScope.$digest(); // Ensure cache gets updated.
                        car.owner.get(function (err, owner) {
                            if (err) done(err);
                            assert.equal(owner, person);
                            done();
                        })
                    });
                    it('michael should own the car', function (done) {
                        $rootScope.$digest(); // Ensure cache gets updated.
                        person.car.get(function (err, personsCar) {
                            if (err) done(err);
                            assert.equal(car, personsCar);
                            done();
                        });
                    });

                });
            });

            describe('object', function () {
                describe('forward', function () {
                    var person, car;
                    beforeEach(function (done) {
                        personMapping.map({name: 'Michael Ford', age: 23, id: 'personRemoteId'}, function (err, _person) {
                            if (err) done(err);
                            person = _person;
                            carMapping.map({name: 'Bentley', colour: 'black', id: 'carRemoteId', owner: person}, function (err, _car) {
                                if (err) {
                                    console.error('Error when mapping car object', err);
                                    done(err);
                                }
                                car = _car;

                                done();
                            });
                        });
                    });
                    it('owner of car should be michael', function (done) {
                        $rootScope.$digest(); // Ensure cache gets updated.
                        car.owner.get(function (err, owner) {
                            if (err) done(err);
                            assert.equal(owner, person);
                            done();
                        })
                    });
                    it('michael should own the car', function (done) {
                        $rootScope.$digest(); // Ensure cache gets updated.
                        person.car.get(function (err, personsCar) {
                            if (err) done(err);
                            assert.equal(car, personsCar);
                            done();
                        });
                    });
                });
                describe('reverse', function () {
                    var person, car;
                    beforeEach(function (done) {
                        carMapping.map({name: 'Bentley', colour: 'black', id: 'carRemoteId'}, function (err, _car) {
                            if (err) {
                                console.error('Error when mapping car object', err);
                                done(err);
                            }
                            car = _car;
                            personMapping.map({name: 'Michael Ford', age: 23, car: car, id: 'personRemoteId'}, function (err, _person) {
                                if (err) done(err);
                                person = _person;
                                done();
                            });
                        });
                    });
                    it('owner of car should be michael', function (done) {
                        $rootScope.$digest(); // Ensure cache gets updated.
                        car.owner.get(function (err, owner) {
                            if (err) done(err);
                            assert.equal(owner, person);
                            done();
                        })
                    });
                    it('michael should own the car', function (done) {
                        $rootScope.$digest(); // Ensure cache gets updated.
                        person.car.get(function (err, personsCar) {
                            if (err) done(err);
                            assert.equal(car, personsCar);
                            done();
                        });
                    });

                });
            });

        })

    });

    describe('errors', function () {

        describe('one-to-one', function () {

            var personMapping;
            beforeEach(function (done) {
                collection = new Collection('myCollection', function (err, version) {
                    if (err) done(err);
                    personMapping = collection.registerMapping('Person', {
                        id: 'id',
                        attributes: ['name', 'age']
                    });
                    carMapping = collection.registerMapping('Car', {
                        id: 'id',
                        attributes: ['colour', 'name'],
                        relationships: {
                            owner: {
                                mapping: 'Person',
                                type: RelationshipType.OneToOne,
                                reverse: 'car'
                            }
                        }
                    });
                }, function (err) {
                    if (err) done(err);
                    done();
                });
            });

            it('assign array to scalar relationship', function (done) {
                carMapping.map({
                    colour: 'red',
                    name: 'Aston Martin',
                    owner: ['remoteId1', 'remoteId2'],
                    id:'carRemoteId'
                }, function (err, obj) {
                    dump(err.owner.context);
                    var ownerError = err.owner;
                    assert.ok(ownerError);
                    done();
                });
            });

            it('assign array to scalar relationship reverse', function (done) {
                personMapping.map({
                    name: 'Michael Ford',
                    car: ['remoteId1', 'remoteId2'],
                    age: 23,
                    id:'personRemoteId'
                }, function (err, obj) {
                    dump(err, obj);
                    assert.ok(err.car);
                    done();
                });
            });



        });
        describe('foreign key', function () {

            var personMapping;
            beforeEach(function (done) {
                collection = new Collection('myCollection', function (err, version) {
                    if (err) done(err);
                    personMapping = collection.registerMapping('Person', {
                        id: 'id',
                        attributes: ['name', 'age']
                    });
                    carMapping = collection.registerMapping('Car', {
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
                }, function (err) {
                    if (err) done(err);
                    done();
                });
            });

            it('assign array to scalar relationship', function (done) {
                carMapping.map({
                    colour: 'red',
                    name: 'Aston Martin',
                    owner: ['remoteId1', 'remoteId2'],
                    id:'carRemoteId'
                }, function (err, obj) {
                    dump(err.owner.context);
                    var ownerError = err.owner;
                    assert.ok(ownerError);
                    done();
                });
            });

            it('assign scalar to vector relationship reverse', function (done) {
                personMapping.map({
                    name: 'Michael Ford',
                    cars: 'remoteId1',
                    age: 23,
                    id:'personRemoteId'
                }, function (err, obj) {
                    dump(err, obj);
                    assert.ok(err.cars);
                    done();
                });
            });



        });

    });

    describe('bulk', function () {

        it('should redirect arrays to _mapBulk when passed to map', function (done) {
            var raw = [
                {colour: 'red', name: 'Aston Martin', id: 'remoteId1'},
                {colour: 'blue', name: 'Lambo', id: "remoteId2"},
                {colour: 'green', name: 'Ford', id: "remoteId3"}
            ];
            sinon.stub(carMapping, '_mapBulk', function (_, callback) {
                callback();
            });
            carMapping.map(raw, function () {
                sinon.assert.calledWith(carMapping._mapBulk, raw);
                done();
            })
        });

        describe('new', function () {

            describe('no relationships', function () {
                beforeEach(function (done) {
                    collection = new Collection('myCollection', function (err, version) {
                        if (err) done(err);
                        carMapping = collection.registerMapping('Car', {
                            id: 'id',
                            attributes: ['colour', 'name']
                        });
                    }, function (err) {
                        done(err);
                    });
                });

                it('all valid', function (done) {
                    var raw = [
                        {colour: 'red', name: 'Aston Martin', id: 'remoteId1'},
                        {colour: 'blue', name: 'Lambo', id: "remoteId2"},
                        {colour: 'green', name: 'Ford', id: "remoteId3"}
                    ];
                    carMapping._mapBulk(raw, function (err, objs, res) {
                        dump(res);
                        assert.notOk(err);
                        assert.equal(objs.length, raw.length);
                        assert.equal(res.length, raw.length);
                        _.each(res, function (r) {
                            assert.notOk(r.err);
                            assert.ok(r.obj);
                        });
                        _.each(objs, function (o) {
                            assert.include(_.pluck(res, 'obj'), o);
                        });
                        _.each(raw, function (r) {
                            assert.include(_.pluck(res, 'raw'), r);
                        });
                        done();
                    })
                });
            });

            describe('foreign key', function () {
                var personMapping;

                beforeEach(function (done) {
                    collection = new Collection('myCollection', function (err, version) {
                        if (err) done(err);
                        personMapping = collection.registerMapping('Person', {
                            id: 'id',
                            attributes: ['name', 'age']
                        });
                        carMapping = collection.registerMapping('Car', {
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
                    }, function (err) {
                        done(err);
                    });
                });

                it('same owner using _mapBulk', function (done) {
                    var raw = [
                        {colour: 'red', name: 'Aston Martin', id: 'remoteId1', owner:'ownerId'},
                        {colour: 'blue', name: 'Lambo', id: "remoteId2", owner:'ownerId'},
                        {colour: 'green', name: 'Ford', id: "remoteId3", owner:'ownerId'}
                    ];
                    carMapping._mapBulk(raw, function (err, objs, res) {
                        if (err) done(err);
                        assert.notOk(err);
                        assert.equal(objs.length, raw.length);
                        assert.equal(res.length, raw.length);
                        _.each(res, function (r) {
                            assert.notOk(r.err);
                            assert.ok(r.obj);
                        });
                        _.each(objs, function (o) {
                            assert.include(_.pluck(res, 'obj'), o);
                        });
                        _.each(raw, function (r) {
                            assert.include(_.pluck(res, 'raw'), r);
                        });
                        var ownerIdentifiers = _.map(objs, function (o) {
                            return o.owner._id;
                        });
                        Array.prototype.getUnique = function(){
                            var u = {}, a = [];
                            for(var i = 0, l = this.length; i < l; ++i){
                                if(u.hasOwnProperty(this[i])) {
                                    continue;
                                }
                                a.push(this[i]);
                                u[this[i]] = 1;
                            }
                            return a;
                        };
                        assert.equal(ownerIdentifiers.getUnique().length, 1);
                        dump(ownerIdentifiers);
                        done();
                    })
                });

                it('same owner using map', function (done) {
                    var carRaw1 = {colour: 'red', name: 'Aston Martin', id: 'remoteId1', owner:'ownerId'};
                    var carRaw2 = {colour: 'blue', name: 'Lambo', id: "remoteId2", owner:'ownerId'};
                    carMapping.map(carRaw1, function (err, car1) {
                        if (err) done (err);
                         carMapping.map(carRaw2, function (err, car2) {
                             if (err) done (err);
                             assert.equal(car1.owner._id, car2.owner._id);
                             assert.equal(car1.owner.relatedObject, car2.owner.relatedObject);
                             done();
                         })
                    });
                })



            })




        });

    });

});
