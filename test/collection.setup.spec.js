var assert = require('chai').assert;


describe('collection setup', function () {

    beforeEach(function (done) {
        siesta.reset(done);
    });

    before(function () {
        siesta.ext.storageEnabled = false;
    });

    describe('install', function () {
        var collection;
        beforeEach(function () {
            collection = siesta.collection('MyCollection');
        });

        it('not installed', function () {
            assert.notOk(collection.installed);
        });

        describe('configure without mappings', function () {
            it('eventually finishes', function (done) {
                siesta.install(function (err) {
                    if (err) done(err);
                    done();
                });
            });

            it('raises an error if trying to configure twice', function (done) {
                siesta.install(function (err) {
                    if (err) done(err);
                    assert.throws(function () {
                        siesta.install();
                    });
                    done();
                });
            });

            it('is accessible in the siesta object', function (done) {
                siesta.install(function (err) {
                    if (err) done(err);
                    assert.equal(siesta.MyCollection, collection);
                    done();
                });
            });
        });

        it('raises an error if trying to configure twice', function (done) {
            siesta.install(function (err) {
                if (err) done(err);
                assert.throws(function () {
                    siesta.install();
                });
                done();
            });
        });

        describe('configure with mappings', function () {
            it('name before object', function (done) {
                var mapping1 = collection.model('mapping1', {
                    id: 'id',
                    attributes: ['attr1', 'attr2']
                });
                var mapping2 = collection.model('mapping2', {
                    id: 'id',
                    attributes: ['attr1', 'attr2', 'attr3']
                });
                siesta.install(function (err) {
                    if (err) done(err);
                    assert.equal(collection['mapping1'], mapping1);
                    assert.equal(collection['mapping2'], mapping2);
                    done();
                });
            });

            it('name within object', function (done) {
                var mapping1 = collection.model({
                    name: 'mapping1',
                    id: 'id',
                    attributes: ['attr1', 'attr2']
                });
                var mapping2 = collection.model({
                    name: 'mapping2',
                    id: 'id',
                    attributes: ['attr1', 'attr2', 'attr3']
                });
                siesta.install(function (err) {
                    if (err) done(err);
                    assert.equal(collection['mapping1'], mapping1);
                    assert.equal(collection['mapping2'], mapping2);
                    done();
                });
            });

            it('no name specified within object', function () {
                assert.throws(function () {
                    collection.model({
                        id: 'id',
                        attributes: ['attr1', 'attr2']
                    });
                }, Error);
            });

            it('vararg', function (done) {
                var mappings = collection.model({
                    name: 'mapping1',
                    id: 'id',
                    attributes: ['attr1', 'attr2']
                }, {
                    name: 'mapping2',
                    id: 'id',
                    attributes: ['attr1', 'attr2', 'attr3']
                });
                siesta.install(function (err) {
                    if (err) done(err);
                    assert.equal(collection['mapping1'], mappings[0]);
                    assert.equal(collection['mapping2'], mappings[1]);
                    done();
                });
            });

            it('array', function (done) {
                var mappings = collection.model([{
                    name: 'mapping1',
                    id: 'id',
                    attributes: ['attr1', 'attr2']
                }, {
                    name: 'mapping2',
                    id: 'id',
                    attributes: ['attr1', 'attr2', 'attr3']
                }]);
                siesta.install(function (err) {
                    if (err) done(err);
                    assert.equal(collection['mapping1'], mappings[0]);
                    assert.equal(collection['mapping2'], mappings[1]);
                    done();
                });
            });
        });

    });

});