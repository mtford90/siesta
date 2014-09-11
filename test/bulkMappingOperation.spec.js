var s = require('../index')
    , assert = require('chai').assert;

describe('bulk mapping operation', function () {

    var Collection = require('../src/collection').Collection;
    var BulkMappingOperation = require('../src/mappingOperation').BulkMappingOperation;
    var Pouch = require('../src/pouch');
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

    it('xyz', function (done) {
        var data = [
            {name: 'Repo', full_name: 'A Big Repo', description: 'Blah', _id: 'sdfsd'},
            {name: 'Repo2', full_name: 'Another Big Repo', description: 'Blsdah', id: 'sdfsd'},
            {name: 'Repo3', full_name: 'Yet Another Big Repo', description: 'Blahasdasd'}
        ];
        var op = new BulkMappingOperation(Repo, data);
        var catagories = op._categoriseData();
        assert.include(catagories.localLookups, data[0]);
        assert.include(catagories.remoteLookups, data[1]);
        assert.include(catagories.newObjects, data[2]);
        done();
    });

    it('abc', function (done) {
        var data = [
            {name: 'Repo', full_name: 'A Big Repo', description: 'Blah'},
            {name: 'Repo2', full_name: 'Another Big Repo', description: 'Blsdah', id: 'sdfsd'},
            {name: 'Repo3', full_name: 'Yet Another Big Repo', description: 'Blahasdasd'}
        ];
        Repo.map(data, function (err, objs) {
            if (err) done(err);
            data[0]._id = objs[0]._id;
            var op = new BulkMappingOperation(Repo, data);
            op.onCompletion(function () {
                done();
            });
            op.start();
        });


    })

});