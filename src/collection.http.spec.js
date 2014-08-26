describe('http!', function () {

    var Collection, RelationshipType, Pouch, RestObject, ResponseDescriptor, DescriptorRegistry;
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

        inject(function (_Collection_, _RelationshipType_, _Pouch_, _$rootScope_, _RestObject_, _ResponseDescriptor_, _DescriptorRegistry_) {
            $rootScope = _$rootScope_;
            Collection = _Collection_;
            RelationshipType = _RelationshipType_;
            Pouch = _Pouch_;
            RestObject = _RestObject_;
            ResponseDescriptor = _ResponseDescriptor_;
            DescriptorRegistry = _DescriptorRegistry_;
        });

        server = sinon.fakeServer.create();

        Pouch.reset();

    });
//
//    afterEach(function () {
//        // Restore original server implementation.
//        server.restore();
//    });

    describe('GET', function () {
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

                var desc = new ResponseDescriptor({
                    method: 'GET',
                    mapping: carMapping,
                    path: '/cars/(?<id>[0-9])/?'
                });
                DescriptorRegistry.registerResponseDescriptor(desc);
            }, function (err) {
                if (err) done(err);
                done();
            });
        });

        describe('success', function () {
            var err, obj, resp;

            describe ('single', function () {
                beforeEach(function (done) {
                    var raw = {colour: 'red', name: 'Aston Martin', owner: '093hodhfno', id: '5'};
                    var headers = { "Content-Type": "application/json" };
                    var path = "http://mywebsite.co.uk/cars/5/";
                    var method = "GET";
                    var status = 200;
                    server.respondWith(method, path, [status, headers, JSON.stringify(raw)]);
                    collection.GET('cars/5/', function (_err, _obj, _resp) {
                        err = _err;
                        obj = _obj;
                        resp = _resp;
                        done();
                    });
                    server.respond();
                });

                it('no error', function () {
                    assert.notOk(err);
                });

                it('returns data', function () {
                    assert.equal(resp.data.colour, 'red');
                    assert.equal(resp.data.name, 'Aston Martin');
                    assert.equal(resp.data.owner, '093hodhfno');
                    assert.equal(resp.data.id, '5');
                });

                it('returns text status', function () {
                    assert.equal(resp.textStatus, 'success');
                });

                it('returns jqxhr', function () {
                    assert.ok(resp.jqXHR);
                });

                it('returns a car object', function () {
                    assert.instanceOf(obj, RestObject);
                    assert.equal(obj.colour, 'red');
                    assert.equal(obj.name, 'Aston Martin');
                    assert.equal(obj.id, '5');
                })
            });

            describe ('multiple', function () {
                beforeEach(function (done) {
                    var raw = [{colour: 'red', name: 'Aston Martin', owner: 'ownerId', id: '5'}, {colour: 'blue', name: 'Bentley', owner:'ownerId', id:'6'}];
                    var headers = { "Content-Type": "application/json" };
                    var path = "http://mywebsite.co.uk/cars/5/";
                    var method = "GET";
                    var status = 200;
                    server.respondWith(method, path, [status, headers, JSON.stringify(raw)]);
                    collection.GET('cars/5/', function (_err, _obj, _resp) {
                        err = _err;
                        obj = _obj;
                        resp = _resp;
                        done();
                    });
                    server.respond();
                });

                it('returns 2 car objects', function () {
                    assert.notOk(err);
                    assert.equal(obj.length, 2);
                    _.each(obj, function (car) {
                        assert.instanceOf(car, RestObject);
                    })
                });

                it('maps owner onto same obj', function () {
                    assert.equal(obj[0].owner._id, obj[1].owner._id);
                    assert.equal(obj[0].owner.relatedObject, obj[1].owner.relatedObject);
                })
            })


        })


    });

});