var assert = require('chai').assert;

describe('to sort', function() {
  var Model, Collection;

  before(function() {
    siesta.ext.storageEnabled = false;
  });
  beforeEach(function(done) {
    siesta.reset(done);
  });

  it('named attribute', function(done) {
    Collection = siesta.collection('myCollection');
    Model = Collection.model({
      name: 'Car',
      id: 'id',
      attributes: [
        {
          name: 'date'
        },
        'name'
      ],
      collection: 'myCollection'
    });
    Model
      .graph({date: 'xyz', name: 'blah'})
      .then(function(model) {
        assert.equal(model.date, 'xyz');
        done();
      })
      .catch(done);
  });
  describe('parse attribute', function() {
    it('per attribute basis', function(done) {
      var modelInstance;
      Collection = siesta.collection('myCollection');
      Model = Collection.model({
        name: 'Car',
        id: 'id',
        attributes: [
          {
            name: 'date',
            parse: function(value) {
              if (!(value instanceof Date)) {
                value = new Date(Date.parse(value));
              }
              assert.instanceOf(this, siesta._internal.ModelInstance);
              return value;
            }
          },
          'name'
        ],
        collection: 'myCollection'
      });
      Model
        .graph({date: '2015-02-22', name: 'blah'})
        .then(function(_model) {
          modelInstance = _model;
          assert.instanceOf(_model.date, Date);
          done();
        })
        .catch(done);
    });
    it('whole model basis', function(done) {
      var modelInstance;
      Collection = siesta.collection('myCollection');
      Model = Collection.model({
        name: 'Car',
        id: 'id',
        attributes: [
          'date',
          'name'
        ],
        parseAttribute: function(attributeName, value) {
          console.log('yo!');
          if (attributeName == 'date') {
            if (!(value instanceof Date)) {
              value = new Date(Date.parse(value));
            }
            assert.instanceOf(this, siesta._internal.ModelInstance);
          }
          return value;
        },
        collection: 'myCollection'
      });
      Model
        .graph({date: '2015-02-22', name: 'blah'})
        .then(function(_model) {
          modelInstance = _model;
          assert.instanceOf(_model.date, Date);
          assert.equal(_model.name, 'blah');
          done();
        })
        .catch(done);
    });
  });
  describe('get by localid', function() {
    it('exists', function(done) {
      Collection = siesta.collection('myCollection');
      Model = Collection.model('Car', {
        attributes: ['name']
      });
      Model
        .graph({x: 1})
        .then(function(instance) {
          var id = instance.localId;
          siesta
            .get(id)
            .then(function(_instance) {
              assert.equal(instance, _instance);
              done();
            })
            .catch(done);
        }).catch(done);
    });
    it('does not exist', function(done) {
      Collection = siesta.collection('myCollection');
      Model = Collection.model('Car', {
        attributes: ['name']
      });
      Model
        .graph({x: 1})
        .then(function(instance) {
          siesta
            .get('sdfsdfsdf')
            .then(function(_instance) {
              assert.notOk(_instance);
              done();
            });
        }).catch(done);
    });
  });
  describe('bulk removal', function() {
    var ModelOne, ModelTwo;
    var CollectionOne, CollectionTwo;
    it('model level', function(done) {
      Collection = siesta.collection('Collection');
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
      CollectionOne = siesta.collection('CollectionOne');
      CollectionTwo = siesta.collection('CollectionTwo');
      ModelOne = CollectionOne.model('ModelOne', {
        attributes: ['attr']
      });
      ModelTwo = CollectionTwo.model('ModelTwo', {
        attributes: ['attr']
      });
      siesta.graph({
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
      CollectionOne = siesta.collection('CollectionOne');
      CollectionTwo = siesta.collection('CollectionTwo');
      ModelOne = CollectionOne.model('ModelOne', {
        attributes: ['attr']
      });
      ModelTwo = CollectionTwo.model('ModelTwo', {
        attributes: ['attr']
      });
      siesta.graph({
        CollectionOne: {
          ModelOne: [{attr: 'string', id: 1}],
        },
        CollectionTwo: {
          ModelTwo: [{attr: 'string434', id: 2}]
        }
      }).then(function(res) {
        siesta
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
  })

});