'use strict'
const IlpConnector = require('ilp-connector')

module.exports.launch = function (bmpConfig) {
  const connector = IlpConnector.createApp({
    ilpAddress: 'test.amundsen.bmp',
    accounts: {
      restOfAmundsen: {
        relation: 'child',
        assetScale: 6,
        assetCode: 'XRP',
        plugin: 'ilp-plugin-mirror-v1',
        options: {
          info: { prefix: 'test.amundsen.' },
          account: 'test.amundsen.bmp',
          balance: '0'
        }
      },
      btp18q1: {
        relation: 'child',
        assetScale: 6,
        assetCode: 'XRP',
        plugin: 'ilp-plugin-mini-accounts',
        options: bmpConfig
      }
    },
    backend: 'one-to-one',
    spread: 0,
    storePath: './data'
  })
  return connector.listen().then(() => {
    return connector.getPlugin('restOfAmundsen').oldPlugin.mirror)
  })
}
