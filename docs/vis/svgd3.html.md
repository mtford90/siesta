---
layout: vis
title: Vis
---

<script type="text/javascript">
    var dataset = [ 5, 10, 15, 20, 25 ];

    d3.select("body").append("svg");
    var svg = d3.select("body").append("svg");
    var w = 500;
    var h = 100;
    svg.attr("width", w)
            .attr("height", h);
    var circles = svg.selectAll("circle")
            .data(dataset)
            .enter()
            .append("circle");

    circles.attr("cx", function (d, i) {
        // d is a data point
        // i is the numeric index
        return (i * 50) + 25;
    })
            .attr("cy", h / 2)
            .attr("r", function (d) {
                return d;
            });

    circles.attr("fill", "yellow")
            .attr("stroke", "orange")
            .attr("stroke-width", function (d) {
                return d / 2;
            });

</script>