describe.only('perform mapping', function () {

    var Pouch, RawQuery, RestAPI, RestError, RelationshipType, RelatedObjectProxy, RestObject;

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

    describe('new', function () {
        var api, carMapping;


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
                    console.log('mapping 1st');
                    carMapping.map({colour: 'red', name: 'Aston Martin', id: 'dfadf'}, function (err, _obj) {
                        obj = _obj;
                        console.log('done mapping 1st');
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

                describe.only('via id', function () {
                    var newObj;
                    beforeEach(function (done) {
                        console.log('mapping 2nd');
                        carMapping.map({colour: 'blue', id: 'dfadf'}, function (err, obj) {
                            if (err) done(err);
                            console.log('done mapping 2nd');
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

    })
});
