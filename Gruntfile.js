module.exports = function (grunt) {

    require('load-grunt-tasks')(grunt);
    require('time-grunt')(grunt);
    var fs = require('fs'),
        sh = require('execSync'),
        _ = require('underscore');

    var userConfig = require('./build.config.js');
    var taskConfig = {
        pkg: grunt.file.readJSON("package.json"),

        // https://github.com/vojtajina/grunt-bump
        // grunt bump:patch e.g. 0.0.6 -> 0.0.7
        // grunt bump:minor e.g. 0.0.6 -> 0.1.6
        // grunt bump:major e.g. 0.0.6 -> 1.0.6
        // grunt bump:prerelease e.g. 0.0.6 -> 0.0.6-1
        bump: {
            options: {
                files: ['package.json', 'bower.json'],
                updateConfigs: [],
                commit: true,
                commitMessage: 'Release v%VERSION%',
                commitFiles: ['dist', 'core', 'test', 'package.json', 'bower.json', 'http', 'storage'],
                createTag: true,
                tagName: '%VERSION%',
                tagMessage: 'Version %VERSION%',
                push: true,
                pushTo: 'upstream',
                gitDescribeOptions: '--tags --always --abbrev=1 --dirty=-d',
                globalReplace: false
            }
        },

        mocha_phantomjs: {
            all: ['test/index.html']
        },

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

                    '<%= build_dir %>/siesta.core.js': ['core/index.js'],
                    '<%= build_dir %>/siesta.http.js': ['http/index.js'],
                    '<%= build_dir %>/siesta.storage.js': ['storage/index.js']
                }
            },
            test: {
                files: {
                    '<%= build_dir %>/test-bundle.js': ['<%= test_dir %>/**/*.spec.js'],
                    '<%= build_dir %>/siesta.http.js': ['http/index.js'],
                    '<%= build_dir %>/siesta.storage.js': ['storage/index.js']
                }
            }
        },

        clean: {
            build: '<%= build_dir %>',
            compile: '<%= compile_dir %>'
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
                    '<%= build_dir %>/siesta.core.min.js': '<%= build_dir %>/siesta.core.js',
                    '<%= build_dir %>/siesta.http.min.js': '<%= build_dir %>/siesta.http.js',
                    '<%= build_dir %>/siesta.storage.min.js': '<%= build_dir %>/siesta.storage.js',
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
                    livereload: true
                },
                files: [
                    '<%= app_files.js %>'
                ],
                tasks: ['test']
            },

            testsrc: {
                options: {
                    livereload: true
                },
                files: [
                    '<%= app_files.jsunit %>'
                ],
                tasks: ['test']
            },

            http: {
                options: {
                    livereload: true
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
            },


            less: {
                files: ['./docs/static/less/**/*.less'],
                tasks: ['build-jekyll']
            },

            jekyll: {
                files: [
                    'docs/**/*.md',
                    'docs/_includes/*.html',
                    'docs/_data/*.yml',
                    'docs/_layouts/*.html',
                    'docs/_posts/*.md',
                    'docs/blog/*.html',
                    'docs/_config.yml',
                    'docs/static/**/*.js'
                ],
                tasks: [
                    'build-jekyll'
                ]
            },

            demo: {
                options: {
                    livereload: true
                },
                files: [
                    'docs/demo/**/*.js',
                    'docs/demo/**/*.html',
                    'docs/demo/**/*.css'
                ]
            }
        },

        less: {
            dev: {
                options: {
                    paths: ['docs/static/less']
                },
                files: {
                    'docs/static/css/main.css': 'docs/static/less/daux-blue.less'
                }
            }
        },
        connect: {
            site: {
                options: {
                    livereload: true,
                    port: 4000,
                    base: './_site'
                }
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
        },

        concat: {
            options: {
                separator: ';'
            },
            bundle: {
                src: [
                    '<%= build_dir %>/siesta.core.js',
                    '<%= build_dir %>/siesta.http.js',
                    '<%= build_dir %>/siesta.storage.js'
                ],
                dest: '<%= build_dir %>/siesta.js'
            }
        },

        compress: {
            comp: {
                files: [{
                    src: ['<%= build_dir %>/siesta.http.min.js'],
                    dest: '<%= build_dir %>/siesta.http.min.js.gz'
                }, {
                    src: ['<%= build_dir %>/siesta.core.min.js'],
                    dest: '<%= build_dir %>/siesta.core.min.js.gz'
                }, {
                    src: ['<%= build_dir %>/siesta.min.js'],
                    dest: '<%= build_dir %>/siesta.min.js.gz'
                }, {
                    src: ['<%= build_dir %>/siesta.storage.min.js'],
                    dest: '<%= build_dir %>/siesta.storage.min.js.gz'
                }


                ]
            }
        }

    };

    grunt.initConfig(grunt.util._.extend(taskConfig, userConfig));

    grunt.renameTask('watch', 'delta');

    grunt.registerTask('default', ['build', 'compile']);

    grunt.registerTask('dist', function () {
        sh.run('cp -r build/* dist/');
        sh.run('rm -f dist/*.gz dist/test-bundle.js');
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

    grunt.registerTask('build-no-test', [
        'browserify:build',
        'concat'
    ]);

    grunt.registerTask('test', [
        'build'
        // TODO: Fix tests in PhantomJS.
        //'mocha_phantomjs'
    ]);

    grunt.registerTask('compile', [
        'browserify:build',
        'concat:bundle',
        'uglify',
        'compress'
    ]);

    grunt.registerTask('build-jekyll', [
        'less:dev',
        'shell:jekyllBuild'
    ]);

    grunt.registerTask('compile-jekyll', [
        'less:dev',
        'shell:jekyllCompile'
    ]);

    grunt.registerTask('dist-jekyll', [
        'compile-jekyll',
        'shell:jekyllDist'
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
