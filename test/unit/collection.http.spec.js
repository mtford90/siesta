describe('http!', function () {

    var Collection, RelationshipType, Pouch, RestObject, ResponseDescriptor, DescriptorRegistry, RequestDescriptor, Serialiser;
    var collection, carMapping, personMapping, vitalSignsMapping;

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

        inject(function (_Collection_, _Serialiser_, _RelationshipType_, _Pouch_, _$rootScope_, _RestObject_, _ResponseDescriptor_, _RequestDescriptor_, _DescriptorRegistry_) {
            $rootScope = _$rootScope_;
            Collection = _Collection_;
            RelationshipType = _RelationshipType_;
            Pouch = _Pouch_;
            RestObject = _RestObject_;
            ResponseDescriptor = _ResponseDescriptor_;
            RequestDescriptor = _RequestDescriptor_;
            DescriptorRegistry = _DescriptorRegistry_;
            Serialiser = _Serialiser_;
        });

        server = sinon.fakeServer.create();

        Pouch.reset();

    });

    function configureCollection(configureDescriptors, callback) {
        var configuration = function (err, version) {
            if (err) callback(err);
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
            vitalSignsMapping = collection.registerMapping('VitalSigns', {
                id: 'id',
                attributes: ['heartRate', 'bloodPressure'],
                relationships: {
                    owner: {
                        mapping: 'Person',
                        type: RelationshipType.OneToOne,
                        reverse: 'vitalSigns'
                    }
                }
            });
            collection.baseURL = 'http://mywebsite.co.uk/';
            configureDescriptors();
        };
        collection = new Collection('myCollection', configuration, callback);
    }

    afterEach(function () {
        // Restore original server implementation.
        server.restore();
    });


    describe('path regex', function () {


        describe('check', function () {

            beforeEach(function (done) {
                var configureDescriptors = function () {
                    DescriptorRegistry.registerResponseDescriptor(new ResponseDescriptor({
                        method: 'GET',
                        mapping: carMapping,
                        path: '/cars/(?<id>[0-9])/(?<colour>[a-zA-Z0-9]+)/?'
                    }));
                    DescriptorRegistry.registerResponseDescriptor(new ResponseDescriptor({
                        method: 'GET',
                        mapping: carMapping,
                        path: '/cars/(?<colour>[a-zA-Z0-9]+)/?'
                    }));
                };
                configureCollection(configureDescriptors, done);
            });

            describe('singular', function () {
                var err, obj, resp;

                beforeEach(function (done) {
                    var raw = {colour: 'red', name: 'Aston Martin', owner: '093hodhfno', id: '5'};
                    var headers = { "Content-Type": "application/json" };
                    var path = "http://mywebsite.co.uk/cars/9/purple/";
                    var method = "GET";
                    var status = 200;
                    server.respondWith(method, path, [status, headers, JSON.stringify(raw)]);
                    collection.GET('cars/9/purple/', function (_err, _obj, _resp) {
                        err = _err;
                        obj = _obj;
                        resp = _resp;
                        done();
                    });
                    server.respond();
                });

                it('should map regex matches onto the object', function () {
                    assert.instanceOf(obj, RestObject);
                    assert.equal(obj.colour, 'purple');
                    assert.equal(obj.name, 'Aston Martin');
                    assert.equal(obj.id, '9');
                });
            });

            describe('multiple', function () {
                var err, objs, resp;

                beforeEach(function (done) {
                    var raw = [
                        {colour: 'red', name: 'Aston Martin', owner: '093hodhfno', id: '5'},
                        {colour: 'green', name: 'Aston Martin', owner: '093hodhfno', id: '2'},
                        {colour: 'orange', name: 'Aston Martin', owner: '093hodhfno', id: '1'}
                    ];
                    var headers = { "Content-Type": "application/json" };
                    var path = "http://mywebsite.co.uk/cars/purple/";
                    var method = "GET";
                    var status = 200;
                    server.respondWith(method, path, [status, headers, JSON.stringify(raw)]);
                    collection.GET('cars/purple/', function (_err, _objs, _resp) {
                        err = _err;
                        objs = _objs;
                        resp = _resp;
                        done();
                    });
                    server.respond();
                });

                it('should map regex matches onto the object', function () {
                    assert.notOk(err);
                    assert.ok(objs.length);
                    _.each(objs, function (obj) {
                        assert.equal(obj.colour, 'purple');
                        assert.equal(obj.name, 'Aston Martin');
                    });

                });
            });


        });
    });

    describe('verbs', function () {


        describe('GET', function () {

            beforeEach(function (done) {
                var configureDescriptors = function () {
                    DescriptorRegistry.registerResponseDescriptor(new ResponseDescriptor({
                        method: 'GET',
                        mapping: carMapping,
                        path: '/cars/(?<id>[0-9])/?'
                    }));
                };
                configureCollection(configureDescriptors, done);
            });

            describe('success', function () {
                var err, obj, resp;

                describe('single', function () {
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

                describe('multiple', function () {
                    beforeEach(function (done) {
                        var raw = [
                            {colour: 'red', name: 'Aston Martin', owner: 'ownerId', id: '5'},
                            {colour: 'blue', name: 'Bentley', owner: 'ownerId', id: '6'}
                        ];
                        var headers = { "Content-Type": "application/json" };
                        var path = "http://mywebsite.co.uk/cars/5/";
                        var method = "GET";
                        var status = 200;
                        server.respondWith(method, path, [status, headers, JSON.stringify(raw)]);
                        collection.GET('cars/5/', function (_err, _obj, _resp) {
                            if (_err) done(_err);
                            obj = _obj;
                            resp = _resp;
                            done();
                        });
                        server.respond();
                    });

                    it('returns 2 car objects', function () {
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

        describe('POST', function () {
            var err, obj, resp;
            beforeEach(function (done) {
                var configureDescriptors = function () {
                    var responseDescriptor = new ResponseDescriptor({
                        method: 'POST',
                        mapping: carMapping,
                        path: 'cars/?'
                    });
                    DescriptorRegistry.registerResponseDescriptor(responseDescriptor);
                    var requestDescriptor = new RequestDescriptor({
                        method: 'POST',
                        mapping: carMapping,
                        path: 'cars/?'
                    });
                    DescriptorRegistry.registerRequestDescriptor(requestDescriptor);
                };
                configureCollection(configureDescriptors, function () {
                    done();
                });
            });

            describe('success', function () {
                var car;
                beforeEach(function (done) {
                    console.log(0);
                    var raw = {id: 'remoteId'};
                    var headers = { "Content-Type": "application/json" };
                    var path = "http://mywebsite.co.uk/cars/";
                    var method = "POST";
                    var status = 200;
                    server.respondWith(method, path, [status, headers, JSON.stringify(raw)]);
                    carMapping.map({colour: 'red', name: 'Aston Martin'}, function (err, _car) {
                        if (err) done(err);
                        car = _car;
                        assert.equal(car.colour, 'red');
                        assert.equal(car.name, 'Aston Martin');
                        collection.POST('cars/', car, function (_err, _obj, _resp) {
                            err = _err;
                            obj = _obj;
                            resp = _resp;
                            done();
                        });
                        server.respond();
                    });
                });

                it('no error', function () {
                    assert.notOk(err);
                });

                it('mapped onto the posted object', function () {
                    assert.equal(car, obj);
                    assert.equal(car.id, 'remoteId');
                    assert.equal(car.colour, 'red');
                    assert.equal(car.name, 'Aston Martin');
                });
            });
        });

        describe('PUT', function () {
            var err, obj, resp;
            beforeEach(function (done) {
                var configureDescriptors = function () {
                    var responseDescriptor = new ResponseDescriptor({
                        method: 'PUT',
                        mapping: carMapping,
                        path: '/cars/(?<id>[0-9])/?'
                    });
                    DescriptorRegistry.registerResponseDescriptor(responseDescriptor);
                    var requestDescriptor = new RequestDescriptor({
                        method: 'PUT',
                        mapping: carMapping,
                        path: '/cars/(?<id>[0-9])/?'
                    });
                    DescriptorRegistry.registerRequestDescriptor(requestDescriptor);
                };
                configureCollection(configureDescriptors, function () {
                    done();
                });
            });

            describe('success', function () {
                var car;
                beforeEach(function (done) {
                    console.log(0);
                    var raw = {colour: 'red', name: 'Aston Martin', id: '5'};
                    var headers = { "Content-Type": "application/json" };
                    var path = "http://mywebsite.co.uk/cars/5/";
                    var method = "PUT";
                    var status = 200;
                    server.respondWith(method, path, [status, headers, JSON.stringify(raw)]);
                    carMapping.map({colour: 'red', name: 'Aston Martin', id: '5'}, function (err, _car) {
                        if (err) done(err);
                        car = _car;
                        assert.equal(car.colour, 'red');
                        assert.equal(car.name, 'Aston Martin');
                        assert.equal(car.id, '5');
                        collection.PUT('cars/5/', car, function (_err, _obj, _resp) {
                            err = _err;
                            obj = _obj;
                            resp = _resp;
                            done();
                        });
                        server.respond();
                    });
                });

                it('no error', function () {
                    assert.notOk(err);
                });

                it('mapped onto the posted object', function () {
                    assert.equal(obj, car);
                    assert.equal(car.id, '5');
                    assert.equal(car.colour, 'red');
                    assert.equal(car.name, 'Aston Martin');
                });
            });
        });

        describe('PATCH', function () {
            var err, obj, resp;
            beforeEach(function (done) {
                var configureDescriptors = function () {
                    var responseDescriptor = new ResponseDescriptor({
                        method: 'PATCH',
                        mapping: carMapping,
                        path: '/cars/(?<id>[0-9])/?'
                    });
                    DescriptorRegistry.registerResponseDescriptor(responseDescriptor);
                    var requestDescriptor = new RequestDescriptor({
                        method: 'PATCH',
                        mapping: carMapping,
                        path: '/cars/(?<id>[0-9])/?'
                    });
                    DescriptorRegistry.registerRequestDescriptor(requestDescriptor);
                };
                configureCollection(configureDescriptors, function () {
                    done();
                });
            });

            describe('success', function () {
                var car;
                beforeEach(function (done) {
                    console.log(0);
                    var raw = {colour: 'red', name: 'Aston Martin', id: '5'};
                    var headers = { "Content-Type": "application/json" };
                    var path = "http://mywebsite.co.uk/cars/5/";
                    var method = "PATCH";
                    var status = 200;
                    server.respondWith(method, path, [status, headers, JSON.stringify(raw)]);
                    carMapping.map({colour: 'red', name: 'Aston Martin', id: '5'}, function (err, _car) {
                        if (err) done(err);
                        car = _car;
                        assert.equal(car.colour, 'red');
                        assert.equal(car.name, 'Aston Martin');
                        assert.equal(car.id, '5');
                        collection.PATCH('cars/5/', car, function (_err, _obj, _resp) {
                            err = _err;
                            obj = _obj;
                            resp = _resp;
                            done();
                        });
                        server.respond();
                    });
                });

                it('no error', function () {
                    assert.notOk(err);
                });

                it('mapped onto the posted object', function () {
                    assert.equal(obj, car);
                    assert.equal(car.id, '5');
                    assert.equal(car.colour, 'red');
                    assert.equal(car.name, 'Aston Martin');
                });
            });
        });

        describe('OPTIONS', function () {
            var err, obj, resp;
            beforeEach(function (done) {
                var configureDescriptors = function () {

                };
                configureCollection(configureDescriptors, function () {
                    done();
                });
            });

            describe('success', function () {
                beforeEach(function (done) {
                    var raw = {option: 'something'};
                    var headers = { "Content-Type": "application/json" };
                    var path = "http://mywebsite.co.uk/something/";
                    var method = "OPTIONS";
                    var status = 200;
                    server.respondWith(method, path, [status, headers, JSON.stringify(raw)]);
                    collection.OPTIONS('something/', function (_err, _obj, _resp) {
                        err = _err;
                        obj = _obj;
                        resp = _resp;
                        done();
                    });
                    server.respond();
                });
                it('no err', function () {
                    assert.notOk(err);
                });
                it('no obj', function () {
                    assert.notOk(obj);
                });
                it('resp', function () {
                    assert.ok(resp);
                })
            });
        });

        describe('HEAD', function () {
            var err, obj, resp;
            beforeEach(function (done) {
                var configureDescriptors = function () {

                };
                configureCollection(configureDescriptors, function () {
                    done();
                });
            });

            describe('success', function () {
                beforeEach(function (done) {
                    var raw = {option: 'something'};
                    var headers = { "Content-Type": "application/json" };
                    var path = "http://mywebsite.co.uk/something/";
                    var method = "HEAD";
                    var status = 200;
                    server.respondWith(method, path, [status, headers, JSON.stringify(raw)]);
                    collection.HEAD('something/', function (_err, _obj, _resp) {
                        err = _err;
                        obj = _obj;
                        resp = _resp;
                        done();
                    });
                    server.respond();
                });
                it('no err', function () {
                    assert.notOk(err);
                });
                it('no obj', function () {
                    assert.notOk(obj);
                });
                it('resp', function () {
                    assert.ok(resp);
                })
            });
        });

        /**
         * http://www.w3.org/Protocols/rfc2616/rfc2616-sec9.html
         */
        describe('TRACE', function () {
            var err, obj, resp;
            beforeEach(function (done) {
                var configureDescriptors = function () {
                    var responseDescriptor = new ResponseDescriptor({
                        method: 'TRACE',
                        mapping: carMapping,
                        path: 'cars/'
                    });
                    DescriptorRegistry.registerResponseDescriptor(responseDescriptor);
                    var requestDescriptor = new RequestDescriptor({
                        method: 'TRACE',
                        mapping: carMapping,
                        path: 'cars/'
                    });
                    DescriptorRegistry.registerRequestDescriptor(requestDescriptor);
                };
                configureCollection(configureDescriptors, function () {
                    done();
                });
            });

            describe('success', function () {
                var car;
                beforeEach(function (done) {
                    var raw = {colour: 'red'}; // Trace is supposed to be a reflection of the response body.
                    var headers = { "Content-Type": "message/http" }; // http://www.w3.org/Protocols/rfc2616/rfc2616-sec9.html
                    var path = "http://mywebsite.co.uk/cars/";
                    var method = "TRACE";
                    var status = 200;
                    server.respondWith(method, path, [status, headers, JSON.stringify(raw)]);
                    carMapping.map({colour: 'red'}, function (err, _car) {
                        car = _car;
                        collection.TRACE('cars/', _car, function (_err, _obj, _resp) {
                            err = _err;
                            obj = _obj;
                            resp = _resp;
                            done();
                        });
                        server.respond();
                    });
                });
                it('no err', function () {
                    assert.notOk(err);
                });
                it('obj', function () {
                    assert.ok(obj);
                });
                it('resp', function () {
                    assert.equal(resp.jqXHR.responseText, '{"colour":"red"}');
                    assert.ok(resp);
                })
            });
        });

    });

});