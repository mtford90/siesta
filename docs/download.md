---
layout: index
title: Download
---

There are two ways to download Siesta. You can either download the bundle which includes most components or pick and choose
the components that you'd like to use. 

Siesta currently offers four components:

* Core - object mapping
* HTTP - provides a facility to describe web services and automatically maps data to and from the object graph. Can be configured with ajax libraries such as those offered by JQuery and Zepto.
* Performance Monitoring: Logs timing information around mapping, HTTP requests etc.

### Bundle
  
The Siesta bundle includes Core, HTTP and Storage.

<div class="row btn-row">
    <a class="download" href="https://github.com/mtford90/siesta/releases/download/{{site.version}}/siesta.bundle.min.js">
        <button class="btn">siesta.bundle.min.js</button>
    </a>
    <a class="download" href="https://github.com/mtford90/siesta/releases/download/{{site.version}}/siesta.bundle.js">
        <button class="btn">siesta.bundle.js</button>
    </a>
</div>

### Modules

<div class="row btn-row">
    <a class="download" href="https://github.com/mtford90/siesta/releases/download/{{site.version}}/siesta.js">
        <button class="btn">siesta.js</button>
    </a>
    <a class="download" href="https://github.com/mtford90/siesta/releases/download/{{site.version}}/siesta.min.js">
        <button class="btn">siesta.min.js</button>
    </a>
</div>

<div class="row btn-row">
    <a class="download" href="https://github.com/mtford90/siesta/releases/download/{{site.version}}/siesta.http.js">
        <button class="btn">siesta.http.js</button>
    </a>
     <a class="download"href="https://github.com/mtford90/siesta/releases/download/{{site.version}}/siesta.http.min.js">
        <button class="btn">siesta.http.min.js</button>
     </a>
</div>

<div class="row btn-row">
    <a class="download" href="https://github.com/mtford90/siesta/releases/download/{{site.version}}/siesta.perf.js">
        <button class="btn">siesta.perf.js</button>
    </a>
    <a class="download" href="https://github.com/mtford90/siesta/releases/download/{{site.version}}/siesta.perf.min.js">
        <button class="btn">siesta.perf.min.js</button>
    </a>
</div>

### Installation

Modules should be included after siesta core:

```javascript
<html>
<body>
<script src="siesta.js"></script>
<script src="siesta.http.js"></script>
<script src="siesta.perf.js"></script>

<!-- ... -->

</body>
</html>
```