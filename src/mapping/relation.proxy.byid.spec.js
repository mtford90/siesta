describe.only('relationship proxy byid', function () {

    var RestAPI, RelationshipType;
    var api, carMapping, personMapping;

    beforeEach(function (done) {
        module('restkit.relationship', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });
        module('restkit.mapping', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_RestAPI_, _RelationshipType_) {
            RestAPI = _RestAPI_;
            RelationshipType = _RelationshipType_;
        });


        RestAPI._reset();

        api = new RestAPI('myApi', function (err, version) {
            if (err) done(err);
            carMapping = api.registerMapping('Car', {
                id: 'id',
                attributes: ['colour', 'name'],
                relationships: {
                    owner: {
                        mapping: 'Person',
                        type: RelationshipType.ForeignKey,
                        reverse: 'cars'
                    }
                }
            });
            personMapping = api.registerMapping('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });
        }, function (err) {
            done(err);
        }); 

    });

    it('xyz', function (done) {
        carMapping.map({colour: 'blue', name:'Aston Martin', id:'fgs'}, function (err, car) {
            done(err);

        });

    })


});