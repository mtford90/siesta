describe('operations!!!', function () {

    var BaseOperation, CompositeOperation;

    beforeEach(function () {
        module('restkit.mapping.operation', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_CompositeOperation_, _BaseOperation_) {
            BaseOperation = _BaseOperation_;
            CompositeOperation = _CompositeOperation_;
        });

    });

    describe('BaseOperation', function () {

        var op;

        beforeEach(function () {
            op = new BaseOperation('op');
        });

        describe('initial state', function () {
            it('should not be completed', function () {
                assert.notOk(op.completed);
            });

            it('should be no result', function () {
                assert.notOk(op.result);
            });

            it('should not be running', function () {
                assert.notOk(op.running);
            });

            it('should not have an error', function () {
                assert.notOk(op.error);
            });

            it('should have a name', function () {
                assert.equal(op.name, 'op');
            });

            it('should not have failed', function () {
                assert.notOk(op.failed);
            })
        });

        describe('running state', function () {

            beforeEach(function () {
                op.work = function (callback) {
                    setTimeout(function () {
                        callback();
                    }, 50);
                };
                op.start();
            });

            it('should not be completed', function () {
                assert.notOk(op.completed);
            });

            it('should be no result', function () {
                assert.notOk(op.result);
            });

            it('should be running', function () {
                assert.ok(op.running);
            });

            it('should not have an error', function () {
                assert.notOk(op.error);
            });

            it('should not have failed', function () {
                assert.notOk(op.failed);
            })

        });

        describe('completion state', function () {

            describe('no error', function () {
                beforeEach(function (done) {
                    op.work = function (callback) {
                        callback(null, 'xyz');
                    };
                    op.completionCallback = function () {
                        done();
                    };
                    op.start();
                });

                it('should be completed', function () {
                    assert.ok(op.completed);
                });

                it('should have a result', function () {
                    assert.equal(op.result, 'xyz');
                });

                it('should not be running', function () {
                    assert.notOk(op.running);
                });

                it('should not have an error', function () {
                    assert.notOk(op.error);
                });

                it('should not have failed', function () {
                    assert.notOk(op.failed);
                })
            });

            describe('error', function () {
                beforeEach(function (done) {
                    op.work = function (callback) {
                        callback('error');
                    };
                    op.completionCallback = function () {
                        done();
                    };
                    op.start();
                });

                it('should be completed', function () {
                    assert.ok(op.completed);
                });

                it('should not have a result', function () {
                    assert.notOk(op.result);
                });

                it('should not be running', function () {
                    assert.notOk(op.running);
                });

                it('should have an error', function () {
                    assert.equal(op.error, 'error');
                });

                it('should have failed', function () {
                    assert.ok(op.failed);
                })
            });




        });


    });

    describe('CompositeOperation', function () {
        var op;

        beforeEach(function () {
            op = new CompositeOperation('op');
        });

        describe('initial state', function () {
            it('should not be completed', function () {
                assert.notOk(op.completed);
            });

            it('should be no result', function () {
                assert.notOk(op.result);
            });

            it('should not be running', function () {
                assert.notOk(op.running);
            });

            it('should not have an error', function () {
                assert.notOk(op.error);
            });

            it('should have a name', function () {
                assert.equal(op.name, 'op');
            });

            it('should not have failed', function () {
                assert.notOk(op.failed);
            })
        });

        describe('running state', function () {

            beforeEach(function () {
                op.operations = [
                    new BaseOperation('op1', function(c) {setTimeout(function () {c();}, 50)}),
                    new BaseOperation('op2', function(c) {setTimeout(function () {c();}, 50)}),
                    new BaseOperation('op3', function(c) {setTimeout(function () {c();}, 50)})
                ];
                op.start();
            });

            it('should not be completed', function () {
                assert.notOk(op.completed);
            });

            it('should be no result', function () {
                assert.notOk(op.result);
            });

            it('should be running', function () {
                assert.ok(op.running);
            });

            it('should not have an error', function () {
                assert.notOk(op.error);
            });

            it('should not have failed', function () {
                assert.notOk(op.failed);
            })
        });

        describe('finished state', function () {

            describe('no errors', function () {
                beforeEach(function (done) {
                    op.operations = [
                        new BaseOperation('op1', function(c) {setTimeout(function () {c(null, 'res1');}, 50)}),
                        new BaseOperation('op2', function(c) {setTimeout(function () {c(null, 'res2');}, 50)}),
                        new BaseOperation('op3', function(c) {setTimeout(function () {c(null, 'res3');}, 50)})
                    ];
                    op.completionCallback = done;
                    op.start();
                });

                it('should be completed', function () {
                    assert.ok(op.completed);
                });

                it('should be a result', function () {
                    assert.ok(op.result);
                    assert.equal(op.result[0], 'res1');
                    assert.equal(op.result[1], 'res2');
                    assert.equal(op.result[2], 'res3');
                });

                it('should not be running', function () {
                    assert.notOk(op.running);
                });

                it('should not have an error', function () {
                    assert.notOk(op.error);
                });

                it('should not have failed', function () {
                    assert.notOk(op.failed);
                })
            });

            describe('all errors', function () {
                beforeEach(function (done) {
                    op.operations = [
                        new BaseOperation('op1', function(c) {setTimeout(function () {c('error1');}, 50)}),
                        new BaseOperation('op2', function(c) {setTimeout(function () {c('error2');}, 50)}),
                        new BaseOperation('op3', function(c) {setTimeout(function () {c('error3');}, 50)})
                    ];
                    op.completionCallback = done;
                    op.start();
                });

                it('should be completed', function () {
                    assert.ok(op.completed);
                });

                it('should not be a result', function () {
                    assert.notOk(op.result);
                });

                it('should not be running', function () {
                    assert.notOk(op.running);
                });

                it('should have an error', function () {
                    assert.ok(op.error);
                    assert.equal(op.error[0], 'error1');
                    assert.equal(op.error[1], 'error2');
                    assert.equal(op.error[2], 'error3');
                });

                it('should have failed', function () {
                    assert.ok(op.failed);
                });

            });

            describe('some errors', function () {
                beforeEach(function (done) {
                    op.operations = [
                        new BaseOperation('op1', function(c) {setTimeout(function () {c('error1');}, 50)}),
                        new BaseOperation('op2', function(c) {setTimeout(function () {c(null, 'res1');}, 50)}),
                        new BaseOperation('op3', function(c) {setTimeout(function () {c('error2');}, 50)})
                    ];
                    op.completionCallback = done;
                    op.start();
                });

                it('should be completed', function () {
                    assert.ok(op.completed);
                });

                it('should be a result', function () {
                    assert.ok(op.result);
                    assert.notOk(op.result[0]);
                    assert.equal(op.result[1], 'res1');
                    assert.notOk(op.result[2]);
                });

                it('should not be running', function () {
                    assert.notOk(op.running);
                });

                it('should have an error', function () {
                    assert.ok(op.error);
                    assert.equal(op.error[0], 'error1');
                    assert.notOk(op.error[1]);
                    assert.equal(op.error[2], 'error2');
                });

                it('should have failed', function () {
                    assert.ok(op.failed);
                });

            });




        });


    });


});