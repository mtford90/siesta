describe('request descriptor', function () {

    var RestAPI, RequestDescriptor, RestError, DescriptorRegistry;

    var api, carMapping;

    beforeEach(function (done) {
        module('restkit.requestDescriptor', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_RestAPI_, _RequestDescriptor_, _RestError_, _DescriptorRegistry_) {
            RestAPI = _RestAPI_;
            RequestDescriptor = _RequestDescriptor_;
            RestError = _RestError_;
            DescriptorRegistry = _DescriptorRegistry_;
        });

        api = new RestAPI('myApi', function (err, version) {
            if (err) done(err);
            carMapping = api.registerMapping('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
        }, function () {
            done();
        });

        RestAPI._reset();
    });

    describe('matching', function () {

        describe('path', function () {
            it('match id', function () {
                var r = new RequestDescriptor({path: '/cars/(?<id>[0-9])/?'});
                var match = r._matchPath('/cars/5/');
                assert.equal(match.id, '5');
                match = r._matchPath('/cars/5');
                assert.equal(match.id, '5');
            });
        });

        describe('http methods', function () {
            it('all http methods', function () {
                var r = new RequestDescriptor({method: '*'});
                _.each(r.httpMethods, function (method) {
                    assert.include(r.method, method);
                });
                r = new RequestDescriptor({method: ['*']});
                _.each(r.httpMethods, function (method) {
                    assert.include(r.method, method);
                });
                r = new RequestDescriptor({method: ['*', 'GET']});
                _.each(r.httpMethods, function (method) {
                    assert.include(r.method, method);
                });
            });
            it('match against all', function () {
                var r = new RequestDescriptor({method: '*'});
                _.each(r.httpMethods, function (method) {
                    assert.ok(r._matchMethod(method));
                    assert.ok(r._matchMethod(method.toUpperCase()));
                    assert.ok(r._matchMethod(method.toLowerCase()));
                });
            });
            it('match against some', function () {
                var r = new RequestDescriptor({method: ['POST', 'PUT']});
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

                assertMatchMethod(new RequestDescriptor({method: ['POST']}));
                assertMatchMethod(new RequestDescriptor({method: ['pOsT']}));
                assertMatchMethod(new RequestDescriptor({method: 'pOsT'}));
                assertMatchMethod(new RequestDescriptor({method: 'post'}));
                assertMatchMethod(new RequestDescriptor({method: 'POST'}));
            })
        });

    });


    describe('specify mapping', function () {
        it('as object', function () {
            var r = new RequestDescriptor({mapping: carMapping});
            assert.equal(r.mapping, carMapping);
        });
        it('as string', function () {
            var r = new RequestDescriptor({mapping: 'Car', api: 'myApi'});
            assert.equal('Car', r.mapping.type);
        });
        it('as string, but api as object', function () {
            var r = new RequestDescriptor({mapping: 'Car', api: api});
            assert.equal('Car', r.mapping.type);
        });
        it('should throw an exception if passed as string without api', function () {
            assert.throws(_.partial(RequestDescriptor, {mapping: 'Car'}), RestError);
        });
    });

    describe('data', function () {
        it('if null, should be null', function () {
            var r = new RequestDescriptor({data: null});
            assert.notOk(r.data);
        });
        it('if empty string, should be null', function () {
            var r = new RequestDescriptor({data: ''});
            assert.notOk(r.data);
        });
        it('if length 1, should be a string', function () {
            var r = new RequestDescriptor({data: 'abc'});
            assert.equal(r.data, 'abc');
        });
        it('if > length 1, should be an object', function () {
            var r = new RequestDescriptor({data: 'path.to.data'});
            assert.equal(r.data.path.to, 'data');
        });
        describe('embed', function () {
            var data = {x: 1, y: 2, z: 3};
            it('if null, should simply return the object', function () {
                var r = new RequestDescriptor({data: null});
                assert.equal(data, r._embedData(data));
            });
            it('if empty string, should simply return the object', function () {
                var r = new RequestDescriptor({data: ''});
                assert.equal(data, r._embedData(data));
            });
            it('if length 1, should return 1 level deep object', function () {
                var r = new RequestDescriptor({data: 'abc'});
                assert.equal(data, r._embedData(data).abc);
            });
            it('if > length 1, should return n level deep object', function () {
                var r = new RequestDescriptor({data: 'path.to.data'});
                var extractData = r._embedData(data);
                console.log('yo', extractData);
                assert.equal(data, extractData.path.to.data);
            });
        });
        describe('extract', function () {
            var data = {x: 1, y: 2, z: 3};
            it('if null, should simply return the object', function () {
                var r = new RequestDescriptor({data: null});
                var extractData = r._extractData(data);
                assert.equal(extractData, data);
            });
            it('if empty string, should simply return the object', function () {
                var r = new RequestDescriptor({data: ''});
                var extractData = r._extractData(data);
                assert.equal(extractData, data);
            });
            it('if length 1, should return 1 level deep object', function () {
                var r = new RequestDescriptor({data: 'abc'});
                var extractData = r._extractData({abc: data});
                assert.equal(extractData, data);
            });
            it('if > length 1, should return n level deep object', function () {
                var r = new RequestDescriptor({data: 'path.to.data'});
                var extractData = r._extractData({path: {to: {data: data}}});
                assert.equal(extractData, data);
            });
        });
    });

    describe('registry', function () {
        it('should register request descriptor', function () {
            var r = new RequestDescriptor({data: 'path.to.data'});
            assert.include(DescriptorRegistry.requestDescriptors, r);
        });
    });

    describe('match http config', function () {
        describe('no data', function () {
            var descriptor;
            beforeEach(function () {
                descriptor = new RequestDescriptor({
                    method: 'POST',
                    mapping: carMapping,
                    path: '/cars/(?<id>[0-9])/?'
                });
            });
            it('match', function () {
                assert.equal(descriptor.match({
                    method: 'POST',
                    url: '/cars/5/'
                }), carMapping);
            });
            it('no match because of method', function () {
                assert.notOk(descriptor.match({
                    method: 'GET',
                    url: '/cars/5/'
                }));
            });
            it('no match because of url', function () {
                assert.notOk(descriptor.match({
                    method: 'POST',
                    url: '/asdasd/'
                }));
            });
        });

        describe('data', function () {
            var descriptor;
            beforeEach(function () {
                descriptor = new RequestDescriptor({
                    method: 'POST',
                    mapping: carMapping,
                    path: '/cars/(?<id>[0-9])/?',
                    data: 'path.to.data'
                });
            });
            it('match', function () {
                assert.equal(descriptor.match({
                    method: 'POST',
                    url: '/cars/5/',
                    data: {
                        path: {
                            to: {
                                data: {
                                    x: 1,
                                    y: 2
                                }
                            }
                        }
                    }
                }), carMapping);
            });
            it('no match', function () {
                assert.notOk(descriptor.match({
                    method: 'POST',
                    url: '/cars/5/',
                    data: {
                        path: { // Missing 'to'
                            data: {
                                x: 1,
                                y: 2
                            }
                        }
                    }
                }));
            });

        })

    })


});