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
  addPlugin (plugin, rate) {
    const prefix = plugin.getInfo().prefix
    return plugin.connect().then(() => {
      this.plugins[prefix] = plugin
      this.quoter.onPlugin(prefix, rate)
      this.voucher.onPlugin(prefix)
      this.requestHandler.onPlugin(prefix)
      this.transferHandler.onPlugin(prefix)
      // now that a new plugin was added, announce all routes to all connectors on all plugins:
      for (let peerPlugin in this.plugins) {
        this.announceRoutes(this.quoter.getRoutesForPeer(peerPlugin), peer)
      }
    })
  }
  announceRoutes(routes, peer) {
    return Promise.all(this.plugins[peer].getInfo().connectors.map(connector => {
      return this.plugins[peer].sendRequest({
         ledger: this.plugins[peer].getInfo().prefix,
         from: this.plugins[peer].getAccount(),
         to: connector,
         custom: {
           method: 'broadcast_routes',
           data: {
             new_routes: routes.map(route => {
               return {
                 source_ledger: this.plugins[peer].getInfo().prefix,
                 destination_ledger: route.destination_ledger,
                 points: route.points,
                 min_message_window: 1,
                 paths: [ [] ],
                 source_account: this.plugins[peer].getAccount()
               }
            })
          }
          hold_down_time: 600000,
          unreachable_through_me: []
        }
      })
    }))
  }
  getPlugin (prefix) {
    return this.plugins[prefix]
  }
  start () {
    const promises = []
    if (this.config.btp) {
      this.pluginFactory = new PluginFactory(this.config.btp, this.addPlugin.bind(this), this)
      promises.push(this.pluginFactory.start())
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
    if (this.config.btp) {
      return this.pluginFactory.stop()
    }
    return Promise.resolve()
  }
}

module.exports = TestnetNode
