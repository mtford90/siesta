/**
 * This file/module contains all configuration for the build process.
 */
module.exports = {

    build_dir: 'build',
    compile_dir: 'bin',

    app_files: {
        js: [ 'src/**/*.js', '!src/**/*.spec.js'],
        jsunit: [ 'src/**/*.spec.js' ]
    },


    test_files: {
        js: [
            'bower_components/angular-mocks/angular-mocks.js',
            'node_modules/sinon/pkg/sinon.js',
        ]
    },

    vendor_files: {
        js: [
            'bower_components/pouchdb/dist/pouchdb-nightly.js',
            'bower_components/jquery/dist/jquery.js',
            'bower_components/underscore/underscore.js',
            'bower_components/async/lib/async.js',
            'bower_components/angular/angular.js',
            'bower_components/xregexp/xregexp-all.js'
        ]
    }
};
