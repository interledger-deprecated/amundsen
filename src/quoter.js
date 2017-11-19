// This is a simplification of https://github.com/interledgerjs/ilp-routing/blob/master/src/lib/prefix-map.js

function Quoter () {
  this.curves = {}
}

// TODO: use BigNumber here
function findPoint (val, from, to, curveBuf) {
  let cursor = 0
  let prev = [0, 0]
  let next = [0, 0]
  while (next[from] < val) {
    if (cursor + 15 >= curveBuf.length) {
      throw new Error('amount lies past last curve point')
    }
    // 16 bytes define 2 UInt64's for one curve point:
    // x:  0  1  2  3      4  5  6  7
    // y:  8  9 10 11     12 13 14 15
    const readX = curveBuf[cursor + 7] + 256 * (curveBuf[cursor + 6] + 256 * (curveBuf[cursor + 5] + 256 * (curveBuf[cursor + 4])))
    const readY = curveBuf[cursor + 15] + 256 * (curveBuf[cursor + 14] + 256 * (curveBuf[cursor + 13] + 256 * (curveBuf[cursor + 12])))
    prev = next
    next = [ readX, readY ]
    cursor += 16
  }
  let perc = (val - prev[from]) / (next[from] - prev[from])
  return (prev[to] + perc * (next[to] - prev[to]))
}

function sourceToDest (x, curve) {
  return findPoint(x, 0, 1, curve)
}

function destToSource (y, curve) {
  return findPoint(y, 1, 0, curve)
}

function makeCurve(rate) {
  const zero = Buffer.from([ 0, 0, 0, 0, 0, 0, 0, 0 ])
  const maxSourceAmount = Buffer.from([ 0, 0, 0, 0, 0, 1, 0, 0 ]) // 2^16
  const maxDestAmount = Buffer.concat([ rate.slice(2), Buffer.from([ 0, 0 ]) ]) // rate times 2^16
  return Buffer.concat([ zero, zero, maxSourceAmount, maxDestAmount ])
}

Quoter.prototype = {
  onPlugin (prefix, rate) {
    this.setCurve(prefix, makeCurve(rate), prefix)
  },

  setCurve (prefix, curveBuf, peer) {
    // for existing destinations:
    if (typeof this.curves[prefix] !== 'undefined') {
      // enforce same peer as existing curve:
      if (peer !== this.curves[prefix].peer) {
        return false
      }
      // if the curve is the same, there is nothing to update;
      if (curveBuf.compare(this.curves[prefix].buf) === 0) {
        // return false to avoid forwarding this update to others
        return false
      }
    }
    this.curves[prefix] = {
      buf: curveBuf,
      peer
    }
    return true
  },

  findCurve (address) {
    const parts = address.split('.')
    parts.pop()
    while (parts.length) {
      const prefix = parts.join('.') + '.'
      if (this.curves[prefix]) {
        return Object.assign(this.curves[prefix], {
          prefix
        })
      }
      parts.pop()
    }
    console.error('tried to find curve', address, this.curves)
    throw new Error('no curve found')
  },

  answerLiquidity (req) {
    return Promise.resolve().then(() => {
      const curve = this.findCurve(req.destinationAccount)
      return Promise.resolve({
        liquidityCurve: curve.buf,
        appliesToPrefix: curve.prefix,
        sourceHoldDuration: 15000,
        expiresAt: new Date(Date.now() + 3600 * 1000)
      })
    })
  },

  answerBySource (req) {
    return Promise.resolve().then(() => {
      const curve = this.findCurve(req.destinationAccount)
      return Promise.resolve({
        destinationAmount: sourceToDest(parseInt(req.sourceAmount), curve.buf).toString(),
        sourceHoldDuration: 3000
      })
    })
  },

  answerByDest (req) {
    return Promise.resolve().then(() => {
      const curve = this.findCurve(req.destinationAccount)
      return Promise.resolve({
        sourceAmount: destToSource(parseInt(req.destinationAmount), curve.buf).toString(),
        sourceHoldDuration: 3000
      })
    })
  },

  findHop (address, amount) {
    const curve = this.findCurve(address)
    return {
      amount: destToSource(parseInt(amount), curve.buf).toString(),
      ledger: curve.peer,
      to: address // final hop
    }
  },

  findForwardedHop (address, incomingAmount) {
    const curve = this.findCurve(address)
    return {
      amount: Math.ceil(parseInt(amount) * 1.01).toString(),
      ledger: curve.peer,
      to: address // final hop
    }
  },

  getRoutesArray (omitPeer) {
    let arr = []
    for (let prefix of this.curves) {
      if (this.curves[prefix].peer !== omitPeer) {
        arr.push({
          destination_ledger: prefix,
          points: this.curves[prefix].curve.toString('base64')
        })
      }
    }
    return arr
  }
}

module.exports = Quoter
