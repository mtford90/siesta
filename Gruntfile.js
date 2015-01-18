module.exports = function (grunt) {

    require('load-grunt-tasks')(grunt);
    require('time-grunt')(grunt);
    var fs = require('fs'),
        sh = require('execSync'),
        _ = require('underscore');

    var userConfig = require('./build.config.js');
    var LIVERELOAD_PORT = 47835,
        CONNECT_PORT = 4001;
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

        copy: {
            build_appjs: {
                files: [{
                    src: ['<%= app_files.js %>'],
                    dest: '<%= build_dir %>/',
                    cwd: '.',
                    expand: true
                }]
            },
            build_vendorjs: {
                files: [{
                    src: ['<%= vendor_files.js %>'],
                    dest: '<%= build_dir %>/',
                    cwd: '.',
                    expand: true
                }]
            }

        },

        uglify: {
            compile: {
                files: {
                    '<%= build_dir %>/siesta.min.js': '<%= build_dir %>/siesta.js'
                }
            }
        },

        mochaconfig: {
            unit: {
                dir: '<%= build_dir %>',
                src: [
                    '<%= vendor_files.js %>',
                    '<%= test_files.js %>'
                ]
            }
        },

        delta: {
            gruntfile: {
                files: 'Gruntfile.js'
            },

            jssrc: {
                options: {
                    livereload: LIVERELOAD_PORT
                },
                files: [
                    '<%= app_files.js %>'
                ],
                tasks: ['test']
            },

            testsrc: {
                options: {
                    livereload: LIVERELOAD_PORT
                },
                files: [
                    '<%= app_files.jsunit %>'
                ],
                tasks: ['test']
            },

            http: {
                options: {
                    livereload: LIVERELOAD_PORT
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
                    livereload: LIVERELOAD_PORT,
                    port: CONNECT_PORT,
                    base: './'
                }
            }
        },
        mocha: {
            test: {
                src: ['etest/index.html']
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

    grunt.registerTask('default', ['build', 'compile']);

    grunt.registerTask('dist', function () {
        grunt.file.mkdir('dist');
        sh.run('cp -r build/siesta.js dist/siesta.js');
        sh.run('cp -r build/siesta.min.js dist/siesta.min.js');
    });

    grunt.registerTask('npmPublish', function () {
        sh.run('npm publish ./');
    });

    // Construct release tasks centred around bump
    _.each([
        {bump: 'prerelease', cmd: 'pre', desc: 'Perform a pre-release e.g. 0.0.6 -> 0.0.6-1'},
        {bump: 'patch', cmd: 'patch', desc: 'Perform a pre-release e.g. 0.0.6 -> 0.0.7'},
        {bump: 'minor', cmd: 'minor', desc: 'Perform a minor release e.g. 0.0.6 -> 0.1.6'},
        {bump: 'major', cmd: 'major', desc: 'Perform a major release e.g. 0.0.6 -> 1.0.6'}
    ], function (opts) {
        grunt.registerTask('release-' + opts.cmd, opts.desc, [
            'compile',
            'dist',
            'bump:' + opts.bump,
            'npmPublish'
        ])
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
                        scripts: jsFiles
                    }
                });
            }
        });
    });

    grunt.registerMultiTask('mochaconfig', 'Process mocha template', function () {
        var jsFiles = filterForJS(this.filesSrc);
        var process = function (contents, path) {
            return grunt.template.process(contents, {
                data: {
                    scripts: jsFiles
                }
            });
        };
        grunt.file.copy('test/index.tpl.html', grunt.config('build_dir') + '/index.html', {
            process: process
        });
    });

    grunt.event.on('watch', function (action, filepath, target) {
        if (action == 'changed') {
            if (target == 'demo') {
                var cmd;
                // Optimisation to avoid copying every single demo file on modelEvents.
                if (fs.existsSync('_site/demo')) {
                    var split = filepath.split('/');
                    split[0] = '_site';
                    var targetFilePath = split.join('/');
                    cmd = 'cp ' + filepath + ' ' + targetFilePath;
                    grunt.log.writeln(cmd);
                    sh.run(cmd);
                } else {
                    cmd = 'cp -r docs/demo _site/demo';
                    sh.run(cmd);
                    grunt.log.writeln(cmd);
                }
            }
        }
    });

};
