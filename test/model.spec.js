var assert = require('chai').assert,
    internal = siesta._internal,
    cache = internal.cache,
    ModelInstance = internal.ModelInstance;

describe('Models', function () {
    var Model, Collection;

    before(function () {
        siesta.ext.storageEnabled = false;
    });

    beforeEach(function (done) {
        siesta.reset(function () {
            Collection = siesta.collection('myCollection');
            Model = Collection.model({
                name: 'Car',
                id: 'id',
                attributes: ['colour', 'name'],
                collection: 'myCollection'
            });
            done();
        });
    });


    it('get attributes', function (done) {
        Model.graph({id: 1, colour: 'red', name: 'Aston martin'})
            .then(function (car) {
                var attributes = car.getAttributes();
                assert.equal(Object.keys(attributes).length, 3);
                assert.equal(attributes.id, 1);
                assert.equal(attributes.colour, 'red');
                assert.equal(attributes.name, 'Aston martin');
                done();
            })
            .catch(done);
    });

    it('define relationship with string', function (done) {
        siesta.reset(function () {
            var Collection = siesta.collection('myCollection'),
                Person = Collection.model('Person', {
                    attributes: ['name']
                }),
                Car = Collection.model('Car', {
                    attributes: ['colour'],
                    relationships: {
                        owner: {
                            model: 'Person',
                            reverse: 'cars'
                        }
                    }
                });

            Car.graph({colour: 'red', owner: {name: 'bob'}})
                .then(function (car) {
                    assert.ok(car);
                    assert.ok(car.owner);
                    done();
                })
                .catch(done);
        });
    });

    it('define relationship with model', function (done) {
        siesta.reset(function () {
            var Collection = siesta.collection('myCollection'),
                Person = Collection.model('Person', {
                    attributes: ['name']
                }),
                Car = Collection.model('Car', {
                    attributes: ['colour'],
                    relationships: {
                        owner: {
                            model: Person,
                            reverse: 'cars'
                        }
                    }
                });

            Car.graph({colour: 'red', owner: {name: 'bob'}})
                .then(function (car) {
                    assert.ok(car);
                    assert.ok(car.owner);
                    done();
                })
                .catch(done);
        });
    });

    describe('fields', function () {


        it('modelName field', function () {
            var r = new ModelInstance(Model);
            assert.equal(r.modelName, 'Car');
        });

        it('collection field', function () {
            var modelInstance = new ModelInstance(Model);
            assert.equal(modelInstance.collectionName, 'myCollection');
            assert.equal(modelInstance.collection, Collection);
        });

    });

    describe('removal', function () {
        var car;

        describe('remote id', function () {
            function remove() {
                car = new ModelInstance(Model);
                car.colour = 'red';
                car.name = 'Aston Martin';
                car.id = '2';
                car._id = 'xyz';
                cache.insert(car);
                assert.notOk(car.removed);
                assert.ok(cache.contains(car));
                car.remove();
                assert.notOk(cache.contains(car));
                assert.ok(car.removed);
            }

            it('deletion', function () {
                remove();
            });

            it('restore', function () {
                remove();
                car.restore();
                assert.notOk(car.removed);
                assert.ok(cache.contains(car));
            });

        });

        describe('no remote id', function () {
            function remove() {
                car = new ModelInstance(Model);
                car.colour = 'red';
                car.name = 'Aston Martin';
                car._id = 'xyz';
                cache.insert(car);
                assert.notOk(car.removed);
                assert.ok(cache.contains(car));
                car.remove();
                assert.notOk(cache.contains(car));
                assert.ok(car.removed);
            }

            it('deletion', function () {
                remove();
            });

            it('restore', function () {
                remove();
                car.restore();
                assert.notOk(car.removed);
                assert.ok(cache.contains(car));
            });
        })


    });

    describe('custom emissions', function () {
        it('string format', function (done) {
            siesta.reset(function () {
                Collection = siesta.collection('myCollection');
                Model = Collection.model('Model', {
                    attributes: ['colour'],
                    methods: {
                        foo: function () {
                            this.emit('x', {
                                y: 1
                            });
                        }
                    }
                });
                Model.graph({colour: 'red'})
                    .then(function (m) {
                        m.listenOnce(function (e) {
                            console.log('e', e);
                            assert.equal(e.type, 'x');
                            assert.equal(e.y, 1);
                            done();
                        });
                        m.foo();
                    }).catch(done);
            });
        });
        it('obj format', function (done) {
            siesta.reset(function () {
                Collection = siesta.collection('myCollection');
                Model = Collection.model('Model', {
                    attributes: ['colour'],
                    methods: {
                        foo: function () {
                            this.emit({
                                y: 1,
                                type: 'x'
                            });
                        }
                    }
                });
                Model.graph({colour: 'red'})
                    .then(function (m) {
                        m.listenOnce(function (e) {
                            console.log('e', e);
                            assert.equal(e.type, 'x');
                            assert.equal(e.y, 1);
                            done();
                        });
                        m.foo();
                    }).catch(done);
            });
        });
    });


});