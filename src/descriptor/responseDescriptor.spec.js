describe('response descriptor', function () {

    var Collection;

    beforeEach(function () {
        module('restkit.responseDescriptor', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Collection_) {
            Collection = _Collection_;
        });

        Collection._reset();
    });

    it('dsfsdfsdf', function () {

    });

});