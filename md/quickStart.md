# Quick Start

You can get started with Siesta by manually including it within your project or by forking one of the boilerplate projects.

## Manual Installation

Siesta is available on both bower and npm.

```bash
npm install siesta-orm --save
bower install siesta --save
```

### Script tag

```html
<script src="path/to/siesta/dist/siesta.js"></script>
```

### CommonJS

Alternatively if you're using a bundler based on CommonJS (browserify, webpack etc) you can `require` siesta once you've run `npm install siesta`.

```js
var siesta = require('siesta');
```

### Storage

To enable storage you must include PouchDB. If the availability of PouchDB is not detected then storage will be disabled.

```html
<!-- If using script tags -->
<script src="//cdnjs.cloudflare.com/ajax/libs/pouchdb/3.2.0/pouchdb.min.js"></script>
<script src="https://github.com/mtford90/siesta/releases/download/{{site.version}}/siesta.min.js"></script>
```

```js
// If using CommonJS.
window.PouchDB = require('pouchdb');
```

## Example Projects

At the moment the only example project is the ReactJS/Siesta TodoMVC implementation, the demo of which is [here](http://mtford.co.uk/siesta-reactjs-todomvc/) and source [here](https://github.com/mtford90/siesta-reactjs-todomvc).

Various web apps and hybrid mobile apps are currently under development using Siesta and will be listed here upon completion.

## Boilerplates

Coming soon for your favourite framework. In the works:

* ReactJS
* AngularJS