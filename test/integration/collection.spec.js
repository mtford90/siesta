/**
 * An integration test that creates two complex collections and then establishes inter-collection relationships
 * between the mappings in each before creating objects etc.
 *
 * We then proceed to test various aspects of the system.
 */

describe('intercollection relationships', function () {
//describe('intercollection relationships', function () {

    var myOfflineCollection;
    var myOnlineCollection;

    var $rootScope, Collection, Pouch, RelationshipType;


    beforeEach(function (done) {
        module('restkit', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_$rootScope_, _Collection_, _Pouch_, _RelationshipType_) {
            $rootScope = _$rootScope_;
            Collection = _Collection_;
            Pouch = _Pouch_;
            RelationshipType = _RelationshipType_;
        });

        Pouch.reset();

        var finishedCreatingMyOfflineCollection = false;

        myOfflineCollection = new Collection('MyOfflineCollection', function () {

            myOfflineCollection.registerMapping('Folder', {
                attributes: ['name'],
                relationships: {
                    createdBy: {
                        mapping: 'User',
                        type: RelationshipType.ForeignKey,
                        reverse: 'folders'
                    }
                }
            });

            myOfflineCollection.registerMapping('DownloadedPhoto', {
                attributes: ['creationDate'],
                relationships: {
                    createdBy: {
                        mapping: 'User',
                        type: RelationshipType.ForeignKey,
                        reverse: 'files'
                    },
                    folder: {
                        mapping: 'Folder',
                        type: RelationshipType.ForeignKey,
                        reverse: 'files'
                    },
                    photo: {
                        mapping: 'MyOnlineCollection.Photo',
                        type: RelationshipType.OneToOne,
                        reverse: 'file'
                    }
                }
            });

            myOfflineCollection.registerMapping('User', {
                attributes: ['username']
            });

        }, function (err) {
            if (err) done(err);
            finishedCreatingMyOfflineCollection = true;
            if (finishedCreatingMyOnlineCollection) {
                done();
            }
        });

        var finishedCreatingMyOnlineCollection = false;

        myOnlineCollection = new Collection('MyOnlineCollection', function () {

            myOnlineCollection.registerMapping('Photo', {
                id: 'photoId',
                attributes: ['height', 'width', 'url'],
                relationships: {
                    createdBy: {
                        mapping: 'User',
                        type: RelationshipType.ForeignKey
                    }
                }
            });

            myOnlineCollection.registerMapping('User', {
                id: 'userId',
                attributes: ['username', 'name']
            });

        }, function (err) {
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
            {height: 500, width: 500, url:'http://somewhere/image.jpeg',  photoId: '10'},
            {height: 1500, width: 1500, url:'http://somewhere/image2.jpeg',  photoId: '11'},
            {height: 500, width: 750, url:'http://somewhere/image3.jpeg', photoId: '12'}
        ], callback);
    }

    function installOnlineFixtures(callback) {
        async.parallel([
            mapRemoteUsers
//            mapRemotePhotos
        ], callback);
    }

    describe('local queries against online collection', function () {
        beforeEach(function (done) {
            installOnlineFixtures(function (err) {
                dump(err);
                if (err) done(err);
                Pouch.getPouch().query(function (doc) {
                    emit(doc._id, doc);
                }, function (err, resp) {
                    dump(JSON.stringify(resp.rows, null, 4));
                    done();
                })
            });
        });



        it('should return 3 users when run a local all query against users', function (done) {
            console.log('Testing: ', 'should return 3 users when run a local all query against users');
            myOnlineCollection.User.all(function (err, users) {
                if (err) done(err);
                assert.equal(users.length, 3);
                done();
            });
        });
//
//        it('should return 3 photos when run a local all query against photos', function (done) {
//            console.log('Testing: ', 'should return 3 photos when run a local all query against photos');
//            myOnlineCollection.Photo.all(function (err, photos) {
//                if (err) done(err);
//                assert.equal(photos.length, 3);
//                done();
//            });
//        });
    });

});