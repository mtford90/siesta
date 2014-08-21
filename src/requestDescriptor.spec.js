describe.only('request descriptor', function () {

    var RestAPI, RequestDescriptor, RestError;

    var api, mapping;

    beforeEach(function (done) {
        module('restkit.requestDescriptor', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_RestAPI_, _RequestDescriptor_, _RestError_) {
            RestAPI = _RestAPI_;
            RequestDescriptor = _RequestDescriptor_;
            RestError = _RestError_;
        });

        api = new RestAPI('myApi', function (err, version) {
            if (err) done(err);
            mapping = api.registerMapping('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
        }, function () {
            done();
        });

        RestAPI._reset();
    });

    it('match path', function () {
        var r = new RequestDescriptor({path: '/cars/(?<id>[0-9])/?'});
        var match = r._matchPath('/cars/5/');
        assert.equal(match.id, '5');
        match = r._matchPath('/cars/5');
        assert.equal(match.id, '5');
    });

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

    describe('specify mapping', function () {
        it('as object', function () {
            var r = new RequestDescriptor({mapping: mapping});
            assert.equal(r.mapping, mapping);
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

    it('data', function () {
        var r = new RequestDescriptor({data: 'path.to.data'});
        assert.equal(r.data, 'path.to.data');
    });

});