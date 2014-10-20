var s = require('../../index')
    , assert = require('chai').assert;

describe('performance', function () {

    var Collection = require('../../src/collection').Collection;
    var cache = require('../../src/cache');
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
                    type: siesta.RelationshipType.OneToMany,
                    reverse: 'repositories'
                }
            },
            data: 'items'
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
         *
         * On Mike's MacBook Air, 1.7 GHz Intel Core i5, 4 GB 1333 MHz DDR3, OSX 10.10 Beta, logging disabled:
         *    - 26/9/2014 11:42: 0.987 secs
         */
        it('xyz', function (done) {
            this.timeout(10000);
            var json = require('./repos').repos;
            Repo.map(json, done);
        });

        it('store', function (done) {
            this.timeout(10000);
            var json = require('./repos').repos;
            Repo.map(json, function (err, objs) {
                if (err) done(err);
                siesta.save(function (err) {
                    if (err) done(err);
                    cache.reset();
                    var results = {cached: {}, notCached: {}};
                    siesta.ext.storage.store.getMultipleRemoteFrompouch(Repo, _.pluck(objs, 'id'), results, function () {
                        assert.equal(100, Object.keys(results.cached).length);
                        done();
                    });
                });
            });
        });
    });


});