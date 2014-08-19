describe('query', function () {

    var Index, Pouch, Indexes, Query;

    beforeEach(function () {
        module('restkit.query', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Index_, _Pouch_, _Indexes_, _Query_) {
            Index = _Index_;
            Indexes = _Indexes_;
            Pouch = _Pouch_;
            Query = _Query_;
        });

        Pouch.reset();

    });

    it('design doc name', function () {
        console.log(Query);
        var name = new Query('Car', {colour: 'red', name:'Aston Martin'})._getDesignDocName();
        assert.equal(name, '_design/Index_Car_colour_name');
    });



    it('fields', function () {
        console.log(Query);
        var q = new Query('Car', {colour: 'red', name:'Aston Martin'});
        var fields = q._getFields();
        assert.include(fields, 'colour');
        assert.include(fields, 'name');
    });

    it('construct key', function () {
        console.log(Query);
        var q = new Query('Car', {colour: 'red', name:'Aston Martin'});
        var key = q._constructKey();
        assert.equal(key, 'red_Aston Martin');
    });

    it('execute with no index', function (done) {
        console.log(Query);
        var q = new Query('Car', {colour: 'red', name:'Aston Martin'});
        q.execute(function(err, results) {
            assert.equal(err.status, 404);
            done();
        });
    });

    it('execute with index', function (done) {
        console.log(Query);
        var q = new Query('Car', {colour: 'red', name:'Aston Martin'});
        var i = new Index('Car', ['colour', 'name']);
        i.install(function (err) {
            if (err) done(err);
            q.execute(function(err, results) {
                if (done) done (err);
                console.log('query results:', results);
                assert.equal(results.length, 0);
                done();
            });
        });
    });

    it('execute with index with rows', function (done) {
        console.log(Query);
        var q = new Query('Car', {colour: 'red', name:'Aston Martin'});
        var i = new Index('Car', ['colour', 'name']);
        i.install(function (err) {
            if (err) done(err);
            Pouch.getPouch().post({'type': 'Car', colour:'red', name: 'Aston Martin'}, function (err) {
                if (err) done(err);
                q.execute(function(err, results) {
                    if (done) done (err);
                    console.log('query results:', results);
                    assert.equal(results.length, 1);
                    done();
                });
            });
        });
    });
});