// TODO: Add missing updates, deletes, and get logs for endpoints. Maybe also add vendors, etc.

// fcpRef structure -
// action: (what are we doing)
//   thing: (what are we doing it to)
//     information: type (required), urlFrag (required), required (optional), multipart (optional)
module.exports = {
  create: {
    client: {
      type: "POST",
      urlFrag: 'clients',
      required: ['clientId','name','metadata','notes'],
    },
    code: {
      type: "POST",
      urlFrag: 'code',
      required: ['codePath','notes','version'],
      multipart: true,
    },
    config: {
      type: "POST",
      urlFrag: 'sites/:site/containers/:container/configs',
      required: ['site','container','notes','configPath','vendorCode'],
      multipart: true,
    },
    container: {
      type: "POST",
      urlFrag: 'sites/:site/containers',
      required: ['site','name','notes'],
    },
    default: {
      type: "POST",
      urlFrag: 'defaultconfig',
      required: ['configPath','vendorCode'],
      multipart: true,
    },
    module: {
      type: "POST",
      urlFrag: 'modules',
      required: ['modulePath','moduleName','version','notes'],
      multipart: true,
    },
    product: {
      type: "POST",
      urlFrag: 'sites/:site/containers/:container/products/:product',
      required: ['site','container','product','notes','configPath','vendorCode'],
      multipart: true,
    },
    site: {
      type: "POST",
      urlFrag: 'sites',
      required: ['clientId','name','notes'],
    },
  },
  get: {
    client: {
      type: "GET",
      urlFrag: 'clients/:clientId',
      required: ['clientId'],
    },
    code: {
      type: "GET",
      urlFrag: 'code/files/:codeId',
      required: ['codeId'],
    },
    config: {
      type: "GET",
      urlFrag: 'sites/:site/containers/:container/configs/files/:configTag',
      required: ['site','container','configTag'],
    },
    container: {
      type: "GET",
      urlFrag: 'sites/:site/containers/:container',
      required: ['site','container'],
    },
    default: {
      type: "GET",
      urlFrag: 'defaultconfig',
    },
    module: {
      type: "GET",
      urlFrag: 'modules/files/:md5',
      required: ['moduleMD5'],
    },
    site: {
      type: "GET",
      urlFrag: 'sites/:site',
      required: ['site'],
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
      urlFrag: 'sites/:site/containers/:container/configs',
      required: ['site','container'],
    },
    container: {
      type: "GET",
      urlFrag: 'sites/:site/containers',
      required: ['site'],
    },
    module: {
      type: "GET",
      urlFrag: 'modules',
    },
    product: {
      type: "GET",
      urlFrag: 'sites/:site/containers/:container/products',
      required: ['site','container'],
    },
    site: {
      type: "GET",
      urlFrag: 'sites',
    },
  },
  set: {
    code_invalid: {
      type: "POST",
      urlFrag: 'code/:codeId/invalid',
      required: ['codeId'],
    },
    code_latest: {
      type: "POST",
      urlFrag: 'code/:codeId/latest',
      required: ['codeId'],
    },
    config: {
      type: "POST",
      urlFrag: 'sites/:site/containers/:container/configs/:configTag',
      required: ['site','container','configTag','notes'],
    },
    product: {
      type: "POST",
      urlFrag: 'sites/:site/containers/:container/products/:product/:configTag',
      required: ['site','container','product','configTag','notes'],
    },
  },
};