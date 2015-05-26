var React = require('react'),
  _ = require('underscore'),
  marked = require('marked');

var Func = require('./func/Func');

window.brio = function (opts) {
  var {id, docs, highlight} = opts;

  if (highlight) {
    marked.setOptions({
      highlight: function (code) {
        return hljs.highlightAuto(code).value;
      }
    });
  }

  var Menu = React.createClass({
    _renderSection: function (depth, path, section) {
      if (_.isArray(section)) {
        return ''
      }
      else {
        var sectionNames = Object.keys(section);
        return (
          <ul>
            {sectionNames.map(function (name) {
              var href = path + '/' + name;
              console.log('name', name);
              console.log('name', name);
              var hierarchy = this.props.hierarchy;
              console.log('hierarchy', hierarchy);
              var curr = hierarchy[depth];
              console.log('curr', curr);
              var isActive = name == curr;
              return [
                (
                  <li>
                    {isActive ? {name} : <a href={href}>{name}</a>}
                  </li>
                ),
                this._renderSection(depth + 1, href, section[name])
              ];
            }.bind(this))}
          </ul>
        )
      }
    },
    render: function () {
      return (
        <div className="menu-bar">
          <div className="menu">
            {this._renderSection(1, '#/' + this.props.pageName, this.props.page)}
          </div>
        </div>
      )
    }
  });

  var Breadcrumbs = React.createClass({
    render: function () {
      var hierarchy = this.props.hierarchy;
      var href = '#/' + hierarchy[0];
      return (
        <div className="breadcrumbs">
          <ul >
            {hierarchy.slice(1, hierarchy.length - 1).map(function (section) {
              href += '/' + section;
              return (
                <li>
                  <a href={href}>{section}</a>
                </li>
              )
            })}
            <li>
              {hierarchy[hierarchy.length - 1]}
            </li>
          </ul>
        </div>

      );
    }
  });

  var Content = React.createClass({
    getInitialState: function () {
      return {
        storage: {}
      }
    },
    initComponents: function (section) {
      section = section || this.props.section;
      console.log('initComponents', section);
      if (_.isArray(section)) {
        section.forEach(function (component, idx) {
          if (component.type == 'markdown') {
            if (component.url) {
              this.getMarkdown(component, idx);
            }
            else if (component.markdown) {
              this.state.storage[idx] = marked(component.markdown);
              this.forceUpdate();
            }
          }
        }.bind(this));
      }
    },
    componentWillReceiveProps: function (nextProps) {
      console.log('componentWillReceiveProps', nextProps);
      if (this.props.section != nextProps.section) {
        this.initComponents(nextProps.section);
      }
    },
    componentDidMount: function () {
      this.initComponents();
    },
    getMarkdown: function (md, idx) {
      var url = md.url;
      console.log('getMarkdown', url);
      $.get(url)
        .success(function (data) {
          this.state.storage[idx] = marked(data);
          this.forceUpdate();
        }.bind(this))
        .fail(function (jqXHR) {
          console.error('Error getting markdown at "' + url + '"', jqXHR);
        });
    },
    render: function () {
      var {section, sectionName} = this.props;

      console.log('section', section);
      console.log('sectionName', sectionName);

      if (_.isArray(section)) {
        var content = section.map(function (component, idx) {
          var type = component.type;
          if (type == 'function') {
            return (
              <div className='component' data-idx={idx}>
                <Func func={component} key={idx} idx={idx} highlight={highlight}/>
              </div>
            );
          }
          else if (type == 'paragraph') {
            return <p key={idx}>{component.content}</p>
          }
          else if (type == 'markdown' || type == 'md') {
            return <div className='markdown'
                        key={idx}
                        dangerouslySetInnerHTML={{__html: this.state.storage[idx] || ''}}/>
          }
          else if (!type) {
            throw new Error('Components must have a type.');
          }
          else {
            throw new Error('Unknown component type "' + type + '"');
          }
        }.bind(this));
      }
      else {

      }

      return (
        <div className="content">
          {content}
        </div>
      )
    }
  });

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
      var hierarchy = hash.replace('#', '').split('/').slice(1);
      return hierarchy;
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
            <Content section={section} sectionName={name}/>
          </div>

        </div>
      )
    }

  });
            //<Breadcrumbs hierarchy={this.state.hierarchy} pageName={name}/>

  var elem = document.getElementById(id);
  React.render(<App/>, elem);

};

