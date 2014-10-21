---
layout: demo
title: Demo
---
<div class="outer-spinner outer-overlay" id="spinner" style="display: none">
    <div class="spinner overlay">
        <div class="cube1"></div>
        <div class="cube2"></div>
    </div>
</div>
<div class="outer-overlay" id="initial-text">
    <div class="overlay">
        <div id="centred-text">
            <p>Welcome to the Siesta demo!</p>
            <p>This is a simple JQuery web app that uses Siesta to interface with the GitHub API, allowing users to search through repositories by name and description.</p>
            <p>Use the form in the bottom left to start your search.</p>
        </div>
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
</div>
<div id="footer">
    <div id="inner-footer">
        <div class="form">
            <i class="glyphicon glyphicon-user"></i>
            <input onkeypress="queryKeyPress(event)" id="INPUT_1" placeholder="Query" type="email" name="identification" ></input>
            <button type="submit" class="go-button" onclick="query()"">
            Go
            </button>
        </div>
        <a  class="button" id="visualise" onclick="visualise(this)">Visualise</a>
    </div>
</div>