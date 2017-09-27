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

function btpAuthMessage(username, token, btpVersion) {
  return BtpPacket.serialize({
    type: BtpPacket.TYPE_MESSAGE,
    requestId: 0,
    data: {
      protocolData: [
        { protocolName: 'auth', contentType: BtpPacket.MIME_TEXT_PLAIN_UTF8, data: Buffer.from([]) },
        { protocolName: 'auth_username', contentType: BtpPacket.MIME_TEXT_PLAIN_UTF8, data: Buffer.from(username, 'utf8') },
        { protocolName: 'auth_token', contentType: BtpPacket.MIME_TEXT_PLAIN_UTF8, data: Buffer.from(token, 'utf8') }
      ]
    }
  }, btpVersion)
}

function btpPreparePacket(data, btpVersion) {
  return BtpPacket.serialize({
    type: BtpPacket.TYPE_PREPARE,
    requestId: 2,
    data
  }, btpVersion)
}

function btpAcknowledge(requestId, btpVersion) {
  if (btpVersion === BtpPacket.BTP_VERSION_ALPHA) {
    return BtpPacket.serialize({ type: BtpPacket.TYPE_ACK, requestId, data: [] }, btpVersion)
  } else {
    return BtpPacket.serialize({ type: BtpPacket.TYPE_RESPONSE, requestId, data: { protocolData: [] } }, btpVersion)
  }
}

function btpFulfillPacket(transferId, fulfillment, btpVersion) {
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

describe('Vouching System', () => {
  beforeEach(function () {
    this.fulfillment = Buffer.from('1234*fulfillment1234*fulfillment', 'ascii')
    this.condition = sha256(this.fulfillment)
    this.plugin = new PluginDummy({
      prefix: 'test.dummy.',
      connector: 'test.dummy.connie',
      fulfillment: this.fulfillment
    })
    this.testnetNode = new TestnetNode()
    return this.testnetNode.addPlugin(this.plugin).then(() => {
      return this.testnetNode.start()
    })
  })
  afterEach(function () {
    return this.testnetNode.stop()
  })

  describe('two clients', () => {
    beforeEach(function () {
      this.client1 = new WebSocket('ws://localhost:8000/api/17q3/client1/foo')
      this.client2 = new WebSocket('ws://localhost:8000/api/17q4')
      this.transfer = {
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
      // These are ledger plugin interface format, will be used in incoming_prepare event:
      this.lpiTransferTo1 = {
        id: uuid(),
        from: 'test.dummy.client1',
        to: 'test.dummy.server',
        ledger: 'test.dummy.',
        amount: '1234',
        ilp: IlpPacket.serializeIlpPayment({
          amount: '1234',
          account: 'peer.testing.server.downstream_client1.hi'
        }).toString('base64'),
        noteToSelf: {},
        executionCondition: this.condition.toString('base64'),
        expiresAt: new Date(new Date().getTime() + 100000),
        custom: {}
      }
      this.lpiTransferTooBig = {
        id: uuid(),
        from: 'test.dummy.client1',
        to: 'test.dummy.server',
        ledger: 'test.dummy.',
        amount: '12345',
        ilp: IlpPacket.serializeIlpPayment({
          amount: '1234',
          account: 'peer.testing.server.downstream_client1.hi'
        }).toString('base64'),
        noteToSelf: {},
        executionCondition: this.condition.toString('base64'),
        expiresAt: new Date(new Date().getTime() + 100000),
        custom: {}
      }
      this.lpiTransferTo2 = {
        id: uuid(),
        from: 'test.dummy.client1',
        to: 'test.dummy.server',
        ledger: 'test.dummy.',
        amount: '1234',
        ilp: IlpPacket.serializeIlpPayment({
          amount: '1234',
          account: 'peer.testing.server.downstream_client2.hi'
        }).toString('base64'),
        noteToSelf: {},
        executionCondition: this.condition.toString('base64'),
        expiresAt: new Date(new Date().getTime() + 100000),
        custom: {}
      }
      return Promise.all([
        new Promise(resolve => this.client1.on('open', resolve)),
        new Promise(resolve => this.client2.on('open', resolve)),
      ]).then(() => {
        return this.client2.send(btpAuthMessage('client2', 'bar'))
      }).then(() => {
        console.log('both clients open!')
        return Promise.all([
          this.client1.send(btpMessagePacket(
              'vouch',
              BtpPacket.MIME_TEXT_PLAIN_UTF8,
              Buffer.concat([
                Buffer.from([0, 'test.dummy.client1'.length]),
                Buffer.from('test.dummy.client1', 'ascii')
              ]), BtpPacket.BTP_VERSION_ALPHA)),
          this.client2.send(btpMessagePacket(
              'vouch',
              BtpPacket.MIME_TEXT_PLAIN_UTF8,
              Buffer.concat([
                Buffer.from([0, 'test.dummy.client1'.length]),
                Buffer.from('test.dummy.client1', 'ascii')
              ]), BtpPacket.BTP_VERSION_1))
        ])
      })
    })
    afterEach(function () {
      // return this.client1.close()
      return Promise.all([ this.client1.close(), this.client2.close() ])
    })

    it('should deliver to dummy ledger (17q3)', function (done) {
      let acked = false
      this.client1.on('message', (msg) => {
        const obj = BtpPacket.deserialize(msg, BtpPacket.BTP_VERSION_ALPHA)
        console.log('client1 sees', obj)
        if (obj.type === BtpPacket.TYPE_ACK) {
          acked = true
        } else {
          assert.equal(acked, true)
          assert.deepEqual(this.plugin.transfers[0], {
            id: this.plugin.transfers[0].id,
            from: 'test.dummy.dummy-account',
            to: 'test.dummy.client2',
            ledger: 'test.dummy.',
            amount: '1234',
            ilp: packet.toString('base64'),
            noteToSelf: {},
            executionCondition: condition.toString('base64'),
            expiresAt: this.plugin.transfers[0].expiresAt,
            custom: {}
          })
          // console.log(this.client1)
          assert.equal(this.testnetNode.getPlugin('downstream_' + this.client1.config.btp.name).btp.balance, 8765)
          assert.equal(this.testnetNode.peers('downstream_' + this.client2.config.btp.name).btp.balance, 10000)
          done()
        }
      })
      this.client1.send(btpPreparePacket(this.transfer, BtpPacket.BTP_VERSION_ALPHA))
    })

   //   it('should deliver to dummy ledger (17q4)', function (done) {
   //     let acked = false
   //     this.client2.on('message', (msg) => {
   //       const obj = BtpPacket.deserialize(msg, BtpPacket.BTP_VERSION_1)
   //       console.log('client2 sees', obj)
   //       if (obj.type === BtpPacket.TYPE_RESPONSE) {
   //         acked = true
   //       } else {
   //         assert.equal(acked, true)
   //         assert.deepEqual(this.plugin.transfers[0], {
   //           id: this.plugin.transfers[0].id,
   //           from: 'test.dummy.dummy-account',
   //           to: 'test.dummy.client2',
   //           ledger: 'test.dummy.',
   //           amount: '1234',
   //           ilp: packet.toString('base64'),
   //           noteToSelf: {},
   //           executionCondition: condition.toString('base64'),
   //           expiresAt: this.plugin.transfers[0].expiresAt,
   //           custom: {}
   //         })
   //         assert.equal(this.testnetNode.getPlugin('downstream_' + this.client1.config.btp.name).btp.balance, 8765)
   //         assert.equal(this.testnetNode.peers('downstream_' + this.client2.config.btp.name).btp.balance, 10000)
   //         done()
   //       }
   //     })
   //     this.client2.send(btpPreparePacket(this.transfer, BtpPacket.BTP_VERSION_1))
   //   })
      
   //   it('should reject from insufficiently vouched wallets on dummy ledger', function (done) {
   //     this.plugin.successCallback = (transferId, fulfillmentBase64) => {
   //       done(new Error('should not have succeeded'))
   //     }
   //     this.plugin.failureCallback = (transferId, rejectionReasonObj) => {
   //       assert.equal(rejectionReasonObj.code, 'L53')
   //       assert.equal(this.testnetNode.peers['downstream_' + this.client1.config.btp.name].btp.balance, 10000)
   //       assert.equal(this.testnetNode.peers['downstream_' + this.client2.config.btp.name].btp.balance, 10000)
   //       done()
   //     }
   //     this.plugin.handlers.incoming_prepare(this.lpiTransferTooBig)
   //   })
      
   //   it('should accept from vouched wallets on dummy ledger (17q3)', function (done) {
   //     this.client1.on('message', (msg) => {
   //       const obj = BtpPacket.deserialize(msg, BtpPacket.BTP_VERSION_ALPHA)
   //       console.log('client1 sees', obj)
   //       if (obj.type === BtpPacket.TYPE_PREPARE) {
   //         this.client2.send(btpAcknowledge(obj.requestId, BtpPacket.BTP_VERSION_ALPHA))
   //         this.client2.send(btpFulfillPacket(obj.data.transferId, this.fulfillment, BtpPacket.BTP_VERSION_ALPHA))
   //       }
   //     })
      
   //     this.plugin.successCallback = (transferId, fulfillmentBase64) => {
   //       assert.equal(transferId, this.lpiTransferTo1.id)
   //       assert.deepEqual(Buffer.from(fulfillmentBase64, 'base64'), fulfillment)
   //       assert.equal(this.testnetNode.peers['downstream_' + this.client1.config.btp.name].btp.balance, 11234)
   //       assert.equal(this.testnetNode.peers['downstream_' + this.client2.config.btp.name].btp.balance, 10000)
   //       done()
   //     }
   //     this.plugin.failureCallback = (transferId, rejectionReasonObj) => {
   //       done(rejectionReasonObj)
   //     }
   //     this.plugin.handlers.incoming_prepare(this.lpiTransferTo1)
   //   })
      
   //   it('should accept from vouched wallets on dummy ledger (17q4)', function (done) {
   //     this.client2.on('message', (msg) => {
   //       const obj = BtpPacket.deserialize(msg, BtpPacket.BTP_VERSION_1)
   //       console.log('client2 sees', obj)
   //       if (obj.type === BtpPacket.TYPE_PREPARE) {
   //         this.client2.send(btpAcknowledge(obj.requestId, BtpPacket.BTP_VERSION_1))
   //         this.client2.send(btpFulfillPacket(obj.data.transferId, this.fulfillment, BtpPacket.BTP_VERSION_1))
   //       }
   //     })
      
   //     this.plugin.successCallback = (transferId, fulfillmentBase64) => {
   //       assert.equal(transferId, this.lpiTransferTo2.id)
   //       assert.deepEqual(Buffer.from(fulfillmentBase64, 'base64'), fulfillment)
   //       assert.equal(this.testnetNode.peers['downstream_' + this.client1.config.btp.name].btp.balance, 10000)
   //       assert.equal(this.testnetNode.peers['downstream_' + this.client2.config.btp.name].btp.balance, 11234)
   //       done()
   //     }
   //     this.plugin.failureCallback = (transferId, rejectionReasonObj) => {
   //       done(rejectionReasonObj)
   //     }
   //     this.plugin.handlers.incoming_prepare(this.lpiTransferTo2)
   //   })
  })
})
