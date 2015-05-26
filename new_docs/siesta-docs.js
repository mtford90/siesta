brio({
  id: 'app',
  docs: {
    title: 'Siesta',
    pages: {
      Documentation: {
        Serialisation: [
          {
            type: 'paragraph',
            content: 'Serialisation is the process of getting a model ' +
            'instance ready for conversion into a data transfer format like JSON e.g. ' +
            'eliminating circular references.'
          },
          {
            type: 'function',
            name: 'ModelInstance.serialise',
            description: 'Use the serialise function to prepare your instances for use ' +
            'in a data transfer format such as JSON.',
            parameters: {
              model: {
                type: 'Model',
                description: 'A siesta model',
                optional: false
              },
              opts: {
                type: 'Object',
                description: 'Options',
                optional: true,
                keys: {
                  fields: {
                    type: 'Array<String>',
                    description: 'which fields to serialise.'
                  },
                  nullAttributes: {
                    type: 'boolean',
                    description: 'should null attributes be serialised?'
                  },
                  nullRelationships: {
                    type: 'boolean',
                    description: 'should null relationships be serialised?'
                  }
                }
              }
            },
            examples: [
              {
                name: 'Specifying fields',
                description: 'In the below example we explictly specify which ' +
                'fields can be serialised.',
                code: function (done) {
                  var MyCollection = siesta.collection('MyCollection');

                  var MyModel = MyCollection.model({
                    name: 'MyModel',
                    attributes: ['field1', 'field2'],
                    serialisableFields: ['field1']
                  });

                  MyModel.graph({
                    field1: 1,
                    field2: 2
                  }).then(function (instance) {
                    var serialised = instance.serialise(),
                      json = JSON.stringify(serialised, null, 4);
                    console.log(json);
                    done();
                  });
                }
              }
            ]
          }
        ],
        'Other Section': {
          'Inner Section': [],
          'Inner Section 2': {
            'Inner Inner Section': []
          }
        },
        'And Another Section': []
      },
      Guide: [
        {
          type: 'markdown',
          url: 'guide.md'
        }
      ]
    }
  },
  highlight: function (code) {
    return hljs.highlightAuto(code).value;
  }
});
