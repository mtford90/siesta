describe('perform mapping', function () {

    var Pouch, RawQuery, RestAPI, RestError, RelationshipType, RelatedObjectProxy, RestObject;
    var api, carMapping;

    beforeEach(function () {
        module('restkit.mapping', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });
        module('restkit.relationship', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Index_, _Pouch_, _Indexes_, _RawQuery_, _RestObject_, _Mapping_, _RestAPI_, _RestError_, _RelationshipType_, _RelatedObjectProxy_) {
            Pouch = _Pouch_;
            RawQuery = _RawQuery_;
            RestAPI = _RestAPI_;
            RelationshipType = _RelationshipType_;
            RelatedObjectProxy = _RelatedObjectProxy_;
            RestObject = _RestObject_;
        });

        Pouch.reset();

    });


    describe('no relationships', function () {
        var obj;

        beforeEach(function (done) {
            api = new RestAPI('myApi', function (err, version) {
                if (err) done(err);
                carMapping = api.registerMapping('Car', {
                    id: 'id',
                    attributes: ['colour', 'name']
                });
            }, function (err) {
                if (err) done(err);
                carMapping.map({colour: 'red', name: 'Aston Martin', id: 'dfadf'}, function (err, _obj) {
                    obj = _obj;
                    done(err);
                });
            });
        });

        describe('new', function () {

            it('returns a restobject', function () {
                assert.instanceOf(obj, RestObject);
            });

            it('has the right fields', function () {
                assert.equal(obj.colour, 'red');
                assert.equal(obj.name, 'Aston Martin');
                assert.equal(obj.id, 'dfadf');
                assert.ok(obj._id);
            });

            it('is placed down to pouch', function (done) {
                var pouchId = obj._id;
                Pouch.getPouch().get(pouchId, function (err, resp) {
                    if (err) done(err);
                    assert.ok(resp);
                    done();
                });
            });
        });

        describe('existing', function () {

            describe('via id', function () {
                var newObj;
                beforeEach(function (done) {
                    carMapping.map({colour: 'blue', id: 'dfadf'}, function (err, obj) {
                        if (err) done(err);
                        newObj = obj;
                        done();
                    });
                });

                it.only('should be mapped onto the old object', function () {
                    assert.equal(newObj, obj);
                });

                it('should have the new colour', function () {
                    assert.equal(newObj.colour, 'blue');
                });
            });

            describe('via _id', function () {
                var newObj;
                beforeEach(function (done) {
                    carMapping.map({colour: 'blue', _id: obj._id}, function (err, obj) {
                        if (err) done(err);
                        newObj = obj;
                        done();
                    });
                });

                it('should be mapped onto the old object', function () {
                    assert.equal(newObj, obj);
                });

                it('should have the new colour', function () {
                    assert.equal(newObj.colour, 'blue');
                });
            });
        })

    });


    describe('with relationship', function () {

        describe('foreign key', function () {
            var personMapping;
            beforeEach(function (done) {
                api = new RestAPI('myApi', function (err, version) {
                    if (err) done(err);
                    personMapping = api.registerMapping('Person', {
                        id: 'id',
                        attributes: ['name', 'age']
                    });
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
                }, function (err) {
                    if (err) done(err);
                    done();
                });
            });

            describe('remote id', function () {
                var person, car;
                beforeEach(function (done) {
                    personMapping.map({name: 'Michael Ford', age: 23, id:'personRemoteId'}, function (err, _person) {
                        if (err) done(err);
                        person = _person;
                        carMapping.map({name:'Bentley', colour:'black', owner:'personRemoteId', id:'carRemoteId'}, function (err, _car) {
                            if (err) done(err);
                            car = _car;
                            done();
                        });
                    });
                });
                it('owner of car should be michael', function (done) {
                    car.owner.get(function (err, owner) {
                        if (err) done(err);
                        assert.equal(owner, person);
                        done();
                    })

                });
            });
        });



    });

    describe('bulk', function () {

        it('should redirect arrays to _mapBulk when passed to map', function (done) {
            var raw = [
                {colour: 'red', name: 'Aston Martin', id: 'remoteId1'},
                {colour: 'blue', name: 'Lambo', id: "remoteId2"},
                {colour: 'green', name: 'Ford', id: "remoteId3"}
            ];
            sinon.stub(carMapping, '_mapBulk', function (_, callback) {
                callback();
            });
            carMapping.map(raw, function () {
                sinon.assert.calledWith(carMapping._mapBulk, raw);
                done();
            })
        });

        describe('new', function () {

            beforeEach(function (done) {
                api = new RestAPI('myApi', function (err, version) {
                    if (err) done(err);
                    carMapping = api.registerMapping('Car', {
                        id: 'id',
                        attributes: ['colour', 'name']
                    });
                }, function (err) {
                    done(err);
                });
            });

            it('all valid', function (done) {
                var raw = [
                    {colour: 'red', name: 'Aston Martin', id: 'remoteId1'},
                    {colour: 'blue', name: 'Lambo', id: "remoteId2"},
                    {colour: 'green', name: 'Ford', id: "remoteId3"}
                ];
                carMapping._mapBulk(raw, function (err, objs, res) {
                    assert.notOk(err);
                    assert.equal(objs.length, raw.length);
                    assert.equal(res.length, raw.length);
                    _.each(res, function (r) {
                        assert.notOk(r.err);
                        assert.ok(r.obj);
                    });
                    _.each(objs, function (o) {
                        assert.include(_.pluck(res, 'obj'), o);
                    });
                    _.each(raw, function (r) {
                        assert.include(_.pluck(res, 'raw'), r);
                    });
                    done();
                })
            });

            it('one err', function (done) {
                var raw = [
                    {colour: 'red', name: 'Aston Martin', id: 'remoteId1'},
                    {colour: 'blue', name: 'Lambo'},
                    {colour: 'green', name: 'Ford', id: "remoteId3"}
                ];
                carMapping._mapBulk(raw, function (err, objs, res) {
                    assert.equal(err.length, 1);
                    assert.equal(objs.length, raw.length - 1);
                    assert.equal(res.length, raw.length);
                    assert.include(_.pluck(res, 'err'), err[0]);
                    done();
                })
            });

        })

    });

});
