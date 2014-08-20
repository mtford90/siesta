describe.only('relationship', function () {

    var RestAPI;

    beforeEach(function () {
        module('restkit.relationship', function ($provide) {
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