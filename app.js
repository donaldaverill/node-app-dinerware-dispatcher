'use strict';
var DDPClient = require('ddp');
var Dinerware = require('./dinerware').dinerware;
var Settings = require('./settings.json');

var ddpclient = new DDPClient({
  host: Settings.meteor.host,
  port: Settings.meteor.port,
  path: 'websocket',
  ssl: false,
  autoReconnect: true,
  autoReconnectTimer: 10,
  maintainCollections: true,
  ddpVersion: '1'
});

ddpclient.connect(function (error, wasReconnect) {
  if (error) {
    console.log('DDP connection error!');
    return;
  }

  if (wasReconnect) {
    console.log('Reestablishment of a connection.');
  }

  ddpclient.call("login", [{
    user: {
      email: Settings.meteor.email
    },
    password: Settings.meteor.password
  }], function (err, result) {
    console.log(err, result);
  });

  var subId = ddpclient.subscribe('dinerwareDispatcher', [], function () {});
  var observer = ddpclient.observe('dinerware');

  observer.added = function (id) {
    var latestMessage = ddpclient.collections.dinerware[id];
    if (latestMessage.action === 'rfo') {
      Dinerware.RFO(latestMessage, ddpclient);
    }
  };

  observer.changed = function () {};

  ddpclient.on('socket-close', function ( /*code, message*/ ) {
    ddpclient.unsubscribe(subId);
    ddpclient._removeObserver('dinerware');
    if (observer) {
      observer.stop();
      observer = null;
    }
  });
});
