const BigNumber = require('big-number')
const VouchPacket = require('./protocols').VouchPacket

class Voucher {
  constructor (main) {
    this.main = main
    this.vouchableAddresses = []
    this.vouchablePeers = []
    this.vouchingMap = {}
  }

  onPlugin (prefix) {
    const plugin = this.main.getPlugin(prefix)
    if (plugin.isPrivate) {
      const peerLedger = plugin.getInfo().prefix
      // auto-vouch all existing ledger VirtualPeers -> BTP peer
      this.addVouchablePeer(peerLedger)
    } else {
      // auto-vouch ledger VirtualPeer -> all existing BTP peers
      this.addVouchableAddress(plugin.getAccount())
      // and add the plugin ledger as a destination in to the routing table:
    }
  }

  addVouchablePeer (peerLedger) {
    this.vouchablePeers.push(peerLedger)
    return Promise.all(this.vouchableAddresses.map(address => {
      console.log('new vouchable peer', peerLedger, address)
      return this.vouchBothWays(peerLedger, address)
    }))
  }

  addVouchableAddress (address) {
    this.vouchableAddresses.push(address)
    return Promise.all(this.vouchablePeers.map(peerLedger => {
      console.log('new vouchable address', peerLedger, address)
      return this.vouchBothWays(peerLedger, address)
    }))
  }

  checkVouch (fromAddress, amount) {
    console.log('checkVouch', fromAddress, amount, this.vouchingMap)
    if (!this.vouchingMap[fromAddress]) {
      return Promise.resolve(false)
    }
    return this.main.plugins[this.vouchingMap[fromAddress]].getBalance().then(balance => {
      return new BigNumber(balance).gte(amount)
    })
  }

  vouchBothWays (peerLedger, address) {
    [VouchPacket.VOUCH, VouchPacket.REACHME].map(callId => {
      this.main.plugins[peerLedger].sendRequest({
        custom: {
          vouch: VouchPacket.serialize({ callId, address })
        }
      })
    })
  }
}

module.exports = Voucher
