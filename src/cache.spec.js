describe.only('cache', function () {

    var RestAPI, cache, RestObject, Mapping;

    var mapping;

    beforeEach(function (done) {
        module('restkit.cache', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        module('restkit.mapping', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_RestAPI_, _cache_, _Mapping_, _RestObject_) {
            RestAPI = _RestAPI_;
            cache = _cache_;
            RestObject = _RestObject_;
            Mapping = _Mapping_;
        });

        RestAPI._reset();
        cache.reset();

        mapping = new Mapping({
            type: 'Car',
            id: 'id',
            attributes: ['colour', 'name']
        });
        mapping.install(function (err) {
            done(err);
        });
    });

    describe('insertion', function () {


        it('by pouch id', function () {
            var r = new RestObject(mapping);
            r._id = 'dsfsd';
            cache.insert(r);
            assert.equal(r, cache._idCache()[r._id]);
        });

        it('by default id', function () {
            var r = new RestObject(mapping);
            r.id = 'dsfsd';
            cache.insert(r);

            var restCache = cache._restCache();
            console.log('restCache:', restCache);
            assert.equal(r, restCache[r.type][r.id]);
        });

        it('by custom id', function () {
            var m = mapping;
            m.id = 'customId';
            var r = new RestObject(m);
            r.customId = 'dsfsd';
            cache.insert(r);
            var restCache = cache._restCache();
            console.log('restCache:', restCache);
            console.log('type:', r.type);
            assert.equal(r, restCache[r.type][r.customId]);
        });
    });

    describe('get', function () {
        it('by pouch id', function () {
            var r = new RestObject(mapping);
            r.id = 'dsfsd';
            cache.insert(r);
            var returned = cache.get({
                mapping: mapping,
                id: 'dsfsd'
            });
            assert.equal(returned, r);
        });
        it('by rest id', function () {
            var r = new RestObject(mapping);
            r.id = 'dsfsd';
            r._id = 'xyz';
            cache.insert(r);
            var returned = cache.get({
                mapping: mapping,
                id: 'dsfsd'
            });
            assert.equal(returned, r);
        });
    });


});