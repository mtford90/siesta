---
layout: default
title: Fount
---

<div class="intro">
 
  <div class="container">
    
    <div class="row">

      <div class='col-sm-6'>     

        <h1>Something</h1>

        <p>Something something</p>

        <p>Something else, Something else<p>

        <a href="{{ site.baseurl }}/learn.html" class="btn btn-primary btn-lg">Learn more</a>

      </div>

      <div class='col-sm-6'> 
   
{% highlight js %}
var collection = new Collection('Github');

collection.baseURL = 'https://api.github.com/repos/';

collection.mapping('Event', 
  {
      attributes: ['type', 'public', 'owner'],
      relationships: {
          repo: {
              mapping: 'Repo',
              type: RelationshipType.ForeignKey,
              reverse: 'events'
          }
      }
  }
);

collection.mapping('Repo', { attributes: ['name', 'url'] });

collection.response({
    path: '/(?<owner>[a-ZA-Z0-9]+)/[a-ZA-Z0-9]+/?',
    method: 'GET',
    mapping: 'Event'
});

// Get remote events for the 'rest' repo and map onto the object graph.
collection.GET('/mtford90/rest', function (err, events) {
    // Get the repo from local storage.
    collection.Repo.query({name: 'rest'}, function (err, repo) {
        assert.equal(repo.events, events);
        assert.equal(repo.owner, 'mtford90');
    });
});
{% endhighlight %}

      </div>

    </div>

  </div>

</div>

</div>

<div class="blog">

  <div class="container">

    <h3>Latest Posts</h3>

        <div class="row">

{% for post in site.posts limit:2 %}

<div class="col-md-6">


  <p><a class='h4' href='{{ site.baseurl }}{{ post.url }}'>{{ post.title }}</a></p>

{% include post_details.html %}

  </div>

{% endfor %}

   </div>

   <a class="btn btn-primary btn-lg" href="/blog/index.html">View more</a>

  </div>

</div>
