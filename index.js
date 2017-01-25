var jsZip = require('node-zip'),
  fs = require('fs'),
  rest = require('restler'),
  semver = require('semver'),
  prompt = require('prompt'),
  EventEmitter = require("events");

// Some cache
var clients = {},
  sites = {};

// An event emitter
var clientCreated = new EventEmitter();

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
 * Format notes
 * @param notes
 * @private
 */
FCPClient.prototype._formatStringField = function (str, maxlen) {
  if (!maxlen) {
    maxlen = 45000;
  }
  var nts = str || '';
  nts = nts.replace(/:/g, ' ').replace(/\/\//g, '').replace(/\//g, ' ').replace(/\./g, ' ');
  nts = nts.replace(/[^0-9a-zA-Z ]*/g, '');
  nts = nts.trim();
  if (nts.length === 0) {
    nts = "No notes provided (_formatNotes fcp-client)";
  }
  if (nts.length > maxlen) {
    nts = nts.substr(0, maxlen);
  }
  return nts;
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
      'notes': this._formatStringField(notes),
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
      'notes': this._formatStringField(notes),
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
      'notes': this._formatStringField(notes),
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
      'notes': this._formatStringField(notes),
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
    if (data.statusCode == 200) {
      for (var i = 0; i < data.message.length; i++) {
        clients['_' + data.message[i].id] = data.message[i];
      }
    }
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
  if (clients['_' + id]) {
    process.nextTick(function () {
      callback(true, clients['_' + id]);
    });
  } else {
    rest.get(this._constructEndpointURL('clients/' + id), {
      username: this.username,
      password: this.password
    }).on('complete', function (data) {
      if (data.statusCode == 200) {
        clients['_' + id] = data.message;
      }
      callback(data.statusCode == 200, !!data ? data.message : null);
    });
  }
};


/**
 * Reset a client
 * @param callback {Function} Callback
 */
FCPClient.prototype.reset = function (callback) {
  rest.post(this._constructEndpointURL('reset'), {
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
  callback = callback || function () {
    };
  var dta = {
    'notes': this._formatStringField(notes),
    'name': this._formatStringField(name, 127),
    'metadata': this._formatStringField(metadata)
  };
  if (dta.notes.length === 0) {
    throw new Error("Missing notes field on make client request.");
  }
  if (dta.name.length === 0) {
    throw new Error("Missing name field on make client request.");
  }
  if (dta.metadata.length === 0) {
    throw new Error("Missing metadata field on make client request.");
  }
  if (id > 0) {
    dta.client_id = id;
  }
  rest.post(this._constructEndpointURL('clients'), {
    username: this.username,
    password: this.password,
    data: dta
  }).on('complete', function (data) {
    if (data.statusCode == 200) {
      clients['_' + data.message.id] = data.message;
      clientCreated.emit('created');
      clientCreated.emit('created' + data.message.id);
      sites['_' + data.message.id] = [];
    }
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
FCPClient.prototype.makeClientIfNotExist = function (id, name, metadata, notes, callback) {
  callback = callback || function () {

    };
  var args = arguments;

  if (!id) {
    throw new Error("Invalid client ID");
  } else {
    this.getClient(id, function (_id, _name, _metadata, _notes, _callback, ctx) {
      return function (success, client) {
        if (!success || !client) {
          ctx.makeClient(_id, _name, _metadata, _notes, _callback);
        } else {
          callback(true, client);
        }
      };
    }(id, name, metadata, notes, callback, this));
  }
};

/**
 * Make a new site
 * @param sitekey {String} The site key
 * @param client_id {Number} The client ID
 * @param notes {String} Notes
 * @param callback {Function} Callback
 */
FCPClient.prototype.makeSite = function (sitekey, client_id, notes, callback) {
  var ctx = this;
  callback = callback || function () {
    };
  var dta = {
    'notes': this._formatStringField(notes),
    'name': sitekey.toLowerCase().replace(/ /g, ''),
    'client_id': client_id
  };
  rest.post(this._constructEndpointURL('sites'), {
    username: this.username,
    password: this.password,
    data: dta
  }).on('complete', function (data) {
    if (data.statusCode == 200) {
      if (!sites['_' + client_id]) {
        sites['_' + client_id] = [{name: sitekey}];
      } else {
        sites['_' + client_id].push({name: sitekey});
      }
      // Make containers automatically
      var didstaging = false,
        didproduction = false,
        checker = function () {
          if (didstaging && didproduction) {
            callback(data.statusCode == 200, !!data ? data.message : null);
          }
        };
      ctx.makeContainer(sitekey, "staging", client_id, notes, function (success, ndata) {
        if (!success) {
          console.log(ndata);
          throw new Error("Did not successfully create staging container.");
        } else {
          didstaging = true;
          checker();
        }
      });
      ctx.makeContainer(sitekey, "production", client_id, notes, function (success, ndata) {
        if (!success) {
          console.log(ndata);
          throw new Error("Did not successfully create production container.");
        } else {
          didproduction = true;
          checker();
        }
      });
    } else {
      callback(data.statusCode == 200, !!data ? data.message : null);
    }
  });
};

/**
 * Make a new container
 * @param sitekey {String} The site key
 * @param container {String} The container
 * @param client_id {Number} The client ID
 * @param notes {String} Notes
 * @param callback {Function} Callback
 */
FCPClient.prototype.makeContainer = function (sitekey, container, client_id, notes, callback) {
  if (container.length > 45) {
    container = container.substr(0, 45).toLowerCase().replace(/[ \t\r\n]/g, '');
  }
  rest.post(this._constructEndpointURL('sites/' + sitekey + '/containers'), {
    username: this.username,
    password: this.password,
    data: {
      'notes': this._formatStringField(notes),
      'name': this._formatStringField(container.toLowerCase(), 45),
      'client_id': client_id
    }
  }).on('complete', function (data) {
    callback(data.statusCode == 200, !!data ? data.message : null);
  });
};

/**
 * List all sites
 * @param callback {Function} Callback
 */
FCPClient.prototype.listSites = function (callback) {
  callback = callback || function () {

    };
  rest.get(this._constructEndpointURL('sites'), {
    username: this.username,
    password: this.password
  }).on('complete', function (data) {
    if (data && data.statusCode == 404) {
      data.message = [];
      data.statusCode = 200;
    }
    if (data && data.message && typeof(data.message) == typeof([])) {
      for (var i = 0; i < data.message.length; i++) {
        var ste = data.message[i],
          clientid = ste.client_id;
        if (!sites['_' + clientid]) {
          sites['_' + clientid] = [];
        }
        sites['_' + clientid].push(ste);
      }
    }
    callback(data.statusCode == 200, !!data ? data.message : null);
  });

};

/**
 * List the site keys for a client
 * @param clientid {Number} Client ID
 * @param callback {Function} Callback
 */
FCPClient.prototype.listSitesForClient = function (clientid, callback) {
  callback = callback || function () {

    };
  if (sites['_' + clientid]) {
    process.nextTick(function () {
      callback(true, sites['_' + clientid]);
    });
  } else {
    rest.get(this._constructEndpointURL('sites?client_id=' + clientid), {
      username: this.username,
      password: this.password
    }).on('complete', function (data) {
      if (data && data.statusCode == 404 && data.message == "No sites found") {
        data.message = [];
        data.statusCode = 200;
      }
      if (data.statusCode == 200) {
        sites['_' + clientid] = data.message;
      }
      callback(data.statusCode == 200, !!data ? data.message : null);
    });
  }
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
      'notes': this._formatStringField(notes),
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
  "stg": "https://stg-fcp.foreee.com",
  "prod": "https://fcp.foresee.com"
};

/**
 * Ask the user for credentials and notes if appropriate
 * @param donotes {Boolean} Ask for notes?
 * @param cb {Function} Callback
 */
FCPClient.promptForFCPCredentials = function (donotes, cb, uselatest) {
  var home,
    ev,
    username,
    password,
    notes,
    environment,
    latest = !!uselatest;

  // Read FCP credentials from ~/env.json, if it exists
  try {
    home = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
    ev = JSON.parse(fs.readFileSync(home + '/env.json').toString());
    username = ev.FCP_USERNAME;
    password = ev.FCP_PASSWORD;
    notes = ev.FCP_NOTES;
    environment = ev.FCP_ENVIRONMENT;
    latest = ev.FCP_LATEST || uselatest;
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
  if (typeof(latest) == "undefined") {
    schema.properties.latest = {
      required: true,
      type: 'boolean'
    };
  }

  if (typeof(environment) == "undefined") {
    schema.properties.environment = {
      required: true,
      type: 'integer',
      message: '0 = dev, 1 = QA, 2 = QA2, 3 = prod'
    };
    console.log("For environment, enter a number: " + "0 = dev".yellow + ", " + "1 = QA".magenta + ", " + "2 = QA2".magenta + ", " + "3 = stg".green + ", " + "4 = prod".blue);
  }

  if (latest) {
    console.log("Latest: true/false.".yellow);
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
        result.environment = FCPClient.environments.stg;
      } else if (result.environment == 4) {
        result.environment = FCPClient.environments.prod;
      } else {
        throw new Error("Invalid environment.");
      }
      cb(result.username, result.password, result.environment, result.notes, result.latest);
    }
  });
};

// Tell the world
module.exports = FCPClient;