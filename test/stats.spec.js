var siesta = require('../index');
var assert = require('chai').assert;

describe('statistics', function () {
    var Car, Person, coll;

    var Collection = require('../src/collection').Collection;
    var cache = require('../src/cache');

    beforeEach(function (done) {
        siesta.reset(true);
        coll = new Collection('myCollection');
        Car = coll.mapping('Car', {
            id: 'id',
            attributes: ['colour', 'name'],
            relationships: {
                owner: {
                    mapping: 'Person',
                    type: 'OneToMany',
                    reverse: 'cars'
                }
            }
        });
        Person = coll.mapping('Person', {
            id: 'id',
            attributes: ['age', 'name']
        });
        coll.install(done);
    });

    describe('storage enabled', function () {
        describe('no faults', function () {
            describe('collection level', function () {
                describe('single mapping', function () {
                    it('no objects', function (done) {
                        coll.count(function (err, n) {
                            if (err) done(err);
                            assert.equal(n, 0);
                            done();
                        });
                    });

                    it('one object', function (done) {
                        Car.map({colour: 'red', name: 'Aston Martin'}, function (err, obj) {
                            if (err) done(err);
                            coll.count(function (err, n) {
                                if (err) done(err);
                                assert.equal(n, 1);
                                done();
                            });
                        });
                    });

                    it('multiple objects', function (done) {
                        Car.map([
                            {colour: 'red', name: 'Aston Martin'},
                            {colour: 'blue', name: 'Bentley'},
                            {colour: 'green', name: 'Lambo'}
                        ], function (err) {
                            if (err) done(err);
                            coll.count(function (err, n) {
                                if (err) done(err);
                                assert.equal(n, 3);
                                done();
                            });
                        });
                    });
                });
                describe('multiple mappings', function () {
                    it('multiple objects', function (done) {
                        Car.map([
                            {colour: 'red', name: 'Aston Martin'},
                            {colour: 'blue', name: 'Bentley'},
                            {colour: 'green', name: 'Lambo'}
                        ], function (err) {
                            if (err) done(err);
                            Person.map([
                                {age: 24, name: 'Michael Ford'},
                                {age: 25, name: 'John Doe'}
                            ], function (err) {
                                if (err) done(err);
                                coll.count(function (err, n) {
                                    if (err) done(err);
                                    assert.equal(n, 5);
                                    done();
                                });
                            });
                        });
                    });
                });
            });
        });
        describe('all faulted', function () {
            describe('collection level', function () {
                describe('single mapping', function () {
                    it('one object', function (done) {
                        Car.map({colour: 'red', name: 'Aston Martin'}, function (err, obj) {
                            if (err) done(err);
                            siesta.save(function (err) {
                                if (err) done(err);
                                cache.reset();
                                coll.count(function (err, n) {
                                    if (err) done(err);
                                    assert.equal(n, 1);
                                    done();
                                });
                            });

                        });
                    });

                    it('multiple objects', function (done) {
                        Car.map([
                            {colour: 'red', name: 'Aston Martin'},
                            {colour: 'blue', name: 'Bentley'},
                            {colour: 'green', name: 'Lambo'}
                        ], function (err) {
                            if (err) done(err);
                            siesta.save(function (err) {
                                if (err) done(err);
                                cache.reset();
                                coll.count(function (err, n) {
                                    if (err) done(err);
                                    assert.equal(n, 3);
                                    done();
                                });
                            });
                        });
                    });
                });
                describe('multiple mappings', function () {
                    it('multiple objects', function (done) {
                        Car.map([
                            {colour: 'red', name: 'Aston Martin'},
                            {colour: 'blue', name: 'Bentley'},
                            {colour: 'green', name: 'Lambo'}
                        ], function (err) {
                            if (err) done(err);

                            Person.map([
                                {age: 24, name: 'Michael Ford'},
                                {age: 25, name: 'John Doe'}
                            ], function (err) {
                                if (err) done(err);
                                siesta.save(function (err) {
                                    if (err) done(err);
                                    cache.reset();
                                    cache.reset();
                                    coll.count(function (err, n) {
                                        if (err) done(err);
                                        assert.equal(n, 5);
                                        done();
                                    });
                                });
                            });
                        });

                    });
                });
            });

        });
        describe('some faulted', function () {
            describe('collection level', function () {
                describe('single mapping', function () {
                    it('multiple objects', function (done) {
                        Car.map([
                            {colour: 'red', name: 'Aston Martin'},
                            {colour: 'blue', name: 'Bentley'},
                            {colour: 'green', name: 'Lambo'}
                        ], function (err, objs) {
                            if (err) done(err);
                            siesta.save(function (err) {
                                if (err) done(err);
                                delete cache._localCache()[objs[1]._id];
                                coll.count(function (err, n) {
                                    if (err) done(err);
                                    assert.equal(n, 3);
                                    done();
                                });
                            });
                        });
                    });
                });
                describe('multiple mappings', function () {
                    it('multiple objects', function (done) {
                        Car.map([
                            {colour: 'red', name: 'Aston Martin'},
                            {colour: 'blue', name: 'Bentley'},
                            {colour: 'green', name: 'Lambo'}
                        ], function (err, cars) {
                            if (err) done(err);
                            Person.map([
                                {age: 24, name: 'Michael Ford'},
                                {age: 25, name: 'John Doe'}
                            ], function (err, people) {
                                if (err) done(err);
                                siesta.save(function (err) {
                                    if (err) done(err);
                                    delete cache._localCache()[cars[1]._id];
                                    delete cache._localCache()[people[1]._id];
                                    coll.count(function (err, n) {
                                        if (err) done(err);
                                        assert.equal(n, 5);
                                        done();
                                    });
                                });
                            });
                        });

                    });
                });
            });

        });
    });

    describe('storage not enabled', function () {
        before(function () {
            siesta.ext.storageEnabled = false;
        });
        after(function () {
            siesta.ext.storageEnabled = true;
        });
        describe('collection level', function () {
            describe('single mapping', function () {
                it('no objects', function (done) {
                    coll.count(function (err, n) {
                        if (err) done(err);
                        assert.equal(n, 0);
                        done();
                    });
                });

                it('one object', function (done) {
                    Car.map({colour: 'red', name: 'Aston Martin'}, function (err, obj) {
                        if (err) done(err);
                        coll.count(function (err, n) {
                            if (err) done(err);
                            assert.equal(n, 1);
                            done();
                        });
                    });
                });

                it('multiple objects', function (done) {
                    Car.map([
                        {colour: 'red', name: 'Aston Martin'},
                        {colour: 'blue', name: 'Bentley'},
                        {colour: 'green', name: 'Lambo'}
                    ], function (err) {
                        if (err) done(err);
                        coll.count(function (err, n) {
                            if (err) done(err);
                            assert.equal(n, 3);
                            done();
                        });
                    });
                });
            });
            describe('multiple mappings', function () {
                it('multiple objects', function (done) {
                    Car.map([
                        {colour: 'red', name: 'Aston Martin'},
                        {colour: 'blue', name: 'Bentley'},
                        {colour: 'green', name: 'Lambo'}
                    ], function (err) {
                        if (err) done(err);
                        Person.map([
                            {age: 24, name: 'Michael Ford'},
                            {age: 25, name: 'John Doe'}
                        ], function (err) {
                            if (err) done(err);
                            coll.count(function (err, n) {
                                if (err) done(err);
                                assert.equal(n, 5);
                                done();
                            });
                        });
                    });
                });
            });
        });
    });


});