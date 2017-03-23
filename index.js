var async = require('async'),
  EventEmitter = require("events"),
  fs = require('fs'),
  jsZip = require('node-zip'),
  rest = require('restler'),
  prompt = require('prompt'),
  semver = require('semver');

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
  this._log = [];
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
  if (endpoint.substr(0, 1) == "/") {
    endpoint = endpoint.substr(1);
  }
  return this.hostname + "/" + endpoint;
};

/**
 * Log an event
 * @private
 */
FCPClient.prototype._logEvent = function () {
  var str = "";
  for (var i = 0; i < arguments.length; i++) {
    try {
      str += JSON.stringify(arguments[i], function (elm, v) {
        if (typeof v == typeof {} && v.type && v.type == "Buffer") {
          return "[BUF]";
        } else {
          return v;
        }
      });
    } catch (e) {
    }
    if (i > 0) {
      str += " ";
    }
  }
  this._log.push(str);
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
  var data = zip.generate({base64: false, compression: 'DEFLATE'}),
    dobj = {
      'notes': this._formatStringField(notes),
      'gateway': rest.data("gateway.zip", "application/octet-stream", data)
    };

  this._logEvent("POST", this._constructEndpointURL('gateway'), dobj);

  rest.post(this._constructEndpointURL('gateway'), {
    multipart: true,
    username: this.username,
    password: this.password,
    data: dobj
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
  var data = zip.generate({base64: false, compression: 'DEFLATE'}),
    dobj = {
      'notes': this._formatStringField(notes),
      'config': rest.data("config.zip", "application/octet-stream", data)
    };

  this._logEvent("POST", this._constructEndpointURL('gatewayconfig'), dobj);

  rest.post(this._constructEndpointURL('gatewayconfig'), {
    multipart: true,
    username: this.username,
    password: this.password,
    data: dobj
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

  console.log("postCodeVersion:", version, "bytes:", codeBuffer.length);
  if (!version || !semver.valid(version)) {
    console.log("Invalid semver version: ".red, version.toString().yellow);
    callback(false);
  }

  latest = latest.toString();
  if (latest != "true" && latest != "false") {
    latest = true;
  }

  var dobj = {
    'notes': this._formatStringField(notes),
    'version': version,
    'latest': latest.toString(),
    'code': rest.data("code.zip", "application/octet-stream", codeBuffer)
  };

  this._logEvent("POST", this._constructEndpointURL('code'), dobj);

  rest.post(this._constructEndpointURL('code'), {
    multipart: true,
    username: this.username,
    password: this.password,
    data: dobj
  }).on('complete', function (data) {
    callback(data.statusCode == 200, data.message);
  });
};

/**
 * Post a new default configuration
 * @param configStr {String} JSON object as a string
 * @param notes {String} Notes
 * @param callback {Function} Callback
 */
FCPClient.prototype.postDefaultConfig = function (configStr, notes, callback) {
  callback = callback || function () {
    };
  var latest = 1;

  rest.post(this._constructEndpointURL('defaultconfig'), {
    multipart: true,
    username: this.username,
    password: this.password,
    data: {
      'notes': this._formatStringField(notes),
      'latest': latest.toString(),
      'config': rest.data("config.js", "application/octet-stream", new Buffer(configStr))
    }
  }).on('complete', function (data) {
    callback(data.statusCode == 200, data.message);
  });
};


/**
 * Post a new default configuration for a particular client and container
 * @param sitekey
 * @param container
 * @param configStr
 * @param notes
 * @param callback
 */
FCPClient.prototype.postDefaultConfigForSiteContainer = function (sitekey, container, configStr, notes, callback) {
  callback = callback || function () {
    };

  var dobj = {
    'notes': this._formatStringField(notes),
    'config': rest.data("config.js", "application/javascript", new Buffer(configStr))
  };

  this._logEvent("POST", this._constructEndpointURL('/sites/' + sitekey + '/containers/' + container + '/configs'), dobj);

  rest.post(this._constructEndpointURL('/sites/' + sitekey + '/containers/' + container + '/configs'), {
    multipart: true,
    username: this.username,
    password: this.password,
    data: dobj
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
  this._logEvent("GET", this._constructEndpointURL('clients'));
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
  this._logEvent("GET", this._constructEndpointURL('clients') + "?search=" + encodeURIComponent(searchterm));
  rest.get(this._constructEndpointURL('clients') + "?search=" + encodeURIComponent(searchterm), {
    username: this.username,
    password: this.password
  }).on('complete', function (data) {
    if (data && typeof data.message == "string") {
      data.message = [];
    }
    if (!data) {
      data = {
        statusCode: 200,
        message: []
      }
    }
    this.listSites(function (success, results) {
        if (!success) {
          callback(true, {clients: data.message, sites: []});
        } else {
          var finalSitesList = [];
          for (var i = 0; i < results.length; i++) {
            var st = results[i];
            if (st.name.toLowerCase().indexOf(searchterm.toLowerCase().trim()) > -1) {
              finalSitesList.push(st);
            }
          }
          callback(true, {clients: data.message, sites: finalSitesList});
        }
      }.bind(this)
    );
  }.bind(this));
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
    this._logEvent("GET", this._constructEndpointURL('clients/' + id));
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
  this._logEvent("POST", this._constructEndpointURL('reset/'));
  rest.post(this._constructEndpointURL('reset'), {
    username: this.username,
    password: this.password
  }).on('complete', function (data) {
    console.log("Reset result: ", data);
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
  this._logEvent("POST", this._constructEndpointURL('clients'), dta);
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
  this._logEvent("POST", this._constructEndpointURL('sites'), dta);
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
      ctx.getContainersForSitekey(sitekey, function (success, result) {
        if (!success) {
          console.log("Failed to get containers for site key: ", sitekey, result);
        } else {
          for (var b = 0; b < result.length; b++) {
            if (result[b].name == "production") {
              didproduction = true;
            }
            if (result[b].name == "staging") {
              didstaging = true;
            }
          }
          if (!didstaging) {
            ctx.makeContainer(sitekey, "staging", client_id, notes, function (success, ndata) {
              if (!success) {
                throw new Error("Did not successfully create staging container.");
              } else {
                didstaging = true;
                checker();
              }
            });
          }
          if (!didproduction) {
            ctx.makeContainer(sitekey, "production", client_id, notes, function (success, ndata) {
              if (!success) {
                throw new Error("Did not successfully create production container.");
              } else {
                didproduction = true;
                checker();
              }
            });
          }
          if (didstaging && didproduction) {
            checker();
          }
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
  var dta = {
    'notes': this._formatStringField(notes),
    'name': this._formatStringField(container.toLowerCase(), 45),
    'client_id': client_id
  };

  this._logEvent("POST", this._constructEndpointURL('sites/' + sitekey + '/containers'), dta);
  rest.post(this._constructEndpointURL('sites/' + sitekey + '/containers'), {
    username: this.username,
    password: this.password,
    data: dta
  }).on('complete', function (data) {
    if (data.statusCode != 200) {
      console.log("Failed making container " + container + " for sitekey " + sitekey + " for client ID " + client_id + ": ", data);
    }
    callback(data.statusCode == 200, !!data ? data.message : null);
  });
};

/**
 * Does a particular site key exist?
 * @param sitekey {String} The site key
 * @param callback {Function} Callback. Arguments: success {Boolean}, exists {Boolean}, client {Number}
 */
FCPClient.prototype.doesSiteKeyExist = function (sitekey, callback) {
  sitekey = sitekey || '';
  if (sitekey.trim().length == 0) {
    throw new Error("Invalid sitekey");
  }
  sitekey = sitekey.trim().replace(/[ \t\n\r]/g, '').toLowerCase();
  if (sitekey.length > 45) {
    sitekey = sitekey.substr(0, 45);
  }
  callback = callback || function () {
    };
  this.listSites(function (success, info) {
    if (!success) {
      callback(success, false);
    } else {
      if (!info) {
        info = [];
      }
      var didFind = false;
      for (var i = 0; i < info.length; i++) {
        if (info[i].name == sitekey) {
          // found it!
          didFind = true;
          callback(true, true, info[i]);
        }
      }
      if (!didFind) {
        callback(true, false);
      }
    }
  });
};

/**
 * List all sites
 * @param callback {Function} Callback
 */
FCPClient.prototype.listSites = function (callback) {
  callback = callback || function () {

    };
  this._logEvent("GET", this._constructEndpointURL('sites'));
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
 * Promote product configs from staging to production; will not promote feedback
 * @param sitekey
 * @param notes
 * @param callback
 */
FCPClient.prototype.promoteStgToProd = function (sitekey, notes, products, callback) {
  var ctx = this,
    dp,
    dt,
    ct;
  callback = callback || function () {

    };
  sitekey = sitekey || '';
  sitekey = sitekey.toLowerCase().trim();
  this._logEvent("GET", this._constructEndpointURL('/sites/' + sitekey + '/containers/staging'));
  rest.get(this._constructEndpointURL('/sites/' + sitekey + '/containers/staging'), {
    username: this.username,
    password: this.password
  }).on('complete', function (data) {
    if (data.statusCode != 200) {
      callback(false, 'Failed GET on /sites/' + sitekey + '/containers/staging');
    } else if (data.message && data.message.products && data.message.tags && data.message.config_tag) {
      dp = data.message.products;
      dt = data.message.tags;
      ct = data.message.config_tag;

     var queue = async.queue(function(task, callback) {
       callback();
     }, 1);
      queue.drain = function () {
      };

      ctx._logEvent("POST", ctx._constructEndpointURL('/sites/' + sitekey + '/containers/production/configs/' + ct));
      rest.post(ctx._constructEndpointURL('/sites/' + sitekey + '/containers/production/configs/' + ct), {
        username: ctx.username,
        password: ctx.password,
        data: {
          notes: ctx._formatStringField(notes)
        }
      }).on('complete', function (data) {
        if (data.statusCode != 200) {
          callback(false, "Failed to promote container config: " + data.message);
        } else {
          callback(true, "Successfully promoted container config: " + sitekey + '/production');
        }

        for (var i = 0, len = dp.length; i < len; i++) {
          if (products.indexOf(dp[i]) > -1) {
            queue.push({name: "task" + i}, function (prdct, tag) {
              return function () {
                ctx._logEvent("POST", ctx._constructEndpointURL('/sites/' + sitekey + '/containers/production/products/' + prdct + '/' + tag));
                rest.post(ctx._constructEndpointURL('/sites/' + sitekey + '/containers/production/products/' + prdct + '/' + tag), {
                  username: ctx.username,
                  password: ctx.password,
                  data: {
                    notes: ctx._formatStringField(notes)
                  }
                }).on('complete', function (data) {
                  if (data.statusCode != 200) {
                    callback(false, "Failed to promote: " + data.message);
                  } else {
                    callback(true, "Successfully promoted product config: " + data.message.product);
                  }
                });
              }
            }(dp[i], dt[i]));
          }
        }
      });
    } else {
      callback(false, "Failed to promote. One of the following was missing from message: products, tags, config_tag. " + data.message);
    }
  });
};

/**
 * List all the containers for a site key
 * @param sitekey {String} site key
 * @param callback {Function}
 */
FCPClient.prototype.getContainersForSitekey = function (sitekey, callback) {
  callback = callback || function () {

    };
  sitekey = sitekey || '';
  sitekey = sitekey.toLowerCase().trim();
  this._logEvent("GET", this._constructEndpointURL('/sites/' + sitekey + '/containers'));
  rest.get(this._constructEndpointURL('/sites/' + sitekey + '/containers'), {
    username: this.username,
    password: this.password
  }).on('complete', function (data) {
    if (data.statusCode == 404) {
      data.statusCode = 200;
      data.message = [];
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
    this._logEvent("GET", this._constructEndpointURL('sites?client_id=' + clientid));
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
 * @param no_invalidation {Boolean} (Optional). Skip invalidation
 */
FCPClient.prototype.pushCustomerConfigForProduct = function (clientid, sitekey, environment, product, snippetConfig, fileBuffer, notes, callback, no_invalidation, jsonconfig) {
  sitekey = sitekey.trim().toLowerCase();
  environment = environment.trim().toLowerCase();
  product = product.trim().toLowerCase();
  callback = callback || function () {
    };

  if (product.toLowerCase().trim() == "replay") {
    throw new Error("Replay is not a valid product code! Use record instead!");
  }

  var dobj = {
    'notes': this._formatStringField(notes),
    'config': rest.data("config.js", "application/javascript", new Buffer(snippetConfig)),
    'file': rest.data("files.zip", "application/octet-stream", fileBuffer)
  };

  if (jsonconfig) {
    //dobj.json = rest.data("config.json", "application/json", new Buffer(jsonconfig));
  }

  if (no_invalidation) {
    dobj.no_invalidation = 'true';
  }
  this._logEvent("POST", this._constructEndpointURL('/sites/' + sitekey + '/containers/' + environment + '/products/' + product), dobj);
  rest.post(this._constructEndpointURL('/sites/' + sitekey + '/containers/' + environment + '/products/' + product), {
    multipart: true,
    username: this.username,
    password: this.password,
    data: dobj
  }).on('complete', function (data) {
    if (data.message.trim().toLowerCase().indexOf("site not found") > -1) {
      console.log("Site was missing. Attempting to create a site called".yellow, sitekey.magenta, "for client".yellow, clientid, "...".yellow);
      this.makeSite(sitekey, clientid, "Making site " + sitekey + " for client " + clientid + " in response to a pushCustomerConfigForProduct", function (success, result) {
        if (success) {
          this.pushCustomerConfigForProduct(clientid, sitekey, environment, product, snippetConfig, fileBuffer, notes, callback);
        } else {
          console.log("Could not create site: ".red + sitekey.red, result);
        }
      }.bind(this));
    } else {
      callback(data.statusCode == 200, data.message);
    }
  }.bind(this));
};

FCPClient.environmentShort = [
  "dev", "qa", "qa2", "stg", "prod", "local"
];

/**
 * Defines environments
 * @type {{}}
 */
FCPClient.environments = {
  "local": "http://localhost:3001",
  "dev": "https://dev-fcp.foresee.com",
  "qa": "https://qa-fcp.foresee.com",
  "qa2": "https://qa2-fcp.foresee.com",
  "stg": "https://stg-fcp.foresee.com",
  "prod": "https://fcp.foresee.com"
};

/**
 * Front end environments
 * @type {{local: string, dev: string, qa: string, qa2: string, stg: string, prod: string}}
 */
FCPClient.frontEndEnvironments = {
  "local": "http://localhost:3001",
  "dev": "https://dev-gateway.foresee.com",
  "qa": "https://qa-gateway.foresee.com",
  "qa2": "https://qa2-gateway.foresee.com",
  "stg": "https://stg-gateway.foresee.com",
  "prod": "https://gateway.foresee.com"
};

/**
 * Ask the user for credentials and notes if appropriate
 * @param donotes {Boolean} Ask for notes?
 * @param cb {Function} Callback
 */
FCPClient.promptForFCPCredentials = function (options, cb) {
  var home,
    ev,
    username,
    password,
    notes,
    environment,
    latest = !options.latest,
    schema = {
      properties: {}
    };

  // Read FCP credentials from ~/env.json, if it exists
  try {
    home = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
    ev = JSON.parse(fs.readFileSync(home + '/env.json').toString());
    username = ev.FCP_USERNAME;
    password = ev.FCP_PASSWORD;
    notes = ev.FCP_NOTES;
    environment = ev.FCP_ENVIRONMENT;
  } catch (e) {
  }
  // Read FCP credentials from environment variables, if they exist
  if (!username) {
    try {
      username = process.env.FCP_USERNAME;
      password = process.env.FCP_PASSWORD;
      notes = process.env.FCP_NOTES;
      environment = process.env.FCP_ENVIRONMENT;
    } catch (e) {
    }
  }

  if (options.clientId) {
    schema.properties.clientId = {
      required: true,
      type: 'string'
    };
  }
  if (options.notes && !notes) {
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
  if (options.latest) {
    schema.properties.latest = {
      required: true,
      type: 'boolean'
    };
    console.log("Latest: true/false.".yellow);
  }
  if (!options.disableEnv && typeof(environment) == "undefined") {
    schema.properties.environment = {
      required: true,
      type: 'integer',
      message: '0 = dev, 1 = QA, 2 = QA2, 3 = prod, 4 = localhost:3001'
    };
    console.log("For environment, enter a number: " + "0 = dev".yellow + ", " + "1 = QA".magenta + ", " + "2 = QA2".magenta + ", " + "3 = stg".green + ", " + "4 = prod".blue + ", " + "5 = localhost:3001");
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
      if (typeof(result.latest) == "undefined") {
        result.latest = latest;
      }
      result.env = result.environment;

      if (result.env >= 0 && result.env <= 5) {
        // dev, qa, qa2, stg, prod, local
        var es = FCPClient.environmentShort[result.env];
        result.environment = FCPClient.environments[es];
        result.frontEndEnvironment = FCPClient.frontEndEnvironments[es];
      } else if (!options.disableEnv) {
        throw new Error("Invalid environment.");
      }
      cb(result);
    }
  });
};

// Tell the world
module.exports = FCPClient;