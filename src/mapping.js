angular.module('restkit.mapping', ['restkit.indexing', 'restkit', 'restkit.query'])

    .factory('Mapping', function (Indexes, Query) {
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
                    if (self._opts.relationships) {
                        _.each(self._opts.relationships, function (x) {fields.push(x)});
                    }
                    return fields;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(this, 'name', {
                get: function () {
                    return self._opts.name
                },
                set: function (name) {
                    self._opts.name = name
                },
                enumerable: true,
                configurable: true
            });
        }

        Mapping.prototype.query = function () {

        };

        Mapping.prototype.get = function (id) {

        };

        Mapping.prototype.all = function () {

        };

        Mapping.prototype.install = function () {

        };

        Mapping.prototype._validate = function () {
            var errors = [];
            if (!this.name) {
                errors.push('Must specify a name');
            }
            return errors;
        };

        return Mapping;
    })

;