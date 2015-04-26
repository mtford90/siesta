var assert = require('chai').assert;

describe('auto save', function() {
  var MyCollection, Person;
  before(function() {
    siesta.app.storageEnabled = true;
  });

  afterEach(function() {
    siesta.app.autosave = false;
  });

  beforeEach(function(done) {
    siesta.reset(function() {
      MyCollection = siesta.collection('MyCollection');
      Person = MyCollection.model('Person', {
        id: 'id',
        attributes: ['name', 'age']
      });
      done();
    });
  });

  it('autosaves on modelEvents if enabled', function(done) {
    siesta.app.autosave= true;
    siesta.once('saved', function() {
      siesta.app.storage._pouch.allDocs()
        .then(function(resp) {
          assert.ok(resp.rows.length, 'Should be a row');
          var person = resp.rows[0];
          done();
        })
        .catch(done);
    });
    Person.graph({name: 'Mike', age: 24})
      .catch(done)
  });

  it('does not interval on modelEvents if disabled', function(done) {
    siesta.app.autosave = false;
    console.log(1);
    Person.graph({name: 'Mike', age: 24})
      .then(function() {
        console.log(2);
        siesta.app.storage._pouch.allDocs()
          .then(function(resp) {
            console.log('resp', resp);
            assert.equal(resp.rows.length, 1, 'Only row should be a design doc');
            done();
          })
          .catch(done);
      })
      .catch(done)
  });
});
