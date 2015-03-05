var assert = require('chai').assert;

describe('recursive relationships', function () {

    var Collection, Repo;

    before(function () {
        siesta.ext.storageEnabled = false;
    });

    beforeEach(function (done) {
        siesta.reset(function () {
            Collection = siesta.collection('MyCollection');
            Repo = Collection.model('Repo', {
                id: 'id',
                attributes: ['name'],
                relationships: {
                    forkedFrom: {
                        model: 'Repo',
                        type: 'OneToMany',
                        reverse: 'forks'
                    }
                }
            });
            done();
        });
    });

    it('map', function (done) {
        var masterRepoData = {id: '5', name: 'Master Repo'};
        Repo.graph(masterRepoData, function (err, repo) {
            if (err) {
                done(err);
            }
            else {
                var childRepoData = {id: '6', name: 'Child Repo', forkedFrom: {localId: repo.localId}};
                Repo.graph(childRepoData, function (err, childRepo) {
                    if (err) {
                        done(err);
                    }
                    else {
                        assert.include(repo.forks, childRepo);
                        assert.equal(childRepo.forkedFrom, repo);
                        done();
                    }
                });
            }
        });
    });

});