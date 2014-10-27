---
layout: vis
title: Vis
---

<style type="text/css">

    div.bar {
        display: inline-block;
        width: 20px;
        height: 75px;
        background-color: teal;
        margin-right: 2px;
    }

</style>

<script type="text/javascript">

    var dataset = [];                        //Initialize empty array
    for (var i = 0; i < 25; i++) {           //Loop 25 times
        var newNumber = Math.random() * 30;  //New random number (0-30)
        dataset.push(Math.round(newNumber));             //Add new number to array
    }

    d3.select("body").selectAll("div")
            .data(dataset)
            .enter()
            .append("div")
            .attr("class", "bar")
            .style("height", function (d) {
                return d * 5 + "px";
            });


</script>


