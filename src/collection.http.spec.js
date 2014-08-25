describe.only('http!', function () {

    var Collection, RelationshipType, Pouch;
    var collection, carMapping, personMapping;


    var $rootScope;
    var server;


    beforeEach(function () {
        module('restkit.mapping', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });
        module('restkit.relationship', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Collection_, _RelationshipType_, _Pouch_, _$rootScope_) {
            $rootScope = _$rootScope_;
            Collection = _Collection_;
            RelationshipType = _RelationshipType_;
            Pouch = _Pouch_;
        });

        server = sinon.fakeServer.create();

        Pouch.reset();

    });

    afterEach(function () {
        // Restore original server implementation.
        server.restore();
    });

    describe('foreign key', function () {
        beforeEach(function (done) {
            collection = new Collection('myCollection', function (err, version) {
                if (err) done(err);
                personMapping = collection.registerMapping('Person', {
                    id: 'id',
                    attributes: ['name', 'age']
                });
                carMapping = collection.registerMapping('Car', {
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
                collection.baseURL = 'http://mywebsite.co.uk/';
            }, function (err) {
                if (err) done(err);
                done();
            });
        });


        it('xyz', function (done) {
            server.respondWith("GET", "http://mywebsite.co.uk/cars/",
                [200, { "Content-Type": "application/json" },
                    JSON.stringify([{colour: 'red', name: 'Aston Martin', owner: '093hodhfno'}])]);
            collection.GET('cars/', function (err, data) {
                dump(data);
                done(err);
            });
            server.respond();
        });

    });

});