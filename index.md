---
layout: default
title: Fount
---

<div class="intro">
 
  <div class="container">
    
    <div class="row">

      <div class='col-sm-4'>     

        <h1>Something</h1>

        <p>Something something</p>

        <p>Something else, Something else<p>


        <a href="https://github.com/mtford90/rest/releases/download/{{ site.version }}/rest-{{ site.version }}.min.js" class="btn btn-primary btn-lg"><strong>Download {{ site.version }}</strong></a>

      </div>

      <div class='col-sm-8'> 

      <div id="carousel" class="carousel slide" data-ride="carousel" data-interval="false">
         <ol class="carousel-indicators">
            <li data-target="#carousel-example-generic" class="active" onclick="$('#carousel').carousel(0)"></li>
            <li data-target="#carousel-example-generic" onclick="$('#carousel').carousel(1)"></li>
            <li data-target="#carousel-example-generic" onclick="$('#carousel').carousel(2)"></li>
            </ol>
          
           <div class="carousel-inner">
              <div class="item active">
                      {% highlight js %}
 collection.GET('/mtford90/rest', function (err, events) {
    collection.Repo.query({name: 'rest'}, function (err, repo) {
        assert.equal(repo.events, events);
        assert.equal(repo.owner, 'mtford90');
    });
  });


{% endhighlight %}
        <div class="caption">Wtf</div>

              </div>
              <div class="item">
     <div >
{% highlight js %}
  collection.GET('/mtford90/rest', function (err, events) {
    collection.Repo.query({name: 'rest'}, function (err, repo) {
        assert.equal(repo.events, events);
        assert.equal(repo.owner, 'mtford90');
    });
  });
{% endhighlight %}


              </div>              </div>
              <div class="item">
     <div >
                      {% highlight js %}

{% endhighlight %}

              </div>              </div>
           </div>
 
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
