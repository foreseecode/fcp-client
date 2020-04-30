// TODO: Add missing updates, deletes, and get logs for endpoints. Maybe also add vendors, etc.

// fcpRef structure -
// action: (what are we doing)
//   thing: (what are we doing it to)
//     information: type (required), urlFrag (required), needed (optional), multipart (optional)
module.exports = {
  create: {
    client: {
      type: "POST",
      urlFrag: 'clients',
      needed: ['clientId','name','metadata','notes'],
    },
    code: {
      type: "POST",
      urlFrag: 'code',
      needed: ['codePath','notes','version'],
      multipart: true,
    },
    config: {
      type: "POST",
      urlFrag: 'sites/sitekeyHere/containers/containerHere/configs',
      needed: ['sitekey','container','notes','configPath','vendorCode'],
      multipart: true,
    },
    container: {
      type: "POST",
      urlFrag: 'sites/sitekeyHere/containers',
      needed: ['sitekey','name','notes'],
    },
    default: {
      type: "POST",
      urlFrag: 'defaultconfig',
      needed: ['configPath','vendorCode'],
      multipart: true,
    },
    module: {
      type: "POST",
      urlFrag: 'modules',
      needed: ['modulePath','moduleName','version','notes'],
      multipart: true,
    },
    product: {
      type: "POST",
      urlFrag: 'sites/sitekeyHere/containers/containerHere/products/productHere',
      needed: ['sitekey','container','product','notes','configPath','vendorCode'],
      multipart: true,
    },
    site: {
      type: "POST",
      urlFrag: 'sites',
      needed: ['clientId','name','notes'],
    },
  },
  get: {
    client: {
      type: "GET",
      urlFrag: 'clients/clientIdHere',
      needed: ['clientId'],
    },
    code: {
      type: "GET",
      urlFrag: 'code/files/codeIdHere',
      needed: ['codeId'],
    },
    config: {
      type: "GET",
      urlFrag: 'sites/sitekeyHere/containers/containerHere/configs/files/configTagHere',
      needed: ['sitekey','container','configTag'],
    },
    container: {
      type: "GET",
      urlFrag: 'sites/sitekeyHere/containers/containerHere',
      needed: ['sitekey','container'],
    },
    default: {
      type: "GET",
      urlFrag: 'defaultconfig',
    },
    module: {
      type: "GET",
      urlFrag: 'modules/files/moduleMD5Here',
      needed: ['moduleMD5'],
    },
    site: {
      type: "GET",
      urlFrag: 'sites/sitekeyHere',
      needed: ['sitekey'],
    },
  },
  list: {
    client: {
      type: "GET",
      urlFrag: 'clients',
    },
    code: {
      type: "GET",
      urlFrag: 'code',
    },
    config: {
      type: "GET",
      urlFrag: 'sites/sitekeyHere/containers/containerHere/configs',
      needed: ['sitekey','container'],
    },
    container: {
      type: "GET",
      urlFrag: 'sites/sitekeyHere/containers',
      needed: ['sitekey'],
    },
    module: {
      type: "GET",
      urlFrag: 'modules',
    },
    product: {
      type: "GET",
      urlFrag: 'sites/sitekeyHere/containers/containerHere/products',
      needed: ['sitekey','container'],
    },
    site: {
      type: "GET",
      urlFrag: 'sites',
    },
  },
  set: {
    code_invalid: {
      type: "POST",
      urlFrag: 'code/codeIdHere/invalid',
      needed: ['codeId'],
    },
    code_latest: {
      type: "POST",
      urlFrag: 'code/codeIdHere/latest',
      needed: ['codeId'],
    },
    config: {
      type: "POST",
      urlFrag: 'sites/sitekeyHere/containers/containerHere/configs/configTagHere',
      needed: ['sitekey','container','configTag','notes'],
    },
    product: {
      type: "POST",
      urlFrag: 'sites/sitekeyHere/containers/containerHere/products/productHere/configTagHere',
      needed: ['sitekey','container','product','configTag','notes'],
    },
  },
};