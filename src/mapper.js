angular.module('restkit.mapper', ['restkit'])

    .factory('RestObject', function (defineSubProperty) {
        function RestObject (mapping) {
            var self = this;
            this.mapping = mapping;
            Object.defineProperty(this, 'idField', {
                get: function () {
                    return self.mapping.id ? self.mapping.id : 'id';
                },
                enumerable: true,
                configurable: true
            });
            defineSubProperty.call(this, 'type', this.mapping);
        }
        return RestObject;
    })

    .factory('asdasd', function (guid) {
        return {

        }
    })

;