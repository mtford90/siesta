describe('pouch doc adapter', function () {

    var RestAPI;

    beforeEach(function () {
        module('restkit.pouchDocAdapter', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_RestAPI_) {
            RestAPI = _RestAPI_;
        });

        RestAPI._reset();
    });

    it('asdasfcv', function () {

    });

});