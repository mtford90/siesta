var s = require('../index'),
    assert = require('chai').assert;

describe('recursive relationships', function() {

    var Collection = require('../src/collection').Collection;
    var cache = require('../src/cache');
    var collection;
    var Repo;

    beforeEach(function(done) {
        s.reset(true);
        collection = new Collection('MyCollection');
        collection.baseURL = 'https://api.github.com';
        Repo = collection.mapping('Repo', {
            id: 'id',
            attributes: ['name'],
            relationships: {
                forkedFrom: {
                    mapping: 'Repo',
                    type: 'OneToMany',
                    reverse: 'forks'
                }
            }
        });
        collection.install(done);
    });

    // describe.only('installation', function () {
	   //  it('xyz', function (done) {
	   //  	console.log('relationships', Repo.relationships);
	   //  	done();
	   //  });
    // });


    it('map', function (done) {
    	var masterRepoData = {id: '5', name: 'Master Repo'};
    	Repo.map(masterRepoData, function (err, repo) {
    		if (err) {
    			done(err);
    		}
    		else {
    			var childRepoData = {id: '6', name: 'Child Repo', forkedFrom: {_id: repo._id}};
    			Repo.map(childRepoData, function (err, childRepo) {
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