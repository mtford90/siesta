There are two ways to download Siesta. You can either download the bundle which includes most components or pick and choose the components that you'd like to use.

Siesta currently offers two components:

* Core - object mapping
* HTTP - provides a facility to describe web services and automatically maps data to and from the object graph. Can be configured with ajax libraries such as those offered by JQuery and Zepto.

Future planned components:

* Persistence
* Object graph visualisation (see the demo for example) 
* Performance monitoring

<div class="row btn-row">
    <a class="download" href="https://github.com/mtford90/siesta/releases/download/{{site.version}}/siesta.min.js">
        <button class="btn">siesta.min.js</button>
    </a>
    <a class="download" href="https://github.com/mtford90/siesta/releases/download/{{site.version}}/siesta.js">
        <button class="btn">siesta.js</button>
    </a>
</div>

### Modules

<div class="row btn-row">
    <a class="download" href="https://github.com/mtford90/siesta/releases/download/{{site.version}}/siesta.js">
        <button class="btn">siesta.core.js</button>
    </a>
    <a class="download" href="https://github.com/mtford90/siesta/releases/download/{{site.version}}/siesta.min.js">
        <button class="btn">siesta.core.min.js</button>
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

### Installation

The bundle can be simply included:

```js
<html>
<body>
<script src="siesta.js"></script>
<!-- ... -->

</body>
</html>
```

Modules should be included after siesta core:

```javascript
<html>
<body>
<script src="siesta.core.js"></script>
<script src="siesta.http.js"></script>
<!-- ... -->

</body>
</html>
```