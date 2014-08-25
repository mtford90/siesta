describe('relationship proxy byid', function () {

    var Collection, RelationshipType, Relationship;
    var collection, carMapping, personMapping;
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

        inject(function (_Collection_, _RelationshipType_, _Relationship_) {
            Collection = _Collection_;
            RelationshipType = _RelationshipType_;
            Relationship = _Relationship_;
        });


        Collection._reset();

        collection = new Collection('myCollection', function (err, version) {
            if (err) done(err);
            carMapping = collection.registerMapping('Car', {
                id: 'id',
                attributes: ['colour', 'name']
            });
            personMapping = collection.registerMapping('Person', {
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

    it('setRelatedById forward', function (done) {
        var r = new Relationship('car', 'cars', carMapping, personMapping);
        sinon.stub(r, 'setRelated', function (obj, related, callback) {
            callback();
        });
        r.setRelatedById(car, person._id, function () {
            sinon.assert.calledWith(r.setRelated, car, person);
            done();
        });
    });

    it('setRelatedById reverse', function (done) {
        carMapping.map([
            {colour: 'red', name: 'Aston Martin', id: '36yedfhdfgswftwsdg'},
            {colour: 'blue', name: 'Lambo', id: 'asd03r0hasdfsd'},
            {colour: 'green', name: 'Ford', id: "nmihoahdabf"}
        ], function (err, objs) {
            if (err) done(err);
            var r = new Relationship('car', 'cars', carMapping, personMapping);
            sinon.stub(r, 'setRelated', function (obj, related, callback) {
                callback();
            });
            r.setRelatedById(person, _.pluck(objs, '_id'), function (err) {
                if (err) done(err);
                sinon.assert.calledOnce(r.setRelated);
                var args = r.setRelated.args[0];
                var obj = args[0];
                var related = args[1];
                assert.equal(obj, person);
                _.each(objs, function (car) {
                    assert.include(related, car);
                });
                done();
            });
        });


    });


});