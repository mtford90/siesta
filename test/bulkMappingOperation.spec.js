var chai = require('chai');
var s = require('../index')
    , assert = chai.assert;

var mappingOperation = require('../src/mappingOperation');
var BulkMappingOperation = mappingOperation.BulkMappingOperation;
var util = require('../src/util');

assert.arrEqual = function (arr1, arr2) {
    if (!util.isArray(arr1)) throw new chai.AssertionError(arr1.toString() + ' is not an array');
    if (!util.isArray(arr2)) throw new chai.AssertionError(arr2.toString() + ' is not an array');
    _.chain(arr1).zip(arr2).each(function (x) {
        if (util.isArray(x[0]) && util.isArray(x[1])) {
            assert.arrEqual(x[0], x[1]);
        }
        else if (x[0]!=x[1]) {
            throw new chai.AssertionError(arr1.toString() + ' != ' + arr2.toString());
        }
    });
};

describe.only('array flattening', function () {
    describe('flatten', function () {
        it('mixture', function () {
            var flattened = mappingOperation.flattenArray(['1', ['2', '3'], ['4'], '5']);
            assert.arrEqual(['1', '2', '3', '4', '5'], flattened);
        });

        it('all arrays', function () {
            var flattened = mappingOperation.flattenArray([['1'], ['2', '3'], ['4'], ['5']]);
            assert.arrEqual(['1', '2', '3', '4', '5'], flattened);
        });

        it('no arrays', function () {
            var flattened = mappingOperation.flattenArray(['1', '2', '3', '4', '5']);
            assert.arrEqual(['1', '2', '3', '4', '5'], flattened);
        });
    });
    describe('unflatten', function () {
        it('mixture', function () {
            var unflattened = mappingOperation.unflattenArray(['a', 'b', 'c', 'd', 'e'], ['1', ['2', '3'], ['4'], '5']);
            assert.arrEqual(['a', ['b', 'c'], ['d'], 'e'], unflattened);
        });
    });
});

describe('bulk mapping operation', function () {

    var Collection = require('../src/collection').Collection;
    var Pouch = require('../src/pouch');
    var cache = require('../src/cache');
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
    });


    describe('errors', function () {
        // TODO: Errors wtihin arrays of arrays. Need to unflatten errors?

        it('simple', function (done) {
            var data = [
                {
                    login: 'mike',
                    id: '123',
                    repositories: 5 // Invalid
                },
                {
                    login: 'mike2',
                    id: '122315634',
                    repositories: [ // Valid
                        {name: 'Repo'}
                    ]
                },
                {
                    login: 'mike4',
                    id: '123124',
                    repositories: 'asdas' // Invalid
                },
                {
                    login: 'mike3',
                    id: '12324',
                    repositories: [ // Invalid
                        {_id: 'nosuchlocalid'}
                    ]
                }
            ];

            var op = new BulkMappingOperation(User, data);
            op.onCompletion(function () {
                assert.ok(op.error[0]);
                assert.notOk(op.error[1]);
                assert.ok(op.error[2]);
                assert.ok(op.error[3]);
                assert.ok(op.error[0].repositories);
                assert.ok(op.error[2].repositories);
                assert.ok(op.error[3].repositories);
                done();
            });
            op.start();
        });

        it('non-existent _id', function (done) {
            var data = [
                {
                    _id: 'nonexistant'
                }
            ];

            var op = new BulkMappingOperation(User, data);
            op.onCompletion(function () {
                assert.ok(op.error);
                done();
            });
            op.start();
        });

        it('array to scalar', function (done) {
            var data = [
                {
                    owner: [5, 6]
                }
            ];

            var op = new BulkMappingOperation(Repo, data);
            op.onCompletion(function () {
                assert.ok(op.error);
                done();
            });
            op.start();
        });

        it('array of array', function (done) {
            var data = [
                {
                    login: 'mike2',
                    id: '122315634',
                    repositories: [ // Valid
                        {name: 'Repo'}
                    ]
                },
                [
                    {
                        login: 'mike3',
                        id: '12324sdf',
                        repositories: [ // Invalid
                            {_id: 'nosuchlocalid'}
                        ]
                    },
                    {
                        login: 'mike5',
                        id: '12324',
                        repositories: [ // Invalid
                            {_id: 'andanotherinvalid _id'}
                        ]
                    }
                ]
            ];

            var op = new BulkMappingOperation(User, data);
            op.onCompletion(function () {
                assert.notOk(op.error[0]);
                assert.ok(op.error[1]);
                var subError = op.error[1][0];
                assert.ok(subError);
                done();
            });
            op.start();
        });

        it('wtf', function (done) {
            var data = [
                [{name: 'Repo'}],
                [{_id: 'nosuchlocalid'}]
            ];

            var op = new BulkMappingOperation(Repo, data);
            op.onCompletion(function () {
                assert.equal(op.error.length, 2);
                assert.equal(op.error[0].length, 1);
                assert.notOk(op.error[0][0]);
                assert.equal(op.error[1].length, 1);
                assert.ok(op.error[1][0]);
                done();
            });
            op.start();
        });

    });

    describe('new', function () {


        describe('array of array', function () {
            it('array of array', function (done) {
                var data = [
                    [
                        {name: 'Repo', full_name: 'A Big Repo', description: 'Blah'},
                        {name: 'Repo2', full_name: 'Another Big Repo', description: 'Blsdah'}
                    ],
                    [
                        {name: 'Repo3', full_name: 'Yet Another Big Repo', description: 'Blahasdasd'}
                    ]
                ];
                var op = new BulkMappingOperation(Repo, data);
                op.onCompletion(function () {
                    var objects = op.result;
                    assert.notEqual(objects[0][0], objects[0][1]);
                    assert.notEqual(objects[0][1], objects[1][0]);
                    done();
                });
                op.start();
            });


            it('duplicates', function (done) {
                var data = [
                    [
                        {name: 'Repo', full_name: 'A Big Repo', description: 'Blah', id: 2},
                        {name: 'Repo2', full_name: 'Another Big Repo', description: 'Blsdah'}
                    ],
                    [
                        {name: 'Repo3', id: 2}
                    ]
                ];
                var op = new BulkMappingOperation(Repo, data);
                var ops = op._constructSubOperations();
                for (var prop in ops) {
                    if (ops.hasOwnProperty(prop)) {
                        assert.fail('should be no suboperations ' + prop);
                    }
                }
                op.onCompletion(function () {
                    var objects = op.result;

                    assert.equal(objects[0][0].name, 'Repo3');
                    assert.equal(objects[0][0].full_name, 'A Big Repo');
                    assert.equal(objects[0][0].description, 'Blah');
                    assert.equal(objects[0][0].id, 2);

                    assert.equal(objects[0][1].name, 'Repo2');
                    assert.equal(objects[0][1].full_name, 'Another Big Repo');
                    assert.equal(objects[0][1].description, 'Blsdah');
                    assert.notOk(objects[0][1].id);


                    assert.notEqual(objects[0][0], objects[0][1]);
                    assert.equal(objects[0][0], objects[1][0]);

                    done();
                });
                op.start();
            });

            it('relationship', function (done) {
                var data = [
                    [
                        {name: 'Repo', full_name: 'A Big Repo', description: 'Blah', owner: 5},
                        {name: 'Repo2', full_name: 'Another Big Repo', description: 'Blsdah', owner: {id: 1, login: 'bob'}}
                    ],
                    [
                        {name: 'Repo3', full_name: 'Yet Another Big Repo', description: 'Blahasdasd', owner: {id: 5, login: 'mike'}}
                    ]
                ];
                var op = new BulkMappingOperation(Repo, data);
                op.onCompletion(function () {
                    var objects = op.result;
                    assert.equal(objects[0][0].owner, objects[1][0].owner);
                    assert.notEqual(objects[0][0], objects[0][1]);
                    assert.notEqual(objects[0][1], objects[1][0]);
                    done();
                });
                op.start();
            });

            it('mixed', function (done) {
                var data = [
                    [
                        {name: 'Repo', full_name: 'A Big Repo', description: 'Blah', owner: 5},
                        {name: 'Repo2', full_name: 'Another Big Repo', description: 'Blsdah', owner: {id: 1, login: 'bob'}}
                    ],
                    {name: 'Repo3', full_name: 'Yet Another Big Repo', description: 'Blahasdasd', owner: {id: 5, login: 'mike'}}
                ];
                var op = new BulkMappingOperation(Repo, data);
                op.onCompletion(function () {
                    var objects = op.result;
                    assert.equal(objects[0][0].owner, objects[1].owner);
                    assert.notEqual(objects[0][0], objects[0][1]);
                    assert.notEqual(objects[0][1], objects[1]);
                    done();
                });
                op.start();
            })

        });

        describe('foreign key', function () {

            describe('forward', function () {
                it('sub operations', function () {
                    var owner = {id: 6, login: 'mike'};
                    var data = [
                        {name: 'Repo', full_name: 'A Big Repo', description: 'Blah', _id: 'sdfsd'},
                        {name: 'Repo2', full_name: 'Another Big Repo', description: 'Blsdah', id: 'sdfsd', owner: 5},
                        {name: 'Repo3', full_name: 'Yet Another Big Repo', description: 'Blahasdasd', owner: owner}
                    ];
                    var op = new BulkMappingOperation(Repo, data);
                    var suboperations = op._constructSubOperations();
                    assert.ok(suboperations.owner);
                    assert.equal(suboperations.owner.data[0], 5);
                    assert.equal(suboperations.owner.data[1], owner);
                    assert.include(suboperations.owner.__indexes, 1);
                    assert.include(suboperations.owner.__indexes, 2);
                    assert.notInclude(suboperations.owner.__indexes, 0);
                    assert.equal(suboperations.owner.__relationshipName, 'owner');
                });

                it('none existing', function (done) {
                    var owner = {id: 5, login: 'mike'};
                    var data = [
                        {name: 'Repo', full_name: 'A Big Repo', description: 'Blah', id: 'remoteId1'},
                        {name: 'Repo2', full_name: 'Another Big Repo', description: 'Blsdah', id: 'remoteId2', owner: 5},
                        {name: 'Repo3', full_name: 'Yet Another Big Repo', description: 'Blahasdasd', id: 'remoteId3', owner: owner}
                    ];
                    var op = new BulkMappingOperation(Repo, data);
                    op.onCompletion(function () {
                        var err = op.error;
                        if (err) done(err);
                        var objects = this.result;
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

            describe('reverse', function () {
                it('none existing', function (done) {
                    var data = [
                        {
                            login: 'mike',
                            id: '123',
                            repositories: [
                                {id: 5, name: 'Repo', full_name: 'A Big Repo'}
                            ]
                        }
                    ];
                    var op = new BulkMappingOperation(User, data);
                    op.onCompletion(function () {
                        if (op.error) {
                            done(error);
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

                it('existing', function (done) {
                    Pouch.getPouch().post({
                        id: '5',
                        name: 'Old Name',
                        full_name: 'Old Full Name',
                        collection: 'MyCollection',
                        type: 'Repo'
                    }, function (err, resp) {
                        if (err) {
                            done(err);
                        }
                        else {
                            var data = [
                                {
                                    login: 'mike',
                                    id: '123',
                                    repositories: [
                                        {id: '5', name: 'Repo', full_name: 'A Big Repo'}
                                    ]
                                }
                            ];
                            var op = new BulkMappingOperation(User, data);
                            op.onCompletion(function () {
                                if (op.error) {
                                    done(op.error);
                                }
                                else {
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
                                        assert.equal(repo._id, resp.id);
                                        assert.equal(repo.owner, obj);
                                        done();
                                    }
                                    catch (err) {
                                        done(err);
                                    }
                                }

                            });
                            op.start();
                        }

                    })
                })
            });

        });

        describe('no relationships', function () {
            it('none existing', function (done) {
                var data = [
                    {login: 'mike', id: '123'},
                    {login: 'bob', id: '1234'}
                ];
                var op = new BulkMappingOperation(User, data);
                op.onCompletion(function () {
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