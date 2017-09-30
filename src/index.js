const PluginXrp = require('ilp-plugin-xrp-escrow')
const PluginEth = require('ilp-plugin-ethereum')
const PluginFactory = require('./pluginFactory')
const RequestHandler = require('./request-handler')
const TransferHandler = require('./transfer-handler')
const Quoter = require('./quoter')
const Voucher = require('./voucher')

class TestnetNode {
  constructor (config) {
    this.config = config
    this.plugins = {}
    this.fulfillments = {}
    this.quoter = new Quoter(this)
    this.voucher = new Voucher(this)
    this.requestHandler = new RequestHandler(this)
    this.transferHandler = new TransferHandler(this)
  }
  addPlugin (plugin) {
    console.log('calling plugin.getInfo()!', plugin.getInfo())
    const prefix = plugin.getInfo().prefix
    console.log('have', prefix)
    return plugin.connect().then(() => {
      this.plugins[prefix] = plugin
      console.log('adding plugin for, in quoter...', prefix)
      this.quoter.onPlugin(prefix)
      console.log('adding plugin for, in voucher...', prefix)
      this.voucher.onPlugin(prefix)
      console.log('adding plugin for, in request handler...', prefix)
      this.requestHandler.onPlugin(prefix)
      console.log('adding plugin for, in transfer handler...', prefix)
      this.transferHandler.onPlugin(prefix)
      console.log('routing table after adding plugin', prefix, this.quoter.curves)
    })
  }
  getPlugin(prefix) {
    return this.plugins[prefix]
  }
  start() {
    const promises = []
    if (this.config.btp) {
      this.pluginFactory = new PluginFactory(this.config.btp, this.addPlugin.bind(this))
      promises.push(this.pluginFactory.start())
    }
    if (this.config.eth) {
      promises.push(this.addPlugin(new PluginEth(this.config.eth)))
    }
    if (this.config.eth) {
      promises.push(this.addPlugin(new PluginXrp(this.config.xrp)))
    }
    return Promise.all(promises).then(() => {
      console.log('started')
    })
  }
  stop() { return Promise.resolve() }
}

module.exports = TestnetNode
