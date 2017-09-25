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
  constructor (ledger, account, initialBalanceBigNum) {
    super()
    this.ledger = ledger
    this.account = account
    this.balance = initialBalanceBigNum
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

  // methods that affect the ledger and the other peer:
  sendTransfer (transfer) {
    if ((transfer.ledger !== this.getInfo().prefix) ||
        (transfer.from !== this.getAcccount()) ||
        (transfer.to !== this.getOtherPeer().getAcccount()) ||
        typeof transfer.amount !== 'string' ||
        typeof transfer.executionCondition !== 'string' ||
        typeof transfer.expiresAt !== 'string' ||
        typeof transfer.ilp !== 'string') {
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
    this.balance.substract(amountBigNum)
    if (this.balance.lt(this.ledger.info.minBalance)) {
      this.ledger.transfers[transfer.id].rejected = true
      this.balance.add(amountBigNum)
      return Promise.reject(new NamedError('insufficient balance'))
    }
    this.getOtherPlugin().emit('incomingprepare', transfer)
    this.emit('outgoingprepare', transfer)
    setTimeout(() => {
      if (this.ledgertransfers[transfer.id].fulfillment ||
          this.ledgertransfers[transfer.id].rejected) {
        return
      }
      this.ledgertransfers[transfer.id].rejected = true
      this.balance.add(amountBigNum)
      this.getOtherPlugin().emit('incomingcancel', transfer)
      this.emit('outgoingcancel', transfer)
    }, expiresDate - new Date())
  }

  sendRequest (request) {
    if (typeof this.getOtherPlugin().requestHandler !== 'function') {
      return Promise.reject(new NamedError('no subscriptions'))
    }
    return this.getOtherPlugin().requestHandler(request)
  }

  fulfillCondition (transferId, fulfillment) {
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
    this.balance.add(this.ledger.transfers[transferId].amount)
    if (this.balance.gt(this.ledger.info.maxBalance)) {
      this.ledger.transfers[transferId].rejected = true
      delete this.ledger.transfer[transferId].fulfillment
      this.balance.substract(this.ledger.transfers[transferId].amount)
      this.getOtherPeer().balance.add(this.ledger.transfers[transferId].amount)
      return Promise.reject(new NamedError('insufficient balance'))
    }
    this.getOtherPlugin().emit('outgoingfulfill', this.ledger.transfers[transferId])
    this.emit('incomingfulfill', this.ledger.transfers[transferId])
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
    this.getOtherPeer().balance.add(this.ledger.transfers[transferId].amount)
    this.getOtherPlugin().emit('outgoingreject', this.ledger.transfers[transferId])
    this.emit('incomingreject', this.ledger.transfers[transferId])
    return Promise.resolve()
  }

  registerRequestHandler (handler) {
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

function PeerLedger (ledgerInfo, peerInitialBalance) {
  this.info = ledgerInfo
  this.transactions = {}
  this.plugins = {
    peer: new LedgerPlugin(this, 'peer', new BigNumber(peerInitialBalance), () => {
      return this.plugins.me
    }),
    me: new LedgerPlugin(this, 'me', new BigNumber(peerInitialBalance).multiply(-1), () => {
      return this.plugins.peer
    })
  }
}

PeerLedger.prototype = {
  getMyPlugin () {
    return this.plugins.me
  },
  getPeerPlugin () {
    return this.plugins.peer
  }
}

module.exports = PeerLedger
