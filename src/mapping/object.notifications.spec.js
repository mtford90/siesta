describe('notifications', function () {

    var Pouch, RawQuery, RestAPI, RelationshipType, RelatedObjectProxy, $rootScope, Store, ChangeType;

    beforeEach(function () {
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

    });

    describe('attributes', function () {
        var api, carMapping;
        var car, notif;

        describe('set value', function () {

            beforeEach(function (done) {
                api = new RestAPI('myApi', function (err) {
                    if (err) done(err);
                    carMapping = api.registerMapping('Car', {
                        id: 'id',
                        attributes: ['colour', 'name']
                    });
                }, function (err) {
                    if (err) done(err);
                    car = carMapping._new({colour: 'red', name: 'Aston Martin', id: 'xyz'});
                    Store.put(car, function (err) {
                        if (err) done(err);
                        $rootScope.$on('myApi:Car', function (e, n) {
                            notif = n;
                            done();
                        });
                        car.colour = 'blue';
                        $rootScope.$digest();
                    });
                });

            });

            it('notif contains type', function () {
                assert.equal(notif.api, 'myApi');
            });

            it('notif contains api', function () {
                assert.equal(notif.type, 'Car');
            });

            it('notif contains object', function () {
                assert.equal(notif.obj, car);
            });

            it('changeDict contains attribute name', function () {
                var change = notif.change;
                assert.equal(change.field, 'colour');
            });

            it('changeDict contains change type', function () {
                var change = notif.change;
                assert.equal(change.type, ChangeType.Set);
            });

            it('changeDict contains old value', function () {
                var change = notif.change;
                assert.equal(change.old, 'red');
            });

            it('changeDict contains new value', function () {
                var change = notif.change;
                assert.equal(change.new, 'blue');
            });


        });

        describe('array notifications', function () {
            beforeEach(function (done) {
                api = new RestAPI('myApi', function (err) {
                    if (err) done(err);
                    carMapping = api.registerMapping('Car', {
                        id: 'id',
                        attributes: ['colours', 'name']
                    });
                }, function (err) {
                    done(err);
                });

            });

            describe('push', function () {
                beforeEach(function (done) {
                    car = carMapping._new({colours: ['red', 'blue'], name: 'Aston Martin', id: 'xyz'});
                    Store.put(car, function (err) {
                        if (err) done(err);
                        $rootScope.$on('myApi:Car', function (e, n) {
                            notif = n;
                            console.log('notif', notif);
                            done();
                        });
                        console.log('colours', car.colours);
                        car.colours.push('green');
                        $rootScope.$digest();
                    });
                });

                it('notif contains type', function () {
                    assert.equal(notif.api, 'myApi');
                });

                it('notif contains api', function () {
                    assert.equal(notif.type, 'Car');
                });

                it('notif contains object', function () {
                    assert.equal(notif.obj, car);
                });

                it('changeDict contains attribute name', function () {
                    var change = notif.change;
                    assert.equal(change.field, 'colours');
                });

                it('changeDict contains change type', function () {
                    var change = notif.change;
                    assert.equal(change.type, ChangeType.Insert);
                });

                it('changeDict contains new value', function () {
                    var change = notif.change;
                    console.log('new:', change.new);
                    assert.equal(change.new.length, 1);
                    assert.include(change.new, 'green');
                });

                it('changeDict contains index', function () {
                    var change = notif.change;
                    assert.equal(change.index, 2);
                });


            });

            describe('pop', function () {
                beforeEach(function (done) {
                    car = carMapping._new({colours: ['red', 'blue'], name: 'Aston Martin', id: 'xyz'});
                    Store.put(car, function (err) {
                        if (err) done(err);
                        $rootScope.$on('myApi:Car', function (e, n) {
                            notif = n;
                            console.log('notif', notif);
                            done();
                        });
                        console.log('colours', car.colours);
                        car.colours.pop();
                        $rootScope.$digest();
                    });
                });

                it('notif contains type', function () {
                    assert.equal(notif.api, 'myApi');
                });

                it('notif contains api', function () {
                    assert.equal(notif.type, 'Car');
                });

                it('notif contains object', function () {
                    assert.equal(notif.obj, car);
                });

                it('changeDict contains attribute name', function () {
                    var change = notif.change;
                    assert.equal(change.field, 'colours');
                });

                it('changeDict contains change type', function () {
                    var change = notif.change;
                    assert.equal(change.type, ChangeType.Remove);
                });

                it('changeDict contains old value', function () {
                    var change = notif.change;
                    console.log('old:', change.old);
                    assert.equal(change.old.length, 1);
                    assert.include(change.old, 'blue');
                });

                it('changeDict contains index', function () {
                    var change = notif.change;
                    assert.equal(change.index, 1);
                });


            });

            describe('shift', function () {
                beforeEach(function (done) {
                    car = carMapping._new({colours: ['red', 'blue'], name: 'Aston Martin', id: 'xyz'});
                    Store.put(car, function (err) {
                        if (err) done(err);
                        $rootScope.$on('myApi:Car', function (e, n) {
                            notif = n;
                            console.log('notif', notif);
                            done();
                        });
                        console.log('colours', car.colours);
                        car.colours.shift();
                        $rootScope.$digest();
                    });
                });

                it('notif contains type', function () {
                    assert.equal(notif.api, 'myApi');
                });

                it('notif contains api', function () {
                    assert.equal(notif.type, 'Car');
                });

                it('notif contains object', function () {
                    assert.equal(notif.obj, car);
                });

                it('changeDict contains attribute name', function () {
                    var change = notif.change;
                    assert.equal(change.field, 'colours');
                });

                it('changeDict contains change type', function () {
                    var change = notif.change;
                    assert.equal(change.type, ChangeType.Remove);
                });

                it('changeDict contains old value', function () {
                    var change = notif.change;
                    console.log('old:', change.old);
                    assert.equal(change.old.length, 1);
                    assert.include(change.old, 'red');
                });

                it('changeDict contains index', function () {
                    var change = notif.change;
                    assert.equal(change.index, 0);
                });


            });

            describe('unshift', function () {
                beforeEach(function (done) {
                    car = carMapping._new({colours: ['red', 'blue'], name: 'Aston Martin', id: 'xyz'});
                    Store.put(car, function (err) {
                        if (err) done(err);
                        $rootScope.$on('myApi:Car', function (e, n) {
                            notif = n;
                            console.log('notif', notif);
                            done();
                        });
                        console.log('colours', car.colours);
                        car.colours.unshift('green');
                        $rootScope.$digest();
                    });
                });

                it('notif contains type', function () {
                    assert.equal(notif.api, 'myApi');
                });

                it('notif contains api', function () {
                    assert.equal(notif.type, 'Car');
                });

                it('notif contains object', function () {
                    assert.equal(notif.obj, car);
                });

                it('changeDict contains attribute name', function () {
                    var change = notif.change;
                    assert.equal(change.field, 'colours');
                });

                it('changeDict contains change type', function () {
                    var change = notif.change;
                    assert.equal(change.type, ChangeType.Insert);
                });

                it('changeDict contains new value', function () {
                    var change = notif.change;
                    console.log('new:', change.new);
                    assert.equal(change.new.length, 1);
                    assert.include(change.new, 'green');
                });

                it('changeDict contains index', function () {
                    var change = notif.change;
                    assert.equal(change.index, 0);
                });

            });

            describe('sort', function () {
                beforeEach(function (done) {
                    car = carMapping._new({colours: ['red', 'green', 'blue'], name: 'Aston Martin', id: 'xyz'});
                    Store.put(car, function (err) {
                        if (err) done(err);
                        $rootScope.$on('myApi:Car', function (e, n) {
                            notif = n;
                            console.log('notif', notif);
                            done();
                        });
                        car.colours.sort();
                        $rootScope.$digest();
                    });
                });

                it('notif contains type', function () {
                    assert.equal(notif.api, 'myApi');
                });

                it('notif contains api', function () {
                    assert.equal(notif.type, 'Car');
                });

                it('notif contains object', function () {
                    assert.equal(notif.obj, car);
                });

                it('changeDict contains attribute name', function () {
                    var change = notif.change;
                    assert.equal(change.field, 'colours');
                });

                it('changeDict contains change type', function () {
                    var change = notif.change;
                    assert.equal(change.type, ChangeType.Move);
                });

                it('changeDict contains indexes', function () {
                    var change = notif.change;
                    console.log('indexes', change.indexes);
                    assert.equal(change.indexes.length, 1);
                });

                it('correct order', function () {
                    assert.equal(car.colours[0], 'blue');
                    assert.equal(car.colours[1], 'green');
                    assert.equal(car.colours[2], 'red');
                })
            });

            describe('reverse', function () {
                beforeEach(function (done) {
                    car = carMapping._new({colours: ['red', 'green', 'blue'], name: 'Aston Martin', id: 'xyz'});
                    Store.put(car, function (err) {
                        if (err) done(err);
                        $rootScope.$on('myApi:Car', function (e, n) {
                            notif = n;
                            console.log('notif', notif);
                            done();
                        });
                        car.colours.reverse();
                        $rootScope.$digest();
                    });
                });

                it('notif contains type', function () {
                    assert.equal(notif.api, 'myApi');
                });

                it('notif contains api', function () {
                    assert.equal(notif.type, 'Car');
                });

                it('notif contains object', function () {
                    assert.equal(notif.obj, car);
                });

                it('changeDict contains attribute name', function () {
                    var change = notif.change;
                    assert.equal(change.field, 'colours');
                });

                it('changeDict contains change type', function () {
                    var change = notif.change;
                    assert.equal(change.type, ChangeType.Move);
                });

                it('changeDict contains indexes', function () {
                    var change = notif.change;
                    console.log('indexes', change.indexes);
                    assert.equal(change.indexes.length, 1);
                });

                it('correct order', function () {
                    assert.equal(car.colours[0], 'blue');
                    assert.equal(car.colours[1], 'green');
                    assert.equal(car.colours[2], 'red');
                })
            });

            describe('assign', function () {
                beforeEach(function (done) {
                    car = carMapping._new({colours: ['red', 'green', 'blue'], name: 'Aston Martin', id: 'xyz'});
                    Store.put(car, function (err) {
                        if (err) done(err);
                        $rootScope.$on('myApi:Car', function (e, n) {
                            notif = n;
                            console.log('notif', notif);
                            done();
                        });
                        car.colours.setObjectAtIndex('purple', 1);
                        $rootScope.$digest();
                    });
                });

                it('notif contains type', function () {
                    assert.equal(notif.api, 'myApi');
                });

                it('notif contains api', function () {
                    assert.equal(notif.type, 'Car');
                });

                it('notif contains object', function () {
                    assert.equal(notif.obj, car);
                });

                it('changeDict contains attribute name', function () {
                    var change = notif.change;
                    assert.equal(change.field, 'colours');
                });

                it('changeDict contains change type', function () {
                    var change = notif.change;
                    assert.equal(change.type, ChangeType.Replace);
                });

                it('changeDict contains old value', function () {
                    var change = notif.change;
                    assert.equal(change.old, 'green');
                });

                it('changeDict contains new value', function () {
                    var change = notif.change;
                    assert.equal(change.new, 'purple');
                });

                it('changeDict contains index', function () {
                    var change = notif.change;
                    assert.equal(change.index, 1);
                });


            });

            describe('splice', function () {

                describe('add 1', function () {
                    beforeEach(function (done) {
                        car = carMapping._new({colours: ['red', 'green', 'blue'], name: 'Aston Martin', id: 'xyz'});
                        Store.put(car, function (err) {
                            if (err) done(err);
                            $rootScope.$on('myApi:Car', function (e, n) {
                                notif = n;
                                console.log('notif', notif);
                                done();
                            });
                            car.colours.splice(1, 0, 'purple');
                            $rootScope.$digest();
                        });
                    });

                    it('array has changed as expected', function () {
                        assert.equal(car.colours.length, 4);
                        assert.equal(car.colours[0], 'red');
                        assert.equal(car.colours[1], 'purple');
                        assert.equal(car.colours[2], 'green');
                        assert.equal(car.colours[3], 'blue');
                    });

                    it('changeDict contains attribute name', function () {
                        var change = notif.change;
                        assert.equal(change.length, 1);
                        assert.equal(change[0].field, 'colours');
                    });

                    it('changeDict contains change type', function () {
                        var change = notif.change;
                        assert.equal(change.length, 1);
                        assert.equal(change[0].type, ChangeType.Insert);
                    });

                    it('changeDict contains index', function () {
                        var change = notif.change;
                        assert.equal(change.length, 1);
                        assert.equal(change[0].index, 1);
                    });

                    it('changeDict contains new', function () {
                        var change = notif.change;
                        assert.equal(change.length, 1);
                        assert.equal(change[0].new.length, 1);
                        assert.include(change[0].new, 'purple');
                    });
                });

                describe('delete 1, add 1', function () {
                    beforeEach(function (done) {
                        car = carMapping._new({colours: ['red', 'green', 'blue'], name: 'Aston Martin', id: 'xyz'});
                        Store.put(car, function (err) {
                            if (err) done(err);
                            $rootScope.$on('myApi:Car', function (e, n) {
                                notif = n;
                                console.log('notif', notif);
                                done();
                            });
                            car.colours.splice(1, 1, 'purple');
                            $rootScope.$digest();
                        });
                    });

                    it('array has changed as expected', function () {
                        assert.equal(car.colours.length, 3);
                        assert.equal(car.colours[0], 'red');
                        assert.equal(car.colours[1], 'purple');
                        assert.equal(car.colours[2], 'blue');
                    });

                    it('changeDict contains attribute name', function () {
                        var change = notif.change;
                        assert.equal(change.length, 1);
                        assert.equal(change[0].field, 'colours');
                    });

                    it('changeDict contains change type', function () {
                        var change = notif.change;
                        assert.equal(change.length, 1);
                        assert.equal(change[0].type, ChangeType.Replace);
                    });

                    it('changeDict contains index', function () {
                        var change = notif.change;
                        assert.equal(change.length, 1);
                        assert.equal(change[0].index, 1);
                    });

                    it('changeDict contains new', function () {
                        var change = notif.change;
                        assert.equal(change.length, 1);
                        assert.equal(change[0].new.length, 1);
                        assert.include(change[0].new, 'purple');
                    });

                    it('changeDict contains old', function () {
                        var change = notif.change;
                        assert.equal(change.length, 1);
                        assert.equal(change[0].old.length, 1);
                        assert.include(change[0].old, 'green');
                    });
                });

                describe('delete 2', function () {
                    beforeEach(function (done) {
                        car = carMapping._new({colours: ['red', 'green', 'blue'], name: 'Aston Martin', id: 'xyz'});
                        Store.put(car, function (err) {
                            if (err) done(err);
                            $rootScope.$on('myApi:Car', function (e, n) {
                                notif = n;
                                console.log('notif', notif);
                                done();
                            });
                            car.colours.splice(1, 2);
                            $rootScope.$digest();
                        });
                    });

                    it('array has changed as expected', function () {
                        assert.equal(car.colours.length, 1);
                        assert.equal(car.colours[0], 'red');
                    });

                    it('changeDict contains attribute name', function () {
                        var change = notif.change;
                        assert.equal(change.length, 1);
                        assert.equal(change[0].field, 'colours');
                    });

                    it('changeDict contains change type', function () {
                        var change = notif.change;
                        assert.equal(change.length, 1);
                        assert.equal(change[0].type, ChangeType.Remove);
                    });

                    it('changeDict contains index', function () {
                        var change = notif.change;
                        assert.equal(change.length, 1);
                        assert.equal(change[0].index, 1);
                    });

                    it('changeDict contains old', function () {
                        var change = notif.change;
                        assert.equal(change.length, 1);
                        assert.equal(change[0].old.length, 2);
                        assert.include(change[0].old, 'green');
                        assert.include(change[0].old, 'blue');
                    });
                });

                describe('delete 2, add 1', function () {
                    beforeEach(function (done) {
                        car = carMapping._new({colours: ['red', 'green', 'blue'], name: 'Aston Martin', id: 'xyz'});
                        Store.put(car, function (err) {
                            if (err) done(err);
                            $rootScope.$on('myApi:Car', function (e, n) {
                                notif = n;
                                console.log('notif', notif);
                                done();
                            });
                            car.colours.splice(1, 2, 'purple');
                            $rootScope.$digest();
                        });
                    });

                    it('array has changed as expected', function () {
                        assert.equal(car.colours.length, 2);
                        assert.equal(car.colours[0], 'red');
                        assert.equal(car.colours[1], 'purple');
                    });

                    it('changeDict contains attribute name', function () {
                        var change = notif.change;
                        assert.equal(change.length, 2);
                        assert.equal(change[0].field, 'colours');
                        assert.equal(change[1].field, 'colours');
                    });

                    it('changeDict contains change type', function () {
                        var change = notif.change;
                        assert.equal(change.length, 2);
                        var removalChange = change[0];
                        var replacementChange = change[1];
                        assert.equal(removalChange.type, ChangeType.Remove);
                        assert.equal(replacementChange.type, ChangeType.Replace);
                    });

                    it('changeDict contains index', function () {
                        var change = notif.change;
                        assert.equal(change.length, 2);
                        var removalChange = change[0];
                        var replacementChange = change[1];
                        assert.equal(removalChange.index, 2);
                        assert.equal(replacementChange.index, 1);
                    });

                    it('changeDict contains old', function () {
                        var change = notif.change;
                        assert.equal(change.length, 2);
                        var removalChange = change[0];
                        var replacementChange = change[1];
                        assert.include(removalChange.old, 'blue');
                        assert.include(replacementChange.old, 'green');
                    });

                    it('changeDict contains new', function () {
                        var change = notif.change;
                        assert.equal(change.length, 2);
                        var replacementChange = change[1];
                        assert.include(replacementChange.new, 'purple');
                    });
                });

                describe('delete 2, add 3', function () {
                    beforeEach(function (done) {
                        car = carMapping._new({colours: ['red', 'green', 'blue'], name: 'Aston Martin', id: 'xyz'});
                        Store.put(car, function (err) {
                            if (err) done(err);
                            $rootScope.$on('myApi:Car', function (e, n) {
                                notif = n;
                                console.log('notif', notif);
                                done();
                            });
                            car.colours.splice(1, 2, 'purple', 'yellow', 'indigo');
                            $rootScope.$digest();
                        });
                    });

                    it('array has changed as expected', function () {
                        assert.equal(car.colours.length, 4);
                        assert.equal(car.colours[0], 'red');
                        assert.equal(car.colours[1], 'purple');
                        assert.equal(car.colours[2], 'yellow');
                        assert.equal(car.colours[3], 'indigo');
                    });

                    it('changeDict contains attribute name', function () {
                        var change = notif.change;
                        assert.equal(change.length, 2);
                        assert.equal(change[0].field, 'colours');
                        assert.equal(change[1].field, 'colours');
                    });

                    it('changeDict contains change type', function () {
                        var change = notif.change;
                        assert.equal(change.length, 2);
                        var removalChange = change[0];
                        var replacementChange = change[1];
                        assert.equal(removalChange.type, ChangeType.Replace);
                        assert.equal(replacementChange.type, ChangeType.Insert);
                    });

                    it('changeDict contains index', function () {
                        var change = notif.change;
                        assert.equal(change.length, 2);
                        var replacementChange = change[0];
                        var insertionChange = change[1];
                        assert.equal(replacementChange.index, 1);
                        assert.equal(insertionChange.index, 3);
                    });

                });

            });

        });

    });

    describe('relationships', function () {
        var api, carMapping, personMapping;
        var car, person, carNotif, personNotif;

        describe('OneToOne', function () {
            beforeEach(function (done) {
                api = new RestAPI('myApi', function (err) {
                    if (err) done(err);
                    carMapping = api.registerMapping('Car', {
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
                api = new RestAPI('myApi', function (err) {
                    if (err) done(err);
                    carMapping = api.registerMapping('Car', {
                        id: 'id',
                        attributes: ['colour', 'name'],
                        relationships: {
                            owner: {
                                mapping: 'Person',
                                type: RelationshipType.ForeignKey,
                                reverse: 'car'
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
                    anotherCar = carMapping._new({name: 'Lambo', id:'asq34asdasd', colour:'yellow'});
                    anotherPerson = personMapping._new({name: 'Robert Manning', id:'asq34asdasd', age:52});
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
});