var s = require('../index')
    , assert = require('chai').assert;

describe('generation of changes during array operations', function () {

    var collection;
    var car, person;
    var carMapping, personMapping;

    var Collection = require('../src/collection').Collection;
    var changes = require('../src/pouch/changes');
    var ChangeType = require('../src/pouch/changeType').ChangeType;
    var RelationshipType = require('../src/relationship').RelationshipType;
    var util = require('../src/util');

    beforeEach(function (done) {
        s.reset(true);
        done();
    });

    describe('against attributes', function () {

        beforeEach(function (done) {
            collection = new Collection('myCollection');

            carMapping = collection.mapping('Car', {
                id: 'id',
                attributes: ['colours', 'name']
            });

            personMapping = collection.mapping('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });

            collection.install(done);
        });

        it('push', function (done) {
            car = carMapping._new();
            car.colours = [];
            changes.resetChanges();
            car.colours.push('red');
            util.next(function () {
                assert.equal(1, changes.allChanges.length);
                var change = changes.allChanges[0];
                assert.equal(change.type, ChangeType.Splice);
                assert.include(change.added, 'red');
                assert.equal(change.index, 0);
                assert.equal(change.field, 'colours');
                done();
            });
        });

        it('splice', function (done) {
            car = carMapping._new();
            car.colours = ['red'];
            changes.resetChanges();
            car.colours.splice(0, 1);
            util.next(function () {
                assert.equal(1, changes.allChanges.length);
                var change = changes.allChanges[0];
                assert.equal(change.type, ChangeType.Splice);
                assert.include(change.removed, 'red');
                assert.equal(change.index, 0);
                assert.equal(change.field, 'colours');
                done();
            });
        });

        it('sort', function (done) {
            car = carMapping._new();
            car.colours = ['red', 'blue', 'green'];
            changes.resetChanges();
            car.colours.sort();
            // Red is removed and inserted elsewhere.
            util.next(function () {
                assert.equal(2, changes.allChanges.length);
                done();
            });
        });

    });

    describe('against relationships', function () {

        describe('foreign key', function () {

            beforeEach(function (done) {
                collection = new Collection('myCollection');

                carMapping = collection.mapping('Car', {
                    id: 'id',
                    attributes: ['colours', 'name'],
                    relationships: {
                        owner: {
                            mapping: 'Person',
                            type: RelationshipType.ForeignKey,
                            reverse: 'cars'
                        }
                    }
                });

                personMapping = collection.mapping('Person', {
                    id: 'id',
                    attributes: ['name', 'age']
                });

                collection.install(done);
            });

            it('push', function (done) {
                car = carMapping._new();
                var anotherCar = carMapping._new();
                person = personMapping._new();
                person.cars = [car];
                changes.resetChanges();
                person.cars.push(anotherCar);
                util.next(function () {
                    assert.equal(car.owner, person);
                    assert.equal(anotherCar.owner, person);
                    var allChanges = changes.allChanges;
                    assert.equal(allChanges.length, 2);
                    var splicePredicate = function (x) {return x.type === ChangeType.Splice};
                    var spliceChange = _.find(allChanges, splicePredicate);
                    assert.equal(spliceChange.type, ChangeType.Splice);
                    assert.include(spliceChange.added, anotherCar);
                    assert.equal(spliceChange.index, 1);
                    assert.equal(spliceChange.field, 'cars');
                    done();
                });
            });
            it('splice', function (done) {
                car = carMapping._new();
                person = personMapping._new();
                person.cars = [car];
                changes.resetChanges();
                person.cars.splice(0, 1);
                util.next(function () {
                    assert.notOk(car.ownerProxy._id);
                    assert.notOk(car.ownerProxy.related);
                    var allChanges = changes.allChanges;
                    assert.equal(allChanges.length, 2);
                    var splicePredicate = function (x) {return x.type === ChangeType.Splice};
                    var spliceChange = _.find(allChanges, splicePredicate);
                    assert.include(spliceChange.removed, car);
                    assert.equal(spliceChange.type, ChangeType.Splice);
                    done();
                });
            });

        });

        describe('many to many', function () {
            beforeEach(function (done) {
                collection = new Collection('myCollection');

                carMapping = collection.mapping('Car', {
                    id: 'id',
                    attributes: ['colours', 'name'],
                    relationships: {
                        owners: {
                            mapping: 'Person',
                            type: RelationshipType.ManyToMany,
                            reverse: 'cars'
                        }
                    }
                });

                personMapping = collection.mapping('Person', {
                    id: 'id',
                    attributes: ['name', 'age']
                });

                collection.install(done);
            });

            describe('no faults', function () {
                it('push', function (done) {
                    car = carMapping._new();
                    var anotherCar = carMapping._new();
                    person = personMapping._new();
                    person.cars = [car];
                    changes.resetChanges();
                    person.cars.push(anotherCar);
                    util.next(function () {
                        assert.include(car.owners, person, 'original car should have owner');
                        dump(JSON.stringify(_.map(anotherCar.owners, function (x) {return x._dump()}), null, 4));
                        dump(person._dump(true));
                        assert.include(anotherCar.owners, person, 'new car should have owner');
                        var allChanges = changes.allChanges;
                        assert.equal(allChanges.length, 2);
                        var splicePredicate = function (x) {return x._id === person._id};
                        var spliceChange = _.find(allChanges, splicePredicate);
                        assert.equal(spliceChange.type, ChangeType.Splice);
                        assert.include(spliceChange.added, anotherCar);
                        assert.equal(spliceChange.index, 1);
                        assert.equal(spliceChange.field, 'cars');
                        done();
                    });
                });

                it('splice', function (done) {
                    car = carMapping._new();
                    person = personMapping._new();
                    person.cars = [car];
                    changes.resetChanges();
                    person.cars.splice(0, 1);
                    util.next(function () {
                        var allChanges = changes.allChanges;
                        dump('carChange', _.map(allChanges, function (x) {return x._dump(true)}));
                        assert.equal(allChanges.length, 2);
                        var personPred = function (x) {return x._id === person._id};
                        var personChange = _.find(allChanges, personPred);
                        var carPred = function (x) {return x._id === car._id};
                        var carChange = _.find(allChanges, carPred);
                        assert.include(personChange.removed, car);
                        assert.notOk(car.ownersProxy._id.length);
                        assert.notOk(car.ownersProxy.related.length);
                        assert.equal(personChange.type, ChangeType.Splice);
                        done();
                    });
                });
            });

            describe('fault in the reverse', function () {
                it('push', function (done) {
                    car = carMapping._new();
                    var anotherCar = carMapping._new();
                    person = personMapping._new();
                    person.cars = [car];
                    changes.resetChanges();
                    car.ownersProxy.related = null;
                    person.cars.push(anotherCar);
                    util.next(function () {
                        dump(JSON.stringify(_.map(anotherCar.owners, function (x) {return x._dump()}), null, 4));
                        dump(person._dump(true));
                        var allChanges = changes.allChanges;
                        assert.equal(allChanges.length, 2);
                        var splicePredicate = function (x) {return x._id === person._id};
                        var spliceChange = _.find(allChanges, splicePredicate);
                        assert.equal(spliceChange.type, ChangeType.Splice);
                        assert.include(spliceChange.addedId, anotherCar._id);
                        assert.equal(spliceChange.index, 1);
                        assert.equal(spliceChange.field, 'cars');
                        done();
                    });
                });

                it('splice', function (done) {
                    car = carMapping._new();
                    person = personMapping._new();
                    person.cars = [car];
                    changes.resetChanges();
                    car.ownersProxy.related = null;
                    person.cars.splice(0, 1);
                    util.next(function () {
                        var allChanges = changes.allChanges;
                        dump('carChange', _.map(allChanges, function (x) {return x._dump(true)}));
                        assert.equal(allChanges.length, 2);
                        var personPred = function (x) {return x._id === person._id};
                        var personChange = _.find(allChanges, personPred);
                        var carPred = function (x) {return x._id === car._id};
                        var carChange = _.find(allChanges, carPred);
                        assert.include(personChange.removed, car);
                        assert.notOk(car.ownersProxy._id.length);
                        assert.equal(personChange.type, ChangeType.Splice);
                        done();
                    });
                });
            });




        });

    });
});