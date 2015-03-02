var assert = require('chai').assert,
    internal = siesta._internal;

describe.only('model serialisation', function() {

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
        attributes: ['colour'],
        relationships: {
          owner: {
            mapping: PersonModel,
            reverse: 'cars'
          }
        }
      });
      done();
    });
  });

  it('default serialisation, no relationships');

  it('default serialisation, one-to-many relationship');

  it('default serialisation, many-to-many relationship');

  it('custom serialisation');

});