var assert = require('chai').assert,
  internal = siesta._internal,
  InternalSiestaError = internal.error.InternalSiestaError,
  RelationshipProxy = internal.RelationshipProxy,
  ModelInstance = internal.ModelInstance;


describe('relationship proxy', function() {

  before(function() {
    siesta.ext.storageEnabled = false;
  });

  var MyCollection, Car, Person;

  beforeEach(function(done) {
    siesta.reset(function() {
      MyCollection = siesta.collection('MyCollection');
      Car = MyCollection.model('Car', {
        id: 'id',
        attributes: ['colour', 'name']
      });
      Person = MyCollection.model('Person', {
        id: 'id',
        attributes: ['name', 'age']
      });
      done();
    });
  });

  describe('installation', function() {
    var car, person, relationship, proxy;

    beforeEach(function() {
      proxy = new RelationshipProxy({
        reverseModel: Person,
        forwardModel: Car,
        reverseName: 'cars',
        forwardName: 'owner',
        isReverse: false
      });
      car = new ModelInstance(Car);
      person = new ModelInstance(Person);
    });

    it('throws an error if try to install twice', function() {
      proxy.install(car);
      assert.throws(function() {
        proxy.install(car);
      }, InternalSiestaError);
    });

    describe('forward installation', function() {
      beforeEach(function() {
        proxy = new RelationshipProxy({
          reverseModel: Person,
          forwardModel: Car,
          reverseName: 'cars',
          forwardName: 'owner',
          isReverse: false
        });
        proxy.install(car);
      });


      describe('faults', function() {
        it('is forward', function() {
          assert.ok(proxy.isForward);
        });

        it('is not reverse', function() {
          assert.notOk(proxy.isReverse);
        });

        it('is a fault object', function() {
          assert(!car.owner);
        });


        describe('relationship, faulted', function() {
          beforeEach(function() {
            proxy.related = new ModelInstance(Person);
          });

          it('is related', function() {
            assert.equal(car.owner, proxy.related);
          });
        })
      });

    });

    describe('reverse installation', function() {
      beforeEach(function() {
        proxy = new RelationshipProxy({
          reverseModel: Person,
          forwardModel: Car,
          reverseName: 'cars',
          forwardName: 'owner',
          isReverse: true
        });
        proxy.install(person);

      });
      it('is reverse', function() {
        assert.ok(proxy.isReverse);
      });

      it('is not forward', function() {
        assert.notOk(proxy.isForward);
      });


    });
  });

  describe('subclass', function() {
    var car, person, proxy;

    beforeEach(function() {
      proxy = new RelationshipProxy({
        reverseModel: Person,
        forwardModel: Car,
        reverseName: 'cars',
        forwardName: 'owner',
        isReverse: false

      });
      car = new ModelInstance(Car);
      person = new ModelInstance(Person);
      proxy.install(car);
    });

    it('set should fail if not subclasses', function() {
      assert.throws(function() {
        car.owner = person;
      }, InternalSiestaError);
    });
  });


});