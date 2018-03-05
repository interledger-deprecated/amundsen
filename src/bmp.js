'use strict'
const IlpConnector = require('ilp-connector')
const HDWalletProvider = require('truffle-hdwallet-provider')
const provider = new HDWalletProvider(process.env.ETH_SECRET, process.env.ETH_PROVIDER)

module.exports.makeBmpPlugin = function (servers) {
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
      'port-1801-is-deprecated-see-https-github-com-interledger-interledger-wiki-amundsen': { // legacy port 1801
        relation: 'child',
        assetScale: 6,
        assetCode: 'XRP',
        plugin: 'ilp-plugin-xrp-asym-server',
        options: {
          wsOpts: {
            server: servers[4]
          },
          // XRP credentials of the server
          address: 'rE75PyLPYbCGJ4SUiDLvtaCsuRXMd9x5ba',
          secret: 'snRbuChYGPKNzMxr1wrxUyLRXuREc',

          // Rippled server for the server to use
          xrpServer: 'wss://s.altnet.rippletest.net:51233'
        }
      },
      btp18q1trust: {
        relation: 'child',
        assetScale: 6,
        assetCode: 'XRP',
        plugin: 'ilp-plugin-mini-accounts',
        options: {
          wsOpts: {
            server: servers[0]
          },
          ledgerPrefixForSendMoney: 'test.amundsen.bmp.btp18q1trust.',

          // Max amount to be unsecured at any one time
          maxBalance: 1000000
        },
        balance: {
          maximum: 'Infinity',
          settleThreshold: '1',
          settleTo: '0'
        }
      },
      btp18q1xrp: {
        relation: 'child',
        assetScale: 6,
        assetCode: 'XRP',
        plugin: 'ilp-plugin-xrp-asym-server',
        options: {
          wsOpts: {
            server: servers[1]
          },
          // XRP credentials of the server
          address: 'rE75PyLPYbCGJ4SUiDLvtaCsuRXMd9x5ba',
          secret: 'snRbuChYGPKNzMxr1wrxUyLRXuREc',

          // Rippled server for the server to use
          xrpServer: 'wss://s.altnet.rippletest.net:51233'
        }
      },
      btp18q1lnd: {
        relation: 'child',
        assetScale: 6,
        assetCode: 'BTC',
        plugin: 'ilp-plugin-lnd-asym-server',
        options: {
          wsOpts: {
            server: servers[2]
          },
          lndTlsCertPath: '/root/.lnd/tls.cert',
          maxInFlight: 10000,
          lndUri: 'localhost:10009'
        }
      },
      btp18q1eth: {
        relation: 'child',
        assetScale: 6,
        assetCode: 'ETH',
        plugin: 'ilp-plugin-ethereum-asym-server',
        options: {
          wsOpts: {
            server: servers[3]
          },
          account: '0x' + provider.address.substring(2).toLowerCase(),
          provider
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
    console.log(connector.getPlugin('restOfAmundsen').oldPlugin.isConnected(), connector.getPlugin('btp18q1trust').isConnected())
    return {
      restOfAmundsen: connector.getPlugin('restOfAmundsen').oldPlugin.mirror,
      httpHead: connector.getPlugin('httpHead'),
      httpOer: connector.getPlugin('httpOer')
    }
  })
}
