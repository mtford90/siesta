describe('relationship proxy byid', function () {

    var RestAPI, RelationshipType, Relationship;
    var api, carMapping, personMapping;
    var car, person;

    beforeEach(function (done) {
        module('restkit.relationship', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });
        module('restkit.mapping', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_RestAPI_, _RelationshipType_, _Relationship_) {
            RestAPI = _RestAPI_;
            RelationshipType = _RelationshipType_;
            Relationship = _Relationship_;
        });


        RestAPI._reset();

        api = new RestAPI('myApi', function (err, version) {
            if (err) done(err);
            carMapping = api.registerMapping('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            personMapping = api.registerMapping('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });
        }, function (err) {
            if (err) done(err);
            carMapping.map({colour: 'blue', name:'Aston Martin', id:'fgs'}, function (err, _car) {
                if (err) done(err);
                car = _car;
                personMapping.map({name: 'Michael Ford', age: 23, id:'asdawe2'}, function (err, _person) {
                    if (err) done(err);
                    person = _person;
                    done();
                });

            });
        });

    });

    it('setRelatedById', function (done) {
        var r = new Relationship('car', 'cars', carMapping, personMapping);
        sinon.stub(r, 'setRelated', function (obj, related, callback) {
            callback();
        });
        r.setRelatedById(car, person._id, function () {
            sinon.assert.calledWith(r.setRelated, car, person);
            done();
        });
    });


});