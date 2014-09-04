var s = require('../index')
    , assert = require('chai').assert;


describe('collection setup', function () {

    var Collection = s.Collection;

    beforeEach(function () {
        s.reset(true);
    });

    describe('install', function () {
        var collection;
        beforeEach(function (done) {
            collection = new Collection('MyCollection');
            done();
        });

        it('not installed', function () {
            assert.notOk(collection.installed);
        });

        describe('configure without mappings', function () {
            it('eventually finishes', function (done) {
                collection.install(function (err) {
                    if (err) done(err);
                    done();
                });
            });

            it('raises an error if trying to configure twice', function (done) {
                collection.install(function (err) {
                    if (err) done(err);
                    collection.install(function (err) {
                        assert.ok(err);
                        done();
                    })
                });
            });
        });

        describe('configure with mappings', function () {
            it('eventually finishes', function (done) {
                collection.mapping('mapping1', {
                    id: 'id',
                    attributes: ['attr1', 'attr2']
                });
                collection.mapping('mapping2', {
                    id: 'id',
                    attributes: ['attr1', 'attr2', 'attr3']
                });
                collection.install(function (err) {
                    if (err) done(err);
                    done();
                });
            });

            it('raises an error if trying to configure twice', function (done) {
                collection.install(function (err) {
                    if (err) done(err);
                    collection.install(function (err) {
                        assert.ok(err);
                        done();
                    })
                });
            });
        });


    });

});