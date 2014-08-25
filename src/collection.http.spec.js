describe.only('http!', function () {

    var Collection, RelationshipType, Pouch;
    var collection, carMapping, personMapping;

    var carRequestHandler;

    var $rootScope, $httpBackend, $http;


    beforeEach(function () {
        module('restkit.mapping', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });
        module('restkit.relationship', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Collection_, _RelationshipType_, _Pouch_, _$httpBackend_, _$rootScope_, _$http_) {
            _$httpBackend_.expectGET('http://mywebsite.co.uk/cars/')
                .respond({colour: 'red'});
            $httpBackend = _$httpBackend_;
            $rootScope = _$rootScope_;
            Collection = _Collection_;
            RelationshipType = _RelationshipType_;
            Pouch = _Pouch_;
            $http = _$http_;
        });


        Pouch.reset();

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
            $httpBackend.expectGET("/data").respond("pig");
            $rootScope.$apply();
            $http.get("/data")
                .success(function (data) {done()})
                .error(function (status) {console.log('err');done()});
            $rootScope.$apply();

        });

    });

});