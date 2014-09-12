var s = require('../index')
    , assert = require('chai').assert;

describe('bulk save operation', function () {

    var Collection = require('../src/collection').Collection;
    var RelationshipType = require('../src/relationship').RelationshipType;
    var BulkSaveOperation = require('../src/saveOperation').BulkSaveOperation;
    var Pouch = require('../src/pouch');
    var collection, Car, Person;

    beforeEach(function (done) {
        s.reset(true);
        collection = new Collection('MyCollection');
        Person = collection.mapping('Person', {
            id: 'id',
            attributes: ['name', 'age']
        });
        Car = collection.mapping('Car', {
            id: 'id',
            attributes: ['colour', 'name'],
            relationships: {
                owner: {
                    mapping: 'Person',
                    type: RelationshipType.ForeignKey,
                    reverse: 'cars'
                }
            }
        });
        collection.install(done);
    });

    describe('new', function () {

        var cars;

        beforeEach(function () {
            cars = [
                Car._new({colour: 'red'}),
                Car._new({colour: 'blue'}),
                Car._new({colour: 'green'})
            ];
        });

        it('saves', function (done) {
            var op = new BulkSaveOperation(cars, function () {
                var err = this.error;
                if (err) {
                    done(err);
                }
                _.each(cars, function (c) {
                    assert.ok(c.isSaved);
                    assert.notOk(c.isDirty);
                    assert.ok(c._rev);
                });
                done();
            });
            op.start();
        });

    });

    describe('existing', function () {

        var cars;

        beforeEach(function (done) {
            var raw = [
                {colour: 'red', collection: 'MyCollection', type: 'Car'},
                {colour: 'blue', collection: 'MyCollection', type: 'Car'},
                {colour: 'green', collection: 'MyCollection', type: 'Car'}
            ];
            Pouch.getPouch().bulkDocs(raw, function (err, resp) {
                if (err) done(err);
                _.map(_.zip(raw, resp), function (x) {
                    x[0]._rev = x[1].rev;
                    x[0]._id = x[1].id;
                });
                cars = Pouch.toSiesta(raw);
                done();
            });
        });

        it('saves', function (done) {
            _.each(cars, function (car) {
                assert.ok(car.isSaved);
                assert.notOk(car.isDirty);
                car.colour = 'black';
                assert.ok(car.isDirty);
            });
            var op = new BulkSaveOperation(cars, function () {
                var err = this.error;
                if (err) {
                    done(err);
                }
                _.each(cars, function (c) {
                    assert.ok(c.isSaved, 'should still be saved');
                    assert.notOk(c.isDirty, 'should no longer be dirty');
                    assert.ok(c._rev, 'should have a new revision');
                });
                done();
            });
            op.start();

        });




    });



});