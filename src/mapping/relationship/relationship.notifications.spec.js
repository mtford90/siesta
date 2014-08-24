describe('relationship notifications', function () {

    var Pouch, RawQuery, RestAPI, RelationshipType, RelatedObjectProxy, $rootScope, Store, ChangeType;
    var api, carMapping, personMapping;
    var car, person, carNotif, personNotif;

    function setupModules() {
        module('restkit.mapping', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });
        module('restkit.relationship', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });
        inject(function (_Pouch_, _RawQuery_, _RestAPI_, _RelationshipType_, _RelatedObjectProxy_, _$rootScope_, _Store_, _ChangeType_) {
            Pouch = _Pouch_;
            RawQuery = _RawQuery_;
            RestAPI = _RestAPI_;
            RelationshipType = _RelationshipType_;
            RelatedObjectProxy = _RelatedObjectProxy_;
            $rootScope = _$rootScope_;
            Store = _Store_;
            ChangeType = _ChangeType_;
        });
        Pouch.reset();
    }

    function setupFixtures(relationshipType, reverseName, done) {
        api = new RestAPI('myApi', function (err) {
            if (err) done(err);

            carMapping = api.registerMapping('Car', {
                id: 'id',
                attributes: ['colour', 'name'],
                relationships: {
                    owner: {
                        mapping: 'Person',
                        type: relationshipType,
                        reverse: reverseName
                    }
                }
            });
            personMapping = api.registerMapping('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });
        }, function (err) {
            if (err) done(err);
            car = carMapping._new({colour: 'red', name: 'Aston Martin', id: 'xyz'});
            Store.put(car, function (err) {
                if (err) done(err);
                person = personMapping._new({name: 'Michael Ford', age: 23, id: '12312312'});
                Store.put(person, function (err) {
                    if (err) done(err);
                    $rootScope.$on('myApi:Car', function (e, n) {
                        carNotif = n;
                        if (carNotif && personNotif) {
                            done();
                        }
                    });
                    $rootScope.$on('myApi:Person', function (e, n) {
                        personNotif = n;
                        if (carNotif && personNotif) {
                            done();
                        }
                    });
                    car.owner.set(person, function (err) {
                        if (err) done(err);
                        $rootScope.$digest();
                    });
                });
            });
        });
    }


    describe('OneToOne', function () {

        beforeEach(function (done) {
            setupModules();
            setupFixtures(RelationshipType.OneToOne, 'car', done);
        });

        describe('forward notif', function () {
            it('has type', function () {
                assert.equal(carNotif.type, 'Car');
            });

            it('has api', function () {
                assert.equal(carNotif.api, 'myApi');
            });

            it('has change type', function () {
                assert.equal(carNotif.change.type, ChangeType.Set);
            });

            it('has no old', function () {
                assert.notOk(carNotif.change.old);
            });

            it('has new', function () {
                assert.equal(carNotif.change.new, person);
            });
        });

        describe('reverse notif', function () {
            it('has type', function () {
                assert.equal(personNotif.type, 'Person');
            });

            it('has api', function () {
                assert.equal(personNotif.api, 'myApi');
            });

            it('has change type', function () {
                assert.equal(personNotif.change.type, ChangeType.Set);
            });

            it('has no old', function () {
                assert.notOk(personNotif.change.old);
            });

            it('has new', function () {
                assert.equal(personNotif.change.new, car);
            });
        });

    });

    describe('ForeignKey', function () {

        beforeEach(function (done) {
            setupModules();
            setupFixtures(RelationshipType.ForeignKey, 'cars', done);
        });


        describe('add starting from null', function () {
            describe('forward notif', function () {
                it('has type', function () {
                    assert.equal(carNotif.type, 'Car');
                });

                it('has api', function () {
                    assert.equal(carNotif.api, 'myApi');
                });

                it('has change type', function () {
                    assert.equal(carNotif.change.type, ChangeType.Set);
                });

                it('has no old', function () {
                    assert.notOk(carNotif.change.old);
                });

                it('has new', function () {
                    assert.equal(carNotif.change.new, person);
                });
            });

            describe('reverse notif', function () {
                it('has type', function () {
                    assert.equal(personNotif.type, 'Person');
                });

                it('has api', function () {
                    assert.equal(personNotif.api, 'myApi');
                });

                it('has change type', function () {
                    assert.equal(personNotif.change.type, ChangeType.Insert);
                });

                it('has new', function () {
                    assert.equal(personNotif.change.new, car);
                });

                it('has index', function () {
                    assert.equal(personNotif.change.index, 0);
                });
            });
        });

        describe('set forward foreign key having already set', function () {
            var anotherCar, anotherPerson;
            var anotherCarNotif, anotherPersonNotifInsert, personNotifRemove;

            beforeEach(function (done) {
                anotherCar = carMapping._new({name: 'Lambo', id: 'asq34asdasd', colour: 'yellow'});
                anotherPerson = personMapping._new({name: 'Robert Manning', id: 'asq34asdasd', age: 52});
                Store.put(anotherCar, function (err) {
                    if (err) done(err);
                    Store.put(anotherPerson, function (err) {
                        if (err) done(err);
                        $rootScope.$on('myApi:Car', function (e, n) {
                            anotherCarNotif = n;
                            if (anotherCarNotif && anotherPersonNotifInsert && personNotifRemove) {
                                done();
                            }
                        });
                        $rootScope.$on('myApi:Person', function (e, n) {
                            dump(n);
                            if (n.change.type == ChangeType.Insert) {
                                anotherPersonNotifInsert = n;
                            }
                            else if (n.change.type == ChangeType.Remove) {
                                personNotifRemove = n;
                            }
                            if (anotherCarNotif && anotherPersonNotifInsert && personNotifRemove) {
                                done();
                            }
                        });
                        car.owner.set(anotherPerson, function (err) {
                            if (err) done(err);
                            $rootScope.$digest();
                        });
                    });
                });
            });

            describe('forward notif', function () {
                it('has type', function () {
                    assert.equal(anotherCarNotif.type, 'Car');
                });

                it('has api', function () {
                    assert.equal(anotherCarNotif.api, 'myApi');
                });

                it('has change type', function () {
                    assert.equal(anotherCarNotif.change.type, ChangeType.Set);
                });

                it('has old', function () {
                    assert.equal(anotherCarNotif.change.old, person);
                });

                it('has new', function () {
                    assert.equal(anotherCarNotif.change.new, anotherPerson);
                });
            });

            describe('reverse notif insert', function () {
                it('has type', function () {
                    assert.equal(anotherPersonNotifInsert.type, 'Person');
                });

                it('has api', function () {
                    assert.equal(anotherPersonNotifInsert.api, 'myApi');
                });

                it('has change type', function () {
                    assert.equal(anotherPersonNotifInsert.change.type, ChangeType.Insert);
                });

                it('has new', function () {
                    assert.equal(anotherPersonNotifInsert.change.new, car);
                });

                it('has index', function () {
                    assert.equal(anotherPersonNotifInsert.change.index, 0);
                });
            });

            describe('reverse notif removal', function () {
                it('has type', function () {
                    assert.equal(personNotifRemove.type, 'Person');
                });

                it('has api', function () {
                    assert.equal(personNotifRemove.api, 'myApi');
                });

                it('has change type', function () {
                    assert.equal(personNotifRemove.change.type, ChangeType.Remove);
                });

                it('has old', function () {
                    assert.equal(personNotifRemove.change.old, car);
                });

                it('has index', function () {
                    assert.equal(personNotifRemove.change.index, 0);
                });
            });
        });


    });


});