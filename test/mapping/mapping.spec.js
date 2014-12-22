var s = require('../../core/index')
    , assert = require('chai').assert;

describe('mapping!', function () {
    var Mapping = require('../../core/mapping').Mapping;

    beforeEach(function () {
        s.reset(true);
    });

    it('_fields', function () {
        var m = new Mapping({
            type: 'type',
            id: 'id',
            attributes: ['field1', 'field2']
        });
        assert.include(m._fields, 'id');
        assert.include(m._fields, 'field1');
        assert.include(m._fields, 'field2');
        assert.notInclude(m._fields, 'type');
    });

    it('attributes', function () {
        var m = new Mapping({
            type: 'type',
            id: 'id',
            attributes: ['field1', 'field2']
        });
        var attributes = _.pluck(m.attributes, 'name');
        assert.include(attributes, 'field1');
        assert.include(attributes, 'field2');
    });

    it('type', function () {
        var m = new Mapping({
            type: 'type',
            id: 'id',
            attributes: ['field1', 'field2']
        });
        assert.equal(m.type, 'type');
    });

    it('id', function () {
        var m = new Mapping({
            type: 'type',
            id: 'id',
            attributes: ['field1', 'field2']
        });
        assert.equal(m.id, 'id');
    });

    describe('methods', function () {
        it('valid', function (done) {
            var C = new s.Collection('C');
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
        it('valid', function (done) {
            var C = new s.Collection('C');
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
            var C = new s.Collection('C');
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