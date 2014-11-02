/**
 * Hack in a bug fix whereby code blocks would not be newlines by jsdoc2md.
 *
 * e.g. jsdoc2md would spit out
 *
 * **Example**
 * ```js
 * ...
 * ```
 *
 * instead of
 *
 * **Example**
 *
 * ```js
 * ...
 * ```
 *
 * The newline is very much important in terms of rendering correctly.
 */
function bugFix(data) {
    data = data.replace(/(\*+(.*)\*+)(.*)\n```js/g, '$1\n\n```js');
    return data.replace(/(\*+(.*)\*+)(.*)\n```javascript/g, '$1\n\n```js');
}


module.exports = function(grunt) {

    require('load-grunt-tasks')(grunt);
    require('time-grunt')(grunt);
    var exec = require('child_process').exec,
        fs = require('fs'),
        sh = require('execSync');


    var userConfig = require('./build.config.js');

    function extracted(outputFile, data, cb) {
        var templateFile = 'docs/' + outputFile + '.template';
        var prefix = fs.readFileSync(templateFile);
        data = prefix + '\n' + data;
        data = bugFix(data);
        fs.writeFile('docs/' + outputFile, data, cb);
    }

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
                browserifyOptions: {
                    debug: true
                },
                debug: true
            },
            build: {
                files: {
                    '<%= build_dir %>/siesta.js': ['index.js'],
                    '<%= build_dir %>/siesta.storage.js': ['src/pouch/storage.js'],
                    '<%= build_dir %>/siesta.http.js': ['src/http/http.js']
                }
            },
            test: {
                files: {
                    '<%= build_dir %>/test-bundle.js': ['<%= test_dir %>/**/*.spec.js'],
                    '<%= build_dir %>/siesta.storage.js': ['src/pouch/storage.js'],
                    '<%= build_dir %>/siesta.http.js': ['src/http/http.js']
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
            },
            build_extensionjs: {
                files: [{
                    src: '<%= src_dir %>/performance.js',
                    cwd: '.',
                    expand: true,
                    flatten: true,
                    rename: function() {
                        return 'build/siesta.perf.js'
                    }
                }]
            }

        },

        uglify: {
            compile: {
                files: {
                    '<%= build_dir %>/siesta.min.js': '<%= build_dir %>/siesta.js',
                    '<%= build_dir %>/siesta.http.min.js': '<%= build_dir %>/siesta.http.js',
                    '<%= build_dir %>/siesta.perf.min.js': '<%= build_dir %>/siesta.perf.js',
                    '<%= build_dir %>/siesta.storage.min.js': '<%= build_dir %>/siesta.storage.js',
                    '<%= build_dir %>/siesta.bundle.min.js': '<%= build_dir %>/siesta.bundle.js'
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
            gruntfile: {
                files: 'Gruntfile.js'
            },

            jssrc: {
                files: [
                    '<%= app_files.js %>',
                    '!<%= src_dir %>/http/**/*.js',
                    '!<%= src_dir %>/performance.js'
                ],
                tasks: ['browserify:test', 'karma:unit:run']
            },

            perf: {
                files: [
                    '<%= src_dir %>/performance.js'
                ],
                tasks: ['copy:build_extensionjs', 'karma:unit:run']
            },

            http: {
                files: [
                    '<%= src_dir %>/http/**/*.js',
                ],
                tasks: ['browserify:build', 'karma:unit:run']
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
                tasks: ['browserify:test', 'karma:unit:run']
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
                    'docs/*/**.js'
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

        shell: {
            api: {
                options: {
                    stderr: false,
                    callback: function(err, stdout, stderr, cb) {
                        if (err) {
                            console.error(err);
                            cb(err);
                        } else extracted('api.md', stdout, cb);
                    }
                },
                command: 'jsdoc2md src/collection.js src/http/http.js src/store.js src/http/descriptor.js src/http/responseDescriptor.js src/cache.js'
            },
            jekyllBuild: {
                command: 'jekyll build -s docs/ -d _site/ -c docs/_config.dev.yml'
            },
            jekyllCompile: {
                command: 'jekyll build -s docs/ -d _site/ -c docs/_config.yml'
            },
            jekyllDist: {
                command: 'cd _site/ && git add * && git commit -a -m "Jekyll Build" && git push origin gh-pages'
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
                    '<%= build_dir %>/siesta.js',
                    '<%= build_dir %>/siesta.http.js',
                    '<%= build_dir %>/siesta.storage.js'
                ],
                dest: '<%= build_dir %>/siesta.bundle.js'
            }
        },

        compress: {
            comp: {
                files: [{
                    src: ['<%= build_dir %>/siesta.http.min.js'],
                    dest: '<%= build_dir %>/siesta.http.min.js.gz'
                }, {
                    src: ['<%= build_dir %>/siesta.bundle.min.js'],
                    dest: '<%= build_dir %>/siesta.bundle.min.js.gz'
                }, {
                    src: ['<%= build_dir %>/siesta.perf.min.js'],
                    dest: '<%= build_dir %>/siesta.perf.min.js.gz'
                }, {
                    src: ['<%= build_dir %>/siesta.storage.min.js'],
                    dest: '<%= build_dir %>/siesta.storage.min.js.gz'
                }, {
                    src: ['<%= build_dir %>/siesta.min.js'],
                    dest: '<%= build_dir %>/siesta.min.js.gz'
                }]
            }
        }

    };

    grunt.initConfig(grunt.util._.extend(taskConfig, userConfig));



    grunt.renameTask('watch', 'delta');
    grunt.registerTask('default', ['build', 'compile']);

    grunt.registerTask('watch', [
        'build',
        'build-jekyll',
        'connect:site',
        'karma:unit',
        'delta'
    ]);

    grunt.registerTask('watch-no-test', [
        'clean',
        'copy:build_extensionjs',
        'browserify:test',
        'karmaconfig',
        'build-jekyll',
        'connect:site',
        'karma:unit',
        'delta'
    ]);

    grunt.registerTask('watch-no-jekyll', [
        'build',
        'karma:unit',
        'delta'
    ]);

    grunt.registerTask('build', [
        'clean',
        'copy:build_extensionjs',
        'browserify:test',
        'karmaconfig',
        'karma:continuous'
    ]);

    grunt.registerTask('test', [
        'build'
    ]);

    grunt.registerTask('compile', [
        'browserify:build',
        'copy:build_extensionjs',
        'concat:bundle',
        'uglify',
        'compress'
    ]);

    grunt.registerTask('build-docs', [
        'shell:api'
    ]);

    grunt.registerTask('build-jekyll', [
        'less:dev',
        'build-docs',
        'shell:jekyllBuild'
    ]);

    grunt.registerTask('compile-jekyll', [
        'less:dev',
        'build-docs',
        'shell:jekyllCompile'
    ]);

    grunt.registerTask('dist-jekyll', [
        'compile-jekyll',
        'shell:jekyllDist'
    ]);

    function filterForJS(files) {
        return files.filter(function(file) {
            return file.match(/\.js$/);
        });
    }

    grunt.registerMultiTask('index', 'Process index.html template', function() {
        var dirRE = new RegExp('^(' + grunt.config('build_dir') + '|' + grunt.config('compile_dir') + ')\/', 'g');
        var jsFiles = filterForJS(this.filesSrc).map(function(file) {
            return '../' + file.replace(dirRE, '');
        });

        grunt.file.copy('etest/index.tpl.html', this.data.dir + '/index.html', {
            process: function(contents, path) {
                return grunt.template.process(contents, {
                    data: {
                        specs: jsFiles
                    }
                });
            }
        });
    });

    grunt.registerMultiTask('karmaconfig', 'Process karma config templates', function() {
        var jsFiles = filterForJS(this.filesSrc);
        var process = function(contents, path) {
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

    grunt.event.on('watch', function(action, filepath, target) {
        if (action == 'changed') {
            if (target == 'demo') {
                // Optimisation to avoid copying every single demo file on changes.
                if (fs.existsSync('_site/demo')) {
                    var split = filepath.split('/');
                    split[0] = '_site';
                    var targetFilePath = split.join('/');
                    sh.run('cp ' + filepath + ' ' + targetFilePath);
                } else {
                    sh.run('cp -r docs/demo _site/demo');
                }
                grunt.log.writeln('yo', filepath, action)
            }
        }
    });

};