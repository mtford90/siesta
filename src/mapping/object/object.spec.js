describe('object', function () {

    var RestAPI, RestObject, Mapping, RelationshipType;

    beforeEach(function () {
        module('restkit.object', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        module('restkit.relationship', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_RestAPI_, _RestObject_, _Mapping_, _RelationshipType_) {
            RestAPI = _RestAPI_;
            RestObject = _RestObject_;
            Mapping = _Mapping_;
            RelationshipType = _RelationshipType_;
        });

        RestAPI._reset();
    });

    it('idField', function () {
        var mapping = new Mapping({
            type: 'Car',
            id: 'id',
            attributes: ['colour', 'name'],
            api: 'myApi'
        });
        var r = new RestObject(mapping);
        assert.equal(r.idField, 'id');
    });

    it('type field', function () {
        var mapping = new Mapping({
            type: 'Car',
            id: 'id',
            attributes: ['colour', 'name'],
            api: 'myApi'
        });
        var r = new RestObject(mapping);
        assert.equal(r.type, 'Car');
    });

    it('api field', function () {
        var mapping = new Mapping({
            type: 'Car',
            id: 'id',
            attributes: ['colour', 'name'],
            api: 'myApi'
        });
        var r = new RestObject(mapping);
        assert.equal(r.api, 'myApi');
    });

});