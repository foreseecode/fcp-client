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

//does this work?
const home = process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
const envFilePath = home + '/env.json'

const fcpQueryParams = {
  active: 'active',
  client_id: 'client_id',
  clientId: 'client_id',
  deleted: 'deleted',
  duplicates: 'duplicates',
  fromDate: 'from_date',
  inactive: 'inactive',
  latest: 'latest',
  search: 'search',
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
    const isFile = response.headers.get('content-type') === 'application/octet-stream';
    
    if (isFile) return response.arrayBuffer();
    return response.json();
  
  } catch (err) {
    console.log(err);
    throw err;
  }
};

const formify = data => {
  const form = new formdata();
  Object.keys(data).forEach(key => {
    const options = Object.keys(filesRef).includes(key) ? {...filesRef[key], knownLength: data[key].length} : false;
    const valueAtKey = typeof(data[key]) === 'boolean' ? data[key].toString() : data[key];
    options ? form.append(key, valueAtKey, options) : form.append(key, valueAtKey);
  });
  return form;
};

const paramify = data => {
  const params = new URLSearchParams();
  Object.keys(data).forEach(key => {
    params.append(key, data[key]);
  });
  return params;
}

const fsReadFile = async path => await promisify(fs.readFile)(path).catch(e=>{});

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
  constructor (options = {}) {
    const { username, password, environment } = options;
    const hostname = environment.fcpUrl;
    
    if (!username) {
      throw new Error("Missing username");
    }
    if (username.indexOf('@') === -1) {
      throw new Error("Username should be an email address");
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
    this.hostname = hostname;
    this.__log = [];
  }

  static get environmentShort () { 
    return ["dev", "qa", "qa2", "stg", "prod", "local", "local-docker", "qfed", "ttec"]; 
  }

  static get fcpUrls () {
    return {
      "local": "http://localhost:3001",
      "dev": "https://dev-fcp.foresee.com",
      "qa": "https://qa-fcp.foresee.com",
      "qa2": "https://qa2-fcp.foresee.com",
      "stg": "https://stg-fcp.foresee.com",
      "prod": "https://fcp.foresee.com",
      "qfed": "http://qfed-xm-dkrsvc1.lab.local:3001",
      "ttec": "https://eex-cert-brain.ttecfed.com:3010",
      "local-docker": "http://localhost:3001"
    };
  }

  static get gatewayUrls () {
    return {
      "local": "http://localhost:3001",
      "dev": "https://dev-gateway.foresee.com",
      "qa": "https://qa-gateway.foresee.com",
      "qa2": "https://qa2-gateway.foresee.com",
      "stg": "https://stg-gateway.foresee.com",
      "prod": "https://gateway.foresee.com",
      "qfed": "https://qfed-xm-sdkweb1.lab.local",
      "ttec": "https://eex-cert-gateway.ttecfed.com",
      "local-docker": "http://localhost:3003"
    };
  }

  static get fcpRef() { return fcpRef; }

  static get fcpValidEndpoints() {
    // TODO: '.reduce((acc, val) => acc.concat(val), [])' can be replaced with '.flat()' once we are able to bump node up to/past 11
    return Object.keys(fcpRef)
      .map(action => Object.keys(fcpRef[action]))
      .reduce((acc, val) => acc.concat(val), []);
  }

  /**
   * Ask the user to set their credentials
   */
  static async setFCPCredentials () {
    const schema = { properties: {} };
    
    schema.properties.username = {
      required: true
    };
    
    schema.properties.password = {
      hidden: true,
      required: true
    }
    
    await prompt.start();
    const result = await prompt.get(schema);
    const { username, password } = result;
    
    if (!username) {
      throw new Error('Please provide a valid username.')
    }

    if (!password) {
      throw new Error('Please provide a valid password.')
    }

    let envObj = {}
    try {
      envObj = JSON.parse((await fsReadFile(envFilePath)).toString());
    } catch (e) {
      // console.log(`error parsing "${home}/env.json": ${e}`);
    }

    envObj.FCP_USERNAME = username
    envObj.FCP_PASSWORD = password

    const writeStream = fs.createWriteStream(envFilePath);
    writeStream.write(JSON.stringify(envObj))
    writeStream.end()

    console.log(`credentials set in the ${envFilePath} file`)
  }

  /**
   * Ask the user for credentials
   * @param {Object} options
   * This could include:
   *  - {String} username
   *  - {String} password
   */
  static async getFCPCredentials (options = {}) {
    let env;
    const schema = { properties: {} };
    // Read FCP credentials from passed in, ~/env.json or environment variables, if any exist
    try {
      env = JSON.parse((await fsReadFile(envFilePath)).toString());
    } catch (e) {
      // console.log(`error parsing "${home}/env.json": ${e}`);
      env = {};
    }
    options.username = options.username || env.FCP_USERNAME || process.env.FCP_USERNAME;
    options.password = options.password || env.FCP_PASSWORD || process.env.FCP_PASSWORD;
    
    if (!options.username || !options.password) {
      console.log(chalk.cyan("Please enter your FCP credentials (no @ is required). "));
      
      schema.properties.username = {
        required: true
      };
      
      schema.properties.password = {
        hidden: true,
        required: true
      }
      
      await prompt.start();
      const result = await prompt.get(schema);
      Object.assign(options, result);
    }
    
    if (!~options.username.indexOf('@')) {
      options.username = options.username.trim() + '@aws.foreseeresults.com';
    }
    
    return options;
  }

  /**
   * Ask the user to set their environment
   */
  static async setFCPEnvironment () {
    console.log('valid environments: prod, stg, qa, qa2, dev, local')

    const schema = { properties: {} };
    
    schema.properties.environment = {
      required: true
    };
    
    await prompt.start();
    const result = await prompt.get(schema);
    const { environment } = result
    
    const validEnvironments = ['prod', 'stg', 'qa', 'qa2', 'dev', 'local']

    if (!environment || !validEnvironments.includes(environment)) {
      throw new Error('Please provide a valid environment. (prod, stg, qa, qa2, dev, local)')
    }

    let envObj = {}
    try {
      envObj = JSON.parse((await fsReadFile(envFilePath)).toString());
    } catch (e) {
      // console.log(`error parsing "${home}/env.json": ${e}`);
    }

    envObj.FCP_ENVIRONMENT = environment

    const writeStream = fs.createWriteStream(envFilePath);
    writeStream.write(JSON.stringify(envObj))
    writeStream.end()

    console.log(`environment set in the ${envFilePath} file`)
  }
  
  /**
   * Ask the user for environment
   * @param {Object} options
   * This could include:
   *  - {String} environment: dev, qa, qa2, stg, prod, local
   */
  static async getFCPEnvironment (options = {}) {
    let env;
    const schema = {properties: {}};

    // Read FCP environment from passed in options, ~/env.json or environment variables, if any exist
    try {
      env = JSON.parse((await fsReadFile(envFilePath)).toString());
    } catch (e) {
      env = {};
    }
    options.env = options.env || env.FCP_ENVIRONMENT || process.env.FCP_ENVIRONMENT;
    
    if (!options.env) {
      console.log('Environment options are: dev, qa, qa2, stg, prod or local (localhost:3001)');
      
      schema.properties.env = {
        required: true,
        // pattern: /^\w+$/,                  // Regular expression that input must be valid against.
        type: 'string',
        message: 'Environment options are: dev, qa, qa2, stg, prod or local (localhost:3001)'
      };

      await prompt.start();
      const result = await prompt.get(schema);
      Object.assign(options, result);
    }

    let validEnv = this.environmentShort.includes(options.env);
    
    if (validEnv) {
      options.fcpUrl = this.fcpUrls[options.env];
      options.gatewayUrl = this.gatewayUrls[options.env];
    } else {
      throw new Error("Invalid environment.");
    }
    
    return options;
  }

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
  }

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
  }

  async callFCP (action, endpoint, options = {}) {
    const basicAuth = { "Authorization": `Basic ${(Buffer.from(`${this.username}:${this.password}`)).toString('base64')}` };
    const testUrl = `${this.hostname}/user/groups`;
    const testResult = await fetch(testUrl, { method: 'GET', headers: basicAuth });
    const testResultMessage = testResult && testResult.statusCode === 200 && testResult.message;
    const fcpGroups = Array.isArray(testResultMessage.groups) &&
      testResultMessage.groups.filter(group => group.substr(0,4) === "fcp_");
    if(!fcpGroups) {
      throw new Error(JSON.stringify(testResult));
    }
    
    // TODO: add a better error message so they know what came in wrong
    if(!fcpRef[action] || !fcpRef[action][endpoint]) throw new Error(`Unknown choice combination: ${action} ${endpoint}`);
    const { type, urlFrag, required, multipart } = fcpRef[action][endpoint];

    if (type === "GET") options.disableNotes = true;
    
    const input = await this.getRequiredOptions(options, required);
    
    if (input.error) throw new Error(input.error);
    
    let queryString = "";
    
    if (type === "GET") {
      queryString += "?"
      
      if (options.search && Array.isArray(options.search)) options.search = options.search.join();
      
      const paramKeys = Object.keys(input).filter(key => !!fcpQueryParams[key]);
      
      paramKeys.forEach(key => queryString += fcpQueryParams[key]+"="+input[key]+"&")
    }

    const url = this.__constructEndpointURL(
      urlFrag
        .replace(':clientId',input.client_id)
        .replace(':site',input.site)
        .replace(':container',input.container)
        .replace(':configTag',input.config_tag)
        .replace(':product',input.product)
        .replace(':codeId',input.code_id)
        .replace(':md5',input.module_md5)
    ) + queryString;
    
    
    console.log(chalk.magenta('Making FCP Call to'),url);
    
    let formHeaders = {};
    
    let body = paramify(input);
    
    if (multipart) {
      body = formify(input);
      formHeaders = body.getHeaders();
    }
    
    const requestOptions = {
      method: type,
      headers: { ...formHeaders, ...basicAuth }
    };
    
    if (type != "GET") requestOptions.body = body;

    this.__logEvent(type, url);
    
    try {
      const result = await fetch(url, requestOptions);
      
      if (!options.silent) logResults(endpoint.toLowerCase(), fancyPrint, result, ['create','set'].includes(action), options.product);
      
      if (type === "GET" && (url.includes('/code/files/') || url.includes('/modules/files/'))) {
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

  }

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
  async getRequiredOptions (options = {}, required = []) {
    if(options.doNotPrompt) return options;

    const schema = { properties: {} };

    if (!options.disableNotes && typeof (options.notes) === "undefined") {
      schema.properties.notes = {
        required: true
      };
    }
    
    const requiredString = {
      required: true,
      type: "string",
    };
    
    if(!options.client_id && options.clientId) options.client_id = options.clientId;
    if (required.includes('client_id') && !options.client_id) {
      schema.properties.client_id = {
        type: 'integer',
        message: chalk.yellow("Client ID should be a non-zero integer."),
      }
    }
    if(!options.clientId && options.client_id) options.clientId = options.client_id;
    if (required.includes('clientId') && !options.clientId) {
      schema.properties.clientId = {
        required: true,
        type: 'integer',
        message: chalk.yellow("Client ID should be a non-zero integer."),
      }
    }
    
    if(!options.site && options.site_name) options.site = options.site_name;
    if (required.includes('site') && !options.site) {
      schema.properties.site = {...requiredString};
    }
    
    if (required.includes('container') && !options.container) {
      schema.properties.container = {...requiredString};
    }
    
    if (required.includes('product') && !options.product) {
      schema.properties.product = {...requiredString};
    }
    
    if (required.includes('name') && !options.name) {
      schema.properties.name = {...requiredString};
    }
    
    if (required.includes('metadata') && !options.metadata) {
      const message = "Metadata can be the website URL, client contact name, other trademarks, etc. This is useful for searching.";
      schema.properties.metadata = {...requiredString, message};
    }
    
    if(!options.configTag && options.config_tag) options.configTag = options.config_tag;
    if (required.includes('configTag') && !options.configTag) {
      schema.properties.configTag = {...requiredString};
    }
    
    if (required.includes('configStr') && !options.configStr) {
      const message = "This is the javascript config you want to upload, stringified";
      schema.properties.configStr = {...requiredString, message};
    }
    
    if(!options.vendorCode && options.vendor_code) options.vendorCode = options.vendor_code;
    if (required.includes('vendorCode') && !options.vendorCode) {
      const message = "8 char limit, accepted chars A-Z/a-z";
      schema.properties.vendorCode = {...requiredString, message};
    }
    
    if(!options.prereleaseCode && options.prerelease_code) options.prereleaseCode = options.prerelease_code;
    if (required.includes('prereleaseCode') && !options.prereleaseCode) {
      const message = "8 char limit, accepted chars A-Z/a-z"
      schema.properties.prereleaseCode = {...requiredString, message};
    }
    if(!options.codeId && options.code_id) options.codeId = options.code_id;
    if (required.includes('codeId') && !options.codeId) {
      schema.properties.codeId = {
        required: true,
        type: 'integer',
        message: chalk.yellow("Code ID should be a non-zero integer."),
      }
    }
    if(!options.moduleName && options.module_name) options.moduleName = options.module_name;
    
    if (required.includes('moduleName') && !options.moduleName) {
      schema.properties.moduleName = {...requiredString};
    }
    
    if(!options.moduleMD5 && options.module_md5) options.moduleMD5 = options.module_md5;
    if (required.includes('moduleMD5') && !options.moduleMD5) {
      schema.properties.moduleMD5 = {...requiredString};
    }
    
    if (required.includes('version') && !options.version) {
      schema.properties.version = {...requiredString};
    }
    
    if (required.includes('latest') && typeof options.latest === "undefined") {
      schema.properties.latest = {type: "string", pattern: '^(true|false|invalid)$'};
      console.log(chalk.yellow("Latest: true/false/invalid."));
    }
    
    if (required.includes('duplicates') && typeof options.duplicates != "boolean") {
      schema.properties.duplicates = { type: "boolean"};
    }

    if (required.includes('deleted') && typeof options.deleted != "boolean") {
      schema.properties.deleted = { type: "boolean"};
    }

    if (required.includes('active') && typeof options.active != "boolean") {
      schema.properties.active = { type: "boolean"};
    }

    if (required.includes('inactive') && typeof options.inactive != "boolean") {
      schema.properties.inactive = { type: "boolean"};
    }

    if (required.includes('search') && typeof options.search === "undefined") {
      schema.properties.search = {type: "string"};
    }

    const fileMessage = chalk.grey("This is the relative or absolute path to the file, including the extension");
    if (required.includes('codePath') && !options.codePath && !options.codeBuf && !options.code) {
      schema.properties.codePath = {...requiredString, message:fileMessage};
    }
    
    if (required.includes('configPath') && !options.configPath && !options.configStr && !options.config) {
      schema.properties.configPath = {...requiredString, message:fileMessage};
    }
    
    if (required.includes('filePath') && !options.filePath && !options.fileBuf && !options.file) {
      schema.properties.filePath = {type: "string", message:fileMessage};
    }
    
    if (required.includes('jsonPath') && !options.jsonPath && !options.jsonStr && !options.json) {
      schema.properties.jsonPath = {type: "string", message:fileMessage};
    }
    
    if (required.includes('modulePath') && !options.modulePath && !options.moduleBuf && !options.module) {
      schema.properties.modulePath = {...requiredString, message:fileMessage};
    }
  
    try {
      await prompt.start();
      const result = await prompt.get(schema);
      const emptyKeys = Object.keys(result).filter(value => result[value] === '');
      emptyKeys.forEach(key => delete result[key]);
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

      if (required.includes('codePath') && !options.code) {
        throw new Error("Missing code buffer, unable to create zip folder to send with request.");
      }
      if (required.includes('configPath') && !options.config) {
        throw new Error("Missing config string, unable to create js file to send with request.");
      }
      if (required.includes('modulePath') && !options.module) {
        throw new Error("Missing module buffer, unable to create zip folder to send with request.");
      }

      return options;
    } catch (error) { return { error }; }
  }
}

function logResults (endpoint, successFunction, result, wasCreated, productName) {
  const message = result.message;
  
  //handle the files being returned
  if (endpoint === 'default' || (!message && endpoint === 'config')) {
    console.log(chalk.yellow('returned config:'), endpoint === 'default' ? message : result);
    return;
  }
  
  if (!message) {
    const files = result.map(file => file.name);
    console.log(chalk.yellow(`${files.length} zip file names:`), files);
    return;
  }
  
  //handle non-files
  if (['code_invalid', 'code_latest'].includes(endpoint)) endpoint = 'code';
  
  if (typeof(message) != 'object') {
    console.log(chalk.blue(message));
  } else if (!Array.isArray(message)) {
    successFunction(message, wasCreated, endpoint, productName);
  } else if (Array.isArray(message) && message.length === 1) { //because get site likes to be special
    successFunction(message[0], wasCreated, endpoint, productName);
  } else {
    console.log(chalk.yellow(`Complete ${endpoint} list (${chalk.magenta(message.length)} results):`));
    message.forEach(value => {
      console.log(chalk.grey("---------------------------------------------"));
      successFunction(value, wasCreated, endpoint, productName);
    });
  }
};

function fancyPrint (item, wasCreated, endpoint, productName) {
  if (wasCreated && endpoint === 'product' && item.product !== productName) wasCreated = false;
  
  const requireds = {
    client: 'id',
    code: 'code_md5',
    config: 'tag',
    container: 'site_name',
    default: 'unrealisticExpectations',
    module: 'module_md5',
    product: 'tag',
    site: 'alias'
  };
  const capitalize = s => s && s[0] && s[0].toUpperCase() + s.slice(1);
  
  const title = capitalize(endpoint);
  const required = requireds[endpoint];
  
  if (!required) {
    console.log(
      chalk.magenta(`   ${title} contents: `),
      chalk.grey(JSON.stringify(item)),
    );
  } else {
    const whatToPrint = {
      client: chalk.grey(`[ID: ${chalk.yellow(item.id)}] `) + item.name,
      code:
        chalk.grey(`[code version: ${chalk.yellow(item.version)}] `) + 
        (item.vendor_code ? `${chalk.grey('vendor code: ') + item.vendor_code} ` : ""),
      config: 
        chalk.grey(`[container config: ${chalk.yellow(item.tag)}] `) +
        (item.code_version ? `${chalk.grey('code version: ') + item.code_version} ` : "") +
        (item.vendor_code ? `${chalk.grey('vendor code: ') + item.vendor_code} ` : ""),
      container:
        chalk.grey(`[site: ${chalk.yellow(item.site_name)}] `) +
        chalk.grey(`[container: ${chalk.yellow(item.name)}] `) +
        (item.config_tag ? `${chalk.grey('config tag: ') + item.config_tag} ` : ""),
      module:
        chalk.grey(`[name: ${chalk.yellow(item.module_name)}] `) +
        chalk.grey(`[version: ${chalk.yellow(item.version)}] `) +
        (item.vendor_code ? `${chalk.grey('vendor code: ') + item.vendor_code} ` : ""),
      product:
        chalk.grey(`[product: ${chalk.yellow(item.product)}] `) +
        chalk.grey(`[product config: ${chalk.yellow(item.tag)}] `) +
        (item.config_tag ? `${chalk.grey('code version: ') + item.code_version} ` : "") +
        (item.vendor_code ? `${chalk.grey('vendor code: ') + item.vendor_code} ` : ""),
      site:
        chalk.grey(`[CID: ${chalk.yellow(item.client_id)}] `) + 
        chalk.grey(`[sitekey: ${chalk.yellow(item.name)}] `) + 
        (item.alias ? `${chalk.grey('alias: ') + item.alias} ` : ""),
    };
    
    console.log(
      chalk.magenta(`  ${title}: `),
      whatToPrint[endpoint],
      item.deleted && item.deleted != 0 ? chalk.red("DELETED") : "",
      chalk.magenta(!!wasCreated ? "was created." : ""),
    );
    
    if (item.metadata) console.log(chalk.magenta("  metadata: "), item.metadata);
  }
};

