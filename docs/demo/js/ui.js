/**
 * Demo UI code.
 * Essentially acts as controller between Siesta & DOM.
 */

function showForks(repoModel) {
    fadeReposOutGradually(function() {
        removeAllRepoElements();
        fadeSpinnerIn(function() {
            var path = '/repos/' + repoModel.owner.login + '/' + repoModel.name + '/forks';
            collection.GET(path, function(err, repos) {
            	repoModel.forked_to = repos;
                repositories = repos;
                fadeSpinnerOutGradually(function() {
                    createRepoElements();
                });
            });
        });
    });
}

function listFollowers(userModel) {
    var spinner = '<div class="fork-body">' +
        '<div class="spinner fork-spinner" style="margin-top: 30px !important; margin-bottom: 10px">' +
        '<div class="cube1"></div>' +
        '<div class="cube2"></div>' +
        '</div>' +
        '<div id="forks" style="display: none">' +
        '<h3>Followers<span id="hovered-username"></span></h3>' +
        '<div id="followers"></div>' +
        '<h3>Repos</h3>' +
        '<div id="repos"></div>' +
        '</div>' +
        '</div>';
    sweetAlert(userModel.login, spinner);
    $('.confirm').attr('disabled', true);
    getFollowers(userModel, function(err, users) {
        if (err) {
            // TODO                 
        } else {
            userModel.followers = users;
            // var rawFollows = _.map(users, function(u) {
            //     return {
            //         followed: {
            //             _id: userModel._id
            //         },
            //         follower: {
            //             _id: u._id
            //         }
            //     }
            // });
            getReposForUserModel(userModel, function(err, repos) {
                if (err) {
                    // TODO
                } else {
                    $('.fork-spinner').fadeOut(300, function() {
                        var $forks = $('#forks');
                        var $repoButton = $('<a>' + repos.length.toString() + ' public repositories</a>')
                        var elem = $('<p>This user has </p>');
                        elem.append($repoButton);
                        $forks.find('#repos').append(elem);
                        $repoButton.on('click', function() {
                            showReposForUserModel(userModel);
                            closeModal();
                        });
                        $('#forks').fadeIn(300, function() {
                            $('.confirm').attr('disabled', false);
                            var body = $('.fork-body #forks #followers');
                            if (userModel.followers.length) {
                                _.each(userModel.followers, function(f) {
                                    var elem = $('<img class="follower" data-toggle="tooltip" data-placement="top" title="' + f.login + '" src="' + f.avatar_url + '"/>');
                                    elem.hover(function() {
                                        $('#hovered-username').text(f.login);
                                    }, function() {
                                        $('#hovered-username').text('');
                                    });
                                    elem.on('click', function() {
                                        var path = f.html_url;
                                        window.open(path, '_blank');
                                    });
                                    body.append(elem);
                                });
                            } else {
                                body.append('This user has no followers yet!');
                            }
                        });
                    });
                }

            });
        }
    });
}

function createRepoElement(repoModel) {
    var cloned = $('#template').clone();
    cloned.css('display', 'inherit');
    var $repo = cloned.find('.repo');
    var $user = cloned.find('.user');
    $user.hover(function() {
        $(this).addClass('hovered');
        $repo.removeClass('hovered');
    }, function() {
        $(this).removeClass('hovered');
        $repo.addClass('hovered');
    });
    $repo.hover(function() {
        if (!$(this).find('.hovered').length) {
            $(this).addClass('hovered');
        }
    }, function() {
        $(this).removeClass('hovered');
    });
    cloned.find('.user .username').text(repoModel.owner.login);
    cloned.find('h3.name').text(repoModel.name);
    cloned.find('.description').text(repoModel.description);
    cloned.find('.watchers .num').text(repoModel.subscribers_count || 0);
    cloned.find('.stars .num').text(repoModel.stargazers_count || 0);
    cloned.find('.forks .num').text(repoModel.forks || 0);
    var $forks = cloned.find('.forks');
    $forks.hover(function() {
        $(this).addClass('hovered');
        $repo.removeClass('hovered');
    }, function() {
        $(this).removeClass('hovered');
        $repo.addClass('hovered');
    });
    var url = repoModel.owner.avatar_url;
    cloned.find('img').attr('src', url);
    $repo.on('click', function() {
        var path = repoModel.html_url;
        window.open(path, '_blank');
    });
    $user.on('click', function(e) {
        e.stopPropagation();
        listFollowers(repoModel.owner);
    });
    $forks.on('click', function(e) {
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

function showReposForUserModel(userModel) {
    fadeReposOutGradually(function() {
        removeAllRepoElements();
        fadeSpinnerIn(function() {
            getReposForUserModel(userModel, function(err, repos) {
                if (err) {
                    // TODO
                } else {
                    repositories = repos;
                    console.log('repos!', repositories);
                    createRepoElements();
                    fadeSpinnerOutGradually(function() {
                        fadeReposIn(function() {

                        });
                    });
                }
            });
        });
    });
}

function _query() {
    var text = $('#INPUT_1').val();
    $('#INPUT_1').val('');
    removeAllRepoElements();

    function remoteQuery(err) {
        if (!err) {
            searchForRepo(text, function(err, repos) {
                if (err) {
                    fadeSpinnerOutGradually(function() {
                        alert('TODO: Nicer errors: ' + err);
                    });
                } else {
                    fadeSpinnerOutGradually(function() {
                        repositories = repos;
                        createRepoElements();
                    });
                }
            });
        } else {
            alert('TODO: Nicer errors: ' + err);
        }
    }

    fadeSpinnerIn();
    $('#no-results').fadeOut(300);
    if (!collection) {
        init(remoteQuery);
    } else {
        remoteQuery();
    }
}

function query() {
    if ($('#visualise').text().toLowerCase() == 'repos') {
        $('#visualise').text('VISUALISE');
        backToRepos(function() {
            _query();
        });
    } else {
        _query();
    }
}

function queryKeyPress(e) {
    if (e.keyCode == 13) {
        query();
    }
}

function backToRepos(cb) {
    $('#svg').remove();
    fadeSpinnerOutGradually(function() {
        fadeReposIn();
        if (cb) cb();
    });
}

function visualisePressed(btn) {
    var $btn = $(btn);
    if ($btn.text().toLowerCase() == 'visualise') {
        fadeReposOutGradually(function() {
            fadeSpinnerIn(function() {
                showVis();
                fadeSpinnerOutGradually(function() {
                    fadeVisualisationIn();
                });
            });
        });
        $btn.text('Repos');
    } else {
        fadeVisualisationOut(function() {
            fadeSpinnerIn(function() {
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

            function(cb) {
                collection.Repo.count(cb);
            },
            function(cb) {
                collection.User.count(cb);
            }
        ];
        siesta.parallel(tasks, function(err, res) {
            stats = stats.replace('$NUM_REPOS', res[0]);
            stats = stats.replace('$NUM_USERS', res[1]);
            sweetAlert('Statistics', stats);
        });
    }

    if (!collection) {
        init(function(err) {
            if (!err) {
                _showStats();
            } else {
                alert(err);
            }
        });
    } else {
        _showStats();
    }

    _showStats();
}



/**
 * Add overlay layer to the page.
 *
 * Note that this was adapted from introjs and hence is dependent on the styles
 * from that library.
 */
function addOverlayLayer(cb) {
    var targetElm = $('body')[0];

    var overlayLayer = document.createElement('div'),
        styleText = '',
        self = this;

    //set css class name
    overlayLayer.className = 'introjs-overlay';

    styleText += 'top: 0;bottom: 0; left: 0;right: 0;position: fixed;';
    overlayLayer.setAttribute('style', styleText);
    targetElm.appendChild(overlayLayer);

    function _addOverlayLayer() {
        styleText += 'opacity: 0.8;';
        overlayLayer.setAttribute('style', styleText);
        cb(overlayLayer);
    }

    var html =
        '<div class="outer-spinner outer-overlay" id="spinner">' +
        '<div class="spinner overlay">' +
        '<div class="cube1"></div>' +
        '<div class="cube2"></div>' +
        '</div>' +
        '</div>';

    var spinner = $(html)[0];

    overlayLayer.appendChild(spinner);
    setTimeout(_addOverlayLayer, 10);
}

function removeOverlayLayer(overlayLayer) {
    $(overlayLayer).css('opacity', 0.0);
}

function startIntro() {
    var intro = introJs();
    intro.setOptions({
        steps: [{
            intro: "Welcome to the Siesta demo app. This app demonstrates the use of Siesta against the GitHub API."
        }, {
            intro: 'Enter a search term here and press enter to search the GitHub API for repositories with a matching name/description',
            element: $('#query-form')[0],
            position: 'top'
        }, {
            intro: "Click statistics to get a numerical summary of the object graph, that is, the num. unique users & repositories downloaded so far",
            element: $('#statistics-button')[0],
            position: 'left'
        }, {
            intro: 'Once you\'ve gathered enough data, hit visualise to generate a visualisation of the Siesta object graph using d3.js',
            element: $('#visualise')[0],
            position: 'left'
        }, {
            intro: 'Clicking here will display all forks of the particular repo',
            element: $('#repos .forks .inner-stat')[0],
            position: 'right'
        }, {
            intro: 'Clicking the user will pull up the users followers and repositories',
            element: $('#repos .user')[0],
            position: 'bottom'
        }]
    });
    intro.start();
    intro.onafterchange(function(targetElement) {
        console.log('after new step', targetElement);
    });
}