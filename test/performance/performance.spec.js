var s = require('../../index')
    , assert = require('chai').assert;

/**
 * Test bulk mapping against lots of real data from github.
 */
describe('performance', function () {

    var Collection = require('../../src/collection').Collection;
    var collection;
    var Repo, User;

    beforeEach(function (done) {
        s.reset(true);

        collection = new Collection('MyCollection');
        collection.baseURL = 'https://api.github.com';
        Repo = collection.mapping('Repo', {
            id: 'id',
            attributes: ['name', 'full_name', 'description'],
            relationships: {
                owner: {
                    mapping: 'User',
                    type: siesta.RelationshipType.ForeignKey,
                    reverse: 'repositories'
                }
            }
        });
        User = collection.mapping('User', {
            id: 'id',
            attributes: ['login']
        });
        collection.install(done);
    });

    describe('fresh database', function () {

        /**
         * On Mike's Mac, 3.4ghz Intel Core i5, 16gb 1600Mhz DDR3, OSX 10.9.3, logging disabled:
         *    - 11/9/2014 13:16: 2.415 secs
         *    - 12/9/2014 08:36: 1.084 secs
         *    - 13/9/2014 08:46: 0.53 secs
         */
        it('xyz', function (done) {
            this.timeout(10000);
            var json = require('./repos').repos;
            Repo.map(json, function (err, repos) {
                done(err);
            });
        });
    });



});