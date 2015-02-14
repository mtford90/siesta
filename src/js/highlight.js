$(document).ready(function() {
    var $code = $('code');
    $code.each(function(idx) {
        var elem = $code[idx];
        console.log('$code', elem);
        $(elem).html(Flatdoc.highlighters.js($(elem).text()))
    });
});
