angular.module('restkit.mapping', ['logging'])

    .factory('guid', function () {
        return (function () {
            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000)
                    .toString(16)
                    .substring(1);
            }

            return function () {
                return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
                    s4() + '-' + s4() + s4() + s4();
            };
        })();
    })

    .factory('wrappedCallback', function () {
        return function (callback) {
            if (callback) callback();
        }
    })

    .factory('RestAPI', function (wrappedCallback, jlog, guid) {

        var $log = jlog.loggerWithName('RestAPI');

        var pouch;

        /**
         *
         * @param name
         * @param {Function} callback(err, new)
         * @constructor
         */
        function RestAPI(name, callback) {
            $log.debug('Initialising RestAPI[' + name.toString() + ']');
            var self = this;

            this._name = name;

            this._docId = 'RestAPI_' + this._name;

            pouch.get(this._docId).then(function (doc) {
                _.bind(callback, self, null, false);
            }).catch( function(err) {
                if (err.status == 404) {
                    _.bind(callback, self, null, true)();
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