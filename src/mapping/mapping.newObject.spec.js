describe('mapping new object', function () {

    var Pouch, RawQuery, Collection, RestError, RelationshipType, RelatedObjectProxy;

    beforeEach(function () {
        module('restkit.mapping', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });
        module('restkit.relationship', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Index_, _Pouch_, _Indexes_, _RawQuery_, _Mapping_, _RestObject_, _Collection_, _RestError_, _RelationshipType_, _RelatedObjectProxy_) {
            Pouch = _Pouch_;
            RawQuery = _RawQuery_;
            Collection = _Collection_;
            RelationshipType = _RelationshipType_;
            RelatedObjectProxy = _RelatedObjectProxy_;
        });

        Pouch.reset();

    });

    describe('fields', function () {
        var api, carMapping;

        beforeEach(function (done) {
            api = new Collection('myApi', function (err, version) {
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
            var car = carMapping._new();
            _.each(carMapping._fields, function (f) {
                assert(car[f] !== undefined);
            });
        });

    });

    describe('relationships', function () {
        var api, carMapping, personMapping;

        function configureAPI(type, reverseName, done) {
            api = new Collection('myApi', function (err, version) {
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

            it('installs forward related object proxy', function () {
                var carObject = carMapping._new();
                assert.instanceOf(carObject.owner, RelatedObjectProxy);
            });

            it('installs reverse related object proxy', function () {
                var personObject = personMapping._new();
                assert.instanceOf(personObject.cars, RelatedObjectProxy);
            });

        });



    });

});
