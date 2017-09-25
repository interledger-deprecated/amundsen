class RequestHandler {
  constructor (main) {
    this.main = main
  }

  onPlugin (prefix) {
    this.main.getPlugin(prefix).registerRequestHandler(msg => {
      return Promise.resolve()
    })
  }
}

module.exports = RequestHandler
