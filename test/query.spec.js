var s = require('../core/index'),
    assert = require('chai').assert;

describe('query', function() {
    var Query = require('../core/query').Query;
    var Collection = require('../core/collection').Collection;
    var SiestaModel = require('../core/siestaModel').SiestaModel;

    beforeEach(function() {
        s.reset(true);
    });

    describe('basic', function() {
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
        });
    });

    describe('e', function() {
        var collection, personMapping, carMapping;

        beforeEach(function(done) {
            collection = new Collection('myCollection');
            personMapping = collection.mapping('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });
            carMapping = collection.mapping('Car', {
                id: 'id',
                attributes: ['colour', 'name'],
                relationships: {
                    owner: {
                        type: 'OneToMany',
                        mapping: 'Person',
                        reverse: 'cars'
                    }
                }
            });
            collection.install(done);
        });

        describe('attributes', function() {
            it('matches', function(done) {
                personMapping.map([{
                    name: 'Michael',
                    age: 21
                }, {
                    name: 'Bob',
                    age: 21
                }], function(err, mapped) {
                    if (err) done(err);
                    else {
                        assert.ok(mapped);
                        var q = new Query(personMapping, {
                            age__e: 21
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
            });

            it('no matches', function(done) {
                personMapping.map([{
                    name: 'Michael',
                    age: 21
                }, {
                    name: 'Bob',
                    age: 21
                }], function(err, mapped) {
                    if (err) done(err);
                    else {
                        assert.ok(mapped);
                        var q = new Query(personMapping, {
                            age__e: 23
                        });
                        q.execute(function(err, objs) {
                            if (err) done(err);
                            assert.notOk(objs.length);
                            done();
                        });
                    }
                });
            });
        });

        describe('relationships', function() {
            it('model', function(done) {
                personMapping.map({
                    name: 'Michael',
                    age: 21
                }, function(err, person) {
                    if (err) done(err);
                    carMapping.map({
                        colour: 'red',
                        name: 'Aston Martin',
                        owner: person
                    }, function(err, car) {
                        if (err) done(err);
                        else {
                            var q = new Query(carMapping, {
                                owner__e: person
                            });
                            q.execute(function(err, objs) {
                                if (err) done(err);
                                assert.ok(objs.length);
                                done();
                            });
                        }
                    });
                });
            });
        });
    });

    describe('lt', function() {
        var collection, personMapping, carMapping;

        beforeEach(function(done) {
            collection = new Collection('myCollection');
            personMapping = collection.mapping('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });
            collection.install(done);
        });

        it('matches all', function(done) {
            personMapping.map([{
                name: 'Michael',
                age: 21
            }, {
                name: 'Bob',
                age: 21
            }], function(err, mapped) {
                if (err) done(err);
                else {
                    assert.ok(mapped);
                    var q = new Query(personMapping, {
                        age__lt: 22
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
        });

        it('matches some', function(done) {
            personMapping.map([{
                name: 'Michael',
                age: 21
            }, {
                name: 'Bob',
                age: 22
            }], function(err, mapped) {
                if (err) done(err);
                else {
                    assert.ok(mapped);
                    var q = new Query(personMapping, {
                        age__lt: 22
                    });
                    q.execute(function(err, objs) {
                        if (err) done(err);
                        assert.equal(objs.length, 1);
                        assert.include(objs, mapped[0]);
                        done();
                    });
                }
            });
        });

        it('no matches', function(done) {
            personMapping.map([{
                name: 'Michael',
                age: 21
            }, {
                name: 'Bob',
                age: 21
            }], function(err, mapped) {
                if (err) done(err);
                else {
                    assert.ok(mapped);
                    var q = new Query(personMapping, {
                        age__lt: 21
                    });
                    q.execute(function(err, objs) {
                        if (err) done(err);
                        assert.notOk(objs.length);
                        done();
                    });
                }
            });
        });
    });

    describe('lte', function() {
        var collection, personMapping, carMapping;

        beforeEach(function(done) {
            collection = new Collection('myCollection');
            personMapping = collection.mapping('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });
            collection.install(done);
        });

        it('matches all', function(done) {
            personMapping.map([{
                name: 'Michael',
                age: 21
            }, {
                name: 'Bob',
                age: 21
            }], function(err, mapped) {
                if (err) done(err);
                else {
                    assert.ok(mapped);
                    var q = new Query(personMapping, {
                        age__lte: 21
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
        });

        it('matches some', function(done) {
            personMapping.map([{
                name: 'Michael',
                age: 21
            }, {
                name: 'Bob',
                age: 22
            }, {
                name: 'John',
                age: 23
            }], function(err, mapped) {
                if (err) done(err);
                else {
                    assert.ok(mapped);
                    var q = new Query(personMapping, {
                        age__lte: 22
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
        });

        it('no matches', function(done) {
            personMapping.map([{
                name: 'Michael',
                age: 21
            }, {
                name: 'Bob',
                age: 21
            }], function(err, mapped) {
                if (err) done(err);
                else {
                    assert.ok(mapped);
                    var q = new Query(personMapping, {
                        age__lte: 20
                    });
                    q.execute(function(err, objs) {
                        if (err) done(err);
                        assert.notOk(objs.length);
                        done();
                    });
                }
            });
        });
    });

    describe('gt', function() {
        var collection, personMapping, carMapping;

        beforeEach(function(done) {
            collection = new Collection('myCollection');
            personMapping = collection.mapping('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });
            collection.install(done);
        });

        it('matches all', function(done) {
            personMapping.map([{
                name: 'Michael',
                age: 21
            }, {
                name: 'Bob',
                age: 21
            }], function(err, mapped) {
                if (err) done(err);
                else {
                    assert.ok(mapped);
                    var q = new Query(personMapping, {
                        age__gt: 20
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
        });

        it('matches some', function(done) {
            personMapping.map([{
                name: 'Michael',
                age: 21
            }, {
                name: 'Bob',
                age: 22
            }, {
                name: 'John',
                age: 23
            }], function(err, mapped) {
                if (err) done(err);
                else {
                    assert.ok(mapped);
                    var q = new Query(personMapping, {
                        age__gt: 21
                    });
                    q.execute(function(err, objs) {
                        if (err) done(err);
                        assert.equal(objs.length, 2);
                        assert.include(objs, mapped[1]);
                        assert.include(objs, mapped[2]);
                        done();
                    });
                }
            });
        });

        it('no matches', function(done) {
            personMapping.map([{
                name: 'Michael',
                age: 21
            }, {
                name: 'Bob',
                age: 21
            }], function(err, mapped) {
                if (err) done(err);
                else {
                    assert.ok(mapped);
                    var q = new Query(personMapping, {
                        age__gt: 21
                    });
                    q.execute(function(err, objs) {
                        if (err) done(err);
                        assert.notOk(objs.length);
                        done();
                    });
                }
            });
        });
    });

    describe('gte', function() {
        var collection, personMapping, carMapping;

        beforeEach(function(done) {
            collection = new Collection('myCollection');
            personMapping = collection.mapping('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });
            collection.install(done);
        });

        it('matches all', function(done) {
            personMapping.map([{
                name: 'Michael',
                age: 21
            }, {
                name: 'Bob',
                age: 21
            }], function(err, mapped) {
                if (err) done(err);
                else {
                    assert.ok(mapped);
                    var q = new Query(personMapping, {
                        age__gte: 21
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
        });

        it('matches some', function(done) {
            personMapping.map([{
                name: 'Michael',
                age: 21
            }, {
                name: 'Bob',
                age: 22
            }, {
                name: 'John',
                age: 23
            }], function(err, mapped) {
                if (err) done(err);
                else {
                    assert.ok(mapped);
                    var q = new Query(personMapping, {
                        age__gte: 22
                    });
                    q.execute(function(err, objs) {
                        if (err) done(err);
                        assert.equal(objs.length, 2);
                        assert.include(objs, mapped[1]);
                        assert.include(objs, mapped[2]);
                        done();
                    });
                }
            });
        });

        it('no matches', function(done) {
            personMapping.map([{
                name: 'Michael',
                age: 21
            }, {
                name: 'Bob',
                age: 21
            }], function(err, mapped) {
                if (err) done(err);
                else {
                    assert.ok(mapped);
                    var q = new Query(personMapping, {
                        age__gte: 22
                    });
                    q.execute(function(err, objs) {
                        if (err) done(err);
                        assert.notOk(objs.length);
                        done();
                    });
                }
            });
        });
    });



    describe('errors', function() {
        beforeEach(function(done) {
            collection = new Collection('myCollection');
            personMapping = collection.mapping('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });
            carMapping = collection.mapping('Car', {
                id: 'id',
                attributes: ['colour', 'name'],
                relationships: {
                    owner: {
                        type: 'OneToMany',
                        mapping: 'Person',
                        reverse: 'cars'
                    }
                }
            });
            collection.install(done);
        });

        it('invalid op', function(done) {
            personMapping.map([{
                name: 'Michael',
                age: 21
            }, {
                name: 'Bob',
                age: 21
            }], function(err, mapped) {
                if (err) done(err);
                else {
                    assert.ok(mapped);
                    var q = new Query(personMapping, {
                        age__dfsoigsd: 21
                    });
                    q.execute(function(err, objs) {
                        assert.ok(err);
                        assert.notOk(objs);
                        done();
                    });
                }
            });
        })
    });





});