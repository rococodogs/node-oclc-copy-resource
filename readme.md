# node-oclc-copy-resource

Accesses [OCLC's WMS Copy Resource Service](http://www.oclc.org/developer/develop/web-services/wms-collection-management-api/copy-resource.en.html), which is a part of the Collection Management API.

## Usage

```javascript
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
```

### `var cr = new CopyResource(instID, wskey)`

Creates a new CopyResource instance

### `cr.read(copyID, callback)`

Accesses a single copy via `copyID`.

### `cr.search(searchObj[, opts], callback)`

Performs a search using either an OCLC number or barcode. `searchObj` is an object with either
`oclc` or `barcode` as the key. `opts` is an object with the keys `startIndex` and `itemsPerPage`
(defaults to `1` and `10`, respectively).

### `cr.barcode(barcode[, opts], callback)`

Wrapper for `cr.search({barcode: barcode}, opts, callback)`.

### `cr.oclc(oclcNum[, opts], callback)`

Wrapper for `cr.search({oclc: oclcNum}, opts, callback)

### `cr.update(copyID || searchObj, opts, transformFunction, callback)`

**NOTE** this is _super_ experimental and could have bad consequences if not
used carefully (like, wipe-away-all-of-your-copy-data-for-an-item bad).

Adds update support. Retrieves the copy resource object using `cr.read`
when a copyID is provided, or `cr.search` when a search object is provided.
The `opts` parameter is optional and is only passed to search operations. Only
barcode searching is provided and **is not recommended** if updating
periodicals or items with many (> 10) copies attached (see below).

`transformFunction` is a user-provided function that edits the copy resource
document (which is passed as its sole parameter). This function should return
the updated document, which will then be converted to XML and `PUT` to the
OCLC servers. `callback` receives `function (err, result) {}` and is optional
(but note that any errors that occur are passed to this function).

When updating the copy resource document, be sure to stick with OCLC's JSON
conventions (elements that are arrays vs. not). The [xmlify](https://github.com/malantonio/wms-xmlify-copy-resource)
transform function is a little lenient with some elements, but isn't entirely
consistent (I'm workin' on it!).

#### usage

```javascript
cr = new CopyResource(128807, wskey)
cr.update(12345678, transform, callback)

// add a note
function transform (doc) {
  doc.holding[0].note.push({type: 'PUBLIC', value: 'Staff Pick, 3/2016'})
  return doc
}

function callback (err, result) {
  if (err) {
    // handle the error
  }

  else {
    // handle the updated copy resource record
  }
}
```

Example: Handling items with multiple holdings using a barcode

```javascript
var search = {barcode: 31542002390221}
cr.update(search, transform, callback)

function transform (doc) {
  var holdings = doc.holding
  holding.forEach(function (h) {
    if (h.pieceDesignation.indexOf(search.barcode) > -1) {
      h.note.push({type: 'PUBLIC', value: 'Staff Pick, 3/2016'})
    }
  })

  doc.holding = holdings
  return doc
}
```
