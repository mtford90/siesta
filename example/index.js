var collection
    , repositories = []
    ;

function createRepoElement(repoModel) {
    var cloned = $('#template').clone();
    cloned.css('display', 'inherit');
    cloned.find('.user .username').text(repoModel.owner.login);
    cloned.find('h3.name').text(repoModel.name);
    cloned.find('.description').text(repoModel.description);
    cloned.find('.watchers .num').text(repoModel.watchers_count || 0);
    cloned.find('.stars .num').text(repoModel.stargazers_count || 0);
    cloned.find('.forks .num').text(repoModel.forks || 0);
    var url = repoModel.owner.avatar_url;
    cloned.find('img').attr('src', url);
    cloned.find('.repo').on('click', function () {
        var path = repoModel.html_url;
        console.log('open ' + path);
        window.open(path, '_blank');
    });
    var rows = $('#content #repos .row');
    var row;
    for (var i = 0; i < rows.length; i++) {
        row = rows[i];
        if ($(row).children().length < 4) break;
        else row = null;
    }
    if (!row) row = $('<div class="row"></div>');
    $('#content #repos').append(row);
    $(row).append(cloned);
}

function fadeReposOutGradually(cb) {
    fadeReposOut(300, cb);
}

function fadeReposOutImmediately(cb) {
    fadeReposOut(0, cb);
}

function fadeReposOut(t, cb) {
    $('#content #repos').finish().fadeOut(t, cb);
}

function fadeReposIn(cb) {
    $('#content #repos').finish().fadeIn(300, cb);
}

function _fadeSpinnerOut(t, cb) {
    $('#spinner').finish().fadeOut(t, cb);
}

function fadeSpinnerOutGradually(cb) {
    _fadeSpinnerOut(300, cb);
}

function fadeSpinnerOutImmediately(cb) {
    _fadeSpinnerOut(0, cb);
}

function fadeSpinnerIn(cb) {
    $('#spinner').finish().fadeIn(300, cb);
}

function init(cb) {
    console.log('init');
    collection = new siesta.Collection('MyCollection');
    collection.baseURL = 'https://api.github.com';
    var Repo = collection.mapping('Repo', {
        id: 'id',
        attributes: ['name', 'full_name', 'description', 'html_url', 'watchers_count', 'stargazers_count', 'forks'],
        relationships: {
            owner: {
                mapping: 'User',
                type: 'OneToMany',
                reverse: 'repositories'
            }
        }
    });
    var User = collection.mapping('User', {
        id: 'id',
        attributes: ['login', 'avatar_url']
    });
    collection.responseDescriptor({
        path: '/search/repositories',
        mapping: Repo,
        method: 'GET',
        data: 'items'
    });
    collection.install(cb);
}

function query() {
    var text = $('#INPUT_1').val();
    $('#INPUT_1').val('');
    $('#content #repos .row').remove();
    function _query(err) {
        console.log('_query');
        if (!err) {
            collection.GET('/search/repositories', {data: {q: text}}, function (err, repos) {
                fadeSpinnerOutGradually(function () {
                    repositories = repos;
                    _.each(repositories, createRepoElement);
                    fadeReposIn();
                });
            });
        }
        else {
            alert('TODO: Nicer errors: ' + err);
        }
    }

    fadeSpinnerIn();
    if (!collection) {
        $('#initial-text').fadeOut(300, function () {
            init(_query);
        });
    }
    else {
        _query();
    }
}

function queryKeyPress (e) {
    if (e.keyCode == 13) {
        query();
    }
}

window.onload = function () {
    fadeReposOutImmediately();
};

function visualise(btn) {
    console.log('visualise!', btn);
    var $btn = $(btn);
    if ($btn.text().toLowerCase() == 'visualise') {
        fadeReposOutGradually();
        $btn.text('Repos');
    }
    else {
        fadeReposIn();
        $btn.text('Visualise');
    }
}

function showStats() {
    var stats =
        '<p style="text-align: center !important;">The below provides a summary of the Siesta Object Graph:</p>' +
        '<p><ul><li>' +
        'There are 5 repositories distributed across 12 users' +
        '<li></ul></p>';
    sweetAlert('Statistics', stats)
}