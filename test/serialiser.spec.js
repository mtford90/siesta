var s = require('../core/index'),
    assert = require('chai').assert;

describe('serialisers', function() {

    var Collection = require('../core/collection');
    var RelationshipType = require('../core/relationship').RelationshipType;

    var collection, carMapping, personMapping, vitalSignsMapping;

    before(function () {
        s.ext.storageEnabled = false;
    });
    beforeEach(function(done) {
        s.reset(done);
    });

    describe('id serialiser', function() {
        beforeEach(function(done) {
            collection = s.collection('myCollection');
            personMapping = collection.model('Person', {
                attributes: ['name', 'age']
            });
            carMapping = collection.model('Car', {
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
            s.install(done);
        });
        it('should return the id if has one', function(done) {
            carMapping.map({
                colour: 'red',
                name: 'Aston Martin',
                id: 5
            }, function(err, car) {
                if (err) done(err);
                assert.equal(siesta.ext.http.Serialiser.idSerialiser(car), car.id);
                done();
            });
        });
        it('should return null if doesnt have an id', function(done) {
            carMapping.map({
                colour: 'red',
                name: 'Aston Martin'
            }, function(err, car) {
                if (err) done(err);
                assert.equal(siesta.ext.http.Serialiser.idSerialiser(car), null);
                done();
            });
        });
        it('should return null if no id field', function(done) {
            personMapping.map({
                name: 'Michael Ford'
            }, function(err, car) {
                if (err) done(err);
                assert.equal(siesta.ext.http.Serialiser.idSerialiser(car), null);
                done();
            });
        });
    });

    describe('depth serialiser', function() {
        beforeEach(function(done) {
            collection = s.collection('myCollection');

            personMapping = collection.model('Person', {
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
            carMapping = collection.model('Car', {
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
            vitalSignsMapping = collection.model('VitalSigns', {
                id: 'id',
                attributes: ['heartRate', 'bloodPressure']
            });
            s.install(done);

        });

        it('depth 0', function(done) {
            carMapping.map({
                colour: 'red',
                name: 'Aston Martin',
                id: 5,
                owner: {
                    name: 'Michael Ford',
                    id: 28
                }
            }, function(err, car) {
                if (err) done(err);
                siesta.ext.http.Serialiser.depthSerializer(0)(car, function(err, data) {
                    if (err) done(err);
                    assert.equal(data.colour, car.colour);
                    assert.equal(data.name, car.name);
                    assert.equal(data.id, car.id);
                    assert.equal(data.owner, 28);
                    done();
                });
            });
        });

        it('depth 1', function(done) {
            carMapping.map({
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
            }, function(err, car) {
                if (err) done(err);
                siesta.ext.http.Serialiser.depthSerializer(1)(car, function(err, data) {
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

        it('depth 2', function(done) {
            carMapping.map({
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
            }, function(err, car) {
                if (err) done(err);
                siesta.ext.http.Serialiser.depthSerializer(2)(car, function(err, data) {
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

    describe('availibility on siesta', function() {
        it('id, anglophone', function () {
            console.log('eh');
            console.log('s.serialisers', s.serialisers);
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