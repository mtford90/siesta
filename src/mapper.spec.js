describe('mapper', function () {

    var RestAPI, RestObject, Mapping;

    beforeEach(function () {
        module('restkit.mapper', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_RestAPI_, _RestObject_, _Mapping_) {
            RestAPI = _RestAPI_;
            RestObject = _RestObject_;
            Mapping = _Mapping_;
        });

        RestAPI._reset();
    });

    it('idField', function () {
        var mapping = new Mapping({
            type: 'Car',
            id: 'id',
            attributes: ['colour', 'name']
        });
        var r = new RestObject(mapping);
        assert.equal(r.idField, 'id');
    });

    it('typeField', function () {
        var mapping = new Mapping({
            type: 'Car',
            id: 'id',
            attributes: ['colour', 'name']
        });
        var r = new RestObject(mapping);
        assert.equal(r.type, 'Car');
    });

});