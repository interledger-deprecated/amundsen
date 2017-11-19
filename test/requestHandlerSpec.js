const assert = require('chai').assert

const uuid = require('uuid/v4')
const PluginDummy = require('./helpers/dummyPlugin')
const WebSocket = require('ws')

const IlpPacket = require('ilp-packet')
const BtpPacket = require('btp-packet')

const TestnetNode = require('../src/index')
const sha256 = require('../src/sha256')
function base64url (buf) { return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }

function btpMessagePacket (protocolName, contentType, data, btpVersion) {
  const protocolData = [ { protocolName, contentType, data } ]
  return BtpPacket.serialize({
    type: BtpPacket.TYPE_MESSAGE,
    requestId: 1,
    data: (btpVersion === BtpPacket.BTP_VERSION_ALPHA ? protocolData : { protocolData })
  }, btpVersion)
}

// function btpAuthMessage (username, token, btpVersion) {
//   if (btpVersion === BtpPacket.BTP_VERSION_ALPHA) {
//     throw new Error('There was no auth message in btp version alpha')
//   }
//   return BtpPacket.serialize({
//     type: BtpPacket.TYPE_MESSAGE,
//     requestId: 0,
//     data: {
//       protocolData: [
//         { protocolName: 'auth', contentType: BtpPacket.MIME_TEXT_PLAIN_UTF8, data: Buffer.from([]) },
//         { protocolName: 'auth_username', contentType: BtpPacket.MIME_TEXT_PLAIN_UTF8, data: Buffer.from(username, 'utf8') },
//         { protocolName: 'auth_token', contentType: BtpPacket.MIME_TEXT_PLAIN_UTF8, data: Buffer.from(token, 'utf8') }
//       ]
//     }
//   }, btpVersion)
// }

function btpPreparePacket (data, btpVersion) {
  return BtpPacket.serialize({
    type: BtpPacket.TYPE_PREPARE,
    requestId: 2,
    data
  }, btpVersion)
}

function btpAcknowledge (requestId, btpVersion) {
  if (btpVersion === this.clientVersion1) {
    return BtpPacket.serialize({ type: BtpPacket.TYPE_ACK, requestId, data: [] }, btpVersion)
  } else {
    return BtpPacket.serialize({ type: BtpPacket.TYPE_RESPONSE, requestId, data: { protocolData: [] } }, btpVersion)
  }
}

function btpFulfillPacket (transferId, fulfillment, btpVersion) {
  return BtpPacket.serialize({
    type: BtpPacket.TYPE_FULFILL,
    requestId: 3,
    data: {
      transferId,
      fulfillment,
      protocolData: []
    }
  }, btpVersion)
}

describe('Request Handler', () => {
  beforeEach(function () {
    this.fulfillment = Buffer.from('1234*fulfillment1234*fulfillment', 'ascii')
    this.condition = sha256(this.fulfillment)
    this.plugin = new PluginDummy({
      prefix: 'test.dummy.',
      connector: 'test.dummy.connie',
      fulfillment: this.fulfillment
    })
    this.testnetNode = new TestnetNode({
      btp: {
        listen: 8000,
        initialBalancePerPeer: 10000,
        baseLedger: 'test.amundsen.',
        authCheck: function (username, token) {
          return (username === 'client2' && token === 'bar')
        }
      }
    })
    return this.testnetNode.addPlugin(this.plugin, Buffer.from([ 0, 0, 0, 0, 0, 0, 0, 1 ])).then(() => {
      return this.testnetNode.start()
    })
  })
  afterEach(function () {
    return this.testnetNode.stop()
  })

  describe('Quote By Source', () => {
    beforeEach(function () {
      this.client = new WebSocket('ws://localhost:8000/api/17q3/client1/foo')
      this.clientVersion = BtpPacket.BTP_VERSION_ALPHA

      this.message = {
        transferId: uuid(),
        amount: '1235',
        executionCondition: this.condition,
        expiresAt: new Date(new Date().getTime() + 100000),
        protocolData: [ {
          protocolName: 'ilp',
          contentType: BtpPacket.MIME_APPLICATION_OCTET_STREAM,
          data: IlpPacket.serializeIlpPayment({
            amount: '1234',
            account: 'test.dummy.client2.hi'
          })
        } ]
      }
      return new Promise(resolve => this.client.on('open', resolve)).then(() => {
        return this.client.send(btpMessagePacket(
            'ilp',
            BtpPacket.MIME_APPLICATION_OCTET_STREAM,
            IlpPacket.serializeIlqpBySourceRequest({
              destinationAccount: 'example.nexus.bob',
              sourceAmount: '9000000000',
              destinationHoldDuration: 3000
            }), this.clientVersion))
      })
    })
    afterEach(function () {
      return this.client.close()
    })

    it('should respond to quote request (17q3)', function (done) {
      this.client.on('message', (msg) => {
        const obj = BtpPacket.deserialize(msg, this.clientVersion)
        assert.deepEqual(obj, {
          type: BtpPacket.TYPE_RESPONSE
        })
        done()
      })
    })
  })
})
