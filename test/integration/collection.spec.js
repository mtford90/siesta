/**
* An integration test that creates two complex collections and then establishes inter-collection relationships
* between the mappings in each before creating objects etc.
*
* We then proceed to test various aspects of the system.
*/

var s = require('../../index')
    , assert = require('chai').assert;

var Collection = require('../../src/collection').Collection;
var RelationshipType = require('../../src/relationship').RelationshipType;
var cache = require('../../src/cache');

var async = require('async');

describe('intercollection relationships', function () {
    var myOfflineCollection;
    var myOnlineCollection;

    beforeEach(function (done) {
        s.reset(true);
        var finishedCreatingMyOfflineCollection = false;

        myOfflineCollection = new Collection('MyOfflineCollection');

        myOfflineCollection.mapping('Folder', {
            attributes: ['name'],
            relationships: {
                createdBy: {
                    mapping: 'User',
                    type: RelationshipType.OneToMany,
                    reverse: 'folders'
                }
            }
        });

        myOfflineCollection.mapping('DownloadedPhoto', {
            attributes: ['creationDate'],
            relationships: {
                createdBy: {
                    mapping: 'User',
                    type: RelationshipType.OneToMany,
                    reverse: 'files'
                },
                folder: {
                    mapping: 'Folder',
                    type: RelationshipType.OneToMany,
                    reverse: 'files'
                },
                photo: {
                    mapping: 'MyOnlineCollection.Photo',
                    type: RelationshipType.OneToOne,
                    reverse: 'file'
                }
            }
        });

        myOfflineCollection.mapping('User', {
            attributes: ['username'],
            indexes: ['username']
        });

        myOfflineCollection.install(function (err) {
            if (err) done(err);
            finishedCreatingMyOfflineCollection = true;
            if (finishedCreatingMyOnlineCollection) {
                done();
            }
        });

        var finishedCreatingMyOnlineCollection = false;

        myOnlineCollection = new Collection('MyOnlineCollection');

        myOnlineCollection.mapping('Photo', {
            id: 'photoId',
            attributes: ['height', 'width', 'url'],
            relationships: {
                createdBy: {
                    mapping: 'User',
                    type: RelationshipType.OneToMany,
                    reverse: 'photos'
                }
            }
        });

        myOnlineCollection.mapping('User', {
            id: 'userId',
            attributes: ['username', 'name']
        });

        myOnlineCollection.install(function (err) {
            if (err) done(err);
            if (finishedCreatingMyOfflineCollection) {
                done();
            }
        });
    });

    function mapRemoteUsers(callback) {
        myOnlineCollection.User.map([
            {username: 'mtford', name: 'Michael Ford', userId: '1'},
            {username: 'blahblah', name: 'Blah Blah', userId: '2'},
            {username: 'bobm', name: 'Bob Marley', userId: '3'}
        ], callback);
    }

    function mapRemotePhotos(callback) {
        myOnlineCollection.Photo.map([
            {height: 500, width: 500, url: 'http://somewhere/image.jpeg', photoId: '10', createdBy: '1'},
            {height: 1500, width: 1500, url: 'http://somewhere/image2.jpeg', photoId: '11', createdBy: '1'},
            {height: 500, width: 750, url: 'http://somewhere/image3.jpeg', photoId: '12', createdBy: '2'}
        ], callback);
    }

    function mapOfflineUsers(callback) {
        myOfflineCollection.User.map([
            {username: 'mike'},
            {username: 'gaz'}
        ], callback);
    }

    function installOfflineFixtures(callback) {
        mapOfflineUsers(function (err) {
            if (!err) {
                myOfflineCollection.save(callback);
            }
            else {
                callback(err);
            }
        });
    }

    function installOnlineFixtures(callback) {
        async.series([
            mapRemoteUsers,
            mapRemotePhotos
        ], function (err) {
            if (!err) {
                myOnlineCollection.save(callback);
            }
            else {
                callback(err);
            }
        });
    }

    describe('can install', function () {
        it('Can install offline fixtures', function (done) {
            installOfflineFixtures(function (err) {
                if (err) done(err);
                assert.notOk(s.ext.storage.changes.allChanges.length);
                done();
            });
        });

        it('can install online fixtures', function (done) {
            installOnlineFixtures(function (err) {
                if (err) done(err);
                assert.notOk(s.ext.storage.changes.allChanges.length);
                done();
            });
        });

        it('can install both', function (done) {
            installOfflineFixtures(function (err) {
                if (err) done(err);
                installOnlineFixtures(function (err) {
                    if (err) done(err);
                    assert.notOk(s.ext.storage.changes.allChanges.length);
                    done();
                });
            });
        })
    });


    /**
     * Execute the integration test. Seperated out into a function so can be executed having manipulated s.ext.storage.Pouch
     */
    function tests () {
        describe('local queries', function () {
            describe('offline', function () {


                it('should return mike when querying for him', function (done) {
                    myOfflineCollection.User.query({username: 'gaz'}, function (err, users) {
                        if (err) done(err);
                        assert.equal(users.length, 1);
                        assert.equal(users[0].username, 'gaz');
                        done();
                    });
                });
            });

            describe('online', function () {

                it('should return 3 users when run a local all query against users', function (done) {
                    myOnlineCollection.User.all(function (err, users) {
                        if (err) done(err);
                        assert.equal(users.length, 3);
                        done();
                    });
                });

                it('should return 3 photos when run a local all query against photos', function (done) {
                    myOnlineCollection.Photo.all(function (err, photos) {
                        if (err) done(err);
                        assert.equal(photos.length, 3);
                        done();
                    });
                });

                it('should return 2 photos with height 500', function (done) {
                    myOnlineCollection.Photo.query({height: 500}, function (err, photos) {
                        if (err) done(err);
                        assert.equal(photos.length, 2);
                        _.each(photos, function (p) {
                            assert.equal(p.height, 500);
                        });
                        done();
                    });
                });

                it('should return 1 photo with height 500, width, 750', function (done) {
                    myOnlineCollection.Photo.query({height: 500, width: 750}, function (err, photos) {
                        if (err) done(err);
                        assert.equal(photos.length, 1);
                        assert.equal(photos[0].height, 500);
                        assert.equal(photos[0].width, 750);
                        done();
                    });
                });

                it('should be able to query by remote identifier', function (done) {
                    myOnlineCollection.User.get('1', function (err, user) {
                        if (err) done(err);
                        assert.equal(user.userId, '1');
                        done();
                    })
                })


            });
        });
        describe('relationship mappings', function () {
            describe('online', function () {
                function assertNumPhotos(userId, numPhotos, done) {
                    myOnlineCollection.User.get(userId, function (err, user) {
                        if (err) done(err);
                        assert.ok(user);
                        assert.equal(user.userId, userId);
                        var proxy = user.photosProxy;
                        proxy.get(function (err, photos) {
                            if (err) done(err);
                            assert.equal(photos ? photos.length : 0, numPhotos);
                            done();
                        });
                    })
                }

                it('user with id 1 should have 2 photos', function (done) {
                    assertNumPhotos('1', 2, done);
                });

                it('user with id 2 should have 1 photo...', function (done) {
                    assertNumPhotos('2', 1, done);
                });

                it('user with id 3 should have no photos', function (done) {
                    assertNumPhotos('3', 0, done);
                });

            });

        });
    }

    describe('no cache', function () {
        beforeEach(function (done) {
            installOfflineFixtures(function (err) {
                if (err) done(err);
                installOnlineFixtures(function (err) {
                    if (err) done(err);
                    cache.reset();
                    done();
                });
            });
        });
        tests();
    });

//    describe('cached', function () {
//        beforeEach(function (done) {
//            installOfflineFixtures(function (err) {
//                if (err) done(err);
//                installOnlineFixtures(done);
//            });
//        });
//        tests();
//    });



});