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

  beforeEach(function(done) {
    siesta.reset(function() {
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
        id: '_id',
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
        var cancel = Company.query({owner: user})
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

  describe('storage', function() {
    it('species', function(done) {
      Species.graph([{
        "_id": "54f75cb292997f5041132d94",
        "created": "2015-03-06T18:16:25.577Z",
        "localizedName": ["[object Object]"],
        "latinName": "Gallus gallus domesticus",
        "name": "Chicken"
      }, {
        "_id": "54f75cb292997f5041132d95",
        "created": "2015-03-06T18:16:25.577Z",
        "localizedName": ["[object Object]"],
        "latinName": "Sus scrofa domesticus",
        "name": "Pig"
      }, {
        "_id": "54f75cb292997f5041132d96",
        "created": "2015-03-06T18:16:25.577Z",
        "localizedName": ["[object Object]"],
        "latinName": "Ovis aries",
        "name": "Sheep"
      }]).then(function(species) {
        siesta
          .save()
          .then(function() {
            done();
          });
      }).catch(done);
    });
  });


});


