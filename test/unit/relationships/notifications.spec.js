describe('relationship notifications', function () {

    var Pouch, RawQuery, Collection, RelationshipType, RelatedObjectProxy, $rootScope, Store, ChangeType;
    var collection, carMapping, personMapping;
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
        inject(function (_Pouch_, _RawQuery_, _Collection_, _RelationshipType_, _RelatedObjectProxy_, _$rootScope_, _Store_, _ChangeType_) {
            Pouch = _Pouch_;
            RawQuery = _RawQuery_;
            Collection = _Collection_;
            RelationshipType = _RelationshipType_;
            RelatedObjectProxy = _RelatedObjectProxy_;
            $rootScope = _$rootScope_;
            Store = _Store_;
            ChangeType = _ChangeType_;
        });
        Pouch.reset();
    }

    function setupFixtures(relationshipType, reverseName, done) {
        collection = new Collection('myCollection');
        carMapping = collection.mapping('Car', {
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
        personMapping = collection.mapping('Person', {
            id: 'id',
            attributes: ['name', 'age']
        });
        collection.install(function (err) {
            if (err) done(err);
            car = carMapping._new({colour: 'red', name: 'Aston Martin', id: 'xyz'});

            car.save(function (err) {
                if (err) done(err);
                person = personMapping._new({name: 'Michael Ford', age: 23, id: '12312312'});
                person.save(function (err) {
                    if (err) done(err);
                    $rootScope.$on('myCollection:Car', function (e, n) {
                        carNotif = n;
                        if (carNotif && personNotif) {
                            done();
                        }
                    });
                    $rootScope.$on('myCollection:Person', function (e, n) {
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

            it('has collection', function () {
                assert.equal(carNotif.collection, 'myCollection');
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

            it('has collection', function () {
                assert.equal(personNotif.collection, 'myCollection');
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

                it('has collection', function () {
                    assert.equal(carNotif.collection, 'myCollection');
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

                it('has collection', function () {
                    assert.equal(personNotif.collection, 'myCollection');
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
                anotherCar.save(function (err) {
                    if (err) done(err);
                    anotherPerson.save(function (err) {
                        if (err) done(err);
                        $rootScope.$on('myCollection:Car', function (e, n) {
                            anotherCarNotif = n;
                            if (anotherCarNotif && anotherPersonNotifInsert && personNotifRemove) {
                                done();
                            }
                        });
                        $rootScope.$on('myCollection:Person', function (e, n) {
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
                    })
                });

            });

            describe('forward notif', function () {
                it('has type', function () {
                    assert.equal(anotherCarNotif.type, 'Car');
                });

                it('has collection', function () {
                    assert.equal(anotherCarNotif.collection, 'myCollection');
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

                it('has collection', function () {
                    assert.equal(anotherPersonNotifInsert.collection, 'myCollection');
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

                it('has collection', function () {
                    assert.equal(personNotifRemove.collection, 'myCollection');
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

        describe('set reverse foreign key having already set', function () {

            var newCars;

            var carNotifications = [];
            var peopleNotifications = [];

            function assertNotifications(notifications, opts) {
                if (!opts.change) opts.change = {};
                var exists = false;
                for (var i = 0; i < notifications.length; i++) {
                    var n = notifications[i];
                    var objMatches = true;
                    if (opts.obj) {
                        objMatches =opts.obj == n.obj
                    }
                    if (objMatches) {
                        var changeMatches = true;
                        if (opts.change.type !== undefined) {
                            changeMatches = opts.change.type == n.change.type;
                        }
                        if (changeMatches && opts.change.new !== undefined) {
                            changeMatches = opts.change.new == n.change.new;
                        }
                        if (changeMatches && opts.change.old !== undefined) {
                            changeMatches = opts.change.old == n.change.old;
                        }
                        if (changeMatches && opts.change.field !== undefined) {
                            changeMatches = opts.change.field == n.change.field;
                        }
                        if (changeMatches) {
                            exists = true;
                            break;
                        }
                    }

                }
                assert(exists, 'No such car notification');
            }

            function assertCarNotification(opts) {
                assertNotifications(carNotifications, opts);
            }

            function assertPeopleNotification(opts) {
                assertNotifications(carNotifications, opts);
            }

            beforeEach(function (done) {
                carNotifications = [];
                peopleNotifications = [];
                carMapping.map([
                    {colour: 'red', name: 'Aston Martin', id: '36yedfhdfgswftwsdg'},
                    {colour: 'blue', name: 'Lambo', id: 'asd03r0hasdfsd'},
                    {colour: 'green', name: 'Ford', id: "nmihoahdabf"}
                ], function (err, objs) {
                    if (err) done(err);
                    newCars = objs;
                    $rootScope.$on('myCollection:Car', function (e, n) {
                        carNotifications.push(n);
                    });
                    $rootScope.$on('myCollection:Person', function (e, n) {
                        peopleNotifications.push(n);
                    });
                    var relationship = car.owner.relationship;
                    relationship.setRelated(person, newCars, function (err) {
                        if (err) done(err);
                        $rootScope.$digest();
                        done();
                    });
                });
            });

            it('should send out 4 notifications for cars', function () {
                assert.equal(carNotifications.length, 4);
            });

            it('should send out 1 notifications for person', function () {
                assert.equal(peopleNotifications.length, 1);
            });

            it('sends out notification for old car', function () {
                assertCarNotification({change: {type: ChangeType.Set, new: null, field:'owner', old:person}, obj: car});
            });

            it('sends out notifications for new cars', function () {
                _.each(newCars, function (newCar) {
                    assertCarNotification({change: {type: ChangeType.Set, new: person, field:'owner', old:null}, obj: newCar});
                });
            });

            it('should send out a notification for removal of the car from person', function () {
                assert.equal(peopleNotifications.length, 1);
                var notification = peopleNotifications[0];
                assert.equal(notification.change.field, 'cars');
                assert.equal(notification.change.old.length, 1);
                assert.include(notification.change.old, car);
                assert.equal(notification.change.new.length, 3);
                _.each(newCars, function (newCar) {
                    assert.include(notification.change.new, newCar);
                });
            });

        });

    });


});