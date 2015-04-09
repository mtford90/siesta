var assert = require('chai').assert;
siesta.log.disable('*');

describe('f4t', function() {
  var F4TCollection,
    Base,
    User,
    Company,
    Species;

  before(function() {
    siesta.ext.storageEnabled = true;
  });

  function configureSiesta() {
    F4TCollection = siesta.collection('F4TCollection');

    Base = F4TCollection.model('Base', {
      id: '_id',
      attributes: [
        'pushed'
      ]
    });

    User = Base.child('User', {
      attributes: [
        'username',
        'displayName',
        'email',
        'birthdate',
        'city',
        'region',
        'country',
        'lastName',
        'firstName',
        'sex',
        'accessToken',
        'avatarUrl',
        'thumbnailUrl'
      ]
    });

    Company = Base.child('Company', {
      attributes: [
        'name',
        'numEmployees',
        'address',
        'region',
        'city',
        'country',
        'type',
        'farmingType',
        'identificationNumber'
      ],
      relationships: {
        owner: {
          model: 'User',
          reverse: 'companies'
        }
      },
      statics: {
        getCurrentUsersCompanies: function() {
          var newVar = {owner: $rootScope.user};
          return this.query(newVar);
        }
      }
    });

    Species = Base.child('Species', {
      attributes: [
        'name',
        'latinName',
        'avatarUrl',
        'type'
      ],
      serialisableFields: [
        'name',
        'latinName',
        'avatarUrl',
        'type',
        'user'
      ],
      relationships: {
        user: {
          model: 'User',
          reverse: 'breeds'
        }
      }
    });
  }

  beforeEach(function(done) {
    siesta.reset(function() {
      configureSiesta();
      done();
    });

  });

  it('graph should work', function(done) {
    User.graph({
      _id: '54e8cc3011c8a11c633c5449',
      username: 'mtford'
    }).then(function(user) {
      Company.graph([{
        "owner": "54e8cc3011c8a11c633c5449",
        "name": "Mikes Companyasdasd",
        "type": "farm",
        "_id": "54f1bb5116634c5e3570d5c2",
        "created": "2015-02-28T12:57:53.883Z",
        "employees": []
      }]).then(function(companies) {
        var company = companies[0];
        assert.equal(company.owner, user);
        done();
      }).catch(done);
    }).catch(done);
  });

  describe('reactive queries', function() {

    it('on should work with a delay', function(done) {
      User.graph({
        _id: '54e8cc3011c8a11c633c5449',
        username: 'mtford'
      }).then(function(user) {
        var cancel = Company.query({owner: user})
          .on('*', function(e) {
            done();
          });
        setTimeout(function() {
          Company.graph([{
            "owner": "54e8cc3011c8a11c633c5449",
            "name": "Mikes Companyasdasd",
            "type": "farm",
            "_id": "54f1bb5116634c5e3570d5c2",
            "created": "2015-02-28T12:57:53.883Z",
            "employees": []
          }]).catch(done);
        }, 100);

      }).catch(done);
    });

    it('on should work without a delay', function(done) {
      User.graph({
        _id: '54e8cc3011c8a11c633c5449',
        username: 'mtford'
      }).then(function(user) {
        var cancel = Company.query({owner: user})
          .on('*', function(e) {
            done();
          });
        setTimeout(function() {
          Company.graph([{
            "owner": "54e8cc3011c8a11c633c5449",
            "name": "Mikes Companyasdasd",
            "type": "farm",
            "_id": "54f1bb5116634c5e3570d5c2",
            "created": "2015-02-28T12:57:53.883Z",
            "employees": []
          }]).catch(done);
        });
      }).catch(done);
    });


    it('on should work without a setTimeout', function(done) {
      User.graph({
        _id: '54e8cc3011c8a11c633c5449',
        username: 'mtford'
      }).then(function(user) {
        var cancel = Company
          .query({owner: user})
          .then(function(res) {
            console.log('ffs', res);
          })
          .on('*', function(e) {
            done();
          });

        Company.graph([{
          "owner": "54e8cc3011c8a11c633c5449",
          "name": "Mikes Companyasdasd",
          "type": "farm",
          "_id": "54f1bb5116634c5e3570d5c2",
          "created": "2015-02-28T12:57:53.883Z",
          "employees": []
        }]).catch(done);
      }).catch(done);
    });

    it('rq should work', function(done) {
      User.graph({
        _id: '54e8cc3011c8a11c633c5449',
        username: 'mtford'
      }).then(function(user) {
        var rq = Company._reactiveQuery({owner: user});
        rq.init()
          .then(function() {
            rq.on('*', function() {
              done();
            });
            Company.graph([{
              "owner": "54e8cc3011c8a11c633c5449",
              "name": "Mikes Companyasdasd",
              "type": "farm",
              "_id": "54f1bb5116634c5e3570d5c2",
              "created": "2015-02-28T12:57:53.883Z",
              "employees": []
            }]).catch(done);
          }).catch(done);

      }).catch(done);
    });

  });

  describe('errors', function() {
    it('assign string to reverse OneToMany should return a nice error.', function(done) {
      User.graph({
        companies: 'asdasd'
      }).then(function() {
        done('should not succeed');
      }).catch(function(err) {
        console.log('err', err);
        assert.ok(err);
        done();
      });
    });
    it('should be an error on duplicate reverse key', function(done) {
      var Model = F4TCollection.model('Model', {
        relationships: {
          related: {
            model: 'RelatedModel',
            reverse: 'blah'
          },
          relatedAgain: {
            model: 'RelatedModel',
            reverse: 'blah'
          }
        }
      });
      var RelatedModel = F4TCollection.model('RelatedModel', {});
      siesta.install()
        .then(function() {
          done(new Error('Should not succeed'));
        })
        .catch(function(err) {
          console.log('err', err);
          assert.ok(err);
          done();
        })
    });

  });

  describe('storage', function() {

    describe('field loading', function() {
      var speciesData = [{
        "_id": "54f75cb292997f5041132d94",
        "created": "2015-03-06T18:16:25.577Z",
        "latinName": "Gallus gallus domesticus",
        "name": "Chicken"
      }, {
        "_id": "54f75cb292997f5041132d95",
        "created": "2015-03-06T18:16:25.577Z",
        "latinName": "Sus scrofa domesticus",
        "name": "Pig"
      }, {
        "_id": "54f75cb292997f5041132d96",
        "created": "2015-03-06T18:16:25.577Z",
        "latinName": "Ovis aries",
        "name": "Sheep"
      }];

      var instances;

      beforeEach(function(done) {
        Species.graph(speciesData).then(function(species) {
          siesta.save()
            .then(function() {
              siesta.reset(function() {
                configureSiesta();
                Species
                  .all()
                  .then(function(species) {
                    instances = species;
                    done();
                  });
              }, false);
            });
        }).catch(done);
      });

      it('should load remote identifiers', function() {
        console.debug('instances', instances);
        assert.equal(instances.length, 3);
        var dataIdentifiers = _.pluck(speciesData, '_id'),
          modelIdentifiers = _.pluck(instances, '_id');
        dataIdentifiers.forEach(function(_id) {
          assert.include(modelIdentifiers, _id);
        });
        console.debug('identifiers', dataIdentifiers);
      });

      it('xyz', function(done) {
        console.log('here we go!');
        siesta.reset(function() {
          configureSiesta();
          siesta
            .install()
            .then(function() {
              var remoteCache = siesta._internal.cache._remoteCache();
              var localCache = siesta._internal.cache._localCache();
              assert.equal(Object.keys(localCache).length, 3, 'local cache should be populated');
              assert.equal(Object.keys(remoteCache.F4TCollection.Species).length, 3, 'remote cache should be populated');
              done();
            })
            .catch(done);
        }, false);
      });


    });
  });

});


