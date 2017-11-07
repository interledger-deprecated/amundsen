const IlpPacket = require('ilp-packet')
const uuid = require('uuid/v4')
function base64url (buf) { return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }

function toLpi(packet, msg) {
  return {
    id: uuid(),
    from: msg.to,
    to: msg.from,
    ledger: msg.ledger,
    ilp: base64url(packet),
    custom: {}
  }
}

class RequestHandler {
  constructor (main) {
    this.main = main
  }

  onPlugin (prefix) {
    this.main.getPlugin(prefix).registerRequestHandler(msg => {
      const ilpReq = IlpPacket.deserializeIlpPacket(Buffer.from(msg.ilp, 'base64'))
      switch (ilpReq.typeString) {
        case 'ilqp_by_source_request':
          return this.main.quoter.answerBySource(ilpReq.data).then(ilpRes => toLpi(IlpPacket.serializeIlqpBySourceResponse(ilpRes), msg))
        case 'ilqp_by_destination_request':
          return this.main.quoter.answerByDest(ilpReq.data).then(ilpRes => toLpi(IlpPacket.serializeIlqpByDestinationResponse(ilpRes), msg))
        case 'ilqp_liquidity_request':
          return this.main.quoter.answerLiquidity(ilpReq.data).then(ilpRes => toLpi(IlpPacket.serializeIlqpLiquidityResponse(ilpRes), msg))
      }
      return Promise.resolve()
    })
  }
}

module.exports = RequestHandler
