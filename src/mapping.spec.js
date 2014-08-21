describe('mapping!', function () {

    var Index, Pouch, Indexes, RawQuery, Mapping, RestObject, RestAPI, RestError, RelationshipType;

    beforeEach(function () {
        module('restkit.mapping', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Index_, _Pouch_, _Indexes_, _RawQuery_, _Mapping_, _RestObject_, _RestAPI_, _RestError_, _RelationshipType_) {
            Index = _Index_;
            Indexes = _Indexes_;
            Pouch = _Pouch_;
            RawQuery = _RawQuery_;
            Mapping = _Mapping_;
            RestObject = _RestObject_;
            RestAPI = _RestAPI_;
            RestError = _RestError_;
            RelationshipType = _RelationshipType_
        });

        Pouch.reset();

    });

    it('_fields', function () {
        var m = new Mapping({
            type: 'type',
            id: 'id',
            attributes: ['field1', 'field2']
        });
        assert.include(m._fields, 'id');
        assert.include(m._fields, 'field1');
        assert.include(m._fields, 'field2');
        assert.notInclude(m._fields, 'type');
    });

    it('attributes', function () {
        var m = new Mapping({
            type: 'type',
            id: 'id',
            attributes: ['field1', 'field2']
        });
        assert.include(m.attributes, 'field1');
        assert.include(m.attributes, 'field2');
    });

    it('type', function () {
        var m = new Mapping({
            type: 'type',
            id: 'id',
            attributes: ['field1', 'field2']
        });
        assert.equal(m.type, 'type');
    });

    it('id', function () {
        var m = new Mapping({
            type: 'type',
            id: 'id',
            attributes: ['field1', 'field2']
        });
        assert.equal(m.id, 'id');
    });

    it('installation', function (done) {
        var m = new Mapping({
            type: 'Type',
            id: 'id',
            attributes: ['field1', 'field2'],
            api: 'myApi'
        });
        m.install(function (err) {
            if (err) done(err);
            assert.equal(Index.indexes.length, 8);
            done();
        });
    });

    describe('validation', function () {
        it('no type', function () {
            var m = new Mapping({
                id: 'id',
                attributes: ['field1', 'field2'],
                api: 'myApi'
            });
            var errors = m._validate();
            console.log('errors:', errors);
            assert.equal(1, errors.length);
        });
        it('no api', function () {
            var m = new Mapping({
                id: 'id',
                attributes: ['field1', 'field2'],
                type: 'Car'
            });
            var errors = m._validate();
            console.log('errors:', errors);
            assert.equal(1, errors.length);
        });
    });

    describe('queries', function () {



        var api, mapping;
        beforeEach(function (done) {
            api = new RestAPI('myApi', function (err) {
                if (err) done(err);
                mapping = api.registerMapping('Car', {
                    id: 'id',
                    attributes: ['color', 'name']
                });
            }, function (err) {
                if (err) done(err);
                Pouch.getPouch().bulkDocs([
                    {
                        type: 'Car',
                        id: 4,
                        color: 'red',
                        name: 'Aston Martin',
                        api: 'myApi'
                    },
                    {
                        type: 'Car',
                        id: 5,
                        color: 'blue',
                        name: 'Ford',
                        api: 'myApi'
                    }
                ], function (err) {
                    done(err);
                });
            });
        });

        it('all', function (done) {
            mapping.all(function (err, cars) {
                if (err) done(err);
                assert.equal(cars.length, 2);
                _.each(cars, function (car) {
                    assert.instanceOf(car, RestObject);
                });
                done();
            });
        });

        it('query', function (done) {
            mapping.query({color: 'red'}, function (err, cars) {
                if (err) done(err);
                assert.equal(cars.length, 1);
                _.each(cars, function (car) {
                    assert.instanceOf(car, RestObject);
                });
                done();
            });
        });

        it('get', function (done) {
            mapping.get(4, function (err, car) {
                if (err) done(err);
                assert.ok(car);
                assert.instanceOf(car, RestObject);
                assert.equal(car.color, 'red');
                done();
            });
        });

    });

    describe('mapping', function () {
        var api, carMapping;

        beforeEach(function (done) {
            api = new RestAPI('myApi', function (err, version) {
                if (err) done(err);
                carMapping = api.registerMapping('Car', {
                    id: 'id',
                    attributes: ['colour', 'name']
                });
            }, function () {
                done();
            });
        });

        describe('new object', function () {
            it('valid', function () {
                var r = carMapping._new({colour: 'red', name: 'Aston Martin', invalidField: 'invalid', id: 'xyz'});
                assert.equal(r.colour, 'red');
                assert.equal(r.name, 'Aston Martin');
                assert.equal(r.id, 'xyz');
                assert.ok(r._id);
                assert.notOk(r.invalidField);
            });
            it('no id should cause an error', function () {
                var invocation = _.bind(carMapping._new, carMapping, {colour: 'red', name: 'Aston Martin', invalidField: 'invalid'});
                assert.throws(invocation, RestError);
            });
        });

    });

    describe.only('relationships', function () {

        var api, carMapping, personMapping;

        beforeEach(function (done) {
            api = new RestAPI('myApi', function (err, version) {
                if (err) done(err);
                carMapping = api.registerMapping('Car', {
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
                personMapping = api.registerMapping('Person', {
                    id: 'id',
                    attributes: ['name', 'age']
                });
            }, function (err) {
                done(err);
            });
        });

        describe('Valid relationships', function () {
            it('Foreign Key', function () {
                var relationships = carMapping.relationships;
                console.log('relationships:', relationships);
                assert.equal(relationships.length, 1);
                var relationship = relationships[0];
                inject(function (ForeignKeyRelationship) {
                    assert.instanceOf(relationship, ForeignKeyRelationship);
                });
                assert.equal(relationship.mapping, carMapping);
                assert.equal(relationship.reverseMapping, personMapping);
            })
        });



    });


});