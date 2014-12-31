var s = require('../core/index'),
    assert = require('chai').assert;


describe('collection setup', function () {

    var Collection = require('../core/collection');
    var InternalSiestaError = require('../core/error').InternalSiestaError;

    beforeEach(function (done) {
        s.reset(done);
    });

    before(function () {
        s.ext.storageEnabled = false;
    });

    describe('install', function () {
        var collection;
        beforeEach(function () {
            collection = s.collection('MyCollection');
        });

        it('not installed', function () {
            assert.notOk(collection.installed);
        });

        describe('configure without mappings', function () {
            it('eventually finishes', function (done) {
                s.install(function (err) {
                    if (err) done(err);
                    done();
                });
            });

            it('raises an error if trying to configure twice', function (done) {
                s.install(function (err) {
                    if (err) done(err);
                    s.install(function (err) {
                        assert.ok(err);
                        done();
                    })
                });
            });

            it('is accessible in the siesta object', function (done) {
                s.install(function (err) {
                    if (err) done(err);
                    assert.equal(s.MyCollection, collection);
                    done();
                });
            });
        });

        it('raises an error if trying to configure twice', function (done) {
            s.install(function (err) {
                if (err) done(err);
                s.install(function (err) {
                    assert.ok(err);
                    done();
                })
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
                s.install(function (err) {
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
                s.install(function (err) {
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
                s.install(function (err) {
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
                s.install(function (err) {
                    if (err) done(err);
                    assert.equal(collection['mapping1'], mappings[0]);
                    assert.equal(collection['mapping2'], mappings[1]);
                    done();
                });
            });
        });

        describe('configure with descriptors', function () {
            var mapping1, mapping2;
            beforeEach(function () {
                mapping1 = collection.model('mapping1', {
                    id: 'id',
                    attributes: ['attr1', 'attr2']
                });
                mapping2 = collection.model({
                    name: 'mapping2',
                    id: 'id',
                    attributes: ['attr1', 'attr2', 'attr3']
                });
            });
            describe('request descriptor', function () {
                it('single', function (done) {
                    var descriptors = collection.descriptor({
                        method: 'POST',
                        model: mapping1,
                        path: '/path/[0-9]+'
                    });
                    assert.equal(descriptors.length, 1);
                    var requestDescriptor1 = descriptors[0];
                    assert.instanceOf(requestDescriptor1, siesta.ext.http.RequestDescriptor);
                    descriptors = collection.descriptor({
                        method: 'POST',
                        model: mapping2,
                        path: '/path/[0-9]'
                    });
                    var requestDescriptor2 = descriptors[0];
                    assert.instanceOf(requestDescriptor2, siesta.ext.http.RequestDescriptor);
                    s.install(function (err) {
                        if (err) {
                            done(err);
                        }
                        assert.equal(requestDescriptor1.model, mapping1);
                        assert.equal(requestDescriptor2.model, mapping2);
                        done();
                    })
                });


            });
            describe('response descriptor', function () {
                it('single', function (done) {
                    var descriptors = collection.descriptor({
                        method: 'GET',
                        model: mapping1,
                        path: '/path/[0-9]+'
                    });
                    assert.equal(descriptors.length, 1);
                    var responseDescriptor1 = descriptors[0];
                    assert.instanceOf(responseDescriptor1, siesta.ext.http.ResponseDescriptor);
                    var descriptors = collection.descriptor({
                        method: 'GET',
                        model: mapping2,
                        path: '/path/[0-9]+'
                    });
                    assert.equal(descriptors.length, 1);
                    var responseDescriptor2 = descriptors[0];
                    assert.instanceOf(responseDescriptor2, siesta.ext.http.ResponseDescriptor);
                    s.install(function (err) {
                        if (err) {
                            done(err);
                        }
                        assert.equal(responseDescriptor1.model, mapping1);
                        assert.equal(responseDescriptor2.model, mapping2);
                        done();
                    })
                });

            });

            describe('both', function () {
                var descriptors;

                beforeEach(function (done) {
                    descriptors = collection.descriptor({
                        method: ['GET', 'POST'],
                        model: mapping1,
                        path: '/path/[0-9]'
                    });
                    s.install(done)
                });

                it('two descriptors', function () {
                    assert.equal(descriptors.length, 2);
                });

                it('types', function () {
                    var responseDescriptor1 = descriptors[0];
                    assert.instanceOf(responseDescriptor1, siesta.ext.http.RequestDescriptor);
                    var requestDescriptor1 = descriptors[1];
                    assert.instanceOf(requestDescriptor1, siesta.ext.http.ResponseDescriptor);
                });

                it('registration', function () {
                    var registry = siesta.ext.http.DescriptorRegistry;
                    var requestDescriptors = registry.requestDescriptors.MyCollection;
                    var responseDescriptors = registry.responseDescriptors.MyCollection;
                    assert.equal(requestDescriptors.length, 1);
                    assert.equal(responseDescriptors.length, 1);
                });

            });
        });
    });

});