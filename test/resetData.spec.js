var assert = require('chai').assert;

describe('Reset Data', function () {
    beforeEach(function (done) {
        siesta.reset(done);
    });

    var Collection, Model, SingletonModel;


    it('xyz', function (done) {
        Collection = siesta.collection('myCollection');
        Model = Collection.model('Person', {
            attributes: ['name', 'age']
        });
        SingletonModel = Collection.model('Person', {
            attributes: ['x', 'y'],
            singleton: true
        });
        siesta.install(function () {
            SingletonModel.one().then(function (firstModel) {
                assert.ok(firstModel);
                siesta.resetData().then(function () {
                    SingletonModel.one().then(function (secondModel) {
                        assert.ok(secondModel);
                        assert.notEqual(firstModel, secondModel);
                        done();
                    }).catch(done);
                }).catch(done);
            }).catch(done);
        });
    });
});