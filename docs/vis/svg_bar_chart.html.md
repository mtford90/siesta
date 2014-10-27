---
layout: vis
title: Vis
---

<script type="text/javascript">

    var w = 500;
    var h = 100;
    var barPadding = 1;

    var dataset = [];
    for (var i = 0; i < 25; i++) {
        var newNumber = Math.random() * 25;
        dataset.push(Math.round(newNumber));
    }

    var svg = d3.select("body")
            .append("svg")
            .attr("width", w)
            .attr("height", h);

    svg.selectAll("rect")
            .data(dataset)
            .enter()
            .append("rect")
            .attr("width", w / dataset.length - barPadding)
            .attr("y", function (d) {
                return h - (d * 4);  //Height minus data value
            })
            .attr("height", function (d) {
                return d * 4;
            })
            .attr("x", function (d, i) {
                // Good practice to use scalable sizes
                return i * (w / dataset.length);
            })
            .attr("fill", function (d) {
                return "rgb(0, 0, " + (d * 10) + ")";
            });


    svg.selectAll("text")
            .data(dataset)
            .enter()
            .append("text")
            .text(function(d) {
                return d;
            })
            .attr("x", function(d, i) {
                return i * (w / dataset.length) + (w / dataset.length - barPadding) / 2;
            })
            .attr("y", function(d) {
                return h - (d * 4) + 14;  //15 is now 14
            })
            .attr("font-family", "sans-serif")
            .attr("font-size", "11px")
            .attr("fill", "white")
            .attr("text-anchor", "middle")



</script>


