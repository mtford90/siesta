var assert = require('chai').assert;


describe('bulk removal', function() {
  var app = siesta.createApp('bulk-removal');
  before(function() {
    app.storage = false;
  });
  beforeEach(function(done) {
    app.reset(done);
  });
  var ModelOne, ModelTwo;
  var Collection, CollectionOne, CollectionTwo;
  it('model level', function(done) {
    Collection = app.collection('Collection');
    ModelOne = Collection.model('ModelOne', {
      attributes: ['attr']
    });
    ModelTwo = Collection.model('ModelTwo', {
      attributes: ['attr']
    });
    Collection.graph({
      ModelOne: [{attr: 'string', id: 1}],
      ModelTwo: [{attr: 'string434', id: 2}]
    }).then(function(res) {
      ModelOne
        .removeAll()
        .then(function() {
          ModelOne
            .all()
            .then(function(res) {
              assert.notOk(res.length);
              ModelTwo
                .all()
                .then(function(res) {
                  assert.equal(res.length, 1);
                  done();
                }).catch(done);
            }).catch(done);
        }).catch(done);
    }).catch(done);
  });
  it('collection level', function(done) {
    CollectionOne = app.collection('CollectionOne');
    CollectionTwo = app.collection('CollectionTwo');
    ModelOne = CollectionOne.model('ModelOne', {
      attributes: ['attr']
    });
    ModelTwo = CollectionTwo.model('ModelTwo', {
      attributes: ['attr']
    });
    app.graph({
      CollectionOne: {
        ModelOne: [{attr: 'string', id: 1}],
      },
      CollectionTwo: {
        ModelTwo: [{attr: 'string434', id: 2}]
      }
    }).then(function(res) {
      CollectionOne
        .removeAll()
        .then(function() {
          ModelOne
            .all()
            .then(function(res) {
              assert.notOk(res.length);
              ModelTwo
                .all()
                .then(function(res) {
                  assert.equal(res.length, 1);
                  done();
                }).catch(done);
            }).catch(done);
        }).catch(done);
    }).catch(done);
  });
  it('siesta level', function(done) {
    CollectionOne = app.collection('CollectionOne');
    CollectionTwo = app.collection('CollectionTwo');
    ModelOne = CollectionOne.model('ModelOne', {
      attributes: ['attr']
    });
    ModelTwo = CollectionTwo.model('ModelTwo', {
      attributes: ['attr']
    });
    app.graph({
      CollectionOne: {
        ModelOne: [{attr: 'string', id: 1}],
      },
      CollectionTwo: {
        ModelTwo: [{attr: 'string434', id: 2}]
      }
    }).then(function(res) {
      app
        .removeAll()
        .then(function() {
          ModelOne
            .all()
            .then(function(res) {
              assert.notOk(res.length);
              ModelTwo
                .all()
                .then(function(res) {
                  assert.notOk(res.length);
                  done();
                }).catch(done);
            }).catch(done);
        }).catch(done);
    }).catch(done);
  });
});
