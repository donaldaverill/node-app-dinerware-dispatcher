'use strict';
var Service = require('node-windows').Service;

// Create a new service object
var svc = new Service({
  name:'Dinerware Dispatcher',
  description: 'Connect to Dinerware!',
  script: 'C:\\Users\\Donald\\Documents\\Dev\\node-app-dinerware-dispatcher\\app.js'
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install',function(){
  svc.start();
});

svc.install();
