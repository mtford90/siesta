describe.only('request descriptor', function () {

    var RestAPI, RequestDescriptor;

    beforeEach(function () {
        module('restkit.requestDescriptor', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_RestAPI_, _RequestDescriptor_) {
            RestAPI = _RestAPI_;
            RequestDescriptor = _RequestDescriptor_;
        });

        RestAPI._reset();
    });

    it('dsfsdfsdf', function () {
        var r = new RequestDescriptor({path: '/cars/(?<id>[0-9])/'});
        console.log(r._matchPath('/cars/5/'));

    });

});