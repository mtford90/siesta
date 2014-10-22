---
layout: vis
title: Vis
---

<script type="text/javascript">
    var dataset = [ 5, 10, 15, 20, 25 ];
    d3.select("body")
        /*
         Selects all paragraphs in the DOM. Since none exist yet, this returns an empty selection. 
         Think of this empty selection as representing the paragraphs that will soon exist.
         */
            .selectAll("p")
        /*
         Counts and parses our data values. There are five values in our data set, so everything past this point 
         is executed five times, once for each value.
         */
            .data(dataset)
        /*
         To create new, data-bound elements, you must use enter(). 
         This method looks at the DOM, and then at the data being handed to it. 
         If there are more data values than corresponding DOM elements, 
         then enter() creates a new placeholder element on which you may work your magic. 
         It then hands off a reference to this new placeholder to the next step in the chain.
         */
            .enter()
            .append("p")
            .text("New paragraph!");

    // Data is bound!
    console.log('Check out the bound data!', _.pluck(d3.selectAll('p')[0], '__data__'));
</script>


