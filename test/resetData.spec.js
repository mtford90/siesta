var s = require('../core/index'),
    assert = require('chai').assert;

describe('Reset Data', function () {
    beforeEach(function (done) {
        s.reset(done);
    });

    var Collection, Model, SingletonModel;


    it('xyz', function (done) {
        Collection = s.collection('myCollection');
        Model = Collection.model('Person', {
            attributes: ['name', 'age']
        });
        SingletonModel = Collection.model('Person', {
            attributes: ['x', 'y'],
            singleton: true
        });
        s.install(function () {
            SingletonModel.one().then(function (firstModel) {
                assert.ok(firstModel);
                s.resetData().then(function () {
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