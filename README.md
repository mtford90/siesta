Siesta
====
Siesta is inspired by:

* CoreData
    * Single source of truth
    * Persistence
* RestKit
    * Mappings
    * Descriptors
* Django
    * URL configs
* South
    * Migrations
* CouchDB/PouchDB (and makes use of the latter)
    * Synchronisation

## Quick Start

### Step 1: Installation

TODO

### Step 2: Create a collection

A `Collection` describes a set of models and can be either used locally or hooked up to a remote collection.

```javascript
var collection = new Collection('MyCollection', function configure (err, version) {
    if (!err) {
        if (!version) { // MyCollection has never been configured on this browser.
            // Base URL. Only necessary if you're going to be interfacing with a remote data source.
            this.setBaseURL('http://mysite.com/collection/');
            configureObjectMappings(this);
            configureDescriptors(this);
        }
    }
    else {
        handleError(err);
    }
}, function done () {
    // All done.
    doStuff();
});
```

### Step 3: Configure Object Mappings

Your object mappings describe the models within the collection.

```javascript
function configureObjectMappings(collection) {
    // Car Mapping
    collection.registerMapping('Car', {
        id: 'id',
        relationships: {
            owner: {
                mapping: 'Person',
                type: RelationshipType.ManyToOne,
                reverse: 'cars' // Will show up on Person objects
            }
        },
        attributes: ['model', 'colour', 'licensePlate'],
        indexes: ['colour'] // id is automatically indexed
    });
    
    // Person Mapping
    collection.registerMapping('Person', {
        id: 'id',
        attributes: ['name', 'age']
    });
}
```

### Step 4: Configure Request/Response Descriptors

Descriptors map HTTP request and responses onto your object mappings and perform the appropriate action.

```javascript
function configureDescriptors(collection) {
    // Request descriptors
    collection.registerRequestDescriptor({
        path: 'cars/',
        method: 'POST',
        mapping: 'Car',
        data: 'data' // Serialise to {data: {...}} when sending the request.
    });
    collection.registerRequestDescriptor({
        path: 'cars/:id/'
        method: 'PUT',
        mapping: 'Car',
        data: 'data' // Serialise to {data: {...}} when sending the request.
    });
    
    // Response descriptors
    collection.registerResponseDescriptor({
        path: 'cars/(.*)/',
        method: '*', // Any method
        mapping: 'Car',
        data: 'data' // Deserialise from data field in JSON response when receiving.
    });
}
```

### Step 5: Obtain some remote data.

```javascript
// Get objects
collection.GET('cars/', function (err, cars) {
    console.log('I got me some cars!', cars);
});

collection.GET('cars/5', function (err, car) {
    console.log('I got me a car!', car);
});

// Create objects 
var person = new collection.Person({name: 'Michael'});
collection.POST('people/', person, function (err, car) {
    if (!err) { 
        var car = new collection.Car({colour: red, owner: person});
        promise = car.post().then(function () {
            // Do some stuff.
        }).catch(function (err) {
            // Handle error.
        });
    }
    else {
        // Handle error.
    }
});
person.POST(function (err) {

});

// Update object
person.name = 'Bob';
person.PATCH(function (err) {
    // ...
});

// Delete object
person.DELETE(function (err) {
    // ...
});

```

### Step 6: Play with local data

Objects obtained remotely will be persisted using the defined object mappings. Therefore if 
the same object with the same id is downloaded multiple times it will be mapped onto the same
javascript object i.e. a single source of truth. 

The best way to explain this concept is by way of example:

```javascript

// Get all cars that are stored locally.
collection.Car.all(function (err, cars) {
    /* 
        cars = [{colour: 'blue', model: 'Aston Martin', id: 5}]
    */
    var car = cars[0];
    
    // Get all people that are stored remotely.
    collection.('people/').get(function (err, people) {
        /*
            people = [{
                id: 4,
                name: 'michael',
                cars: [{colour: 'red', model: 'Aston Martin', id: 5}]
            }];
        */
        
        console.log(car); // LOG: {colour: 'red', model: 'Aston Martin', id: 5}
    });
    
  
    
});
```

Previously we described a relationship between `Person` objects and `Car` objects and also noted that cars are
uniquely identified by the `id` field. Our `Car` object is hashed using this identifier and is updated. This is as opposed to
other frameworks where we would end up with two `Car` objects that describe the same remote resource
but at different moments in time. We have a single source of truth.


## Other Features

### Pagination

Pagination is configured in the descriptors. By default we expect no pagination. 
Example:

```javascript
collection.registerResponseDescriptor({
    path: 'cars/',
    method: 'GET',
    mapping: 'Car',
    pagination: {
        count: 'count', 
        nextPage: 'next',
        previousPage: 'previous',
        data: 'data'
    }
});
```

If the collection allows us to specify pageSize etc we can do so using the following once this response descriptor
is configured:

```javascript
collection.get('cars/', {page_size: 5}).then(function (cars) { 
    // ... 
});
```

### Notifications

#### HTTP Requests

The notification looks as follows:

```javascript
{
	name: 'POST MyCollection Car',
    type: 'Car',
    collection: 'MyCollection',
    obj: Object{}, // The object in question
    mapping: { ... }, // The 'Car' mapping.
    requestDescriptor: { ... }, // The request descriptor used to perform the serialisation.
    request: {path: 'cars/', data: {...}} // The HTTP request sent to the server.
}
```

Here are some examples:

```javascript

// Sent on sending of POST request to server for any object.
siesta.on('POST', function (notification) {
    console.log(notification);
});

// Sent on sending of POST request to server of a Car.
siesta.on('POST MyCollection Car', function (notification) {
    console.log(notification);
});

// Sent on successful response of POST of a Car.
siesta.on('POST MyCollection Car success', function (notification) {
    console.log(notification);
});

```

#### Updates

Notifications are also sent when fields on particular objects have changed e.g. after a successful response
mapping or after a local modification.

```javascript
siesta.on('Car', function (notification) {
    console.log(notification);
    /*
       LOG: {
             name: 'Car', // Name of the notification
             object: Car{},
             type: 'Car',
             collection: 'MyCollection',
             changes: [{
                 type: 'set',
                 key: 'colour',
                 old: 'red',
                 new: 'blue'
             }]
        }
    */
});
```

This also works for array-type attributes:

```javascript
var car = myCollection.Car.map({colours: ['red'], name: 'Ford'});

siesta.on('Car', function () {
    /*
       LOG: {
             name: 'Car', // Name of the notification
             object: Car{},
             type: 'Car',
             collection: 'MyCollection',
             changes: [{
                 type: 'insert',
                 key: 'colour',
                 new: 'blue'
             }]
        }
    */
});

car.push('blue');
```


## Recipes

Useful stuff that can be done with the combination of <rest> and the underlying PouchDB.

### 

### Custom Views

TODO: Install custom PouchDB views. Useful for analysis of data etc.

### Database synchronisation

We can synchronise with CouchDB instances thanks to the use of PouchDB behind the scenes.

TODO

### Subclassing SiestaModel

TODO: Pass constructor or name of constructor to the mapping?

## Contributing

### Getting setup

Download dependencies:

```bash
git clone https://github.com/mtford90/rest
cd rest
npm install
bower install
```

Run the tests to check all is working as expected:

```bash
grunt test
```

During development it's useful to watch for changes and execute tests automatically:

```bash
grunt watch
```

## To Sort

Things that don't have a home yet.

### Request Descriptors

```javascript
// Custom serialiser for cars.
function carSerialiser(fields, car, done) {
     var data = {};
     for (var idx in fields) {
         var field = fields[idx];
         if (car[field]) {
             data[field] = car[field];
         }
     }
     car.owner.get(function (err, person) {
         if (err) {
             done(err);
         }
         else {
             if (person) {
                 data.owner = person.name;
             }
             done(null, data);
         }
     });
 }

collection.registerRequestDescriptor({
   path: 'cars/',
   method: 'POST',
   mapping: 'Car',
   data: 'data',
   serialiser: _.partial(carSerialiser, ['name', 'colour'])
});

collection.registerRequestDescriptor({
	path: 'people/',
	method: 'POST',
	data: 'data',
	serialiser: Serialiser.depthSerialiser(1), 
	// serialiser: Serialiser.depthSerialiser(), 
	// serialiser: Serialiser.idSerialiser // Default
});
```

### Response Descriptors

```javascript
collection.registerRequestDescriptor({
	path: '/cars/(?<colour>[a-zA-Z0-9]+)/?',
	method: 'GET',
	data: 'data'
});

collection.GET('cars/red/', function (err, objs, resp) {
	_.each(objs, function (o) {console.log(o.colour)}); // red, red, red ...
})
```


### RestError

`RestError` is an extension to Javascript's `Error` class.

* `RestError.message` describes the error.
* `RestError.context` gives some useful context.

### Relationships

#### Foreign Key

If we have the following mappings:

```javascript
carMapping = collection.registerMapping('Car', {
    id: 'id',
    attributes: ['colour', 'name'],
    relationships: {
        owner: {
            mapping: 'Person',
            type: RelationshipType.OneToMany,
            reverse: 'cars'
        }
    }
});

personMapping = collection.registerMapping('Person', {
    id: 'id',
    attributes: ['name', 'age']
});
```

A `Car` object will have the following properties due to this relationship.

```javascript
// Create some new objects to play with.
var person = personMapping.map({name: 'Michael'});
var car = carMapping.map({name: 'Bentley', colour: 'Black'});
var anotherCar = carMapping.map({name: 'Bentley', colour:'Grey'});

// Relationships on new objects will not be faults as all in memory.
console.log(car.owner.isFault); // false
console.log(anotherCar.owner.isFault); // false
console.log(person.cars.isFault); // false

person.cars.push(car);

console.log(person.cars); // [Car{name: Bentley, colour: Black}]

console.log(car.owner === person); // true

anotherCar.owner = person;

console.log(person.cars); // [Car{name: Bentley, colour: Black}, Car{name: Bentley, colour: Grey}]
```

However what if we had faults?
```javascript
var person = var person = personMapping.map({name: 'Michael', id:5});
var car = carMapping.map({name: 'Bentley', colour: 'Black', id:6});
car.owner = person;
car.save();

// Local identifiers are automatically assigned.
console.log(car._id); // "abc"
console.log(person._id); // "xyz"

// ...
// The app is closed and then reopened.
// ...

personMapping.all(function (err, people) {
	carMapping.all(function (err, cars) {
		var person = people[0];
		var car = cars[0];
		
		console.log(person.cars.isFault); // true
		console.log(person.cars); // Fault{}
		console.log(person.cars._id); // ["abc"]
		
		console.log(car.owner.isFault); // true
		console.log(car.owner); // Fault{}
		console.log(car.owner._id); // xyz
		
		// We can clear a fault by performing a get.
		car.owner.get(function (err, person) {
			console.log(car.owner == person); // true
			console.log(car.owner.isFault); // false
			
			// The cars side of the relationship is still at fault however.
			console.log(person.cars.isFault); // true
			
			var anotherCar = carMapping.map({name: 'Bentley', colour: 'Grey', id:7}); 
			console.log(anotherCar._id); // "123"
			anotherCar.owner = person;
						
			// Still a fault!
			console.log(person.cars.isFault); // true
			console.log(person.cars._id); // ["abc", "123"];
			console.log(person.cars); // Fault{}
			
			person.cars.get(function (err, cars) {
				console.log(cars[0] === car); // true
				console.log(cars[1] === anotherCar); // true
				console.log(person.cars.isFault); // false
			});
		});
	}
});
```

### HTTP

Below are some example HTTP requests. The responses from these requests are passed through the descriptors and mapped into Siesta.

#### GET

The cars will be deserialised as per the response descriptor.

```javascript
collection.GET('cars/', function (err, cars) {
    console.log('I got me some cars!', cars);
});

collection.GET('cars/5', function (err, car) {
    console.log('I got me a car!', car);
});

// See https://docs.angularjs.org/api/ng/service/$http
var opts = {
	params: {
		queryParam1: 'something'
		queryParam2: 'something else'
	},
	headers: {
		x-my-header: 'some value'
	},
	requestType: 'json',
	responseType: 'json'
};

collection.GET('cars/', opts, function (err, cars) {
    console.log('I got me some cars!', cars);
});

collection.GET('cars/5', opts, function (err, car) {
    console.log('I got me a car!', car);
});
```

#### POST/PUT/PATCH

The person will be serialised as per the request descriptor and deserialised as per the response descriptor.

```javascript
var person = new collection.Person({name: 'Michael'});

// See https://docs.angularjs.org/api/ng/service/$http
var opts = {
	params: {
		queryParam1: 'something'
		queryParam2: 'something else'
	},
	headers: {
		x-my-header: 'some value'
	},
	// Added to the body alongside whatever is serialised.
	// This will ignore the request descriptor.
	data: { 
		key: {
			value: 'xyz'
		}
	}
	requestType: 'json',
	responseType: 'json'
};

collection.POST('people/', person, opts, function (err, person) {
    // ...
});

collection.PUT('people/' + person.id, person, opts, function (err, person) {
    // ...
});

collection.PATCH('people/' + person.id, person, opts, function (err, person) {
    // ...
});
```

#### DELETE

```javascript
console.log(person._id); // 'xyz'
collection.DELETE('people/' + person.id, person, opts, function (err) {
    if (!err) {
    	console.log(person._id); // null
    }
    else {
    	console.log(person._id); // 'xyz'
    }
});
```

## Concepts

### Object Mapping

### Persitence

### Single Source of Truth

### Faults

### Descriptors

### Dirtyness