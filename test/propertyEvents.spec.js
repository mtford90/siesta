var assert = require('chai').assert;

describe('property events', function () {
    var Collection, Car;

    beforeEach(function (done) {
        siesta.reset(done);
    });

    describe('attribute dependency', function () {
        beforeEach(function () {
            Collection = siesta.collection('myCollection');
            Car = Collection.model('Car', {
                id: 'id',
                attributes: ['colour'],
                properties: {
                    blah: {
                        get: function () {
                            return this.colour ? this.colour.toUpperCase() : this.colour;

                        },
                        // Workaround for chrome.
                        dependencies: ['colour']
                    }
                }
            });
        });

        it('triggers', function (done) {
            Car.map({
                colour: 'red'
            }).then(function (car) {
                assert.equal(car.blah, 'RED');
                car.listenOnce(function (n) {
                    if (n.field == 'blah') {
                        assert.equal(car.blah, 'BLUE');
                        assert.equal(n.obj, car);
                        assert.equal(n.new, 'BLUE');
                        assert.equal(n.old, 'RED');
                        done();
                    }
                });
                car.colour = 'blue';
                siesta.notify();
            }).catch(done);
        });
    });

    describe('error in property', function () {
        beforeEach(function () {
            Collection = siesta.collection('myCollection');
            Car = Collection.model('Car', {
                id: 'id',
                attributes: ['colour'],
                properties: {
                    blah: {
                        get: function () {
                            console.log('throwing error');
                            throw new Error('oops');
                        },
                        // Workaround for chrome.
                        dependencies: ['colour']
                    }
                }
            });
        });

        it('error should be thrown', function (done) {
            Car.map({
                colour: 'red'
            }).then(function () {
                done('Should have thrown an error!');
            }).catch(function (err) {
                assert.ok(err);
                done();
            });
        });

        it('will install', function (done) {
            siesta.install(function (err) {
                done(err);
            });
        });

    });

    //
    //describe('observe js', function () {
    //    it('key path', function (done) {
    //        var obj = {foo: {bar: 'baz'}};
    //        var observer = new PathObserver(obj, 'foo.bar');
    //        observer.open(function (newValue, oldValue) {
    //            // respond to obj.foo.bar having changed value.
    //            done();
    //        });
    //        obj.foo.bar = 'wtf';
    //        Platform.performMicrotaskCheckpoint();
    //    });
    //
    //    it('singular', function (done) {
    //        var obj = {foo: {bar: 'baz'}};
    //        var observer = new PathObserver(obj, 'foo');
    //        observer.open(function (newValue, oldValue) {
    //            // respond to obj.foo.bar having changed value.
    //            done();
    //        });
    //        obj.foo = 'wtf';
    //        Platform.performMicrotaskCheckpoint();
    //    });
    //
    //    it('property', function (done) {
    //        var obj = {foo: {bar: 'baz'}};
    //        Object.defineProperty(obj, 'prop', {
    //            get: function () {
    //                return this.foo.bar.toUpperCase();
    //            },
    //            enumerable: true,
    //            configurable: true
    //        });
    //        var observer = new PathObserver(obj, 'prop');
    //        observer.open(function (newValue, oldValue) {
    //            assert.equal(newValue, 'TEST');
    //            assert.equal(oldValue, 'BAZ');
    //            done();
    //        });
    //        obj.foo.bar = 'test';
    //        Platform.performMicrotaskCheckpoint();
    //    });
    //});


    describe('Object.observe', function () {
        it('xyz', function () {
            if (Object.observe) {
                var obj = {foo: 1};
                Object.defineProperty(obj, 'blah', {
                    get: function () {
                        return this.foo + 1;
                    }
                });
                Object.observe(obj, function (changes) {
                    changes.forEach(function (change) {
                        console.log('change', change);
                    });
                });
                obj.foo = 2;
            }
        });
    });


});