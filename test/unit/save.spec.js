describe('saving at different levelss', function () {

    var Pouch, RawQuery, Collection, RelationshipType, RelatedObjectProxy, RestObject, $rootScope, CollectionRegistry, Siesta;
    var collection, carMapping, personMapping;

    var car, previousPerson, newPerson;

    beforeEach(function (done) {
        module('restkit', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Pouch_, _RawQuery_, _Siesta_, _RestObject_, _Collection_, _RelationshipType_, _RelatedObjectProxy_, _$rootScope_, _CollectionRegistry_) {
            Pouch = _Pouch_;
            RawQuery = _RawQuery_;
            Collection = _Collection_;
            RelationshipType = _RelationshipType_;
            RelatedObjectProxy = _RelatedObjectProxy_;
            RestObject = _RestObject_;
            $rootScope = _$rootScope_;
            CollectionRegistry = _CollectionRegistry_;
            Siesta = _Siesta_;
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

    describe('object level', function () {
        var cars;
        beforeEach(function (done) {
            carMapping.map([
                {colour: 'black', name: 'Aston Martin'},
                {colour: 'blue', name: 'Aston Martin'},
                {colour: 'red', name: 'Aston Martin'}
            ], function (err, _cars) {
                if (err) done(err);
                cars = _cars;
                _.each(cars, function (c) {
                    c.colour = 'purple';
                    assert(c.isDirty);
                });
                assert.ok(carMapping.isDirty);
                assert.ok(collection.isDirty);
                assert.ok(Siesta.isDirty);
                assert.ok(Collection.isDirty);
                async.parallel(_.map(cars, function (c) {
                    return _.bind(c.save, c)
                }), done);
            });
        });

        it('objects should not be dirty', function () {
            _.each(cars, function (c) {
                assert.notOk(c.isDirty);
            });
        });

        it('mapping should not be dirty', function () {
            assert.notOk(carMapping.isDirty);
        });

        it('collection should not be dirty', function () {
            assert.notOk(collection.isDirty);
        });

        it('Collection should not be dirty', function () {
            assert.notOk(Collection.isDirty);
        });

        it('global should not be dirty', function () {
            assert.notOk(Siesta.isDirty);
        });
    });

    describe('save at mapping level', function () {
        var cars;
        beforeEach(function (done) {
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
                assert.ok(carMapping.isDirty);
                assert.ok(collection.isDirty);
                assert.ok(Siesta.isDirty);
                assert.ok(Collection.isDirty);
                carMapping.save(done);
            });
        });

        it('objects should not be dirty', function () {
            _.each(cars, function (c) {
                assert.notOk(c.isDirty);
            });
        });

        it('mapping should not be dirty', function () {
            assert.notOk(carMapping.isDirty);
        });

        it('collection should not be dirty', function () {
            assert.notOk(collection.isDirty);
        });

        it('Collection should not be dirty', function () {
            assert.notOk(Collection.isDirty);
        });

        it('global should not be dirty', function () {
            assert.notOk(Siesta.isDirty);
        });
    });

    describe('save at collection level', function () {
        var cars;
        beforeEach(function (done) {
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
                assert.ok(carMapping.isDirty);
                assert.ok(collection.isDirty);
                assert.ok(Siesta.isDirty);
                assert.ok(Collection.isDirty);
                collection.save(done);

            });
        });

        it('objects should not be dirty', function () {
            _.each(cars, function (c) {
                assert.notOk(c.isDirty);
            });
        });

        it('mapping should not be dirty', function () {
            assert.notOk(carMapping.isDirty);
        });

        it('collection should not be dirty', function () {
            assert.notOk(collection.isDirty);
        });

        it('Collection should not be dirty', function () {
            assert.notOk(Collection.isDirty);
        });

        it('global should not be dirty', function () {
            assert.notOk(Siesta.isDirty);
        });
    });

    describe('save at global level', function () {
        var cars;
        beforeEach(function (done) {
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
                Siesta.save(done);
            });
        });
        it('objects should not be dirty', function () {
            _.each(cars, function (c) {
                assert.notOk(c.isDirty);
            });
        });

        it('mapping should not be dirty', function () {
            assert.notOk(carMapping.isDirty);
        });

        it('collection should not be dirty', function () {
            assert.notOk(collection.isDirty);
        });

        it('Collection should not be dirty', function () {
            assert.notOk(Collection.isDirty);
        });

        it('global should not be dirty', function () {
            assert.notOk(Siesta.isDirty);
        });
    });




});