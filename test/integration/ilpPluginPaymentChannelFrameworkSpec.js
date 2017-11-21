const assert = require('chai').assert

const uuid = require('uuid/v4')
const PluginDummy = require('../helpers/dummyPlugin')
const WebSocket = require('ws')

const IlpPacket = require('ilp-packet')
const BtpPacket = require('btp-packet')

const TestnetNode = require('../../src/index')

const HostedLedgerPlugin = require('ilp-plugin-payment-channel-framework')

describe('Connect ilp-plu-pay-cha-fra to 17q4 interface', function () {
  beforeEach(function () {
    this.testnetNode = new TestnetNode({
      btp: {
        listen: 8100,
        initialBalancePerPeer: 10000,
        baseLedger: 'test.amundsen.',
        authCheck: function (username, token) {
          return (username === 'foo' && token === 'bar')
        }
      }
    })
    this.plugin = new HostedLedgerPlugin({
      server: `btp+ws://foo:bar@localhost:8100/api/17q4`
    })
  })
  it('should connect and disconnect', function() {
    return this.testnetNode.start().then(() => {
      return this.plugin.connect()
    }).then(() => {
      return this.plugin.disconnect()
    })
  })
})

