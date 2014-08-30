describe('operations', function () {

    var Operation, Collection, RelationshipType;

    beforeEach(function () {
        module('restkit.mapping.operation', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });
        module('restkit', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (Pouch, _Operation_, _Collection_, _RelationshipType_) {
            Pouch.reset();
            Operation = _Operation_;
            Collection = _Collection_;
            RelationshipType = _RelationshipType_;
        });
    });

    describe('registration', function () {

        describe('one operation', function () {
            var op;
            beforeEach(function () {
                op = new Operation();
            });

            describe('start', function () {
                beforeEach(function () {
                    op.start();
                });
                it('should be one running operation', function () {
                    assert.equal(Operation.runningOperations.length, 1);
                });

                it('operation should be running', function () {
                    assert.ok(op.running);
                });

                it('operations should be running', function () {
                    assert.ok(Operation.operationsAreRunning);
                });

                describe('finish', function () {
                    beforeEach(function () {
                        op.finish();
                    });

                    it('operation should no longer be running', function () {
                        assert.notOk(op.running);
                    });

                    it('should no longer be any running operations', function () {
                        assert.notOk(Operation.runningOperations.length);
                    });

                    it('operations should not be running', function () {
                        assert.notOk(Operation.operationsAreRunning);
                    });
                });
            });


        });

    });

    describe('mapping operation', function () {
        var carMapping, personMapping, collection;

        beforeEach(function (done) {
            collection = new Collection('myCollection');

            carMapping = collection.mapping('Car', {
                id: 'id',
                attributes: ['colour', 'name'],
                relationships: {
                    owner: {
                        mapping: 'Person',
                        type: RelationshipType.ForeignKey,
                        reverse: 'cars'
                    }
                }
            });
            personMapping = collection.mapping('Person', {
                id: 'id',
                attributes: ['name', 'age']
            });

            collection.install(done);

        });


        it('single', function (done) {
            var op = carMapping.map({colour: 'red', name: 'Aston Martin', id: 'remoteId'}, function (err, obj) {
                if (err) done(err);
                assert.notOk(op.running);
                done();
            });
            assert.ok(op.running);
        });

        it('bulk', function (done) {
            var op = carMapping.map([
                {colour: 'red', name: 'Aston Martin', id: 'remoteId1', owner: 'ownerId'},
                {colour: 'blue', name: 'chevy', id: 'remoteId2', owner: 'ownerId'}
            ], function (err, obj) {
                if (err) done(err);
                assert.notOk(op.running);
                done();
            });
            assert.ok(op.running);
        })

    });


});