var siesta = require('../core/index');
var assert = require('chai').assert;

describe('statistics', function() {
    var Car, Person, coll;

    var Collection = require('../core/collection').Collection;
    var cache = require('../core/cache');

    beforeEach(function(done) {
        siesta.reset(true);
        coll = new Collection('myCollection');
        Car = coll.model('Car', {
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
        Person = coll.model('Person', {
            id: 'id',
            attributes: ['age', 'name']
        });
        coll.install(done);
    });

    before(function() {
        siesta.ext.storageEnabled = false;
    });
    after(function() {
        siesta.ext.storageEnabled = true;
    });
    describe('collection level', function() {
        describe('single mapping', function() {
            it('no objects', function(done) {
                coll.count(function(err, n) {
                    if (err) done(err);
                    assert.equal(n, 0);
                    done();
                });
            });

            it('one object', function(done) {
                Car.map({
                    colour: 'red',
                    name: 'Aston Martin'
                }, function(err, obj) {
                    if (err) done(err);
                    coll.count(function(err, n) {
                        if (err) done(err);
                        assert.equal(n, 1);
                        done();
                    });
                });
            });

            it('multiple objects', function(done) {
                Car.map([{
                    colour: 'red',
                    name: 'Aston Martin'
                }, {
                    colour: 'blue',
                    name: 'Bentley'
                }, {
                    colour: 'green',
                    name: 'Lambo'
                }], function(err) {
                    if (err) done(err);
                    coll.count(function(err, n) {
                        if (err) done(err);
                        assert.equal(n, 3);
                        done();
                    });
                });
            });
        });
        describe('multiple mappings', function() {
            it('multiple objects', function(done) {
                Car.map([{
                    colour: 'red',
                    name: 'Aston Martin'
                }, {
                    colour: 'blue',
                    name: 'Bentley'
                }, {
                    colour: 'green',
                    name: 'Lambo'
                }], function(err) {
                    if (err) done(err);
                    Person.map([{
                        age: 24,
                        name: 'Michael Ford'
                    }, {
                        age: 25,
                        name: 'John Doe'
                    }], function(err) {
                        if (err) done(err);
                        coll.count(function(err, n) {
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