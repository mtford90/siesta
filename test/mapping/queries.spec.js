var s = require('../../core/index'),
    assert = require('chai').assert;

describe('mapping queries', function () {

    var SiestaModel = require('../../core/modelInstance'),
        RelationshipType = require('../../core/RelationshipType'),
        cache = require('../../core/cache');

    before(function () {
        s.ext.storageEnabled = false;
    });

    beforeEach(function (done) {
        s.reset(done);
    });

    describe('queries', function () {
        var Collection, Car;
        beforeEach(function (done) {
            Collection = s.collection('myCollection');
            Car = Collection.model('Car', {
                id: 'id',
                attributes: ['color', 'name']
            });
            s.install(function (err) {
                if (err) done(err);
                Car.map([{
                    id: 4,
                    color: 'red',
                    name: 'Aston Martin'
                }, {
                    id: 5,
                    color: 'blue',
                    name: 'Ford'
                }], done);
            });
        });

        it('all', function (done) {
            Car.all().execute(function (err, cars) {
                if (err) done(err);
                assert.equal(cars.length, 2);
                _.each(cars, function (car) {
                    assert.instanceOf(car, SiestaModel);
                });
                done();
            });
        });

        it('query', function (done) {
            this.timeout(10000);
            Car.query({
                color: 'red'
            }).execute(function (err, cars) {
                if (err) done(err);
                assert.equal(cars.length, 1);
                _.each(cars, function (car) {
                    assert.instanceOf(car, SiestaModel);
                });
                done();
            });
        });

        describe('one', function () {
            it('remote id', function (done) {
                Car.one({id: 4}).execute(function (err, car) {
                    if (err) done(err);
                    assert.ok(car);
                    assert.instanceOf(car, SiestaModel);
                    assert.equal(car.color, 'red');
                    done();
                });
            });
            it('error if more than one match', function (done) {
                Car.one({}).execute(function (err) {
                    assert.ok(err);
                    done();
                });
            });
            it('null if no match', function (done) {
                Car.one({id: 10000}).execute(function (err, res) {
                    assert.notOk(err);
                    assert.ok(res === null);
                    done();
                });
            })
        });

    });

    describe('reverse', function () {
        var Car, Person, Collection;

        beforeEach(function (done) {
            Collection = s.collection('myCollection');
            Car = Collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name'],
                relationships: {
                    owner: {
                        type: RelationshipType.OneToMany,
                        reverse: 'cars',
                        model: 'Person'
                    }
                }
            });
            Person = Collection.model('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });
            s.install(done);
        });

        it('cached', function (done) {
            Car.map({
                colour: 'red',
                name: 'Aston Martin',
                owner: {
                    name: 'Michael Ford',
                    age: 2,
                    id: '2'
                },
                id: 5
            }, function (err, car) {
                if (err) done(err);
                Person.one({id: '2'}).execute(function (err, p) {
                    if (err) done(err);
                    assert.ok(p, 'Should be able to fetch the person');
                    p.__proxies['cars'].get(function (err, cars) {
                        assert.equal(cars.length, 1);
                        assert.equal(cars[0].owner, p);
                        done(err);
                    });
                });
            });
        });
    });
});