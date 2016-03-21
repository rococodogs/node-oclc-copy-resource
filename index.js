module.exports = CopyResource;

var WSKey = require('oclc-wskey');
var https = require('https')
var isObject = require('is-object')
var xmlify = require('wms-xmlify-copy-resource')

var noop = function(){};

function CopyResource(inst, wskey) {
  if (!(wskey instanceof WSKey) && wskey.public && wskey.secret) {
    var user = {}

    if (wskey.user && wskey.user.principalID && wskey.user.principalIDNS)
      user = wskey.user

    wskey = new WSKey(wskey.public, wskey.secret, user)
  }

  this.wskey = wskey
  this.inst = inst
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
  var itemsPerPage = parseInt(opt.itemsPerPage) || 10

  if ( !s['oclc'] && !s['barcode'] ) {
    return cb(new Error('Searching requires `oclc` or `barcode` property'), null);
  } else if ( s['oclc'] && s['barcode'] ) {
    return cb(new Error('Searching can not use both `oclc` and `barcode` properties'), null);
  }

  var index = s.hasOwnProperty('oclc') ? 'oclc' : 'barcode'
  var val = s[index]
  var path

  path = '?q=' + index + '%3A' + val
       + '&startIndex=' + startIndex
       + '&itemsPerPage=' + itemsPerPage

  if (this.inst) path += '&inst=' + this.inst;

  return this._request('GET', path, cb);
}

// requests the copy resource, applies transform function + puts
CopyResource.prototype.update = function updateCopyResource (num, opts, transform, cb) {
  var fn = isObject(num) ? 'search' : 'read'
  var self = this
  var msg

  // alt signature: update(num, transform, cb)
  if (typeof opts === 'function') {
    cb = transform
    transform = opts
    opts = {}
  }

  if (!cb) cb = noop

  if (fn === 'search' && num['oclc']) {
    msg = 'At this time, CopyResource.update does not support OCLC number searching'
    return cb(new Error(msg))
  }

  var args = [num, opts, handleTransform]
  if (fn === 'read') args.splice(1,1)

  // run read/search fn
  return self[fn].apply(self, args)

  function handleTransform (err, results) {
    if (err) return cb(err)

    // search results include meta that we can't send with the update
    if (fn === 'search') {
      if (results.entry.length === 1) {
        results = results.entry[0]
      } else {
        msg = 'Search returned multiple entries'
        return cb(new Error(msg))
      }
    }

    var cid = getCopyIdFromId(results.id)
    var updated = transform(results)

    return self._request('PUT', '/' + cid, xmlify(updated), cb)
  }

  function getCopyIdFromId (id) {
    return id.replace(/^.*\/LHR\//, '').replace(/\?.*$/, '')
  }
}

CopyResource.prototype._request = function (method, path, data, callback) {
  var crHost = 'circ.sd00.worldcat.org'
  var crPath = '/LHR' + path
  var url = 'https://' + crHost + crPath

  var opts = {
    hostname: crHost,
    method: method,
    path: crPath,
    headers: {
      'Accept': 'application/json',
      'Authorization': this.wskey.HMACSignature(method, url)
    }
  }

  if (typeof data === 'function') {
    callback = data
    data = null
  } else {
    opts.headers['Content-Type'] = 'application/xml'
  }

  return https.request(opts, function (res) {
    var body = ''
    res.setEncoding('utf8')
    res.on('data', function (chunk) {
      body += chunk
    })

    res.on('end', function () {
      return handleOCLCResponse(res.statusCode, body, callback)
    })
  }).end(data)
}

function handleOCLCResponse(code, data, cb) {
  var msg, parsed, err

  switch (code) {
    case 401:
      msg = 'This request requires HTTP authentication (Unauthorized)'
      break
    case 403:
      msg = 'Access to the specified resource has been forbidden.'
      break
    case 404:
      msg = 'The requested resource () is not available.'
      break
    case 500:
      parsed = JSON.parse(data)
      msg = parsed.detail
      break
  }

  if (msg) {
    err = new Error(msg)
    err.code = code
    return cb(err, null)
  }

  try { parsed = JSON.parse(data) }
  catch (e) {
    // successful put/post requests w/o an Accept: application/json value
    // return the xml body, which isn't JSON parseable. we shouldn't have
    // to worry about this, but Just In Case
    if (code === 200) return cb(null, data)

    parsed = { problem: {problemDetail: 'An unknown error occurred' }}
  }

  if (parsed.problem) {
    msg = parsed.problem.problemDetail || parsed.problem.problemType
    err = new Error(msg)
    err.code = code
    err.result = data
    return cb(err)
  }

  return cb(null, parsed)
}
