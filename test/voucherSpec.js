const assert = require('chai').assert
const uuid = require('uuid/v4')
const PluginDummy = require('./helpers/dummyPlugin')
const WebSocket = require('ws')

const IlpPacket = require('ilp-packet')
const BtpPacket = require('btp-packet')

const TestnetNode = require('../src/index')
const sha256 = require('../src/sha256')

function btpMessagePacket(protocolName, contentType, data, btpVersion) {
  const protocolData = [ { protocolName, contentType, data } ]
  return BtpPacket.serialize({
    type: BtpPacket.TYPE_MESSAGE,
    requestId: 1,
    data: (btpVersion === BtpPacket.BTP_VERSION_ALPHA ? protocolData : { protocolData })
  }, btpVersion)
}

describe('Vouching System', () => {
  beforeEach(function () {
    this.testnetNode = new TestnetNode()
    return this.testnetNode.addPlugin(new PluginDummy({
      prefix: 'test.dummy.',
      connector: 'test.dummy.connie'
    })).then(() => {
      this.testnetNode.plugins['test.dummy.'].fulfillment = Buffer.from('1234*fulfillment1234*fulfillment', 'ascii')
      return this.testnetNode.start()
    })
  })
  afterEach(function () {
    return this.testnetNode.stop()
  })

  describe('two clients (17q3)', () => {
    beforeEach(function () {
      this.client1 = new WebSocket('ws://localhost:8000/client1/foo')
      this.client2 = new WebSocket('ws://localhost:8000/client2/bar')
      return Promise.all([
        new Promise(resolve => this.client1.on('open', resolve)),
        new Promise(resolve => this.client2.on('open', resolve)),
      ]).then(() => {
        console.log('both clients open!')
        return this.client1.send(btpMessagePacket(
            'vouch',
            BtpPacket.MIME_TEXT_PLAIN_UTF8,
            Buffer.concat([
              Buffer.from([0, 'test.dummy.client1'.length]),
              Buffer.from('test.dummy.client1', 'ascii')
            ]), BtpPacket.BTP_VERSION_ALPHA))
      })
    })
    afterEach(function () {
      // return this.client1.close()
      return Promise.all([ this.client1.close(), this.client2.close() ])
    })

    it('should deliver to dummy ledger', function () {
      const fulfillment = Buffer.from('1234*fulfillment1234*fulfillment', 'ascii')
      const condition = sha256(fulfillment)

      // console.log('setting up test', fulfillment, condition)
      const packet = IlpPacket.serializeIlpPayment({
        amount: '1234',
        account: 'test.dummy.client2.hi'
      })
      this.testnetNode.peers.ledger_dummy.plugin.fulfillment = fulfillment
      const transfer = {
        // transferId will be added  by Peer#conditional(transfer, protocolData)
        amount: 1235,
        executionCondition: condition,
        expiresAt: new Date(new Date().getTime() + 100000)
      }
      // console.log('test prepared!', transfer, this.testnetNode.peers.ledger_dummy.plugin)
      return this.client1.peers.upstream_wslocalhost8000.interledgerPayment(transfer, packet).then(result => {
        assert.deepEqual(result, fulfillment)
        assert.deepEqual(this.testnetNode.peers.ledger_dummy.plugin.transfers[0], {
          id: this.testnetNode.peers.ledger_dummy.plugin.transfers[0].id,
          from: 'test.dummy.dummy-account',
          to: 'test.dummy.client2',
          ledger: 'test.dummy.',
          amount: '1234',
          ilp: packet.toString('base64'),
          noteToSelf: {},
          executionCondition: condition.toString('base64'),
          expiresAt: this.testnetNode.peers.ledger_dummy.plugin.transfers[0].expiresAt,
          custom: {}
        })
        // console.log(this.client1)
        assert.equal(this.testnetNode.peers['downstream_' + this.client1.config.btp.name].btp.balance, 8765)
        assert.equal(this.testnetNode.peers['downstream_' + this.client2.config.btp.name].btp.balance, 10000)
      })
    })

    it('should reject from insufficiently vouched wallets on dummy ledger', function (done) {
      const fulfillment = Buffer.from('1234*fulfillment1234*fulfillment', 'ascii')
      const condition = sha256(fulfillment)

      // console.log('setting up test', fulfillment, condition)
      const packet = IlpPacket.serializeIlpPayment({
        amount: '12345',
        account: 'peer.testing.server.downstream_client2.hi'
      })
      this.client2.knowFulfillment(condition, fulfillment)

      // This is ledger plugin interface format, will be used in incoming_prepare event
      // to VirtualPeer:
      const lpiTransfer = {
        id: uuid(),
        from: 'test.dummy.client1',
        to: 'test.dummy.server',
        ledger: 'test.dummy.',
        amount: '12345',
        ilp: packet.toString('base64'),
        noteToSelf: {},
        executionCondition: condition.toString('base64'),
        expiresAt: new Date(new Date().getTime() + 100000),
        custom: {}
      }
      this.testnetNode.peers.ledger_dummy.plugin.successCallback = (transferId, fulfillmentBase64) => {
        done(new Error('should not have succeeded'))
      }
      this.testnetNode.peers.ledger_dummy.plugin.failureCallback = (transferId, rejectionReasonObj) => {
        assert.equal(rejectionReasonObj.code, 'L53')
        assert.equal(this.testnetNode.peers['downstream_' + this.client1.config.btp.name].btp.balance, 10000)
        assert.equal(this.testnetNode.peers['downstream_' + this.client2.config.btp.name].btp.balance, 10000)
        done()
      }
      this.testnetNode.peers.ledger_dummy.plugin.handlers.incoming_prepare(lpiTransfer)
    })

    it('should accept from vouched wallets on dummy ledger', function (done) {
      const fulfillment = Buffer.from('1234*fulfillment1234*fulfillment', 'ascii')
      const condition = sha256(fulfillment)

      // console.log('setting up test', fulfillment, condition)
      const packet = IlpPacket.serializeIlpPayment({
        amount: '1234',
        account: 'peer.testing.server.downstream_client2.hi'
      })
      this.client2.knowFulfillment(condition, fulfillment)

      // This is ledger plugin interface format, will be used in incoming_prepare event
      // to VirtualPeer:
      const lpiTransfer = {
        id: uuid(),
        from: 'test.dummy.client1',
        to: 'test.dummy.server',
        ledger: 'test.dummy.',
        amount: '1234',
        ilp: packet.toString('base64'),
        noteToSelf: {},
        executionCondition: condition.toString('base64'),
        expiresAt: new Date(new Date().getTime() + 100000),
        custom: {}
      }
      this.testnetNode.peers.ledger_dummy.plugin.successCallback = (transferId, fulfillmentBase64) => {
        assert.equal(transferId, lpiTransfer.id)
        assert.deepEqual(Buffer.from(fulfillmentBase64, 'base64'), fulfillment)
        assert.equal(this.testnetNode.peers['downstream_' + this.client1.config.btp.name].btp.balance, 10000)
        assert.equal(this.testnetNode.peers['downstream_' + this.client2.config.btp.name].btp.balance, 11234)
        done()
      }
      this.testnetNode.peers.ledger_dummy.plugin.failureCallback = (transferId, rejectionReasonObj) => {
        done(rejectionReasonObj)
      }
      this.testnetNode.peers.ledger_dummy.plugin.handlers.incoming_prepare(lpiTransfer)
    })
  })
})
