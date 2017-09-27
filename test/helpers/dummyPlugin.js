function DummyPlugin (config) {
  this.handlers = {}
  this.transfers = []
  this.config = config

}

DummyPlugin.prototype = {
  on (eventName, callback) {
    this.handlers[eventName] = callback
  },
  registerRequestHandler(handler) {
    this.handlers.request = handler
  },
  sendTransfer (transfer) {
    this.transfers.push(transfer)
    setTimeout(() => {
      console.log('dummy plugin fulfills!', transfer, this.fulfillment)
      this.handlers.outgoing_fulfill(transfer, this.config.fulfillment.toString('base64'))
    }, 0)
    return Promise.resolve(null)
  },
  connect () { return Promise.resolve() },
  disconnect () {},
  getAccount () { return this.config.prefix + 'dummy-account' },
  getInfo () { return { prefix: this.config.prefix } },
  fulfillCondition (transferId, conditionBase64) {
    return Promise.resolve(this.successCallback(transferId, conditionBase64))
  },
  rejectIncomingTransfer (transferId, rejectionReasonObj) {
    console.log(rejectionReasonObj)
    return Promise.resolve(this.failureCallback(transferId, rejectionReasonObj))
  }
}

module.exports = DummyPlugin
