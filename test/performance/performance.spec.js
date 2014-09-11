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
         * Timings:
         *    - 11/9/2014 13:16: 2.415 secs
         */
        it('xyz', function (done) {
            this.timeout(10000);
            var json = require('./repos').repos;
            Repo.map(json, function (err, repos) {
                done(err);
            });
        });
    })



});