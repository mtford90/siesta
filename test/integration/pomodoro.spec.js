var assert = require('chai').assert;

/*globals describe, it, beforeEach, before, after */
describe('pomodoro', function() {
  var Type = {
    Task: 'Task'
  };

  var DEFAULT_COLOURS = {
    primary: '#df423c',
    shortBreak: '#37a2c4',
    longBreak: '#292f37'
  };

  describe('rq', function() {
    var Pomodoro, Task;
    beforeEach(function(done) {
      siesta.reset(function() {
        Pomodoro = siesta.collection('Pomodoro');
        Task = Pomodoro.model(Type.Task, {
          attributes: [
            'title',
            'description',
            'completed',
            'editing',
            'index'
          ]
        });
        done();
      });
    });

    it('sad', function(done) {
      var incompleteTasks = Task._reactiveQuery({completed: false, __order: 'index'});
      incompleteTasks.init().then(function() {
        incompleteTasks.once('*', function() {
          done();
        });
        Task.graph({title: 'title', description: 'an awesome description', completed: false})
          .catch(done);
      }).catch(done);
    });
  });

  describe('config', function() {
    var Pomodoro, Config, ColourConfig, PomodoroConfig;
    beforeEach(function(done) {
      siesta.reset(function() {
        siesta.ext.storageEnabled = true;
        Pomodoro = siesta.collection('Pomodoro');
        Config = Pomodoro.model('Config', {
          relationships: {
            pomodoro: {model: 'PomodoroConfig'},
            colours: {model: 'ColourConfig'}
          },
          singleton: true
        });
        ColourConfig = Pomodoro.model('ColourConfig', {
          attributes: [
            {
              name: 'primary',
              default: DEFAULT_COLOURS.primary
            },
            {
              name: 'shortBreak',
              default: DEFAULT_COLOURS.shortBreak
            },
            {
              name: 'longBreak',
              default: DEFAULT_COLOURS.longBreak
            }
          ],
          singleton: true
        });
        PomodoroConfig = Pomodoro.model('PomodoroConfig', {
          attributes: [
            {
              name: 'pomodoroLength',
              default: 25
            },
            {
              name: 'longBreakLength',
              default: 15
            },
            {
              name: 'shortBreakLength',
              default: 5
            },
            {
              name: 'roundLength',
              default: 4
            }
          ],
          singleton: true
        });
        done();
      });
    });


    it('load, ColourConfig', function(done) {
      siesta.ext.storage._pouch.put({
        collection: 'Pomodoro',
        model: 'ColourConfig',
        primary: 'red',
        shortBreak: 'blue',
        longBreak: 'green',
        _id: 'xyz'
      }).then(function() {
        siesta.install().then(function() {
          ColourConfig.one()
            .then(function(colourConfig) {
              assert.equal(colourConfig.primary, 'red');
              assert.equal(colourConfig.shortBreak, 'blue');
              assert.equal(colourConfig.longBreak, 'green');
              done();
            })
            .catch(done);
        }).catch(done);
      }).catch(done);

    });

    it('load, Config', function(done) {
      siesta.ext.storage._pouch.put({
        collection: 'Pomodoro',
        model: 'ColourConfig',
        primary: 'red',
        shortBreak: 'blue',
        longBreak: 'green',
        _id: 'xyz'
      }).then(function() {
        siesta.install().then(function() {
          Config.one()
            .then(function(config) {
              var colourConfig = config.colours;
              assert.equal(colourConfig.primary, 'red');
              assert.equal(colourConfig.shortBreak, 'blue');
              assert.equal(colourConfig.longBreak, 'green');
              done();
            }).catch(done);
        });
      }).catch(done);
    });

    it('repeated saves', function(done) {
      siesta.ext.storage._pouch.put({
        collection: 'Pomodoro',
        model: 'ColourConfig',
        primary: 'red',
        shortBreak: 'blue',
        longBreak: 'green',
        _id: 'xyz'
      }).then(function() {
        siesta.install().then(function() {
          Config.one()
            .then(function(config) {
              var colourConfig = config.colours;
              colourConfig.primary = 'blue';
              siesta.save()
                .then(function() {
                  colourConfig.primary = 'orange';
                  siesta.save().then(function() {
                    siesta.ext.storage._pouch.query(function(doc) {
                      if (doc.model == 'ColourConfig') {
                        emit(doc._id, doc);
                      }
                    }, {include_docs: true})
                      .then(function(resp) {
                        var rows = resp.rows;
                        assert.equal(rows.length, 1, 'Should only ever be one row for singleton');
                        done();
                      })
                      .catch(done);
                  }).catch(done);
                })
                .catch(done);
            })
            .catch(done);
        });
      }).catch(done);
    });
  });


});