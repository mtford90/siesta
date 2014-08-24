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
            defineSubProperty.call(this, '_fields', this.mapping);

        }
        return RestObject;
    })

    .factory('FountArray', function () {

    })

    .constant('ChangeType', {
        Set: 'Set',
        Insert: 'Insert',
        Remove: 'Remove',
        Move: 'Move',
        Replace: 'Replace'
    })

;