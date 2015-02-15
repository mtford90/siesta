$(document).ready(function() {
    var path = window.location.pathname.split('/')[1];
    $('.header').find('a').each(function(idx, value) {
        var $a = $(value),
            href = $a.attr('href');
        if (href == path) $a.addClass('active');
    });
});