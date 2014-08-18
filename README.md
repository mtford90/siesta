rest
====

RESTKit/CoreData inspired persistence for AngularJS. Features:

* Single source of truth for models.
* PouchDB-powered local peristence and synchronisation.

Current limitations:

* Only JSON supported.

## Quick Start

Full documentation is available [here (todo)](#) but here's how you can get started quickly.

### Step 1: Installation

TODO

### Step 2: Base Configuration

The point of entry is `RestAPI` and is used to configure each REST API you want to interface with.

```javascript
var api = new RestAPI('MyAPI', function (err, isNew) {
    if (!err) {
        if (isNew) {
            // Base URL.
            this.setBaseURL('http://mysite.com/api/');
            configureObjectMappings(this);
            configureDescriptors(this);
        }
        doStuff();
    }
    else {
        handleError(err);
    }
});
```

### Step 3: Configure Object Mappings

Your object mappings describe the models that will be downloaded from the target REST API.

```javascript
function configureObjectMappings(api) {
    // Car Mapping
    api.registerMapping('Car', {
        id: 'id',
        relationships: {
            owner: {
                mapping: 'Person',
                type: 'OneToOne',
                reverse: 'cars' // Will show up on Person objects
            }
        },
        attributes: ['model', 'colour', 'licensePlate'],
        indexes: ['colour'] // id is automatically indexed
    });
    
    // Person Mapping
    api.registerMapping('Person', {
        id: 'id',
        attributes: ['name', 'age']
    });
}
```

### Step 4: Configure Request/Response Descriptors

Descriptors map HTTP request and responses onto your object mappings and perform the appropriate action.

```javascript
function configureDescriptors(api) {
    // Request descriptors
    api.registerRequestDescriptor({
        path: 'cars/',
        method: 'POST',
        mapping: 'Car',
        data: 'data' // Serialise to {data: {...}} when sending the request.
    });
    api.registerRequestDescriptor({
        path: 'cars/:id/'
        method: 'PUT',
        mapping: 'Car',
        data: 'data' // Serialise to {data: {...}} when sending the request.
    });
    
    // Response descriptors
    api.registerResponseDescriptor({
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
api.get('cars/', function (err, cars) {
    console.log('I got me some cars!', cars);
});

api.get('cars/5', function (err, car) {
    console.log('I got me a car!', car);
});

// Create objects
var person = new api.Person({name: 'Michael'});
person.post(function (err) {
    if (!err) { 
        var car = new api.Car({colour: red, owner: person});
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

// Update object


// Delete object
```

### Step 6: Play with local data

Objects obtained remotely will be persisted using the defined object mappings. Therefore if 
the same object with the same id is downloaded multiple times it will be mapped onto the same
javascript object i.e. a single source of truth. 

The best way to explain this concept is by way of example:

```javascript

// Get all cars that are stored locally.
api.Car.all(function (err, cars) {
    /* 
        cars = [{colour: 'blue', model: 'Aston Martin', id: 5}]
    */
    var car = cars[0];
    
    // Get all people that are stored remotely.
    api.('people/').get(function (err, people) {
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

TODO

### Notifications

Notifications are sent via `$rootScope` for a variety of situations.

#### HTTP Requests

The notification looks as follows:

```javascript
{
    name: 'post Car', // Name of the notification
    object: {  // The object that has been posted to the server.
        colour: 'red', 
        owner: function getter() { ... } 
    },
    mapping: { ... }, // The 'Car' mapping.
    requestDescriptor: { ... }, // The request descriptor used to perform the serialisation.
    request: {path: 'cars/', data: {...}} // The HTTP request sent to the server.
}
```

Here are some examples:

```javascript

// Sent on sending of POST request to server for any object.
$rootScope.on('POST', function (notification) {
    console.log(notification);
});

// Sent on sending of POST request to server of a Car.
$rootScope.on('POST Car', function (notification) {
    console.log(notification);
});

// Sent on successful response of POST of a Car.
$rootScope.on('POST Car success', function (notification) {
    console.log(notification);
});

```

#### Updates

Notifications are also sent when fields on particular objects have changed e.g. after a successful response
mapping or after a local modification.

```javascript
$rootScope.on('Car', function (notification) {
    console.log(notification);
    /*
       LOG: {
             name: 'Car', // Name of the notification
             object: {  // The object that has been posted to the server.
                 colour: 'blue', 
                 owner: function getter() { ... } 
             },
             changes: [{
                 type: 'updated',
                 old: 'red',
                 new: 'blue'
             }]
        }
    */
    // Relationships are not neccessarilly cached and may be stored on
    // disk instead hence the use of a getter function.
    notification.object.owner.get(function (err, person) {
        console.log(person);
    });
});
```

### Database synchronisation

We can synchronise with CouchDB instances thanks to the use of PouchDB behind the scenes.

TODO

## Contributing

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

Note that with mocha we can use `only` to run an individual test/block of tests:

```
it.only('test', function () {
    // Do test.
});

describe.only('block of tests', function () {
    it('...', function () {
        // ...
    });
});
```