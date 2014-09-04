var s = require('../index')
    , assert = require('chai').assert
    , _ = require('underscore');


describe('dump', function () {

    var Collection = s.Collection
        , RelationshipType = s.RelationshipType
        , Index = s.Index
        , Query = s.Query
        , RawQuery = s.RawQuery
        , RequestDescriptor = s.RequestDescriptor
        , ResponseDescriptor = s.ResponseDescriptor
        , Serialiser = s.serialiser
        , BaseOperation = s.BaseOperation
        , CompositeOperation = s.CompositeOperation
        , SaveOperation = s.SaveOperation
        , MappingOperation = s.MappingOperation
        , cache = s.cache;

    var collection, carMapping, personMapping;


    beforeEach(function (done) {

        s.reset(true, function () {
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



    });

    it('object', function () {
        var astonMartin = carMapping._new({colour: 'red', name: 'Aston Martin'});
        var obj = astonMartin._dump();
        assert.equal(obj.colour, 'red');
        assert.equal(obj.name, 'Aston Martin');
        assert.equal(obj.mapping, 'Car');
        assert.equal(obj.collection, 'myCollection');
        console.log(obj);
        var str = astonMartin._dump(true);
        assert.equal(typeof(str), 'string');
        console.log(str);
    });

    it('mapping', function () {
        var obj = carMapping._dump();
        assert.equal(obj.id, 'id');
        assert.include(obj.attributes, 'colour');
        assert.include(obj.attributes, 'name');
        assert.equal(obj.name, 'Car');
        assert.equal(obj.collection, 'myCollection');
        assert.include(obj.relationships, 'cars');
        console.log(obj);
        var str = carMapping._dump(true);
        assert.equal(typeof(str), 'string');
        console.log(str);
    });

    it('relationship', function () {
        var r = carMapping.relationships[0];
        var obj = r._dump();
        console.log(obj);
        var str = r._dump(true);
        console.log(str);
        assert.equal(typeof(str), 'string');
    });

    it('index', function () {
        var i = new Index('myCollection', 'Car', ['colour', 'name']);
        var obj = i._dump();
        console.log(obj);
        var str = i._dump(true);
        console.log(str);
        assert.equal(typeof(str), 'string');
    });

    it('raw query', function () {
        var q = new RawQuery('myCollection', 'Car', {colour: 'red'});
        var obj = q._dump();
        console.log(obj);
        var str = q._dump(true);
        console.log(str);
        assert.equal(typeof(str), 'string');
    });

    it('query', function () {
        var q = new Query(carMapping, {colour: 'red'});
        var obj = q._dump();
        console.log(obj);
        var str = q._dump(true);
        console.log(str);
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
        console.log(obj);
        var str = r._dump(true);
        console.log(str);
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
        console.log(obj);
        str = r._dump(true);
        console.log(str);
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
        console.log(obj);
        var str = r._dump(true);
        console.log(str);
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
        console.log(obj);
        str = r._dump(true);
        console.log(str);
        assert.equal(typeof(str), 'string');
    });

    it('cache', function (done) {
        carMapping.map([
            {colour: 'blue', id: '2'},
            {colour: 'red', id: '3'}
        ], function (err) {
            if (err) done(err);
            var obj = cache._dump();
            console.log(obj);
            var str = cache._dump(true);
            console.log(str);
            assert.equal(typeof(str), 'string');
            done();
        });
    });

    it('mapping operation', function () {
        var m = new MappingOperation(carMapping, {colour: 'red', name: 'Aston Martin'});
        m._obj = carMapping._new({colour: 'red'});
        var obj = m._dump();
        console.log(obj);
        var str = m._dump(true);
        console.log(str);
        assert.equal(typeof(str), 'string');
    });

    it('base operation', function () {
        var o = new BaseOperation('asdasd');
        var obj = o._dump();
        console.log(obj);
        var str = o._dump(true);
        console.log(str);
        assert.equal(typeof(str), 'string');
    });

    it('composite operation', function () {
        var operations = [
            new BaseOperation('1'),
            new BaseOperation('2'),
            new BaseOperation('3')
        ];
        var o = new CompositeOperation('Composite', operations);
        var obj = o._dump();
        console.log(obj);
        var str = o._dump(true);
        console.log(str);
        assert.equal(typeof(str), 'string');
    });

    it('save operation', function () {
        var ob = carMapping._new({colour: 'red'});
        var o = new SaveOperation(ob);
        var obj = o._dump();
        console.log(obj);
        var str = o._dump(true);
        console.log(str);
        assert.equal(typeof(str), 'string');
    });

    it('collection', function () {
        var obj = collection._dump();
        console.log(obj);
        var str = collection._dump(true);
        console.log(str);
        assert.equal(typeof(str), 'string');
    })


});