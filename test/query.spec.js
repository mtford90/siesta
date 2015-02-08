var assert = require('chai').assert,
    internal = siesta._internal,
    Query = internal.Query;

describe('query...', function () {
    before(function () {
        siesta.ext.storageEnabled = false;
    });
    beforeEach(function (done) {
        siesta.reset(done);
    });

    describe('basic', function () {
        var Collection, Mapping;

        beforeEach(function () {
            Collection = siesta.collection('myCollection');
            Mapping = Collection.model('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });
        });
        it('object exists', function (done) {
            Mapping.graph({
                name: 'Michael',
                age: 15
            }, function (err, obj) {
                if (err) done(err);
                else {
                    assert.ok(obj);
                    var q = new Query(Mapping, {
                        age: 15
                    });
                    q.execute(function (err, objs) {
                        if (err) done(err);
                        assert.equal(objs.length, 1);
                        assert.equal(objs[0], obj);
                        done();
                    });
                }
            });
        });

        it('object does not exist', function (done) {
            Mapping.graph({
                name: 'Michael',
                age: 21
            }, function (err, obj) {
                if (err) done(err);
                else {
                    assert.ok(obj);
                    var q = new Query(Mapping, {
                        age: 15
                    });
                    q.execute(function (err, objs) {
                        if (err) done(err);
                        assert.equal(objs.length, 0);
                        done();
                    });
                }
            });
        });

        it('multiple matches', function (done) {
            Mapping.graph([
                {
                    name: 'Michael',
                    age: 21
                },
                {
                    name: 'Bob',
                    age: 21
                }
            ], function (err, mapped) {
                if (err) done(err);
                else {
                    assert.ok(mapped);
                    var q = new Query(Mapping, {
                        age: 21
                    });
                    q.execute(function (err, objs) {
                        if (err) done(err);
                        assert.equal(objs.length, 2);
                        assert.include(objs, mapped[0]);
                        assert.include(objs, mapped[1]);
                        done();
                    });
                }
            });
        });
    });

    describe('built-in comparators', function () {
        describe('e', function () {
            var collection, Person, Car;

            beforeEach(function () {
                collection = siesta.collection('myCollection');
                Person = collection.model('Person', {
                    id: 'id',
                    attributes: ['name', 'age']
                });
                Car = collection.model('Car', {
                    id: 'id',
                    attributes: ['colour', 'name'],
                    relationships: {
                        owner: {
                            type: 'OneToMany',
                            model: 'Person',
                            reverse: 'cars'
                        }
                    }
                });
            });

            describe('attributes', function () {
                it('matches', function (done) {
                    Person.graph([
                        {
                            name: 'Michael',
                            age: 21
                        },
                        {
                            name: 'Bob',
                            age: 21
                        }
                    ], function (err, mapped) {
                        if (err) done(err);
                        else {
                            assert.ok(mapped);
                            var q = new Query(Person, {
                                age__e: 21
                            });
                            q.execute(function (err, objs) {
                                if (err) done(err);
                                assert.equal(objs.length, 2);
                                assert.include(objs, mapped[0]);
                                assert.include(objs, mapped[1]);
                                done();
                            });
                        }
                    });
                });

                it('no matches', function (done) {
                    Person.graph([
                        {
                            name: 'Michael',
                            age: 21
                        },
                        {
                            name: 'Bob',
                            age: 21
                        }
                    ], function (err, mapped) {
                        if (err) done(err);
                        else {
                            assert.ok(mapped);
                            var q = new Query(Person, {
                                age__e: 23
                            });
                            q.execute(function (err, objs) {
                                if (err) done(err);
                                assert.notOk(objs.length);
                                done();
                            });
                        }
                    });
                });
            });

            describe('relationships', function () {
                it('model', function (done) {
                    Person.graph({
                        name: 'Michael',
                        age: 21
                    }, function (err, person) {
                        assert.ok(person, 'should return a person');
                        if (err) done(err);
                        Car.graph({
                            colour: 'red',
                            name: 'Aston Martin',
                            owner: person
                        }, function (err, car) {
                            if (err) done(err);
                            else {
                                assert.equal(car.owner, person);
                                var q = new Query(Car, {
                                    owner__e: person
                                });
                                q.execute().then(function (objs) {
                                    assert.ok(objs.length);
                                    done();
                                }).catch(done);
                            }
                        });
                    });
                });
            });
        });

        describe('lt', function () {
            var Collection, Person;

            beforeEach(function () {
                Collection = siesta.collection('myCollection');
                Person = Collection.model('Person', {
                    id: 'id',
                    attributes: ['name', 'age']
                });
            });

            it('null shouldnt match', function (done) {
                Person.graph([
                    {
                        name: 'Michael',
                        age: null
                    },
                    {
                        name: 'Bob',
                        age: 21
                    }
                ], function (err, mapped) {
                    if (err) done(err);
                    else {
                        assert.ok(mapped);
                        var q = new Query(Person, {
                            age__lt: 22
                        });
                        q.execute(function (err, objs) {
                            if (err) done(err);
                            assert.equal(objs.length, 1);
                            assert.include(objs, mapped[1]);
                            done();
                        });
                    }
                });
            });

            it('undefined shouldnt match', function (done) {
                Person.graph([
                    {
                        name: 'Michael',
                        age: undefined
                    },
                    {
                        name: 'Bob',
                        age: 21
                    }
                ], function (err, mapped) {
                    if (err) done(err);
                    else {
                        assert.ok(mapped);
                        var q = new Query(Person, {
                            age__lt: 22
                        });
                        q.execute(function (err, objs) {
                            if (err) done(err);
                            assert.equal(objs.length, 1);
                            assert.include(objs, mapped[1]);
                            done();
                        });
                    }
                });
            });

            it('matches all', function (done) {
                Person.graph([
                    {
                        name: 'Michael',
                        age: 21
                    },
                    {
                        name: 'Bob',
                        age: 21
                    }
                ], function (err, mapped) {
                    if (err) done(err);
                    else {
                        assert.ok(mapped);
                        var q = new Query(Person, {
                            age__lt: 22
                        });
                        q.execute(function (err, objs) {
                            if (err) done(err);
                            assert.equal(objs.length, 2);
                            assert.include(objs, mapped[0]);
                            assert.include(objs, mapped[1]);
                            done();
                        });
                    }
                });
            });

            it('matches some', function (done) {
                Person.graph([
                    {
                        name: 'Michael',
                        age: 21
                    },
                    {
                        name: 'Bob',
                        age: 22
                    }
                ], function (err, mapped) {
                    if (err) done(err);
                    else {
                        assert.ok(mapped);
                        var q = new Query(Person, {
                            age__lt: 22
                        });
                        q.execute(function (err, objs) {
                            if (err) done(err);
                            assert.equal(objs.length, 1);
                            assert.include(objs, mapped[0]);
                            done();
                        });
                    }
                });
            });

            it('no matches', function (done) {
                Person.graph([
                    {
                        name: 'Michael',
                        age: 21
                    },
                    {
                        name: 'Bob',
                        age: 21
                    }
                ], function (err, mapped) {
                    if (err) done(err);
                    else {
                        assert.ok(mapped);
                        var q = new Query(Person, {
                            age__lt: 21
                        });
                        q.execute(function (err, objs) {
                            if (err) done(err);
                            assert.notOk(objs.length);
                            done();
                        });
                    }
                });
            });
        });

        describe('lte', function () {
            var collection, Person;

            beforeEach(function () {
                collection = siesta.collection('myCollection');
                Person = collection.model('Person', {
                    id: 'id',
                    attributes: ['name', 'age']
                });
            });

            it('matches all', function (done) {
                Person.graph([
                    {
                        name: 'Michael',
                        age: 21
                    },
                    {
                        name: 'Bob',
                        age: 21
                    }
                ], function (err, mapped) {
                    if (err) done(err);
                    else {
                        assert.ok(mapped);
                        var q = new Query(Person, {
                            age__lte: 21
                        });
                        q.execute(function (err, objs) {
                            if (err) done(err);
                            assert.equal(objs.length, 2);
                            assert.include(objs, mapped[0]);
                            assert.include(objs, mapped[1]);
                            done();
                        });
                    }
                });
            });

            it('matches some', function (done) {
                Person.graph([
                    {
                        name: 'Michael',
                        age: 21
                    },
                    {
                        name: 'Bob',
                        age: 22
                    },
                    {
                        name: 'John',
                        age: 23
                    }
                ], function (err, mapped) {
                    if (err) done(err);
                    else {
                        assert.ok(mapped);
                        var q = new Query(Person, {
                            age__lte: 22
                        });
                        q.execute(function (err, objs) {
                            if (err) done(err);
                            assert.equal(objs.length, 2);
                            assert.include(objs, mapped[0]);
                            assert.include(objs, mapped[1]);
                            done();
                        });
                    }
                });
            });

            it('no matches', function (done) {
                Person.graph([
                    {
                        name: 'Michael',
                        age: 21
                    },
                    {
                        name: 'Bob',
                        age: 21
                    }
                ], function (err, mapped) {
                    if (err) done(err);
                    else {
                        assert.ok(mapped);
                        var q = new Query(Person, {
                            age__lte: 20
                        });
                        q.execute(function (err, objs) {
                            if (err) done(err);
                            assert.notOk(objs.length);
                            done();
                        });
                    }
                });
            });
        });

        describe('gt', function () {
            var collection, Person;

            beforeEach(function () {
                collection = siesta.collection('myCollection');
                Person = collection.model('Person', {
                    id: 'id',
                    attributes: ['name', 'age']
                });
            });

            it('matches all', function (done) {
                Person.graph([
                    {
                        name: 'Michael',
                        age: 21
                    },
                    {
                        name: 'Bob',
                        age: 21
                    }
                ], function (err, mapped) {
                    if (err) done(err);
                    else {
                        assert.ok(mapped);
                        var q = new Query(Person, {
                            age__gt: 20
                        });
                        q.execute(function (err, objs) {
                            if (err) done(err);
                            assert.equal(objs.length, 2);
                            assert.include(objs, mapped[0]);
                            assert.include(objs, mapped[1]);
                            done();
                        });
                    }
                });
            });

            it('matches some', function (done) {
                Person.graph([
                    {
                        name: 'Michael',
                        age: 21
                    },
                    {
                        name: 'Bob',
                        age: 22
                    },
                    {
                        name: 'John',
                        age: 23
                    }
                ], function (err, mapped) {
                    if (err) done(err);
                    else {
                        assert.ok(mapped);
                        var q = new Query(Person, {
                            age__gt: 21
                        });
                        q.execute(function (err, objs) {
                            if (err) done(err);
                            assert.equal(objs.length, 2);
                            assert.include(objs, mapped[1]);
                            assert.include(objs, mapped[2]);
                            done();
                        });
                    }
                });
            });

            it('no matches', function (done) {
                Person.graph([
                    {
                        name: 'Michael',
                        age: 21
                    },
                    {
                        name: 'Bob',
                        age: 21
                    }
                ], function (err, mapped) {
                    if (err) done(err);
                    else {
                        assert.ok(mapped);
                        var q = new Query(Person, {
                            age__gt: 21
                        });
                        q.execute(function (err, objs) {
                            if (err) done(err);
                            assert.notOk(objs.length);
                            done();
                        });
                    }
                });
            });
        });

        describe('gte', function () {
            var Collection, Person;

            beforeEach(function () {
                Collection = siesta.collection('myCollection');
                Person = Collection.model('Person', {
                    id: 'id',
                    attributes: ['name', 'age']
                });
            });

            it('matches all', function (done) {
                Person.graph([
                    {
                        name: 'Michael',
                        age: 21
                    },
                    {
                        name: 'Bob',
                        age: 21
                    }
                ], function (err, mapped) {
                    if (err) done(err);
                    else {
                        assert.ok(mapped);
                        var q = new Query(Person, {
                            age__gte: 21
                        });
                        q.execute(function (err, objs) {
                            if (err) done(err);
                            assert.equal(objs.length, 2);
                            assert.include(objs, mapped[0]);
                            assert.include(objs, mapped[1]);
                            done();
                        });
                    }
                });
            });

            it('matches some', function (done) {
                Person.graph([
                    {
                        name: 'Michael',
                        age: 21
                    },
                    {
                        name: 'Bob',
                        age: 22
                    },
                    {
                        name: 'John',
                        age: 23
                    }
                ], function (err, mapped) {
                    if (err) done(err);
                    else {
                        assert.ok(mapped);
                        var q = new Query(Person, {
                            age__gte: 22
                        });
                        q.execute(function (err, objs) {
                            if (err) done(err);
                            assert.equal(objs.length, 2);
                            assert.include(objs, mapped[1]);
                            assert.include(objs, mapped[2]);
                            done();
                        });
                    }
                });
            });

            it('no matches', function (done) {
                Person.graph([
                    {
                        name: 'Michael',
                        age: 21
                    },
                    {
                        name: 'Bob',
                        age: 21
                    }
                ], function (err, mapped) {
                    if (err) done(err);
                    else {
                        assert.ok(mapped);
                        var q = new Query(Person, {
                            age__gte: 22
                        });
                        q.execute(function (err, objs) {
                            if (err) done(err);
                            assert.notOk(objs.length);
                            done();
                        });
                    }
                });
            });
        });

        describe('contains', function () {
            var Collection, Model;
            // TODO
            beforeEach(function (done) {
                siesta.reset(function () {
                    Collection = siesta.collection('myCollection');
                    Model = Collection.model('Person', {
                        attributes: ['name']
                    });
                    done();
                });
            });
            it('string contains', function (done) {
                Model.graph([
                    {name: 'aaaabb'},
                    {name: '111122'},
                    {name: '4343bb'}
                ]).then(function () {
                    Model.query({name__contains: 'bb'}).then(function (res) {
                        assert.equal(res.length, 2);
                        res.forEach(function (m) {
                            assert(m.name.indexOf('bb') > -1, 'All contain');
                        });
                        done();
                    }).catch(done);
                }).catch(done);
            });
            it('array contains', function (done) {
                Model.graph([
                    {name: [1, 2, 3]},
                    {name: [4, 5, 6]},
                    {name: [3, 4, 5]}
                ]).then(function () {
                    Model.query({name__contains: 3}).then(function (res) {
                        assert.equal(res.length, 2);
                        res.forEach(function (m) {
                            assert(m.name.indexOf(3) > -1, 'All contain');
                        });
                        done();
                    }).catch(done);
                }).catch(done);
            });

        });

        describe('errors', function () {
            var Collection, Person, Car;
            beforeEach(function () {
                Collection = siesta.collection('myCollection');
                Person = Collection.model('Person', {
                    id: 'id',
                    attributes: ['name', 'age']
                });
                Car = Collection.model('Car', {
                    id: 'id',
                    attributes: ['colour', 'name'],
                    relationships: {
                        owner: {
                            type: 'OneToMany',
                            model: 'Person',
                            reverse: 'cars'
                        }
                    }
                });
            });

            it('invalid op', function (done) {
                Person.graph([
                    {
                        name: 'Michael',
                        age: 21
                    },
                    {
                        name: 'Bob',
                        age: 21
                    }
                ], function (err, mapped) {
                    if (err) done(err);
                    else {
                        assert.ok(mapped);
                        var q = new Query(Person, {
                            age__dfsoigsd: 21
                        });
                        q.execute(function (err, objs) {
                            assert.ok(err);
                            assert.notOk(objs);
                            done();
                        });
                    }
                });
            })
        });

    });

    describe('registering comparators', function () {

        var Collection, Person;

        beforeEach(function () {
            Collection = siesta.collection('myCollection');
            Person = Collection.model('Person', {
                id: 'id',
                attributes: ['age']
            });
        });

        it('register', function (done) {
            siesta.registerComparator('three', function (opts) {
                var value = opts.object[opts.field];
                return value == 3;
            });
            Person.graph([{age: 2}, {age: 3}])
                .then(function () {
                    Person.query({age__three: 'doesnt matter'})
                        .then(function (res) {
                            assert.equal(res.length, 1);
                            done();
                        }).catch(done);
                }).catch(done);
        });
    });

    describe('order', function () {
        var Collection, Person;
        beforeEach(function () {
            Collection = siesta.collection('myCollection');
            Person = Collection.model('Person', {
                id: 'id',
                attributes: ['name', 'age', 'dob']
            });
        });

        it('descending order', function (done) {
            Person.graph([
                {name: 'Mike', age: 24},
                {name: 'Bob', age: 40},
                {name: 'John', age: 12}
            ]).then(function () {
                Person.query({__order: '-age'})
                    .then(function (orderedPeople) {
                        var lastAge = orderedPeople[0].age;
                        for (var i = 1; i < orderedPeople.length; i++) {
                            var person = orderedPeople[i];
                            assert(person.age < lastAge, 'Should be descending');
                            lastAge = person.age;
                        }
                        done();
                    }).catch(done);
            }).catch(done);
        });

        it('ascending order', function (done) {
            Person.graph([
                {name: 'Mike', age: 24},
                {name: 'Bob', age: 40},
                {name: 'John', age: 12}
            ]).then(function () {
                Person.query({__order: 'age'})
                    .then(function (orderedPeople) {
                        var lastAge = orderedPeople[0].age;
                        for (var i = 1; i < orderedPeople.length; i++) {
                            var person = orderedPeople[i];
                            assert(person.age > lastAge, 'Should be descending');
                            lastAge = person.age;
                        }
                        done();
                    }).catch(done);
            }).catch(done);
        });

        it('multiple order, array', function (done) {
            Person.graph([
                {name: 'Mike', age: 24},
                {name: 'Bob', age: 24},
                {name: 'John', age: 12}
            ]).then(function () {
                var query = Person.query({__order: ['age', 'name']})
                    .then(function (orderedPeople) {
                        var lastAge = orderedPeople[0].age;
                        for (var i = 1; i < orderedPeople.length; i++) {
                            var person = orderedPeople[i];
                            assert(person.age >= lastAge, 'Should be ascending');
                            lastAge = person.age;
                        }
                        done();
                    }).catch(done);
            }).catch(done);
        });

        it('date order', function (done) {
            Person.graph([
                {name: 'Mike', dob: new Date(1990, 9, 10)},
                {name: 'Bob', dob: new Date(1993, 1, 12)},
                {name: 'John', dob: new Date(1984, 3, 5)}
            ]).then(function () {
                Person.query({__order: 'dob'})
                    .then(function (orderedPeople) {
                        var lastDob = orderedPeople[0].dob;
                        for (var i = 1; i < orderedPeople.length; i++) {
                            var person = orderedPeople[i];
                            assert(person.dob >= lastDob, 'Should be ascending');
                            lastDob = person.dob;
                        }
                        done();
                    }).catch(done);
            }).catch(done);
        });


        it('alphabetical order, ascending', function (done) {
            Person.graph([
                {name: 'Mike'},
                {name: 'Bob'},
                {name: 'John'}
            ]).then(function (people) {
                Person.query({__order: 'name'})
                    .then(function (orderedPeople) {
                        console.log(_.pluck(orderedPeople, 'name'));
                        assert.equal(orderedPeople[0], people[1]);
                        assert.equal(orderedPeople[1], people[2]);
                        assert.equal(orderedPeople[2], people[0]);
                        done();
                    }).catch(done);
            }).catch(done);
        });


        it('alphabetical order, descending', function (done) {
            Person.graph([
                {name: 'Mike'},
                {name: 'Bob'},
                {name: 'John'}
            ]).then(function (people) {
                Person.query({__order: '-name'})
                    .then(function (orderedPeople) {
                        console.log(_.pluck(orderedPeople, 'name'));
                        assert.equal(orderedPeople[2], people[1]);
                        assert.equal(orderedPeople[1], people[2]);
                        assert.equal(orderedPeople[0], people[0]);
                        done();
                    }).catch(done);
            }).catch(done);
        });
    });

    describe('$or', function () {
        var Collection, Person;
        beforeEach(function () {
            Collection = siesta.collection('myCollection');
            Person = Collection.model('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });
        });
        it('simple', function (done) {
            Person.graph([
                {name: 'Mike', age: 24},
                {name: 'Bob', age: 22},
                {name: 'Peter', age: 29}
            ])
                .then(function () {
                    Person.query({
                        $or: [
                            {age: 24},
                            {age: 22}
                        ]
                    }).then(function (res) {
                        assert.equal(res.length, 2);
                        _.each(res, function (r) {
                            assert.ok(r.age == 24 || r.age == 22);
                        });
                        done();
                    }).catch(done);
                })
                .catch(done)
                ;
        });
        it('still simple', function (done) {
            Person.graph([
                {name: 'Mike', age: 24},
                {name: 'Bob', age: 22},
                {name: 'Peter', age: 24}
            ])
                .then(function () {
                    Person.query({
                        $or: [
                            {age: 24, name: 'Mike'},
                            {age: 22}
                        ]
                    }).then(function (res) {
                        assert.equal(res.length, 2);
                        _.each(res, function (r) {
                            assert.ok(r.age == 24 || r.age == 22);
                        });
                        done();
                    }).catch(done);
                })
                .catch(done)
                ;
        });

        it('nested', function (done) {
            Person.graph([
                {name: 'Mike', age: 24},
                {name: 'Bob', age: 22},
                {name: 'Peter', age: 24},
                {name: 'Roger', age: 24}
            ])
                .then(function () {
                    Person.query({
                        $or: [
                            {$or: [{name: 'Mike'}, {name: 'Peter'}], age: 24},
                            {age: 22}
                        ]
                    }).then(function (res) {
                        assert.equal(res.length, 3);
                        done();
                    }).catch(done);
                })
                .catch(done)
                ;
        });
    });

    describe('$and', function () {
        var Collection, Person;
        beforeEach(function () {
            Collection = siesta.collection('myCollection');
            Person = Collection.model('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });
        });
        it('simple', function (done) {
            Person.graph([
                {name: 'Mike', age: 24},
                {name: 'Bob', age: 24},
                {name: 'Peter', age: 24}
            ])
                .then(function () {
                    Person.query({
                        $and: [
                            {age: 24},
                            {name: 'Mike'}
                        ]
                    }).then(function (res) {
                        assert.equal(res.length, 1);
                        var r = res[0];
                        assert.equal(r.age, 24);
                        assert.equal(r.name, 'Mike');
                        done();
                    }).catch(done);
                })
                .catch(done)
                ;
        });

        it('mixture', function (done) {
            Person.graph([
                {name: 'Mike', age: 24},
                {name: 'Bob', age: 22},
                {name: 'Peter', age: 24},
                {name: 'Roger', age: 24}
            ])
                .then(function () {
                    Person.query({
                        $and: [
                            {$or: [{name: 'Mike'}, {name: 'Peter'}]},
                            {age: 24}
                        ]
                    }).then(function (res) {
                        assert.equal(res.length, 2);
                        done();
                    }).catch(done);
                })
                .catch(done)
                ;
        });
    });

    describe('nested', function () {
        var Collection, Car, Person;
        beforeEach(function () {
            Collection = siesta.collection('myCollection');
            Car = Collection.model('Car', {
                id: 'id',
                attributes: ['name', 'colour'],
                relationships: {
                    owner: {
                        model: 'Person',
                        type: 'OneToMany',
                        reverse: 'cars'
                    }
                }
            });
            Person = Collection.model('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });
        });

        it('nested equals', function (done) {
            Car.graph([
                {name: 'Aston Martin', colour: 'black', owner: {id: 1, name: 'Mike', age: 23}},
                {name: 'Aston Martin', colour: 'blue', owner: {id: 1}},
                {name: 'Bentley', colour: 'green', owner: {id: 2, name: 'Bob', age: 22}}
            ])
                .then(function () {
                    Car.query({'owner.age': 23})
                        .then(function (cars) {
                            assert.equal(cars.length, 2);
                            done();
                        })
                        .catch(done)
                        ;
                })
                .catch(done)
                ;
        });

        it('nested op', function (done) {
            Car.graph([
                {name: 'Aston Martin', colour: 'black', owner: {id: 1, name: 'Mike', age: 23}},
                {name: 'Aston Martin', colour: 'blue', owner: {id: 2, name: 'John', age: 24}},
                {name: 'Bentley', colour: 'green', owner: {id: 3, name: 'Bob', age: 25}}
            ])
                .then(function () {
                    Car.query({'owner.age__lte': 24})
                        .then(function (cars) {
                            assert.equal(cars.length, 2);
                            done();
                        })
                        .catch(done)
                        ;
                })
                .catch(done)
                ;
        });


    });


});