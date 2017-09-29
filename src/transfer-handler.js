const IlpPacket = require('ilp-packet')
const uuid = require('uuid/v4')

const MIN_MESSAGE_WINDOW = 10000

class TransferHandler {
  constructor(main) {
    this.main = main
  }

  onPlugin(prefix) {
    console.log('setting transfer handler for prefix', prefix)
    this.main.getPlugin(prefix).on('incoming_prepare', (transfer) => {
      console.log('handling transfer!', prefix, transfer)
      console.log('step 1: check if we know the fulfillment (not used in Amundsen')
      console.log('step 2: check the vouch')
      console.log('step 3: forward it')
      const destination = IlpPacket.deserializeIlpPayment(Buffer.from(transfer.ilp, 'base64'))
      const onwardTransfer = this.main.quoter.findHop(destination.account, destination.amount)
      console.log({ transfer, onwardTransfer })
      const onwardPlugin = this.main.getPlugin(onwardTransfer.ledger)
      onwardPlugin.sendTransfer(Object.assign(onwardTransfer, {
        id: uuid(),
        from: onwardPlugin.getAccount(), // see https://github.com/interledger/rfcs/issues/289
        // to set by findHop
        ledger: onwardPlugin.getInfo().prefix, // see https://github.com/interledger/rfcs/issues/289
        // amount set by findHop
        ilp: transfer.ilp,
        // noteToSelf optional
        executionCondition: transfer.executionCondition,
        expiresAt: new Date(new Date(transfer.expiresAt).getTime() + MIN_MESSAGE_WINDOW).toISOString()
        // custom optional
      })).then(() => {
        console.log('forwarded')
      }, (err) => {
        console.error('forwarding failed', err.message)
      })
    })
  }
}

module.exports = TransferHandler
