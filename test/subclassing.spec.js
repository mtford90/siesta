var s = require('../src/index')
    , assert = require('chai').assert;

describe('subclassing', function () {

    var SiestaModel = require('../src/siestaModel').SiestaModel;
    var InternalSiestaError = require('../src/error').InternalSiestaError;
    var Collection = require('../src/collection').Collection;
    var cache = require('../src/cache');

    var collection, carMapping;

    function CarObject() {
        SiestaModel.apply(this, arguments);
    }

    CarObject.prototype = Object.create(SiestaModel.prototype);

    beforeEach(function (done) {
        s.reset(true);
        collection = new Collection('Car');

        collection.install(done);
    });

    function installMapping(mapping, callback) {
        mapping.install(function (err) {
            if (err) callback(err);
            else {
                mapping.installRelationships();
                mapping.installReverseRelationships();
                callback();
            }
        });
    }

    it('should instantiate with subclass if present', function (done) {
        carMapping = collection.mapping('Car', {
            id: 'id',
            attributes: ['colour', 'name'],
            subclass: CarObject
        });
        installMapping(carMapping, function () {
            var car = carMapping._new({colour: 'red', name: 'Aston Martin'});
            assert.instanceOf(car, CarObject);
            done();
        });

    });

    it('should instantiate with SiestaModel if not present', function (done) {
        carMapping = collection.mapping('Car', {
            id: 'id',
            attributes: ['colour', 'name']
        });
        installMapping(carMapping, function () {
            var car = carMapping._new({colour: 'red', name: 'Aston Martin'});
            assert.instanceOf(car, SiestaModel);
            done();
        });

    });

    it('should throw an error if setup prototype, but do not call super', function () {
        function CarObject() {}

        CarObject.prototype = Object.create(SiestaModel.prototype);
        assert.throws(function () {
            carMapping = collection.mapping('Car', {
                id: 'id',
                attributes: ['colour', 'name'],
                subclass: CarObject
            });
        }, InternalSiestaError);
    });


    it('should throw an error if do not call super or setup prototype', function () {
        function CarObject() {
        }

        assert.throws(function () {
            carMapping = collection.mapping('Car', {
                id: 'id',
                attributes: ['colour', 'name'],
                subclass: CarObject
            });
        }, InternalSiestaError);
    });

    it('should throw an error if do not use a new instance of the prototype, as this is an anti-pattern', function () {
        function CarObject() {
            SiestaModel.apply(this, arguments);
        }

        CarObject.prototype = SiestaModel.prototype;
        assert.throws(function () {
            carMapping = collection.mapping('Car', {
                id: 'id',
                attributes: ['colour', 'name'],
                subclass: CarObject
            });
        }, InternalSiestaError);
    });

});