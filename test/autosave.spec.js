var assert = require('chai').assert;

describe('auto save', function() {
  var MyCollection, Person;

  var app = siesta.createApp('autosave', {storage: true});

  beforeEach(function(done) {
    app.reset(function() {
      MyCollection = app.collection('MyCollection');
      Person = MyCollection.model('Person', {
        id: 'id',
        attributes: ['name', 'age']
      });
      console.log('reset');
      done();
    });
  });

  afterEach(function() {
    app.autosave = false;
  });

  it('autosaves on modelEvents if enabled', function(done) {
    app.autosave = true;
    app.once('saved', function() {
      console.log('saved!');
      app
        ._storage
        ._pouch
        .allDocs()
        .then(function(resp) {
          assert.ok(resp.rows.length, 'Should be a row');
          var person = resp.rows[0];
          done();
        })
        .catch(done);
    });
    Person
      .graph({name: 'Mike', age: 24})
      .catch(done)
  });

  it('does not interval on modelEvents if disabled', function(done) {
    app.autosave = false;
    console.log('starting graph');
    Person
      .graph({name: 'Mike', age: 24})
      .then(function() {
        app
          ._storage
          ._pouch
          .allDocs()
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
