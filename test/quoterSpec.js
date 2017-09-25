const assert = require('chai').assert

const Quoter = require('../src/quoter')

describe('Quoter', () => {
  beforeEach(function () {
    this.quoter = new Quoter()
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

  describe('answerLiquidity', () => {
    it('should return the curve', function () {
      return this.quoter.answerLiquidity({
        destinationAccount: 'g.example.asdf'
      }).then(result => {
        assert.deepEqual(result, {
          liquidityCurve: this.curveBuf,
          appliesToPrefix: 'g.example.',
          sourceHoldDuration: 15000,
          expiresAt: result.expiresAt
        })
        assert.equal(result.expiresAt instanceof Date, true)
      })
    })
  })

  describe('answerBySource', () => {
    it('should find amount at point', function () {
      return this.quoter.answerBySource({
        destinationAccount: 'g.example.asdf',
        sourceAmount: '12345'
      }).then(result => {
        assert.deepEqual(result, {
          destinationAmount: '67890',
          sourceHoldDuration: 3000
        })
      })
    })
  })

  describe('answerByDest', () => {
    it('should find amount at point', function () {
      return this.quoter.answerByDest({
        destinationAccount: 'g.example.asdf',
        destinationAmount: '67890'
      }).then(result => {
        assert.deepEqual(result, {
          sourceAmount: '12345',
          sourceHoldDuration: 3000
        })
      })
    })
  })
})
