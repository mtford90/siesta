describe.only('dump', function () {

    var Operation, Collection, RelationshipType, Index, Query, RawQuery, RequestDescriptor, ResponseDescriptor, Serialiser, cache;
    var collection, carMapping, personMapping;

    beforeEach(function (done) {
        module('restkit.mapping.operation', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });
        module('restkit', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_cache_, Pouch, _BaseOperation_, _Collection_, _RelationshipType_, _Index_, _RawQuery_, _Query_, _ResponseDescriptor_, _RequestDescriptor_, _Serialiser_) {
            Pouch.reset();
            Operation = _BaseOperation_;
            Collection = _Collection_;
            RelationshipType = _RelationshipType_;
            Index = _Index_;
            RawQuery = _RawQuery_;
            Query = _Query_;
            RequestDescriptor = _RequestDescriptor_;
            ResponseDescriptor = _ResponseDescriptor_;
            Serialiser = _Serialiser_;
            cache = _cache_;
        });

        collection = new Collection('myCollection');

        carMapping = collection.mapping('Car', {
            id: 'id',
            attributes: ['colour', 'name'],
            relationships: {
                owner: {
                    mapping: 'Person',
                    type: RelationshipType.ForeignKey,
                    reverse: 'cars'
                }
            },
            indexes: ['colour', 'name']
        });
        personMapping = collection.mapping('Person', {
            id: 'id',
            attributes: ['name', 'age']
        });

        collection.install(done);

    });

    it('object', function () {
        var astonMartin = carMapping._new({colour: 'red', name: 'Aston Martin'});
        var obj = astonMartin._dump();
        assert.equal(obj.colour, 'red');
        assert.equal(obj.name, 'Aston Martin');
        assert.equal(obj.mapping, 'Car');
        assert.equal(obj.collection, 'myCollection');
        dump(obj);
        var str = astonMartin._dump(true);
        assert.equal(typeof(str), 'string');
        dump(str);
    });

    it('mapping', function () {
        var obj = carMapping._dump();
        assert.equal(obj.id, 'id');
        assert.include(obj.attributes, 'colour');
        assert.include(obj.attributes, 'name');
        assert.equal(obj.name, 'Car');
        assert.equal(obj.collection, 'myCollection');
        assert.include(obj.relationships, 'cars');
        dump(obj);
        var str = carMapping._dump(true);
        assert.equal(typeof(str), 'string');
        dump(str);
    });

    it('relationship', function () {
        var r = carMapping.relationships[0];
        var obj = r._dump();
        dump(obj);
        var str = r._dump(true);
        dump(str);
        assert.equal(typeof(str), 'string');
    });

    it('index', function () {
        var i = new Index('myCollection', 'Car', ['colour', 'name']);
        var obj = i._dump();
        dump(obj);
        var str = i._dump(true);
        dump(str);
        assert.equal(typeof(str), 'string');
    });

    it('raw query', function () {
        var q = new RawQuery('myCollection', 'Car', {colour: 'red'});
        var obj = q._dump();
        dump(obj);
        var str = q._dump(true);
        dump(str);
        assert.equal(typeof(str), 'string');
    });

    it('query', function () {
        var q = new Query(carMapping, {colour: 'red'});
        var obj = q._dump();
        dump(obj);
        var str = q._dump(true);
        dump(str);
        assert.equal(typeof(str), 'string');
    });

    it('request descriptor', function () {
        var r = new RequestDescriptor({
            method: 'POST',
            mapping: carMapping,
            path: '/cars/(?<id>[0-9])/?',
            serialiser: Serialiser.depthSerializer(0),
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
        var obj = r._dump();
        dump(obj);
        var str = r._dump(true);
        dump(str);
        assert.equal(typeof(str), 'string');
        r = new RequestDescriptor({
            method: 'POST',
            mapping: carMapping,
            path: '/cars/(?<id>[0-9])/?',
            serialiser: 'depthSerializer',
            transforms: {
                'colour': 'color'
            }
        });
        obj = r._dump();
        dump(obj);
        str = r._dump(true);
        dump(str);
        assert.equal(typeof(str), 'string');
    });


    it('response descriptor', function () {
        var r = new ResponseDescriptor({
            method: 'POST',
            mapping: carMapping,
            path: '/cars/(?<id>[0-9])/?',
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
        var obj = r._dump();
        dump(obj);
        var str = r._dump(true);
        dump(str);
        assert.equal(typeof(str), 'string');
        r = new ResponseDescriptor({
            method: 'POST',
            mapping: carMapping,
            path: '/cars/(?<id>[0-9])/?',
            transforms: {
                'colour': 'color'
            }
        });
        obj = r._dump();
        dump(obj);
        str = r._dump(true);
        dump(str);
        assert.equal(typeof(str), 'string');
    });

    it('cache', function (done) {
        carMapping.map([
            {colour: 'blue', id: '2'},
            {colour: 'red', id: '3'}
        ], function (err) {
            if (err) done(err);
            var obj = cache._dump();
            dump(obj);
            var str = cache._dump(true);
            dump(str);
            assert.equal(typeof(str), 'string');
            done();
        });
    });

    it('mapping operation', function () {
        inject(function (MappingOperation) {
            var m = new MappingOperation(carMapping, {colour: 'red', name: 'Aston Martin'});
            m._obj = carMapping._new({colour: 'red'});
            var obj = m._dump();
            dump(obj);
            var str = m._dump(true);
            dump(str);
            assert.equal(typeof(str), 'string');
        });
    });

    it('base operation', function () {
        inject(function (BaseOperation) {
            var o = new BaseOperation('asdasd');
            var obj = o._dump();
            dump(obj);
            var str = o._dump(true);
            dump(str);
            assert.equal(typeof(str), 'string');
        });
    });

    it('composite operation', function () {
        inject(function (CompositeOperation, BaseOperation) {
            var operations = [
                new BaseOperation('1'),
                new BaseOperation('2'),
                new BaseOperation('3')
            ];
            var o = new CompositeOperation('Composite', operations);
            var obj = o._dump();
            dump(obj);
            var str = o._dump(true);
            dump(str);
            assert.equal(typeof(str), 'string');
        });
    });

    it('save operation', function () {
        inject(function (SaveOperation) {
            var ob = carMapping._new({colour: 'red'});
            var o = new SaveOperation(ob);
            var obj = o._dump();
            dump(obj);
            var str = o._dump(true);
            dump(str);
            assert.equal(typeof(str), 'string');
        });
    });


});