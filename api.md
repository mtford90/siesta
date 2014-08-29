---
layout: 2ColLeft
title: API Reference
sidebar: api.html
---

Bla bla bla

{% include anchor.html title="Todo" hash="todo" %}

{% highlight js %}
new PouchDB([name], [options])
{% endhighlight %}

This method creates a database or opens an existing one. If you use a URL like `'http://domain.com/dbname'` then PouchDB will work as a client to an online CouchDB instance.  Otherwise it will create a local database using whatever backend is present (i.e. IndexedDB, WebSQL, or LevelDB). 