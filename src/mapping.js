angular.module('restkit.mapping', ['logging'])

    .factory('wrappedCallback', function () {
        return function (callback) {
            if (callback) callback();
        }
    })

    .factory('RestAPI', function (wrappedCallback, jlog) {

        var $log = jlog.loggerWithName('RestAPI');

        var pouch;

        function RestAPI(name, callback) {
            $log.debug('Initialising RestAPI[' + name.toString() + ']');
            var self = this;

            this._name = name;

            this._docId = 'RestAPI_' + this._name;
            $log.debug('0', this._docId);

            pouch.get(this._docId).then(function (doc) {
                $log.debug('1');
                $log.debug('Successfully looked up "' + self._docId + '"', doc);
            }).catch( function(err) {
                $log.debug('2');
                $log.debug('Error when looking up "' + self._docId + '":', err);
                if (err.status == 404) {
                    _.bind(callback, self, null)();
                }
                else {
                    callback(err);
                }
            });



        }

        RestAPI._reset = function () {
            var dbName = guid();
            $log.debug('_reset:', dbName);
            pouch = new PouchDB(dbName);
        };

        RestAPI._getPouch = function () {
            return pouch;
        };

        return RestAPI;
    })

    .factory('MappingOperation', function () {
        function MappingOperation(objectMapping) {

        }
    })

    .factory('ObjectMapping', function () {
        function ObjectMapping(modelName) {
            this.indexes = [];
            this.attributes = [];
            this.relationships = [];
            this.modelName = modelName;
        }


        return  ObjectMapping;
    })


    .factory('Index', function () {
        return function () {

        };
    })

    .factory('Relationship', function () {
        return function () {

        };
    })

    .factory('RequestDescriptor', function () {
        return function () {

        };
    })

    .factory('ResponseDescriptor', function () {
        return function () {

        };
    })

;