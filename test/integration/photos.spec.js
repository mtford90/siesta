/**
 * An integration test that creates two complex collections and then establishes inter-collection relationships
 * between the mappings in each before creating objects etc.
 *
 * We then proceed to test various aspects of the system.
 */

var assert = require('chai').assert,
    async = require('async'),
    internal = siesta._internal,
    RelationshipType = siesta.RelationshipType;

describe('photos intercollection', function () {
    var MyOfflineCollection, MyOnlineCollection, OfflineUser, Photo, OnlineUser;

    before(function () {
        siesta.ext.storageEnabled = false;
    });

    beforeEach(function () {
        siesta.reset(function () {
            MyOfflineCollection = siesta.collection('MyOfflineCollection');
            MyOnlineCollection = siesta.collection('MyOnlineCollection');

            MyOfflineCollection.model('Folder', {
                attributes: ['name'],
                relationships: {
                    createdBy: {
                        model: 'User',
                        type: RelationshipType.OneToMany,
                        reverse: 'folders'
                    }
                }
            });

            MyOfflineCollection.model('DownloadedPhoto', {
                attributes: ['creationDate'],
                relationships: {
                    createdBy: {
                        model: 'User',
                        type: RelationshipType.OneToMany,
                        reverse: 'files'
                    },
                    folder: {
                        model: 'Folder',
                        type: RelationshipType.OneToMany,
                        reverse: 'files'
                    },
                    photo: {
                        model: 'MyOnlineCollection.Photo',
                        type: RelationshipType.OneToOne,
                        reverse: 'file'
                    }
                }
            });

            OfflineUser = MyOfflineCollection.model('User', {
                attributes: ['username'],
                indexes: ['username']
            });

            Photo = MyOnlineCollection.model('Photo', {
                id: 'photoId',
                attributes: ['height', 'width', 'url'],
                relationships: {
                    createdBy: {
                        model: 'User',
                        type: RelationshipType.OneToMany,
                        reverse: 'photos'
                    }
                }
            });

            OnlineUser = MyOnlineCollection.model('User', {
                id: 'userId',
                attributes: ['username', 'name']
            });
        });
    });

    function mapRemoteUsers(callback) {
        MyOnlineCollection.User.graph([{
            username: 'mtford',
            name: 'Michael Ford',
            userId: '1'
        }, {
            username: 'blahblah',
            name: 'Blah Blah',
            userId: '2'
        }, {
            username: 'bobm',
            name: 'Bob Marley',
            userId: '3'
        }], callback);
    }

    function mapRemotePhotos(callback) {
        MyOnlineCollection.Photo.graph([{
            height: 500,
            width: 500,
            url: 'http://somewhere/image.jpeg',
            photoId: '10',
            createdBy: '1'
        }, {
            height: 1500,
            width: 1500,
            url: 'http://somewhere/image2.jpeg',
            photoId: '11',
            createdBy: '1'
        }, {
            height: 500,
            width: 750,
            url: 'http://somewhere/image3.jpeg',
            photoId: '12',
            createdBy: '2'
        }], callback);
    }

    function mapOfflineUsers(callback) {
        MyOfflineCollection.User.graph([{
            username: 'mike'
        }, {
            username: 'gaz'
        }], callback);
    }

    function installOfflineFixtures(callback) {
        mapOfflineUsers(callback);
    }

    function installOnlineFixtures(callback) {
        async.series([
            mapRemoteUsers,
            mapRemotePhotos
        ], callback);
    }

    beforeEach(function (done) {
        installOfflineFixtures(function (err) {
            if (err) done(err);
            installOnlineFixtures(done);
        });
    });

    describe('local queries', function () {
        describe('offline', function () {
            it('should return mike when querying for him', function (done) {
                MyOfflineCollection.User.query({
                    username: 'gaz'
                }, function (err, users) {
                    if (err) done(err);
                    assert.equal(users.length, 1);
                    assert.equal(users[0].username, 'gaz');
                    done();
                });
            });
        });

        describe('online', function () {

            it('should return 3 users when run a local all query against users', function (done) {
                MyOnlineCollection.User.all(function (err, users) {
                    if (err) done(err);
                    assert.equal(users.length, 3);
                    done();
                });
            });

            it('should return 3 photos when run a local all query against photos', function (done) {
                MyOnlineCollection.Photo.all(function (err, photos) {
                    if (err) done(err);
                    assert.equal(photos.length, 3);
                    done();
                });
            });

            it('should return 2 photos with height 500', function (done) {
                this.timeout(10000);
                MyOnlineCollection.Photo.query({
                    height: 500
                }, function (err, photos) {
                    if (err) done(err);
                    assert.equal(photos.length, 2);
                    _.each(photos, function (p) {
                        assert.equal(p.height, 500);
                    });
                    done();
                });
            });

            it('should return 1 photo with height 500, width, 750', function (done) {
                this.timeout(10000);
                MyOnlineCollection.Photo.query({
                    height: 500,
                    width: 750
                }, function (err, photos) {
                    if (err) done(err);
                    assert.equal(photos.length, 1);
                    assert.equal(photos[0].height, 500);
                    assert.equal(photos[0].width, 750);
                    done();
                });
            });

            it('should be able to query by remote identifier', function (done) {
                MyOnlineCollection.User.one({userId: '1'}, function (err, user) {
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
                OnlineUser.one({userId: userId}, function (err, user) {
                    if (err) done(err);
                    assert.ok(user);
                    assert.equal(user.userId, userId);
                    var proxy = user.__proxies['photos'];
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


});