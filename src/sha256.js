const crypto = require('crypto')

function base64url (buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function sha256 (fulfillmentBase64) {
  return base64url(crypto.createHash('sha256').update(Buffer.from(fulfillmentBase64, 'base64')).digest())
}

module.exports = sha256
