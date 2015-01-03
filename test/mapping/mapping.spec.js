var s = require('../../core/index'),
    assert = require('chai').assert;

describe('mapping!', function () {
    var Model = require('../../core/model');

    before(function () {
        s.ext.storageEnabled = false;
    });

    beforeEach(function (done) {
        s.reset(done);
    });

    it('_attributeNames', function () {
        var m = new Model({
            name: 'name',
            id: 'id',
            attributes: ['field1', 'field2']
        });
        assert.include(m._attributeNames, 'id');
        assert.include(m._attributeNames, 'field1');
        assert.include(m._attributeNames, 'field2');
        assert.notInclude(m._attributeNames, 'type');
    });

    it('attributes', function () {
        var m = new Model({
            name: 'name',
            id: 'id',
            attributes: ['field1', 'field2']
        });
        var attributes = _.pluck(m.attributes, 'name');
        assert.include(attributes, 'field1');
        assert.include(attributes, 'field2');
    });

    it('name', function () {
        var m = new Model({
            name: 'name',
            id: 'id',
            attributes: ['field1', 'field2']
        });
        assert.equal(m.name, 'name');
    });

    it('id', function () {
        var m = new Model({
            name: 'name',
            id: 'id',
            attributes: ['field1', 'field2']
        });
        assert.equal(m.id, 'id');
    });

    describe('methods', function () {
        it('init', function (done) {
            var C = s.collection('C');
            var M = C.model('M', {
                methods: {
                    init: function () {
                        assert.equal(this.attr, 1);
                        done();
                    }
                },
                attributes: ['attr']
            });
            siesta.install()
                .then(function () {
                    M.map({attr: 1});
                })
                .catch(done);
        });
        it('valid', function (done) {
            var C = s.collection('C');
            var M = C.model('M', {
                methods: {
                    f: function () {
                        return this.attr
                    }
                },
                attributes: ['attr']
            });
            C.install().then(function () {
                M.map({attr: 'xyz'})
                    .then(function (m) {
                        assert.equal(m.attr, m.f());
                        done();
                    })
                    .catch(done).done();
            }).catch(done).done();
        });
    });

    describe('statics', function () {
        it('init', function (done) {
            var C = s.collection('C');
            var M;
            M = C.model('M', {
                statics: {
                    init: function () {
                        assert.equal(this, M);
                        done();
                    }
                },
                attributes: ['attr']
            });
            siesta.install().catch(done);
        });
        it('valid', function (done) {
            var C = s.collection('C');
            var M = C.model('M', {
                statics: {
                    f: function () {
                        return this
                    }
                },
                attributes: ['attr']
            });
            C.install().then(function () {
                assert.equal(M.f(), M);
                done();
            }).catch(done).done();
        });

        it('clash', function (done) {
            var C = s.collection('C');
            var staticMethod = function () {
                return 'a';
            };
            var M = C.model('M', {
                statics: {
                    query: staticMethod
                },
                attributes: ['attr']
            });
            C.install().then(function () {
                assert.notEqual(M.query(), 'a', 'Existing statics should not be replaced...');
                done();
            }).catch(done).done();
        });

    })


});