describe('mapping validation', function () {

    var Mapping, Pouch;

    beforeEach(function () {
        module('restkit.mapping', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Mapping_, _Pouch_) {
            Mapping = _Mapping_;
            Pouch = _Pouch_;
        });

        Pouch.reset();

    });

    describe('validation', function () {
        it('no type', function () {
            var m = new Mapping({
                id: 'id',
                attributes: ['field1', 'field2'],
                api: 'myApi'
            });
            var errors = m._validate();
            console.log('errors:', errors);
            assert.equal(1, errors.length);
        });
        it('no api', function () {
            var m = new Mapping({
                id: 'id',
                attributes: ['field1', 'field2'],
                type: 'Car'
            });
            var errors = m._validate();
            console.log('errors:', errors);
            assert.equal(1, errors.length);
        });
    });


});