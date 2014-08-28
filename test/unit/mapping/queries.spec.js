describe('mapping queries', function () {

    var Pouch, RawQuery, Mapping, RestObject, Collection, RelatedObjectProxy;

    beforeEach(function () {
        module('restkit.mapping', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });
        module('restkit.relationship', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Pouch_, _RawQuery_, _Mapping_, _RestObject_, _Collection_, _RestError_, _RelationshipType_, _RelatedObjectProxy_) {
            Pouch = _Pouch_;
            RawQuery = _RawQuery_;
            Mapping = _Mapping_;
            RestObject = _RestObject_;
            Collection = _Collection_;
            RelatedObjectProxy = _RelatedObjectProxy_;
        });

        Pouch.reset();

    });

    describe('queries', function () {
        var collection, mapping;
        beforeEach(function (done) {
            collection = new Collection('myCollection', function (err) {
                if (err) done(err);
                mapping = collection.registerMapping('Car', {
                    id: 'id',
                    attributes: ['color', 'name']
                });
            }, function (err) {
                if (err) done(err);
                Pouch.getPouch().bulkDocs([
                    {
                        type: 'Car',
                        id: 4,
                        color: 'red',
                        name: 'Aston Martin',
                        collection: 'myCollection'
                    },
                    {
                        type: 'Car',
                        id: 5,
                        color: 'blue',
                        name: 'Ford',
                        collection: 'myCollection'
                    }
                ], function (err) {
                    done(err);
                });
            });
        });

        it('all', function (done) {
            mapping.all(function (err, cars) {
                if (err) done(err);
                assert.equal(cars.length, 2);
                _.each(cars, function (car) {
                    assert.instanceOf(car, RestObject);
                });
                done();
            });
        });

        it('query', function (done) {
            mapping.query({color: 'red'}, function (err, cars) {
                if (err) done(err);
                assert.equal(cars.length, 1);
                _.each(cars, function (car) {
                    assert.instanceOf(car, RestObject);
                });
                done();
            });
        });

        it('get', function (done) {
            mapping.get(4, function (err, car) {
                if (err) done(err);
                dump(err, car);
                assert.ok(car);
                assert.instanceOf(car, RestObject);
                assert.equal(car.color, 'red');
                done();
            });
        });

    });

});