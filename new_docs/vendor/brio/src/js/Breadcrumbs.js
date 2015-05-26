var React = require('react');

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

module.exports = Breadcrumbs;