describe('dirty fields', function () {

    var Pouch, RawQuery, Collection, RelationshipType, RelatedObjectProxy, RestObject, $rootScope, CollectionRegistry;
    var collection, carMapping;

    var car;

    beforeEach(function () {
        module('restkit.mapping', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });
        module('restkit.relationship', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Pouch_, _RawQuery_, _RestObject_, _Collection_, _RelationshipType_, _RelatedObjectProxy_, _$rootScope_, _CollectionRegistry_) {
            Pouch = _Pouch_;
            RawQuery = _RawQuery_;
            Collection = _Collection_;
            RelationshipType = _RelationshipType_;
            RelatedObjectProxy = _RelatedObjectProxy_;
            RestObject = _RestObject_;
            $rootScope = _$rootScope_;
            CollectionRegistry = _CollectionRegistry_;
        });

        Pouch.reset();

    });

    afterEach(function () {
        inject(function (Operation) {
            // If operations are still running after a test, they are going to interfere with other tests.
            assert.notOk(Operation.operationsAreRunning);
        })
    });

    function assertNoLongerDirty() {
        it('car should no longer be dirty', function () {
            assert.notOk(car.isDirty);
        });

        it('car collection should no longer be dirty', function () {
            assert.notOk(collection.Car.isDirty);
        });

        it('collection should no longer be dirty', function () {
            assert.notOk(collection.isDirty);
        });

        it('global should no longer be dirty', function () {
            assert.notOk(Collection.isDirty);
        });
    }

    describe('attributes', function () {

        describe('standard', function () {
            var doc;

            beforeEach(function (done) {
                collection = new Collection('myCollection', function (err, version) {
                    if (err) done(err);
                    carMapping = collection.registerMapping('Car', {
                        id: 'id',
                        attributes: ['colour', 'name']
                    });
                }, function (err) {
                    if (err) done(err);
                    carMapping.map({name: 'Aston Martin', colour: 'black'}, function (err, _car) {
                        if (err) done(err);
                        car = _car;
                        Pouch.getPouch().get(car._id, function (err, _doc) {
                            if (err) done(err);
                            doc = _doc;
                            done();
                        });
                    });
                });
            });

            it('car should not be dirty when first mapped', function () {
                assert.notOk(car.isDirty);
            });

            it('type should not be dirty when first mapped', function () {
                assert.notOk(collection.Car.isDirty);
            });

            it('collection should not be dirty when first mapped', function () {
                assert.notOk(collection.isDirty);
            });

            it('global should not be dirty when first mapped', function () {
                assert.notOk(Collection.isDirty);
            });

            it('when first mapped, should have all the same fields', function () {
                assert.equal(doc._id, car._id);
                assert.equal(doc.name, car.name);
                assert.equal(doc.colour, car.colour);
            });

            describe('change attributes', function () {

                beforeEach(function () {
                    car.name = 'Bentley';
                });

                it('car should be dirty', function () {
                    assert.ok(car.isDirty);
                });

                describe('save', function () {

                    beforeEach(function (done) {
                        car.save(done);
                    });

                    assertNoLongerDirty();

                });

                it('car collection should be dirty', function () {
                    assert.ok(collection.Car.isDirty);
                });

                it('collection should be dirty', function () {
                    assert.ok(collection.isDirty);
                });

                it('global should be dirty', function () {
                    assert.ok(Collection.isDirty);
                });

            });
        });


        describe('arrays', function () {

            var doc;


            beforeEach(function (done) {
                collection = new Collection('myCollection', function (err, version) {
                    if (err) done(err);
                    carMapping = collection.registerMapping('Car', {
                        id: 'id',
                        attributes: ['colours', 'name']
                    });
                }, function (err) {
                    if (err) done(err);
                    carMapping.map({name: 'Aston Martin', colours: ['black', 'red', 'green']}, function (err, _car) {
                        if (err) done(err);
                        car = _car;
                        Pouch.getPouch().get(car._id, function (err, _doc) {
                            if (err) done(err);
                            doc = _doc;
                            done();
                        });
                    });
                });
            });

            it('car should not be dirty when first mapped', function () {
                assert.notOk(car.isDirty);
            });

            it('type should not be dirty when first mapped', function () {
                assert.notOk(collection.Car.isDirty);
            });

            it('collection should not be dirty when first mapped', function () {
                assert.notOk(collection.isDirty);
            });

            it('global should not be dirty when first mapped', function () {
                assert.notOk(Collection.isDirty);
            });

            it('when first mapped, should have all the same fields', function () {
                assert.equal(doc._id, car._id);
                assert.equal(doc.name, car.name);
                _.each(car.colours, function (c) {
                    assert.include(doc.colours, c);
                })
            });

            describe('change attributes', function () {
                describe('push element', function () {
                    beforeEach(function () {
                        car.colours.push('purple');
                    });

                    it('car collection should be dirty', function () {
                        assert.ok(collection.Car.isDirty);
                    });

                    it('collection should be dirty', function () {
                        assert.ok(collection.isDirty);
                    });

                    it('global should be dirty', function () {
                        assert.ok(Collection.isDirty);
                    });

                    describe('save', function () {

                        beforeEach(function (done) {
                            car.save(done);
                        });

                        assertNoLongerDirty();

                        it('should have made the change', function (done) {
                            Pouch.getPouch().get(car._id, function (err, doc) {
                                assert.include(doc.colours, 'purple');
                                assert.equal(doc.colours.length, 4);
                                done();
                            });
                        });

                    });

                });

                describe('pop element', function () {
                    beforeEach(function () {
                        car.colours.pop();
                    });

                    it('car collection should be dirty', function () {
                        assert.ok(collection.Car.isDirty);
                    });

                    it('collection should be dirty', function () {
                        assert.ok(collection.isDirty);
                    });

                    it('global should be dirty', function () {
                        assert.ok(Collection.isDirty);
                    });

                    describe('save', function () {

                        beforeEach(function (done) {
                            car.save(done);
                        });

                        assertNoLongerDirty();

                        it('should have made the change', function (done) {
                            Pouch.getPouch().get(car._id, function (err, doc) {
                                assert.equal(doc.colours.length, 2);
                                done();
                            });
                        });

                    });

                });

                describe('shift element', function () {
                    beforeEach(function () {
                        car.colours.shift();
                    });

                    it('car collection should be dirty', function () {
                        assert.ok(collection.Car.isDirty);
                    });

                    it('collection should be dirty', function () {
                        assert.ok(collection.isDirty);
                    });

                    it('global should be dirty', function () {
                        assert.ok(Collection.isDirty);
                    });

                    describe('save', function () {

                        beforeEach(function (done) {
                            car.save(done);
                        });

                        assertNoLongerDirty();

                        it('should have made the change', function (done) {
                            Pouch.getPouch().get(car._id, function (err, doc) {
                                assert.equal(doc.colours.length, 2);
                                done();
                            });
                        });

                    });

                });

                describe('unshift element', function () {
                    beforeEach(function () {
                        car.colours.unshift('purple');
                    });

                    it('car collection should be dirty', function () {
                        assert.ok(collection.Car.isDirty);
                    });

                    it('collection should be dirty', function () {
                        assert.ok(collection.isDirty);
                    });

                    it('global should be dirty', function () {
                        assert.ok(Collection.isDirty);
                    });

                    describe('save', function () {

                        beforeEach(function (done) {
                            car.save(done);
                        });

                        assertNoLongerDirty();

                        it('should have made the change', function (done) {
                            Pouch.getPouch().get(car._id, function (err, doc) {
                                assert.equal(doc.colours[0], 'purple');
                                assert.equal(doc.colours.length, 4);
                                done();
                            });
                        });

                    });

                });

                describe('sort array', function () {
                    beforeEach(function () {
                        car.colours.sort();
                    });

                    it('car collection should be dirty', function () {
                        assert.ok(collection.Car.isDirty);
                    });

                    it('collection should be dirty', function () {
                        assert.ok(collection.isDirty);
                    });

                    it('global should be dirty', function () {
                        assert.ok(Collection.isDirty);
                    });

                    describe('save', function () {

                        beforeEach(function (done) {
                            car.save(done);
                        });

                        assertNoLongerDirty();

                        it('should have made the change', function (done) {
                            Pouch.getPouch().get(car._id, function (err, doc) {
                                assert.equal(doc.colours[0], car.colours[0]);
                                assert.equal(doc.colours[1], car.colours[1]);
                                assert.equal(doc.colours[2], car.colours[2]);
                                assert.equal(doc.colours.length, 3);
                                done();
                            });
                        });

                    });

                });

                describe('reverse array', function () {
                    beforeEach(function () {
                        car.colours.reverse();
                    });

                    it('car collection should be dirty', function () {
                        assert.ok(collection.Car.isDirty);
                    });

                    it('collection should be dirty', function () {
                        assert.ok(collection.isDirty);
                    });

                    it('global should be dirty', function () {
                        assert.ok(Collection.isDirty);
                    });

                    describe('save', function () {

                        beforeEach(function (done) {
                            car.save(done);
                        });

                        assertNoLongerDirty();

                        it('should have made the change', function (done) {
                            Pouch.getPouch().get(car._id, function (err, doc) {
                                assert.equal(doc.colours[0], car.colours[0]);
                                assert.equal(doc.colours[1], car.colours[1]);
                                assert.equal(doc.colours[2], car.colours[2]);
                                assert.equal(doc.colours.length, 3);
                                done();
                            });
                        });

                    });

                });

                describe('set object at index', function () {
                    beforeEach(function () {
                        car.colours.setObjectAtIndex('purple', 1);
                    });

                    it('car collection should be dirty', function () {
                        assert.ok(collection.Car.isDirty);
                    });

                    it('collection should be dirty', function () {
                        assert.ok(collection.isDirty);
                    });

                    it('global should be dirty', function () {
                        assert.ok(Collection.isDirty);
                    });

                    describe('save', function () {

                        beforeEach(function (done) {
                            car.save(done);
                        });

                        assertNoLongerDirty();

                        it('should have made the change', function (done) {
                            Pouch.getPouch().get(car._id, function (err, doc) {
                                assert.equal(doc.colours[1], 'purple');
                                assert.equal(doc.colours[1], car.colours[1]);
                                done();
                            });
                        });

                    });

                });

                describe('splice', function () {
                    beforeEach(function () {
                        car.colours.splice(1, 1, 'purple');
                    });

                    it('car collection should be dirty', function () {
                        assert.ok(collection.Car.isDirty);
                    });

                    it('collection should be dirty', function () {
                        assert.ok(collection.isDirty);
                    });

                    it('global should be dirty', function () {
                        assert.ok(Collection.isDirty);
                    });

                    describe('save', function () {

                        beforeEach(function (done) {
                            car.save(done);
                        });

                        assertNoLongerDirty();

                        it('should have made the change', function (done) {
                            Pouch.getPouch().get(car._id, function (err, doc) {
                                assert.equal(doc.colours[1], 'purple');
                                assert.equal(doc.colours[1], car.colours[1]);
                                done();
                            });
                        });

                    });

                });

            });


        });


    })

});