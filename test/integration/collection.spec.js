/**
 * An integration test that creates two complex collections and then establishes inter-collection relationships
 * between the mappings in each before creating objects etc.
 *
 * We then proceed to test various aspects of the system.
 */

describe('intercollection relationships', function () {

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

    it('xyz', function () {

    });

});