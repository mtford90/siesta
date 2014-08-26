describe('cache', function () {

    var Collection, cache, RestObject, Mapping, $rootScope, RestError;

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

        inject(function (_Collection_, _cache_, _Mapping_, _RestObject_, _$rootScope_, _RestError_) {
            Collection = _Collection_;
            cache = _cache_;
            RestObject = _RestObject_;
            Mapping = _Mapping_;
            $rootScope = _$rootScope_;
            RestError = _RestError_;
        });

        Collection._reset();
        cache.reset();

        mapping = new Mapping({
            type: 'Car',
            id: 'id',
            attributes: ['colour', 'name'],
            collection: 'myCollection'
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
            console.log('collection:', r.collection);
            assert.equal(r, restCache[r.collection][r.type][r.id]);
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
            console.log('collection:', r.collection);
            assert.equal(r, restCache[r.collection][r.type][r.customId]);
        });

        describe('remote id set after insertion', function () {
            it('never had a remote id', function () {
                var r = mapping._new();
                r._id = 'xyz123';
                cache.insert(r);
                r.id = '5678';
                var restCache = cache._restCache();
                $rootScope.$digest();
                assert.equal(restCache[r.collection][r.type][r.id], r);
            });
            it('changed remote id', function () {
                var r = mapping._new();
                r._id = 'xyz123';
                r.id = '5678';
                cache.insert(r);
                r.id = '1000';
                var restCache = cache._restCache();
                $rootScope.$digest();
                assert.equal(restCache[r.collection][r.type][r.id], r);
                assert.notOk(restCache[r.collection][r.type]['5678']);
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

    describe('full test', function () {
        var collection, carMapping, personMapping;

        beforeEach(function (done) {
            inject(function (DescriptorRegistry, ResponseDescriptor, RelationshipType) {
                collection = new Collection('myCollection', function (err, version) {
                    if (err) done(err);
                    personMapping = collection.registerMapping('Person', {
                        id: 'id',
                        attributes: ['name', 'age']
                    });
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
                    collection.baseURL = 'http://mywebsite.co.uk/';
                    var desc = new ResponseDescriptor({
                        method: 'GET',
                        mapping: carMapping,
                        path: '/cars/(?<id>[0-9])/?'
                    });
                    DescriptorRegistry.registerResponseDescriptor(desc);
                }, function (err) {
                    if (err) done(err);
                    done();
                });

            });

        });

        describe.only('errors', function () {
            it('ignore duplicate inserts if is the same object', function () {
                var person = personMapping._new({name: 'Michael Ford', age: 23, id: 'xyz'});
                cache.insert(person);
                cache.insert(person); // Should be fine as is the exact same object.
            });

            it('cant insert object with same _id', function () {
                var person = personMapping._new({name: 'Michael Ford', age: 23, id: 'xyz'});
                cache.insert(person);
                var duplicateObject = new RestObject();
                duplicateObject._id = person._id;
                assert.throws(function () {
                    cache.insert(duplicateObject);
                }, RestError);
            });

            it('cant insert object with same id', function () {
                var person = personMapping._new({name: 'Michael Ford', age: 23, id: 'xyz'});
                cache.insert(person);

                assert.throws(function () {
                    cache.insert(personMapping._new({name: 'Michael Ford', age: 23, id: 'xyz'}));
                }, RestError);
            });


        });





    })

});