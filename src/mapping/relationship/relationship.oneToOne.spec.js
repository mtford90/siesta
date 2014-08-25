describe('relationship', function () {

    var Store, Collection, RestError, Mapping, ForeignKeyRelationship, RestObject, cache, OneToOneRelationship, RelationshipType, RelatedObjectProxy;

    beforeEach(function () {
        module('restkit.relationship', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });
        module('restkit.mapping', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Store_, _RestError_, _RelatedObjectProxy_, _RelationshipType_, _Collection_, _Mapping_, _ForeignKeyRelationship_, _OneToOneRelationship_, _RestObject_, _cache_) {
            Collection = _Collection_;
            Mapping = _Mapping_;
            ForeignKeyRelationship = _ForeignKeyRelationship_;
            OneToOneRelationship = _OneToOneRelationship_;
            RestObject = _RestObject_;
            cache = _cache_;
            RelationshipType = _RelationshipType_;
            RelatedObjectProxy = _RelatedObjectProxy_;
            RestError = _RestError_;
            Store = _Store_;
        });

        Collection._reset();
    });

    describe('OneToOne', function () {
//        var carMapping, personMapping;
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