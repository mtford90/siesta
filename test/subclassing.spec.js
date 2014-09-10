var s = require('../index')
    , assert = require('chai').assert;

describe('subclassing', function () {

    var RestObject = require('../src/object').RestObject;
    var RestError = require('../src/error').RestError;
    var Collection = require('../src/collection').Collection;
    var cache = require('../src/cache');

    var collection, carMapping;

    function CarObject () {
        RestObject.apply(this, arguments);
    }

    CarObject.prototype = Object.create(RestObject.prototype);

    beforeEach(function (done) {
        s.reset(true);
        collection = new Collection('Car');

        collection.install(done);
    });

    it('should instantiate with subclass if present', function () {
        carMapping = collection.mapping('Car', {
            id: 'id',
            attributes: ['colour', 'name'],
            subclass: CarObject
        });
        var car = carMapping._new({colour: 'red', name:'Aston Martin'});
        assert.instanceOf(car, CarObject);
    });

    it('should instantiate with RestObject if not present', function () {
        carMapping = collection.mapping('Car', {
            id: 'id',
            attributes: ['colour', 'name']
        });
        var car = carMapping._new({colour: 'red', name:'Aston Martin'});
        assert.instanceOf(car, RestObject);
    });

    it('should throw an error if setup prototype, but do not call super', function () {
        function CarObject() {}
        CarObject.prototype = Object.create(RestObject.prototype);
        assert.throws(function () {
            carMapping = collection.mapping('Car', {
                id: 'id',
                attributes: ['colour', 'name'],
                subclass: CarObject
            });
        }, RestError);
    });

    it('should throw an error if call super but do not setup prototype', function () {
        function CarObject() {
            RestObject.apply(this, arguments);
        }
        assert.throws(function () {
            carMapping = collection.mapping('Car', {
                id: 'id',
                attributes: ['colour', 'name'],
                subclass: CarObject
            });
        }, RestError);
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
        }, RestError);
    });

    it('should throw an error if do not use a new instance of the prototype, as this is an anti-pattern', function () {
        function CarObject() {
            RestObject.apply(this, arguments);
        }
        CarObject.prototype = RestObject.prototype;
        assert.throws(function () {
            carMapping = collection.mapping('Car', {
                id: 'id',
                attributes: ['colour', 'name'],
                subclass: CarObject
            });
        }, RestError);
    });

});