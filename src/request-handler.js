const IlpPacket = require('ilp-packet')
const uuid = require('uuid/v4')
function base64url (buf) { return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }

function toIlpError(err, msg) {
  if (err.message === 'no curve found') {
    return IlpPacket.serializeIlpError({
      code: 'F02',
      name: 'Unreachable',
      triggeredBy: msg.to,
      forwardedBy: [
      ],
      triggeredAt: new Date(),
      data: JSON.stringify({
      })
    })
  }
  console.error('unknown error', err.message)

  return IlpPacket.serializeIlpError({
    code: 'T00',
    name: 'Internal Error',
    triggeredBy: msg.to,
    forwardedBy: [
    ],
    triggeredAt: new Date(),
    data: JSON.stringify({
    })
  })
  
}

function toLpi(packet, custom, msg) {
  let obj = {
    id: uuid(),
    from: msg.to,
    to: msg.from,
    ledger: msg.ledger,
    custom
  }
  if (packet) {
    obj.ilp = base64url(packet)
  }
  return obj
}

class RequestHandler {
  constructor (main) {
    this.main = main
  }

  onPlugin (prefix) {
    this.main.getPlugin(prefix).registerRequestHandler(msg => {
      if (msg.ilp) {
        const ilpReq = IlpPacket.deserializeIlpPacket(Buffer.from(msg.ilp, 'base64'))
        switch (ilpReq.typeString) {
          case 'ilqp_by_source_request':
            return this.main.quoter.answerBySource(ilpReq.data).then(ilpRes => toLpi(IlpPacket.serializeIlqpBySourceResponse(ilpRes), {}, msg), err => toLpi(toIlpError(err, msg), {}, msg))
          case 'ilqp_by_destination_request':
            return this.main.quoter.answerByDest(ilpReq.data).then(ilpRes => toLpi(IlpPacket.serializeIlqpByDestinationResponse(ilpRes), {}, msg), err => toLpi(toIlpError(err, msg), {}, msg))
          case 'ilqp_liquidity_request':
            return this.main.quoter.answerLiquidity(ilpReq.data).then(ilpRes => toLpi(IlpPacket.serializeIlqpLiquidityResponse(ilpRes), {}, msg), err => toLpi(toIlpError(err. msg), {}, msg))
        }
      } else if (msg.custom) {
        return Promise.resolve(toLpi(undefined, { error: 'not implemented yet' }, msg))
      }
      return Promise.resolve(toLpi(undefined, { error: 'request had neither ilp nor custom' }, msg))
    })
  }
}

module.exports = RequestHandler
