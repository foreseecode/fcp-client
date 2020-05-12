const chalk = require('chalk');
const formdata = require('form-data');
const fs = require('fs');
const prompt = require('prompt-async');
const nodefetch = require('node-fetch');
const jsZip = require('node-zip');
const { URLSearchParams } = require('url');
const { promisify } = require('util');
const zipdir = require('zip-dir');

const fcpRef = require('./endpointRequirements');

const home = process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];

const fcpQueryParams = {
  active: 'active',
  clientId: 'client_id',
  deleted: 'deleted',
  duplicates: 'duplicates',
  fromDate: 'from_date',
  inactive: 'inactive',
  latest: 'latest',
  searchTerms: 'search',
  toDate: 'to_date',
  vendorCode: 'vendor_code',
};

const filesRef = {
  code: {
    filename: 'code.zip',
    contentType: "application/octet-stream",
  },
  config: {
    filename: 'config.js',
    contentType: "application/javascript",
  },
  file: {
    filename: 'file.zip',
    contentType: "application/octet-stream",
  },
  json: {
    filename: 'config.json',
    contentType: "application/json",
  },
  module: {
    filename: 'module.zip',
    contentType: "application/octet-stream",
  },
};

const fetch = async (url, options) => {
  try {
    const response = await nodefetch(url,options);
    if(response.headers.get('content-type') === 'application/octet-stream') {
      return await response.arrayBuffer();
    }
    return await response.json();
  } catch (err) { throw err; }
};

const formify = data => {
  const form = new formdata();
  Object.keys(data).forEach(key => {
    if (key === 'commands') return;
    const options = Object.keys(filesRef).includes(key) ? {...filesRef[key], knownLength: data[key].length} : false;
    const valueAtKey = typeof(data[key]) === 'boolean' ? data[key].toString() : data[key];
    options ? form.append(key, valueAtKey, options) : form.append(key, valueAtKey);
  });
  return form;
};

const paramify = data => {
  const params = new URLSearchParams();
  Object.keys(data).forEach(key => {
    if (key === 'commands') return;
    params.append(key, data[key]);
  });
  return params;
}

const fsReadFile = async path => await promisify(fs.readFile)(path);

const getZipBufferFromFolderPath = async (rootdir, options) => await promisify(zipdir)(rootdir, options);

const getStringFromFilePath = async path => (await fsReadFile(path)).toString();

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
    if (hostname.indexOf(":/") === -1) {
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

  static get fcpRef() { return fcpRef; };

  static get fcpValidEndpoints() {
    // TODO: '.reduce((acc, val) => acc.concat(val), [])' can be replaced with '.flat()' once we are able to bump node up to/past 11
    return Object.keys(fcpRef)
      .map(action => Object.keys(fcpRef[action]))
      .reduce((acc, val) => acc.concat(val), []);
  };

  /**
   * Ask the user for credentials and notes if appropriate
   * @param {Options} options
   * This could include:
   *  - {String} username
   *  - {String} password
   *  - {Number} environment - 0 = dev, 1 = QA, 2 = QA2, 3 = stg, 4 = prod, 5 = local
   *  - {Boolean} disableEnv - If you want to not require an environment
   */
  static async promptForFCPCredentials (options) {
    options = options || {};
    let ev;
    const schema = {
      properties: {}
    };

    if(!options.environment && options.environment != 0) options.environment = options.env;
    if(options.environment && isNaN(options.environment)) {
      options.environment = FCPClient.environmentShort.indexOf(options.environment);
    }
    if(options.environment && (options.environment > 5 || options.environment < 0)) {
      options.environment = undefined;
    }
  
    if(options.environment === 0) options.environment = '0'; //becauase 0 evaluates false in the next section

    // Read FCP credentials from passed in, ~/env.json or environment variables, if any exist
    try {
      ev = JSON.parse((await fsReadFile(home + '/env.json')).toString());
      options.username = options.username || ev.FCP_USERNAME || process.env.FCP_USERNAME;
      options.password = options.password || ev.FCP_PASSWORD || process.env.FCP_PASSWORD;
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
    if (!options.disableEnv && typeof (options.environment) === "undefined") {
      schema.properties.environment = {
        required: true,
        type: 'integer',
        message: '0 = dev, 1 = QA, 2 = QA2, 3 = stg, 4 = prod, 5 = localhost:3001'
      };
      console.log("For environment, enter a number: " + chalk.yellow("0 = dev") + ", " + chalk.magenta("1 = QA") + ", " + chalk.magenta("2 = QA2") + ", " + chalk.green("3 = stg") + ", " + chalk.blue("4 = prod") + ", " + "5 = localhost:3001");
    }
  
    try {
      await prompt.start();
      const result = await prompt.get(schema);
      Object.assign(options, result);
    
      if (options.username.indexOf('@') === -1) {
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
      delete options.disableEnv; //was causing an error in multipart requests

      return options;
    } catch (e) {
    }
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

  async callFCP(action, endpoint, options) {
    // TODO: add a better error message so they know what came in wrong
    if(!fcpRef[action] || !fcpRef[action][endpoint]) throw new Error(`Unknown choice combination: ${action} ${endpoint}`);
    const { type, urlFrag, needed, multipart } = fcpRef[action][endpoint];
    options = options || {};
    if(type === "GET") options.disableNotes = true;
    const input = await this.promptForNeededOptions(options, needed);
    if(input.error) throw new Error(input.error);
    let queryString = "";
    if(type === "GET") {
      queryString += "?"
      if(options.searchTerms && Array.isArray(options.searchTerms)) options.searchTerms = options.searchTerms.join();
      const paramKeys = Object.keys(input).filter(key => !!fcpQueryParams[key]);
      paramKeys.forEach(key => queryString += fcpQueryParams[key]+"="+input[key])
    }
    const url = this.__constructEndpointURL(
      urlFrag
        .replace('clientIdHere',input.client_id)
        .replace('sitekeyHere',input.site_name)
        .replace('containerHere',input.container)
        .replace('configTagHere',input.config_tag)
        .replace('productHere',input.product)
        .replace('codeIdHere',input.code_id)
        .replace('moduleMD5Here',input.module_md5)
    ) + queryString;
    return await this.actuallyCallFCP(type, url, input, multipart || false);
  };

  /**
   * Ask the user for credentials and notes if appropriate
   * @param {Options} options
   * This could include:
   *  - {String} notes
   *  - {Boolean} disableNotes - If you want to not require notes
   *  - {Number} clientId
   *  - {String} sitekey
   *  - {String} container
   *  - {String} name
   *  - {String} metadata
   *  - {String} configTag
   *  - {String} vendorCode
   *  - {String} prereleaseCode
   *  - {true/false/invalid} latest - If you want to pass that value on
   * As well as any other values you just want to pass on (anything not listed will be included in return)
   */
  async promptForNeededOptions (options, needed) {
    options = options || {};
    needed = needed || [];
    const schema = {
      properties: {}
    };

    if (!options.disableNotes && typeof (options.notes) === "undefined") {
      schema.properties.notes = {
        required: true
      };
    }

    const requiredString = {
      required: true,
      type: "string",
    };
    
    if(!options.clientId && options.client_id) options.clientId = options.client_id;
    if (needed.includes('clientId') && !options.clientId) {
      schema.properties.clientId = {
        required: true,
        type: 'integer',
        message: chalk.yellow("Client ID should be a non-zero integer."),
      }
    }
    if(!options.sitekey && options.site_name) options.sitekey = options.site_name;
    if (needed.includes('sitekey') && !options.sitekey) {
      schema.properties.sitekey = {...requiredString};
    }
    if (needed.includes('container') && !options.container) {
      schema.properties.container = {...requiredString};
    }
    if (needed.includes('product') && !options.product) {
      schema.properties.product = {...requiredString};
    }
    if (needed.includes('name') && !options.name) {
      schema.properties.name = {...requiredString};
    }
    if (needed.includes('metadata') && !options.metadata) {
      const message = "Metadata can be the website URL, client contact name, other trademarks, etc. This is useful for searching.";
      schema.properties.metadata = {...requiredString, message};
    }
    if(!options.configTag && options.config_tag) options.configTag = options.config_tag;
    if (needed.includes('configTag') && !options.configTag) {
      schema.properties.configTag = {...requiredString};
    }
    if (needed.includes('configStr') && !options.configStr) {
      const message = "This is the javascript config you want to upload, stringified";
      schema.properties.configStr = {...requiredString, message};
    }
    if(!options.vendorCode && options.vendor_code) options.vendorCode = options.vendor_code;
    if (needed.includes('vendorCode') && !options.vendorCode) {
      const message = "8 char limit, accepted chars A-Z/a-z";
      schema.properties.vendorCode = {...requiredString, message};
    }
    if(!options.prereleaseCode && options.prerelease_code) options.prereleaseCode = options.prerelease_code;
    if (needed.includes('prereleaseCode') && !options.prereleaseCode) {
      const message = "8 char limit, accepted chars A-Z/a-z"
      schema.properties.prereleaseCode = {...requiredString, message};
    }
    if(!options.codeId && options.code_id) options.codeId = options.code_id;
    if (needed.includes('codeId') && !options.codeId) {
      schema.properties.codeId = {
        required: true,
        type: 'integer',
        message: chalk.yellow("Code ID should be a non-zero integer."),
      }
    }
    if(!options.moduleName && options.module_name) options.moduleName = options.module_name;
    if (needed.includes('moduleName') && !options.moduleName) {
      schema.properties.moduleName = {...requiredString};
    }
    if(!options.moduleMD5 && options.module_md5) options.moduleMD5 = options.module_md5;
    if (needed.includes('moduleMD5') && !options.moduleMD5) {
      schema.properties.moduleMD5 = {...requiredString};
    }
    if (needed.includes('version') && !options.version) {
      schema.properties.version = {...requiredString};
    }
    if (needed.includes('latest') && typeof options.latest === "undefined") {
      schema.properties.latest = {...requiredString, pattern: '^(true|false|invalid)$'};
      console.log(chalk.yellow("Latest: true/false/invalid."));
    }
    const fileMessage = chalk.grey("This is the relative or absolute path to the file, including the extension");
    if (needed.includes('codePath') && !options.codePath && !options.codeBuf && !options.code) {
      schema.properties.codePath = {...requiredString, message:fileMessage};
    }
    if (needed.includes('configPath') && !options.configPath && !options.configStr && !options.config) {
      schema.properties.configPath = {...requiredString, message:fileMessage};
    }
    if (needed.includes('filePath') && !options.filePath && !options.fileBuf && !options.file) {
      schema.properties.filePath = {...requiredString, message:fileMessage};
    }
    if (needed.includes('jsonPath') && !options.jsonPath && !options.jsonStr && !options.json) {
      schema.properties.jsonPath = {...requiredString, message:fileMessage};
    }
    if (needed.includes('modulePath') && !options.modulePath && !options.moduleBuf && !options.module) {
      schema.properties.modulePath = {...requiredString, message:fileMessage};
    }
  
    try {
      await prompt.start();
      const result = await prompt.get(schema);
      Object.assign(options, result);

      if(options.clientId) options.client_id = options.clientId;
      if(options.sitekey) options.site_name = options.sitekey;
      if(options.configTag) options.config_tag = options.configTag;
      if(options.vendorCode) options.vendor_code = options.vendorCode;
      if(options.prereleaseCode) options.prerelease_code = options.prereleaseCode;
      if(options.codeId) options.code_id = options.codeId;
      if(options.moduleName) options.module_name = options.moduleName;
      if(options.moduleMD5) options.module_md5 = options.moduleMD5;
      if (options.codePath && !options.codeBuf && !options.code) {
        options.codeBuf = await getZipBufferFromFolderPath(options.codePath.replace("~",home));
      }
      if (options.codeBuf && !options.code) {
        options.code = options.codeBuf;
      }
      if (options.configPath && !options.configStr && !options.config) {
        options.configStr = await getStringFromFilePath(options.configPath.replace("~",home));
      }
      if(options.configStr && !options.config) {
        options.config = Buffer.from(options.configStr);
      }
      if (options.filePath && !options.fileBuf && !options.file) {
        options.fileBuf = await getZipBufferFromFolderPath(options.filePath.replace("~",home));
      }
      if (options.fileBuf && !options.file) {
        options.file = options.fileBuf;
      }
      if (options.jsonPath && !options.jsonStr && !options.json) {
        options.jsonStr = await getStringFromFilePath(options.jsonPath.replace("~",home));
      }
      if (options.jsonStr && !options.json) {
        options.json = Buffer.from(options.jsonStr);
      }
      if (options.modulePath && !options.moduleBuf && !options.module) {
        options.moduleBuf = await getZipBufferFromFolderPath(options.filePath.replace("~",home));
      }
      if (options.moduleBuf && !options.module) {
        options.module = options.moduleBuf;
      }

      if (needed.includes('codePath') && !options.code) {
        throw new Error("Missing code buffer, unable to create zip folder to send with request.");
      }
      if (needed.includes('configPath') && !options.config) {
        throw new Error("Missing config string, unable to create js file to send with request.");
      }
      if (needed.includes('filePath') && !options.file) {
        throw new Error("Missing file buffer, unable to create zip folder to send with request.");
      }
      if (needed.includes('jsonPath') && !options.json) {
        throw new Error("Missing json string, unable to create json file to send with request.");
      }
      if (needed.includes('modulePath') && !options.module) {
        throw new Error("Missing module buffer, unable to create zip folder to send with request.");
      }

      return options;
    } catch (error) { return { error }; }
  };

  async actuallyCallFCP (type, url, data, multipart) {
    console.log(chalk.magenta('Making FCP Call to'),url);
    const basicAuth = { "Authorization": `Basic ${(Buffer.from(`${this.credentials.username}:${this.credentials.password}`)).toString('base64')}` };
    let formHeaders = {};
    let body = paramify(data);
    if(multipart) {
      body = formify(data);
      formHeaders = body.getHeaders();
    }
    const requestOptions = {
      method: type,
      headers: { ...formHeaders, ...basicAuth }
    };
    if (type != "GET") requestOptions.body = body;

    this.__logEvent(type.toUpperCase(), url);
    try {
      const result = await fetch(url, requestOptions);
      if(type === "GET" && (url.includes('/code/files/') || url.includes('/modules/files/'))) {
        const zip = new jsZip(Buffer.from(result), {createFolders: true, checkCRC32: true});
        const files = Object.values(zip.files).map(function(file) {
          return {
            folder: file.dir,
            name: file.name,
            buffer: file.dir ? null : file.asNodeBuffer(),
          };
        });
        return files;
      }
      return result;
    } catch (err) {
      return err;
    }
  };

}