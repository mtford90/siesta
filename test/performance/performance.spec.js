var s = require('../../index')
    , assert = require('chai').assert;

describe('performance', function () {

    var Collection = require('../../src/collection').Collection;
    var cache = require('../../src/cache');
    var collection;
    var Repo, User, Fork, Follow;

    beforeEach(function (done) {
        s.reset(true);
        collection = new Collection('MyCollection');
        collection.baseURL = 'https://api.github.com';
        Repo = collection.mapping('Repo', {
            id: 'id',
            attributes: ['name', 'full_name', 'description', 'html_url', 'watchers_count', 'stargazers_count', 'forks'],
            relationships: {
                owner: {
                    mapping: 'User',
                    type: 'OneToMany',
                    reverse: 'repositories'
                }
            }
        });
        Fork = collection.mapping('Fork', {
            relationships: {
                source: {
                    mapping: 'Repo',
                    type: 'OneToMany',
                    reverse: 'forked_to'
                },
                fork: {
                    mapping: 'Repo',
                    type: 'OneToOne',
                    reverse: 'forked_from'
                }
            }
        });
        Follow = collection.mapping('Follow', {
            relationships: {
                followed: {
                    mapping: 'User',
                    type: 'OneToMany',
                    reverse: 'followers'
                },
                follower: {
                    mapping: 'User',
                    type: 'OneToMany',
                    reverse: 'following'
                }
            }
        });
        User = collection.mapping('User', {
            id: 'id',
            attributes: ['login', 'avatar_url']
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
                    var idents = _.pluck(objs, 'id');
                    var results = {cached: {}, notCached: idents};
                    siesta.ext.storage.store.getMultipleRemoteFrompouch(Repo, idents, results, function () {
                        assert.equal(30, Object.keys(results.cached).length);
                        assert.notOk(results.notCached.length);
                        done();
                    });
                });
            });
        });

        it('fork', function (done) {
            this.timeout(8000);
            var repos = require('./repos').repos;
            Repo.map(repos, function (err, objs) {
                if (err) done(err);
                var forks = require('./repos').forks;
                var rawFork = _.map(forks, function (f) {
                    return {fork: f, source: {_id: objs[0]._id}};
                });
                Fork.map(rawFork, function (err, forks) {
                    if (err) done(err);
                    assert.equal(forks.length, 6);
                    for (var i=0;i<forks.length;i++) {
                        var fork = forks[i];
                        assert.equal(fork.source, objs[0]);
                    }
                    done();
                });
            });
        });


        it('follow', function (done) {
            this.timeout(8000);
            var repos = require('./repos').repos;
            Repo.map(repos, function (err, objs) {
                if (err) done(err);
                var user = objs[0].owner;
                Follow.map(require('./repos').follows, function (err, followers) {
                    done();
                });
            });
        });
    });


});