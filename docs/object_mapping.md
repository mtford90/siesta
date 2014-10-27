---
layout: Getting_Started
title: Object Mapping
sidebar: nav2.html
---

## Object Mapping

### Mapping

Arbritrary data can be mapped using the following:

```javascript
siesta.MyCollection.MyMapping.map({ ... }, function (err, obj) {
    // ...
});
```

This is the same API used during HTTP requests/responses in combination with the descriptors.

### Subclassing SiestaModel

We can create our own subclass of `SiestaModel` and have it used automatically in object mapping through use of the 
`subclass` option when configuring our mapping:

```javascript

function CarModel () {
    RestObject.apply(this, arguments);
    this.customAttribute = 'custom';
}

CarModel.prototype = Object.create(SiestaModel.prototype);

collection.mapping('Car', {
    id: 'id',
    attributes: ['colour', 'miles'],
    subclass: CarModel
});
```

Anything models created as a result of being mapped to `Car` will be now be of class `CarModel`:

```javascript
collection.Car.map({colour: 'blue', miles:567}, function (err, car) {
    console.log(car.customAttribute); // custom
});
```

### Singletons

Sometimes we need to represent models of which there is only one instance - a singleton. This is also useful for
tieing other models together.

```javascript
collection.mapping('MySingleton', {
    singleton: true,
    fields: ['field1', 'field2']
});

collection.MySingleton.get(function (err, singleton) {
    // ...
});
```

Anything mapped using this mapping will be placed onto the same object.