

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

