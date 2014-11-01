---
layout: demo
title: Demo
---
<html>
<head lang="en">
    <meta charset="UTF-8">
    <title>Example</title>
    <script src="http://underscorejs.org/underscore.js"></script>
    <script src="http://underscorejs.org/underscore-min.js"></script>
    <script src="http://code.jquery.com/jquery-2.1.1.min.js"></script>
    <script src="siesta/siesta.js"></script>
    <script src="siesta/siesta.http.js"></script>
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.2.0/css/bootstrap.min.css">
    <link href='http://fonts.googleapis.com/css?family=Open+Sans:400,300,600,700,800' rel='stylesheet' type='text/css'>
    <link href="font-awesome/css/font-awesome.min.css" rel="stylesheet">
    <script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.2.0/js/bootstrap.min.js"></script>
    <script src="sweetalert/lib/sweet-alert.js"></script>
    <link rel="stylesheet" type="text/css" href="sweetalert/lib/sweet-alert.css">
    <link rel="stylesheet" type="text/css" href="style.css">
    <link rel="stylesheet" type="text/css" href="spinner.css">
    <link rel="stylesheet" type="text/css" href="vis.css">
    <script type="text/javascript" src="http://d3js.org/d3.v3.js"></script>
    <script src="http://underscorejs.org/underscore.js"></script>
    <script src="//cdnjs.cloudflare.com/ajax/libs/async/0.9.0/async.js"></script>
    <script src="https://code.jquery.com/jquery-2.1.1.js"></script>
    <script type="text/javascript" src="vis.js"></script>
    <script type="text/javascript" src="index.js"></script>
    <link rel="stylesheet" type="text/css" href="intro/introjs.css">
</head>
<body>
<div class="outer-spinner outer-overlay" id="spinner" style="display: none">
    <div class="spinner overlay">
        <div class="cube1"></div>
        <div class="cube2"></div>
    </div>
</div>
<div class="outer-overlay" id="no-results" style="display: none">
    <div class="overlay">
        <div id="centred-text">No results.</div>
    </div>
</div>
<div class="col-md-3 repo-col" style="display: none" id="template">
    <div class="repo">
        <div class="user">
            <span class="username"></span>
            <img/>
        </div>
        <h3 class="name"></h3>
        <div class="description"></div>
        <div class="stats">
            <div class="watchers stat">
                <div class="inner-stat">
                    <div><i class="fa fa-eye"></i></div>
                    <div class="num"></div>
                </div>
            </div>
            <div class="stars stat">
                <div class="inner-stat">
                    <div>
                        <i class="fa fa-star"></i>
                    </div>
                    <div class="num"></div>
                </div>
            </div>
            <div class="forks stat">
                <div class="inner-stat">
                    <div>
                        <i class="fa fa-code-fork" style="width: 20px; height: 20px"></i>
                    </div>
                    <div class="num"></div>
                </div>
            </div>
        </div>
        <div class="border"></div>
    </div>
</div>
<div id="header">
    <h3>Siesta Github Demo</h3>
    <a class="button" id="statistics-button" onclick="showStats()">Statistics</a>
</div>
<div id="content" class="container">
    <div id="repos"> 
        <div class="row"></div>
    </div>
    <div id="visualisation" style="display: none">
    </div>  
</div> 
<div id="footer">
    <div id="inner-footer">
        <div class="form" id="query-form">
            <i class="glyphicon glyphicon-user"></i>
            <input onkeypress="queryKeyPress(event)" id="INPUT_1" placeholder="Query" type="email" name="identification" ></input>
            <button type="submit" class="go-button" onclick="query()">
            Go
            </button>
        </div>
        <a class="button" id="visualise" onclick="visualisePressed(this)">Visualise</a>
    </div>
</div>
    <script type="text/javascript" src="intro/intro.js"></script>

</body>
</html>
