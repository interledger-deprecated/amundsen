function lengthPrefixFor (buf) {
  if (buf.length < 128) {
    return Buffer.from([buf.length])
  } else {
    // See section 8.6.5 of http://www.itu.int/rec/T-REC-X.696-201508-I
    const lenLen = 128 + 2
    const lenLo = buf.length % 256
    const lenHi = (buf.length - lenLo) / 256
    return Buffer.from([lenLen, lenHi, lenLo])
  }
}

// const InfoPacket = {
//   TYPE_REQUEST: 1,
//   TYPE_RESPONSE: 2,
// 
//   serializeResponse (info) {
//     // console.log('serializing!', info)
//     const infoBuf = Buffer.from(info, 'ascii')
//     return Buffer.concat([
//       Buffer.from([this.TYPE_RESPONSE]),
//       lengthPrefixFor(infoBuf),
//       infoBuf
//     ])
//   },
// 
//   deserialize (dataBuf) {
//     let obj = {
//       type: dataBuf[0]
//     }
//     if (dataBuf[0] === this.TYPE_RESPONSE) {
//       let lenLen = 1
//       if (dataBuf[1] >= 128) {
//         // See section 8.6.5 of http://www.itu.int/rec/T-REC-X.696-201508-I
//         lenLen = 1 + (dataBuf[1] - 128)
//       }
//       try {
//         // console.log(dataBuf.toString('hex'), dataBuf.slice(lenLen + 1).toString('ascii'))
//         obj.address = dataBuf.slice(lenLen + 1).toString('ascii')
//       } catch (e) {
//       }
//     }
//     return obj
//   }
// }

// const BalancePacket = {
//   serializeResponse (num) {
//     let prefix = '0208' + '0000' + '0000' + '0000' + '0000'
//     let suffix = num.toString(16)
//     return Buffer.from(prefix.substring(0, prefix.length - suffix.length) + suffix, 'hex')
//   }
// }

const CcpPacket = {
  TYPE_ROUTES: 0,
  TYPE_REQUEST_FULL_TABLE: 1,

  serialize (obj) {
    if (obj.type === 0) {
      const dataBuf = JSON.stringify(obj.data)
      return Buffer.concat([
        Buffer.from([0]),
        lengthPrefixFor(dataBuf),
        dataBuf
      ])
    } else if (obj.type === 1) {
      return Buffer.from([1])
    }
    throw new Error('unknown packet type')
  },

  deserialize (dataBuf) {
    let obj = {
      type: dataBuf[0]
    }
    if (dataBuf[0] === this.TYPE_ROUTE) {
      let lenLen = 1
      if (dataBuf[1] >= 128) {
        // See section 8.6.5 of http://www.itu.int/rec/T-REC-X.696-201508-I
        lenLen = 1 + (dataBuf[1] - 128)
      }
      try {
        obj.data = JSON.parse(dataBuf.slice(lenLen + 1).toString('ascii'))
      } catch (e) {
      }
    }
    return obj
  }
}

const VouchPacket = {
  TYPE_VOUCH: 1,
  TYPE_REACHME: 2,
  TYPE_ROLLBACK: 3,

  serialize (obj) {
    // TODO: Implement TYPE_ROLLBACK
    // console.log('serializing!', obj)
    const addressBuf = Buffer.from(obj.address, 'ascii')
    return Buffer.concat([
      Buffer.from([obj.callId]),
      lengthPrefixFor(addressBuf),
      addressBuf
    ])
  },

  deserialize (dataBuf) {
    let lenLen = 1
    let addressLen = dataBuf[1]
    if (dataBuf[1] >= 128) {
      // See section 8.6.5 of http://www.itu.int/rec/T-REC-X.696-201508-I
      lenLen = 1 + (dataBuf[1] - 128)
      // TODO: write unit tests for this code and see if we can use it to
      // read the address, condition, and amount of a rollback
      addressLen = 0
      let cursor = 2
      switch (lenLen) {
        case 7: addressLen = addressLen * 256 + dataBuf[cursor++] // eslint-disable-line no-fallthrough
        case 6: addressLen = addressLen * 256 + dataBuf[cursor++] // eslint-disable-line no-fallthrough
        case 5: addressLen = addressLen * 256 + dataBuf[cursor++] // eslint-disable-line no-fallthrough
        case 4: addressLen = addressLen * 256 + dataBuf[cursor++] // eslint-disable-line no-fallthrough
        case 3: addressLen = addressLen * 256 + dataBuf[cursor++] // eslint-disable-line no-fallthrough
        case 2: addressLen = addressLen * 256 + dataBuf[cursor++] // eslint-disable-line no-fallthrough
        case 1: addressLen = addressLen * 256 + dataBuf[cursor++] // eslint-disable-line no-fallthrough
      }
    }
    // console.log(dataBuf, lenLen, dataBuf.slice(lenLen))
    return {
      callId: dataBuf[0], // 1: 'vouch for', 2: 'reach me at', 3: 'roll back'
      address: dataBuf.slice(1 + lenLen, 1 + lenLen + addressLen).toString('ascii')
      // TODO: report condition and amount in case callId is 'roll back', and
      // stop them from being concatenated as bytes at the end of the address.
    }
  }
}

module.exports = {
  // InfoPacket, // handled by Frog
  // BalancePacket,  // handled by Frog
  CcpPacket,
  VouchPacket,
  PaychanPacket: undefined
}
