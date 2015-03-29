var gulp = require('gulp'),
  connect = require('gulp-connect'),
  uglify = require('gulp-uglify'),
  open = require('open'),
  glob = require('glob'),
  browserify = require('browserify'),
  rename = require('gulp-rename'),
  runSequence = require('run-sequence'),
  source = require('vinyl-source-stream');

var PATH = {
    build: './build',
    dist: './dist',
    test: './test'
  },
  GLOB = {
    js: ['core/**/*.js', 'index.js', 'storage/**/*.js', 'performance/**/*.js', 'vendor/observe-js/src/**/*.js'],
    spec: 'test/**/*.spec.js',
    compiled: [PATH.build + '/**/*.js', '!' + PATH.build + '/test-bundle.js']
  },
  BUNDLE = 'siesta.js',
  LIVERELOAD_PORT = 47835,
  CONNECT_PORT = 4001;


gulp.task('watch:js', function() {
  gulp.watch(GLOB.js.concat(GLOB.spec), ['build:test']);
});

gulp.task('watch', function(done) {
  runSequence('serve', 'build:test', 'watch:js', 'open', done);
});

gulp.task('build:siesta', function(done) {
  var b = browserify({debug: true});
  b.add('./core/index.js');
  b.bundle()
    .pipe(source(BUNDLE))
    .pipe(gulp.dest(PATH.build))
    .on('end', done);
});

gulp.task('build:test', ['build:siesta'], function(done) {
  glob(GLOB.spec, function(err, files) {
    if (!err) {
      var b = browserify({debug: true});
      files.forEach(function(file) {
        b.add('./' + file);
      });
      b.bundle()
        .pipe(source('test-bundle.js'))
        .pipe(gulp.dest(PATH.build))
        .pipe(connect.reload())
        .on('end', done);
    } else done(err);
  })
});

gulp.task('compile', ['build:siesta'], function(done) {
  gulp.src(PATH.build + '/' + BUNDLE)
    .pipe(uglify())
    .pipe(rename('siesta.min.js'))
    .pipe(gulp.dest(PATH.build))
    .on('end', done);
});

gulp.task('dist', ['build:siesta', 'compile'], function(done) {
  gulp.src(GLOB.compiled)
    .pipe(gulp.dest(PATH.dist))
    .on('end', done);
});

gulp.task('serve', function() {
  connect.server({
    port: CONNECT_PORT,
    livereload: {
      port: LIVERELOAD_PORT
    }
  });
});

gulp.task('open', function() {
  open('http://localhost:' + CONNECT_PORT + '/test')
});