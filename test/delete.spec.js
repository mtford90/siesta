describe('relationship deletion policies', function() {

  var app = siesta.createApp('deletion', {storage: false});
  var assert = require('chai').assert;

  beforeEach(function(done) {
    app.reset(done);
  });

  describe('config', function() {
    it('default config', function(done) {
      var coll = app.collection('Collection');
      var Person = coll.model('Person', {
        attributes: ['name']
      });
      var Car = coll.model('Car', {
        attributes: ['attr'],
        relationships: {
          owner: {
            model: 'Person',
            reverse: 'cars'
          }
        }
      });

      app._ensureInstalled(function() {
        var rel = Car.relationships.owner;
        assert.equal(rel.deletion, siesta.constants.Deletion.Nullify);
        done();
      })

    });

    it('cascade config', function(done) {
      var coll = app.collection('Collection');
      var Person = coll.model('Person', {
        attributes: ['name']
      });
      var Car = coll.model('Car', {
        attributes: ['attr'],
        relationships: {
          owner: {
            model: 'Person',
            reverse: 'cars',
            deletion: siesta.constants.Deletion.Cascade
          }
        }
      });

      app._ensureInstalled(function() {
        var rel = Car.relationships.owner;
        assert.equal(rel.deletion, siesta.constants.Deletion.Cascade);
        done();
      })
    });

    it('nullify config', function(done) {
      var coll = app.collection('Collection');
      var Person = coll.model('Person', {
        attributes: ['name']
      });
      var Car = coll.model('Car', {
        attributes: ['attr'],
        relationships: {
          owner: {
            model: 'Person',
            reverse: 'cars',
            deletion: siesta.constants.Deletion.Nullify
          }
        }
      });

      app._ensureInstalled(function() {
        var rel = Car.relationships.owner;
        assert.equal(rel.deletion, siesta.constants.Deletion.Nullify);
        done();
      })
    });
  });

  describe('perform delete', function() {
    it('OneToMany', function(done) {
      var coll = app.collection('Collection');
      var Person = coll.model('Person', {
        attributes: ['name']
      });
      var Car = coll.model('Car', {
        attributes: ['color'],
        relationships: {
          owner: {
            model: 'Person',
            reverse: 'cars',
            deletion: siesta.constants.Deletion.Cascade
          }
        }
      });


      Car.graph({
        id: 3,
        color: 'red',
        owner: {name: 'mike', id: 1}
      }).then(function(car) {
        car.owner.remove();
        assert.notOk(car.owner);
        assert.ok(car.removed);
        app.get(car.localId).then(function(car) {
          assert.notOk(car);
          done();
        });
      }).catch(done);

    });
    it('OneToOne reverse', function(done) {
      var coll = app.collection('Collection');
      var Person = coll.model('Person', {
        attributes: ['name']
      });
      var Car = coll.model('Car', {
        attributes: ['color'],
        relationships: {
          owner: {
            model: 'Person',
            reverse: 'cars',
            type: 'OneToOne',
            deletion: siesta.constants.Deletion.Cascade
          }
        }
      });


      Car.graph({
        id: 3,
        color: 'red',
        owner: {name: 'mike', id: 1}
      }).then(function(car) {
        car.owner.remove();
        assert.notOk(car.owner);
        assert.ok(car.removed);
        app.get(car.localId).then(function(car) {
          assert.notOk(car);
          done();
        });
      }).catch(done);

    });
    it('OneToOne forward', function(done) {
      var coll = app.collection('Collection');
      var Person = coll.model('Person', {
        attributes: ['name']
      });
      var Car = coll.model('Car', {
        attributes: ['color'],
        relationships: {
          owner: {
            model: 'Person',
            reverse: 'cars',
            type: 'OneToOne',
            deletion: siesta.constants.Deletion.Cascade
          }
        }
      });

      Car.graph({
        id: 3,
        color: 'red',
        owner: {name: 'mike', id: 1}
      }).then(function(car) {
        var owner = car.owner;
        car.remove();
        assert.ok(owner.removed);
        app.get(owner.localId).then(function(person) {
          assert.notOk(person);
          done();
        });
      }).catch(done);

    });
  })

});
