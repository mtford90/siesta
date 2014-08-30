describe('collection setup', function () {

    var Collection, RelationshipType, Pouch, RestObject, ResponseDescriptor, DescriptorRegistry, RequestDescriptor, Serialiser;

    beforeEach(function () {
        module('restkit.mapping', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });
        module('restkit.relationship', function ($provide) {
            $provide.value('$log', console);
            $provide.value('$q', Q);
        });

        inject(function (_Collection_, _Serialiser_, _RelationshipType_, _Pouch_, _$rootScope_, _RestObject_, _ResponseDescriptor_, _RequestDescriptor_, _DescriptorRegistry_) {
            $rootScope = _$rootScope_;
            Collection = _Collection_;
            RelationshipType = _RelationshipType_;
            Pouch = _Pouch_;
            RestObject = _RestObject_;
            ResponseDescriptor = _ResponseDescriptor_;
            RequestDescriptor = _RequestDescriptor_;
            DescriptorRegistry = _DescriptorRegistry_;
            Serialiser = _Serialiser_;
        });

        Pouch.reset();
    });

    describe('configure using configure function', function () {
        var collection;
        beforeEach(function (done) {
            collection = new Collection('MyCollection');
            done();
        });

        it('not installed', function () {
            assert.notOk(collection.installed);
        });

        describe('configure', function () {

            it('eventually finishes', function (done) {
                collection.install(function (err) {
                    if (err) done(err);
                });
            });

            it('raises an error if trying to configure twice', function (done) {
                collection.configure(function (err) {
                    if (err) done(err);
                    collection.configure(function (err) {
                        assert.ok(err);
                        done();
                    })
                });
            });

        });
    });

    describe('attempts to configure without using the configure callback', function () {
        // TODO
    })

});