# node-oclc-copy-resource

Accesses [OCLC's WMS Copy Resource Service](http://www.oclc.org/developer/develop/web-services/wms-collection-management-api/copy-resource.en.html), which is a part of the Collection Management API.

## Usage

```
var WSKey = require('oclc-wskey')
var CopyResource = require('oclc-copy-resource')
var user = {
  principalID: 'principalID',
  principalIDNS: 'principalIDNS'
}
var key = new WSKey('public key', 'secret key', user)
var cr = new CopyResource(128807, key)

cr.barcode(12345678, function (err, item) {
  if (err) throw err

  console.log(item)
})

### `var cr = new CopyResource(instID, wskey)`

Creates a new CopyResource instance

### `cr.read(copyID, callback)`

Accesses a single copy via `copyID`. 

### `cr.search(searchObj[, opts], callback)

Performs a search using either an OCLC number or barcode. `searchObj` is an array with either 
`oclc` or `barcode` as the key. `opts` is an object with the keys `startIndex` and `itemsPerPage`
(defaults to `1` and `10`, respectively).

### `cr.barcode(barcode[, opts], callback)`

Wrapper for `cr.search({barcode: barcode}, opts, callback)`.

### `cr.oclc(oclcNum[, opts], callback)`

Wrapper for `cr.search({oclc: oclcNum}, opts, callback)
