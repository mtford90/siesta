describe.only('request descriptor', function () {

    var RestAPI, RequestDescriptor;

    beforeEach(function () {
        module('restkit.requestDescriptor', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_RestAPI_, _RequestDescriptor_) {
            RestAPI = _RestAPI_;
            RequestDescriptor = _RequestDescriptor_;
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

    it('mapping', function () {

        assert.ok(false);
    });

    it('data', function () {
        assert.ok(false);
    });

});