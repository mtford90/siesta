/**
 * Functions used in configuration of and interaction with Siesta/Github.
 * @module data
 */

function configureCollection() {
    collection = new siesta.Collection('MyCollection');
    collection.baseURL = 'https://api.github.com';
}

function configureMappings() {
    Repo = collection.model('Repo', {
        id: 'id',
        attributes: ['name', 'full_name', 'description', 'html_url', 'subscribers_count', 'stargazers_count', 'forks'],
        relationships: {
            owner: {
                mapping: 'User',
                type: 'OneToMany',
                reverse: 'repositories'
            },
            forked_from: {
                mapping: 'Repo',
                type: 'OneToMany',
                reverse: 'forked_to'
            }
        }
    });
    User = collection.model('User', {
        id: 'id',
        attributes: ['login', 'avatar_url', 'html_url'],
        relationships: {
            followers: {
                mapping: 'User',
                type: 'ManyToMany',
                reverse: 'following'
            }
        }
    });
}

function configureDescriptors() {
    collection.descriptor({
        path: '/search/repositories',
        mapping: Repo,
        method: 'GET',
        data: 'items'
    });
    collection.descriptor({
        path: '/repos/(.*)/(.*)/forks',
        mapping: Repo,
        method: 'GET'
    });
    collection.descriptor({
        path: '/repos/(.*)/(.*)',
        mapping: Repo,
        method: 'GET'
    });
    collection.descriptor({
        path: '/users/(.*)/repos',
        mapping: Repo,
        method: 'GET'
    });
    collection.descriptor({
        path: '/users/(.*)/followers',
        mapping: User,
        method: 'GET'
    });
}

function searchForRepo(query, cb) {
    collection.GET('/search/repositories', {
        data: {
            q: query
        }
    }, cb);
}

function getReposForUserModel(userModel, callback) {
    var path = '/users/' + userModel.login + '/repos';
    collection.GET(path, function(err, repos) {
        if (err) {
            callback(err);
        } else {
            if (err) {
                callback(err);
            } else {
                callback(null, repos);
            }
        }
    });
}

function getFollowers(userModel, cb) {
    var path = '/users/' + userModel.login + '/followers';
    collection.GET(path, cb);
}

function getSiesta(cb) {
    function _getSiesta() {
        collection.GET('/repos/mtford90/siesta', function(err, repo) {
            if (cb) cb(err, repo);
        });
    }
    if (!collection) {
        init(function() {
            _getSiesta(cb);
        });
    } else {
        _getSiesta(cb);
    }
}

function init(cb) {
    configureCollection();
    configureMappings();
    configureDescriptors();
    collection.install(function(err) {
        console.log('User', User);
        cb(err);
    });
}