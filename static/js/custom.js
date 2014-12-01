$(function () {
    $('.aj-nav').click(function (e) {
        e.preventDefault();
        $(this).parent().siblings().find('ul').slideUp();
        $(this).next().slideToggle();
    });

    // Bootstrap Table Class
    $('table').addClass('table');

    // Responsive menu spinner
    $('#menu-spinner-button').click(function () {
        $('#sub-nav-collapse').slideToggle();
    });

    // Catch browser resize
    $(window).resize(function () {
        // Remove transition inline style on large screens
        if ($(window).width() >= 768)
            $('#sub-nav-collapse').removeAttr('style');
    });
});

//Fix GitHub Ribbon overlapping Scrollbar
var t = $('#github-ribbon');
var a = $('article');
if (t[0] && a[0] && a[0].scrollHeight > $('.right-column').height()) t[0].style.right = '16px';

if (localStorage.getItem("toggleCodeStats") >= 0) {
    var t = localStorage.getItem("toggleCodeStats");
    if (t == 1) {
        localStorage.setItem("toggleCodeStats", 1);
    }
    if (t == 2) {
        localStorage.setItem("toggleCodeStats", 2);
    }
} else {
    localStorage.setItem("toggleCodeStats", 0);
}
