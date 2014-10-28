---
layout: Getting_Started
title: Descriptors
sidebar: nav2.html
---
#Index

**Classes**

* [class: Descriptor](#Descriptor)
  * [new Descriptor(opts)](#new_Descriptor)
  * [descriptor._matchPath(path)](#Descriptor#_matchPath)
  * [descriptor._matchMethod(method)](#Descriptor#_matchMethod)
  * [descriptor._extractData(data)](#Descriptor#_extractData)
  * [descriptor._matchConfig(config)](#Descriptor#_matchConfig)
  * [descriptor._matchData(data)](#Descriptor#_matchData)
  * [descriptor.match(config, data)](#Descriptor#match)
  * [descriptor._transformData(data)](#Descriptor#_transformData)
* [class: ResponseDescriptor](#ResponseDescriptor)
  * [new ResponseDescriptor(opts)](#new_ResponseDescriptor)

**Functions**

* [bury(obj, data)](#bury)

**Members**

* [path](#path)
 
<a name="Descriptor"></a>
#class: Descriptor
**Members**

* [class: Descriptor](#Descriptor)
  * [new Descriptor(opts)](#new_Descriptor)
  * [descriptor._matchPath(path)](#Descriptor#_matchPath)
  * [descriptor._matchMethod(method)](#Descriptor#_matchMethod)
  * [descriptor._extractData(data)](#Descriptor#_extractData)
  * [descriptor._matchConfig(config)](#Descriptor#_matchConfig)
  * [descriptor._matchData(data)](#Descriptor#_matchData)
  * [descriptor.match(config, data)](#Descriptor#match)
  * [descriptor._transformData(data)](#Descriptor#_transformData)

<a name="new_Descriptor"></a>
##new Descriptor(opts)
A descriptor 'describes' possible HTTP requests against an API, and is used to decide whether or not to
intercept a HTTP request/response and perform a mapping.

**Params**

- opts `Object`  

<a name="Descriptor#_matchPath"></a>
##descriptor._matchPath(path)
Takes a regex path and returns an object if matched.
If any regular expression groups were defined, the returned object will contain the matches.

**Params**

- path `String` | `RegExp`  

**Returns**: `Object`  
**Example**

```js
var d = new Descriptor({
    path: '/resource/(?P<id>)/'
})
var matched = d._matchPath('/resource/2');
console.log(matched); // {id: '2'}
```

<a name="Descriptor#_matchMethod"></a>
##descriptor._matchMethod(method)
Returns true if the descriptor accepts the HTTP method.

**Params**

- method `String`  

**Returns**: `boolean`  
**Example**

```js
var d = new Descriptor({
    method: ['POST', 'PUT']
});
console.log(d._matchMethod('GET')); // false
```

<a name="Descriptor#_extractData"></a>
##descriptor._extractData(data)
If nested data has been specified in the descriptor, extract the data.

**Params**

- data `Object`  

**Returns**: `Object`  
<a name="Descriptor#_matchConfig"></a>
##descriptor._matchConfig(config)
Returns this descriptors mapping if the request config matches.

**Params**

- config `Object`  

**Returns**: `Object`  
<a name="Descriptor#_matchData"></a>
##descriptor._matchData(data)
Returns data if the data matches, performing any extraction as specified in opts.data

**Params**

- data `Object`  

**Returns**: `Object`  
<a name="Descriptor#match"></a>
##descriptor.match(config, data)
Check if the HTTP config and returned data match this descriptor definition.

**Params**

- config `Object` - Config object for $.ajax and similar  
- data `Object`  

**Returns**: `Object` - Extracted data  
<a name="Descriptor#_transformData"></a>
##descriptor._transformData(data)
Apply any transforms.

**Params**

- data `Object` - Serialised data.  

**Returns**: `Object` - Serialised data with applied transformations.  
<a name="ResponseDescriptor"></a>
#class: ResponseDescriptor
**Members**

* [class: ResponseDescriptor](#ResponseDescriptor)
  * [new ResponseDescriptor(opts)](#new_ResponseDescriptor)

<a name="new_ResponseDescriptor"></a>
##new ResponseDescriptor(opts)
Describes what to do with a HTTP response.

**Params**

- opts `Object`  

<a name="bury"></a>
#bury(obj, data)
Performs a breadth-first search through data, embedding obj in the first leaf.

**Params**

- obj `Object`  
- data `Object`  

**Returns**: `Object`  
<a name="path"></a>
#path
**Type**: `String`  
