$(document).ready(function() {
    var split = window.location.pathname.split('/');
    var path = split[split.length - 1];
    $('.header').find('a').each(function(idx, value) {
        var $a = $(value),
            href = $a.attr('href');
        if (href == path) $a.addClass('active');
    });
});