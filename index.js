var jsZip = require('node-zip'),
  fs = require('fs'),
  rest = require('restler'),
  semver = require('semver'),
  prompt = require('prompt');

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
FCPClient.prototype._constructEndpointURL = function (endpoint) {
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
  }).on('complete', function (data) {
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
  }).on('complete', function (data) {
    callback(data.statusCode == 200);
  });
};

/**
 * Post new config JS files
 * @param uniminifiedJSStr {String} String containing the unminified JS file
 * @param minifiedJSStr {String} String containing the minified JS file
 * @param notes {String} Comments on this release
 * @param version {String} Semver version
 * @param latest {Bool} Is this the latest?
 * @param callback {Function} Callback
 */
FCPClient.prototype.postCodeVersion = function (codeBuffer, notes, version, latest, callback) {
  callback = callback || function () {
    };

  if (!version || !semver.valid(version)) {
    console.log("Invalid semver version: ".red, version.toString().yellow);
    callback(false);
  }

  rest.post(this._constructEndpointURL('code'), {
    multipart: true,
    username: this.username,
    password: this.password,
    data: {
      'notes': notes,
      'version': version,
      'latest': latest.toString(),
      'code': rest.data("code.zip", "application/octet-stream", codeBuffer)
    }
  }).on('complete', function (data) {
    callback(data.statusCode == 200, data.message);
  });
};

/**
 * Post anew default configuration
 * @param configStr {String} JSON object as a string
 * @param notes {String} Notes
 * @param callback {Function} Callback
 */
FCPClient.prototype.postDefaultConfig = function (configStr, notes, callback) {
  callback = callback || function () {
    };

  rest.post(this._constructEndpointURL('defaultconfig'), {
    multipart: true,
    username: this.username,
    password: this.password,
    data: {
      'notes': notes,
      'config': rest.data("config.js", "application/octet-stream", new Buffer(configStr))
    }
  }).on('complete', function (data) {
    callback(data.statusCode == 200, data.message);
  });
};

/**
 * List the clients
 * @param searchterm
 * @param cb
 */
FCPClient.prototype.listClients = function (callback) {
  rest.get(this._constructEndpointURL('clients'), {
    username: this.username,
    password: this.password
  }).on('complete', function (data) {
    callback(data.statusCode == 200, !!data ? data.message : null);
  });
};

/**
 * Look up a client by a search term
 * @param searchterm
 * @param cb
 */
FCPClient.prototype.lookupClient = function (searchterm, callback) {
  rest.get(this._constructEndpointURL('clients') + "?search=" + encodeURIComponent(searchterm), {
    username: this.username,
    password: this.password
  }).on('complete', function (data) {
    callback(data.statusCode == 200, !!data ? data.message : null);
  });
};

/**
 * Look up a client by its ID
 * @param searchterm
 * @param cb
 */
FCPClient.prototype.getClient = function (id, callback) {
  rest.get(this._constructEndpointURL('clients/' + id), {
    username: this.username,
    password: this.password
  }).on('complete', function (data) {
    callback(data.statusCode == 200, !!data ? data.message : null);
  });
};

/**
 * Create a client
 * @param id {Number} Client ID. 0 if auto-assign
 * @param name {String} Client name
 * @param metadata {String} Meta data
 * @param notes {String} Notes
 * @param callback {Function} Callback
 */
FCPClient.prototype.makeClient = function (id, name, metadata, notes, callback) {
  if (name.length > 45) {
    name = name.substr(0, 45).toLowerCase();
  }
  var dta = {
    'notes': notes,
    'name': name.toLowerCase(),
    'metadata': metadata
  };
  if (id > 0) {
    dta.client_id = id;
  }
  rest.post(this._constructEndpointURL('clients'), {
    username: this.username,
    password: this.password,
    data: dta
  }).on('complete', function (data) {
    callback(data.statusCode == 200, !!data ? data.message : null);
  });
};

/**
 * Make a new site
 * @param sitekey {String} The site key
 * @param client_id {Number} The client ID
 * @param notes {String} Notes
 * @param callback {Function} Callback
 */
FCPClient.prototype.makeSite = function (sitekey, client_id, notes, callback) {
  if (sitekey.length > 45) {
    sitekey = sitekey.substr(0, 45).toLowerCase().replace(/[ \t\r\n]/g, '');
  }
  rest.post(this._constructEndpointURL('sites'), {
    username: this.username,
    password: this.password,
    data: {
      'notes': notes,
      'name': sitekey.toLowerCase(),
      'client_id': client_id
    }
  }).on('complete', function (data) {
    callback(data.statusCode == 200, !!data ? data.message : null);
  });
};

/**
 * List the site keys for a client
 * @param clientid {Number} Client ID
 * @param callback {Function} Callback
 */
FCPClient.prototype.listSitesForClient = function (clientid, callback) {
  rest.get(this._constructEndpointURL('sites?client_id=' + clientid), {
    username: this.username,
    password: this.password
  }).on('complete', function (data) {
    callback(data.statusCode == 200, !!data ? data.message : null);
  });
};

/**
 * Push a product for a customer
 * @param clientid {Number}
 * @param sitekey {String}
 * @param environment {String} eg: staging/production
 * @param product {String}
 * @param snippetConfig {String} The config snippet
 * @param fileBuffer {Buffer} The contents of the ZIP containing all files
 * @param notes {String} Any notes
 * @param callback
 */
FCPClient.prototype.pushCustomerConfigForProduct = function (clientid, sitekey, environment, product, snippetConfig, fileBuffer, notes, callback) {
  sitekey = sitekey.trim().toLowerCase();
  environment = environment.trim().toLowerCase();
  product = product.trim().toLowerCase();
  callback = callback || function () {
    };

  rest.post(this._constructEndpointURL('/sites/' + sitekey + '/containers/' + environment + '/products/' + product), {
    multipart: true,
    username: this.username,
    password: this.password,
    data: {
      'notes': notes,
      'config': rest.data("config.js", "application/javascript", new Buffer(snippetConfig)),
      'file': rest.data("files.zip", "application/octet-stream", fileBuffer)
    }
  }).on('complete', function (data) {
    callback(data.statusCode == 200, data.message);
  });
};

/**
 * Defines environments
 * @type {{}}
 */
FCPClient.environments = {
  "dev": "https://dev-fcp.foresee.com",
  "qa": "https://qa-fcp.foresee.com",
  "qa2": "https://qa2-fcp.foresee.com",
  "prod": "https://fcp.foresee.com"
};

/**
 * Ask the user for credentials and notes if appropriate
 * @param donotes {Boolean} Ask for notes?
 * @param cb {Function} Callback
 */
FCPClient.promptForFCPCredentials = function (donotes, cb) {
  // Read FCP credentials from ~/env.json, if it exists
  try {
    var home = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'],
      ev = JSON.parse(fs.readFileSync(home + '/env.json').toString()),
      username = ev.FCP_USERNAME,
      password = ev.FCP_PASSWORD,
      notes = ev.FCP_NOTES,
      environment = ev.FCP_ENVIRONMENT;
  } catch (e) {
  }

  var schema = {
    properties: {}
  };

  if (donotes && !notes) {
    schema.properties.notes = {
      required: true
    };
  }
  if (!username || !password) {
    console.log("Please enter your FCP credentials (no @ is needed). ".cyan);
  }
  if (!username) {
    schema.properties.username = {
      required: true
    };
  }
  if (!password) {
    schema.properties.password = {
      hidden: true,
      required: true
    }
  }

  if (typeof(environment) == "undefined") {
    schema.properties.environment = {
      required: true,
      type: 'integer',
      message: '0 = dev, 1 = QA, 2 = QA2, 3 = prod'
    }
    console.log("For environment, enter a number: " + "0 = dev".yellow + ", " + "1 = QA".magenta + ", " + "2 = QA2".magenta + ", " + "3 = prod".blue);
  }

  prompt.start();
  prompt.get(schema, function (err, result) {
    if (!err) {
      result.username = result.username || username;
      result.password = result.password || password;
      result.notes = result.notes || notes;

      if (result.username.indexOf('@') == -1) {
        result.username = result.username.trim() + '@aws.foreseeresults.com';
      }

      if (typeof(environment) != "undefined") {
        result.environment = environment;
      }
      if (result.environment == 0) {
        result.environment = FCPClient.environments.dev;
      } else if (result.environment == 1) {
        result.environment = FCPClient.environments.qa;
      } else if (result.environment == 2) {
        result.environment = FCPClient.environments.qa2;
      } else if (result.environment == 3) {
        result.environment = FCPClient.environments.prod;
      } else {
        throw new Error("Invalid environment.");
      }
      cb(result.username, result.password, result.environment, result.notes);
    }
  });
};

// Tell the world
module.exports = FCPClient;