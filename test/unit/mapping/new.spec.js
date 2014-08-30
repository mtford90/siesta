describe('mapping new object', function () {

    var Pouch, RawQuery, Collection, RestError, RelationshipType, RelatedObjectProxy;

    beforeEach(function () {
        module('restkit.mapping', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });
        module('restkit.relationship', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Pouch_, _RawQuery_, _Collection_, _RelationshipType_, _RelatedObjectProxy_, _cache_) {
            Pouch = _Pouch_;
            RawQuery = _RawQuery_;
            Collection = _Collection_;
            RelationshipType = _RelationshipType_;
            RelatedObjectProxy = _RelatedObjectProxy_;
            cache = _cache_;
        });

        Pouch.reset();

    });

    describe('fields', function () {
        var collection, carMapping;

        beforeEach(function (done) {
            collection = new Collection('myCollection');
            carMapping = collection.mapping('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            collection.install(done);
        });

        it('valid', function () {
            var car = carMapping._new();
            _.each(carMapping._fields, function (f) {
                assert(car[f] !== undefined);
            });
        });

        describe('id field', function () {
            var car;
            beforeEach(function () {
                car = carMapping._new();
            });

            it('should be present', function () {
                assert.property(car, 'id');
            });

            describe('in cache', function () {
                beforeEach(function () {
                    cache.insert(car);
                    assert.equal(car, cache.get({_id: car._id}));
                    car.id = 'newRemoteId';
                });
                it('should update cache', function () {
                    assert.equal(car, cache.get({id: car.id, mapping: car.mapping}));
                });
                it('should remove previous', function () {
                    assert.equal(car, cache.get({id: car.id, mapping: car.mapping}));
                    car.id = 'brandNewRemoteId';
                    assert.equal(car, cache.get({id: car.id, mapping: car.mapping}));
                    assert.notOk(cache.get({id: 'newRemoteId', mapping: car.mapping}))
                });
                it('should remove all if set remoteid to null', function () {
                    assert.equal(car, cache.get({id: car.id, mapping: car.mapping}));
                    car.id = null;
                    assert.notOk(cache.get({id: 'newRemoteId', mapping: car.mapping}))
                })
            });
        });



    });


    describe('relationships', function () {
        var collection, carMapping, personMapping;

        function configureAPI(type, reverseName, done) {
            collection = new Collection('myCollection');
            carMapping = collection.mapping('Car', {
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
            personMapping = collection.mapping('Person', {
                id: 'id',
                attributes: ['age', 'name']
            });
            collection.install(done);
        }

        beforeEach(function (done) {
            configureAPI(RelationshipType.ForeignKey, 'cars', done);
        });

        describe('installation of proxies', function () {

            it('installs forward related object proxy', function () {
                var carObject = carMapping._new();
                assert.instanceOf(carObject.owner, RelatedObjectProxy);
            });

            it('installs reverse related object proxy', function () {
                var personObject = personMapping._new();
                assert.instanceOf(personObject.cars, RelatedObjectProxy);
            });

        });

    });

});
