describe('store notifications', function () {

    var Collection, cache, RestObject, Mapping, Store, Pouch;

    var carMapping, collection;

    beforeEach(function (done) {
        module('restkit.store', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Collection_, _cache_, _RestObject_, _Store_, _Mapping_, _Pouch_) {
            Collection = _Collection_;
            cache = _cache_;
            RestObject = _RestObject_;
            Mapping = _Mapping_;
            Store = _Store_;
            Pouch = _Pouch_;
        });
        Collection._reset();
        collection = new Collection('myCollection', function (err, version) {
            if (err) done(err);
            carMapping = collection.registerMapping('Car', {
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