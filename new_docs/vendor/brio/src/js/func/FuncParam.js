var React = require('react');

var FuncParam = React.createClass({
  render: function () {
    var name = this.props.name,
      def = this.props.def;


    var heading = name + ' ' + '<' + def.type + '>';
    if (def.optional) {
      heading += ' (optional)'
    }
    return (
      <div>
        <span>{def.optional ? '[' : ''}
          <a ref="a" href='#' className="highlighted-tooltip">
            {name}
          </a>
          {def.optional ? ']' : ''}</span>

        <div ref="tooltipContents" style={{display: 'none'}} className="inner-tooltip-contents">
          <h5>{heading}</h5>
          {def.keys ? this.renderKeys() : ''}
        </div>
      </div>

    )
  },
  renderKeys: function () {
    var keys = this.props.def.keys;
    var keyNames = Object.keys(keys);
    return keyNames.map(function (keyName) {
      var key = keys[keyName];
      console.log('key', key);
      return (
        <div className="key">
          <span className="key-name">{keyName}</span>
          {key.type ? <span className="key-type">{'<' + key.type + '>'} - </span> : ''}
          {key.description ? <span className="key-desc">{key.description}</span> : ''}
        </div>
      )
    });
  },
  componentDidMount: function () {
    var $a = $(this.refs['a'].getDOMNode());
    var $content = $(this.refs['tooltipContents'].getDOMNode()).clone();
    $content.css('display', 'block');

    $a.tooltipster({
      theme: 'my-custom-theme',
      position: 'bottom-right',
      content: $content
    });

  }
});

module.exports = FuncParam;
