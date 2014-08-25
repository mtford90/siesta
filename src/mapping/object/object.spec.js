describe('object', function () {

    var Collection, RestObject, Mapping, RelationshipType;

    beforeEach(function () {
        module('restkit.object', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        module('restkit.relationship', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Collection_, _RestObject_, _Mapping_, _RelationshipType_) {
            Collection = _Collection_;
            RestObject = _RestObject_;
            Mapping = _Mapping_;
            RelationshipType = _RelationshipType_;
        });

        Collection._reset();
    });

    it('idField', function () {
        var mapping = new Mapping({
            type: 'Car',
            id: 'id',
            attributes: ['colour', 'name'],
            collection: 'myCollection'
        });
        var r = new RestObject(mapping);
        assert.equal(r.idField, 'id');
    });

    it('type field', function () {
        var mapping = new Mapping({
            type: 'Car',
            id: 'id',
            attributes: ['colour', 'name'],
            collection: 'myCollection'
        });
        var r = new RestObject(mapping);
        assert.equal(r.type, 'Car');
    });

    it('collection field', function () {
        var mapping = new Mapping({
            type: 'Car',
            id: 'id',
            attributes: ['colour', 'name'],
            collection: 'myCollection'
        });
        var r = new RestObject(mapping);
        assert.equal(r.collection, 'myCollection');
    });

});