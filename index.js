module.exports = CopyResource;

var WSKey = require('oclc-wskey');
var noop = function(){};
var CR_URL = 'https://circ.sd00.worldcat.org/LHR';

function CopyResource(wskey, inst) {
  if ( !(wskey instanceof WSKey) && wskey.public && wskey.secret ) {
    var user = {};
    
    if ( wskey.user && wskey.user.principalID && wskey.user.principalIDNS ) {
      user = wskey.user;
    }

    wskey = new WSKey(wskey.public, wskey.secret, user);
  }

  this.wskey = wskey;
  this.inst = inst || null;
}

CopyResource.prototype.read = function readCopyResource (id, cb) {
  var url = CR_URL;

  url += '/' + id;

  if ( this.inst ) url += '?inst=' + this.inst;

  return sendRequest({
    method: 'GET',
    url: url,
    wskey: this.wskey,
    callback: cb
  });
}

CopyResource.prototype.search = function searchCopyResource (s, opt, cb) {
  if ( typeof opt === 'function' ) {
    cb = opt;
    opt = {};
  }

  var url = CR_URL
    , startIndex = opt.startIndex || 1
    , itemsPerPage = opt.itemsPerPage || 10
    ;

  if ( !s['oclc'] && !s['barcode'] ) {
    return cb(new Error('Searching requires `oclc` or `barcode` property'), null);
  } else if ( s['oclc'] && s['barcode'] ) {
    return cb(new Error('Searching can not use both `oclc` and `barcode` properties'), null);
  }
  
  var index = s.hasOwnProperty('oclc') ? 'oclc' : 'barcode'
    , val = s[index]
    ;
  
  url += '?q=' + index + ':' + val
      +  '&startIndex=' + startIndex
      +  '&itemsPerPage=' + itemsPerPage
      ;

  if ( this.inst ) url += '&inst=' + this.inst;

  return sendRequest({
    method: 'GET',
    url: url,
    wskey: this.wskey,
    callback: cb
  });
}

function parseCopyID(url) {
  var reg = /\/LHR\/(\d+)/
    , m = url.match(reg)
    ;

  return m ? m[1] : null;
}

function sendRequest(opt, cb) {
  var request = require('request')
    , method = opt.method
    , url = opt.url
    , wskey = opt.wskey
    , data = opt.data || ''
    , cb = opt.callback || cb || noop
    ;

  request({
    uri: url,
    method: method,
    headers: {
      'Authorization': wskey.HMACSignature(method, url),
      'Accept': 'application/json'
    },
    body: data
  }, function(err, resp, body) {
    if ( err ) return cb(err, null);

    if (resp.statusCode === 401) {
      return cb({
        'code': {
          'value': 401,
          'type': null
        },
        'message': 'Unauthorized',
        'detail': 'This request requires HTTP authentication (Unauthorized)'
      }, null);
    } else if (resp.statusCode === 404) {
      return cb({
        'code': {
          'value': 404,
          'type': null
        },
        'message': 'Not Found',
        'detail': 'The requested resource () is not available.'
      }, null);
    } else {
      var parsed = JSON.parse(body)
      if ( parsed.problem ) {
        return cb({
          'code': {
            'value': 400,
            'type': null
          },
          'message': parsed.problem.problemType,
          'detail': parsed.problem.problemDetail || parsed.problem.problemType
          }, null);
      } else {
        return cb(null, parsed);
      }
    }
  });
}
