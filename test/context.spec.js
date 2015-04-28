var assert = require('chai').assert;

describe('contexts', function() {
  var MyCollection, Person, Car;

  var app = siesta.createApp('context', {storage: true});

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

  it('works', function(done) {
    var context = app.context({name: 'another-context'});
    assert.notEqual(context.Person, Person);
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

  it('enable storage', function() {
    var context = app.context({name: 'another-context', storage: true});
    assert.ok(context._storage);
  });

  it('no storage', function() {
    var context = app.context({name: 'another-context'});
    assert.notOk(context._storage);
  });

  it('enable then storage', function() {
    var context = app.context({name: 'another-context', storage: true});
    assert.ok(context._storage);
    context.storage = false;
    assert.notOk(context._storage);
  });

  it('customPouch', function(done) {
    var context = app.context({name: 'another-context', storage: true});
    context._ensureInstalled(function() {

      done();
    })
  });
});
