describe('http', function () {

    var RestAPI

    beforeEach(function () {
        module('restkit.http', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_RestAPI_) {
            RestAPI = _RestAPI_;
        });

        RestAPI._reset();
    });

    it('dsfsdfsdf', function () {

    });

});