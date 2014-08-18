describe('abc', function () {

    var RestAPI, ObjectMapping;

    beforeEach(function () {
        module('restkit.mapping', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_RestAPI_, _ObjectMapping_) {
            RestAPI = _RestAPI_;
            ObjectMapping = _ObjectMapping_;
        });

        RestAPI._reset();

    });

    describe('Create Rest API', function () {
        it('abc', function (done) {
            var pouch = new PouchDB('asdasdas');
            console.log(pouch);
            pouch.put({
                name: 'hi'
            }, 'asdasd', function () {
                done();
            });
        });
    });

});