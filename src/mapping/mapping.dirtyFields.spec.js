describe('dirty fields', function () {

    var Pouch, RawQuery, Collection, RelationshipType, RelatedObjectProxy, RestObject, $rootScope,CollectionRegistry;
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

        inject(function (_Pouch_, _RawQuery_, _RestObject_, _Collection_, _RelationshipType_, _RelatedObjectProxy_, _$rootScope_,_CollectionRegistry_) {
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

    describe('attributes', function () {

        var car, doc;

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

        // TODO

        it('car should not be dirty when first mapped', function () {
            assert.notOk(car.isDirty);
        });

//        it('type should not be dirty when first mapped', function () {
//            assert.notOk(collection.Car.isDirty);
//        });
//
//        it('collection should not be dirty when first mapped', function () {
//            assert.notOk(collection.isDirty);
//        });
//
//        it('global should not be dirty when first mapped', function () {
//            assert.notOk(Collection.isDirty);
//        });

//        it('when first mapped, should have all the same fields', function () {
//            assert.equal(doc._id, car._id);
//            assert.equal(doc.name, car.name);
//            assert.equal(doc.colour, car.colour);
//        });

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

                it('car should no longer be dirty', function () {
                    assert.notOk(car.isDirty);
                });


            });

            // TODO

//            it('car collection should be dirty', function () {
//                assert.ok(collection.Car.isDirty);
//            });
//
//            it('collection should be dirty', function () {
//                assert.ok(collection.isDirty);
//            });
//
//            it('global should be dirty', function () {
//                assert.ok(Collection.isDirty);
//            });

        });

    })

});