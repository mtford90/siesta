var s = require('../core/index'),
    assert = require('chai').assert;

describe('request descriptor', function () {

    var Collection = require('../core/collection');
    var InternalSiestaError = require('../core/error').InternalSiestaError;
    var RelationshipType = require('../core/RelationshipType');

    var collection, carModel, personMapping;

    before(function () {
        s.ext.storageEnabled = false;
    });

    beforeEach(function (done) {
        s.reset(function () {
            collection = s.collection('myCollection');
            carModel = collection.model('Car', {
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
            Person = collection.model('Person', {
                id: 'id',
                attributes: ['name']
            });
            s.install(done);
        });
    });

    describe('matching', function () {

        describe('path', function () {
            it('match id', function () {
                var r = new siesta.ext.http.Descriptor({
                    path: '\/cars\/([0-9]+)?$',
                    model: carModel
                });
                var match = r._matchPath('/cars/5');
                assert.ok(match);
            });

            it('query params', function () {
                var descriptor = new siesta.ext.http.Descriptor({
                    method: '*',
                    model: carModel,
                    path: '/cars/[0-9]+'
                });
                var match = descriptor._matchPath('/cars/5?x=5&y=random');
                assert.ok(match)
            });

            describe('array of paths', function () {
                it('multiple', function () {
                    var descriptor = new siesta.ext.http.Descriptor({
                        method: '*',
                        model: carModel,
                        path: ['/cars/[0-9]+', '/vehicles/[0-9]+']
                    });
                    var match = descriptor._matchPath('/cars/5?x=5&y=random');
                    assert.ok(match);
                    match = descriptor._matchPath('/vehicles/5?x=5&y=random');
                    assert.ok(match);
                    match = descriptor._matchPath('/xyz/5?x=5&y=random');
                    assert.notOk(match);
                });

                it('one', function () {
                    var descriptor = new siesta.ext.http.Descriptor({
                        method: '*',
                        model: carModel,
                        path: ['/cars/[0-9]+']
                    });
                    var match = descriptor._matchPath('/cars/5?x=5&y=random');
                    assert.ok(match);
                });


            });


        });

        describe('http methods', function () {
            it('all http methods', function () {
                var r = new siesta.ext.http.Descriptor({
                    method: '*',
                    model: carModel
                });
                _.each(r.httpMethods, function (method) {
                    assert.include(r.method, method);
                });
                r = new siesta.ext.http.Descriptor({
                    method: ['*'],
                    model: carModel
                });
                _.each(r.httpMethods, function (method) {
                    assert.include(r.method, method);
                });
                r = new siesta.ext.http.Descriptor({
                    method: ['*', 'GET'],
                    model: carModel
                });
                _.each(r.httpMethods, function (method) {
                    assert.include(r.method, method);
                });
            });
            it('match against all', function () {
                var r = new siesta.ext.http.Descriptor({
                    method: '*',
                    model: carModel
                });
                _.each(r.httpMethods, function (method) {
                    assert.ok(r._matchMethod(method));
                    assert.ok(r._matchMethod(method.toUpperCase()));
                    assert.ok(r._matchMethod(method.toLowerCase()));
                });
            });
            it('match against some', function () {
                var r = new siesta.ext.http.Descriptor({
                    method: ['POST', 'PUT'],
                    model: carModel
                });
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
                    assert.ok(r._matchMethod('POST'));
                    assert.ok(r._matchMethod('post'));
                    assert.ok(r._matchMethod('PoSt'));
                    assert.notOk(r._matchMethod('HEAD'));
                    assert.notOk(r._matchMethod('head'));
                    assert.notOk(r._matchMethod('hEaD'));
                }

                assertMatchMethod(new siesta.ext.http.Descriptor({
                    method: ['POST'],
                    model: carModel
                }));
                assertMatchMethod(new siesta.ext.http.Descriptor({
                    method: ['pOsT'],
                    model: carModel
                }));
                assertMatchMethod(new siesta.ext.http.Descriptor({
                    method: 'pOsT',
                    model: carModel
                }));
                assertMatchMethod(new siesta.ext.http.Descriptor({
                    method: 'post',
                    model: carModel
                }));
                assertMatchMethod(new siesta.ext.http.Descriptor({
                    method: 'POST',
                    model: carModel
                }));
            })
        });
    });

    describe('specify mapping', function () {
        it('as object', function () {
            var r = new siesta.ext.http.Descriptor({
                model: carModel
            });
            assert.equal(r.model, carModel);
        });
        it('as string', function () {
            var r = new siesta.ext.http.Descriptor({
                model: 'Car',
                collection: 'myCollection'
            });
            assert.equal('Car', r.model.name);
        });
        it('as string, but collection as object', function () {
            var r = new siesta.ext.http.Descriptor({
                model: 'Car',
                collection: collection
            });
            assert.equal('Car', r.model.name);
        });
        it('should throw an exception if passed as string without collection', function () {
            assert.throws(_.partial(siesta.ext.http.Descriptor, {
                model: 'Car'
            }), Error);
        });
    });

    describe('data', function () {
        it('if null, should be null', function () {
            var r = new siesta.ext.http.Descriptor({
                data: null,
                model: carModel
            });
            assert.notOk(r.data);
        });
        it('if empty string, should be null', function () {
            var r = new siesta.ext.http.Descriptor({
                data: '',
                model: carModel
            });
            assert.notOk(r.data);
        });
        it('if length 1, should be a string', function () {
            var r = new siesta.ext.http.Descriptor({
                data: 'abc',
                model: carModel
            });
            assert.equal(r.data, 'abc');
        });
        it('if > length 1, should be an object', function () {
            var r = new siesta.ext.http.Descriptor({
                data: 'path.to.data',
                model: carModel
            });
            assert.equal(r.data.path.to, 'data');
        });
        describe('embed', function () {
            var data = {
                x: 1,
                y: 2,
                z: 3
            };
            it('if null, should simply return the object', function () {
                var r = new siesta.ext.http.Descriptor({
                    data: null,
                    model: carModel
                });
                assert.equal(data, r._embedData(data));
            });
            it('if empty string, should simply return the object', function () {
                var r = new siesta.ext.http.Descriptor({
                    data: '',
                    model: carModel
                });
                assert.equal(data, r._embedData(data));
            });
            it('if length 1, should return 1 level deep object', function () {
                var r = new siesta.ext.http.Descriptor({
                    data: 'abc',
                    model: carModel
                });
                assert.equal(data, r._embedData(data).abc);
            });
            it('if > length 1, should return n level deep object', function () {
                var r = new siesta.ext.http.Descriptor({
                    data: 'path.to.data',
                    model: carModel
                });
                var extractData = r._embedData(data);
                assert.equal(data, extractData.path.to.data);
            });
        });
        describe('extract', function () {
            var data = {
                x: 1,
                y: 2,
                z: 3
            };
            it('if null, should simply return the object', function () {
                var r = new siesta.ext.http.Descriptor({
                    data: null,
                    model: carModel
                });
                var extractData = r._extractData(data);
                assert.equal(extractData, data);
            });
            it('if empty string, should simply return the object', function () {
                var r = new siesta.ext.http.Descriptor({
                    data: '',
                    model: carModel
                });
                var extractData = r._extractData(data);
                assert.equal(extractData, data);
            });
            it('if length 1, should return 1 level deep object', function () {
                var r = new siesta.ext.http.Descriptor({
                    data: 'abc',
                    model: carModel
                });
                var extractData = r._extractData({
                    abc: data
                });
                assert.equal(extractData, data);
            });
            it('if > length 1, should return n level deep object', function () {
                var r = new siesta.ext.http.Descriptor({
                    data: 'path.to.data',
                    model: carModel
                });
                var extractData = r._extractData({
                    path: {
                        to: {
                            data: data
                        }
                    }
                });
                assert.equal(extractData, data);
            });
        });
    });

    describe('registry', function () {
        it('should register request descriptor', function () {
            var r = new siesta.ext.http.RequestDescriptor({
                data: 'path.to.data',
                model: carModel
            });
            siesta.ext.http.DescriptorRegistry.registerRequestDescriptor(r);
            assert.include(siesta.ext.http.DescriptorRegistry.requestDescriptors[carModel.collectionName], r);
        });
        describe('request descriptors for collection', function () {
            var descriptor;
            beforeEach(function () {
                descriptor = new siesta.ext.http.RequestDescriptor({
                    data: 'path.to.data',
                    model: carModel
                });
                siesta.ext.http.DescriptorRegistry.registerRequestDescriptor(descriptor);
            });
            it('request descriptors should be accessible by collection name', function () {
                assert.include(siesta.ext.http.DescriptorRegistry.requestDescriptorsForCollection(carModel.collectionName), descriptor);
            });
            it('request descriptors should be accessible by collection', function () {
                assert.include(siesta.ext.http.DescriptorRegistry.requestDescriptorsForCollection(collection), descriptor);
            });
        });

    });

    describe('match http config', function () {
        describe('no data', function () {
            var descriptor;
            beforeEach(function () {
                descriptor = new siesta.ext.http.Descriptor({
                    method: 'POST',
                    model: carModel,
                    path: '/cars/[0-9]+/?'
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
                descriptor = new siesta.ext.http.Descriptor({
                    model: carModel,
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
            descriptor = new siesta.ext.http.Descriptor({
                method: 'POST',
                model: carModel,
                path: '/cars/[0-9]+',
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
            descriptor = new siesta.ext.http.Descriptor({
                model: carModel
            });
        });
        it('default method is GET', function () {
            assert.equal(descriptor.method.length, 1);
            assert.equal(descriptor.method[0], 'GET');
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
                new siesta.ext.http.Descriptor({
                    data: 'data'
                })
            }, Error);
        });
    });

    describe('siesta.ext.http.RequestDescriptor', function () {
        describe('serialisation', function () {
            it('default', function () {
                var requestDescriptor = new siesta.ext.http.RequestDescriptor({
                    method: 'POST',
                    model: carModel,
                    path: '/cars/[0-9]+'
                });
                assert.notEqual(requestDescriptor.serialiser, siesta.ext.http.Serialiser.idSerialiser);
            });

            describe('built-in', function () {
                var requestDescriptor;

                describe('id', function () {
                    beforeEach(function () {
                        requestDescriptor = new siesta.ext.http.RequestDescriptor({
                            method: 'POST',
                            model: carModel,
                            path: '/cars/[0-9]+',
                            serialiser: siesta.ext.http.Serialiser.idSerialiser
                        });
                    });
                    it('uses the serialiser', function () {
                        assert.equal(requestDescriptor.serialiser, siesta.ext.http.Serialiser.idSerialiser);
                    });
                    it('serialises', function (done) {
                        carModel.map({
                            colour: 'red',
                            name: 'Aston Martin',
                            id: 'xyz'
                        }, function (err, car) {
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
                        requestDescriptor = new siesta.ext.http.RequestDescriptor({
                            method: 'POST',
                            model: carModel,
                            path: '/cars/[0-9]+',
                            serialiser: siesta.ext.http.Serialiser.depthSerializer(0)
                        });
                    });

                    it('uses the serialiser', function () {
                        assert.notEqual(requestDescriptor.serialiser, siesta.ext.http.Serialiser.idSerialiser);
                    });

                    it('serialises at depth', function (done) {
                        carModel.map({
                            colour: 'red',
                            name: 'Aston Martin',
                            id: 'xyz',
                            owner: {
                                id: '123',
                                name: 'Michael Ford'
                            }
                        }, function (err, car) {
                            if (err) done(err);
                            requestDescriptor._serialise(car, function (err, data) {
                                if (err) done(err);
                                assert.equal(data.owner, '123');
                                done();
                            })
                        });
                    });
                });

                describe('transforms', function () {
                    var requestDescriptor;

                    it('key paths', function () {
                        requestDescriptor = new siesta.ext.http.RequestDescriptor({
                            model: carModel,
                            transforms: {
                                'colour': 'path.to.colour'
                            }
                        });
                        var data = {
                            colour: 'red'
                        };
                        requestDescriptor._transformData(data);
                        assert.notOk(data.colour);
                        assert.equal(data.path.to.colour, 'red');
                    });

                    it('key', function () {
                        requestDescriptor = new siesta.ext.http.RequestDescriptor({
                            model: carModel,
                            transforms: {
                                'colour': 'color'
                            }
                        });
                        var data = {
                            colour: 'red'
                        };
                        requestDescriptor._transformData(data);
                        assert.notOk(data.colour);
                        assert.equal(data.color, 'red');
                    });

                    it('function with return val', function () {
                        requestDescriptor = new siesta.ext.http.RequestDescriptor({
                            model: carModel,
                            transforms: {
                                'colour': function (val) {
                                    var newVal = val;
                                    if (val == 'red') {
                                        newVal = 'blue';
                                    }
                                    return newVal;
                                }
                            }
                        });
                        var data = {
                            colour: 'red'
                        };
                        requestDescriptor._transformData(data);
                        assert.equal(data.colour, 'blue');
                    });

                    it('function with return val and key', function () {
                        requestDescriptor = new siesta.ext.http.RequestDescriptor({
                            model: carModel,
                            transforms: {
                                'colour': function (val) {
                                    var newVal = val;
                                    if (val == 'red') {
                                        newVal = 'blue';
                                    }
                                    return ['color', newVal];
                                }
                            }
                        });
                        var data = {
                            colour: 'red'
                        };
                        requestDescriptor._transformData(data);
                        assert.notOk(data.colour);
                        assert.equal(data.color, 'blue');
                    });

                    it('invalid', function () {
                        requestDescriptor = new siesta.ext.http.RequestDescriptor({
                            model: carModel,
                            transforms: {
                                'colour': {
                                    wtf: {
                                        is: 'this'
                                    }
                                }
                            }
                        });
                        var data = {
                            colour: 'red'
                        };
                        assert.throws(function () {
                            requestDescriptor._transformData(data);

                        }, InternalSiestaError);
                    });

                    describe('during serialisation', function () {
                        beforeEach(function () {
                            requestDescriptor = new siesta.ext.http.RequestDescriptor({
                                method: 'POST',
                                model: carModel,
                                path: '/cars/[0-9]',
                                serialiser: siesta.ext.http.Serialiser.depthSerializer(0),
                                transforms: {
                                    'colour': 'path.to.colour'
                                }
                            });
                        });

                        it('performs transform', function (done) {
                            carModel.map({
                                colour: 'red',
                                name: 'Aston Martin',
                                id: 'xyz',
                                owner: {
                                    id: '123',
                                    name: 'Michael Ford'
                                }
                            }, function (err, car) {
                                if (err) done(err);
                                requestDescriptor._serialise(car, function (err, data) {
                                    if (err) done(err);
                                    assert.equal(data.owner, '123');
                                    assert.equal(data.name, 'Aston Martin');
                                    assert.notOk(data.colour);
                                    assert.equal(data.path.to.colour, 'red');
                                    done();
                                });
                            });
                        });
                    });

                });


            });

            describe('embed', function () {

                describe('id', function () {
                    var requestDescriptor;
                    beforeEach(function () {
                        requestDescriptor = new siesta.ext.http.RequestDescriptor({
                            method: 'POST',
                            model: carModel,
                            path: '/cars/[0-9]+',
                            data: 'path.to',
                            serialiser: siesta.ext.http.Serialiser.idSerialiser
                        });
                    });

                    it('serialises at depth', function (done) {
                        carModel.map({
                            colour: 'red',
                            name: 'Aston Martin',
                            id: 'xyz',
                            owner: {
                                id: '123',
                                name: 'Michael Ford'
                            }
                        }, function (err, car) {
                            if (err) done(err);
                            requestDescriptor._serialise(car, function (err, data) {
                                if (err) done(err);
                                assert.equal(data.path.to, 'xyz');
                                done();
                            })
                        });
                    });
                });

                describe('depth', function () {
                    var requestDescriptor;
                    beforeEach(function () {
                        requestDescriptor = new siesta.ext.http.RequestDescriptor({
                            method: 'POST',
                            model: carModel,
                            path: '/cars/[0-9]+',
                            data: 'path.to'
                        });
                    });


                    it('serialises at depth', function (done) {
                        carModel.map({
                            colour: 'red',
                            name: 'Aston Martin',
                            id: 'xyz',
                            owner: {
                                id: '123',
                                name: 'Michael Ford'
                            }
                        }, function (err, car) {
                            if (err) done(err);
                            requestDescriptor._serialise(car, function (err, data) {
                                if (err) done(err);
                                assert.equal(data.path.to.owner, '123');
                                done();
                            })
                        });
                    });
                });

                describe('custom', function () {
                    var requestDescriptor;
                    beforeEach(function () {
                        requestDescriptor = new siesta.ext.http.RequestDescriptor({
                            method: 'POST',
                            model: carModel,
                            path: '/cars/[0-9]+',
                            data: 'path.to',
                            serialiser: function (obj) {
                                return obj.id
                            }
                        });
                    });


                    it('serialises', function (done) {
                        carModel.map({
                            colour: 'red',
                            name: 'Aston Martin',
                            id: 'xyz',
                            owner: {
                                id: '123',
                                name: 'Michael Ford'
                            }
                        }, function (err, car) {
                            if (err) done(err);
                            requestDescriptor._serialise(car, function (err, data) {
                                if (err) done(err);
                                assert.equal(data.path.to, 'xyz');
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
                    car.__proxies['owner'].get(function (err, person) {
                        if (err) {
                            done(err);
                        } else {
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
                    requestDescriptor = new siesta.ext.http.RequestDescriptor({
                        method: 'POST',
                        model: carModel,
                        path: '/cars/?',
                        serialiser: serialiser
                    });
                });

                it('uses the custom serialiser', function () {
                    assert.equal(requestDescriptor.serialiser, serialiser);
                });

                it('serialises', function (done) {
                    carModel.map({
                        colour: 'red',
                        name: 'Aston Martin',
                        id: 'xyz',
                        owner: {
                            id: '123',
                            name: 'Michael Ford'
                        }
                    }, function (err, car) {
                        if (err) done(err);
                        requestDescriptor._serialise(car, function (err, data) {
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
    });

    describe('ResponseDescriptor', function () {

        describe('transforms', function () {
            var responseDescriptor;
            it('key paths', function () {
                responseDescriptor = new siesta.ext.http.ResponseDescriptor({
                    model: carModel,
                    transforms: {
                        'colour': 'path.to.colour'
                    }
                });
                var data = {
                    colour: 'red'
                };
                responseDescriptor._transformData(data);
                assert.notOk(data.colour);
                assert.equal(data.path.to.colour, 'red');
            });

            it('key', function () {
                responseDescriptor = new siesta.ext.http.ResponseDescriptor({
                    model: carModel,
                    transforms: {
                        'colour': 'color'
                    }
                });
                var data = {
                    colour: 'red'
                };
                responseDescriptor._transformData(data);
                assert.notOk(data.colour);
                assert.equal(data.color, 'red');
            });

            it('function with return val', function () {
                responseDescriptor = new siesta.ext.http.ResponseDescriptor({
                    model: carModel,
                    transforms: {
                        'colour': function (val) {
                            var newVal = val;
                            if (val == 'red') {
                                newVal = 'blue';
                            }
                            return newVal;
                        }
                    }
                });
                var data = {
                    colour: 'red'
                };
                responseDescriptor._transformData(data);
                assert.equal(data.colour, 'blue');
            });

            it('function with return val and key', function () {
                responseDescriptor = new siesta.ext.http.ResponseDescriptor({
                    model: carModel,
                    transforms: {
                        'colour': function (val) {
                            var newVal = val;
                            if (val == 'red') {
                                newVal = 'blue';
                            }
                            return ['color', newVal];
                        }
                    }
                });
                var data = {
                    colour: 'red'
                };
                responseDescriptor._transformData(data);
                assert.notOk(data.colour);
                assert.equal(data.color, 'blue');
            });

            it('function', function () {
                var data = {
                    colour: 'red'
                };
                responseDescriptor = new siesta.ext.http.ResponseDescriptor({
                    model: carModel,
                    transforms: function (_data) {
                        assert.equal(data, _data);
                        return {
                            key: 'value'
                        };
                    }
                });
                data = responseDescriptor._transformData(data);
                assert.notOk(data.colour);
                assert.equal(data.key, 'value');
            });

            it('invalid', function () {
                responseDescriptor = new siesta.ext.http.ResponseDescriptor({
                    model: carModel,
                    transforms: {
                        'colour': {
                            wtf: {
                                is: 'this'
                            }
                        }
                    }
                });
                var data = {
                    colour: 'red'
                };
                assert.throws(function () {
                    responseDescriptor._transformData(data);

                }, InternalSiestaError);
            });

        });

        describe('transforms during deserialisation', function () {
            var responseDescriptor;

            beforeEach(function () {
                responseDescriptor = new siesta.ext.http.ResponseDescriptor({
                    model: carModel,
                    transforms: {
                        'colour': 'color'
                    }
                });
            });

            it('transforms during extractData', function () {
                var extracted = responseDescriptor._extractData({
                    colour: 'red'
                });
                assert.equal(extracted.color, 'red');
                assert.notOk(extracted.colour);
            });
            it('transforms during matchData', function () {
                var extracted = responseDescriptor._matchData({
                    colour: 'red'
                });
                assert.equal(extracted.color, 'red');
                assert.notOk(extracted.colour);
            });
        });

    });


});