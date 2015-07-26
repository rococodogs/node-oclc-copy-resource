module.exports = CopyResource;

var WSKey = require('oclc-wskey');
var https = require('https')

var CR_HOST = 'circ.sd00.worldcat.org'
var CR_PATH = '/LHR'
var CR_URL = 'https://' + CR_HOST + CR_PATH

var noop = function(){};

function CopyResource(inst, wskey) {
  if (!(wskey instanceof WSKey) && wskey.public && wskey.secret) {
    var user = {}
    
    if (wskey.user && wskey.user.principalID && wskey.user.principalIDNS) {
      user = wskey.user
    }

    wskey = new WSKey(wskey.public, wskey.secret, user)
  }

  this.wskey = wskey
  this.inst = inst || null
}

CopyResource.prototype.read = function readCopyResource (id, cb) {
  var path = '/' + id;

  if (this.inst) path += '?inst=' + this.inst;

  return this._request('GET', path, cb)
}

CopyResource.prototype.barcode = function searchBarcode (num, opt, cb) {
  return this.search({barcode: num}, opt, cb)
}

CopyResource.prototype.oclc = function searchOCLCNumber (num, opt, cb) {
  return this.search({oclc: num}, opt, cb)
}

CopyResource.prototype.search = function searchCopyResource (s, opt, cb) {
  if ( typeof opt === 'function' ) {
    cb = opt
    opt = {}
  }

  var startIndex = parseInt(opt.startIndex) || 1
    , itemsPerPage = parseInt(opt.itemsPerPage) || 10

  if ( !s['oclc'] && !s['barcode'] ) {
    return cb(new Error('Searching requires `oclc` or `barcode` property'), null);
  } else if ( s['oclc'] && s['barcode'] ) {
    return cb(new Error('Searching can not use both `oclc` and `barcode` properties'), null);
  }
  
  var index = s.hasOwnProperty('oclc') ? 'oclc' : 'barcode'
    , val = s[index]
    , path
  
  path = '?q=' + index + ':' + val
       + '&startIndex=' + startIndex
       + '&itemsPerPage=' + itemsPerPage

  if ( this.inst ) path += '&inst=' + this.inst;

  return this._request('GET', path, cb);
}

CopyResource.prototype._request = function (method, path, callback) {
  var opts = {
    hostname: CR_HOST,
    method: method,
    path: CR_PATH + path,
    headers: {
      'Accept': 'application/json',
      'Authorization': this.wskey.HMACSignature(method, CR_URL + path)
    }
  }

  var req = https.request(opts, function (res) {
    var body = ''
    res.setEncoding('utf8')    
    res.on('data', function (chunk) {
      body += chunk
    })

    res.on('end', function () {
      return handleOCLCResponse(res.statusCode, body, callback)
    })
  })

  req.end()

  function handleOCLCResponse(code, data, cb) {
    var msg, parsed
    if (code === 401) {
      msg = '401 Unauthorized: '
          + 'This request requires HTTP authentication (Unauthorized)'
      
      return cb(new Error(msg))
    }

    else if (code === 404) {
      msg = '404 Not Found: '
          + 'The requested resource () is not available.'
      return cb(new Error(msg))
    }

    else if (code === 500) {
      parsed = JSON.parse(data)
      msg = '500 Internal Server Error'
          + parsed.detail
      return cb(new Error(msg))
    }

    else {
      parsed = JSON.parse(data)
      if (parsed.problem) {
        msg = parsed.problem.problemDetail || parsed.problem.problemType
        return cb(new Error(msg))
      } else {
        return cb(null, parsed)
      }
    }
  }
}
