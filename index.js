// todo: replace by archiver (more maintenance and already used in fsgulputils.js)
const chalk = require("chalk");
const FcpClient = require("./FCPClient");

const logErr = (message,err) => console.log(chalk.red(message,err));

const logSpacer = () => console.log(chalk.grey("---------------------------------------------"));

const logResults = (endpoint, successFunction, result, wasCreated) => {
  const message = result.message;
  //handle the files being returned
  if(endpoint === 'default' || (!message && endpoint === 'config')) {
    console.log(chalk.yellow('returned config:'),endpoint === 'default' ? message : result);
    return;
  }
  if(!message) {
    const files = result.map(file => file.name);
    console.log(chalk.yellow(`${files.length} zip file names:`),files);
    return;
  }
  //handle non-files
  if(['code_invalid','code_latest'].includes(endpoint)) endpoint = 'code';
  if(typeof(message) != 'object') {
    console.log(chalk.blue(message));
  } else if(!Array.isArray(message)) {
    successFunction(message, wasCreated, endpoint);
  } else if(Array.isArray(message) && message.length === 1) { //because get site likes to be special
    successFunction(message[0], wasCreated, endpoint);
  } else {
    console.log(chalk.yellow(`Complete ${endpoint} list (${chalk.magenta(message.length)} results):`));
    message.forEach(value => {
      logSpacer();
      successFunction(value, wasCreated, endpoint);
    });
  }
};

async function fancyPrint(item, wasCreated, endpoint) {
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
  const properize = s => s && s[0].toUpperCase() + s.slice(1);
  const title = properize(endpoint);
  const shouldHave = requireds[endpoint];
  if(typeof(item[shouldHave]) === undefined) {
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
    if(item.metadata) console.log(chalk.magenta("  metadata: "), item.metadata);
  }
};

async function handleFCPCall(action, endpoint, options, silent) {
  options = options || {};
  try {
    if(
      !FcpClient.fcpValidEndpoints.includes(endpoint) &&
      FcpClient.fcpValidEndpoints.includes(endpoint.slice(0,-1))
    ) { endpoint = endpoint.slice(0,-1); }
    if(!FcpClient.fcpRef[action][endpoint]) throw new Error(`Not a valid choice combination: ${action} ${endpoint}`);
    const input = await FcpClient.promptForFCPCredentials(options);
    // TODO: Add a test for your credentials here, print error if error
    console.log(chalk.magenta(`Handling call to ${action} ${endpoint}...`));
    const fcp = new FcpClient(input.username,input.password,input.fcpUrl);
    const {username,password, ...noCredsInput} = input;
    const result = await fcp.callFCP(action, endpoint, noCredsInput);
    if(!silent) logResults(endpoint.toLowerCase(),fancyPrint, result, action==='create');
    return result;
  } catch(e) { logErr(`Error handling call to ${action} ${endpoint}:`,e); return 'error'; }
};

module.exports = {
  handleFCPCall,
  fcpRef: FcpClient.fcpRef,
  fcpUrls: FcpClient.fcpUrls,
  gatewayUrls: FcpClient.gatewayUrls,
  environmentShort: FcpClient.environmentShort,
  promptForFCPCredentials: FcpClient.promptForFCPCredentials,
};