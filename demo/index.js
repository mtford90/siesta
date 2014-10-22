var collection
    , repositories = []
    ;

var User, Fork, Repo;

function showForks(repoModel) {
//    var spinner = '<div class="fork-body">' +
//        '<div class="spinner fork-spinner" style="margin-top: 30px !important; margin-bottom: 10px">' +
//        '<div class="cube1"></div>' +
//        '<div class="cube2"></div>' +
//        '</div>' +
//        '<div id="forks"></div></div>';
//    sweetAlert('Forks (' + repoModel.name + ')', spinner);
    fadeReposOutGradually(function () {
        removeAllRepoElements();
        fadeSpinnerIn(function () {
            var path = '/repos/' + repoModel.owner.login + '/' + repoModel.name + '/forks';
            console.log('path', path);
            collection.GET(path, function (err, repos) {
                if (err) {
                    // TODO
                }
                else {
                    var rawForks = _.map(repos, function (r) {return {source: {_id: repoModel._id}, fork: {_id: r._id}}});
                    console.log('rawForks', rawForks);
                    Fork.map(rawForks, function (err, forks) {
                        console.log('Forks made!', forks);
                        if (err) {
                            // TODO
                        }
                        else {
                            siesta.save(function (err) {
                                if (err) {
                                    // TODO
                                }
                                else {
                                    repositories = _.pluck(forks, 'fork');
                                    fadeSpinnerOutGradually(function () {
                                        createRepoElements();
                                    });
//                            $('.fork-spinner').fadeOut(300, function () {
//                                $('.confirm').attr('disabled', false);
//                                _.each(forks, function (f) {
//                                    $('.fork-body #forks').append('<p>' + f.fork.name + '</p>')
//                                });
//                                console.log('Forks saved!', forks);
//                            });
                                }
                            });
                        }
                    });
                }
            });
        });
    });

//    $('.confirm').attr('disabled', true);

}

function createRepoElement(repoModel) {
    var cloned = $('#template').clone();
    cloned.css('display', 'inherit');
    var $repo = cloned.find('.repo');
    var $user = cloned.find('.user');
    $user.hover(function () {
        $(this).addClass('hovered');
        $repo.removeClass('hovered');
    }, function () {
        $(this).removeClass('hovered');
        $repo.addClass('hovered');
    });
    $repo.hover(function () {
        if (!$(this).find('.hovered').length) {
            $(this).addClass('hovered');
        }
    }, function () {
        $(this).removeClass('hovered');
    });
    cloned.find('.user .username').text(repoModel.owner.login);
    cloned.find('h3.name').text(repoModel.name);
    cloned.find('.description').text(repoModel.description);
    cloned.find('.watchers .num').text(repoModel.watchers_count || 0);
    cloned.find('.stars .num').text(repoModel.stargazers_count || 0);
    cloned.find('.forks .num').text(repoModel.forks || 0);
    var $forks = cloned.find('.forks');
    $forks.hover(function () {
        $(this).addClass('hovered');
        $repo.removeClass('hovered');
    }, function () {
        $(this).removeClass('hovered');
        $repo.addClass('hovered');
    });
    var url = repoModel.owner.avatar_url;
    cloned.find('img').attr('src', url);
    $repo.on('click', function () {
        var path = repoModel.html_url;
        console.log('open ' + path);
        window.open(path, '_blank');
    });
    $user.on('click', function (e) {
        e.stopPropagation();
    });
    $forks.on('click', function (e) {
        e.stopPropagation();
        showForks(repoModel);
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

function fadeVisualisationIn(cb) {
    $('#visualisation').finish().fadeIn(300, cb);
}

function fadeVisualisationOut(cb) {
    $('#visualisation').finish().fadeOut(300, cb);
}

function init(cb) {
    siesta.setPouch(new PouchDB('siesta'));
    collection = new siesta.Collection('MyCollection');
    collection.baseURL = 'https://api.github.com';
    Repo = collection.mapping('Repo', {
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
    Fork = collection.mapping('Fork', {
        relationships: {
            source: {
                mapping: 'Repo',
                type: 'OneToMany',
                reverse: 'forked_to'
            },
            fork: {
                mapping: 'Repo',
                type: 'OneToOne',
                reverse: 'forked_from'
            }
        }
    });
    User = collection.mapping('User', {
        id: 'id',
        attributes: ['login', 'avatar_url']
    });
    collection.responseDescriptor({
        path: '/search/repositories',
        mapping: Repo,
        method: 'GET',
        data: 'items'
    });
//    /repos/:owner/:repo/forks
    collection.responseDescriptor({
        path: '/repos/(.*)/(.*)/forks',
        mapping: Repo,
        method: 'GET'
    });
    collection.install(cb);
}

function removeAllRepoElements() {
    $('#content #repos .row').remove();
}

function createRepoElements() {
    if (!repositories.length) {
        $('#no-results').fadeIn(300);
    }
    _.each(repositories, createRepoElement);
    fadeReposIn();
}
function _query() {
    var text = $('#INPUT_1').val();
    $('#INPUT_1').val('');
    removeAllRepoElements();
    function remoteQuery(err) {
        if (!err) {
            collection.GET('/search/repositories', {data: {q: text}}, function (err, repos) {
                siesta.save(function (err) {
                    if (err) {
                        fadeSpinnerOutGradually(function () {
                            alert('TODO: Nicer errors: ' + err);
                        });
                    }
                    else {
                        fadeSpinnerOutGradually(function () {
                            repositories = repos;
                            createRepoElements();
                        });
                    }
                });

            });
        }
        else {
            alert('TODO: Nicer errors: ' + err);
        }
    }

    fadeSpinnerIn();
    $('#no-results').fadeOut(300);
    if (!collection) {
        init(remoteQuery);
    }
    else {
        remoteQuery();
    }
}

function query() {
    if ($('#visualise').text().toLowerCase() == 'repos') {
        backToRepos(function () {
            _query();
        });
    }
    else {
        _query();
    }
}

function queryKeyPress(e) {
    if (e.keyCode == 13) {
        query();
    }
}

window.onload = function () {
    fadeReposOutImmediately();
};

function backToRepos(cb) {
    $('#svg').remove();
    fadeSpinnerOutGradually(function () {
        fadeReposIn();
        if (cb) cb();
    });
}

function visualisePressed(btn) {
    console.log('visualise!', btn);
    var $btn = $(btn);
    if ($btn.text().toLowerCase() == 'visualise') {
        fadeReposOutGradually(function () {
            fadeSpinnerIn(function () {
                showVis();
                fadeSpinnerOutGradually(function () {
                    fadeVisualisationIn();
                });
            });
        });
        $btn.text('Repos');
    }
    else {
        fadeVisualisationOut(function () {
            fadeSpinnerIn(function () {
                backToRepos();
            });
        });
        $btn.text('Visualise');
    }
}

function showStats() {
    var stats =
        '<p style="text-align: center !important;">The below provides a summary of the Siesta Object Graph:</p>' +
        '<p><ul>' +
        '<li>$NUM_REPOS repositories</li>' +
        '<li>$NUM_USERS users</li>' +
        '</ul></p>';

    console.log('Starting counts');
    function _showStats() {
        var tasks = [
            function (cb) {
                collection.Repo.count(cb);
            },
            function (cb) {
                collection.User.count(cb);
            }
        ];
        siesta._internal.util.parallel(tasks, function (err, res) {
            stats = stats.replace('$NUM_REPOS', res[0]);
            stats = stats.replace('$NUM_USERS', res[1]);
            sweetAlert('Statistics', stats);
        });
    }

    if (!collection) {
        init(function (err) {
            if (!err) {
                _showStats();
            }
            else {
                alert(err);
            }
        });
    }
    else {
        _showStats();
    }

    _showStats();
}