const chalk = require('chalk');
const fs = require('fs');
const jsZip = require('node-zip');
const prompt = require('prompt-async');
const rest = require('restler');
const { promisify } = require("util");

// TODO: Add missing updates, deletes, and get logs for everything. Maybe also add missing vendors, etc.

const restlerOnComplete = data => data.statusCode != 200 ? data : false;

const restlerCall = (httpType, url, options, callback) => {
  rest[httpType.toLowerCase()](url, options).on('complete', data => {
    callback(restlerOnComplete(data),data);
  });
};

const restler = async (httpType, url, options) => await promisify(restlerCall)(httpType, url, options);

/**
 * Initialize a new instance of FCP Client
 * @param {String} username
 * @param {String} password
 * @param {String} hostname
 * @constructor
 */
module.exports = class FCPClient {
  constructor(username, password, hostname) {
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
    this.credentials = {
      username,
      password
    };
    this.hostname = hostname;
    this.__log = [];
  };

  static get environmentShort() { return ["dev", "qa", "qa2", "stg", "prod", "local"]; };

  static get fcpUrls() {
    return {
      "local": "http://localhost:3001",
      "dev": "https://dev-fcp.foresee.com",
      "qa": "https://qa-fcp.foresee.com",
      "qa2": "https://qa2-fcp.foresee.com",
      "stg": "https://stg-fcp.foresee.com",
      "prod": "https://fcp.foresee.com"
    };
  };

  static get gatewayUrls() {
    return {
      "local": "http://localhost:3001",
      "dev": "https://dev-gateway.foresee.com",
      "qa": "https://qa-gateway.foresee.com",
      "qa2": "https://qa2-gateway.foresee.com",
      "stg": "https://stg-gateway.foresee.com",
      "prod": "https://gateway.foresee.com"
    };
  };
  
  /**
   * Ask the user for credentials and notes if appropriate
   * @param {Options} options
   * This could include:
   *  - {String} username
   *  - {String} password
   *  - {String} notes
   *  - {Number} environment - 0 = dev, 1 = QA, 2 = QA2, 3 = stg, 4 = prod, 5 = local
   *  - {Boolean} disableEnv - If you want to not require an environment
   *  - {Number} clientId
   *  - {Boolean} requireCID - If you want to make sure you have a client id
   *  - {String} sitekey
   *  - {Boolean} requireSite - If you want to make sure you have a sitekey
   *  - {String} container
   *  - {Boolean} requireCont - If you want to make sure you have a container
   *  - {String} name
   *  - {Boolean} requireName - If you want to make sure you have a name
   *  - {String} metadata
   *  - {Boolean} requireMData - If you want to make sure you have metadata
   *  - {String} configTag
   *  - {Boolean} requireCTag - If you want to make sure you have config tag
   *  - {String} vendorCode
   *  - {Boolean} requireVend - If you want to make sure you have a vendor code
   *  - {String} prereleaseCode
   *  - {Boolean} requirePrel - If you want to make sure you have a prerelease code
   *  - {true/false/invalid} latest - If you want to pass that value on
   * As well as any other values you just want to pass on and will be ignored
   */
  static async promptForFCPCredentials (options) {
    options = options || {};
    let home;
    let ev;
    const schema = {
      properties: {}
    };

    if(!options.environment) options.environment = options.env;

    if(options.environment && isNaN(options.environment)) {
      options.environment = FCPClient.environmentShort.indexOf(options.environment);
    }
    if(options.environment && (options.environment > 5 || options.environment < 0)) {
      options.environment = undefined;
    }
    if(options.environment) options.disableEnv = true;
  
    // Read FCP credentials from passed in, ~/env.json or environment variables, if any exist
    try {
      home = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
      ev = await JSON.parse(fs.readFileSync(home + '/env.json').toString());
      options.username = options.username || ev.FCP_USERNAME || process.env.FCP_USERNAME;
      options.password = options.password || ev.FCP_PASSWORD || process.env.FCP_PASSWORD;
      options.notes = options.notes || ev.FCP_NOTES || process.env.FCP_NOTES;
      options.environment = options.environment || ev.FCP_ENVIRONMENT || process.env.FCP_ENVIRONMENT;
    } catch (e) {
    }

    if (!options.username || !options.password) {
      console.log(chalk.cyan("Please enter your FCP credentials (no @ is needed). "));
    }
    if (!options.username) {
      schema.properties.username = {
        required: true
      };
    }
    if (!options.password) {
      schema.properties.password = {
        hidden: true,
        required: true
      }
    }
    if (!options.notes && !options.disableNotes) {
      schema.properties.notes = {
        required: true
      };
    }
    if (!options.disableEnv && typeof (options.environment) == "undefined") {
      schema.properties.environment = {
        required: true,
        type: 'integer',
        message: '0 = dev, 1 = QA, 2 = QA2, 3 = stg, 4 = prod, 5 = localhost:3001'
      };
      console.log("For environment, enter a number: " + chalk.yellow("0 = dev") + ", " + chalk.magenta("1 = QA") + ", " + chalk.magenta("2 = QA2") + ", " + chalk.green("3 = stg") + ", " + chalk.blue("4 = prod") + ", " + "5 = localhost:3001");
    }
    if (options.requireCID && !options.clientId) {
      schema.properties.clientId = {
        required: true,
        type: 'integer',
        message: chalk.yellow("Client ID should be a non-zero integer."),
      }
    }
    if (options.requireSite && !options.sitekey) {
      schema.properties.sitekey = {
        required: true,
        type: "string",
      };
    }
    if (options.requireCont && !options.container) {
      schema.properties.container = {
        required: true,
        type: "string",
      };
    }
    if (options.requireName && !options.name) {
      schema.properties.name = {
        required: true,
        type: "string",
      };
    }
    if (options.requireMData && !options.metadata) {
      schema.properties.metadata = {
        required: true,
        type: "string",
        message: "Metadata can be the website URL, client contact name, other trademarks, etc. This is useful for searching.",
      };
    }
    if (options.requireCTag && !options.configTag) {
      schema.properties.configTag = {
        required: true,
        type: "string"
      };
    }
    if (options.requireVend && !options.vendorCode) {
      schema.properties.vendorCode = {
        required: true,
        type: "string",
        message: "8 char limit, accepted chars A-Z/a-z"
      };
    }
    if (options.requirePrel && !options.prereleaseCode) {
      schema.properties.prereleaseCode = {
        required: true,
        type: "string",
        message: "8 char limit, accepted chars A-Z/a-z"
      };
    }
    if (options.latest) {
      schema.properties.latest = {
        required: true,
        type: 'string',
        pattern: '^(true|false|invalid)$'
      };
      console.log(chalk.yellow("Latest: true/false/invalid."));
    }
  
    try {
      await prompt.start();
      const result = await prompt.get(schema);
      Object.assign(options, result);
    
      if (options.username.indexOf('@') == -1) {
        options.username = options.username.trim() + '@aws.foreseeresults.com';
      }
      options.env = options.environment;
    
      if (options.env >= 0 && options.env <= 5) {
        // dev, qa, qa2, stg, prod, local
        const shorty = FCPClient.environmentShort[options.env];
        options.fcpUrl = FCPClient.fcpUrls[shorty];
        options.gatewayUrl = FCPClient.gatewayUrls[shorty];
      } else if (!options.disableEnv) {
        throw new Error("Invalid environment.");
      }
      return options;
    } catch (e) {
    }
  };

  /**
   * Return the provided string trimmed and in lower case
   * @param {String} string 
   * @private
   */
  __LCTrim (string) {
    return string.toLowerCase().trim();
  };

  /**
   * Format string (ex. notes)
   * @param {String} string
   * @param {Number} maxLength
   * @private
   */
  __formatStringField (string, maxLength) {
    maxLength = maxLength || 45000;
    string = string || '';
    string = string.replace(/:/g, ' ').replace(/\/\//g, '').replace(/\//g, ' ').replace(/\./g, ' ');
    string = string.replace(/[^0-9a-zA-Z ]*/g, '');
    string = string.trim();
    if (string.length === 0) {
      string = "No notes provided (__formatStringField fcp-client)";
    }
    if (string.length > maxLength) {
      string = string.substr(0, maxLength);
    }
    return string;
  };

  /**
   * Return a fully qualified URL for an endpoint
   * @param {String} endpoint
   * @private
   */
  __constructEndpointURL (endpoint) {
    if (endpoint.substr(0, 1) == "/") {
      endpoint = endpoint.substr(1);
    }
    return this.hostname + "/" + endpoint;
  };

  /**
   * Log an event
   * @private
   */
  __logEvent () {
    let string = "";
    [...arguments].forEach(arg => {
      try {
        string += JSON.stringify(arg, (element, value) => {
          return typeof value === typeof {} && value.type && value.type === "Buffer" ? "[BUF]" : value;
        })
      } catch (e) {}
      string += ' ';
    });
    string = string.slice(0,-1);
    this.__log.push(string);
  };



  // CLIENTS

  /**
   * Create a client
   * @param {Number} id Client ID
   * @param {String} name Client name
   * @param {String} metadata Meta data
   * @param {String} notes Notes
   */
  async createClient (id, name, metadata, notes) {
    const data = {
      client_id: id,
      name: this.__formatStringField(name, 127),
      metadata: this.__formatStringField(metadata),
      notes: this.__formatStringField(notes),
    };
    // if (isNaN(data.client_id)) {
    //   console.log('nan')
    //   throw new Error("Client ID needs to be a number.");
    // }
    // if (data.name.length === 0) {
    //   console.log('name')
    //   throw new Error("Missing name field on create client request.");
    // }
    // if (data.metadata.length === 0) {
    //   console.log('metadata')
    //   throw new Error("Missing metadata field on create client request.");
    // }
    // if (data.notes.length === 0) {
    //   console.log('notes')
    //   throw new Error("Missing notes field on create client request.");
    // }
    const postUrl = this.__constructEndpointURL('clients');
    const body = { ...this.credentials, data };
    this.__logEvent("POST", postUrl, data);
    try {
      return await restler("POST", postUrl, body);
    } catch (err) {
      return err;
    }
  };

  /**
   * List the clients
   * @param {Array} searchterms
   */
  async listClients (searchTerms) {
    const queryString = searchTerms && searchTerms.length > 0 ? `?search=${encodeURIComponent(searchTerms.join())}` : '';
    const getUrl = this.__constructEndpointURL('clients'+queryString);
    this.__logEvent("GET", getUrl);
    try {
      return await restler("GET", getUrl, this.credentials);
    } catch (err) {
      return err;
    }
  };

  /**
   * Look up a client by its ID
   * @param {Number} id
   */
  async getClient (id) {
    const getUrl = this.__constructEndpointURL(`clients/${id}`);
    this.__logEvent("GET", getUrl);
    try {
      return await restler("GET", getUrl, this.credentials);
    } catch (err) {
      return err;
    }
  };


  // /** Hey man, What the heck is this? I don't see it in the app.js file of fcp...
  //  * Reset a client
  //  * @param callback {Function} Callback
  //  */
  // FCPClient.prototype.reset = function (callback) {
  //   const postUrl = this.__constructEndpointURL('reset/');
  //   this.__logEvent("POST", postUrl);
  //   rest.post(postUrl, {
  //     username: this.username,
  //     password: this.password
  //   }).on('complete', function (data) {
  //     console.log("Reset result: ", data);
  //     callback(data.statusCode == 200, !!data ? data.message : null);
  //   });
  // };



  // SITES

  /**
   * Create a site
   * @param {Number} id The client ID
   * @param {String} name The site key
   * @param {String} notes Notes
   * @param {String} alias - optional
   */
  async createSite (id, name, notes, alias) {
    const data = {
      client_id: id,
      name: this.__LCTrim(name.replace(/ /g, '')),
      notes: this.__formatStringField(notes)
    };
    if(alias) data.alias = alias;
    const postUrl = this.__constructEndpointURL('sites');
    const body = { ...this.credentials, data };
    this.__logEvent("POST", postUrl, data);
    try {
      return await restler("POST", postUrl, body);
    } catch (err) {
      return err;
    }
  };

  /**
   * List the sites
   * @param {Number} clientId - optional, limits list results to only be sites from this client
   * @param {Boolean} deleted - optional, when true list results will include deleted sites
   */
  async listSites (clientId, deleted) {
    const clientString = encodeURIComponent(clientId) || '';
    const deletedString = deleted === true ? encodeURIComponent('deleted=true') : '';
    const queryString = `?=${clientString}&&${deletedString}`;
    const getUrl = this.__constructEndpointURL('sites'+queryString);
    this.__logEvent("GET", getUrl);
    try {
      return await restler("GET", getUrl, this.credentials);
    } catch (err) {
      return err;
    }
  };

  /**
   * Look up a site by its key
   * @param {String} name
   */
  async getSite (name) {
    const getUrl = this.__constructEndpointURL(`sites/${name}`);
    this.__logEvent("GET", getUrl);
    try {
      return await restler("GET", getUrl, this.credentials);
    } catch (err) {
      return err;
    }
  };



  // CONTAINERS

  /**
   * Create a container
   * @param {String} sitekey The site key
   * @param {String} name The container
   * @param {String} notes Notes
   */
  async createContainer (sitekey, name, notes) {
    const data = {
      name: this.__LCTrim(name.substr(0, 45).replace(/[ \t\r\n]/g, '')),
      notes: this.__formatStringField(notes)
    };
    const postUrl = this.__constructEndpointURL(`sites/${sitekey}/containers`);
    const body = { ...this.credentials, data };
    this.__logEvent("POST", postUrl, data);
    try {
      return await restler("POST", postUrl, body);
    } catch (err) {
      return err;
    }
  };

  /**
   * List the containers
   * @param {String} sitekey The site key
   */
  async listContainers (sitekey) {
    const getUrl = this.__constructEndpointURL(`sites/${sitekey}/containers`);
    this.__logEvent("GET", getUrl);
    try {
      return await restler("GET", getUrl, this.credentials);
    } catch (err) {
      return err;
    }
  };

  /**
   * Look up a site by its key
   * @param {String} sitekey The site key
   * @param {String} name
   */
  async getContainer (sitekey, name) {
    const getUrl = this.__constructEndpointURL(`sites/${sitekey}/containers/${name}`);
    this.__logEvent("GET", getUrl);
    try {
      return await restler("GET", getUrl, this.credentials);
    } catch (err) {
      return err;
    }
  };



  // CONTAINER CONFIGS

  /**
   * Post a new container configuration for a particular sitekey and container
   * @param {String} sitekey The site key
   * @param {String} container The container name
   * @param {String} notes
   * @param {String} configStr JavaScript configuration snippet file contents
   * @param {String} vendorCode
   */
  async pushContainerConfig (sitekey, container, notes, configStr, vendorCode) {
    const data = {
      notes: this.__formatStringField(notes),
      config: rest.data("config.js", "application/javascript", new Buffer(configStr)),
      vendor_code: this.__LCTrim(vendorCode)
    };
    const postUrl = this.__constructEndpointURL(`sites/${sitekey}/containers/${container}/configs`);
    const body = { ...this.credentials, multipart: true, data };
    this.__logEvent("POST", postUrl, data);
    try {
      return await restler("POST", postUrl, body);
    } catch (err) {
      return err;
    }
  };

  /**
   * List the container configs for a particular sitekey and container
   * @param {String} sitekey The site key
   * @param {String} container The container name
   * @param {Boolean} deleted - optional, when true list results will include deleted sites
   * @param {Boolean} active - optional, when true list results will include active sites
   * @param {String} vendorCode
   */
  async listContainerConfigs (sitekey, container, deleted, active, vendorCode) {
    const deletedString = deleted === true ? encodeURIComponent('deleted=true') : '';
    const activeString = active === true ? encodeURIComponent('active=true') : '';
    const vendorString = vendorCode ? `vendor_code=${encodeURIComponent(vendorCode)}` : '';
    const queryString = `?=${deletedString}&&${activeString}&&${vendorString}`;
    const getUrl = this.__constructEndpointURL(`sites/${sitekey}/containers/${container}/configs${queryString}`);
    this.__logEvent("GET", getUrl);
    try {
      return await restler("GET", getUrl, this.credentials);
    } catch (err) {
      return err;
    }
  };

  /**
   * Look up a container config for a particular sitekey and container by its tag
   * @param {String} sitekey The site key
   * @param {String} container The container name
   * @param {String} tag
   */
  async getContainerConfigContents (sitekey, container, tag) {
    const getUrl = this.__constructEndpointURL(`sites/${sitekey}/containers/${container}/configs/files/${tag}`);
    this.__logEvent("GET", getUrl);
    try {
      return await restler("GET", getUrl, this.credentials);
    } catch (err) {
      return err;
    }
  };

  /**
   * Set current container config tag for a particular sitekey and container equal to a prior tag
   * @param {String} sitekey The site key
   * @param {String} container The container name
   * @param {String} tag
   * @param {String} notes
   * @param {String} vendorCode
   */
  async setContainerConfigToTag (sitekey, container, tag, notes, vendorCode) {
    const data = {
      notes: this.__formatStringField(notes),
      vendor_code: this.__LCTrim(vendorCode)
    };
    const postUrl = this.__constructEndpointURL(`sites/${sitekey}/containers/${container}/configs/${tag}`);
    const body = { ...this.credentials, data };
    this.__logEvent("POST", postUrl, data);
    try {
      return await restler("POST", postUrl, body);
    } catch (err) {
      return err;
    }
  };



  // PRODUCT CONFIGS

  /**
   * Post a new product configuration for a particular sitekey and container
   * @param {String} sitekey The site key
   * @param {String} container The container name
   * @param {String} name
   * @param {String} notes
   * @param {String} configStr JavaScript configuration snippet file contents
   * @param {String} vendorCode
   * @param {String} jsonStr - optional, JSON version of the configuration snippet file contents
   * @param {Buffer} fileBuf - optional, contents of the ZIP containing all files
   */
  async pushProductConfig (sitekey, container, name, notes, configStr, vendorCode, jsonStr, fileBuf) {
    const data = {
      notes: this.__formatStringField(notes),
      config: rest.data("config.js", "application/javascript", new Buffer(configStr)),
      vendor_code: this.__LCTrim(vendorCode)
    };
    if (jsonStr) {
      data.json = rest.data("config.json", "application/json", new Buffer(jsonStr));
    }
    if (fileBuf) {
      data.file = rest.data("files.zip", "application/octet-stream", fileBuf);
    }
    const postUrl = this.__constructEndpointURL(`sites/${sitekey}/containers/${container}/products/${this.__LCTrim(name)}`);
    const body = { ...this.credentials, multipart: true, data };
    this.__logEvent("POST", postUrl, data);
    try {
      return await restler("POST", postUrl, body);
    } catch (err) {
      return err;
    }
  };

  /**
   * List the product configs for a particular sitekey and container
   * @param {String} sitekey The site key
   * @param {String} container The container name
   * @param {Boolean} deleted - optional, when true list results will include deleted sites
   * @param {Boolean} inactive - optional, when true list results will include inactive sites
   */
  async listProductConfigs (sitekey, container, deleted, inactive) {
    const deletedString = deleted === true ? encodeURIComponent('deleted=true') : '';
    const inactiveString = inactive === true ? encodeURIComponent('inactive=true') : '';
    const queryString = `?=${deletedString}&&${inactiveString}`;
    const getUrl = this.__constructEndpointURL(`sites/${sitekey}/containers/${container}/products${queryString}`);
    this.__logEvent("GET", getUrl);
    try {
      return await restler("GET", getUrl, this.credentials);
    } catch (err) {
      return err;
    }
  };

  /**
   * Set current product config tag for a particular sitekey and container equal to a prior tag
   * @param {String} sitekey The site key
   * @param {String} container The container name
   * @param {String} name
   * @param {String} tag
   * @param {String} notes
   */
  async setProductConfigToTag (sitekey, container, name, tag, notes) {
    const data = {
      notes: this.__formatStringField(notes)
    };
    const postUrl = this.__constructEndpointURL(`sites/${sitekey}/containers/${container}/products/${name}/${tag}`);
    const body = { ...this.credentials, data };
    this.__logEvent("POST", postUrl, data);
    try {
      return await restler("POST", postUrl, body);
    } catch (err) {
      return err;
    }
  };



  // DEFAULT CONFIG

  /**
   * Post a new default configuration
   * @param {String} configStr JavaScript configuration snippet file contents
   * @param {String} vendorCode
   */
  async pushDefaultConfig (configStr, vendorCode) {
    const data = {
      config: rest.data("config.js", "application/octet-stream", new Buffer(configStr)),
      vendor_code: this.__LCTrim(vendorCode)
    };
    const postUrl = this.__constructEndpointURL(`defaultconfig`);
    const body = { ...this.credentials, multipart: true, data };
    this.__logEvent("POST", postUrl, data);
    try {
      return await restler("POST", postUrl, body);
    } catch (err) {
      return err;
    }
  };

  /**
   * Get the default configs for a particular sitekey and container
   * @param {String} vendorCode
   */
  async getDefaultConfig (vendorCode) {
    const vendorString = vendorCode ? `?=vendor_code=${encodeURIComponent(vendorCode)}` : '';
    const getUrl = this.__constructEndpointURL(`defaultconfig${vendorString}`);
    this.__logEvent("GET", getUrl);
    try {
      return await restler("GET", getUrl, this.credentials);
    } catch (err) {
      return err;
    }
  };



  // CODE

  /**
   * Create a code version
   * @param {Buffer} codeBuf contents of the ZIP containing all files
   * @param {String} notes Notes
   * @param {String} version Semver
   * @param {Boolean} latest - optional, when true then 'latest' will point to this version now
   * @param {Boolean} invalid - optional, when true then this version won't be considered 'valid' by cx suite
   */
  async createCode (codeBuf, notes, version, latest, invalid) {
    const data = {
      code: rest.data("code.zip", "application/octet-stream", codeBuf),
      notes: this.__formatStringField(notes),
      version
    };
    if (latest === true) data.latest = true;
    if (invalid === true) data.invalid = true;
    const postUrl = this.__constructEndpointURL('code');
    const body = { ...this.credentials, multipart: true, data };
    this.__logEvent("POST", postUrl, data);
    try {
      return await restler("POST", postUrl, body);
    } catch (err) {
      return err;
    }
  };

  /**
   * List code files
   * @param {Boolean} duplicates - optional, when true list overwritten results
   * @param {Boolean} latest - optional, when true list only the version marked 'latest'
   */
  async listCodes (duplicates, latest) {
    const duplicatesString = duplicates === true ? encodeURIComponent('duplicates=true') : '';
    const latestString = latest === true ? encodeURIComponent('latest=true') : '';
    const queryString = `?=${duplicatesString}&&${latestString}`;
    const getUrl = this.__constructEndpointURL(`code${queryString}`);
    this.__logEvent("GET", getUrl);
    try {
      return await restler("GET", getUrl, this.credentials);
    } catch (err) {
      return err;
    }
  };

  /**
   * Look up a code by its id
   * @param {String} id
   */
  async getCodeContents (id) {
    const getUrl = this.__constructEndpointURL(`code/files/${id}`);
    this.__logEvent("GET", getUrl);
    try {
      const result = await restler("GET", getUrl, this.credentials);
      const zip = new jsZip(result, {createFolders: true, checkCRC32: true});
      const files = Object.values(zip.files).map(function(file) {
        return {
          folder: file.dir,
          name: file.name,
          buffer: file.dir ? null : file.asNodeBuffer(),
        };
      });
      return files;
    } catch (err) {
      return err;
    }
  };

  /**
   * Set code as the 'latest'
   * @param {String} id
   */
  async setCodeToLatest (id) {
    const postUrl = this.__constructEndpointURL(`code/${id}/latest`);
    const body = { ...this.credentials };
    this.__logEvent("POST", postUrl);
    try {
      return await restler("POST", postUrl, body);
    } catch (err) {
      return err;
    }
  };

  /**
   * Set code to invalid
   * @param {String} id
   */
  async setCodeToInvalid (id) {
    const postUrl = this.__constructEndpointURL(`code/${id}/invalid`);
    const body = { ...this.credentials };
    this.__logEvent("POST", postUrl);
    try {
      return await restler("POST", postUrl, body);
    } catch (err) {
      return err;
    }
  };



  // MODULES

  /**
   * Create a module version
   * @param {Buffer} moduleBuf contents of the ZIP containing all files
   * @param {String} name
   * @param {String} version Semver
   * @param {String} notes Notes
   */
  async createModule (moduleBuf, name, version, notes) {
    const data = {
      module: rest.data("module.zip", "application/octet-stream", moduleBuf),
      module_name: this.__LCTrim(name),
      version,
      notes: this.__formatStringField(notes),
    };
    const postUrl = this.__constructEndpointURL('modules');
    const body = { ...this.credentials, multipart: true, data };
    this.__logEvent("POST", postUrl, data);
    try {
      return await restler("POST", postUrl, body);
    } catch (err) {
      return err;
    }
  };

  /**
   * List module files
   * @param {String} name - optional, when provided list only modules with this name
   * @param {String} vendorCode - optional, when provided list only modules with this vendor code
   * @param {String} version Semver - optional, Semver, when provided list only modules with this version
   */
  async listModules (name, vendorCode, version) {
    const nameString = name ? encodeURIComponent(`module_name=${this.__LCTrim(name)}`) : '';
    const vendorCodeString = vendorCode ? encodeURIComponent(`vendor_code=${this.__LCTrim(vendorCode)}`) : '';
    const versionString = version ? encodeURIComponent(`version=${this.__LCTrim(version)}`) : '';
    const queryString = `?=${nameString}&&${vendorCodeString}&&${versionString}`;
    const getUrl = this.__constructEndpointURL(`code${queryString}`);
    this.__logEvent("GET", getUrl);
    try {
      return await restler("GET", getUrl, this.credentials);
    } catch (err) {
      return err;
    }
  };

  /**
   * Look up a module by its md5
   * @param {String} md5
   */
  async getModuleContents (md5) {
    const getUrl = this.__constructEndpointURL(`modules/files/${md5}`);
    this.__logEvent("GET", getUrl);
    try {
      const result = await restler("GET", getUrl, this.credentials);
      const zip = new jsZip(result, {createFolders: true, checkCRC32: true});
      const files = Object.values(zip.files).map(function(file) {
        return {
          folder: file.dir,
          name: file.name,
          buffer: file.dir ? null : file.asNodeBuffer(),
        };
      });
      return files;
    } catch (err) {
      return err;
    }
  };




// /**
//  * Post new config JS files
//  * @param uniminifiedJSStr {String} String containing the unminified JS file
//  * @param minifiedJSStr {String} String containing the minified JS file
//  * @param notes {String} Comments on this release
//  * @param callback {Function} Callback
//  */
// FCPClient.prototype.postConfigFiles = function (uniminifiedJSStr, minifiedJSStr, notes, callback) {
//   callback = callback || function () { };

//   if (!uniminifiedJSStr) {
//     throw new Error("Missing unminified JS file.");
//   }
//   if (!minifiedJSStr) {
//     throw new Error("Missing minified JS file.");
//   }
//   if (!notes) {
//     throw new Error("Missing notes.");
//   }
//   if (minifiedJSStr.length >= uniminifiedJSStr) {
//     throw new Error("The minified JS file appears to be the same size or larger than the uniminified version.");
//   }
//   const zip = new jsZip();
//   zip.file('gatewayconfig.js', uniminifiedJSStr);
//   zip.file('gatewayconfig.min.js', minifiedJSStr);
//   const data = zip.generate({ base64: false, compression: 'DEFLATE' });
//   const dobj = {
//     'notes': this.__formatStringField(notes),
//     'config': rest.data("config.zip", "application/octet-stream", data)
//   };

//   const postUrl = this.__constructEndpointURL('gatewayconfig');

//   this.__logEvent("POST", postUrl, dobj);

//   rest.post(postUrl, {
//     multipart: true,
//     username: this.username,
//     password: this.password,
//     data: dobj
//   }).on('complete', function (data) {
//     callback(data.statusCode == 200);
//   });
// };

// /**
//  * Get publishers info for a site key
//  * @param sitekey {String} site key
//  * @param callback {Function}
//  */
// FCPClient.prototype.getPublishersForSitekey = function (sitekey, callback) {
//   callback = callback || function () { };
//   sitekey = sitekey || '';
//   sitekey = sitekey.toLowerCase().trim();

//   const URL = this.__constructEndpointURL(`/sites/${sitekey}/publishers/`);

//   this.__logEvent("GET", URL);
//   rest.get(URL, {
//     username: this.username,
//     password: this.password
//   }).on('complete', function (data) {
//     callback(data.statusCode == 200, !!data ? data.message : null);
//   });
// };

// /**
//  * Remove a publisher for a site key
//  * @param sitekey {String} site key
//  * @param publisherId {String} publisher id to remove
//  * @param callback {Function}
//  */
// FCPClient.prototype.removePublisherForSitekey = function (sitekey, publisherId, callback) {
//   callback = callback || function () { };
//   sitekey = sitekey || '';
//   sitekey = sitekey.toLowerCase().trim();
//   try {
//     publisherId = parseInt(publisherId);
//   } catch (ex) {
//     publisherId = null;
//   }

//   const URL = this.__constructEndpointURL(`/sites/${sitekey}/publishers/${publisherId}`);

//   this.__logEvent("DELETE", URL);
//   rest.del(URL, {
//     username: this.username,
//     password: this.password
//   }).on('complete', function (data) {
//     callback(data.statusCode == 200, !!data ? data.message : null);
//   });
// };

}