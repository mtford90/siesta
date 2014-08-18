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

//        RestAPI._reset();

//        done();

    });

    describe('Create Rest API', function () {
//
//        it('abc', function (done) {
//            var api = new RestAPI('Cars', function (err) {
//                if (err) done(err);
//                done();
//                var t = setInterval(function() {
//                    $rootScope.$apply();
//                }, 100);
//            });
//        });

        it('abc', function (done) {
            var pouch = new PouchDB('asdasdas');
            console.log(pouch);
            pouch.post({
                name: 'hi'
            }, function () {
                done();
            });
        });


    });

});