describe('saving at different levelss', function () {

    var Pouch, RawQuery, Collection, RelationshipType, RelatedObjectProxy, RestObject, $rootScope, CollectionRegistry;
    var collection, carMapping, personMapping;

    var car, previousPerson, newPerson;

    beforeEach(function (done) {
        module('restkit', function ($provide) {
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


        collection = new Collection('myCollection');
        carMapping = collection.mapping('Car', {
            id: 'id',
            attributes: ['colour', 'name']
        });
        collection.install(function (err) {
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


    it('should save at object level', function (done) {
        carMapping.map([
            {colour: 'black', name: 'Aston Martin'},
            {colour: 'blue', name: 'Aston Martin'},
            {colour: 'red', name: 'Aston Martin'}
        ], function (err, cars) {
            if (err) done(err);
            _.each(cars, function (c) {
                c.colour = 'purple';
                assert(c.isDirty);
            });
            var finishedSaving = function (err) {
                assert.notOk(err);
                _.each(cars, function (c) {
                    assert.notOk(c.isDirty);
                });
                done();
            };
            async.parallel(_.map(cars, function (c) {
                return _.bind(c.save, c)
            }), finishedSaving);
        });
    });

    it('should save at mapping level', function (done) {
        carMapping.map([
            {colour: 'black', name: 'Aston Martin'},
            {colour: 'blue', name: 'Aston Martin'},
            {colour: 'red', name: 'Aston Martin'}
        ], function (err, cars) {
            if (err) done(err);
            _.each(cars, function (c) {
                c.colour = 'purple';
                assert.ok(c.isDirty);
            });
            carMapping.save(function (err) {
                if (err) done(err);
                _.each(cars, function (c) {
                    c.colour = 'purple';
                    assert.notOk(c.isDirty);
                });
                done();
            });

        });
    });

    it.only('should save at collection level', function (done) {
        carMapping.map([
            {colour: 'black', name: 'Aston Martin'},
            {colour: 'blue', name: 'Aston Martin'},
            {colour: 'red', name: 'Aston Martin'}
        ], function (err, cars) {
            if (err) done(err);
            _.each(cars, function (c) {
                c.colour = 'purple';
                assert.ok(c.isDirty);
            });
            collection.save(function (err) {
                if (err) done(err);
                _.each(cars, function (c) {
                    c.colour = 'purple';
                    assert.notOk(c.isDirty);
                });
                done();
            });

        });
    });


});