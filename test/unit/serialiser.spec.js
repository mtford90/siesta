describe('serialisers', function () {

    var Pouch, Collection,  RelationshipType, Serialiser;
    var collection, carMapping, personMapping, vitalSignsMapping;

    beforeEach(function () {
        module('restkit.serialiser', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });


        inject(function (_Pouch_, _RawQuery_, _Collection_, _RelationshipType_, _Serialiser_) {
            Pouch = _Pouch_;
            Collection = _Collection_;
            RelationshipType = _RelationshipType_;
            Serialiser = _Serialiser_;
        });

        Pouch.reset();


    });

    describe('id serialiser', function () {
        beforeEach(function (done) {
            collection = new Collection('myCollection', function (err) {
                if (err) done(err);
                personMapping = collection.mapping('Person', {
                    attributes: ['name', 'age']
                });
                carMapping = collection.mapping('Car', {
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
            }, function (err) {
                done(err);
            });
        });
        it('should return the id if has one', function (done) {
            carMapping.map({colour: 'red', name: 'Aston Martin', id: 5}, function (err, car) {
                if (err) done(err);
                assert.equal(Serialiser.idSerialiser(car), car.id);
                done();
            });
        });
        it('should return null if doesnt have an id', function (done) {
            carMapping.map({colour: 'red', name: 'Aston Martin'}, function (err, car) {
                if (err) done(err);
                assert.equal(Serialiser.idSerialiser(car), null);
                done();
            });
        });
        it('should return null if no id field', function (done) {
            personMapping.map({name: 'Michael Ford', id: 5}, function (err, car) {
                if (err) done(err);
                assert.equal(Serialiser.idSerialiser(car), null);
                done();
            });
        });
    });

    describe('depth serialiser', function () {
        beforeEach(function (done) {
            collection = new Collection('myCollection', function (err) {
                if (err) done(err);
                personMapping = collection.mapping('Person', {
                    attributes: ['name', 'age'],
                    id: 'id',
                    relationships: {
                        vitalSigns: {
                            mapping: 'VitalSigns',
                            type: RelationshipType.OneToOne,
                            reverse: 'person'
                        }
                    }
                });
                carMapping = collection.mapping('Car', {
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
                vitalSignsMapping = collection.mapping('VitalSigns', {
                    id: 'id',
                    attributes: ['heartRate', 'bloodPressure']
                });
            }, function (err) {
                done(err);
            });
        });

        it('depth 0', function (done) {
            carMapping.map({colour: 'red', name: 'Aston Martin', id: 5, owner: {name: 'Michael Ford', id: 28}}, function (err, car) {
                if (err) done(err);
                Serialiser.depthSerializer(0)(car, function (err, data) {
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
            carMapping.map({colour: 'red', name: 'Aston Martin', id: 5, owner: {name: 'Michael Ford', id: 28, vitalSigns:{id: 35, heartRate: 65}}}, function (err, car) {
                if (err) done(err);
                Serialiser.depthSerializer(1)(car, function (err, data) {
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
            carMapping.map({colour: 'red', name: 'Aston Martin', id: 5, owner: {name: 'Michael Ford', id: 28, vitalSigns:{id: 35, heartRate: 65}}}, function (err, car) {
                if (err) done(err);
                Serialiser.depthSerializer(2)(car, function (err, data) {
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


});