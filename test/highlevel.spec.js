var assert = require('chai').assert,
    internal = siesta._internal;

describe('higher level mapping', function() {


  describe('collection level', function() {
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

  describe('siesta level', function() {
    var Collection, PersonModel, CarModel, OtherCollection, OtherModel;


    beforeEach(function(done) {
      siesta.reset(function() {
        Collection = siesta.collection('Collection');
        PersonModel = Collection.model('Person', {
          id: 'id',
          attributes: ['name', 'age']
        });
        CarModel = Collection.model('Car', {
          id: 'id',
          attributes: ['colour']
        });
        OtherCollection = siesta.collection('OtherCollection');
        OtherModel = OtherCollection.model('Other', {
          attributes: ['attr']
        });
        done();
      });
    });

    it('map single collection & model', function(done) {
      siesta.graph({
        Collection: {
          Car: {colour: 'red', id: 5}
        }
      }).then(function(results) {
        var carResult = results.Collection.Car;
        assert.equal(carResult.colour, 'red');
        done();
      }).catch(done);
    });

    it('map array', function(done) {
      siesta.graph({
        Collection: {
          Car: [{colour: 'red', id: 5}, {colour: 'blue', id: 6}]
        }
      }).then(function(results) {
        var carResults = results.Collection.Car;
        assert.equal(carResults.length, 2);
        done();
      }).catch(done);
    });

    it('map multiple models', function(done) {
      siesta.graph({
        Collection: {
          Car: [{colour: 'red', id: 5}, {colour: 'blue', id: 6}],
          Person: {name: 'Mike', age: 24}
        }
      }).then(function(results) {
        var carResults = results.Collection.Car,
            personResults = results.Collection.Person;
        assert.equal(carResults.length, 2);
        assert.equal(personResults.name, 'Mike');
        done();
      }).catch(done);
    });

    it('map multiple collections', function(done) {
      siesta.graph({
        Collection: {
          Car: [{colour: 'red', id: 5}, {colour: 'blue', id: 6}],
          Person: {name: 'Mike', age: 24}
        },
        OtherCollection: {
          Other: {attr: 1}
        }
      }).then(function(results) {
        var carResults = results.Collection.Car,
            personResults = results.Collection.Person,
            otherResults = results.OtherCollection.Other;
        assert.equal(carResults.length, 2);
        assert.equal(personResults.name, 'Mike');
        assert.equal(otherResults.attr, 1);
        done();
      }).catch(done);
    });

    it('invalid model', function(done) {
      siesta.graph({
        Collection: {
          Car: [{colour: 'red', id: 5}, {colour: 'blue', id: 6}],
          Invalid: {name: 'Mike', age: 24}
        }
      }).then(function() {
        done('Should not have succeeeded');
      }).catch(function(err) {
        assert.equal(err.invalidModelName, 'Invalid');
        assert.ok(err);
        done();
      });
    });

    it('invalid collection', function(done) {
      siesta.graph({
        Invalid: {
          Car: [{colour: 'red', id: 5}, {colour: 'blue', id: 6}],
          Person: {name: 'Mike', age: 24}
        }
      }).then(function() {
        done('Should not have succeeeded');
      }).catch(function(err) {
        assert.equal(err.invalidCollectionName, 'Invalid');
        assert.ok(err);
        done();
      });
    });
  });

});