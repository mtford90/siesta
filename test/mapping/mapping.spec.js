var assert = require('chai').assert,
    internal = siesta._internal,
    Model = internal.Model;

describe('mapping!', function () {

    before(function () {
        siesta.ext.storageEnabled = false;
    });

    beforeEach(function (done) {
        siesta.reset(done);
    });

    it('_attributeNames', function () {
        var m = new Model({
            name: 'name',
            id: 'id',
            attributes: ['field1', 'field2'],
            collection: {name: 'x'}
        });
        assert.include(m._attributeNames, 'id');
        assert.include(m._attributeNames, 'field1');
        assert.include(m._attributeNames, 'field2');
        assert.notInclude(m._attributeNames, 'type');
    });

    it('attributes', function () {
        var m = new Model({
            name: 'name',
            id: 'id',
            attributes: ['field1', 'field2'],
            collection: {name: 'x'}
        });
        var attributes = _.pluck(m.attributes, 'name');
        assert.include(attributes, 'field1');
        assert.include(attributes, 'field2');
    });

    it('name', function () {
        var m = new Model({
            name: 'name',
            id: 'id',
            attributes: ['field1', 'field2'],
            collection: {name: 'x'}
        });
        assert.equal(m.name, 'name');
    });

    it('id', function () {
        var m = new Model({
            name: 'name',
            id: 'id',
            attributes: ['field1', 'field2'],
            collection: {name: 'x'}
        });
        assert.equal(m.id, 'id');
    });

    describe('customisation', function () {
        describe('methods', function () {
            describe('init', function () {
                it('sync', function (done) {
                    var C = siesta.collection('C');
                    var M = C.model('M', {
                        init: function (fromStorage) {
                            assert.notOk(fromStorage);
                            assert.equal(this.attr, 1);
                            done();
                        },
                        attributes: ['attr']
                    });
                    siesta.install()
                        .then(function () {
                            M.graph({
                                attr: 1
                            });
                        })
                        .catch(done);
                });
                it('async', function (done) {
                    var C = siesta.collection('C');
                    var initExecuted = false;
                    var M = C.model('M', {
                        init: function (fromStorage, cb) {
                            assert.notOk(fromStorage);
                            assert.equal(this.attr, 1);
                            initExecuted = true;
                            cb();
                        },
                        attributes: ['attr']
                    });
                    siesta.install()
                        .then(function () {
                            M.graph({
                                attr: 1
                            })
                                .then(function () {
                                    assert.ok(initExecuted);
                                    done();
                                })
                                .catch(done);
                        })
                        .catch(done);
                });
                it('mixture of async and sync', function (done) {
                    var C = siesta.collection('C');
                    var asyncInitExecuted = false,
                        syncInitExecuted = false;
                    var M = C.model('M', {
                            init: function (fromStorage, cb) {
                                assert.notOk(fromStorage);
                                assert.equal(this.attr, 1);
                                asyncInitExecuted = true;
                                cb();
                            },
                            attributes: ['attr']
                        }),
                        M_2 = C.model('M_2', {
                            init: function (fromStorage) {
                                assert.notOk(fromStorage);
                                assert.equal(this.attr, 2);
                                syncInitExecuted = true;
                            },
                            attributes: ['attr']
                        });
                    siesta.install()
                        .then(function () {
                            M.graph({
                                attr: 1
                            })
                                .then(function () {
                                    M_2.graph({
                                        attr: 2
                                    })
                                        .then(function () {
                                            assert.ok(asyncInitExecuted);
                                            assert.ok(syncInitExecuted);
                                            done();
                                        }).catch(done);
                                })
                                .catch(done);
                        })
                        .catch(done);
                });

                it('use queries within', function (done) {
                    var C = siesta.collection('C'),
                        asyncInitExecuted = false,
                        syncInitExecuted = false;
                    var M = C.model('M', {
                            init: function (fromStorage, cb) {
                                assert.notOk(fromStorage);
                                M_2.query({}).then(function () {
                                    asyncInitExecuted = true;
                                    cb();
                                }).catch(cb);
                            },
                            attributes: ['attr']
                        }),
                        M_2 = C.model('M_2', {
                            init: function (fromStorage) {
                                assert.notOk(fromStorage);
                                assert.equal(this.attr, 2);
                                syncInitExecuted = true;
                            },
                            attributes: ['attr']
                        });
                    M.graph({
                        attr: 1
                    }).then(function () {
                        M_2.graph({
                            attr: 2
                        }).then(function () {
                            assert.ok(asyncInitExecuted);
                            assert.ok(syncInitExecuted);
                            done();
                        }).catch(done);
                    }).catch(done);
                });

                it('use singleton within', function (done) {
                    var C = siesta.collection('C');
                    var asyncInitExecuted = false;
                    var M = C.model('M', {
                            init: function (fromStorage, cb) {
                                assert.notOk(fromStorage);
                                M_2.one().then(function () {
                                    asyncInitExecuted = true;
                                    cb();
                                }).catch(cb);
                            },
                            attributes: ['attr']
                        }),
                        M_2 = C.model('M_2', {
                            attributes: ['attr'],
                            singleton: true
                        });
                    M.graph({
                        attr: 1
                    }).then(function () {
                        assert.ok(asyncInitExecuted);
                        done();
                    }).catch(done);
                });

                it('use with singleton', function (done) {
                    var C = siesta.collection('C');
                    var asyncInitExecuted = false;
                    var M = C.model('M', {
                            init: function (fromStorage, cb) {
                                assert.notOk(fromStorage);
                                M_2.one().then(function () {
                                    asyncInitExecuted = true;
                                    cb();
                                }).catch(cb);
                            },
                            attributes: ['attr'],
                            singleton: true
                        }),
                        M_2 = C.model('M_2', {
                            attributes: ['attr']
                        });
                    M.graph({
                        attr: 1
                    }).then(function () {
                        assert.ok(asyncInitExecuted);
                        done();
                    }).catch(done);
                });
            });

            it('valid', function (done) {
                var C = siesta.collection('C');
                var M = C.model('M', {
                    methods: {
                        f: function () {
                            return this.attr
                        }
                    },
                    attributes: ['attr']
                });
                siesta.install().then(function () {
                    M.graph({
                        attr: 'xyz'
                    })
                        .then(function (m) {
                            assert.equal(m.attr, m.f());
                            done();
                        })
                        .catch(done);
                }).catch(done);
            });
            it('clash', function (done) {
                var C = siesta.collection('C');
                var M = C.model('M', {
                    methods: {
                        restore: function () {
                            return 'a'
                        }
                    },
                    attributes: ['attr']
                });
                siesta.install().then(function () {
                    M.graph({
                        attr: 'xyz'
                    })
                        .then(function (m) {
                            assert.notEqual(m.restore(), 'a', 'Should not replace existing definitions')
                            done();
                        })
                        .catch(done);
                }).catch(done);
            });

            it('sync remove', function (done) {
                var C = siesta.collection('C');
                var m;
                var M = C.model('M', {
                    remove: function () {
                        assert.equal(this, m);
                        done();
                    },
                    attributes: ['attr']
                });
                siesta.install()
                    .then(function () {
                        M.graph({
                            attr: 1
                        })
                            .then(function (_m) {
                                m = _m;
                                _m.remove();
                            });
                    })
                    .catch(done);
            });
            it('async remove', function (done) {
                var C = siesta.collection('C');
                var m;
                var removeCalled = false;
                var M = C.model('M', {
                    remove: function (cb) {
                        assert.equal(this, m);
                        removeCalled = true;
                        cb();
                    },
                    attributes: ['attr']
                });
                siesta.install()
                    .then(function () {
                        M.graph({
                            attr: 1
                        })
                            .then(function (_m) {
                                m = _m;
                                _m.remove()
                                    .then(function () {
                                        assert.ok(removeCalled);
                                        done();
                                    })
                                    .catch(done);
                            });
                    })
                    .catch(done);
            });
            it('init on restore', function (done) {
                var C = siesta.collection('C');
                var m;
                var initCalled = false;
                var M = C.model('M', {
                    init: function (restored) {
                        assert.notOk(restored);
                        assert.equal(this.attr, 1);
                        initCalled = true;
                    },
                    attributes: ['attr']
                });
                siesta.install()
                    .then(function () {
                        M.graph({
                            attr: 1
                        }).then(function (_m) {
                            m = _m;
                            _m.remove()
                                .then(function () {
                                    initCalled = false;
                                    M.init = function (restored) {
                                        assert.ok(restored);
                                        assert.equal(this.attr, 1);
                                        initCalled = true;
                                    };
                                    _m.restore();
                                    assert.ok(initCalled);
                                    done();
                                }).catch(done);
                        }).catch(done);
                    })
                    .catch(done);
            });
        });
        describe('statics', function () {
            it('valid', function (done) {
                var C = siesta.collection('C');
                var M = C.model('M', {
                    statics: {
                        f: function () {
                            return this
                        }
                    },
                    attributes: ['attr']
                });
                siesta.install().then(function () {
                    assert.equal(M.f(), M);
                    done();
                }).catch(done);
            });
            it('clash', function (done) {
                var C = siesta.collection('C');
                var staticMethod = function () {
                    return 'a';
                };
                var M = C.model('M', {
                    statics: {
                        query: staticMethod
                    },
                    attributes: ['attr']
                });
                siesta.install().then(function () {
                    assert.notEqual(M.query(), 'a', 'Existing statics should not be replaced...');
                    done();
                }).catch(done);
            });

        });
        describe('properties', function () {
            it('define properties', function (done) {
                var C = siesta.collection('C');
                var M = C.model('M', {
                    properties: {
                        prop: {
                            get: function () {
                                return 'a'
                            }
                        }
                    },
                    attributes: ['attr']
                });
                siesta.install()
                    .then(function () {
                        M.graph({
                            attr: 1
                        })
                            .then(function (_m) {
                                assert.equal(_m.prop, 'a');
                                done();
                            }).catch(done);
                    })
                    .catch(done);
            });
            it('clash', function (done) {
                var C = siesta.collection('C');
                var M = C.model('M', {
                    properties: {
                        restore: {
                            get: function () {
                                return 'a'
                            }
                        }
                    },
                    attributes: ['attr']
                });
                siesta.install()
                    .then(function () {
                        M.graph({
                            attr: 1
                        })
                            .then(function (_m) {
                                assert.notEqual(_m.restore, 'a');
                                done();
                            }).catch(done);
                    })
                    .catch(done);
            });

        });
    });


});