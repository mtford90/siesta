var gulp = require('gulp'),
  _ = require('underscore'),
  async = require('async'),
  plugins = require('gulp-load-plugins')();

gulp.task('build', function() {
  return gulp.src(['./core/index.js'])
    .pipe(plugins.webpack({
      devtool: 'inline-source-map'
    }))
    .pipe(plugins.rename('siesta.js'))
    .pipe(gulp.dest('./build'))
    .pipe(plugins.livereload({port: 47835}));
});

gulp.task('build-source-map', function() {
  return gulp.src(['./core/index.js'])
    .pipe(plugins.webpack({
      devtool: 'inline-source-map'
    }))
    .pipe(plugins.rename('siesta-with-src-map.js'))
    .pipe(gulp.dest('./build'))
    .pipe(plugins.livereload({port: 47835}));
});


gulp.task('test-bundle', function() {
  return gulp.src(['./test/**/*.spec.js'])
    .pipe(plugins.webpack({}))
    .pipe(plugins.rename('test-bundle.js'))
    .pipe(gulp.dest('./build'))
    .pipe(plugins.livereload({port: 47835}));
});

gulp.task('dist', ['build'], function() {
  return gulp.src(['./build/siesta.js'])
    .pipe(plugins.uglify())
    .pipe(plugins.rename('siesta.min.js'))
    .pipe(gulp.dest('./build'));
});

gulp.task('release', ['dist'], function() {
  return gulp.src(['./build/siesta.js', './build/siesta.min.js'])
    .pipe(gulp.dest('./dist'));
});

gulp.task('serve', function() {
  plugins.connect.server({
    root: './test',
    port: 4001
  });
});

gulp.task('livereload:listen', function() {
  plugins.livereload.listen({port: 47835});
});


gulp.task('watch:js', function() {
  return gulp.watch(['./core/**/*.js', './storage/**/*.js'], ['build-source-map']);
});

gulp.task('watch:test', function() {
  return gulp.watch(['./test/**/*.spec.js'], ['test-bundle']);
});

gulp.task('watch', [
  'build-source-map',
  'test-bundle',
  'watch:js',
  'watch:test',
  'livereload:listen',
  'serve'
]);