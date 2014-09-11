var collection;

function getRepos() {
    collection.GET('/repositories', function (err, repos) {
        console.log('Got repos', repos);
    });
}

window.onload = function () {
    collection = new siesta.Collection('MyCollection');
    collection.baseURL = 'https://api.github.com';
    var Repo = collection.mapping('Repo', {
        id: 'id',
        attributes: ['name', 'full_name', 'description'],
        relationships: {
            owner: {
                mapping: 'User',
                type: siesta.RelationshipType.ForeignKey,
                reverse: 'repositories'
            }
        }
    });
    var User = collection.mapping('User', {
        id: 'id',
        attributes: ['login']
    });
    collection.responseDescriptor({
        path: '/repositories',
        mapping: Repo,
        method: 'GET'
    });
    collection.install(function (err) {
        if (!err) {
            getRepos();
        }
        else {
            console.error(err);
        }
    });
};