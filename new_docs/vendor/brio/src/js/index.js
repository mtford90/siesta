var React = require('react'),
  _ = require('underscore'),
  marked = require('marked');

var Menu = require('./Menu'),
  Content = require('./Content');

window.brio = function (opts) {
  var {id, docs, highlight} = opts;

  if (highlight) {
    marked.setOptions({
      highlight: function (code) {
        return hljs.highlightAuto(code).value;
      }
    });
  }

  var App = React.createClass({
    getPageNames: function () {
      return Object.keys(docs.pages);
    },
    componentDidMount: function () {
      window.onhashchange = function () {
        this.setState({
          hierarchy: this._constructHierarchy()
        })
      }.bind(this);
    },
    _constructHierarchy: function () {
      var hash = window.location.hash;
      return hash.replace('#', '').split('/').slice(1);
    },
    getInitialState: function () {
      return {
        hierarchy: this._constructHierarchy()
      };
    },
    getCurrPageName: function () {
      return this.state.hierarchy[0] || Object.keys(docs.pages)[0];
    },
    getCurrSection: function () {
      var name = this.getCurrPageName();
      var section = docs.pages[name];
      var hierarchy = this.state.hierarchy;

      var clonedHierarchy = _.extend([], hierarchy);

      hierarchy
        .slice(1)
        .forEach(function (sectionName) {
          section = section[sectionName];
          name = sectionName;
        });

      while (!_.isArray(section)) {
        name = Object.keys(section)[0];
        section = section[name];
        clonedHierarchy.push(name);
      }

      console.log('clonedHierarchy', clonedHierarchy);

      return {section: section, name: name, hierarchy: clonedHierarchy};
    },
    render: function () {
      var pages = docs.pages,
        currentPageName = this.getCurrPageName(),
        page = pages[currentPageName];

      var {name, section, hierarchy} = this.getCurrSection();

      console.log('hierarchy', hierarchy);

      return (
        <div>
          <div className="header">
            <h1>
              <a href='#'>{docs.title}</a>
            </h1>
            <ul>
              {Object.keys(pages).map(function (pageName, idx) {
                var className = '';
                if (pageName == currentPageName) {
                  className += 'active';
                }
                return (
                  <li>
                    <a href={'#/' + pageName}
                       className={className}
                       key={idx}
                       data-idx={idx}
                       data-page-name={pageName}>
                      {pageName}
                    </a>
                  </li>
                )
              }.bind(this))}
            </ul>
          </div>

          <Menu page={page} pageName={currentPageName} hierarchy={hierarchy}/>

          <div className="content-wrapper">
            <Content section={section} sectionName={name} opts={opts}/>
          </div>

        </div>
      )
    }

  });
  //<Breadcrumbs hierarchy={this.state.hierarchy} pageName={name}/>

  var elem = document.getElementById(id);
  React.render(<App/>, elem);

};

