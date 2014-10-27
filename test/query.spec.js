var s = require('../index'),
    assert = require('chai').assert;

describe('query', function() {
    var Query = require('../src/query').Query;
    var Collection = require('../src/collection').Collection;
    var SiestaModel = require('../src/object').SiestaModel;

    beforeEach(function() {
        s.reset(true);
    });

    var collection, mapping;

    beforeEach(function(done) {
        collection = new Collection('myCollection');
        mapping = collection.mapping('Person', {
            id: 'id',
            attributes: ['name', 'age']
        });
        collection.install(done);
    });
    it('object exists', function(done) {
        mapping.map({
            name: 'Michael',
            age: 15
        }, function(err, obj) {
            if (err) done(err);
            else {
                assert.ok(obj);
                var q = new Query(mapping, {
                    age: 15
                });
                q.execute(function(err, objs) {
                    if (err) done(err);
                    assert.equal(objs.length, 1);
                    assert.equal(objs[0], obj);
                    done();
                });
            }
        });
    });
    it('object does not exist', function(done) {
        mapping.map({
            name: 'Michael',
            age: 21
        }, function(err, obj) {
            if (err) done(err);
            else {
                assert.ok(obj);
                var q = new Query(mapping, {
                    age: 15
                });
                q.execute(function(err, objs) {
                    if (err) done(err);
                    assert.equal(objs.length, 0);
                    done();
                });
            }
        });
    });
    it('multiple matches', function(done) {
        mapping.map([{
            name: 'Michael',
            age: 21
        }, {
            name: 'Bob',
            age: 21
        }], function(err, mapped) {
            if (err) done(err);
            else {
                assert.ok(mapped);
                var q = new Query(mapping, {
                    age: 21
                });
                q.execute(function(err, objs) {
                    if (err) done(err);
                    assert.equal(objs.length, 2);
                    assert.include(objs, mapped[0]);
                    assert.include(objs, mapped[1]);
                    done();
                });
            }
        });
    })


});