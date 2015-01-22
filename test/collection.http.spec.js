var assert = require('chai').assert,
    internal = siesta._internal,
    InternalSiestaError = internal.error.InternalSiestaError,
    ModelInstance = internal.ModelInstance,
    RelationshipType = siesta.RelationshipType;

/*globals describe, it, beforeEach, before, after */
describe('http!', function () {
    var Collection, Car, Person, vitalSignsMapping;

    var server;

    before(function () {
        siesta.ext.storageEnabled = false;
        siesta.setLogLevel('HTTP', siesta.log.trace);
    });

    after(function () {
        siesta.setLogLevel('HTTP', siesta.log.warn);
    });

    beforeEach(function (done) {
        this.sinon = sinon.sandbox.create();
        this.server = sinon.fakeServer.create();
        this.server.autoRespond = true;
        server = this.server;
        siesta.reset(done);
    });

    afterEach(function () {
        this.sinon.restore();
        this.server.restore();
        server = null;
    });


    function constructCollection() {
        Collection = siesta.collection('myCollection');
        Person = Collection.model('Person', {
            id: 'id',
            attributes: ['name', 'age']
        });
        Car = Collection.model('Car', {
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
        vitalSignsMapping = Collection.model('VitalSigns', {
            id: 'id',
            attributes: ['heartRate', 'bloodPressure'],
            relationships: {
                owner: {
                    model: 'Person',
                    type: RelationshipType.OneToOne,
                    reverse: 'vitalSigns'
                }
            }
        });
        Collection.baseURL = 'http://mywebsite.co.uk/';
    }


    describe('path regex', function () {
        describe('check', function () {
            beforeEach(function () {
                constructCollection();
                siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(new siesta.ext.http.ResponseDescriptor({
                    method: 'GET',
                    mxapping: Car,
                    path: '/cars/[0-9]+/[a-zA-Z0-9]+'
                }));
                siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(new siesta.ext.http.ResponseDescriptor({
                    method: 'GET',
                    model: Car,
                    path: '/cars/[a-zA-Z0-9]+'
                }));
            });

            describe('singular', function () {
                var err, obj, xhr, data;

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
                    Collection.GET('cars/9/purple/', function (_err, _obj, _data, _xhr) {
                        err = _err;
                        obj = _obj;
                        xhr = _xhr;
                        data = _data;
                        done();
                    });
                });

            });

            describe('multiple', function () {
                var err, objs, data, xhr;

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
                    Collection.GET('cars/purple/', function (_err, _objs, _data, _xhr) {
                        err = _err;
                        objs = _objs;
                        data = _data;
                        xhr = _xhr;
                        done();
                    });
                });


            });


        });
    });

    describe('verbs', function () {

        describe('GET', function () {

            beforeEach(constructCollection);

            describe('success', function () {
                var err, obj, data, xhr;

                describe('single', function () {
                    beforeEach(function (done) {
                        Collection.descriptor({
                            method: 'GET',
                            model: Car,
                            path: '/cars/[0-9]+'
                        });
                        var raw = {
                            colour: 'red',
                            name: 'Aston Martin',
                            owner: '093hodhfno',
                            id: '5'
                        };
                        var headers = {
                            "Content-Type": "application/json"
                        };
                        var path = "http://mywebsite.co.uk/cars/5/",
                            method = "GET",
                            status = 200;
                        server.respondWith(method, path, [status, headers, JSON.stringify(raw)]);
                        assert.ok(Collection.GET);
                        Collection.GET('cars/5/', function (_err, _obj, _data, _xhr) {
                            console.log('_resp', _data);
                            if (_err) console.error(_err);
                            assert.notOk(_err);
                            err = _err;
                            obj = _obj;
                            data = _data;
                            xhr = _xhr;
                            done();
                        });
                    });

                    it('returns data', function () {
                        assert.equal(data.colour, 'red');
                        assert.equal(data.name, 'Aston Martin');
                        assert.equal(data.owner, '093hodhfno');
                        assert.equal(data.id, '5');
                    });

                    it('returns jqxhr', function () {
                        assert.ok(xhr);
                    });

                    it('returns a car object', function () {
                        assert.instanceOf(obj, ModelInstance);
                        assert.equal(obj.colour, 'red');
                        assert.equal(obj.name, 'Aston Martin');
                        assert.equal(obj.id, '5');
                    })
                });

                describe('multiple', function () {
                    beforeEach(function (done) {
                        siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(new siesta.ext.http.ResponseDescriptor({
                            method: 'GET',
                            model: Car,
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
                        Collection.GET('cars/', function (_err, _obj) {
                            if (_err) done(_err);
                            obj = _obj;
                            done();
                        });
                    });

                    it('returns 2 car objects', function () {
                        assert.equal(obj.length, 2);
                        _.each(obj, function (car) {
                            assert.instanceOf(car, ModelInstance);
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
            beforeEach(constructCollection);

            describe('success', function () {
                describe('default', function () {
                    var err, obj, data, objectToDelete, xhr;

                    beforeEach(function (done) {
                        var data = {
                            id: 'xyz',
                            colour: 'red',
                            name: 'Aston Martin'
                        };
                        Car.graph(data, function (err, _objectToDelete) {
                            if (err) done(err);
                            objectToDelete = _objectToDelete;
                            siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(new siesta.ext.http.ResponseDescriptor({
                                method: 'DELETE',
                                model: Car,
                                path: '/cars/[0-9]+'
                            }));
                            var headers = {
                                "Content-Type": "application/json"
                            };
                            var path = "http://mywebsite.co.uk/cars/5/";
                            var method = "DELETE";
                            var status = 200;
                            server.respondWith(method, path, [status, headers, '{"status": "ok"}']);
                            Collection.DELETE('cars/5/', _objectToDelete, function (_err, _obj, _data, _xhr) {
                                err = _err;
                                obj = _obj;
                                data = _data;
                                xhr = _xhr;
                                done();
                            });
                        });
                    });

                    it('no error', function () {
                        assert.notOk(err);
                    });

                    it('returns jqxhr', function () {
                        assert.ok(xhr);
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
                        Car.graph(data, function (err, _objectToDelete) {
                            if (err) done(err);
                            objectToDelete = _objectToDelete;
                            siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(new siesta.ext.http.ResponseDescriptor({
                                method: 'DELETE',
                                model: Car,
                                path: '/cars/[0-9]+'
                            }));
                            var headers = {
                                "Content-Type": "application/json"
                            };
                            var path = "http://mywebsite.co.uk/cars/5/";
                            var method = "DELETE";
                            var status = 200;
                            server.respondWith(method, path, [status, headers, '{"status": "ok"}']);
                            Collection.DELETE('cars/5/', _objectToDelete, {
                                deletionMode: 'now'
                            }, function (_err, _obj, _resp) {
                                assert.ok(_objectToDelete.removed)
                                done();
                            });
                            assert.ok(_objectToDelete.removed);
                            ;
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
                        Car.graph(data, function (err, _objectToDelete) {
                            if (err) done(err);
                            objectToDelete = _objectToDelete;
                            siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(new siesta.ext.http.ResponseDescriptor({
                                method: 'DELETE',
                                model: Car,
                                path: '/cars/[0-9]+'
                            }));
                            var headers = {
                                "Content-Type": "application/json"
                            };
                            var path = "http://mywebsite.co.uk/cars/5/";
                            var method = "DELETE";
                            var status = 200;
                            server.respondWith(method, path, [status, headers, '{"status": "ok"}']);
                            Collection.DELETE('cars/5/', _objectToDelete, {
                                deletionMode: 'success'
                            }, function (_err, _obj, _resp) {
                                assert.ok(_objectToDelete.removed)
                                done();
                            });
                            assert.notOk(_objectToDelete.removed);
                            ;
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
                        Car.graph(data, function (err, _objectToDelete) {
                            if (err) done(err);
                            objectToDelete = _objectToDelete;
                            siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(new siesta.ext.http.ResponseDescriptor({
                                method: 'DELETE',
                                model: Car,
                                path: '/cars/[0-9]+'
                            }));
                            var headers = {
                                "Content-Type": "application/json"
                            };
                            var path = "http://mywebsite.co.uk/cars/5/";
                            var method = "DELETE";
                            var status = 500;
                            server.respondWith(method, path, [status, headers, '{"status": "ok"}']);
                            Collection.DELETE('cars/5/', _objectToDelete, {
                                deletionMode: 'restore'
                            }, function (_err, _obj, _resp) {
                                assert.notOk(_objectToDelete.removed)
                                done();
                            });
                            assert.ok(_objectToDelete.removed);
                            ;
                        });
                    });
                });
            });

        });

        describe('POST', function () {
            var err, obj, resp;
            beforeEach(function (done) {
                constructCollection();
                done();
                var responseDescriptor = new siesta.ext.http.ResponseDescriptor({
                    method: 'POST',
                    model: Car,
                    path: 'cars/?'
                });
                siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(responseDescriptor);
                var requestDescriptor = new siesta.ext.http.RequestDescriptor({
                    method: 'POST',
                    model: Car,
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
                    Car.graph({
                        colour: 'red',
                        name: 'Aston Martin'
                    }, function (err, _car) {
                        if (err) done(err);
                        car = _car;
                        assert.equal(car.colour, 'red');
                        assert.equal(car.name, 'Aston Martin');
                        Collection.POST('cars/', car, function (_err, _obj, _resp) {
                            err = _err;
                            obj = _obj;
                            resp = _resp;
                            done();
                        });
                        ;
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
                constructCollection();
                done();
                var responseDescriptor = new siesta.ext.http.ResponseDescriptor({
                    method: 'PUT',
                    model: Car,
                    path: '/cars/[0-9]+'
                });
                siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(responseDescriptor);
                var requestDescriptor = new siesta.ext.http.RequestDescriptor({
                    method: 'PUT',
                    model: Car,
                    path: '/cars/[0-9]+'
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
                    Car.graph({
                        colour: 'red',
                        name: 'Aston Martin',
                        id: '5'
                    }, function (err, _car) {
                        if (err) done(err);
                        car = _car;
                        assert.equal(car.colour, 'red');
                        assert.equal(car.name, 'Aston Martin');
                        assert.equal(car.id, '5');
                        Collection.PUT('cars/5/', car, function (_err, _obj, _resp) {
                            err = _err;
                            obj = _obj;
                            resp = _resp;
                            done();
                        });
                        ;
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
            beforeEach(function () {
                constructCollection();
                var responseDescriptor = new siesta.ext.http.ResponseDescriptor({
                    method: 'PATCH',
                    model: Car,
                    path: '/cars/[0-9]+'
                });
                siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(responseDescriptor);
                var requestDescriptor = new siesta.ext.http.RequestDescriptor({
                    method: 'PATCH',
                    model: Car,
                    path: '/cars/[0-9]+'
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
                    var method = "PATCH";
                    var status = 200;
                    server.respondWith(method, path, [status, headers, JSON.stringify(raw)]);
                    Car.graph({
                        colour: 'red',
                        name: 'Aston Martin',
                        id: '5'
                    }, function (err, _car) {
                        if (err) done(err);
                        car = _car;
                        assert.equal(car.colour, 'red');
                        assert.equal(car.name, 'Aston Martin');
                        assert.equal(car.id, '5');
                        Collection.PATCH('cars/5/', car, function (_err, _obj, _resp) {
                            err = _err;
                            obj = _obj;
                            resp = _resp;
                            done();
                        });
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
                constructCollection();
                done();
                var responseDescriptor = new siesta.ext.http.ResponseDescriptor({
                    method: 'OPTIONS',
                    model: Car,
                    path: 'something/?'
                });
                siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(responseDescriptor);
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
                    Collection.OPTIONS('something/', function (_err, _obj, _resp) {
                        err = _err;
                        obj = _obj;
                        resp = _resp;
                        done();
                    });
                });
                it('no err', function () {
                    assert.notOk(err);
                });
                it('resp', function () {
                    assert.ok(resp);
                })
            });
        });

    });

    describe('ajax', function () {
        var dollar;
        var fakeDollar = {
            ajax: function () {
            }
        };

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
            assert.equal(siesta.ext.http.ajax, fakeDollar.ajax);
        });

        it('no $', function () {
            $ = undefined;
            assert.equal(siesta.ext.http.ajax, fakeDollar.ajax);
        });

        it('no ajax at all', function () {
            $ = undefined;
            jQuery = undefined;
            assert.throws(function () {
                var a = siesta.ext.http.ajax;
            }, InternalSiestaError);
        });

        it('set ajax', function () {
            var fakeAjax = function () {
            };
            siesta.setAjax(fakeAjax);
            assert.equal(siesta.ext.http.ajax, fakeAjax);
            assert.equal(siesta.getAjax(), fakeAjax);
        });

    });

    describe('specific fields', function () {
        beforeEach(function (done) {
            constructCollection();
            var responseDescriptor = new siesta.ext.http.ResponseDescriptor({
                method: 'PATCH',
                model: Car,
                path: '/cars/[0-9]+'
            });
            siesta.ext.http.DescriptorRegistry.registerResponseDescriptor(responseDescriptor);
            var requestDescriptor = new siesta.ext.http.RequestDescriptor({
                method: 'PATCH',
                model: Car,
                path: '/cars/[0-9]+'
            });
            siesta.ext.http.DescriptorRegistry.registerRequestDescriptor(requestDescriptor);
            Car.graph({
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
                        var keys = Object.keys(data);
                        assert.equal(keys.length, 1);
                        assert.equal(keys[0], 'colour');
                        done();
                    }
                });
            });
        });

    });

    // TODO: Why does sinon fuck up?
    //describe('no descriptor matches', function () {
    //    it('GET', function (done) {
    //        collection = siesta.collection('myCollection');
    //        Person = collection.model('Person', {
    //            id: 'id',
    //            attributes: ['name', 'age']
    //        });
    //        Car = collection.model('Car', {
    //            id: 'id',
    //            attributes: ['colour', 'name'],
    //            relationships: {
    //                owner: {
    //                    model: 'Person',
    //                    type: RelationshipType.OneToMany,
    //                    reverse: 'cars'
    //                }
    //            }
    //        });
    //        vitalSignsMapping = collection.model('VitalSigns', {
    //            id: 'id',
    //            attributes: ['heartRate', 'bloodPressure'],
    //            relationships: {
    //                owner: {
    //                    model: 'Person',
    //                    type: RelationshipType.OneToOne,
    //                    reverse: 'vitalSigns'
    //                }
    //            }
    //        });
    //        collection.baseURL = 'http://mywebsite.co.uk/';
    //        collection.descriptor({
    //            method: 'GET',
    //            model: Car,
    //            path: '/cars/?$'
    //        });
    //        siesta.install(function (err) {
    //            if (err) {
    //                done(err);
    //            }
    //            else {
    //                var path = "http://mywebsite.co.uk/cars/red/";
    //                var method = "GET";
    //                var status = 200;
    //                var raw = {
    //                    colour: 'orange',
    //                    name: 'Aston Martin',
    //                    owner: '093hodhfno',
    //                    id: '1'
    //                };
    //                var headers = {
    //                    "Content-Type": "application/json"
    //                };
    //                server.respondWith(method, path, [status, headers, JSON.stringify(raw)]);
    //                collection.GET('cars/red/', function (err, obj, resp) {
    //                    assert.ok(err, 'should get an error when no descriptors match');
    //                    assert.notOk(obj);
    //                    done();
    //                });
    //                ;
    //            }
    //
    //        });
    //    })
    //});

});