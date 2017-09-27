const IlpPacket = require('ilp-packet')

class TransferHandler {
  constructor(main) {
    this.main = main
  }

  onPlugin(prefix) {
    this.main.getPlugin(prefix).on('incoming_prepare', (transfer) => {
      console.log('handling transfer!', prefix, transfer)
      console.log('step 1: check if we know the fulfillment (not used in Amundsen')
      console.log('step 2: check the vouch')
      console.log('step 3: forward it')
      const destination = IlpPacket.deserializeIlpPayment(Buffer.from(transfer.ilp, 'base64'))
      const hop = this.main.quoter.findHop(destination.account, destination.amount)
      console.log('checking destination at quoter', destination, hop)
    })
  }
}

module.exports = TransferHandler
