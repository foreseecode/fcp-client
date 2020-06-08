const FcpClient = require("./FCPClient");

module.exports = {
  handleFCPCall: FcpClient.handleFCPCall,
  fcpRef: FcpClient.fcpRef,
  fcpUrls: FcpClient.fcpUrls,
  gatewayUrls: FcpClient.gatewayUrls,
  environmentShort: FcpClient.environmentShort,
  promptForFCPCredentials: FcpClient.promptForFCPCredentials,
};
