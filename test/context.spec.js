var assert = require('chai').assert;

describe('contexts', function() {
  var MyCollection, Person, Car;

  var app = siesta.app('context', {storage: true});

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

  it('customPouch', function() {
    var pouchDB = new PouchDB('custom');
    var context = app.context({name: 'another-context', storage: {pouch: pouchDB}});
    assert.equal(context._storage._pouch, pouchDB);
  });

  describe.only('merge', function() {
    var mainContext = app.context({name: 'main-context', storage: false});
    var secondaryContext;

    var Coll1, Model1, Model2;

    beforeEach(function(done) {
      mainContext.reset(function() {
        Coll1 = mainContext.collection('Coll1');
        Model1 = Coll1.model('Model1', {
          attributes: ['attr']
        });
        Model2 = Coll1.model('Model2', {
          attributes: ['attr']
        });
        secondaryContext = mainContext.context({name: 'secondary-context', storage: false});
        done();
      });
    });

    afterEach(function(done) {
      secondaryContext.reset(done);
    });

    it('instance', function(done) {
      secondaryContext.Coll1.Model1.graph({
        id: 1,
        attr: 1
      }).then(function(instance) {
        mainContext
          .merge(instance)
          .then(function(mainContextInstance) {
            mainContextInstance = mainContextInstance.Coll1.Model1[0];
            assert.notEqual(instance.localId, mainContextInstance.localId);
            assert.equal(mainContextInstance.id, 1);
            assert.equal(mainContextInstance.attr, 1);
            done();
          })
          .catch(done);
      }).catch(done);
    });

    it('instance iterable', function(done) {
      secondaryContext.Coll1.Model1.graph([{
        id: 1,
        attr: 1
      }, {
        id: 2,
        attr: 2
      }]).then(function(instance) {
        mainContext
          .merge(instance)
          .then(function(mainContextInstances) {
            assert.equal(mainContextInstances.Coll1.Model1.length, 2);
            done();
          })
          .catch(done);
      }).catch(done);
    });

    it('model', function(done) {
      secondaryContext.Coll1.Model1.graph([{
        id: 1,
        attr: 1
      }, {
        id: 2,
        attr: 2
      }]).then(function(instance) {
        mainContext
          .merge(secondaryContext.Coll1.Model1)
          .then(function(mainContextInstances) {
            assert.equal(mainContextInstances.Coll1.Model1.length, 2);
            done();
          })
          .catch(done);
      }).catch(done);
    });

    it('collection', function(done) {
      secondaryContext.Coll1.Model1.graph([{
        id: 1,
        attr: 1
      }, {
        id: 2,
        attr: 2
      }]).then(function(instance) {
        mainContext
          .merge(secondaryContext.Coll1)
          .then(function(mainContextInstances) {
            assert.equal(mainContextInstances.Coll1.Model1.length, 2);
            done();
          })
          .catch(done);
      }).catch(done);
    });

    it('context', function(done) {
      secondaryContext.Coll1.Model1.graph([{
        id: 1,
        attr: 1
      }, {
        id: 2,
        attr: 2
      }]).then(function(instance) {
        mainContext
          .merge(secondaryContext)
          .then(function(mainContextInstances) {
            assert.equal(mainContextInstances.Coll1.Model1.length, 2);
            done();
          })
          .catch(done);
      }).catch(done);
    });

    it('error if not a parent context', function() {
      assert.throws(function() {
        mainContext.merge(siesta.app('other-context'));
      });
    });

  });

});
