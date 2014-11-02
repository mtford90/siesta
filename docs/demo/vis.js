/**
 * Visualises the Siesta object graph using d3.js.
 * Call showVis to begin the visualisation.
 */

function getUsers(cb) {
    User.all(function(err, users) {
        cb(err, users);
    });
}

function getRepos(cb) {
    Repo.all(function(err, repos) {
        cb(err, repos);
    });
}

function getFollows(cb) {
    Follow.all(function(err, follows) {
        cb(err, follows);
    });
}

function getForks(cb) {
    Fork.all(function(err, forks) {
        cb(err, forks);
    });
}


function showVis() {
    getRepos(function(err, repoModels) {
        getFollows(function(err, follows) {
            getForks(function(err, forks) {
                var users = {};
                var repos = {};
                var ownedLinks = _.map(repoModels, function(r) {
                    if (!repos[r._id]) {
                        var repoName = r.name + '(' + r.owner.login + ')';
                        repos[r._id] = {
                            name: repoName,
                            type: 'Repo'
                        };
                    }
                    if (!users[r.owner._id]) {
                        users[r.owner._id] = {
                            name: r.owner.login,
                            url: r.owner.avatar_url,
                            type: 'User'
                        };
                    }
                    return {
                        source: users[r.owner._id],
                        target: repos[r._id],
                        relationshipType: 'owned'
                    }
                });
                var forkedLinks = _.map(forks, function(f) {
                    var sourceRepo = f.source;
                    var forkRepo = f.fork;
                    var forkRepoName = forkRepo.name + '(' + forkRepo.owner.login + ')';
                    var sourceRepoName = sourceRepo.name + '(' + sourceRepo.owner.login + ')';
                    if (!repos[forkRepo._id]) {
                        repos[forkRepo._id] = {
                            name: forkRepoName,
                            type: 'Repo'
                        };
                    }
                    if (!repos[sourceRepo._id]) {
                        repos[sourceRepo._id] = {
                            name: sourceRepoName,
                            type: 'Repo'
                        };
                    }
                    return {
                        source: repos[sourceRepo._id],
                        target: repos[forkRepo._id],
                        relationshipType: 'forked'
                    }
                });

                var followLinks = _.map(follows, function(f) {
                    var followed = f.followed;
                    var follower = f.follower;
                    if (!users[followed._id]) {
                        users[followed._id] = {
                            name: followed.login,
                            url: followed.avatar_url,
                            type: 'User'
                        };
                    }
                    if (!users[follower._id]) {
                        users[follower._id] = {
                            name: follower.login,
                            url: follower.avatar_url,
                            type: 'User'
                        };
                    }
                    return {
                        source: users[followed._id],
                        target: users[follower._id],
                        relationshipType: 'follows'
                    }
                });

                var links = ownedLinks.concat(forkedLinks).concat(followLinks);
                var nodes = {};

                links.forEach(function(link) {
                    var sourceName = link.source.name;
                    var targetName = link.target.name;
                    link.source = nodes[sourceName] || (nodes[sourceName] = link.source);
                    link.target = nodes[targetName] || (nodes[targetName] = link.target);
                });

                var margin = {
                    top: -5,
                    right: -5,
                    bottom: -5,
                    left: -5
                };

                var force = d3.layout.force()
                    .nodes(d3.values(nodes))
                    .links(links)
                    .linkDistance(100)
                    .charge(-300)
                    .on("tick", tick)
                    .start();


                var zoom = d3.behavior.zoom()
                    .scaleExtent([1, 10])
                    .on("zoom", zoomed);


                var svg = d3.select("#visualisation").append("svg")
                    .attr("width", '100%')
                    .attr("height", '100%')
                    .attr('id', 'svg')
                    .append("g")
                    .attr("transform", "translate(" + margin.left + "," + margin.right + ")")
                    .call(zoom);

                var rect = svg.append("rect")
                    .attr("width", '100%')
                    .attr("height", '100%')
                    .style("fill", "none")
                    .style("pointer-events", "all");

                var content = $('#content');
                var transx = content.width() / 2;
                var transy = content.height() / 2;

                console.log('transx', transx);
                console.log('transy', transy);

                var container = svg.append("g")
                    .attr('id', 'container')
                    .attr("transform", "translate(" + transx + "," + transy + ")");

                zoom.translate([transx, transy]);
                console.log('container', container);

                container.append("defs").selectAll("marker")
                    .data(["ManyToMany", "owned", "forked"])
                    .enter().append("marker")
                    .attr("id", function(d) {
                        return d;
                    })
                    .attr("viewBox", "0 -5 10 10")
                    .attr("refX", 15)
                    .attr("refY", -1.5)
                    .attr("markerWidth", 6)
                    .attr("markerHeight", 6)
                    .attr("orient", "auto")
                    .append("path")
                    .attr("d", "M0,-5L10,0L0,5");

                var links = force.links();
                var path = container.append("g").selectAll("path")
                    .data(links)
                    .enter().append("path")
                    .attr("class", function(d) {
                        return "link " + d.relationshipType;
                    });

                var drag = force.drag()
                    .on("dragstart", function() {
                        console.log('event...', d3.event);
                        d3.event.sourceEvent.stopPropagation();
                    });

                var circle = container.append("g").selectAll("circle")
                    .data(force.nodes())
                    .enter().append("image")
                    .attr('height', 20)
                    .attr('width', 20)
                    .attr('xlink:href', function(d) {
                        if (d.type == 'Repo') {
                            return 'repo.svg'
                        } else if (d.type == 'User') {
                            return d.url;
                        }
                    })
                    .on('click', function() {
                        console.log('clicked!');
                    })
                    .call(drag);

                var text = container.append("g").selectAll("text")
                    .data(force.nodes())
                    .enter().append("text")
                    .attr("x", 8)
                    .attr("y", ".31em")
                    .text(function(d) {
                        return d.name;
                    });

                function tick() {
                    path.attr("d", linkArc);
                    circle.attr("transform", transform);
                    text.attr("transform", transform);
                }

                function linkArc(d) {
                    var dx = d.target.x - d.source.x,
                        dy = d.target.y - d.source.y,
                        dr = Math.sqrt(dx * dx + dy * dy);
                    return "M" + d.source.x + "," + d.source.y + "A" + dr + "," + dr + " 0 0,1 " + d.target.x + "," + d.target.y;
                }

                function transform(d) {
                    return "translate(" + (d.x - 10) + "," + (d.y - 10) + ")";
                }

                function zoomed() {
                    console.log(d3.event);
                    container.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
                }
            });
        });
    });
}