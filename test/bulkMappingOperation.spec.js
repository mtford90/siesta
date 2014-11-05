var chai = require('chai');
var s = require('../index'),
    assert = chai.assert;

var mappingOperation = require('../src/mappingOperation');
var BulkMappingOperation = mappingOperation.BulkMappingOperation;
var util = require('../src/util');
var _ = util._;

var RelationshipType = require('../src/relationship').RelationshipType;
var Collection = require('../src/collection').Collection;
var cache = require('../src/cache');
var collection;
var Repo, User;

assert.arrEqual = function(arr1, arr2) {
    if (!util.isArray(arr1)) throw new chai.AssertionError(arr1.toString() + ' is not an array');
    if (!util.isArray(arr2)) throw new chai.AssertionError(arr2.toString() + ' is not an array');
    _.each(_.zip(arr1, arr2), function(x) {
        if (util.isArray(x[0]) && util.isArray(x[1])) {
            assert.arrEqual(x[0], x[1]);
        } else if (x[0] != x[1]) {
            throw new chai.AssertionError(arr1.toString() + ' != ' + arr2.toString());
        }
    })
};

describe('array flattening', function() {
    describe('flatten', function() {
        it('mixture', function() {
            var flattened = mappingOperation.flattenArray(['1', ['2', '3'],
                ['4'], '5'
            ]);
            assert.arrEqual(['1', '2', '3', '4', '5'], flattened);
        });

        it('all arrays', function() {
            var flattened = mappingOperation.flattenArray([
                ['1'],
                ['2', '3'],
                ['4'],
                ['5']
            ]);
            assert.arrEqual(['1', '2', '3', '4', '5'], flattened);
        });

        it('no arrays', function() {
            var flattened = mappingOperation.flattenArray(['1', '2', '3', '4', '5']);
            assert.arrEqual(['1', '2', '3', '4', '5'], flattened);
        });
    });
    describe('unflatten', function() {
        it('mixture', function() {
            var unflattened = mappingOperation.unflattenArray(['a', 'b', 'c', 'd', 'e'], ['1', ['2', '3'],
                ['4'], '5'
            ]);
            assert.arrEqual(['a', ['b', 'c'],
                ['d'], 'e'
            ], unflattened);
        });
    });
});

describe('bulk mapping operation', function() {
    describe('general', function() {
        beforeEach(function(done) {
            s.reset(true);

            collection = new Collection('MyCollection');
            collection.baseURL = 'https://api.github.com';
            Repo = collection.mapping('Repo', {
                id: 'id',
                attributes: ['name', 'full_name', 'description'],
                relationships: {
                    owner: {
                        mapping: 'User',
                        type: RelationshipType.OneToMany,
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

        describe('errors', function() {

            describe('simple', function() {
                var op;

                beforeEach(function(done) {
                    var data = [{
                        login: 'mike',
                        id: '123',
                        repositories: 5 // Invalid
                    }, {
                        login: 'mike2',
                        id: '122315634',
                        repositories: [ // Valid
                            {
                                name: 'Repo'
                            }
                        ]
                    }, {
                        login: 'mike4',
                        id: '123124',
                        repositories: 'asdas' // Invalid
                    }, {
                        login: 'mike3',
                        id: '12324',
                        repositories: [ // Invalid
                            {
                                _id: 'nosuchlocalid'
                            }
                        ]
                    }];
                    op = new BulkMappingOperation({
                        mapping: User,
                        data: data
                    });
                    op.onCompletion(function() {
                        done();
                    });
                    op.start();

                });

                it('scalar int', function() {
                    assert.ok(op.error[0]);
                    assert.ok(op.error[0].repositories);
                });

                it('valid', function() {
                    assert.notOk(op.error[1]);
                });

                it('scalar string', function() {
                    assert.ok(op.error[2]);
                    assert.ok(op.error[2].repositories);
                });

                it('invalid _id', function() {
                    assert.ok(op.error[3]);
                    assert.ok(op.error[3].repositories);
                });

            });

            it('non-existent _id', function(done) {
                var data = [{
                    _id: 'nonexistant'
                }];

                var op = new BulkMappingOperation({
                    mapping: User,
                    data: data
                });
                op.onCompletion(function() {
                    assert.ok(op.error);
                    done();
                });
                op.start();
            });

            it('array to scalar', function(done) {
                var data = [{
                    owner: [5, 6]
                }];

                var op = new BulkMappingOperation({
                    mapping: Repo,
                    data: data
                });
                op.onCompletion(function() {
                    assert.ok(op.error);
                    done();
                });
                op.start();
            });

            it('scalar to array', function(done) {
                var data = [{
                    login: 'mike4',
                    id: '123124',
                    repositories: 5
                }];
                var op = new BulkMappingOperation({
                    mapping: User,
                    data: data
                });
                op.onCompletion(function() {
                    assert.ok(op.error);
                    done();
                });
                op.start();
            });


        });

        describe('new', function() {

            describe('foreign key', function() {

                describe('forward', function() {
                    it('sub operations', function() {
                        var owner = {
                            id: 6,
                            login: 'mike'
                        };
                        var data = [{
                            name: 'Repo',
                            full_name: 'A Big Repo',
                            description: 'Blah',
                            _id: 'sdfsd'
                        }, {
                            name: 'Repo2',
                            full_name: 'Another Big Repo',
                            description: 'Blsdah',
                            id: 'sdfsd',
                            owner: 5
                        }, {
                            name: 'Repo3',
                            full_name: 'Yet Another Big Repo',
                            description: 'Blahasdasd',
                            owner: owner
                        }];
                        var op = new BulkMappingOperation({
                            mapping: Repo,
                            data: data
                        });
                        op._constructSubOperations();
                        var ownerSubOperation = op.subOps.owner.op;
                        var ownerIndexes = op.subOps.owner.indexes;
                        assert.equal(ownerIndexes.length, 2);
                        assert.include(ownerIndexes, 1);
                        assert.include(ownerIndexes, 2);
                        assert.equal(ownerSubOperation.mapping, User);
                        assert.equal(ownerSubOperation.data[0], 5);
                        assert.equal(ownerSubOperation.data[1], owner);
                    });

                    it('none existing', function(done) {
                        var owner = {
                            id: 5,
                            login: 'mike'
                        };
                        var data = [{
                            name: 'Repo',
                            full_name: 'A Big Repo',
                            description: 'Blah',
                            id: 'remoteId1'
                        }, {
                            name: 'Repo2',
                            full_name: 'Another Big Repo',
                            description: 'Blsdah',
                            id: 'remoteId2',
                            owner: 5
                        }, {
                            name: 'Repo3',
                            full_name: 'Yet Another Big Repo',
                            description: 'Blahasdasd',
                            id: 'remoteId3',
                            owner: owner
                        }];
                        var op = new BulkMappingOperation({
                            mapping: Repo,
                            data: data
                        });
                        op.onCompletion(function() {
                            var err = op.error;
                            if (err) {
                                done(err);
                            }
                            var objects = this.objects;
                            var repo = objects[0];
                            var repo2 = objects[1];
                            var repo3 = objects[2];
                            // Check attributes have been mapped correctly.
                            assert.equal(repo.id, 'remoteId1');
                            assert.equal(repo.description, 'Blah');
                            assert.equal(repo.full_name, 'A Big Repo');
                            assert.equal(repo.name, 'Repo');
                            assert.equal(repo2.id, 'remoteId2');
                            assert.equal(repo2.description, 'Blsdah');
                            assert.equal(repo2.full_name, 'Another Big Repo');
                            assert.equal(repo2.name, 'Repo2');
                            assert.equal(repo3.id, 'remoteId3');
                            assert.equal(repo3.description, 'Blahasdasd');
                            assert.equal(repo3.full_name, 'Yet Another Big Repo');
                            assert.equal(repo3.name, 'Repo3');
                            // Check relationships have been mapped correctly.
                            assert.equal(repo2.owner, repo3.owner);
                            done();
                        });
                        op.start();
                    });

                });

                describe('reverse', function() {
                    it('none existing', function(done) {
                        var data = [{
                            login: 'mike',
                            id: '123',
                            repositories: [{
                                id: 5,
                                name: 'Repo',
                                full_name: 'A Big Repo'
                            }]
                        }];
                        var op = new BulkMappingOperation({
                            mapping: User,
                            data: data
                        });
                        op.onCompletion(function() {
                            if (op.error) {
                                console.error(JSON.stringify(op.error, null, 4));
                                done(op.error);
                            }
                            var objects = op.result;
                            assert.equal(objects.length, 1);
                            var obj = objects[0];
                            assert.equal(obj.login, 'mike');
                            assert.equal(obj.id, '123');
                            assert.equal(obj.repositories.length, 1);
                            var repo = obj.repositories[0];
                            assert.equal(repo.id, 5);
                            assert.equal(repo.name, 'Repo');
                            assert.equal(repo.full_name, 'A Big Repo');
                            assert.equal(repo.owner, obj);
                            done();
                        });
                        op.start();
                    });

                    it('existing', function(done) {
                        var repo = Repo._new({
                            id: '5',
                            name: 'Old Name',
                            full_name: 'Old Full Name',
                            collection: 'MyCollection',
                            type: 'Repo'
                        });
                        cache.insert(repo);
                        var data = [{
                            login: 'mike',
                            id: '123',
                            repositories: [{
                                id: '5',
                                name: 'Repo',
                                full_name: 'A Big Repo'
                            }]
                        }];
                        var op = new BulkMappingOperation({
                            mapping: User,
                            data: data
                        });
                        op.onCompletion(function() {
                            if (op.error) {
                                done(op.error);
                            } else {
                                var objects = op.result;
                                try {
                                    assert.equal(objects.length, 1);
                                    var obj = objects[0];
                                    assert.equal(obj.login, 'mike');
                                    assert.equal(obj.id, '123');
                                    assert.equal(obj.repositories.length, 1);
                                    var repo = obj.repositories[0];
                                    assert.equal(repo.id, 5);
                                    assert.equal(repo.name, 'Repo');
                                    assert.equal(repo.full_name, 'A Big Repo');
                                    assert.equal(repo.owner, obj);
                                    done();
                                } catch (err) {
                                    done(err);
                                }
                            }
                        });
                        op.start();

                    })
                });

            });

            describe('no relationships', function() {
                var op;

                describe('none existing', function() {
                    beforeEach(function() {
                        var data = [{
                            login: 'mike',
                            id: '123'
                        }, {
                            login: 'bob',
                            id: '1234'
                        }];
                        op = new BulkMappingOperation({
                            mapping: User,
                            data: data
                        });
                    });

                    it('lookup', function(done) {
                        op._lookup(function() {
                            assert.equal(op.objects.length, 2);
                            assert.notOk(op.objects[0].login);
                            assert.notOk(op.objects[1].login);
                            done();
                        });
                    });

                    it('completion', function(done) {
                        op.onCompletion(function() {
                            var objects = op.result;
                            assert.equal(objects.length, 2);
                            var mike = objects[0];
                            var bob = objects[1];
                            assert.equal(mike.login, 'mike');
                            assert.equal(mike.id, '123');
                            assert.equal(bob.login, 'bob');
                            assert.equal(bob.id, '1234');
                            done();
                        });
                        op.start();
                    });

                });


            });
        });
    });

    describe('singleton...', function() {
        var op;

        beforeEach(function(done) {
            s.reset(true);

            collection = new Collection('MyCollection');
            collection.baseURL = 'https://api.github.com';
            Repo = collection.mapping('Repo', {
                id: 'id',
                attributes: ['name', 'full_name', 'description'],
                relationships: {
                    owner: {
                        mapping: 'User',
                        type: RelationshipType.OneToMany,
                        reverse: 'repositories'
                    }
                }
            });
            User = collection.mapping('User', {
                id: 'id',
                attributes: ['login'],
                singleton: true
            });
            collection.install(done);
        });

        describe('new', function() {
            beforeEach(function() {
                var data = [{
                    login: 'mike',
                    id: '123'
                }, {
                    login: 'bob',
                    id: '1234'
                }];
                op = new BulkMappingOperation({
                    mapping: User,
                    data: data
                });
            });

            it('lookupSingleton', function(done) {
                op._lookupSingleton(function(err) {
                    if (!err) {
                        assert.equal(op.objects.length, 2);
                        assert.equal(op.objects[0], op.objects[1]);
                    }
                    done(err);
                });
            });

            it('map', function(done) {
                op.onCompletion(function() {
                    var err = op.error;
                    if (!err) {
                        assert.equal(op.objects.length, 2);
                        assert.equal(op.objects[0], op.objects[1]);
                        assert.equal(op.objects[0].login, 'bob');
                        assert.equal(op.objects[0].id, '1234');
                    }
                    done(err);
                });
                op.start();
            });
        });

        describe('existing, cached', function() {
            var obj;

            beforeEach(function() {
                obj = User._new({
                    id: '567'
                });
                var data = [{
                    login: 'mike',
                    id: '123'
                }, {
                    login: 'bob',
                    id: '1234'
                }];
                op = new BulkMappingOperation({
                    mapping: User,
                    data: data
                });
            });

            it('lookupSingleton', function(done) {
                op._lookupSingleton(function(err) {
                    if (!err) {
                        assert.equal(op.objects.length, 2);
                        assert.equal(op.objects[0], obj);
                        assert.equal(op.objects[0], op.objects[1]);
                    }
                    done(err);
                });
            });

            it('map', function(done) {
                op.onCompletion(function() {
                    var err = op.error;
                    if (!err) {
                        assert.equal(op.objects.length, 2);
                        assert.equal(op.objects[0], obj);
                        assert.equal(op.objects[0], op.objects[1]);
                        assert.equal(op.objects[0].login, 'bob');
                        assert.equal(op.objects[0].id, '1234');
                    }
                    done(err);
                });
                op.start();
            });
        });

    });

});

describe('bug', function() {

    var coll, Car;

    beforeEach(function(done) {
        siesta.reset(true);
        coll = new Collection('myCollection');
        Car = coll.mapping('Car', {
            id: 'id',
            attributes: ['colour', 'name']

        });
        coll.install(done);
    });

    it('multiple objects', function(done) {
        var data = [{
            colour: 'red',
            name: 'Aston Martin',
            id: '1'
        }, {
            colour: 'blue',
            name: 'Bentley',
            id: '2'
        }, {
            colour: 'green',
            name: 'Lambo',
            id: '3'
        }];
        Car.map(data, function(err) {
            if (err) done(err);
            Car.map(data, function(err) {
                if (err) done(err);
                // TODO
                done();
            });
        });
    });
});