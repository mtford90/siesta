describe('mapping!', function () {

    var Index, Pouch,  Mapping;

    beforeEach(function () {
        module('restkit.mapping', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });
        module('restkit.relationship', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Index_, _Pouch_, _Mapping_) {
            Index = _Index_;
            Pouch = _Pouch_;
            Mapping = _Mapping_;
        });

        Pouch.reset();

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
        assert.include(m.attributes, 'field1');
        assert.include(m.attributes, 'field2');
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

    it('installation', function (done) {
        var m = new Mapping({
            type: 'Type',
            id: 'id',
            attributes: ['field1', 'field2'],
            collection: 'myCollection'
        });
        m.install(function (err) {
            if (err) done(err);
            assert.equal(Index.indexes.length, 8);
            done();
        });
    });




});