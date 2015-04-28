var assert = require('chai').assert;

describe.only('contexts', function() {
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

  it('yo!', function(done) {
    var context = app.context({name: 'another-context'});
    assert.notEqual(context.Person, Person);
    assert.notEqual(context.storage, app.storage);
    context
      .MyCollection
      .Person
      .graph({name: 'Mike', age: 21})
      .then(function(person) {
        app.get(person._id)
          .then(function(p) {
            assert.notOk(p);
            assert.equal(person.name, 'Mike');
            assert.equal(person.age, 21);
            done();
          })
          .catch(done);
      }).catch(done);
  });
});
