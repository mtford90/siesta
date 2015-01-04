var s = require('../../core/index'),
    assert = require('chai').assert;

describe('mapping!', function () {
    var Model = require('../../core/model');

    before(function () {
        s.ext.storageEnabled = false;
    });

    beforeEach(function (done) {
        s.reset(done);
    });

    it('_attributeNames', function () {
        var m = new Model({
            name: 'name',
            id: 'id',
            attributes: ['field1', 'field2']
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
            attributes: ['field1', 'field2']
        });
        var attributes = _.pluck(m.attributes, 'name');
        assert.include(attributes, 'field1');
        assert.include(attributes, 'field2');
    });

    it('name', function () {
        var m = new Model({
            name: 'name',
            id: 'id',
            attributes: ['field1', 'field2']
        });
        assert.equal(m.name, 'name');
    });

    it('id', function () {
        var m = new Model({
            name: 'name',
            id: 'id',
            attributes: ['field1', 'field2']
        });
        assert.equal(m.id, 'id');
    });

    describe('customisation', function () {
        describe('methods', function () {
            it('sync init', function (done) {
                var C = s.collection('C');
                var M = C.model('M', {
                    methods: {
                        __init: function () {
                            assert.equal(this.attr, 1);
                            done();
                        }
                    },
                    attributes: ['attr']
                });
                siesta.install()
                    .then(function () {
                        M.map({attr: 1});
                    })
                    .catch(done);
            });
            it('async init', function (done) {
                var C = s.collection('C');
                var initExecuted = false;
                var M = C.model('M', {
                    methods: {
                        __init: function (cb) {
                            assert.equal(this.attr, 1);
                            initExecuted = true;
                            cb();
                        }
                    },
                    attributes: ['attr']
                });
                siesta.install()
                    .then(function () {
                        M.map({attr: 1})
                            .then(function () {
                                assert.ok(initExecuted);
                                done();
                            })
                            .catch(done);
                    })
                    .catch(done);
            });
            it('mixture of async and sync init', function (done) {
                var C = s.collection('C');
                var asyncInitExecuted = false,
                    syncInitExecuted = false;
                var M = C.model('M', {
                        methods: {
                            __init: function (cb) {
                                assert.equal(this.attr, 1);
                                asyncInitExecuted = true;
                                cb();
                            }
                        },
                        attributes: ['attr']
                    }),
                    M_2 = C.model('M_2', {
                        methods: {
                            __init: function () {
                                assert.equal(this.attr, 2);
                                syncInitExecuted = true;
                            }
                        },
                        attributes: ['attr']
                    });
                siesta.install()
                    .then(function () {
                        M.map({attr: 1})
                            .then(function () {
                                M_2.map({attr: 2})
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
            it('valid', function (done) {
                var C = s.collection('C');
                var M = C.model('M', {
                    methods: {
                        f: function () {
                            return this.attr
                        }
                    },
                    attributes: ['attr']
                });
                C.install().then(function () {
                    M.map({attr: 'xyz'})
                        .then(function (m) {
                            assert.equal(m.attr, m.f());
                            done();
                        })
                        .catch(done).done();
                }).catch(done).done();
            });
            it('clash', function (done) {
                var C = s.collection('C');
                var M = C.model('M', {
                    methods: {
                        restore: function () {
                            return 'a'
                        }
                    },
                    attributes: ['attr']
                });
                C.install().then(function () {
                    M.map({attr: 'xyz'})
                        .then(function (m) {
                            assert.notEqual(m.restore(), 'a', 'Should not replace existing definitions')
                            done();
                        })
                        .catch(done).done();
                }).catch(done).done();
            });

            it('sync remove', function (done) {
                var C = s.collection('C');
                var m;
                var M = C.model('M', {
                    methods: {
                        __remove: function () {
                            assert.equal(this, m);
                            done();
                        }
                    },
                    attributes: ['attr']
                });
                siesta.install()
                    .then(function () {
                        M.map({attr: 1})
                            .then(function (_m) {
                                m = _m;
                                _m.remove();
                            });
                    })
                    .catch(done);
            });
            it('async remove', function (done) {
                var C = s.collection('C');
                var m;
                var __removeCalled = false;
                var M = C.model('M', {
                    methods: {
                        __remove: function (cb) {
                            assert.equal(this, m);
                            __removeCalled = true;
                            cb();
                        }
                    },
                    attributes: ['attr']
                });
                siesta.install()
                    .then(function () {
                        M.map({attr: 1})
                            .then(function (_m) {
                                m = _m;
                                _m.remove()
                                    .then(function () {
                                        assert.ok(__removeCalled);
                                        done();
                                    })
                                    .catch(done);
                            });
                    })
                    .catch(done);
            });
            it('init on restore', function (done) {
                var C = s.collection('C');
                var m;
                var __initCalled = false;
                var M = C.model('M', {
                    methods: {
                        __init: function () {
                            assert.equal(this.attr, 1);
                            __initCalled = true;
                        }
                    },
                    attributes: ['attr']
                });
                siesta.install()
                    .then(function () {
                        M.map({attr: 1})
                            .then(function (_m) {
                                m = _m;
                                _m.remove()
                                    .then(function () {
                                        __initCalled = false;
                                        _m.restore();
                                        assert.ok(__initCalled);
                                        done();
                                    }).catch(done);
                            }).catch(done);
                    })
                    .catch(done);
            });
        });
        describe('statics', function () {
            it('sync init', function (done) {
                var C = s.collection('C');
                var M;
                M = C.model('M', {
                    statics: {
                        __init: function () {
                            assert.equal(this, M);
                            done();
                        }
                    },
                    attributes: ['attr']
                });
                siesta.install().catch(done);
            });
            it('async init', function (done) {
                var C = s.collection('C');
                var initCalled = false;
                var M = C.model('M', {
                    statics: {
                        __init: function (cb) {
                            assert.equal(this, M);
                            initCalled = true;
                            cb();
                        }
                    },
                    attributes: ['attr']
                });
                siesta.install().then(function () {
                    assert.ok(initCalled);
                    done();
                }).catch(done);
            });
            it('mixture of sync and async init', function (done) {
                var C = s.collection('C');
                var syncInitCalled, asyncInitCalled;
                var M = C.model('M', {
                    statics: {
                        __init: function (cb) {
                            assert.equal(this, M);
                            asyncInitCalled = true;
                            cb();
                        }
                    },
                    attributes: ['attr']
                });
                var M_2 = C.model('M_2', {
                    statics: {
                        __init: function () {
                            assert.equal(this, M_2);
                            syncInitCalled = true;
                        }
                    },
                    attributes: ['attr']
                });
                siesta.install().then(function () {
                    assert.ok(syncInitCalled);
                    assert.ok(asyncInitCalled);
                    done();
                }).catch(done);
            });
            it('valid', function (done) {
                var C = s.collection('C');
                var M = C.model('M', {
                    statics: {
                        f: function () {
                            return this
                        }
                    },
                    attributes: ['attr']
                });
                C.install().then(function () {
                    assert.equal(M.f(), M);
                    done();
                }).catch(done).done();
            });

            it('clash', function (done) {
                var C = s.collection('C');
                var staticMethod = function () {
                    return 'a';
                };
                var M = C.model('M', {
                    statics: {
                        query: staticMethod
                    },
                    attributes: ['attr']
                });
                C.install().then(function () {
                    assert.notEqual(M.query(), 'a', 'Existing statics should not be replaced...');
                    done();
                }).catch(done).done();
            });

        });
        describe('properties', function () {
            it('define properties', function (done) {
                var C = s.collection('C');
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
                        M.map({attr: 1})
                            .then(function (_m) {
                                assert.equal(_m.prop, 'a');
                                done();
                            }).catch(done);
                    })
                    .catch(done);
            });
            it('clash', function (done) {
                var C = s.collection('C');
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
                        M.map({attr: 1})
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