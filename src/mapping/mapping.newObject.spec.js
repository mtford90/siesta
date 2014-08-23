describe('mapping new object', function () {

    var Pouch, RawQuery, RestAPI, RestError, RelationshipType, RelatedObjectProxy;

    beforeEach(function () {
        module('restkit.mapping', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });
        module('restkit.relationship', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Index_, _Pouch_, _Indexes_, _RawQuery_, _Mapping_, _RestObject_, _RestAPI_, _RestError_, _RelationshipType_, _RelatedObjectProxy_) {
            Pouch = _Pouch_;
            RawQuery = _RawQuery_;
            RestAPI = _RestAPI_;
            RelationshipType = _RelationshipType_;
            RelatedObjectProxy = _RelatedObjectProxy_;
        });

        Pouch.reset();

    });

    describe('fields', function () {
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

    describe('relationships', function () {
        var api, carMapping, personMapping;

        function configureAPI(type, reverseName, done) {
            api = new RestAPI('myApi', function (err, version) {
                if (err) done(err);

                carMapping = api.registerMapping('Car', {
                    id: 'id',
                    attributes: ['colour', 'name'],
                    relationships: {
                        owner: {
                            mapping: 'Person',
                            type: type,
                            reverse: reverseName
                        }
                    }
                });
                personMapping = api.registerMapping('Person', {
                    id: 'id',
                    attributes: ['age', 'name']
                });
            }, function () {
                done();
            });
        }

        beforeEach(function (done) {
            configureAPI(RelationshipType.ForeignKey, 'cars', done);
        });

        describe('installation of proxies', function () {
            it('installs related object proxies', function () {
                var personObject = personMapping._new({
                    name: 'Michael Ford',
                    age: 23,
                    id: 'remotePersonId'
                });
                assert.ok(personObject._id);
                var carObject = carMapping._new({
                    colour: 'red',
                    name: 'Aston Martin',
                    invalidField: 'invalid',
                    id: 'remoteCarId',
                    owner: personObject._id
                });
                assert.instanceOf(carObject.owner, RelatedObjectProxy);
                assert.equal(carObject.owner._id, personObject._id);
            });
        });



    });

});
