var s = require('../../index')
    , assert = require('chai').assert;

describe('relationship', function () {
    var Mapping = s.Mapping
        , RestObject = s.RestObject
        , cache = s.cache
        , OneToOneRelationship = s.OneToOneRelationship
        , RelatedObjectProxy = s.RelatedObjectProxy;

    beforeEach(function () {
        s.reset(true);
    });

    describe('OneToOne', function () {
        var carMapping, personMapping;
        beforeEach(function (done) {
            carMapping = new Mapping({
                type: 'Car',
                id: 'id',
                attributes: ['colour', 'name'],
                collection: 'myCollection'
            });
            personMapping = new Mapping({
                type: 'Person',
                id: 'id',
                attributes: ['name', 'age'],
                collection: 'myCollection'
            });
            carMapping.install(function (err) {
                if (err) done(err);
                personMapping.install(done);
            });
        });

        describe('get', function () {
            it('forward', function (done) {
                var r = new OneToOneRelationship('owner', 'car', carMapping, personMapping);
                var car = new RestObject(carMapping);
                var proxy = new RelatedObjectProxy(r, car);
                proxy._id = 'xyz123';
                car.owner = proxy;
                var person = new RestObject(personMapping);
                person._id = car.owner._id;
                cache.insert(person);
                r.getRelated(car, function (err, related) {
                    done(err);
                    assert.equal(person, related);
                });
            });

            it('reverse', function (done) {
                var r = new OneToOneRelationship('owner', 'car', carMapping, personMapping);
                var car = new RestObject(carMapping);
                car._id = 'xyz123';
                var proxy = new RelatedObjectProxy(r, car);
                proxy._id = 'xyz123';
                var person = new RestObject(personMapping);
                person.car = proxy;
                cache.insert(person);
                cache.insert(car);
                r.getRelated(person, function (err, related) {
                    done(err);
                    assert.equal(car, related);
                });
            });
        });


    });


});