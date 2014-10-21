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

module.exports = function (grunt) {

    require('load-grunt-tasks')(grunt);
    require('time-grunt')(grunt);

    var fs = require('fs');

    function extracted(outputFile, data, cb) {
        var templateFile = outputFile + '.template';
        var prefix = fs.readFileSync(templateFile);
        data = prefix + '\n' + data;
        data = bugFix(data);
        fs.writeFile(outputFile, data, cb);
    }

    grunt.initConfig({
        delta: {
            options: {
                livereload: true
            },
            less: {
                files: ['static/less/**/*.less'],
                tasks: ['build']
            },
            jekyll: {
                files: ['*.md', '_includes/*.html', '_data/*.yml', '_layouts/*.html', '_posts/*.md', 'blog/*.html', '_config.yml'],
                tasks: ['build']
            }
        },
        less: {
            dev: {
                options: {
                    paths: ['static/less']
                },
                files: {
                    'static/css/main.css': 'static/less/daux-blue.less'
                }
            }
        },
        jekyll: {
            options: {
                bundleExec: true,
                dest: './_site',
                serve: false
            },
            build: {
                options: {
                    config: '_config.dev.yml'
                }
            },
            dist: {
                options: {
                    config: '_config.yml'
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
        shell: {
            collections: {
                options: {
                    stderr: false,
                    callback: function (err, stdout, stderr, cb) {
                        extracted('collections.md', stdout, cb);
                    }
                },
                command: 'jsdoc2md ../rest/src/collection.js'
            },
            http: {
                options: {
                    stderr: false,
                    callback: function (err, stdout, stderr, cb) {
                        extracted('http.md', stdout, cb);
                    }
                },
                command: 'jsdoc2md ../rest/src/http/http.js'
            },
            update_siesta: {
                options: {
                    stderr: false
                },
                command: 'rm -rf _site/build && rm -rf _site/demo; ' +
                    'cp -r ../rest/build _site/build; ' +
                    'cp -r ../rest/example _site/demo; ' +
                    'cp -r ../rest/node_modules _site/node_modules; ' +
                    'cp -r ../rest/bower_components _site/bower_components; '

            }

        }
    });

    grunt.registerTask('build', ['less:dev', 'jekyll:build']);
    grunt.renameTask('watch', 'delta');
    grunt.registerTask('watch', ['build', 'connect:site', 'delta']);
    grunt.registerTask('compile', ['less:dev', 'jekyll:dist'])

};