const assert = require('chai').assert
const uuid = require('uuid/v4')

const IlpPacket = require('ilp-packet')

const IlpNode = require('../src/index')
const sha256 = require('../src/sha256')

describe('Vouching System', () => {
  beforeEach(function () {
    this.ilpNode = new IlpNode({
      btp: {
        listen: 8000,
        name: 'server',
        initialBalancePerPeer: 10000,
        upstreams: []
      },
      xrp: {
        secret: 'shRm6dnkLMzTxBUMgCy6bB6jweS3X',
        server: 'wss://s.altnet.rippletest.net:51233',
        prefix: 'test.crypto.xrp.'
      },
      dummy: {
        prefix: 'test.dummy.',
        connector: 'test.dummy.connie'
      }
    })
    this.ilpNode.peers.ledger_dummy.fulfillment = Buffer.from('1234*fulfillment1234*fulfillment', 'ascii')
    return this.ilpNode.start()
  })
  afterEach(function () {
    return this.ilpNode.stop()
  })

  describe('two clients', () => {
    beforeEach(function () {
      this.client1 = new IlpNode({ btp: { name: 'client1', upstreams: [ { url: 'ws://localhost:8000', token: 'foo' } ] } })
      this.client2 = new IlpNode({ btp: { name: 'client2', upstreams: [ { url: 'ws://localhost:8000', token: 'bar' } ] } })
      // return this.client1.open('ws://localhost:8000/')
      return Promise.all([ this.client1.start(), this.client2.start() ]).then(() => {
        const packet = Buffer.concat([
          Buffer.from([0, 'test.dummy.client1'.length]),
          Buffer.from('test.dummy.client1', 'ascii')
        ])
        return this.client1.peers.upstream_wslocalhost8000.btp.unpaid('vouch', packet)
      })
    })
    afterEach(function () {
      // return this.client1.close()
      return Promise.all([ this.client1.stop(), this.client2.stop() ])
    })

    it('should deliver to dummy ledger', function () {
      const fulfillment = Buffer.from('1234*fulfillment1234*fulfillment', 'ascii')
      const condition = sha256(fulfillment)

      // console.log('setting up test', fulfillment, condition)
      const packet = IlpPacket.serializeIlpPayment({
        amount: '1234',
        account: 'test.dummy.client2.hi'
      })
      this.ilpNode.peers.ledger_dummy.plugin.fulfillment = fulfillment
      const transfer = {
        // transferId will be added  by Peer#conditional(transfer, protocolData)
        amount: 1235,
        executionCondition: condition,
        expiresAt: new Date(new Date().getTime() + 100000)
      }
      // console.log('test prepared!', transfer, this.ilpNode.peers.ledger_dummy.plugin)
      return this.client1.peers.upstream_wslocalhost8000.interledgerPayment(transfer, packet).then(result => {
        assert.deepEqual(result, fulfillment)
        assert.deepEqual(this.ilpNode.peers.ledger_dummy.plugin.transfers[0], {
          id: this.ilpNode.peers.ledger_dummy.plugin.transfers[0].id,
          from: 'test.dummy.dummy-account',
          to: 'test.dummy.client2',
          ledger: 'test.dummy.',
          amount: '1234',
          ilp: packet.toString('base64'),
          noteToSelf: {},
          executionCondition: condition.toString('base64'),
          expiresAt: this.ilpNode.peers.ledger_dummy.plugin.transfers[0].expiresAt,
          custom: {}
        })
        // console.log(this.client1)
        assert.equal(this.ilpNode.peers['downstream_' + this.client1.config.btp.name].btp.balance, 8765)
        assert.equal(this.ilpNode.peers['downstream_' + this.client2.config.btp.name].btp.balance, 10000)
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
      this.ilpNode.peers.ledger_dummy.plugin.successCallback = (transferId, fulfillmentBase64) => {
        done(new Error('should not have succeeded'))
      }
      this.ilpNode.peers.ledger_dummy.plugin.failureCallback = (transferId, rejectionReasonObj) => {
        assert.equal(rejectionReasonObj.code, 'L53')
        assert.equal(this.ilpNode.peers['downstream_' + this.client1.config.btp.name].btp.balance, 10000)
        assert.equal(this.ilpNode.peers['downstream_' + this.client2.config.btp.name].btp.balance, 10000)
        done()
      }
      this.ilpNode.peers.ledger_dummy.plugin.handlers.incoming_prepare(lpiTransfer)
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
      this.ilpNode.peers.ledger_dummy.plugin.successCallback = (transferId, fulfillmentBase64) => {
        assert.equal(transferId, lpiTransfer.id)
        assert.deepEqual(Buffer.from(fulfillmentBase64, 'base64'), fulfillment)
        assert.equal(this.ilpNode.peers['downstream_' + this.client1.config.btp.name].btp.balance, 10000)
        assert.equal(this.ilpNode.peers['downstream_' + this.client2.config.btp.name].btp.balance, 11234)
        done()
      }
      this.ilpNode.peers.ledger_dummy.plugin.failureCallback = (transferId, rejectionReasonObj) => {
        done(rejectionReasonObj)
      }
      this.ilpNode.peers.ledger_dummy.plugin.handlers.incoming_prepare(lpiTransfer)
    })
  })
})
