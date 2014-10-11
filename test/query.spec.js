var s = require('../index')
    , assert = require('chai').assert;

describe('query', function () {
    var Query = require('../src/query').Query;
    var Collection = require('../src/collection').Collection;
    var SiestaModel = require('../src/object').SiestaModel;

    beforeEach(function () {
        s.reset(true);
    });

    describe('raw query', function () {
        it('design doc name', function () {
            var name = new s.ext.storage.RawQuery('myCollection', 'Car', {colour: 'red', name: 'Aston Martin'})._getDesignDocName();
            assert.equal(name, '_design/myCollection_Index_Car_colour_name');
        });


        it('fields', function () {
            var q = new s.ext.storage.RawQuery('myCollection', 'Car', {colour: 'red', name: 'Aston Martin'});
            var fields = q._getFields();
            assert.include(fields, 'colour');
            assert.include(fields, 'name');
        });

        it('construct key', function () {
            var q = new s.ext.storage.RawQuery('myCollection', 'Car', {colour: 'red', name: 'Aston Martin'});
            var key = q._constructKey();
            assert.equal(key, 'red_Aston Martin');
        });

        it('execute with no rows and no index', function (done) {
            this.timeout(10000); // Can take quite a long time sometimes.
            var q = new s.ext.storage.RawQuery('myCollection', 'Car', {colour: 'red', name: 'Aston Martin'});
            q.execute(function (err, results) {
                if (done) done(err);
                assert.equal(results.length, 0);
                done();
            });
        });

        it('execute with index', function (done) {
            var q = new s.ext.storage.RawQuery('myCollection', 'Car', {colour: 'red', name: 'Aston Martin'});
            var i = new s.ext.storage.Index('myCollection', 'Car', ['colour', 'name']);
            i.install(function (err) {
                if (err) done(err);
                q.execute(function (err, results) {
                    if (done) done(err);
                    assert.equal(results.length, 0);
                    done();
                });
            });
        });

        it('execute with index with rows', function (done) {
            var q = new s.ext.storage.RawQuery('myCollection', 'Car', {colour: 'red', name: 'Aston Martin'});
            var i = new s.ext.storage.Index('myCollection', 'Car', ['colour', 'name']);
            i.install(function (err) {
                if (err) done(err);
                s.ext.storage.Pouch.getPouch().post({'type': 'Car', colour: 'red', name: 'Aston Martin', collection: 'myCollection'}, function (err) {
                    if (err) done(err);
                    q.execute(function (err, results) {
                        if (done) done(err);
                        assert.equal(results.length, 1);
                        done();
                    });
                });
            });
        });

        it('execute without index with rows', function (done) {
            this.timeout(10000); // Can take quite a long time sometimes.
            var q = new s.ext.storage.RawQuery('myCollection', 'Car', {colour: 'red', name: 'Aston Martin'});
            s.ext.storage.Pouch.getPouch().post({'type': 'Car', colour: 'red', name: 'Aston Martin', collection: 'myCollection'}, function (err) {
                if (err) done(err);
                q.execute(function (err, results) {
                    if (done) done(err);
                    assert.equal(results.length, 1);
                    done();
                });
            });
        });


    });

    describe('query', function () {
        var collection, mapping;

        it('asdasd', function (done) {
            collection = new Collection('myCollection');
            mapping = collection.mapping('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });
            collection.install(function (err) {
                if (err) done(err);
                s.ext.storage.Pouch.getPouch().post({type: 'Person', age: 23, collection: 'myCollection', name: 'Michael'}, function (err, resp) {
                    if (err) done(err);
                    var q = new Query(mapping, {age: 23});
                    q.execute(function (err, objs) {
                        if (err) done(err);
                        try {
                            assert.ok(objs.length);
                            _.each(objs, function (obj) {
                                assert.instanceOf(obj, SiestaModel);
                            });
                            done();
                        }
                        catch (err) {
                            done(err);
                        }

                    });
                });
            });


        })
    });

    describe('query without storage', function () {
        var collection, mapping;
        var storage = s.ext.storage;
        before(function () {
            s.ext.storageEnabled = false;
        });
        after(function () {
            s.ext.storageEnabled = true;
        });
        beforeEach(function (done) {
            collection = new Collection('myCollection');
            mapping = collection.mapping('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });
            collection.install(done);
        });
        it('object exists', function (done) {
            mapping.map({name: 'Michael', age: 15}, function (err, obj) {
                if (err) done(err);
                else {
                    assert.ok(obj);
                    var q = new Query(mapping, {age: 15});
                    q.execute(function (err, objs) {
                        if (err) done(err);
                        assert.equal(objs.length, 1);
                        assert.equal(objs[0], obj);
                        done();
                    });
                }
            });
        });
        it('object does not exist', function (done) {
            mapping.map({name: 'Michael', age: 21}, function (err, obj) {
                if (err) done(err);
                else {
                    assert.ok(obj);
                    var q = new Query(mapping, {age: 15});
                    q.execute(function (err, objs) {
                        if (err) done(err);
                        assert.equal(objs.length, 0);
                        done();
                    });
                }
            });
        });
        it ('multiple matches', function (done) {
            mapping.map([{name: 'Michael', age: 21}, {name: 'Bob', age: 21}], function (err, mapped) {
                if (err) done(err);
                else {
                    assert.ok(mapped);
                    var q = new Query(mapping, {age: 21});
                    q.execute(function (err, objs) {
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


});