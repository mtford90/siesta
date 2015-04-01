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