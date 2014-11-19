module.exports = function (karma) {
    karma.set({
        /**
         * From where to look for files, starting with the location of this file.
         */
        basePath: '../',

        /**
         * This is the list of file patterns to load into the browser during testing.
         */
        files: [
            'node_modules/es5-shim/es5-shim.min.js', // Otherwise PouchDB doesn't work.
            'node_modules/q/q.js', // For mocking $q
            'node_modules/pouchdb/dist/pouchdb.js',
                'node_modules/pouchdb/dist/pouchdb.memory.js',
                'bower_components/jquery/dist/jquery.js',
                'bower_components/underscore/underscore.js',
                'bower_components/xregexp/xregexp-all.js',
                'node_modules/sinon/pkg/sinon.js',
                
            'build/test-bundle.js',
            'build/siesta.http.js'
            // 'build/siesta.perf.js'
    ],
    exclude: [
    ],
    frameworks: [ 'mocha', 'chai-things', 'chai'],
    plugins: [ 'karma-mocha',
               'karma-chai-things',
               'karma-chai',
               'karma-phantomjs-launcher',
               'karma-chrome-launcher',
               'karma-safari-launcher',
               'karma-sourcemap-loader'
               ],

    preprocessors: {
        'build/test-bundle.js': ['sourcemap']
    },
    /**
     * How to report, by default.
     */
    reporters: 'dots',

    /**
     * On which port should the browser connect, on which port is the test runner
     * operating, and what is the URL path for the browser to use.
     */
    port: 9018,
    runnerPort: 9100,
    urlRoot: '/',

            /**
            * Disable file watching by default.
            */
            autoWatch: false,

            /**
            * The list of browsers to launch to test on. This includes only "Firefox" by
            * default, but other browser names include:
            * Chrome, ChromeCanary, Firefox, Opera, Safari, PhantomJS
            *
            * Note that you can also use the executable name of the browser, like "chromium"
            * or "firefox", but that these vary based on your operating system.
            *
            * You may also leave this blank and manually navigate your browser to
            * http://localhost:9018/ when you're running tests. The window/tab can be left
     * open and the tests will automatically occur there during the build. This has
     * the aesthetic advantage of not launching a browser every time you save.
     */
    browsers: [
//      'PhantomJS'
      'Chrome'
//      'Firefox'
//        'Safari'
    ],

    logLevel: karma.LOG_ERROR

  });
};