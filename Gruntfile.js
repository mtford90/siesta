module.exports = function (grunt) {

    var sh = require('execSync'),
        userConfig = require('./build.config.js');

    require('load-grunt-tasks')(grunt);
    require('time-grunt')(grunt);

    var taskConfig = {
        pkg: grunt.file.readJSON("package.json"),

        browserify: {
            options: {
                browserifyOptions: {
                    debug: true
                },
                debug: true,
                transform: []
            },
            build: {
                files: {
                    '<%= build_dir %>/siesta.js': ['core/index.js']
                }
            },
            test: {
                files: {
                    '<%= build_dir %>/test-bundle.js': ['<%= test_dir %>/**/*.spec.js'],
                    '<%= build_dir %>/siesta.js': ['core/index.js']
                }
            }
        },

        clean: {
            build: '<%= build_dir %>',
            compile: '<%= compile_dir %>',
            dist: './dist/'
        },

        uglify: {
            compile: {
                files: {
                    '<%= build_dir %>/siesta.min.js': '<%= build_dir %>/siesta.js'
                }
            }
        },

        delta: {
            gruntfile: {
                files: 'Gruntfile.js'
            },

            jssrc: {
                options: {
                    livereload: '<%= livereload_port %>'
                },
                files: [
                    '<%= app_files.js %>'
                ],
                tasks: ['test']
            },

            testsrc: {
                options: {
                    livereload: '<%= livereload_port %>'
                },
                files: [
                    '<%= app_files.jsunit %>'
                ],
                tasks: ['test']
            },

            http: {
                options: {
                    livereload: '<%= livereload_port %>'
                },
                files: [
                    '<%= src_dir %>/http/**/*.js'
                ],
                tasks: ['browserify:build']
            },

            index: {
                files: [
                    '<%= test_dir %>/index.tpl.html'
                ],
                tasks: ['index']
            }

        },

        connect: {
            site: {
                options: {
                    livereload: '<%= livereload_port %>',
                    port: '<%= connect_port %>',
                    base: './'
                }
            }
        }

    };

    grunt.initConfig(grunt.util._.extend(taskConfig, userConfig));

    grunt.renameTask('watch', 'delta');

    grunt.registerTask('dist', function () {
        grunt.file.mkdir('dist');
        sh.run('cp -r build/siesta.js dist/siesta.js');
        sh.run('cp -r build/siesta.min.js dist/siesta.min.js');
    });

    grunt.registerTask('watch', [
        'test',
        'connect:site',
        'delta'
    ]);

    grunt.registerTask('build', [
        'clean',
        'browserify:test'
    ]);


    grunt.registerTask('test', [
        'build'
    ]);

    grunt.registerTask('compile', [
        'browserify:build',
        'uglify'
    ]);

};
