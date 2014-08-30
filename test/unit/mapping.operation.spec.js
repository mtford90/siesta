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

        inject(function (Pouch, _BaseOperation_, _Collection_, _RelationshipType_) {
            Pouch.reset();
            Operation = _BaseOperation_;
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
                    op.work = function (done) {setTimeout(function () {done()}, 50)};
                    op.start();
                });

                it('operation should be running', function () {
                    assert.ok(op.running);
                });


            });

            describe('finish', function () {
                beforeEach(function (done) {
                    op.work = function (done) {setTimeout(function () {done()}, 50)};
                    op.completionCallback = done;
                    op.start();
                });

                it('operation should no longer be running', function () {
                    assert.notOk(op.running);
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