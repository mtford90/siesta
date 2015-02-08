var assert = require('chai').assert,
    util = siesta._internal.util,
    RelationshipType = siesta.RelationshipType,
    cache = siesta._internal.cache,
    MappingOperation = siesta._internal.MappingOperation;

var collection;
var Repo, User;

assert.arrEqual = function (arr1, arr2) {
    if (!util.isArray(arr1)) throw new chai.AssertionError(arr1.toString() + ' is not an array');
    if (!util.isArray(arr2)) throw new chai.AssertionError(arr2.toString() + ' is not an array');
    _.each(_.zip(arr1, arr2), function (x) {
        if (util.isArray(x[0]) && util.isArray(x[1])) {
            assert.arrEqual(x[0], x[1]);
        } else if (x[0] != x[1]) {
            throw new chai.AssertionError(arr1.toString() + ' != ' + arr2.toString());
        }
    })
};

describe('array flattening', function () {
    describe('flatten', function () {
        it('mixture', function () {
            var flattened = util.flattenArray(['1', ['2', '3'],
                ['4'], '5'
            ]);
            assert.arrEqual(['1', '2', '3', '4', '5'], flattened);
        });

        it('all arrays', function () {
            var flattened = util.flattenArray([
                ['1'],
                ['2', '3'],
                ['4'],
                ['5']
            ]);
            assert.arrEqual(['1', '2', '3', '4', '5'], flattened);
        });

        it('no arrays', function () {
            var flattened = util.flattenArray(['1', '2', '3', '4', '5']);
            assert.arrEqual(['1', '2', '3', '4', '5'], flattened);
        });
    });
    describe('unflatten', function () {
        it('mixture', function () {
            var unflattened = util.unflattenArray(['a', 'b', 'c', 'd', 'e'], ['1', ['2', '3'],
                ['4'], '5'
            ]);
            assert.arrEqual(['a', ['b', 'c'],
                ['d'], 'e'
            ], unflattened);
        });
    });
});

describe('mapping operation', function () {
    before(function () {
        siesta.ext.storageEnabled = false;
    });
    describe('general', function () {
        beforeEach(function (done) {
            siesta.reset(function () {
                collection = siesta.collection('MyCollection');
                Repo = collection.model('Repo', {
                    id: 'id',
                    attributes: ['name', 'full_name', 'description'],
                    relationships: {
                        owner: {
                            model: 'User',
                            type: RelationshipType.OneToMany,
                            reverse: 'repositories'
                        }
                    }
                });
                User = collection.model('User', {
                    id: 'id',
                    attributes: ['login']
                });
                siesta.install(done);
            });
        });

        describe('errors', function () {

            describe('simple', function () {
                var op;

                beforeEach(function (done) {
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
                    op = new MappingOperation({
                        model: User,
                        data: data
                    });
                    op.start(function () {
                        done();
                    });

                });

                it('scalar int', function () {
                    assert.ok(op.errors[0]);
                    assert.ok(op.errors[0].repositories);
                });

                it('valid', function () {
                    assert.notOk(op.errors[1]);
                });

                it('scalar string', function () {
                    assert.ok(op.errors[2]);
                    assert.ok(op.errors[2].repositories);
                });


            });


            it('array to scalar', function (done) {
                var data = [{
                    owner: [5, 6]
                }];

                var op = new MappingOperation({
                    model: Repo,
                    data: data
                });
                op.start(function (errors) {
                    assert.ok(errors);
                    done();
                });
            });

            it('scalar to array', function (done) {
                var data = [{
                    login: 'mike4',
                    id: '123124',
                    repositories: 5
                }];
                var op = new MappingOperation({
                    model: User,
                    data: data
                });
                op.start(function (errors) {
                    assert.ok(errors);
                    done();
                });
            });


        });

        describe('new', function () {

            describe('foreign key', function () {

                describe('forward', function () {

                    it('none existing', function (done) {
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
                        var op = new MappingOperation({
                            model: Repo,
                            data: data
                        });

                        op.start(function (errors, objects) {
                            if (errors) {
                                done(errors);
                            }
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
                    });

                });

                describe('reverse', function () {
                    it('none existing', function (done) {
                        var data = [{
                            login: 'mike',
                            id: '123',
                            repositories: [{
                                id: 5,
                                name: 'Repo',
                                full_name: 'A Big Repo'
                            }]
                        }];
                        var op = new MappingOperation({
                            model: User,
                            data: data
                        });
                        op.start(function (errors, objects) {
                            if (errors) {
                                console.error(JSON.stringify(errors, null, 4));
                                done(errors);
                            }
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
                    });

                    it('existing', function (done) {
                        var repo = Repo._new({
                            id: '5',
                            name: 'Old Name',
                            full_name: 'Old Full Name'
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
                        var op = new MappingOperation({
                            model: User,
                            data: data
                        });
                        op.start(function (errors, objects) {
                            if (errors) {
                                done(errors);
                            } else {
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

                    })
                });

            });

            describe('no relationships', function () {
                var op;

                describe('none existing', function () {
                    beforeEach(function () {
                        var data = [{
                            login: 'mike',
                            id: '123'
                        }, {
                            login: 'bob',
                            id: '1234'
                        }];
                        op = new MappingOperation({
                            model: User,
                            data: data
                        });
                    });

                    it('lookup', function (done) {
                        op._lookup(function () {
                            assert.equal(op.objects.length, 2);
                            assert.notOk(op.objects[0].login);
                            assert.notOk(op.objects[1].login);
                            done();
                        });
                    });

                    it('completion', function (done) {
                        op.start(function (errors, objects) {
                            if (errors) {
                                done(errors);
                            }
                            else {
                                assert.equal(objects.length, 2);
                                var mike = objects[0];
                                var bob = objects[1];
                                assert.equal(mike.login, 'mike');
                                assert.equal(mike.id, '123');
                                assert.equal(bob.login, 'bob');
                                assert.equal(bob.id, '1234');
                                done();
                            }
                        });
                    });

                });


            });
        });
    });

    describe('singleton...', function () {
        var op;

        beforeEach(function (done) {
            siesta.reset(function () {
                collection = siesta.collection('MyCollection');
                Repo = collection.model('Repo', {
                    id: 'id',
                    attributes: ['name', 'full_name', 'description'],
                    relationships: {
                        owner: {
                            model: 'User',
                            type: RelationshipType.OneToOne,
                            reverse: 'repositories'
                        }
                    }
                });
                User = collection.model('User', {
                    id: 'id',
                    attributes: ['login'],
                    singleton: true
                });
                siesta.install(done);
            });
        });

        describe('new', function () {
            beforeEach(function () {
                var data = [{
                    login: 'mike',
                    id: '123'
                }, {
                    login: 'bob',
                    id: '1234'
                }];
                op = new MappingOperation({
                    model: User,
                    data: data
                });
            });

            it('lookupSingleton', function (done) {
                op._lookupSingleton(function (err) {
                    if (!err) {
                        assert.equal(op.objects.length, 2);
                        assert.equal(op.objects[0], op.objects[1]);
                    }
                    done(err);
                });
            });

            it('map', function (done) {
                op.start(function (errors, objects) {
                    if (!errors) {
                        assert.equal(objects.length, 2);
                        assert.equal(objects[0], objects[1]);
                        assert.equal(objects[0].login, 'bob');
                        assert.equal(objects[0].id, '1234');
                    }
                    done(errors);
                });
            });
        });

        describe('existing, cached', function () {
            var obj;

            beforeEach(function (done) {
                var data = [{
                    login: 'mike',
                    id: '123'
                }, {
                    login: 'bob',
                    id: '1234'
                }];
                op = new MappingOperation({
                    model: User,
                    data: data
                });
                User.one().then(function (user) {
                    obj = user;
                    done();
                }).catch(done);
            });

            it('lookupSingleton', function (done) {
                op._lookupSingleton(function (err) {
                    if (!err) {
                        assert.equal(op.objects.length, 2);
                        assert.equal(op.objects[0], obj);
                        assert.equal(op.objects[0], op.objects[1]);
                    }
                    done(err);
                });
            });

            it('map', function (done) {
                op.start(function (errors, objects) {
                    if (!errors) {
                        assert.equal(objects.length, 2);
                        assert.equal(objects[0], obj);
                        assert.equal(objects[0], objects[1]);
                        assert.equal(objects[0].login, 'bob');
                        assert.equal(objects[0].id, '1234');
                    }
                    done(errors);
                });
            });
        });

    });

});

describe('bug', function () {

    var coll, Car;

    before(function () {
        siesta.ext.storageEnabled = false;
    });

    beforeEach(function (done) {
        siesta.reset(function () {
            coll = siesta.collection('myCollection');
            Car = coll.model('Car', {
                id: 'id',
                attributes: ['colour', 'name']

            });
            siesta.install(done);
        });

    });

    it('multiple objects', function (done) {
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
        Car.graph(data, function (err) {
            if (err) done(err);
            Car.graph(data, function (err) {
                if (err) done(err);
                // TODO
                done();
            });
        });
    });
});