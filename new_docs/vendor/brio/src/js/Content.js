var React = require('react'),
  _ = require('underscore'),
  marked = require('marked');

var Func = require('./func/Func');

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

    if (_.isArray(section)) {
      var content = section.map(function (component, idx) {
        var type = component.type;
        if (type == 'function') {
          return (
            <div className='component' data-idx={idx}>
              <Func func={component} key={idx} idx={idx} highlight={this.props.opts.highlight}/>
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

module.exports = Content;