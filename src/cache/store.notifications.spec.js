describe('store notifications', function () {

    var RestAPI, cache, RestObject, Mapping, Store, Pouch;

    var carMapping, api;

    beforeEach(function (done) {
        module('restkit.store', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_RestAPI_, _cache_, _RestObject_, _Store_, _Mapping_, _Pouch_) {
            RestAPI = _RestAPI_;
            cache = _cache_;
            RestObject = _RestObject_;
            Mapping = _Mapping_;
            Store = _Store_;
            Pouch = _Pouch_;
        });
        RestAPI._reset();
        api = new RestAPI('myApi', function (err, version) {
            if (err) done(err);
            carMapping = api.registerMapping('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
        }, function () {
            done();
        });
    });

    it('xyz', function () {

    });


});