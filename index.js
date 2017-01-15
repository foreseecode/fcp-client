var jsZip = require('node-zip'),
  fs = require('fs'),
  rest = require('restler');

/**
 * Initialize a new instance of FCP Client
 * @param username
 * @param password
 * @param hostname
 * @constructor
 */
var FCPClient = function (username, password, hostname) {
  if (!username) {
    throw new Error("Missing username");
  }
  if (!password) {
    throw new Error("Missing password");
  }
  if (!hostname) {
    throw new Error("Missing hostname");
  }
  if (hostname.indexOf(":/") == -1) {
    throw new Error("Hostname should look like https://bla.bla.com with no trailing slashes");
  }
  this.username = username;
  this.password = password;
  this.hostname = hostname;
};

/**
 * Return a fully qualified URL for an endpoint
 * @param endpoint
 * @private
 */
FCPClient.prototype._constructEndpointURL = function(endpoint) {
  return this.hostname + "/" + endpoint;
};

/**
 * Post new gateway JS files
 * @param uniminifiedJSStr {String} String containing the unminified JS file
 * @param minifiedJSStr {String} String containing the minified JS file
 * @param notes {String} Comments on this release
 * @param callback {Function} Callback
 */
FCPClient.prototype.postGatewayFiles = function (uniminifiedJSStr, minifiedJSStr, notes, callback) {
  callback = callback || function () {
    };
  if (!uniminifiedJSStr) {
    throw new Error("Missing unminified JS file.");
  }
  if (!minifiedJSStr) {
    throw new Error("Missing minified JS file.");
  }
  if (!notes) {
    throw new Error("Missing notes.");
  }
  if (minifiedJSStr.length >= uniminifiedJSStr) {
    throw new Error("The minified JS file appears to be the same size or larger than the uniminified version.");
  }
  var zip = new jsZip();
  zip.file('gateway.js', uniminifiedJSStr);
  zip.file('gateway.min.js', minifiedJSStr);
  var data = zip.generate({base64: false, compression: 'DEFLATE'});

  rest.post(this._constructEndpointURL('gateway'), {
    multipart: true,
    username: this.username,
    password: this.password,
    data: {
      'notes': notes,
      'gateway': rest.data("gateway.zip", "application/octet-stream", data)
    }
  }).on('complete', function(data) {
    callback(data.statusCode == 200);
  });
};

/**
 * Post new config JS files
 * @param uniminifiedJSStr {String} String containing the unminified JS file
 * @param minifiedJSStr {String} String containing the minified JS file
 * @param notes {String} Comments on this release
 * @param callback {Function} Callback
 */
FCPClient.prototype.postConfigFiles = function (uniminifiedJSStr, minifiedJSStr, notes, callback) {
  callback = callback || function () {
    };
  if (!uniminifiedJSStr) {
    throw new Error("Missing unminified JS file.");
  }
  if (!minifiedJSStr) {
    throw new Error("Missing minified JS file.");
  }
  if (!notes) {
    throw new Error("Missing notes.");
  }
  if (minifiedJSStr.length >= uniminifiedJSStr) {
    throw new Error("The minified JS file appears to be the same size or larger than the uniminified version.");
  }
  var zip = new jsZip();
  zip.file('gatewayconfig.js', uniminifiedJSStr);
  zip.file('gatewayconfig.min.js', minifiedJSStr);
  var data = zip.generate({base64: false, compression: 'DEFLATE'});

  rest.post(this._constructEndpointURL('gatewayconfig'), {
    multipart: true,
    username: this.username,
    password: this.password,
    data: {
      'notes': notes,
      'config': rest.data("config.zip", "application/octet-stream", data)
    }
  }).on('complete', function(data) {
    callback(data.statusCode == 200);
  });
};

/**
 * List the clients
 * @param searchterm
 * @param cb
 */
FCPClient.prototype.listClients = function(callback) {
  rest.get(this._constructEndpointURL('clients'), {
    username: this.username,
    password: this.password
  }).on('complete', function(data) {
    callback(data.statusCode == 200, !!data ? data.message : null);
  });
};

/**
 * Look up a client by a search term
 * @param searchterm
 * @param cb
 */
FCPClient.prototype.lookupClient = function(searchterm, callback) {
  rest.get(this._constructEndpointURL('clients') + "?search=" + encodeURIComponent(searchterm), {
    username: this.username,
    password: this.password
  }).on('complete', function(data) {
    callback(data.statusCode == 200, !!data ? data.message : null);
  });
};

/**
 * Defines environments
 * @type {{}}
 */
FCPClient.environments = {
  "dev": "http://dev-fcp.answerscloud.com",
  "qa": "http://qa-fcp.answerscloud.com",
  "prod": "http://fcp.answerscloud.com"
};

// Tell the world
module.exports = FCPClient;