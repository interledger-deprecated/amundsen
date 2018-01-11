const PluginXrp = require('ilp-plugin-xrp-escrow')
const PluginEth = require('ilp-plugin-ethereum')
const Bmp = require('./bmp')
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
  addPlugin (plugin, rate) {
    const prefix = plugin.getInfo().prefix
    return plugin.connect().then(() => {
      this.plugins[prefix] = plugin
      this.quoter.onPlugin(prefix, rate)
      this.voucher.onPlugin(prefix)
      this.requestHandler.onPlugin(prefix)
      this.transferHandler.onPlugin(prefix)
    })
  }
  getPlugin (prefix) {
    return this.plugins[prefix]
  }
  start () {
    const promises = []
    if (this.config.btp) {
      this.pluginFactory = new PluginFactory(this.config.btp, this.addPlugin.bind(this))
      promises.push(this.pluginFactory.start())
    }
    if (this.config.bmp) {
      promises.push(Bmp.launch(this.config.bmp).then(bmpPlugin => this.addPlugin(bmpPlugin, this.config.bmp.rate)))
    }
    if (this.config.eth) {
      promises.push(this.addPlugin(new PluginEth(this.config.eth), this.config.eth.rate))
    }
    if (this.config.xrp) {
      promises.push(this.addPlugin(new PluginXrp(this.config.xrp), this.config.xrp.rate))
    }
    return Promise.all(promises)
  }
  stop () {
    return Promise.resolve()
  }
}

module.exports = TestnetNode
