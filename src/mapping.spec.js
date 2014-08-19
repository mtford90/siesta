describe.only('mapping!', function () {

    var Index, Pouch, Indexes, Query, Mapping;

    beforeEach(function () {
        module('restkit.mapping', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Index_, _Pouch_, _Indexes_, _Query_, _Mapping_) {
            Index = _Index_;
            Indexes = _Indexes_;
            Pouch = _Pouch_;
            Query = _Query_;
            Mapping = _Mapping_;
        });

        Pouch.reset();

    });

    it('_fields', function () {
        var m = new Mapping({
            name: 'name',
            id: 'id',
            attributes: ['field1', 'field2']
        });
        assert.include(m._fields, 'id');
        assert.include(m._fields, 'field1');
        assert.include(m._fields, 'field2');
    });

    it('name', function () {
        var m = new Mapping({
            name: 'name',
            id: 'id',
            attributes: ['field1', 'field2']
        });
        assert.equal(m.name, 'name');
    });

    describe('validation', function () {
        it('no name', function () {
            var m = new Mapping({
                id: 'id',
                attributes: ['field1', 'field2']
            });
            var errors = m._validate();
            console.log('errors:', errors);
            assert.equal(1, errors.length);
        }) ;
    });

});