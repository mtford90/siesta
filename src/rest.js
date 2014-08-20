angular.module('restkit', ['logging', 'restkit.mapping'])

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
            return function (err, res) {
                if (callback) callback(err, res);
            }
        }
    })

    .factory('Pouch', function (guid, jlog) {

        var $log = jlog.loggerWithName('Pouch');

        var pouch = PouchDB('Rest');
        return {
            /**
             * Create a randomly named PouchDB instance.
             * Used for testing purposes.
             * @private
             */
            reset: function () {
                var dbName = guid();
                $log.debug('_reset:', dbName);
                pouch = new PouchDB(dbName);
            },

            /**
             * Return the global PouchDB instance.
             * Used for testing purposes.
             * @returns {PouchDB}
             */
            getPouch: function () {
                return pouch;
            }
        }
    })

    .factory('RestAPI', function (wrappedCallback, jlog, Mapping, Pouch) {

        var $log = jlog.loggerWithName('RestAPI');

        /**
         * @param name
         * @param {Function} configureCallback(err, version)
         * @param {Function} finishedCallback()
         * @constructor
         */
        function RestAPI(name, configureCallback, finishedCallback) {
            var self = this;

            // Name of this API. Used to construct _docId
            this._name = name;

            // The PouchDB id.
            this._docId = 'RestAPI_' + this._name;

            // The PouchDB document that represents this RestAPI.
            this._doc = null;

            // Current version used for migrations.
            this.version = null;

            this._mappings = {};

            /**
             * Serialise this RestAPI config into a pouchdb document.
             *
             * @param doc PouchDB document
             */
            function serialiseIntoPouchDoc(doc) {
                doc.name = self._name;
                doc.version = self.version;
                doc.mappings = self._mappings;
                return doc;
            }

            /**
             * Given a response from PouchDB, update the document with new _id and _rev so
             * that when we next push to PouchDB we're informing it which version of the
             * document we think we have.
             * @param doc
             * @param resp
             */
            function updateDoc(doc, resp) {
                doc._id = resp.id;
                doc._rev = resp.rev;
                self._doc = doc;
            }

            /**
             * Update attributes using persisted version.
             * @param doc PouchDB doc representing this RestAPI.
             */
            function updateSelf(doc) {
                self.version = doc.version;
                self._mappings = doc.mappings;
            }

            /**
             * @returns {string} A string represention of this API.
             */
            function description() {
                return 'RestAPI[' + self._name.toString() + ']';
            }

            /**
             * Pull this RestAPI from PouchDB or else perform first time
             * setup.
             */
            function init() {
                Pouch.getPouch().get(self._docId).then(function (doc) {
                    updateSelf(doc);
                    _.bind(configureCallback, self, null, doc.version)();
                    Pouch.getPouch().put(serialiseIntoPouchDoc(doc), function (err, resp) {
                        if (!err) {
                            updateDoc(doc, resp);
                            updateSelf(doc);
                        }
                        RestAPI[self._name] = self;
                        wrappedCallback(finishedCallback)(err);
                    });
                }).catch( function(err) {
                    if (err.status == 404) {
                        _.bind(configureCallback, self, null, null)();
                        var doc = serialiseIntoPouchDoc({});
                        Pouch.getPouch().put(doc, self._docId, function (err, resp) {
                            if (!err) {
                                doc._id = resp.id;
                                doc._rev = resp.rev;
                                self._doc = doc;
                            }
                            RestAPI[self._name] = self;
                            wrappedCallback(finishedCallback)(err);
                        });
                    }
                    else {
                        configureCallback(err);
                    }
                });
            }

            init();

        }


        RestAPI._reset = Pouch.reset;

        RestAPI._getPouch = Pouch.getPouch;

        RestAPI.prototype.registerMapping = function (name, mapping) {
            this._mappings[name] = mapping;
            this[name] = new Mapping(name);
        };

        return RestAPI;

    })

    .factory('RestError', function () {
        /**
         * Extension of javascript Error class for internal errors.
         * @param message
         * @param context
         * @param ssf
         * @returns {RestError}
         * @constructor
         */
        function RestError(message, context, ssf) {
            if (!this) {
                return new RestError(message, context);
            }

            this.message = message;

            this.context = context;
            // capture stack trace
            ssf = ssf || arguments.callee;
            if (ssf && Error.captureStackTrace) {
                Error.captureStackTrace(this, ssf);
            }
        }
        RestError.prototype = Object.create(Error.prototype);
        RestError.prototype.name = 'RestError';
        RestError.prototype.constructor = RestError;

        return RestError;
    })

    /**
     * Delegate property of an object to another object.
     */
    .factory('defineSubProperty', function () {
        return function (property, subObj) {
            return Object.defineProperty(this, property, {
                get: function () {
                    return subObj[property];
                },
                set: function (value) {
                    subObj[property] = value;
                },
                enumerable: true,
                configurable: true
            });
        }
    })



;