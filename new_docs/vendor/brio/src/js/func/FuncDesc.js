var React = require('react');

var FuncDesc = React.createClass({
  render: function () {
    var desc = this.props.func.description;
    return (
      <p className="func-desc">
        {desc}
      </p>
    );
  }
});

module.exports = FuncDesc;
