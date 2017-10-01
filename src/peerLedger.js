const EventEmitter = require('eventemitter2')
const BigNumber = require('big-number')
const sha256 = require('./sha256')

class NamedError extends Error {
  constructor (msg) {
    super(msg)
    this.name = msg.split(' ').map(str => {
      return str[0].toUpperCase() + str.substring(1)
    }).join('') + 'Error'
  }
}

function invalidDate (d) {
  // from https://stackoverflow.com/a/1353711/680454
  if (Object.prototype.toString.call(d) === '[object Date]') {
    // it is a date
    if (isNaN(d.getTime())) { // d.valueOf() could also work
      // date is not valid
      return true
    } else {
      // date is valid
      return false
    }
  } else {
    // not a date
    return true
  }
}

function invalidBigNum (n) {
  return n.number === 'Invalid Number'
}

class LedgerPlugin extends EventEmitter {
  constructor (ledger, account, initialBalancePerPeer) {
    super()
    this.ledger = ledger
    this.account = account
    this.balance = initialBalancePerPeer
    console.log('initial balance in peer ledger plugin', this.balance)
  }

  _getOtherRelativeAccount () {
    return this.ledger.getOtherAccount(this.account)
  }

  _getOtherAccount () {
    return this.getInfo().prefix + this._getOtherRelativeAccount()
  }

  _getOtherPlugin () {
    return this.ledger.getPlugin(this._getOtherRelativeAccount())
  }

  _getMinBalance () {
    if (this.account === 'client') {
      return this.ledger.info.minBalance
    } else {
      return -this.ledger.info.maxBalance
    }
  }

  _getMaxBalance () {
    if (this.account === 'client') {
      return this.ledger.info.maxBalance
    } else {
      return -this.ledger.info.minBalance
    }
  }

  // methods that don't affect the ledger or the other peer:
  connect () {
    this.isConnected = true
    return Promise.resolve()
  }

  disconnect () {
    this.isConnected = false
    return Promise.resolve()
  }

  isConnected () {
    return this.isConnected
  }

  getInfo () {
    return this.ledger.info
  }

  getAccount () {
    return this.ledger.info.prefix + this.account
  }

  getBalance () {
    return this.balance.toString()
  }

  getFulfillment (transferId) {
    if (this.ledger.transfers[transferId]) {
      if (this.ledger.transfers[transferId].fulfillment) {
        return Promise.resolve(this.ledger.transfers[transferId].fulfillment)
      }
      return Promise.reject(new NamedError('missing fulfillment'))
    }
    return Promise.reject(new NamedError('transfer not found'))
  }

//{ id: '515cba4e-cbe5-4bf2-b4f2-a81706d68214',
//  from: 'test.amundsen.client1.peer',
//  to: 'test.amundsen.client1.peer',
//  ledger: 'test.amundsen.client1.',
//  amount: '1235',
//  ilp: 'ASAAAAAAAAAE0hV0ZXN0LmR1bW15LmNsaWVudDIuaGkAAA',
//  noteToSelf: {},
//  executionCondition: 'uqExnZ5hcSozTw6c6gMGnzdrN3yMuAbxbIpDV7eHdWA',
//  expiresAt: '2017-09-27T13:10:55.622Z',
//  custom: {} }

  // methods that affect the ledger and the other peer:
  sendTransfer (transfer) {
    console.log('sendTransfer in peerLedger!', (transfer.ledger !== this.getInfo().prefix),
        (transfer.from !== this.getAccount()),
        transfer.to, this._getOtherAccount(),
        typeof transfer.amount !== 'string',
        typeof transfer.executionCondition !== 'string',
        typeof transfer.expiresAt !== 'string',
        typeof transfer.ilp !== 'string')

    if ((transfer.ledger !== this.getInfo().prefix) ||
        (transfer.from !== this.getAccount()) ||
        (transfer.to !== this._getOtherAccount()) ||
        typeof transfer.amount !== 'string' ||
        typeof transfer.executionCondition !== 'string' ||
        typeof transfer.expiresAt !== 'string' ||
        typeof transfer.ilp !== 'string') {
      console.log(transfer.ledger, this.getInfo().prefix,
        transfer.from, this.getAccount(),
        transfer.to, this._getOtherAccount(),
        typeof transfer.amount !== 'string',
        typeof transfer.executionCondition !== 'string',
        typeof transfer.expiresAt !== 'string',
        typeof transfer.ilp !== 'string')
      return Promise.reject(new NamedError('invalid fields'))
    }

    const expiresDate = new Date(transfer.expiresAt)
    const amountBigNum = new BigNumber(transfer.amount)
    if (invalidBigNum(amountBigNum) ||
        invalidDate(expiresDate) ||
        expiresDate - new Date() < 0) {
      return Promise.reject(new NamedError('invalid fields'))
    }

    if (this.ledger.transfers[transfer.id]) {
      return Promise.reject(new NamedError('duplicate id'))
    }

    this.ledger.transfers[transfer.id] = transfer
    console.log('subtracting', this.balance, amountBigNum)
    this.balance.subtract(amountBigNum)
    if (this.balance.lt(this._getMinBalance())) {
      this.ledger.transfers[transfer.id].rejected = true
      this.balance.add(amountBigNum)
      return Promise.reject(new NamedError('insufficient balance'))
    }
    console.log('ledger emits!', transfer)
    this._getOtherPlugin().emit('incoming_prepare', transfer)
    this.emit('outgoing_prepare', transfer)
    setTimeout(() => {
      if (this.ledgertransfers[transfer.id].fulfillment ||
          this.ledgertransfers[transfer.id].rejected) {
        return
      }
      this.ledgertransfers[transfer.id].rejected = true
      this.balance.add(amountBigNum)
      this._getOtherPlugin().emit('incoming_cancel', transfer)
      this.emit('outgoing_cancel', transfer)
    }, expiresDate - new Date())
    return Promise.resolve(null)
  }

  sendRequest (request) {
    console.log('sending request over peer ledger!', request)
    if (typeof this._getOtherPlugin().requestHandler !== 'function') {
      return Promise.reject(new NamedError('no subscriptions'))
    }
    return this._getOtherPlugin().requestHandler(request)
  }

  fulfillCondition (transferId, fulfillment) {
    console.log('fulfillCondition', this.account, transferId, fulfillment)
    if (!this.ledger.transfers[transferId]) {
      return Promise.reject(new NamedError('transfer not found'))
    }
    if (this.ledger.transfers[transferId].to !== this.getAccount()) {
      return Promise.reject(new NamedError('invalid fields'))
    }
    if (new Date(this.ledger.transfers[transferId].expiresAt) < new Date()) {
      return Promise.reject(new NamedError('already rolled back'))
    }
    if (this.ledger.transfers[transferId].rejected) {
      return Promise.reject(new NamedError('already rolled back'))
    }
    if (this.ledger.transfers[transferId].fulfillment) {
      return Promise.reject(new NamedError('already fulfilled'))
    }
    if (sha256(fulfillment) !== this.ledger.transfers[transferId].executionCondition) {
      return Promise.reject(new NamedError('not accepted'))
    }
    this.ledger.transfers[transferId].fulfillment = fulfillment
    console.log('balance before adding', this.balance.toString(), new BigNumber(this.ledger.transfers[transferId].amount).toString())
    // this.balance.add(new BigNumber(this.ledger.transfers[transferId].amount))
    this.balance = new BigNumber(parseInt(this.balance.toString()) + parseInt(this.ledger.transfers[transferId].amount))
    console.log('balance after adding', this.balance, this.ledger.transfers[transferId].amount)
    if (this.balance.gt(this._getMaxBalance())) {
       console.log('fulfilling that would make my balance too high!', this.account, this.balance, this._getMaxBalance())
      this.ledger.transfers[transferId].rejected = true
      delete this.ledger.transfers[transferId].fulfillment
      this.balance.subtract(this.ledger.transfers[transferId].amount)
      this._getOtherPlugin().balance.add(this.ledger.transfers[transferId].amount)
      return Promise.reject(new NamedError('insufficient balance'))
    }
    console.log('emitting outgoing fulfill', this.ledger.transfers[transferId])
    this._getOtherPlugin().emit('outgoing_fulfill', this.ledger.transfers[transferId], fulfillment)
    this.emit('incoming_fulfill', this.ledger.transfers[transferId])
    return Promise.resolve()
  }

  rejectIncomingTransfer (transferId, reason) {
    if (!this.ledger.transfers[transferId]) {
      return Promise.reject(new NamedError('duplicate id'))
    }
    if (this.ledger.transfers[transferId].to !== this.getAccount()) {
      return Promise.reject(new NamedError('invalid fields'))
    }
    this.ledger.transfers[transferId].rejected = true
    this.ledger.cancel(transferId)
    this._getOtherPlugin().balance.add(this.ledger.transfers[transferId].amount)
    this._getOtherPlugin().emit('outgoing_reject', this.ledger.transfers[transferId])
    this.emit('incoming_reject', this.ledger.transfers[transferId])
    return Promise.resolve()
  }

  registerRequestHandler (handler) {
    console.log('registerRequestHandler')
    if (this.requestHandler) {
      throw new NamedError('request handler already registered')
    }
    this.requestHandler = handler
    return null
  }

  deregisterRequestHandler (handler) {
    this.requestHandler = undefined
    return null
  }
}

function PeerLedger (ledgerInfo, initialBalancePerPeer) {
  this.info = ledgerInfo
  this.transfers = {}
  console.log({ ledgerInfo, initialBalancePerPeer })
  this.plugins = {
    client: new LedgerPlugin(this, 'client', new BigNumber(initialBalancePerPeer), () => {
      return this.plugins.server
    }),
    server: new LedgerPlugin(this, 'server', new BigNumber(initialBalancePerPeer).multiply(-1), () => {
      return this.plugins.client
    })
  }
}

PeerLedger.prototype = {
  getPlugin (name) {
    return this.plugins[name]
  },
  getOtherAccount (name) {
    if (name === 'server') {
      return 'client'
    } else {
      return 'server'
    }
  }
}

module.exports = PeerLedger
