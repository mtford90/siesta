var gulp = require('gulp'),
    watch = require('gulp-watch'),
    connect = require('gulp-connect'),
    jade = require('gulp-jade'),
    glob = require('glob'),
    async = require('async'),
    path = require('path'),
    runSequence = require('run-sequence'),
    rename = require('gulp-rename'),
    scss = require('gulp-sass');

var config = new function() {
    this.glob = {
        jade: './src/**/*.jade',
        md: './md/**/*.md',
        scss: './scss/**/*.scss'
    };
};

gulp.task('serve', function() {
    connect.server({
        port: 9080,
        livereload: true
    });
});

gulp.task('build:landing', function() {
    return buildJade('./src/landing.jade', 'md/index.md', 'index.html');
});

function buildJade(j, md, html) {
    return gulp.src(j)
        .pipe(jade({locals: {markdown: md}}))
        .pipe(rename(html))
        .pipe(gulp.dest('./'))
}

gulp.task('build:docs', function() {
    return buildJade('./src/docs.jade', 'md/docs.md', 'docs.html');
});

gulp.task('build:jade', ['build:docs', 'build:landing'], function() {
    return gulp.src(config.glob.jade)
        .pipe(connect.reload());
});

gulp.task('build:scss', function() {
    return gulp.src('./scss/**/*.scss')
        .pipe(scss())
        .pipe(gulp.dest('./css'))
        .pipe(connect.reload());
});

gulp.task('build:md', function() {
    return gulp.src(config.glob.md)
        .pipe(connect.reload());
});

gulp.task('build', ['build:jade', 'build:scss', 'build:md']);

gulp.task('watch:jade', function() {
    return gulp.watch(config.glob.jade, ['build:jade'])
});

gulp.task('watch:scss', function() {
    return gulp.watch(config.glob.scss, ['build:scss'])
});

gulp.task('watch:css', function() {
    gulp.src('./css/theme.css')
        .pipe(watch('./css/theme.css'))
        .pipe(connect.reload());
});

gulp.task('watch:md', function() {
    return gulp.watch(config.glob.md, ['build:md'])
});

gulp.task('watch', ['serve', 'build', 'watch:jade', 'watch:md', 'watch:scss', 'watch:css']);