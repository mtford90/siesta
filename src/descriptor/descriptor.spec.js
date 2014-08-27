describe('request descriptor', function () {

    var Collection, Descriptor, RestError, DescriptorRegistry, RequestDescriptor, ResponseDescriptor, Serialiser, RelationshipType;

    var collection, carMapping, personMapping;

    beforeEach(function (done) {
        module('restkit.descriptor', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Collection_, _Descriptor_, _RelationshipType_, _RestError_, _DescriptorRegistry_, _RequestDescriptor_, _ResponseDescriptor_, _Serialiser_) {
            Collection = _Collection_;
            Descriptor = _Descriptor_;
            RestError = _RestError_;
            DescriptorRegistry = _DescriptorRegistry_;
            RequestDescriptor = _RequestDescriptor_;
            ResponseDescriptor = _ResponseDescriptor_;
            Serialiser = _Serialiser_;
            RelationshipType = _RelationshipType_;
        });

        collection = new Collection('myCollection', function (err, version) {
            if (err) done(err);
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
            personMapping = collection.registerMapping('Person', {
                id: 'id',
                attributes: ['name'],
            })
        }, function () {
            done();
        });

        Collection._reset();
    });

    describe('matching', function () {

        describe('path', function () {
            it('match id', function () {
                var r = new Descriptor({path: '/cars/(?<id>[0-9])/?', mapping: carMapping});
                var match = r._matchPath('/cars/5/');
                assert.equal(match.id, '5');
                match = r._matchPath('/cars/5');
                assert.equal(match.id, '5');
            });
        });

        describe('http methods', function () {
            it('all http methods', function () {
                var r = new Descriptor({method: '*', mapping: carMapping});
                _.each(r.httpMethods, function (method) {
                    assert.include(r.method, method);
                });
                r = new Descriptor({method: ['*'], mapping: carMapping});
                _.each(r.httpMethods, function (method) {
                    assert.include(r.method, method);
                });
                r = new Descriptor({method: ['*', 'GET'], mapping: carMapping});
                _.each(r.httpMethods, function (method) {
                    assert.include(r.method, method);
                });
            });
            it('match against all', function () {
                var r = new Descriptor({method: '*', mapping: carMapping});
                _.each(r.httpMethods, function (method) {
                    assert.ok(r._matchMethod(method));
                    assert.ok(r._matchMethod(method.toUpperCase()));
                    assert.ok(r._matchMethod(method.toLowerCase()));
                });
            });
            it('match against some', function () {
                var r = new Descriptor({method: ['POST', 'PUT'], mapping: carMapping});
                assert.ok(r._matchMethod('POST'));
                assert.ok(r._matchMethod('PUT'));
                assert.ok(r._matchMethod('post'));
                assert.ok(r._matchMethod('put'));
                assert.ok(r._matchMethod('PoSt'));
                assert.ok(r._matchMethod('pUt'));
                assert.notOk(r._matchMethod('HEAD'));
                assert.notOk(r._matchMethod('head'));
                assert.notOk(r._matchMethod('hEaD'));
            });
            it('match against single', function () {
                function assertMatchMethod(r) {
                    console.log(r._matchMethod);
                    assert.ok(r._matchMethod('POST'));
                    assert.ok(r._matchMethod('post'));
                    assert.ok(r._matchMethod('PoSt'));
                    assert.notOk(r._matchMethod('HEAD'));
                    assert.notOk(r._matchMethod('head'));
                    assert.notOk(r._matchMethod('hEaD'));
                }

                assertMatchMethod(new Descriptor({method: ['POST'], mapping: carMapping}));
                assertMatchMethod(new Descriptor({method: ['pOsT'], mapping: carMapping}));
                assertMatchMethod(new Descriptor({method: 'pOsT', mapping: carMapping}));
                assertMatchMethod(new Descriptor({method: 'post', mapping: carMapping}));
                assertMatchMethod(new Descriptor({method: 'POST', mapping: carMapping}));
            })
        });

    });


    describe('specify mapping', function () {
        it('as object', function () {
            var r = new Descriptor({mapping: carMapping});
            assert.equal(r.mapping, carMapping);
        });
        it('as string', function () {
            var r = new Descriptor({mapping: 'Car', collection: 'myCollection'});
            assert.equal('Car', r.mapping.type);
        });
        it('as string, but collection as object', function () {
            var r = new Descriptor({mapping: 'Car', collection: collection});
            assert.equal('Car', r.mapping.type);
        });
        it('should throw an exception if passed as string without collection', function () {
            assert.throws(_.partial(Descriptor, {mapping: 'Car'}), RestError);
        });
    });

    describe('data', function () {
        it('if null, should be null', function () {
            var r = new Descriptor({data: null, mapping: carMapping});
            assert.notOk(r.data);
        });
        it('if empty string, should be null', function () {
            var r = new Descriptor({data: '', mapping: carMapping});
            assert.notOk(r.data);
        });
        it('if length 1, should be a string', function () {
            var r = new Descriptor({data: 'abc', mapping: carMapping});
            assert.equal(r.data, 'abc');
        });
        it('if > length 1, should be an object', function () {
            var r = new Descriptor({data: 'path.to.data', mapping: carMapping});
            assert.equal(r.data.path.to, 'data');
        });
        describe('embed', function () {
            var data = {x: 1, y: 2, z: 3};
            it('if null, should simply return the object', function () {
                var r = new Descriptor({data: null, mapping: carMapping});
                assert.equal(data, r._embedData(data));
            });
            it('if empty string, should simply return the object', function () {
                var r = new Descriptor({data: '', mapping: carMapping});
                assert.equal(data, r._embedData(data));
            });
            it('if length 1, should return 1 level deep object', function () {
                var r = new Descriptor({data: 'abc', mapping: carMapping});
                assert.equal(data, r._embedData(data).abc);
            });
            it('if > length 1, should return n level deep object', function () {
                var r = new Descriptor({data: 'path.to.data', mapping: carMapping});
                var extractData = r._embedData(data);
                console.log('yo', extractData);
                assert.equal(data, extractData.path.to.data);
            });
        });
        describe('extract', function () {
            var data = {x: 1, y: 2, z: 3};
            it('if null, should simply return the object', function () {
                var r = new Descriptor({data: null, mapping: carMapping});
                var extractData = r._extractData(data);
                assert.equal(extractData, data);
            });
            it('if empty string, should simply return the object', function () {
                var r = new Descriptor({data: '', mapping: carMapping});
                var extractData = r._extractData(data);
                assert.equal(extractData, data);
            });
            it('if length 1, should return 1 level deep object', function () {
                var r = new Descriptor({data: 'abc', mapping: carMapping});
                var extractData = r._extractData({abc: data});
                assert.equal(extractData, data);
            });
            it('if > length 1, should return n level deep object', function () {
                var r = new Descriptor({data: 'path.to.data', mapping: carMapping});
                var extractData = r._extractData({path: {to: {data: data}}});
                assert.equal(extractData, data);
            });
        });
    });

    describe('registry', function () {
        it('should register request descriptor', function () {
            var r = new RequestDescriptor({data: 'path.to.data', mapping: carMapping});
            DescriptorRegistry.registerRequestDescriptor(r);
            assert.include(DescriptorRegistry.requestDescriptors[carMapping.collection], r);
        });
        describe('request descriptors for collection', function () {
            var descriptor;
            beforeEach(function () {
                descriptor = new RequestDescriptor({data: 'path.to.data', mapping: carMapping});
                DescriptorRegistry.registerRequestDescriptor(descriptor);
            });
            it('request descriptors should be accessible by collection name', function () {
                assert.include(DescriptorRegistry.requestDescriptorsForCollection(carMapping.collection), descriptor);
            });
            it('request descriptors should be accessible by collection', function () {
                assert.include(DescriptorRegistry.requestDescriptorsForCollection(collection), descriptor);
            });
        });

    });

    describe('match http config', function () {
        describe('no data', function () {
            var descriptor;
            beforeEach(function () {
                descriptor = new Descriptor({
                    method: 'POST',
                    mapping: carMapping,
                    path: '/cars/(?<id>[0-9])/?'
                });
            });
            it('match', function () {
                assert.ok(descriptor._matchConfig({
                    type: 'POST',
                    url: '/cars/5/'
                }));
            });
            it('no match because of method', function () {
                assert.notOk(descriptor._matchConfig({
                    type: 'GET',
                    url: '/cars/5/'
                }));
            });
            it('no match because of url', function () {
                assert.notOk(descriptor._matchConfig({
                    type: 'POST',
                    url: '/asdasd/'
                }));
            });
        });


    });

    describe('match against data', function () {
        var descriptor;

        describe('data specified', function () {
            beforeEach(function () {
                descriptor = new Descriptor({
                    mapping: carMapping,
                    data: 'path.to.data'
                });
            });
            it('match', function () {
                assert.ok(descriptor._matchData({
                    path: {
                        to: {
                            data: {
                                x: 1,
                                y: 2
                            }
                        }
                    }
                }));
            });
            it('no match', function () {
                assert.notOk(descriptor._matchData({
                    path: { // Missing 'to'
                        data: {
                            x: 1,
                            y: 2
                        }
                    }
                }));
            });
        });

        describe('data unspecified', function () {

        })

    });

    describe('compound match', function () {
        var descriptor;
        beforeEach(function () {
            descriptor = new Descriptor({
                method: 'POST',
                mapping: carMapping,
                path: '/cars/(?<id>[0-9])/?',
                data: 'path.to.data'
            });
        });

        it('success', function () {
            var config = {
                type: 'POST',
                url: '/cars/5/'
            };
            var data = {
                path: {
                    to: {
                        data: {
                            x: 1,
                            y: 2
                        }
                    }
                }
            };
            assert.ok(descriptor.match(config, data));
        });
    });

    describe('defaults', function () {
        var descriptor;
        beforeEach(function () {
            descriptor = new Descriptor({mapping: carMapping});
        });
        it('default method is *', function () {
            _.each(descriptor.httpMethods, function (method) {
                assert.include(descriptor.method, method.toUpperCase());
            });
        });
        it('default path is blank', function () {
            assert.equal(descriptor.path, '');
        });
        it('default data is null', function () {
            assert.equal(descriptor.data, null);
        })
    });

    describe('errors', function () {


        it('no mapping', function () {
            assert.throws(function () {
                new Descriptor({data: 'data'})
            }, RestError);
        });
    });

    describe.only('RequestDescriptor', function () {
        describe('serialisation', function () {

            it('default', function () {
                var requestDescriptor = new RequestDescriptor({
                    method: 'POST',
                    mapping: carMapping,
                    path: '/cars/(?<id>[0-9])/?'
                });
                assert.equal(requestDescriptor.serialiser, Serialiser.idSerialiser);
            });

            describe('built-in', function () {
                var requestDescriptor;
                describe('id', function () {
                    beforeEach(function () {
                        requestDescriptor = new RequestDescriptor({
                            method: 'POST',
                            mapping: carMapping,
                            path: '/cars/(?<id>[0-9])/?',
                            serialiser: Serialiser.idSerialiser
                        });
                    });
                    it('uses the serialiser', function () {
                        assert.equal(requestDescriptor.serialiser, Serialiser.idSerialiser);
                    });
                    it('serialises', function (done) {
                        carMapping.map({colour: 'red', name: 'Aston Martin', id: 'xyz'}, function (err, car) {
                            if (err) done(err);
                            requestDescriptor._serialise(car, function (err, data) {
                                if (err) done(err);
                                assert.equal(data, car.id);
                                done();
                            })
                        });
                    });
                });

                describe('depth', function () {
                    var requestDescriptor;
                    beforeEach(function () {
                        requestDescriptor = new RequestDescriptor({
                            method: 'POST',
                            mapping: carMapping,
                            path: '/cars/(?<id>[0-9])/?',
                            serialiser: Serialiser.depthSerializer(0)
                        });
                    });

                    it('uses the serialiser', function () {
                        assert.notEqual(requestDescriptor.serialiser, Serialiser.idSerialiser);
                    });

                    it('serialises at depth', function (done) {
                        carMapping.map({colour: 'red', name: 'Aston Martin', id: 'xyz', owner: {id: '123', name: 'Michael Ford'}}, function (err, car) {
                            if (err) done(err);
                            requestDescriptor._serialise(car, function (err, data) {
                                dump(data);
                                if (err) done(err);
                                assert.equal(data.owner, '123');
                                done();
                            })
                        });
                    });
                });


            });
            describe('custom', function () {

                function carSerialiser(fields, car, done) {
                    var data = {};
                    for (var idx in fields) {
                        var field = fields[idx];
                        if (car[field]) {
                            data[field] = car[field];
                        }
                    }
                    car.owner.get(function (err, person) {
                        if (err) {
                            done(err);
                        }
                        else {
                            if (person) {
                                data.owner = person.name;
                            }
                            done(null, data);
                        }
                    });
                }

                var requestDescriptor, serialiser;

                beforeEach(function () {
                    serialiser = _.partial(carSerialiser, ['name']);
                    requestDescriptor = new RequestDescriptor({
                        method: 'POST',
                        mapping: carMapping,
                        path: '/cars/?',
                        serialiser: serialiser
                    });
                });

                it('uses the custom serialiser', function () {
                    assert.equal(requestDescriptor.serialiser, serialiser);
                });

                it('serialises', function (done) {
                    carMapping.map({colour: 'red', name: 'Aston Martin', id: 'xyz', owner: {id: '123', name: 'Michael Ford'}}, function (err, car) {
                        if (err) done(err);
                        requestDescriptor._serialise(car, function (err, data) {
                            dump(data);
                            if (err) done(err);
                            assert.equal(data.owner, 'Michael Ford');
                            assert.equal(data.name, 'Aston Martin');
                            assert.notOk(data.colour);
                            done();
                        })
                    });
                })


            })
        })
    })


});