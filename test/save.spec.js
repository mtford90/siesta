var s = require('../index')
    , assert = require('chai').assert;

var Pouch = require('../src/pouch');
var Collection = require('../src/collection').Collection;
var collection, carMapping;

var Platform = require('observe-js').Platform;

describe('saving at different levels', function () {

    var car, doc;

    beforeEach(function (done) {
        s.reset(true);

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
                assert.ok(carMapping.isDirty, 'mapping should be dirty');
                assert.ok(collection.isDirty, 'collection should be dirty');
                assert.ok(s.isDirty, 'global should be dirty');
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
            assert.notOk(s.isDirty);
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
                assert.ok(s.isDirty);
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
            assert.notOk(s.isDirty);
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
                assert.ok(s.isDirty);
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
            assert.notOk(s.isDirty);
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
                s.save(done);
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
            assert.notOk(s.isDirty);
        });
    });

});

// Ensure that observe.js is being used correctly (e.g. save waits until end of microtask).
describe('save arrays', function () {

    var car, doc;

    beforeEach(function (done) {
        s.reset(true);

        collection = new Collection('myCollection');
        carMapping = collection.mapping('Car', {
            id: 'id',
            attributes: ['colours', 'name']
        });

        collection.install(function (err) {
            if (err) done(err);
            carMapping.map({name: 'Aston Martin', colours: ['black', 'yellow']}, function (err, _car) {
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

    it('is not dirty until end of micro task', function (done) {
        car.colours.push('green');
        assert.notOk(car.isDirty);
        Platform.performMicrotaskCheckpoint();
        setTimeout(function () {
            assert.ok(car.isDirty);
            done();
        });
    });

    it('xyz', function (done) {
        car.colours.push('green');
        assert.notOk(car.isDirty);
        car.save(function () {
            Pouch.getPouch().get(car._id, function (err, _doc) {
                if (err) done(err);
                assert.include(_doc.colours, 'green');
                done();
            });
        });
    });
    
});