const assert = require('chai').assert
const crypto = require('crypto')

const IlpPacket = require('ilp-packet')

const Quoter = require('../src/quoter')
const Forwarder = require('../src/forwarder')

describe('Forwarder', () => {
  beforeEach(function () {
    const fulfillment = Buffer.from('1234*fulfillmen1234*fulfillment', 'ascii')
    const executionCondition = crypto.createHash('sha256').update(fulfillment).digest()
    // console.log(fulfillment, executionCondition)

    this.fulfillment = fulfillment
    this.payment = IlpPacket.serializeIlpPayment({
      account: 'g.example.dest',
      amount: '4560'
    })
    this.transfer = {
      amount: 1234567891,
      expiresAt: new Date('9876-1-1 00:00'),
      executionCondition,
      ilp: this.payment.toString('base64')
    }

    this.quoter = new Quoter()
    this.forwarder = new Forwarder(this.quoter, {
      'this one': {
        sendTransfer (transfer) {
          return Promise.resolve(fulfillment)
        }
      }
    })
    // 12345 = 48 * 256 + 57
    // 67890 = 1 * 65536 + 9 * 256 + 50
    this.curveBuf = Buffer.from([
      // each UInt64 is 8 bytes:
      // [0, 0] :
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      // [12345, 67890] :
      0, 0, 0, 0, 0, 0, 48, 57,
      0, 0, 0, 0, 0, 1, 9, 50
    ])
    this.quoter.setCurve('g.example.', this.curveBuf, 'this one')
  })

  describe('forward', () => {
    it('should forward the payment', function () {
      return this.forwarder.forward(this.transfer).then(result => {
        assert.deepEqual(result, this.fulfillment)
      })
    })
  })
})
