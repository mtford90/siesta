var gulp = require('gulp'),
  _ = require('underscore'),
  runSequence = require('run-sequence'),
  glob = require('glob'),
  path = require('path'),
  async = require('async'),
  plugins = require('gulp-load-plugins')();


gulp.task('build', function() {
  return gulp.src(['./core/index.js'])
    .pipe(plugins.webpack({}))
    .pipe(plugins.rename('siesta.js'))
    .pipe(gulp.dest('./build'))
    .pipe(plugins.livereload({port: 47835}));
});

gulp.task('dist', ['build'], function() {
  return gulp.src(['./build/siesta.js'])
    .pipe(plugins.uglify())
    .pipe(plugins.rename('siesta.min.js'))
    .pipe(gulp.dest('./build'));
});

gulp.task('release', ['dist'], function () {
  return gulp.src(['./build/siesta.js', './build/siesta.min.js'])
    .pipe(gulp.dest('./dist'));
});

gulp.task('serve', function() {
  plugins.connect.server({
    root: './',
    port: 4001
  });
});

gulp.task('livereload:listen', function () {
  plugins.livereload.listen({port: 47835});
});


gulp.task('watch:js', function() {
  return gulp.watch(['./core/**/*.js', './storage/**/*.js'], ['build']);
});

gulp.task('watch:test', function() {
  return gulp.watch(['./core/**/*.js', './storage/**/*.js'], ['build']);
});

gulp.task('watch', ['watch:js', 'watch:test', 'livereload:listen', 'serve']);