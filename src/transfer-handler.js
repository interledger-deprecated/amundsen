const IlpPacket = require('ilp-packet')
const uuid = require('uuid/v4')

const MIN_MESSAGE_WINDOW = 10000

class TransferHandler {
  constructor (main) {
    this.main = main
    this.outstanding = {}
  }

  onPlugin (prefix) {
    this.main.getPlugin(prefix).on('incoming_prepare', (transfer) => {
      const destination = IlpPacket.deserializeIlpPayment(Buffer.from(transfer.ilp, 'base64'))
      const onwardTransfer = this.main.quoter.findHop(destination.account, destination.amount)
      const onwardPlugin = this.main.getPlugin(onwardTransfer.ledger)
      this.outstanding[transfer.executionCondition] = transfer
      onwardPlugin.sendTransfer(Object.assign(onwardTransfer, {
        id: uuid(),
        from: onwardPlugin.getAccount(), // see https://github.com/interledger/rfcs/issues/289
        // to set by findHop
        ledger: onwardPlugin.getInfo().prefix, // see https://github.com/interledger/rfcs/issues/289
        // amount set by findHop
        ilp: transfer.ilp,
        noteToSelf: {},
        executionCondition: transfer.executionCondition,
        expiresAt: new Date(new Date(transfer.expiresAt).getTime() + MIN_MESSAGE_WINDOW).toISOString(),
        custom: {}
      })).catch(err => {
        console.error('forwarding failed', err.message)
      })
    })
    this.main.getPlugin(prefix).on('outgoing_fulfill', (transfer, fulfillment) => {
      if (this.outstanding[transfer.executionCondition]) {
        const transferItCameFrom = this.outstanding[transfer.executionCondition]
        const pluginItCameFrom = this.main.getPlugin(transferItCameFrom.ledger)
        pluginItCameFrom.fulfillCondition(transferItCameFrom.id, fulfillment).catch(err => console.error('could not fulfill', err.message))
      }
    })
  }
}

module.exports = TransferHandler
