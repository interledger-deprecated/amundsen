const PluginXrp = require('ilp-plugin-xrp-escrow')
const PluginEth = require('ilp-plugin-ethereum')
const PluginFactory = require('./pluginFactory')
const RequestHandler = require('./request-handler')
const TransferHandler = require('./transfer-handler')
const Quoter = require('./quoter')
const Voucher = require('./voucher')

class TestnetNode {
  constructor () {
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
      console.log('adding plugin for', prefix)
      this.quoter.onPlugin(prefix)
      this.voucher.onPlugin(prefix)
      this.requestHandler.onPlugin(prefix)
      this.transferHandler.onPlugin(prefix)
    })
  }
  getPlugin(prefix) {
    return this.plugins[prefix]
  }
  start() { return Promise.resolve() }
  stop() { return Promise.resolve() }
}

const testnetNode = new TestnetNode()
const pluginFactory = new PluginFactory({
  listen: 8000, //  tls: 'amundsen.michielbdejong.com',
  initialBalancePerPeer: 10000,
  baseLedger: 'test.amundsen.'
}, testnetNode.addPlugin.bind(testnetNode))

Promise.all([
//  testnetNode.addPlugin(new PluginEth({
//    secret: 'xidaequeequuu4xah8Ohnoo1Aesumiech6tiay1h',
//    account: '0x' + 'fa5b9836c46b6559be750b2f3c12657081fab858'.toUpperCase(),
//    provider: 'http://localhost:8545',
//    contract: '0x8B3FBD781096B51E68448C6E5B53B240F663199F',
//    prefix: 'test.crypto.eth.rinkeby.'
//  })),
//  testnetNode.addPlugin(new PluginXrp({
//    secret: 'shvKKDpRGMyKMUVn4EyMqCh9BQoP9',
//    account: 'rhjRdyVNcaTNLXp3rkK4KtjCdUd9YEgrPs',
//    server: 'wss://s.altnet.rippletest.net:51233',
//    prefix: 'test.crypto.xrp.'
//  })),
  pluginFactory.start()
]).then(() => {
  console.log('started')
})

module.exports = TestnetNode
