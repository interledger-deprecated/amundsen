'use strict'
const IlpConnector = require('ilp-connector')

module.exports.makeBmpPlugin = function (server) {
console.log('creating app!')
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
        options: {
          wsOpts: {
            server
          }
        }
      },
      httpHead: {
        relation: 'child',
        assetScale: 9,
        assetCode: 'USD',
        plugin: 'ilp-plugin-http-head',
        options: { }
      },
      httpOer: {
        relation: 'child',
        assetScale: 9,
        assetCode: 'USD',
        plugin: 'ilp-plugin-http-oer',
        options: { }
      }
    },
    backend: 'one-to-one',
    spread: 0,
    storePath: './data'
  })
console.log('app created!')
  return connector.listen().then(() => {
    console.log(connector.getPlugin('restOfAmundsen').oldPlugin.isConnected(), connector.getPlugin('btp18q1').isConnected())
    return {
      restOfAmundsen: connector.getPlugin('restOfAmundsen').oldPlugin.mirror,
      httpHead: connector.getPlugin('httpHead'),
      httpOer: connector.getPlugin('httpOer')
    }
  })
}
