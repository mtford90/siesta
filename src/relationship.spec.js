describe.only('relationship', function () {

    var RestAPI, Mapping, ForeignKeyRelationship, RestObject;

    beforeEach(function () {
        module('restkit.relationship', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });
        module('restkit.mapping', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_RestAPI_, _Mapping_, _ForeignKeyRelationship_, _RestObject_) {
            RestAPI = _RestAPI_;
            Mapping = _Mapping_;
            ForeignKeyRelationship = _ForeignKeyRelationship_;
            RestObject = _RestObject_;
        });

        RestAPI._reset();
    });

    describe('OneToMany', function () {
        var carMapping, personMapping;
        beforeEach(function (done) {
            carMapping = new Mapping({
                type: 'Car',
                id: 'id',
                attributes: ['colour', 'name'],
                api: 'myApi'
            });
            personMapping = new Mapping({
                type: 'Person',
                id: 'id',
                attributes: ['name', 'age'],
                api: 'myApi'
            });
            carMapping.install(function (err) {
                if (err) done(err);
                personMapping.install(done);
            });
        });

        it('sdas', function (done) {
            var r = new ForeignKeyRelationship('owner', 'cars', carMapping, personMapping);
            var car = new RestObject(carMapping);
            car.ownerId = 5;
            r.getRelated(car, function (err, related) {
                done(err);
            });
        });
    });
});