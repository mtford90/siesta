angular.module('restkit.object', ['restkit'])

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
            defineSubProperty.call(this, 'api', this.mapping);

        }
        return RestObject;
    })

    .factory('asdasd', function (guid) {
        return {

        }
    })

;