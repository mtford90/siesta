describe.only('relationship deletion policies', function() {

  var app = siesta.createApp('deletion', {storage: false});
  var assert = require('chai').assert;

  it('default', function(done) {
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
      console.log(1);
      assert.equal(rel.deletion, siesta.constants.Deletion.Nullify);
      console.log(2);
      done();
    })

  });
});
