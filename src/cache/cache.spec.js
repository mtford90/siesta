describe('cache', function () {

    var Collection, cache, RestObject, Mapping, $rootScope;

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

        inject(function (_Collection_, _cache_, _Mapping_, _RestObject_, _$rootScope_) {
            Collection = _Collection_;
            cache = _cache_;
            RestObject = _RestObject_;
            Mapping = _Mapping_;
            $rootScope = _$rootScope_;
        });

        Collection._reset();
        cache.reset();

        mapping = new Mapping({
            type: 'Car',
            id: 'id',
            attributes: ['colour', 'name'],
            api: 'myApi'
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
            console.log('type:', r.type);
            console.log('api:', r.api);
            assert.equal(r, restCache[r.api][r.type][r.id]);
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
            console.log('api:', r.api);
            assert.equal(r, restCache[r.api][r.type][r.customId]);
        });

        describe('remote id set after insertion', function () {
            it('never had a remote id', function () {
                var r = mapping._new();
                r._id = 'xyz123';
                cache.insert(r);
                r.id = '5678';
                var restCache = cache._restCache();
                dump(restCache);
                $rootScope.$digest();
                assert.equal(restCache[r.api][r.type][r.id], r);
            });
            it('changed remote id', function () {
                var r = mapping._new();
                r._id = 'xyz123';
                r.id = '5678';
                cache.insert(r);
                r.id = '1000';
                var restCache = cache._restCache();
                dump(restCache);
                $rootScope.$digest();
                assert.equal(restCache[r.api][r.type][r.id], r);
                assert.notOk(restCache[r.api][r.type]['5678']);
            });
        })

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