var assert = require('chai').assert;

describe('storage', function () {

    before(function () {
        siesta.ext.storageEnabled = true;
    });

    beforeEach(function (done) {
        siesta.reset(done);
    });

    describe('serialisation', function () {

        describe('attributes only', function () {
            var Collection, Car;

            beforeEach(function () {
                Collection = siesta.collection('myCollection');
                Car = Collection.model('Car', {
                    attributes: ['colour', 'name']
                });
            });

            it('storage', function (done) {
                Car.graph({colour: 'black', name: 'bentley', id: 2})
                    .then(function (car) {
                        car._rev = '123'; //Fake pouchdb revision.
                        var serialised = siesta.ext.storage._serialise(car);
                        assert.equal(serialised.colour, 'black');
                        assert.equal(serialised.name, 'bentley');
                        assert.equal(serialised.id, 2);
                        assert.equal(serialised._id, car._id);
                        assert.equal(serialised.collection, 'myCollection');
                        assert.equal(serialised.model, 'Car');
                        assert.equal(serialised._rev, car._rev);
                        done();
                    })
                    .catch(done)
                    .done();
            });
        });

        describe('relationships', function () {
            var Collection, Car, Person;

            beforeEach(function () {
                Collection = siesta.collection('myCollection');
                Car = Collection.model('Car', {
                    attributes: ['colour', 'name'],
                    relationships: {
                        owner: {
                            model: 'Person',
                            type: 'OneToMany',
                            reverse: 'cars'
                        }
                    }
                });
                Person = Collection.model('Person', {
                    attributes: ['age', 'name']
                });
            });

            it('onetomany', function (done) {
                Person.graph({name: 'Michael', age: 24}).then(function (person) {
                    Car.graph({colour: 'black', name: 'bentley', id: 2, owner: {_id: person._id}})
                        .then(function (car) {
                            var serialisedCar = siesta.ext.storage._serialise(car);
                            assert.equal(serialisedCar.colour, 'black');
                            assert.equal(serialisedCar.name, 'bentley');
                            assert.equal(serialisedCar.id, 2);
                            assert.equal(serialisedCar._id, car._id);
                            assert.equal(serialisedCar.collection, 'myCollection');
                            assert.equal(serialisedCar.owner, person._id);
                            assert.equal(serialisedCar.model, 'Car');
                            var serialisedPerson = siesta.ext.storage._serialise(person);
                            assert.equal(serialisedPerson.name, 'Michael');
                            assert.equal(serialisedPerson.age, 24);
                            assert.include(serialisedPerson.cars, car._id);
                            assert.equal(serialisedPerson.collection, 'myCollection');
                            assert.equal(serialisedPerson.model, 'Person');
                            done();
                        })
                        .catch(done)
                        .done();
                }).catch(done).done();

            });
        });

        describe('dates', function () {
            var Model, Collection;
            beforeEach(function () {
                Collection = siesta.collection('myCollection');
                Model = Collection.model('Model', {
                    attributes: ['date', 'x']
                });
            });
            it('meta', function (done) {
                Model.graph({x: 1, date: new Date()})
                    .then(function (car) {
                        var serialised = siesta.ext.storage._serialise(car);
                        console.log('serialised', serialised);
                        var meta = serialised.siesta_meta;
                        assert.ok(meta, 'should have a meta object');
                        assert.equal(meta.dateFields.length, 1);
                        assert.include(meta.dateFields, 'date');
                        car.date = 2;
                        serialised = siesta.ext.storage._serialise(car);
                        meta = serialised.siesta_meta;
                        assert.ok(meta, 'should  have a meta object');
                        assert.equal(meta.dateFields.length, 0);
                        done();
                    }).catch(done);
            })

        });

    });

    describe('save', function () {
        var Collection, Car;

        beforeEach(function (done) {
            Collection = siesta.collection('myCollection');
            Car = Collection.model('Car', {
                attributes: ['colour', 'name']
            });
            Car.graph({colour: 'black', name: 'bentley', id: 2}).then(function () {
                done()
            }).catch(done);
        });

        it('new object', function (done) {
            assert.equal(1, siesta.ext.storage._unsavedObjects.length, 'Should be one car to save.');
            var car = siesta.ext.storage._unsavedObjects[0];
            siesta.save().then(function () {
                assert.equal(0, siesta.ext.storage._unsavedObjects.length, 'Should be no more cars');
                siesta.ext.storage._pouch.get(car._id).then(function (carDoc) {
                    assert.ok(carDoc);
                    assert.equal(carDoc._id, car._id, 'Should have same _id');
                    assert.equal(carDoc._rev, car._rev, 'Should have same revision');
                    assert.equal(carDoc.collection, 'myCollection');
                    assert.equal(carDoc.model, 'Car');
                    assert.equal(carDoc.colour, 'black');
                    assert.equal(carDoc.name, 'bentley');
                    assert.equal(carDoc.id, 2);
                    done();
                }).catch(done);
            }).catch(done).done();
        });

        it('update object', function (done) {
            assert.equal(1, siesta.ext.storage._unsavedObjects.length, 'Should be one car to save.');
            var car = siesta.ext.storage._unsavedObjects[0];
            siesta.save().then(function () {
                assert.equal(0, siesta.ext.storage._unsavedObjects.length, 'Should be no more cars');
                car.colour = 'blue';
                siesta.save().then(function () {
                    siesta.ext.storage._pouch.get(car._id).then(function (carDoc) {
                        assert.ok(carDoc);
                        assert.equal(carDoc._id, car._id, 'Should have same _id');
                        assert.equal(carDoc._rev, car._rev, 'Should have same revision');
                        assert.equal(carDoc.collection, 'myCollection');
                        assert.equal(carDoc.model, 'Car');
                        assert.equal(carDoc.colour, 'blue');
                        assert.equal(carDoc.name, 'bentley');
                        assert.equal(carDoc.id, 2);
                        done();
                    }).catch(done);
                }).catch(done).done();
            }).catch(done).done();
        });


        it('remove object', function (done) {
            var car = siesta.ext.storage._unsavedObjects[0];
            siesta.save().then(function () {
                car.remove()
                    .then(function () {
                        siesta.notify(function () {
                            siesta.save().then(function () {
                                siesta.ext.storage._pouch.get(car._id).then(function () {
                                    done('Should be deleted...');
                                }).catch(function (e) {
                                    assert.equal(e.status, 404);
                                    done();
                                });
                            }).catch(done);
                        });
                    })
                    .catch(done);

            }).catch(done);
        });

    });

    describe('load', function () {

        describe('attributes only', function () {
            var Collection, Car;

            beforeEach(function (done) {
                Collection = siesta.collection('myCollection');
                Car = Collection.model('Car', {
                    attributes: ['colour', 'name']
                });
                siesta.install(done);
            });
            it('abc', function (done) {
                siesta.ext.storage._pouch.bulkDocs([
                    {collection: 'myCollection', model: 'Car', colour: 'red', name: 'Aston Martin'},
                    {collection: 'myCollection', model: 'Car', colour: 'black', name: 'Bentley'}
                ]).then(function () {
                    siesta.ext.storage._load().then(function () {
                        assert.notOk(siesta.ext.storage._unsavedObjects.length, 'Notifications should be disabled');
                        Car.all().then(function (cars) {
                            assert.equal(cars.length, 2, 'Should have loaded the two cars');
                            var redCar = _.filter(cars, function (x) {
                                    return x.colour == 'red'
                                })[0],
                                blackCar = _.filter(cars, function (x) {
                                    return x.colour == 'black'
                                })[0];
                            assert.equal(redCar.colour, 'red');
                            assert.equal(redCar.name, 'Aston Martin');
                            assert.ok(redCar._rev);
                            assert.ok(redCar._id);
                            assert.equal(blackCar.colour, 'black');
                            assert.equal(blackCar.name, 'Bentley');
                            assert.ok(blackCar._rev);
                            assert.ok(blackCar._id);
                            done();
                        }).catch(done).done();
                    }).catch(done).done();
                }).catch(done);
            })
        });

        describe('relationships', function () {


            var Collection, Car, Person;

            describe('one-to-many', function () {
                beforeEach(function (done) {
                    Collection = siesta.collection('myCollection');
                    Car = Collection.model('Car', {
                        attributes: ['colour', 'name'],
                        relationships: {
                            owner: {
                                model: 'Person',
                                type: 'OneToMany',
                                reverse: 'cars'
                            }
                        }
                    });
                    Person = Collection.model('Person', {
                        attributes: ['name', 'age']
                    });

                    siesta.ext.storage._pouch.bulkDocs([
                        {
                            collection: 'myCollection',
                            model: 'Car',
                            colour: 'red',
                            name: 'Aston Martin',
                            owner: 'xyz',
                            _id: 'abc'
                        },
                        {
                            collection: 'myCollection',
                            model: 'Car',
                            colour: 'black',
                            name: 'Bentley',
                            owner: 'xyz',
                            _id: 'def'
                        },
                        {
                            collection: 'myCollection',
                            model: 'Person',
                            name: 'Michael',
                            age: 24,
                            _id: 'xyz',
                            cars: ['abc', 'def']
                        }
                    ]).then(function () {
                        siesta.install().then(function () {
                            siesta.ext.storage._load().then(function () {
                                assert.notOk(siesta.ext.storage._unsavedObjects.length, 'Notifications should be disabled');
                                done();
                            }).catch(done).done();
                        }).catch(done);
                    }).catch(done);

                });

                it('cars', function (done) {
                    Car.all().then(function (cars) {
                        assert.equal(cars.length, 2, 'Should have loaded the two cars');
                        var redCar = _.filter(cars, function (x) {
                                return x.colour == 'red'
                            })[0],
                            blackCar = _.filter(cars, function (x) {
                                return x.colour == 'black'
                            })[0];
                        assert.equal(redCar.colour, 'red');
                        assert.equal(redCar.name, 'Aston Martin');
                        assert.ok(redCar._rev);
                        assert.ok(redCar._id);
                        assert.equal(blackCar.colour, 'black');
                        assert.equal(blackCar.name, 'Bentley');
                        assert.ok(blackCar._rev);
                        assert.ok(blackCar._id);
                        assert.equal(redCar.owner._id, 'xyz');
                        assert.equal(blackCar.owner._id, 'xyz');
                        done();
                    }).catch(done).done();

                });

                it('people', function (done) {
                    Person.all().then(function (people) {
                        assert.equal(people.length, 1, 'Should have loaded one person');
                        var person = people[0];
                        assert.equal(person.name, 'Michael');
                        assert.equal(person.age, 24);
                        assert.equal(person.cars.length, 2);
                        assert.include(_.pluck(person.cars, '_id'), 'abc');
                        assert.include(_.pluck(person.cars, '_id'), 'def');
                        done();
                    }).catch(done).done();
                });


            });


            it('manytomany', function (done) {
                Collection = siesta.collection('myCollection');
                Car = Collection.model('Car', {
                    attributes: ['colour', 'name'],
                    relationships: {
                        owners: {
                            model: 'Person',
                            type: 'ManyToMany',
                            reverse: 'cars'
                        }
                    }
                });
                Person = Collection.model('Person', {
                    attributes: ['name', 'age']
                });
                siesta.install()
                    .then(function () {
                        siesta.ext.storage._pouch.bulkDocs([
                            {
                                collection: 'myCollection',
                                model: 'Car',
                                colour: 'red',
                                name: 'Aston Martin',
                                owners: ['xyz'],
                                _id: 'abc'
                            },
                            {
                                collection: 'myCollection',
                                model: 'Car',
                                colour: 'black',
                                name: 'Bentley',
                                owners: ['xyz'],
                                _id: 'def'
                            },
                            {
                                collection: 'myCollection',
                                model: 'Person',
                                name: 'Michael',
                                age: 24,
                                _id: 'xyz',
                                cars: ['abc', 'def']
                            },
                            {
                                collection: 'myCollection',
                                model: 'Person',
                                name: 'Bob',
                                age: 24,
                                _id: 'xyz',
                                cars: ['abc']
                            }
                        ]).then(function () {
                            siesta.ext.storage._load().then(function () {
                                assert.notOk(siesta.ext.storage._unsavedObjects.length, 'Notifications should be disabled');
                                Car.all().then(function (cars) {
                                    assert.equal(cars.length, 2, 'Should have loaded the two cars');
                                    var redCar = _.filter(cars, function (x) {
                                            return x.colour == 'red'
                                        })[0],
                                        blackCar = _.filter(cars, function (x) {
                                            return x.colour == 'black'
                                        })[0];
                                    assert.equal(redCar.colour, 'red');
                                    assert.equal(redCar.name, 'Aston Martin');
                                    assert.ok(redCar._rev);
                                    assert.ok(redCar._id);
                                    assert.equal(blackCar.colour, 'black');
                                    assert.equal(blackCar.name, 'Bentley');
                                    assert.ok(blackCar._rev);
                                    assert.ok(blackCar._id);
                                    assert.include(_.pluck(redCar.owners, '_id'), 'xyz');
                                    assert.include(_.pluck(blackCar.owners, '_id'), 'xyz');
                                    done();
                                }).catch(done).done();
                            }).catch(done).done();
                        }).catch(done);

                    })
                    .catch(done)
                    .done();
            });

            it('onetoone', function (done) {
                Collection = siesta.collection('myCollection');
                Car = Collection.model('Car', {
                    attributes: ['colour', 'name'],
                    relationships: {
                        owner: {
                            model: 'Person',
                            type: 'OneToOne',
                            reverse: 'car'
                        }
                    }
                });
                Person = Collection.model('Person', {
                    attributes: ['name', 'age']
                });
                siesta.install()
                    .then(function () {
                        siesta.ext.storage._pouch.bulkDocs([
                            {
                                collection: 'myCollection',
                                model: 'Car',
                                colour: 'red',
                                name: 'Aston Martin',
                                owner: 'xyz',
                                _id: 'abc'
                            },
                            {
                                collection: 'myCollection',
                                model: 'Car',
                                colour: 'black',
                                name: 'Bentley',
                                owner: 'xyz',
                                _id: 'def'
                            },
                            {
                                collection: 'myCollection',
                                model: 'Person',
                                name: 'Michael',
                                age: 24,
                                _id: 'xyz',
                                car: 'def'
                            }
                        ]).then(function () {
                            siesta.ext.storage._load().then(function () {
                                assert.notOk(siesta.ext.storage._unsavedObjects.length, 'Notifications should be disabled');
                                Car.all().then(function (cars) {
                                    assert.equal(cars.length, 2, 'Should have loaded the two cars');
                                    var redCar = _.filter(cars, function (x) {
                                            return x.colour == 'red'
                                        })[0],
                                        blackCar = _.filter(cars, function (x) {
                                            return x.colour == 'black'
                                        })[0];
                                    assert.equal(redCar.colour, 'red');
                                    assert.equal(redCar.name, 'Aston Martin');
                                    assert.ok(redCar._rev);
                                    assert.ok(redCar._id);
                                    assert.equal(blackCar.colour, 'black');
                                    assert.equal(blackCar.name, 'Bentley');
                                    assert.ok(blackCar._rev);
                                    assert.ok(blackCar._id);
                                    assert.notOk(redCar.owner);
                                    assert.equal(blackCar.owner._id, 'xyz');
                                    done();
                                }).catch(done).done();
                            }).catch(done).done();
                        }).catch(done);
                    })
                    .catch(done)
                    .done();
            });

        });

        describe('load on install', function () {
            var collection, Car, Person;

            beforeEach(function (done) {

                collection = siesta.collection('myCollection');
                Car = collection.model('Car', {
                    attributes: ['colour', 'name'],
                    relationships: {
                        owner: {
                            model: 'Person',
                            type: 'OneToMany',
                            reverse: 'cars'
                        }
                    }
                });
                Person = collection.model('Person', {
                    attributes: ['name', 'age']
                });

                siesta.ext.storage._pouch.bulkDocs([
                    {
                        collection: 'myCollection',
                        model: 'Car',
                        colour: 'red',
                        name: 'Aston Martin',
                        owner: 'xyz',
                        _id: 'abc'
                    },
                    {
                        collection: 'myCollection',
                        model: 'Car',
                        colour: 'black',
                        name: 'Bentley',
                        owner: 'xyz',
                        _id: 'def'
                    },
                    {
                        collection: 'myCollection',
                        model: 'Person',
                        name: 'Michael',
                        age: 24,
                        _id: 'xyz',
                        cars: ['abc', 'def']
                    }
                ]).then(function () {
                    done();
                }).catch(done);

            });

            it('cars', function (done) {
                Car.all().then(function (cars) {
                    assert.equal(cars.length, 2);
                    done();
                }).catch(done).done();
            });

            it('people', function (done) {
                Person.all().then(function (people) {
                    assert.equal(people.length, 1);
                    done();
                }).catch(done).done();
            });

        });


    });

    describe('inspection', function () {
        var MyCollection, Car, Person, car, person, MyOtherModel, MyOtherCollection;
        beforeEach(function (done) {
            MyCollection = siesta.collection('MyCollection');
            MyOtherCollection = siesta.collection('MyOtherCollection');
            Car = MyCollection.model('Car', {
                attributes: ['colour', 'name']
            });
            Person = MyCollection.model('Person', {
                attributes: ['age', 'name']
            });
            MyOtherModel = MyOtherCollection.model('MyOtherModel', {
                attributes: ['attr']
            });
            Car.graph({colour: 'black', name: 'bentley', id: 2})
                .then(function (_car) {
                    car = _car;
                    Person.graph({name: 'Michael', age: 24})
                        .then(function (_person) {
                            person = _person;
                            done();
                        });
                }).catch(done).done();
        });

        it('global dirtyness', function (done) {
            assert.ok(siesta.dirty);
            siesta.save().then(function () {
                assert.notOk(siesta.dirty);
                done();
            }).catch(done).done();
        });

        it('collection dirtyness', function (done) {
            assert.ok(MyCollection.dirty);
            siesta.save().then(function () {
                assert.notOk(MyCollection.dirty);
                MyOtherModel.graph({attr: 'xyz'})
                    .then(function () {
                        assert.notOk(MyCollection.dirty);
                        assert.ok(MyOtherCollection.dirty);
                        done();
                    })
                    .catch(done)
                    .done();
            }).catch(done).done();
        });

        it('model dirtyness', function (done) {
            assert.ok(Car.dirty);
            siesta.save().then(function () {
                assert.notOk(Car.dirty);
                person.name = 'bob';
                assert.ok(Person.dirty);
                assert.notOk(Car.dirty);
                done();
            }).catch(done).done();
        });

        it('model instance dirtyness', function (done) {
            assert.ok(car.dirty);
            siesta.save().then(function () {
                assert.notOk(car.dirty);
                person.name = 'bob';
                assert.ok(person.dirty);
                assert.notOk(car.dirty);
                done();
            }).catch(done).done();
        });


    });

    describe('singleton', function () {
        var Pomodoro, ColourConfig;

        describe('save', function () {

            beforeEach(function () {
                Pomodoro = siesta.collection('Pomodoro');
                ColourConfig = Pomodoro.model('ColourConfig', {
                    attributes: ['primary', 'shortBreak', 'longBreak'],
                    singleton: true
                });
            });

            function extracted(cb) {
                siesta.ext.storage._pouch.query(function (doc) {
                    if (doc.model == 'ColourConfig') {
                        emit(doc._id, doc);
                    }
                }, {include_docs: true})
                    .then(function (resp) {
                        var rows = resp.rows;
                        cb(null, rows);
                    }).catch(cb);
            }

            it('repeated saves', function (done) {
                siesta.ext.storage._pouch.put({
                    collection: 'Pomodoro',
                    model: 'ColourConfig',
                    primary: 'red',
                    shortBreak: 'blue',
                    longBreak: 'green',
                    _id: 'xyz'
                }).then(function () {
                    ColourConfig.one()
                        .then(function (colourConfig) {
                            extracted(function (err, rows) {
                                if (!err) {
                                    assert.equal(rows.length, 1, 'Should only ever be one row for singleton after the load');
                                    assert.equal(colourConfig.primary, 'red');
                                    assert.equal(colourConfig.shortBreak, 'blue');
                                    assert.equal(colourConfig.longBreak, 'green');
                                    siesta.save()
                                        .then(function () {
                                            extracted(function (err, rows) {
                                                if (!err) {
                                                    assert.equal(rows.length, 1, 'Should only ever be one row for singleton after the save');
                                                    done();
                                                }
                                                else done(err);
                                            });
                                        }).catch(done);
                                }
                                else done(err);
                            });
                        }).catch(done)
                }).catch(done);
            });
        });

        describe('singleton relationships', function () {
            var Pomodoro, Config, ColourConfig, PomodoroConfig, PomodoroTimer;
            beforeEach(function () {
                Pomodoro = siesta.collection('Pomodoro');

                var DEFAULT_COLOURS = {
                    primary: '#df423c',
                    shortBreak: '#37a2c4',
                    longBreak: '#292f37'
                };

                Config = Pomodoro.model('Config', {
                    relationships: {
                        pomodoro: {model: 'PomodoroConfig'},
                        colours: {model: 'ColourConfig'}
                    },
                    singleton: true
                });
                ColourConfig = Pomodoro.model('ColourConfig', {
                    attributes: [
                        {
                            name: 'primary',
                            default: DEFAULT_COLOURS.primary
                        },
                        {
                            name: 'shortBreak',
                            default: DEFAULT_COLOURS.shortBreak
                        },
                        {
                            name: 'longBreak',
                            default: DEFAULT_COLOURS.longBreak
                        }
                    ],
                    singleton: true
                });
                PomodoroConfig = Pomodoro.model('PomodoroConfig', {
                    attributes: [
                        {
                            name: 'pomodoroLength',
                            default: 25
                        },
                        {
                            name: 'longBreakLength',
                            default: 15
                        },
                        {
                            name: 'shortBreakLength',
                            default: 5
                        },
                        {
                            name: 'roundLength',
                            default: 4
                        }
                    ],
                    singleton: true
                });
                PomodoroTimer = Pomodoro.model('PomodoroTimer', {
                    attributes: [
                        {
                            name: 'seconds',
                            default: 25 * 60
                        },
                        {
                            name: 'round',
                            default: 1
                        },
                        {
                            name: 'target',
                            default: 1
                        }
                    ],
                    init: function (fromStorage, done) {
                        // Setup listeners.
                        // Note: The reason why we listen to self rather than simply execute logic when we decrement seconds in
                        // the interval is that this options leaves open the possibility of modifying seconds outside of the model
                        // instance.
                        this.listen(function (n) {
                            if (n.field == 'seconds') this.onSecondsChange();
                        }.bind(this));
                        console.log('starting');
                        data.PomodoroConfig.one()
                            .then(function (config) {
                                console.log('started');

                                config.listen(this.onConfigChange.bind(this));
                                done();
                            }.bind(this))
                            .catch(done);
                    },
                    methods: {
                        onSecondsChange: function () {
                            if (this.seconds == 0) {

                            }
                        },
                        onConfigChange: function (n) {
                            switch (n.field) {
                                case 'pomodoroLength':
                                    this.onPomodoroLengthChange(n.old, n.new);
                                    break;
                                case 'longBreakLength':
                                    this.onLongBreakLengthChange(n.old, n.new);
                                    break;
                                case 'shortBreakLength':
                                    this.onShortBreakLengthChange(n.old, n.new);
                                    break;
                                case 'roundLength':
                                    this.onRoundLengthChange(n.old, n.new);
                                    break;
                                default:
                                    break;
                            }
                        },
                        onPomodoroLengthChange: function (old, _new) {

                        },
                        onLongBreakLengthChange: function (old, _new) {

                        },
                        onShortBreakLengthChange: function (old, _new) {

                        },
                        onRoundLengthChange: function (old, _new) {

                        },
                        start: function () {
                            if (!this._token) {
                                this._token = setInterval(function () {
                                    this.seconds--;
                                }, 1000);
                            }
                        },
                        stop: function () {
                            if (this._token) {
                                clearInterval(this._token);
                                this._token = null;
                            }
                        }
                    },
                    singleton: true
                });

            });

            it('install', function (done) {
                siesta.install(function (err) {
                    done(err);
                });
            })
        });


    });

    describe('custom pouch', function () {
        it('custom pouch', function () {
            var pouch = new PouchDB('customPouch');
            siesta.setPouch(pouch);
            assert.equal(siesta.ext.storage._pouch, pouch);
        });
        // TODO
        //it('throw an error if installed', function (done) {
        //    var collection = siesta.collection('Collection'),
        //        MyModel = collection.model('MyModel', {attributes: ['blah']});
        //    siesta.install(function () {
        //        var pouch = new PouchDB('customPouch');
        //        assert.throws(function () {
        //            siesta.setPouch(pouch);
        //            done();
        //        }, Error);
        //    });
        //});
    });

    describe('saving and loading different data types', function () {
        var db;

        beforeEach(function () {
            db = siesta.ext.storage._pouch;
        });

        describe('date', function () {
            it('save', function (done) {
                var Collection = siesta.collection('MyCollection'),
                    Model = Collection.model('myModel', {
                        attributes: ['date']
                    });
                Model.graph({date: new Date()})
                    .then(function (m) {
                        siesta.save().then(function () {
                            db.get(m._id).then(function (data) {
                                assert.ok(data.date instanceof Date);
                                done();
                            });
                        }).catch(done);
                    }).catch(done);
            });

            it('load', function (done) {
                db.bulkDocs([
                    {collection: 'MyCollection', model: 'myModel', date: new Date(), siesta_meta: {dateFields: ['date']}}
                ], {include_docs: true}).then(function (objs) {
                    db.get(objs[0].id).then(function (obj) {
                        assert.ok(obj.date instanceof Date, 'pouchdb should reload date objects');
                        var Collection = siesta.collection('MyCollection'),
                            Model = Collection.model('myModel', {
                                attributes: ['date']
                            });
                        Model.one().then(function (m) {
                            console.log('date', m.date);
                            assert.ok(m.date instanceof Date, 'siesta should reload date objects correctly');
                            done();
                        }).catch(done);
                    }).catch(done);
                }).catch(done);

            });

        });

    });

    it('init should  be called on load with storage == true', function (done) {

        var Collection, Car, Person;
        var carInitCalled = false, personInitCalled = false;
        Collection = siesta.collection('myCollection');
        Car = Collection.model('Car', {
            attributes: ['colour'],
            init: function (fromStorage) {
                assert.ok(fromStorage);
                carInitCalled = true;
            },
            relationships: {
                owner: {
                    model: 'Person'
                }
            }
        });
        Person = Collection.model('Person', {
            attributes: ['name'],
            init: function (fromStorage) {
                assert.ok(fromStorage);
                personInitCalled = true;
            }
        });
        siesta.install(function () {
            siesta.ext.storage._pouch.bulkDocs([
                {collection: 'myCollection', model: 'Car', colour: 'red'},
                {collection: 'myCollection', model: 'Car', name: 'Mike'}
            ]).then(function () {
                siesta.ext.storage._load().then(function () {
                    assert.ok(carInitCalled);
                    assert.ok(personInitCalled);
                    done();
                }).catch(done).done();
            }).catch(done);
        });


    });


});