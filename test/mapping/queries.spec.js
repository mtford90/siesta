var assert = require('chai').assert,
    RelationshipType = siesta.RelationshipType,
    ModelInstance = siesta._internal.ModelInstance;

describe('mapping queries', function () {

    before(function () {
        siesta.ext.storageEnabled = false;
    });

    beforeEach(function (done) {
        siesta.reset(done);
    });

    describe('queries', function () {
        var Collection, Car;
        beforeEach(function (done) {
            Collection = siesta.collection('myCollection');
            Car = Collection.model('Car', {
                id: 'id',
                attributes: ['color', 'name']
            });
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

        it('all', function (done) {
            Car.all(function (err, cars) {
                if (err) done(err);
                assert.equal(cars.length, 2);
                _.each(cars, function (car) {
                    assert.instanceOf(car, ModelInstance);
                });
                done();
            });
        });

        it('query', function (done) {
            this.timeout(10000);
            Car.query({
                color: 'red'
            }, function (err, cars) {
                if (err) done(err);
                assert.equal(cars.length, 1);
                _.each(cars, function (car) {
                    assert.instanceOf(car, ModelInstance);
                });
                done();
            });
        });

        describe('one', function () {
            it('remote id', function (done) {
                Car.one({id: 4}, function (err, car) {
                    if (err) done(err);
                    assert.ok(car);
                    assert.instanceOf(car, ModelInstance);
                    assert.equal(car.color, 'red');
                    done();
                });
            });
            it('error if more than one match', function (done) {
                Car.one({}, function (err) {
                    assert.ok(err);
                    done();
                });
            });
            it('null if no match', function (done) {
                Car.one({id: 10000}, function (err, res) {
                    assert.notOk(err);
                    assert.ok(res === null);
                    done();
                });
            })
        });

    });

    describe('reverse', function () {
        var Car, Person, Collection;

        beforeEach(function () {
            Collection = siesta.collection('myCollection');
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
                Person.one({id: '2'}, function (err, p) {
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