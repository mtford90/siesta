module.exports = function(grunt) {

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
                    '<%= build_dir %>/siesta.js': ['core/index.js'],
                    '<%= build_dir %>/siesta.performance.js': ['performance/index.js']
                }
            },
            test: {
                files: {
                    '<%= build_dir %>/test-bundle.js': ['<%= test_dir %>/**/*.spec.js']
                }
            }
        },

        clean: {
            build: '<%= build_dir %>',
            compile: '<%= compile_dir %>',
            dist: './dist/'
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
                tasks: ['browserify:build']
            },

            testsrc: {
                options: {
                    livereload: '<%= livereload_port %>'
                },
                files: [
                    '<%= app_files.jsunit %>'
                ],
                tasks: ['browserify:test']
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
        },

        uglify: {
            compile: {
                files: {
                    '<%= build_dir %>/siesta.min.js': ['<%= build_dir %>/siesta.js']
                }
            }
        }

    };

    grunt.initConfig(grunt.util._.extend(taskConfig, userConfig));

    grunt.renameTask('watch', 'delta');

    grunt.registerTask('dist', function() {
        grunt.file.mkdir('dist');
        sh.run('cp -r build/siesta.js dist/siesta.js');
        sh.run('cp -r build/siesta.min.js dist/siesta.min.js');
    });

    grunt.registerTask('watch', [
        'browserify',
        'connect:site',
        'delta'
    ]);

    grunt.registerTask('compile', [
        'browserify:build',
        'uglify'
    ]);

};
