---
layout: vis
title: Vis
---

<style type="text/css">

    .link {
        fill: none;
        stroke: #666;
        stroke-width: 1.5px;
    }

    #owned {
        fill: green;
    }

    .link.owned {
        stroke: green;
    }

    .link.forked {
        stroke-dasharray: 0, 2 1;
    }

    circle {
        fill: #ccc;
        stroke: #333;
        stroke-width: 1.5px;
    }

    text {
        font: 10px sans-serif;
        pointer-events: none;
        text-shadow: 0 1px 0 #fff, 1px 0 0 #fff, 0 -1px 0 #fff, -1px 0 0 #fff;
    }

    body {
        height: 100%;
        padding: 0;
        margin: 0;
    }

</style>

<script type="text/javascript">

    var repos = [
        {name: 'xyz123456'},
        {name: 'dfgdfg'},
        {name: 'dfgdf'},
        {name: '234234'},
        {name: 'd09rtet'},
        {name: 'fdgdf03'}
    ];

    _.each(repos, function (x) {
        x.mapping = {
            type: 'Repo'
        };
    });

    var users = [
        {name: 'mtford90', url: 'https://avatars2.githubusercontent.com/u/1734057?v=2&s=460'},
        {name: 'wallyqs', url: 'https://avatars2.githubusercontent.com/u/26195?v=2&s=460'}
    ];
    _.each(users, function (x) {
        x.mapping = {
            type: 'User'
        };
    });

    var links = [
        {source: users[0], target: repos[0], relationshipType: "owned"},
        {source: users[0], target: repos[1], relationshipType: "owned"},
        {source: users[0], target: repos[2], relationshipType: "owned"},
        {source: users[0], target: repos[3], relationshipType: "owned"},
        {source: users[0], target: repos[4], relationshipType: "owned"},
        {source: users[0], target: repos[5], relationshipType: "owned"},
        {source: repos[2], target: repos[3], relationshipType: "forked"},
        {source: users[1], target: users[0], relationshipType: 'follows'}
    ];

    var nodes = {};

    // Compute the distinct nodes from the links.
    links.forEach(function (link) {
        link.source = nodes[link.source.name] || (nodes[link.source.name] = link.source);
        link.target = nodes[link.target.name] || (nodes[link.target.name] = link.target);
    });
    console.log(nodes);

    var margin = {top: -5, right: -5, bottom: -5, left: -5},
            width = 960,
            height = 500;

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


    var svg = d3.select("body").append("svg")
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

    var transx = $('#svg').width() / 2;
    var transy = $('#svg').height() / 2;

    var container = svg.append("g")
            .attr('id', 'container')
            .attr("transform", "translate(" + transx + "," + transy + ")");

    zoom.translate([transx, transy]);


    console.log('container', container);

    // Per-type markers, as they don't inherit styles.
    container.append("defs").selectAll("marker")
            .data(["ManyToMany", "owned", "forked"])
            .enter().append("marker")
            .attr("id", function (d) { return d; })
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 15)
            .attr("refY", -1.5)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-5L10,0L0,5");

    var links = force.links();
    console.log('links', links);
    var path = container.append("g").selectAll("path")
            .data(links)
            .enter().append("path")
            .attr("class", function (d) { return "link " + d.relationshipType; });
    //            .attr("marker-end", function (d) { return "url(#" + d.type + ")"; });


    var drag = force.drag()
            .on("dragstart", function () {
                console.log('event...', d3.event);
                d3.event.sourceEvent.stopPropagation();
            });

    //    var circle = container.append("g").selectAll("circle")
    //            .data(force.nodes())
    //            .enter().append("circle")
    //            .attr("r", 6)
    //            .call(drag);


    var circle = container.append("g").selectAll("circle")
            .data(force.nodes())
            .enter().append("image")
            .attr('height', 20)
            .attr('width', 20)
            .attr('xlink:href', function (d) {
                if (d.mapping.type == 'Repo') {
                    return 'repo.svg'
                }
                else if (d.mapping.type == 'User') {
                    return d.url;
                }
            })
            .on('click', function () {
                console.log('clicked!');
            })
            .call(drag);

    var text = container.append("g").selectAll("text")
            .data(force.nodes())
            .enter().append("text")
            .attr("x", 8)
            .attr("y", ".31em")
            .text(function (d) { return d.name; });

    // Use elliptical arc path segments to doubly-encode directionality.
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

</script>


