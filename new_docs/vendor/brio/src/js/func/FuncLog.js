var React = require('react');


var FuncLog = React.createClass({
  render: function () {
    return (
      <a href="#"
         ref="hyperlink"
         className="log highlighted-tooltip"
         dangerouslySetInnerHTML={{__html: this.props.highlight(this.props.content)}}/>
    );
  },
  componentDidMount: function () {
    var $hyperlink = $(this.refs['hyperlink'].getDOMNode());
    $hyperlink.tooltipster({
      theme: 'my-custom-theme',
      position: 'top-right',
      content: $('<pre>' + this.props.val + '</pre>')
    });
  }
});

module.exports = FuncLog;
