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

            describe.only('unshift', function () {
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




        });

    });

    describe('relationships', function () {

    });


});