var assert = require('chai').assert,
    internal = siesta._internal,
    ModelInstance = internal.ModelInstance,
    RelationshipType = siesta.RelationshipType;

describe('higher level mapping', function() {
  var Collection, PersonModel, CarModel;

  beforeEach(function(done) {
    siesta.reset(function() {
      Collection = siesta.collection('myCollection');
      PersonModel = Collection.model('Person', {
        id: 'id',
        attributes: ['name', 'age']
      });
      CarModel = Collection.model('Car', {
        id: 'id',
        attributes: ['colour']
      });
      done();
    });
  });

  describe('collection level', function() {
    it('map singles', function(done) {
      Collection.graph({
        Car: {colour: 'red', id: 5}
      }).then(function(results) {
        var carResult = results.Car;
        assert.equal(carResult.colour, 'red');
        done();
      }).catch(done);
    });

    it('map multiples', function(done) {
      Collection.graph({
        Car: [{colour: 'red', id: 5}, {colour: 'blue', id: 6}]
      }).then(function(results) {
        var carResults = results.Car;
        assert.equal(carResults.length, 2);
        done();
      }).catch(done);
    });

    it('map multiple types', function(done) {
      Collection.graph({
        Car: [{colour: 'red', id: 5}, {colour: 'blue', id: 6}],
        Person: {name: 'Mike', age: 24}
      }).then(function(results) {
        var carResults = results.Car,
            personResults = results.Person;
        assert.equal(carResults.length, 2);
        assert.equal(personResults.name, 'Mike');
        done();
      }).catch(done);
    });

    it('invalid model', function(done) {
      Collection.graph({
        Car: [{colour: 'red', id: 5}, {colour: 'blue', id: 6}],
        Invalid: {name: 'Mike', age: 24}
      }).then(function() {
        done('Should not have succeeeded');
      }).catch(function(err) {
        assert.equal(err.invalidModelName, 'Invalid');
        assert.ok(err);
        done();
      });
    });
  });
});