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

module.exports = Menu;