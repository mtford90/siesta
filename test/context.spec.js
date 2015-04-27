var assert = require('chai').assert;

describe('contexts', function() {
  var MyCollection, Person, Car;

  var app = siesta.createApp('context');

  beforeEach(function(done) {
    app.reset(function() {
      MyCollection = app.collection('MyCollection');
      Person = MyCollection.model('Person', {
        id: 'id',
        attributes: ['name', 'age']
      });
      Car = MyCollection.model('Car', {
        attributes: ['color'],
        relationships: {
          owner: {
            model: Person,
            reverse: 'cars'
          }
        }
      });
      done();
    });
  });

  it('yo!', function() {
    var context = app.context({name: 'another-context'});
    assert.notEqual(context.Person, Person);
  });
});
