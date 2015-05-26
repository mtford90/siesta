var React = require('react'),
  ReactBootstrap = require('react-bootstrap'),
  Accordion = ReactBootstrap.Accordion,
  Panel = ReactBootstrap.Panel;

var FuncDef = require('./FuncDef'),
  FuncDesc = require('./FuncDesc'),
  FuncExample = require('./FuncExample');

var Func = React.createClass({
  render: function () {
    var func = this.props.func,
      examples = func.examples || [];

    return (
      <div className="func">
        <FuncDef func={func}/>
        <FuncDesc func={func}/>

        <Accordion className="func-examples">
          {examples.map(function (example, idx) {
          var header = <span>Example #{idx + 1}: {example.name}</span>;
            return (
              <Panel header={header} eventKey={idx}>
                <FuncExample example={example}
                             func={func}
                             highlight={this.props.highlight}
                             idx={idx}
                             key={idx}/>
              </Panel>
            );
          }.bind(this))}
        </Accordion>
      </div>
    )
  }
});

module.exports = Func;
