describe('abc', function () {

    var Index, Pouch, Indexes;

    beforeEach(function () {
        module('restkit.indexing', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Index_, _Pouch_, _Indexes_) {
            Index = _Index_;
            Indexes = _Indexes_;
            Pouch = _Pouch_;
        });

        Pouch.reset();

    });

    describe('Index', function () {
        it('index name', function () {
            var i = new Index('Car', ['colour', 'name']);
            assert.equal(i._getName(), 'Index_Car_colour_name');
            i = new Index('Car', ['name', 'colour']);
            assert.equal(i._getName(), 'Index_Car_colour_name');
        });

        it('field array as string', function () {
            var i = new Index('Car', ['colour', 'name']);
            assert.equal(i._fieldArrayAsString(), '["colour","name"]');
        });

        it('map func', function () {
            var i = new Index('Car', ['colour', 'name']);
            var emissions = [];

            function emit(id, doc) {
                emissions.push({id: id, doc: doc});
            }

            var rawMap = i._constructMapFunction();
            console.log('rawMap', rawMap);
            eval('var mapFunc = ' + rawMap);
            mapFunc({type: 'Car', colour: 'red', name: 'Aston Martin'});
            console.log('emissions:', emissions);
            assert.equal(1, emissions.length);
            var emission = emissions[0];
            console.log('emission:', emission);
            assert.equal(emission.id, 'red_Aston Martin')
        });

        // Check that queries using the index work as expected with PouchDB.
        it('pouchdb index', function (done) {
            var i = new Index('Car', ['colour', 'name']);
            var view = i._constructPouchDbView();
            console.log('view:', view);
            Pouch.getPouch().put(view, function (err, resp) {
                if (err) done(err);
                console.log('put index response:', resp);
                Pouch.getPouch().post({type: 'Car', colour: 'red', name: 'Aston Martin'}, function (err, resp) {
                    if (err) done(err);
                    Pouch.getPouch().query(i._getName(), {key: 'red_Aston Martin'}, function (err, resp) {
                        if (err) done(err);
                        console.log('query response:', resp);
                        assert.equal(resp.total_rows, 1);
                        done();
                    });
                });
            });
        });

        it('installation', function (done) {
            var i = new Index('Car', ['colour', 'name']);
            i.install(function (err) {
                if (err) done(err);
                Pouch.getPouch().get('_design/' + i._getName(), function (err, doc) {
                    if (err) done(err);
                    assert.ok(doc);
                    done();
                });
            });
        })
    });

    describe.only('Indexes', function () {
        it('field combinations', function () {
            var combinations = Indexes._getFieldCombinations(['field1', 'field2', 'field3']);
            assert.equal(7, combinations.length);
        });

        it('indexes', function () {
            var indexes = Indexes._constructIndexes('Car', ['field1', 'field2', 'field3']);
            console.log('indexes', indexes);
            assert.equal(7, indexes.length);
            _.each(indexes, function (i) {assert.ok(i.install)});
        });

        it('bulk installation', function (done) {
            Indexes.installIndexes('Car',['field1', 'field2', 'field3'], function (err) {
                if (err) done(err);
                // Should be able to handle conflicts.
                Indexes.installIndexes('Car',['field1', 'field2', 'field3'], function (err) {
                    done(err);
                });
            });
        });
    });


});