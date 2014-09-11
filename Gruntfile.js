module.exports = function (grunt) {

    require('load-grunt-tasks')(grunt);
    require('time-grunt')(grunt);

    var userConfig = require('./build.config.js');

    var license = require('fs').readFileSync('LICENSE');

    var taskConfig = {
        pkg: grunt.file.readJSON("package.json"),

        meta: {
            banner: '/**\n' +
                ' * <%= pkg.name %> - v<%= pkg.version %> - <%= grunt.template.today("yyyy-mm-dd") %>\n' +
                ' * <%= pkg.homepage %>\n' +
                ' *\n' +
                ' * Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author %> - All Rights Reserved\n' +
                ' * Unauthorized copying of this file, via any medium is strictly prohibited\n' +
                ' * Proprietary and Confidential\n' +
                ' */\n'
        },

        browserify: {
            options: {
                browserifyOptions : {
                    debug: true
                },
                debug: true
            },
            build: {
                files: {
                    '<%= build_dir %>/siesta.js': ['index.js']
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
            compile: '<%= compile_dir %>'
        },

        copy: {
            build_appjs: {
                files: [
                    {
                        src: [ '<%= app_files.js %>' ],
                        dest: '<%= build_dir %>/',
                        cwd: '.',
                        expand: true
                    }
                ]
            },
            build_vendorjs: {
                files: [
                    {
                        src: [ '<%= vendor_files.js %>' ],
                        dest: '<%= build_dir %>/',
                        cwd: '.',
                        expand: true
                    }
                ]
            }

        },

        uglify: {
            compile: {
                files: {
                    '<%= build_dir %>/siesta.min.js': '<%= build_dir %>/siesta.js'
                }
            }
        },

        /**
         * The Karma configurations.
         */
        karma: {
            unit: {
                configFile: '<%= build_dir %>/karma-unit.js',
                port: 9019,
                background: true
            },
            continuous: {
                configFile: '<%= build_dir %>/karma-unit.js',
                singleRun: true
            }
        },

        karmaconfig: {
            unit: {
                dir: '<%= build_dir %>',
                src: [
                    '<%= vendor_files.js %>',
                    '<%= test_files.js %>'
                ]
            }
        },

        delta: {
            options: {
                livereload: true
            },

            gruntfile: {
                files: 'Gruntfile.js',
                tasks: [ 'browserify:test', 'karma:unit:run' ]
            },

            jssrc: {
                files: [
                    '<%= app_files.js %>'
                ],
                tasks: [  'browserify:test', 'karma:unit:run' ]
            },

            index: {
                files: [
                    '<%= test_dir %>/index.tpl.html'
                ],
                tasks: ['index']
            },

            jsunit: {
                files: [
                    '<%= test_dir %>/**/*.js'
                ],
                tasks: [  'browserify:test', 'karma:unit:run' ]
            }

        },

        mocha: {
            test: {
                src: ['etest/index.html']
            }
        },

        mochaTest: {
            test: {
                options: {
                    reporter: 'spec'
                },
                src: [
                    '<%= test_dir %>/**/*.spec.js'
                ]
            }
        },

        index: {
            build: {
                dir: '<%= test_dir %>',
                src: [
                    '<%= test_dir %>/**/*.spec.js'

                ]
            }
        }

    };

    grunt.initConfig(grunt.util._.extend(taskConfig, userConfig));

    grunt.renameTask('watch', 'delta');
    grunt.registerTask('default', [ 'build', 'compile' ]);

    grunt.registerTask('watch', [ 'build', 'karma:unit', 'delta' ]);

    grunt.registerTask('build', [
        'clean',
        'browserify:test',
        'karmaconfig',
        'karma:continuous'
    ]);



    grunt.registerTask('compile', [
        'browserify:build',
        'uglify'
    ]);

    function filterForJS(files) {
        return files.filter(function (file) {
            return file.match(/\.js$/);
        });
    }

    grunt.registerMultiTask('index', 'Process index.html template', function () {
        var dirRE = new RegExp('^(' + grunt.config('build_dir') + '|' + grunt.config('compile_dir') + ')\/', 'g');
        var jsFiles = filterForJS(this.filesSrc).map(function (file) {
            return '../' + file.replace(dirRE, '');
        });

        grunt.file.copy('etest/index.tpl.html', this.data.dir + '/index.html', {
            process: function (contents, path) {
                return grunt.template.process(contents, {
                    data: {
                        specs: jsFiles
                    }
                });
            }
        });

    });

    grunt.registerMultiTask('karmaconfig', 'Process karma config templates', function () {
        var jsFiles = filterForJS(this.filesSrc);
        var process = function (contents, path) {
            return grunt.template.process(contents, {
                data: {
                    scripts: jsFiles
                }
            });
        };
        grunt.file.copy('karma/karma-unit.tpl.js', grunt.config('build_dir') + '/karma-unit.js', {
            process: process
        });

    });

};
