/**
 * This file/module contains all configuration for the build process.
 */
module.exports = {

    build_dir: 'build',
    compile_dir: 'bin',
    src_dir: 'src',
    test_dir: 'test',

    app_files: {
        js: ['core/**/*.js', 'http/**/*.js', 'index.js', 'storage/**/*.js'],
        jsunit: ['test/**/*.spec.js']
    },

    test_files: {
        js: [
            'node_modules/sinon/pkg/sinon.js'
        ]
    },

    vendor_files: {
        js: [
            'node_modules/pouchdb/dist/pouchdb.js',
            'node_modules/pouchdb/dist/pouchdb.memory.js',
            'bower_components/jquery/dist/jquery.js',
            'bower_components/underscore/underscore.js',
            'bower_components/xregexp/xregexp-all.js'
        ]
    }
};
