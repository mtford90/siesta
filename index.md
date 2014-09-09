---
layout: index
title: Fount
---

<div>
  <p class="lead">
    <strong>Siesta</strong> is an object mapping framework for Javascript. It makes it easier to model, consume and 
    interact with RESTful web services. 
</p>
<hr/>
<h3>Why?</h3>
<p>The main idea behind Siesta is that models should have a <b>single source of truth</b> and the belief that anything
less than this leads to confusion and race conditions when developing complex front-end applications.</p>
<p>Siesta is heavily inspired by Core Data and RESTKit in this respect.
<h3>What?</h3>
<p>As ever the best way to explain is by example.</p>
<p>Let's say we're interacting with a web service <code>http://api.mywebsite.com</code> and receive the following 
response when querying for a user at <code>GET /users/10</code>:</p>
<pre><code class="hljs javascript">var user = {
    "username": "mike",
    "id": 10
    "cars": [
        {"model": "Bentley", "colour":"Black", id: 11},
        {"model": "Aston Martin", "colour": "Gray", id:12}
     ]
}</code></pre>

<p>We then query again for the Bentley <code>GET /cars/11</code>:</p>
<pre><code class="hljs javascript">var car = {
    "model": "Bentley", 
    "colour": "Red", 
    "id": 11,
    "owner": {"username": "mike", "id": 10}
}</code></pre>

<p>And we notice that since our last query, our Bentley has been painted red!</p> 
<p>Using traditional methods of interacting
 with web services we would now have two Javascript objects representing our Bentley with id <code>11</code>:</p>

<pre><code class="hljs javascript">user.cars[0] === car; // False</code></pre>

And worst of all:

<pre><code class="hljs javascript">console.log(user.cars[0].colour); // Black
console.log(car.colour); // Red</code></pre>

<p>So not only do we have <strong>two</strong> distinct live objects representing the same remote resource, but one of those
objects is now out of sync - we have two sources of truth, and one of those sources is lying to us.</p>

<h3>How?</h3>

Siesta solves the issue of maintaining a single source of truth through the use of object mapping. A <strong>mapping</strong>
describes the remote object that we're modeling:

<pre><code class="hljs javascript">var userMapping = {
    attributes: ["username"]
};
                                   
var carMapping = {
    attributes: ["colour", "model"],
    relationships: {
        owner: {
            mapping: personMapping,
            type: relationshipTypes.ForeignKey,
            reverse: 'cars'
        }
    }
};</code></pre>

We would then describe the web service that we're interacting with using a <strong>descriptor</strong>:

<pre><code class="hljs javascript">var userDescriptor = {
    name: 'User',
    path: '/users/?(P&lt;id&gt;)/',
    mapping: personMapping
};

var carDescriptor = {
    name: 'Car',
    path: '/cars/?(P&lt;id&gt;)/',
    mapping: carMapping
};</code></pre>

And finally bring this all together in a <strong>Collection</strong>:

<pre><code class="hljs javascript">var collection = new Collection();

collection.mappings(carMapping, userMapping);
collection.responseDescriptors(personDescriptor, carDescriptor);

collection.setup().then(function () {
    // Setup complete.
})</code></pre>

From this point forward we can now interact with the RESTful API and all our local data through our collection
object, which will ensure that we have a single source of truth for all data that we model.

<pre><code class="hljs javascript">collection.GET('/users/10', function (err, user) {
    collection.GET('/cars/11'), function (err, car) {
        user.cars[0] === car; // true
    });
});</code></pre>

And thanks to the power of the underlying PouchDB we can query all our local data from anywhere in our app,
maintaining our single source of truth.

<pre><code class="hljs javascript">collection.Car.all(function (err, cars) {
    console.log(cars); // [{model: 'Bentley', colour: 'Red', owner: { ... } }, ...] 
});</code></pre>

<h3>Anything Else?</h3>

<p>Siesta sits on top of the awesome <a href="http://pouchdb.com/">PouchDB</a> and as such benefits from:</p>

<ul>
<li>Persistence</li>
<li>Synchronisation</li>
<li>Powerful local query mechanisms</li>
<li>Support for multiple local storage mechanisms across browsers</li>
</ul>

See the <a href="{{site.baseurl}}/docs.html" >documentation</a> for more info
on how to best use of both Siesta and PouchDB in your applications.

<hr/>


