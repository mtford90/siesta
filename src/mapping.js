angular.module('restkit.mapping', ['restkit.indexing', 'restkit', 'restkit.query'])

    .factory('Mapping', function (Indexes, Query, defineSubProperty, guid, RestObject, jlog, RestError) {

        var $log = jlog.loggerWithName('Mapping');

        function Mapping(opts) {
            var self = this;
            this._opts = opts;
            Object.defineProperty(this, '_fields', {
                get: function () {
                    var fields = [];
                    if (self._opts.id) {
                        fields.push('id');
                    }
                    if (self._opts.attributes) {
                        _.each(self._opts.attributes, function (x) {fields.push(x)});
                    }
                    return fields;
                },
                enumerable: true,
                configurable: true
            });



            defineSubProperty.call(this, 'type', self._opts);
            defineSubProperty.call(this, 'id', self._opts);
            defineSubProperty.call(this, 'api', self._opts);
            defineSubProperty.call(this, 'attributes', self._opts);
        }

        Mapping.prototype.query = function (query, callback) {
            var q = new Query(this, query);
            q.execute(callback);
        };

        Mapping.prototype.get = function (id, callback) {
            var opts = {};
            opts[this.id] = id;
            var q = new Query(this, opts);
            q.execute(function (err, rows) {
                var obj = null;
                if (!err && rows.length) {
                    if (rows.length > 1) {
                        err = 'More than one object with id=' + id.toString();
                    }
                    else {
                        obj = rows[0];
                    }
                }
                if (callback) callback(err, obj);
            });
        };

        Mapping.prototype.all = function (callback) {
            var q = new Query(this, {});
            q.execute(callback);
        };

        Mapping.prototype.install = function (callback) {
            var errors = this._validate();
            if (!errors.length) {
                Indexes.installIndexes(this.api, this.type, this._fields, callback);
            }
            else {
                if (callback) callback(errors);
            }
        };

        Mapping.prototype._validate = function () {
            var errors = [];
            if (!this.type) {
                errors.push('Must specify a type');
            }
            if (!this.api) {
                errors.push('A mapping must belong to an api');
            }
            return errors;
        };

        /**
         * Map data into Fount. This is where the magic happens.
         *
         * @param data Raw data received remotely or otherwise
         */
        Mapping.prototype.map = function (data) {

        };

        /**
         * Convert raw data into a RestObject
         * @param data
         * @returns {RestObject}
         * @private
         */
        Mapping.prototype._new = function (data) {
            $log.debug('_new', data);
            var idField = this.id;
            if (data[idField]) {
                var _id = guid();
                var restObject = new RestObject();
                restObject._id = _id;
                _.each(this._fields, function (field) {
                    $log.debug('_new looking for "' + field + '" in ', data);
                    if (data[field]) {
                        restObject[field] = data[field];
                    }
                });
                return restObject;
            }
            else {
                throw new RestError('id field "' + idField.toString() + '" is not present', {data: data});
            }
        };

        return Mapping;
    })

;