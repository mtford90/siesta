var s = require('../../core/index'),
    assert = require('chai').assert;

/*globals describe, it, beforeEach, before, after */
describe('pomodoro', function () {
    var Pomodoro, Task;

    var Type = {
        Task: 'Task'
    };

    var DEFAULT_COLOURS = {
        primary: '#df423c',
        shortBreak: '#37a2c4',
        longBreak: '#292f37'
    };


    beforeEach(function (done) {
        s.reset(function () {
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
            s.install(done);
        });
    });

    it('sad', function (done) {
        var incompleteTasks = Task.reactiveQuery({completed: false}).orderBy('index');
        incompleteTasks.init().then(function () {
            incompleteTasks.once('change', function () {
                done();
            });
            Task.map({title: 'title', description: 'an awesome description', completed: false})
                .catch(done)
                .done();
        }).catch(done).done();
    })
});