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

        var apiNotif, genericNotif;

        describe('set value', function () {

            beforeEach(function (done) {
                notif = null;
                api = new RestAPI('myApi', function (err) {
                    if (err) done(err);
                    carMapping = api.registerMapping('Car', {
                        id: 'id',
                        attributes: ['colour', 'name']
                    });
                }, function (err) {
                    if (err) done(err);
                    carMapping.map({colour: 'red', name: 'Aston Martin', id: 'xyz'}, function (err, _car) {
                        car = _car;
                        if (err) done(err);
                        $rootScope.$on('myApi:Car', function (e, n) {
                            notif = n;
                            if (notif && genericNotif && apiNotif) {
                                done();
                            }
                        });
                        $rootScope.$on('myApi', function (e, n) {
                            apiNotif = n;
                            if (notif && genericNotif && apiNotif) {
                                done();
                            }
                        });
                        $rootScope.$on('Fount', function (e, n) {
                            genericNotif = n;
                            if (notif && genericNotif && apiNotif) {
                                done();
                            }
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
                    carMapping.map({colours: ['red', 'blue'], name: 'Aston Martin', id: 'xyz'}, function (err, _car) {
                        car = _car;
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
                    carMapping.map({colours: ['red', 'blue'], name: 'Aston Martin', id: 'xyz'}, function (err, _car) {
                        car = _car;
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
                    carMapping.map({colours: ['red', 'blue'], name: 'Aston Martin', id: 'xyz'}, function (err, _car) {
                        car = _car;
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
                    carMapping.map({colours: ['red', 'blue'], name: 'Aston Martin', id: 'xyz'}, function (err, _car) {
                        car = _car;
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
                    carMapping.map({colours: ['red', 'green', 'blue'], name: 'Aston Martin', id: 'xyz'}, function (err, _car) {
                        car = _car;
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
                    carMapping.map({colours: ['red', 'green', 'blue'], name: 'Aston Martin', id: 'xyz'}, function (err, _car) {
                        car = _car;
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
                    carMapping.map({colours: ['red', 'green', 'blue'], name: 'Aston Martin', id: 'xyz'}, function (err, _car) {
                        car = _car;
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
                        car = carMapping.map({colours: ['red', 'green', 'blue'], name: 'Aston Martin', id: 'xyz'}, function (err, _car) {
                            car = _car;
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
                        carMapping.map({colours: ['red', 'green', 'blue'], name: 'Aston Martin', id: 'xyz'}, function (err, _car) {
                            car = _car;
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
                        carMapping.map({colours: ['red', 'green', 'blue'], name: 'Aston Martin', id: 'xyz'}, function (err, _car) {
                            car = _car;
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
                        carMapping.map({colours: ['red', 'green', 'blue'], name: 'Aston Martin', id: 'xyz'}, function (err, _car) {
                            car = _car;
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
                        carMapping.map({colours: ['red', 'green', 'blue'], name: 'Aston Martin', id: 'xyz'}, function (err, _car) {
                            car = _car;
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

});