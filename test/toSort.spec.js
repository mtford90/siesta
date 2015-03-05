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


});