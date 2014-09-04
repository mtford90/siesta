var s = require('../index')
    , assert = require('chai').assert;


describe('indexes', function () {


    var Index = require('../src/index').Index;
    var Pouch = require('../src/pouch');
    var index = require('../src/index');

    beforeEach(function () {
        s.reset(true);

    });

    describe('Index', function () {
        it('index name', function () {
            var i = new Index('myCollection', 'Car', ['colour', 'name']);
            assert.equal(i._getName(), 'myCollection_Index_Car_colour_name');
            i = new Index('myCollection', 'Car', ['name', 'colour']);
            assert.equal(i._getName(), 'myCollection_Index_Car_colour_name');
        });


        it('map func', function () {
            var i = new Index('myCollection', 'Car', ['colour', 'name']);
            var emissions = [];

            function emit(id, doc) {
                emissions.push({id: id, doc: doc});
            }

            var rawMap = i._constructMapFunction();
            eval('var mapFunc = ' + rawMap);
            mapFunc({type: 'Car', colour: 'red', name: 'Aston Martin', collection: 'myCollection'});
            assert.equal(1, emissions.length);
            var emission = emissions[0];
            assert.equal(emission.id, 'red_Aston Martin')
        });

        // Check that queries using the index work as expected with PouchDB.
        it('pouchdb index', function (done) {
            var i = new Index('myCollection', 'Car', ['colour', 'name']);
            var view = i._constructPouchDbView();
            console.log('view:', view);
            Pouch.getPouch().put(view, function (err, resp) {
                if (err) done(err);
                console.log('put index response:', resp);
                Pouch.getPouch().post({type: 'Car', colour: 'red', name: 'Aston Martin', collection: 'myCollection'}, function (err, resp) {
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
            var i = new Index('myCollection', 'Car', ['colour', 'name']);
            i.install(function (err) {
                if (err) done(err);
                assert.include(Index.indexes, i);
                Pouch.getPouch().get('_design/' + i._getName(), function (err, doc) {
                    if (err) done(err);
                    assert.ok(doc);
                    done();
                });
            });
        })
    });

    describe('Indexes', function () {
        it('field combinations', function () {
            var combinations = index._getFieldCombinations(['field1', 'field2', 'field3']);
            assert.equal(8, combinations.length);
        });

        it('indexes', function () {
            var indexes = index._constructIndexes('myCollection', 'Car', ['field1', 'field2', 'field3']);
            console.log('indexes', indexes);
            assert.equal(8, indexes.length);
            _.each(indexes, function (i) {assert.ok(i.install)});
        });

        it('bulk installation', function (done) {
            index.installIndexes('myCollection', 'Car', ['field1', 'field2', 'field3'], function (err) {
                if (err) done(err);
                // Should be able to handle conflicts.
                index.installIndexes('myCollection', 'Car', ['field1', 'field2', 'field3'], function (err) {
                    done(err);
                });
            });
        });
    });


});