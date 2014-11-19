var s = require('../index'),
    assert = require('chai').assert;


describe('http!', function () {

    var Collection = require('../src/collection').Collection;
    var RelationshipType = require('../src/relationship').RelationshipType;
    var SiestaModel = require('../src/siestaModel').SiestaModel;
    var InternalSiestaError = require('../src/error').InternalSiestaError;

    var collection, carMapping, personMapping, vitalSignsMapping;

    var server;

    beforeEach(function () {
        s.reset(true);
        server = sinon.fakeServer.create();
    });

    afterEach(function () {
        // Restore original server implementation.
        server.restore();
    });

    function configureCollection(callback) {
        collection = new Collection('myCollection');
        personMapping = collection.mapping('Person', {
            id: 'id',
            attributes: ['name', 'age']
        });
        carMapping = collection.mapping('Car', {
            id: 'id',
            attributes: ['colour', 'name'],
            relationships: {
                owner: {
                    mapping: 'Person',
                    type: RelationshipType.OneToMany,
                    reverse: 'cars'
                }
            }
        });
        vitalSignsMapping = collection.mapping('VitalSigns', {
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
        collection.install(callback);
    }


    describe('path regex', function () {


        describe('check', function () {

            beforeEach(function (done) {
                configureCollection(done);
                siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(new siesta.ext.http.ResponseDescriptor({
                    method: 'GET',
                    mapping: carMapping,
                    path: '/cars/(?<id>[0-9])/(?<colour>[a-zA-Z0-9]+)/?'
                }));
                siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(new siesta.ext.http.ResponseDescriptor({
                    method: 'GET',
                    mapping: carMapping,
                    path: '/cars/(?<colour>[a-zA-Z0-9]+)/?'
                }));
            });

            describe('singular', function () {
                var err, obj, resp;

                beforeEach(function (done) {
                    var raw = {
                        colour: 'red',
                        name: 'Aston Martin',
                        owner: '093hodhfno',
                        id: '5'
                    };
                    var headers = {
                        "Content-Type": "application/json"
                    };
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
                    assert.instanceOf(obj, SiestaModel);
                    assert.equal(obj.colour, 'purple');
                    assert.equal(obj.name, 'Aston Martin');
                    assert.equal(obj.id, '9');
                });
            });

            describe('multiple', function () {
                var err, objs, resp;

                beforeEach(function (done) {
                    var raw = [{
                        colour: 'red',
                        name: 'Aston Martin',
                        owner: '093hodhfno',
                        id: '5'
                    }, {
                        colour: 'green',
                        name: 'Aston Martin',
                        owner: '093hodhfno',
                        id: '2'
                    }, {
                        colour: 'orange',
                        name: 'Aston Martin',
                        owner: '093hodhfno',
                        id: '1'
                    }];
                    var headers = {
                        "Content-Type": "application/json"
                    };
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

                configureCollection(done);

            });

            describe('success', function () {
                var err, obj, resp;

                describe('single', function () {
                    beforeEach(function (done) {
                        siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(new siesta.ext.http.ResponseDescriptor({
                            method: 'GET',
                            mapping: carMapping,
                            path: '/cars/(?<id>[0-9])/?'
                        }));
                        var raw = {
                            colour: 'red',
                            name: 'Aston Martin',
                            owner: '093hodhfno',
                            id: '5'
                        };
                        var headers = {
                            "Content-Type": "application/json"
                        };
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
                        assert.instanceOf(obj, SiestaModel);
                        assert.equal(obj.colour, 'red');
                        assert.equal(obj.name, 'Aston Martin');
                        assert.equal(obj.id, '5');
                    })
                });

                describe('multiple', function () {
                    beforeEach(function (done) {
                        siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(new siesta.ext.http.ResponseDescriptor({
                            method: 'GET',
                            mapping: carMapping,
                            path: '/cars/?'
                        }));
                        var raw = [{
                            colour: 'red',
                            name: 'Aston Martin',
                            owner: 'ownerId',
                            id: '5'
                        }, {
                            colour: 'blue',
                            name: 'Bentley',
                            owner: 'ownerId',
                            id: '6'
                        }];
                        var headers = {
                            "Content-Type": "application/json"
                        };
                        var path = "http://mywebsite.co.uk/cars/";
                        var method = "GET";
                        var status = 200;
                        server.respondWith(method, path, [status, headers, JSON.stringify(raw)]);
                        collection.GET('cars/', function (_err, _obj, _resp) {
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
                            assert.instanceOf(car, SiestaModel);
                        })
                    });

                    it('maps owner onto same obj', function () {
                        assert.equal(obj[0].owner._id, obj[1].owner._id);
                        assert.equal(obj[0].owner.relatedObject, obj[1].owner.relatedObject);
                    });
                });
            });
        });

        describe('DELETE', function () {
            beforeEach(function (done) {
                configureCollection(done);
            });

            describe('success', function () {
                describe('default', function (done) {
                    var err, obj, resp, objectToDelete;

                    beforeEach(function (done) {
                        var data = {
                            id: 'xyz',
                            colour: 'red',
                            name: 'Aston Martin'
                        };
                        carMapping.map(data, function (err, _objectToDelete) {
                            if (err) done(err);
                            objectToDelete = _objectToDelete;
                            siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(new siesta.ext.http.ResponseDescriptor({
                                method: 'DELETE',
                                mapping: carMapping,
                                path: '/cars/(?<id>[0-9])/?'
                            }));
                            var headers = {
                                "Content-Type": "application/json"
                            };
                            var path = "http://mywebsite.co.uk/cars/5/";
                            var method = "DELETE";
                            var status = 200;
                            server.respondWith(method, path, [status, headers, '{"status": "ok"}']);
                            collection.DELETE('cars/5/', _objectToDelete, function (_err, _obj, _resp) {
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

                    it('returns text status', function () {
                        assert.equal(resp.textStatus, 'success');
                    });

                    it('returns jqxhr', function () {
                        assert.ok(resp.jqXHR);
                    });

                    it('returns no object', function () {
                        assert.notOk(obj);
                    });

                    it('removed', function () {
                        assert.ok(objectToDelete.removed);
                    });
                });

                describe('delete now', function () {
                    it('should be removed', function (done) {
                        var data = {
                            id: 'xyz',
                            colour: 'red',
                            name: 'Aston Martin'
                        };
                        carMapping.map(data, function (err, _objectToDelete) {
                            if (err) done(err);
                            objectToDelete = _objectToDelete;
                            siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(new siesta.ext.http.ResponseDescriptor({
                                method: 'DELETE',
                                mapping: carMapping,
                                path: '/cars/(?<id>[0-9])/?'
                            }));
                            var headers = {
                                "Content-Type": "application/json"
                            };
                            var path = "http://mywebsite.co.uk/cars/5/";
                            var method = "DELETE";
                            var status = 200;
                            server.respondWith(method, path, [status, headers, '{"status": "ok"}']);
                            collection.DELETE('cars/5/', _objectToDelete, {
                                deletionMode: 'now'
                            }, function (_err, _obj, _resp) {
                                assert.ok(_objectToDelete.removed)
                                done();
                            });
                            assert.ok(_objectToDelete.removed);
                            server.respond();
                        });
                    });
                });

                describe('on success', function () {
                    it('should only be removed once finished', function (done) {
                        var data = {
                            id: 'xyz',
                            colour: 'red',
                            name: 'Aston Martin'
                        };
                        carMapping.map(data, function (err, _objectToDelete) {
                            if (err) done(err);
                            objectToDelete = _objectToDelete;
                            siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(new siesta.ext.http.ResponseDescriptor({
                                method: 'DELETE',
                                mapping: carMapping,
                                path: '/cars/(?<id>[0-9])/?'
                            }));
                            var headers = {
                                "Content-Type": "application/json"
                            };
                            var path = "http://mywebsite.co.uk/cars/5/";
                            var method = "DELETE";
                            var status = 200;
                            server.respondWith(method, path, [status, headers, '{"status": "ok"}']);
                            collection.DELETE('cars/5/', _objectToDelete, {
                                deletionMode: 'success'
                            }, function (_err, _obj, _resp) {
                                assert.ok(_objectToDelete.removed)
                                done();
                            });
                            assert.notOk(_objectToDelete.removed);
                            server.respond();
                        });
                    });
                });

                describe('restore', function () {
                    it('should be restored on failure', function (done) {
                        var data = {
                            id: 'xyz',
                            colour: 'red',
                            name: 'Aston Martin'
                        };
                        carMapping.map(data, function (err, _objectToDelete) {
                            if (err) done(err);
                            objectToDelete = _objectToDelete;
                            siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(new siesta.ext.http.ResponseDescriptor({
                                method: 'DELETE',
                                mapping: carMapping,
                                path: '/cars/(?<id>[0-9])/?'
                            }));
                            var headers = {
                                "Content-Type": "application/json"
                            };
                            var path = "http://mywebsite.co.uk/cars/5/";
                            var method = "DELETE";
                            var status = 500;
                            server.respondWith(method, path, [status, headers, '{"status": "ok"}']);
                            collection.DELETE('cars/5/', _objectToDelete, {
                                deletionMode: 'restore'
                            }, function (_err, _obj, _resp) {
                                assert.notOk(_objectToDelete.removed)
                                done();
                            });
                            assert.ok(_objectToDelete.removed);
                            server.respond();
                        });
                    });
                });
            });

        });

        describe('POST', function () {
            var err, obj, resp;
            beforeEach(function (done) {
                configureCollection(done);
                var responseDescriptor = new siesta.ext.http.ResponseDescriptor({
                    method: 'POST',
                    mapping: carMapping,
                    path: 'cars/?'
                });
                siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(responseDescriptor);
                var requestDescriptor = new siesta.ext.http.RequestDescriptor({
                    method: 'POST',
                    mapping: carMapping,
                    path: 'cars/?'
                });
                siesta.ext.http.DescriptorRegistry.registerRequestDescriptor(requestDescriptor);
            });

            describe('success', function () {
                var car;
                beforeEach(function (done) {
                    var raw = {
                        id: 'remoteId'
                    };
                    var headers = {
                        "Content-Type": "application/json"
                    };
                    var path = "http://mywebsite.co.uk/cars/";
                    var method = "POST";
                    var status = 200;
                    server.respondWith(method, path, [status, headers, JSON.stringify(raw)]);
                    carMapping.map({
                        colour: 'red',
                        name: 'Aston Martin'
                    }, function (err, _car) {
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
                configureCollection(done);
                var responseDescriptor = new siesta.ext.http.ResponseDescriptor({
                    method: 'PUT',
                    mapping: carMapping,
                    path: '/cars/(?<id>[0-9])/?'
                });
                siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(responseDescriptor);
                var requestDescriptor = new siesta.ext.http.RequestDescriptor({
                    method: 'PUT',
                    mapping: carMapping,
                    path: '/cars/(?<id>[0-9])/?'
                });
                siesta.ext.http.DescriptorRegistry.registerRequestDescriptor(requestDescriptor);
            });

            describe('success', function () {
                var car;
                beforeEach(function (done) {
                    var raw = {
                        colour: 'red',
                        name: 'Aston Martin',
                        id: '5'
                    };
                    var headers = {
                        "Content-Type": "application/json"
                    };
                    var path = "http://mywebsite.co.uk/cars/5/";
                    var method = "PUT";
                    var status = 200;
                    server.respondWith(method, path, [status, headers, JSON.stringify(raw)]);
                    carMapping.map({
                        colour: 'red',
                        name: 'Aston Martin',
                        id: '5'
                    }, function (err, _car) {
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
                configureCollection(function () {
                    var responseDescriptor = new siesta.ext.http.ResponseDescriptor({
                        method: 'PATCH',
                        mapping: carMapping,
                        path: '/cars/(?<id>[0-9])/?'
                    });
                    siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(responseDescriptor);
                    var requestDescriptor = new siesta.ext.http.RequestDescriptor({
                        method: 'PATCH',
                        mapping: carMapping,
                        path: '/cars/(?<id>[0-9])/?'
                    });
                    siesta.ext.http.DescriptorRegistry.registerRequestDescriptor(requestDescriptor);
                    done();
                });
            });

            describe('success', function () {
                var car;
                beforeEach(function (done) {
                    var raw = {
                        colour: 'red',
                        name: 'Aston Martin',
                        id: '5'
                    };
                    var headers = {
                        "Content-Type": "application/json"
                    };
                    var path = "http://mywebsite.co.uk/cars/5/";
                    var method = "PATCH";
                    var status = 200;
                    server.respondWith(method, path, [status, headers, JSON.stringify(raw)]);
                    carMapping.map({
                        colour: 'red',
                        name: 'Aston Martin',
                        id: '5'
                    }, function (err, _car) {
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

                it('')
            });


        });

        describe('OPTIONS', function () {
            var err, obj, resp;
            beforeEach(function (done) {
                configureCollection(done);
            });

            describe('success', function () {
                beforeEach(function (done) {
                    var raw = {
                        option: 'something'
                    };
                    var headers = {
                        "Content-Type": "application/json"
                    };
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
                configureCollection(done);
            });

            describe('success', function () {
                beforeEach(function (done) {
                    var raw = {
                        option: 'something'
                    };
                    var headers = {
                        "Content-Type": "application/json"
                    };
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
                configureCollection(done);
                var responseDescriptor = new siesta.ext.http.ResponseDescriptor({
                    method: 'TRACE',
                    mapping: carMapping,
                    path: 'cars/'
                });
                siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(responseDescriptor);
                var requestDescriptor = new siesta.ext.http.RequestDescriptor({
                    method: 'TRACE',
                    mapping: carMapping,
                    path: 'cars/'
                });
                siesta.ext.http.DescriptorRegistry.registerRequestDescriptor(requestDescriptor);
            });

            describe('success', function () {
                var car;
                beforeEach(function (done) {
                    var raw = {
                        colour: 'red'
                    }; // Trace is supposed to be a reflection of the response body.
                    var headers = {
                        "Content-Type": "message/http"
                    }; // http://www.w3.org/Protocols/rfc2616/rfc2616-sec9.html
                    var path = "http://mywebsite.co.uk/cars/";
                    var method = "TRACE";
                    var status = 200;
                    server.respondWith(method, path, [status, headers, JSON.stringify(raw)]);
                    carMapping.map({
                        colour: 'red'
                    }, function (err, _car) {
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

    describe('ajax', function () {
        var dollar;
        var fakeDollar = {
            ajax: function () {}
        }

        before(function () {
            dollar = $;
        });

        beforeEach(function () {
            $ = fakeDollar;
            jQuery = fakeDollar;
        });

        after(function () {
            $ = dollar;
        });

        it('default', function () {
            assert.equal(s.ext.http.ajax, fakeDollar.ajax);
        });

        it('no $', function () {
            $ = undefined;
            assert.equal(s.ext.http.ajax, fakeDollar.ajax);
        });

        it('no ajax at all', function () {
            $ = undefined;
            jQuery = undefined;
            assert.throws(function () {
                var a = s.ext.http.ajax;
            }, InternalSiestaError);
        });

        it('set ajax', function () {
            var fakeAjax = function () {};
            s.setAjax(fakeAjax);
            assert.equal(s.ext.http.ajax, fakeAjax);
            assert.equal(s.getAjax(), fakeAjax);
        });

    });

    describe('specific fields', function () {
        beforeEach(function (done) {
            configureCollection(function () {
                var responseDescriptor = new siesta.ext.http.ResponseDescriptor({
                    method: 'PATCH',
                    mapping: carMapping,
                    path: '/cars/(?<id>[0-9])/?'
                });
                siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(responseDescriptor);
                var requestDescriptor = new siesta.ext.http.RequestDescriptor({
                    method: 'PATCH',
                    mapping: carMapping,
                    path: '/cars/(?<id>[0-9])/?'
                });
                siesta.ext.http.DescriptorRegistry.registerRequestDescriptor(requestDescriptor);
                carMapping.map({
                    colour: 'red',
                    name: 'Aston Martin',
                    id: '5'
                }, function (err, _car) {
                    if (err) done(err);
                    car = _car;
                    assert.equal(car.colour, 'red');
                    assert.equal(car.name, 'Aston Martin');
                    assert.equal(car.id, '5');
                    siesta.ext.http._serialiseObject.call(requestDescriptor, {fields: ['colour']}, car, function (err, data) {
                        if (err) done(err);
                        else {
                            console.log('data', data);
                            var keys = Object.keys(data);
                            assert.equal(keys.length, 1);
                            assert.equal(keys[0], 'colour');
                            done();
                        }
                    });
                });
            });
        });

        it('xyz', function () {
            dump('hello');
        });
    });

});