---
layout: Getting_Started
title: Collections
sidebar: nav2.html
---
<a name="Collection"></a>
#class: Collection
**Members**

* [class: Collection](#Collection)
  * [new Collection(name)](#new_Collection)
  * [collection.baseURL](#Collection#baseURL)
  * [collection.installed](#Collection#installed)
  * [collection.install(callback)](#Collection#install)
  * [collection.mapping(optsOrName, opts)](#Collection#mapping)
  * [collection.requestDescriptor(opts)](#Collection#requestDescriptor)
  * [collection.responseDescriptor(opts)](#Collection#responseDescriptor)
  * [collection.HTTP_METHOD(request, method)](#Collection#HTTP_METHOD)
  * [collection.GET(path, optsOrCallback, callback)](#Collection#GET)
  * [collection.OPTIONS(path, optsOrCallback, callback)](#Collection#OPTIONS)
  * [collection.TRACE(path, optsOrCallback, callback)](#Collection#TRACE)
  * [collection.HEAD(path, optsOrCallback, callback)](#Collection#HEAD)
  * [collection.POST(path, model, optsOrCallback, callback)](#Collection#POST)
  * [collection.PUT(path, model, optsOrCallback, callback)](#Collection#PUT)
  * [collection.PATCH(path, model, optsOrCallback, callback)](#Collection#PATCH)
  * [collection.DELETE(path, model, optsOrCallback, callback)](#Collection#DELETE)
  * [collection.count(callback)](#Collection#count)

<a name="new_Collection"></a>
##new Collection(name)
A collection describes a set of models and optionally a REST API which we would
like to model.

**Params**

- name   

**Example**

```js
var GitHub = new siesta.Collection('GitHub')
// ... configure mappings, descriptors etc ...
GitHub.install(function () {
    // ... carry on.
});
```

<a name="Collection#baseURL"></a>
##collection.baseURL
The URL of the API e.g. http://api.github.com

**Type**: `string`  
<a name="Collection#installed"></a>
##collection.installed
Set to true if installation has succeeded. You cannot use the collectio

**Type**: `boolean`  
<a name="Collection#install"></a>
##collection.install(callback)
Ensure mappings are installed.

**Params**

- callback   

<a name="Collection#mapping"></a>
##collection.mapping(optsOrName, opts)
Registers a mapping with this collection.

**Params**

- optsOrName `String` | `Object` - An options object or the name of the mapping. Must pass options as second param if specify name.  
- opts `Object` - Options if name already specified.  

**Returns**: `Mapping`  
<a name="Collection#requestDescriptor"></a>
##collection.requestDescriptor(opts)
Register a request descriptor for this collection.

**Params**

- opts `Object`  

**Returns**: `RequestDescriptor` - A request descriptor  
**Example**

```js
collection.requestDescriptor({
    path: 'cars/(?P<id>)/'
    method: 'PUT',
    mapping: 'Car',
    data: 'data'
});
```

<a name="Collection#responseDescriptor"></a>
##collection.responseDescriptor(opts)
Register a response descriptor for this collection.

**Params**

- opts `Object`  

**Example**

```js
responseDescriptor = new siesta.ext.http.ResponseDescriptor({
   mapping: 'Car',
   transforms: {
       'colour': 'path.to.colour'
   }
});
```

<a name="Collection#HTTP_METHOD"></a>
##collection.HTTP_METHOD(request, method)
Send a HTTP request using the given method

**Params**

- request  - Does the request contain data? e.g. POST/PATCH/PUT will be true, GET will false  
- method   

**Returns**: `Promise`  
<a name="Collection#GET"></a>
##collection.GET(path, optsOrCallback, callback)
Send a GET request

**Params**

- path `path` - The path to the resource we want to GET  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Returns**: `Promise`  
<a name="Collection#OPTIONS"></a>
##collection.OPTIONS(path, optsOrCallback, callback)
Send a OPTIONS request

**Params**

- path `path` - The path to the resource to which we want to send an OPTIONS request  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Returns**: `Promise`  
<a name="Collection#TRACE"></a>
##collection.TRACE(path, optsOrCallback, callback)
Send a TRACE request

**Params**

- path `path` - The path to the resource to which we want to send a TRACE request  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Returns**: `Promise`  
<a name="Collection#HEAD"></a>
##collection.HEAD(path, optsOrCallback, callback)
Send a HEAD request

**Params**

- path `path` - The path to the resource to which we want to send a HEAD request  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Returns**: `Promise`  
<a name="Collection#POST"></a>
##collection.POST(path, model, optsOrCallback, callback)
Send a POST request

**Params**

- path `path` - The path to the resource to which we want to send a POST request  
- model `SiestaModel` - The model that we would like to POST  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Returns**: `Promise`  
<a name="Collection#PUT"></a>
##collection.PUT(path, model, optsOrCallback, callback)
Send a PUT request

**Params**

- path `path` - The path to the resource to which we want to send a PUT request  
- model `SiestaModel` - The model that we would like to PUT  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Returns**: `Promise`  
<a name="Collection#PATCH"></a>
##collection.PATCH(path, model, optsOrCallback, callback)
Send a PATCH request

**Params**

- path `path` - The path to the resource to which we want to send a PATCH request  
- model `SiestaModel` - The model that we would like to PATCH  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Returns**: `Promise`  
<a name="Collection#DELETE"></a>
##collection.DELETE(path, model, optsOrCallback, callback)
Send a DELETE request. Also removes the object.

**Params**

- path `path` - The path to the resource to which we want to DELETE  
- model `SiestaModel` - The model that we would like to PATCH  
- optsOrCallback `Object` | `function` - Either an options object or a callback if can use defaults  
- callback `function` - Callback if opts specified.  

**Returns**: `Promise`  
<a name="Collection#count"></a>
##collection.count(callback)
Returns the number of objects in this collection.

**Params**

- callback   

**Returns**: `Promise`  
