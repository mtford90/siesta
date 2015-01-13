var s = require('../core/index'),
    assert = require('chai').assert;

describe('serialisers', function () {

    var RelationshipType = require('../core/RelationshipType');

    var Collection, Car, Person, VitalSigns;

    before(function () {
        s.ext.storageEnabled = false;
    });

    beforeEach(function (done) {
        s.reset(done);
    });

    describe('id serialiser', function () {
        beforeEach(function () {
            Collection = s.collection('myCollection');
            Person = Collection.model('Person', {
                attributes: ['name', 'age']
            });
            Car = Collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name'],
                relationships: {
                    owner: {
                        model: 'Person',
                        type: RelationshipType.OneToMany,
                        reverse: 'cars'
                    }
                }
            });
        });
        it('should return the id if has one', function (done) {
            Car.map({
                colour: 'red',
                name: 'Aston Martin',
                id: 5
            }, function (err, car) {
                if (err) done(err);
                assert.equal(siesta.ext.http.Serialiser.idSerialiser(car), car.id);
                done();
            });
        });
        it('should return null if doesnt have an id', function (done) {
            Car.map({
                colour: 'red',
                name: 'Aston Martin'
            }, function (err, car) {
                if (err) done(err);
                assert.equal(siesta.ext.http.Serialiser.idSerialiser(car), null);
                done();
            });
        });
        it('should return null if no id field', function (done) {
            Person.map({
                name: 'Michael Ford'
            }, function (err, car) {
                if (err) done(err);
                assert.equal(siesta.ext.http.Serialiser.idSerialiser(car), null);
                done();
            });
        });
    });

    describe('depth serialiser', function () {
        beforeEach(function () {
            Collection = s.collection('myCollection');
            Person = Collection.model('Person', {
                attributes: ['name', 'age'],
                id: 'id',
                relationships: {
                    vitalSigns: {
                        model: 'VitalSigns',
                        type: RelationshipType.OneToOne,
                        reverse: 'person'
                    }
                }
            });
            Car = Collection.model('Car', {
                id: 'id',
                attributes: ['colour', 'name'],
                relationships: {
                    owner: {
                        model: 'Person',
                        type: RelationshipType.OneToMany,
                        reverse: 'cars'
                    }
                }
            });
            VitalSigns = Collection.model('VitalSigns', {
                id: 'id',
                attributes: ['heartRate', 'bloodPressure']
            });
        });

        it('depth 0', function (done) {
            Car.map({
                colour: 'red',
                name: 'Aston Martin',
                id: 5,
                owner: {
                    name: 'Michael Ford',
                    id: 28
                }
            }, function (err, car) {
                if (err) done(err);
                siesta.ext.http.Serialiser.depthSerializer(0)(car, function (err, data) {
                    if (err) done(err);
                    assert.equal(data.colour, car.colour);
                    assert.equal(data.name, car.name);
                    assert.equal(data.id, car.id);
                    assert.equal(data.owner, 28);
                    done();
                });
            });
        });

        it('depth 1', function (done) {
            Car.map({
                colour: 'red',
                name: 'Aston Martin',
                id: 5,
                owner: {
                    name: 'Michael Ford',
                    id: 28,
                    vitalSigns: {
                        id: 35,
                        heartRate: 65
                    }
                }
            }, function (err, car) {
                if (err) done(err);
                siesta.ext.http.Serialiser.depthSerializer(1)(car, function (err, data) {
                    if (err) done(err);
                    assert.equal(data.colour, car.colour);
                    assert.equal(data.name, car.name);
                    assert.equal(data.id, car.id);
                    assert.equal(data.owner.id, 28);
                    assert.equal(data.owner.vitalSigns, 35);
                    done();
                });
            });
        });

        it('depth 2', function (done) {
            Car.map({
                colour: 'red',
                name: 'Aston Martin',
                id: 5,
                owner: {
                    name: 'Michael Ford',
                    id: 28,
                    vitalSigns: {
                        id: 35,
                        heartRate: 65
                    }
                }
            }, function (err, car) {
                if (err) done(err);
                siesta.ext.http.Serialiser.depthSerializer(2)(car, function (err, data) {
                    if (err) done(err);
                    assert.equal(data.colour, car.colour);
                    assert.equal(data.name, car.name);
                    assert.equal(data.id, car.id);
                    assert.equal(data.owner.id, 28);
                    assert.equal(data.owner.vitalSigns.heartRate, 65);
                    done();
                });
            });
        });

    });

    describe('availibility on siesta', function () {
        it('id, anglophone', function () {
            assert.equal(s.serialisers.id, siesta.ext.http.Serialiser.idSerialiser);
        });

        it('depth, anglophone', function () {
            assert.equal(s.serialisers.depth, siesta.ext.http.Serialiser.depthSerializer);
        });
        it('id, american', function () {
            assert.equal(s.serializers.id, siesta.ext.http.Serialiser.idSerialiser);
        });

        it('depth, american', function () {
            assert.equal(s.serializers.depth, siesta.ext.http.Serialiser.depthSerializer);
        });
    });


});