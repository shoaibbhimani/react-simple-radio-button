var global = Function("return this;")();
/*!
  * Ender: open module JavaScript framework (client-lib)
  * copyright Dustin Diaz & Jacob Thornton 2011 (@ded @fat)
  * http://ender.no.de
  * License MIT
  */
!function (context) {

  // a global object for node.js module compatiblity
  // ============================================

  context['global'] = context

  // Implements simple module system
  // losely based on CommonJS Modules spec v1.1.1
  // ============================================

  var modules = {}
    , old = context.$

  function require (identifier) {
    // modules can be required from ender's build system, or found on the window
    var module = modules[identifier] || window[identifier]
    if (!module) throw new Error("Requested module '" + identifier + "' has not been defined.")
    return module
  }

  function provide (name, what) {
    return (modules[name] = what)
  }

  context['provide'] = provide
  context['require'] = require

  function aug(o, o2) {
    for (var k in o2) k != 'noConflict' && k != '_VERSION' && (o[k] = o2[k])
    return o
  }

  function boosh(s, r, els) {
    // string || node || nodelist || window
    if (typeof s == 'string' || s.nodeName || (s.length && 'item' in s) || s == window) {
      els = ender._select(s, r)
      els.selector = s
    } else els = isFinite(s.length) ? s : [s]
    return aug(els, boosh)
  }

  function ender(s, r) {
    return boosh(s, r)
  }

  aug(ender, {
      _VERSION: '0.3.6'
    , fn: boosh // for easy compat to jQuery plugins
    , ender: function (o, chain) {
        aug(chain ? boosh : ender, o)
      }
    , _select: function (s, r) {
        return (r || document).querySelectorAll(s)
      }
  })

  aug(boosh, {
    forEach: function (fn, scope, i) {
      // opt out of native forEach so we can intentionally call our own scope
      // defaulting to the current item and be able to return self
      for (i = 0, l = this.length; i < l; ++i) i in this && fn.call(scope || this[i], this[i], i, this)
      // return self for chaining
      return this
    },
    $: ender // handy reference to self
  })

  ender.noConflict = function () {
    context.$ = old
    return this
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = ender
  // use subscript notation as extern for Closure compilation
  context['ender'] = context['$'] = context['ender'] || ender

}(this);
// pakmanager:is-stream
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    
    var isStream = module.exports = function (stream) {
    	return stream !== null && typeof stream === 'object' && typeof stream.pipe === 'function';
    };
    
    isStream.writable = function (stream) {
    	return isStream(stream) && stream.writable !== false && typeof stream._write === 'function' && typeof stream._writableState === 'object';
    };
    
    isStream.readable = function (stream) {
    	return isStream(stream) && stream.readable !== false && typeof stream._read === 'function' && typeof stream._readableState === 'object';
    };
    
    isStream.duplex = function (stream) {
    	return isStream.writable(stream) && isStream.readable(stream);
    };
    
    isStream.transform = function (stream) {
    	return isStream.duplex(stream) && typeof stream._transform === 'function' && typeof stream._transformState === 'object';
    };
    
  provide("is-stream", module.exports);
}(global));

// pakmanager:node-fetch
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  
    /**
     * index.js
     *
     * a request API compatible with window.fetch
     */
    
    var parse_url = require('url').parse;
    var resolve_url = require('url').resolve;
    var http = require('http');
    var https = require('https');
    var zlib = require('zlib');
    var stream = require('stream');
    
    var Body = require('./lib/body');
    var Response = require('./lib/response');
    var Headers = require('./lib/headers');
    var Request = require('./lib/request');
    var FetchError = require('./lib/fetch-error');
    
    // commonjs
    module.exports = Fetch;
    // es6 default export compatibility
    module.exports.default = module.exports;
    
    /**
     * Fetch class
     *
     * @param   Mixed    url   Absolute url or Request instance
     * @param   Object   opts  Fetch options
     * @return  Promise
     */
    function Fetch(url, opts) {
    
    	// allow call as function
    	if (!(this instanceof Fetch))
    		return new Fetch(url, opts);
    
    	// allow custom promise
    	if (!Fetch.Promise) {
    		throw new Error('native promise missing, set Fetch.Promise to your favorite alternative');
    	}
    
    	Body.Promise = Fetch.Promise;
    
    	var self = this;
    
    	// wrap http.request into fetch
    	return new Fetch.Promise(function(resolve, reject) {
    		// build request object
    		var options = new Request(url, opts);
    
    		if (!options.protocol || !options.hostname) {
    			throw new Error('only absolute urls are supported');
    		}
    
    		if (options.protocol !== 'http:' && options.protocol !== 'https:') {
    			throw new Error('only http(s) protocols are supported');
    		}
    
    		var send;
    		if (options.protocol === 'https:') {
    			send = https.request;
    		} else {
    			send = http.request;
    		}
    
    		// normalize headers
    		var headers = new Headers(options.headers);
    
    		if (options.compress) {
    			headers.set('accept-encoding', 'gzip,deflate');
    		}
    
    		if (!headers.has('user-agent')) {
    			headers.set('user-agent', 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)');
    		}
    
    		if (!headers.has('connection') && !options.agent) {
    			headers.set('connection', 'close');
    		}
    
    		if (!headers.has('accept')) {
    			headers.set('accept', '*/*');
    		}
    
    		// detect form data input from form-data module, this hack avoid the need to pass multipart header manually
    		if (!headers.has('content-type') && options.body && typeof options.body.getBoundary === 'function') {
    			headers.set('content-type', 'multipart/form-data; boundary=' + options.body.getBoundary());
    		}
    
    		// bring node-fetch closer to browser behavior by setting content-length automatically
    		if (!headers.has('content-length') && /post|put|patch|delete/i.test(options.method)) {
    			if (typeof options.body === 'string') {
    				headers.set('content-length', Buffer.byteLength(options.body));
    			// detect form data input from form-data module, this hack avoid the need to add content-length header manually
    			} else if (options.body && typeof options.body.getLengthSync === 'function') {
    				// for form-data 1.x
    				if (options.body._lengthRetrievers && options.body._lengthRetrievers.length == 0) {
    					headers.set('content-length', options.body.getLengthSync().toString());
    				// for form-data 2.x
    				} else if (options.body.hasKnownLength && options.body.hasKnownLength()) {
    					headers.set('content-length', options.body.getLengthSync().toString());
    				}
    			// this is only necessary for older nodejs releases (before iojs merge)
    			} else if (options.body === undefined || options.body === null) {
    				headers.set('content-length', '0');
    			}
    		}
    
    		options.headers = headers.raw();
    
    		// http.request only support string as host header, this hack make custom host header possible
    		if (options.headers.host) {
    			options.headers.host = options.headers.host[0];
    		}
    
    		// send request
    		var req = send(options);
    		var reqTimeout;
    
    		if (options.timeout) {
    			req.once('socket', function(socket) {
    				reqTimeout = setTimeout(function() {
    					req.abort();
    					reject(new FetchError('network timeout at: ' + options.url, 'request-timeout'));
    				}, options.timeout);
    			});
    		}
    
    		req.on('error', function(err) {
    			clearTimeout(reqTimeout);
    			reject(new FetchError('request to ' + options.url + ' failed, reason: ' + err.message, 'system', err));
    		});
    
    		req.on('response', function(res) {
    			clearTimeout(reqTimeout);
    
    			// handle redirect
    			if (self.isRedirect(res.statusCode) && options.redirect !== 'manual') {
    				if (options.redirect === 'error') {
    					reject(new FetchError('redirect mode is set to error: ' + options.url, 'no-redirect'));
    					return;
    				}
    
    				if (options.counter >= options.follow) {
    					reject(new FetchError('maximum redirect reached at: ' + options.url, 'max-redirect'));
    					return;
    				}
    
    				if (!res.headers.location) {
    					reject(new FetchError('redirect location header missing at: ' + options.url, 'invalid-redirect'));
    					return;
    				}
    
    				// per fetch spec, for POST request with 301/302 response, or any request with 303 response, use GET when following redirect
    				if (res.statusCode === 303
    					|| ((res.statusCode === 301 || res.statusCode === 302) && options.method === 'POST'))
    				{
    					options.method = 'GET';
    					delete options.body;
    					delete options.headers['content-length'];
    				}
    
    				options.counter++;
    
    				resolve(Fetch(resolve_url(options.url, res.headers.location), options));
    				return;
    			}
    
    			// normalize location header for manual redirect mode
    			var headers = new Headers(res.headers);
    			if (options.redirect === 'manual' && headers.has('location')) {
    				headers.set('location', resolve_url(options.url, headers.get('location')));
    			}
    
    			// prepare response
    			var body = res.pipe(new stream.PassThrough());
    			var response_options = {
    				url: options.url
    				, status: res.statusCode
    				, statusText: res.statusMessage
    				, headers: headers
    				, size: options.size
    				, timeout: options.timeout
    			};
    
    			// response object
    			var output;
    
    			// in following scenarios we ignore compression support
    			// 1. compression support is disabled
    			// 2. HEAD request
    			// 3. no content-encoding header
    			// 4. no content response (204)
    			// 5. content not modified response (304)
    			if (!options.compress || options.method === 'HEAD' || !headers.has('content-encoding') || res.statusCode === 204 || res.statusCode === 304) {
    				output = new Response(body, response_options);
    				resolve(output);
    				return;
    			}
    
    			// otherwise, check for gzip or deflate
    			var name = headers.get('content-encoding');
    
    			// for gzip
    			if (name == 'gzip' || name == 'x-gzip') {
    				body = body.pipe(zlib.createGunzip());
    				output = new Response(body, response_options);
    				resolve(output);
    				return;
    
    			// for deflate
    			} else if (name == 'deflate' || name == 'x-deflate') {
    				// handle the infamous raw deflate response from old servers
    				// a hack for old IIS and Apache servers
    				var raw = res.pipe(new stream.PassThrough());
    				raw.once('data', function(chunk) {
    					// see http://stackoverflow.com/questions/37519828
    					if ((chunk[0] & 0x0F) === 0x08) {
    						body = body.pipe(zlib.createInflate());
    					} else {
    						body = body.pipe(zlib.createInflateRaw());
    					}
    					output = new Response(body, response_options);
    					resolve(output);
    				});
    				return;
    			}
    
    			// otherwise, use response as-is
    			output = new Response(body, response_options);
    			resolve(output);
    			return;
    		});
    
    		// accept string, buffer or readable stream as body
    		// per spec we will call tostring on non-stream objects
    		if (typeof options.body === 'string') {
    			req.write(options.body);
    			req.end();
    		} else if (options.body instanceof Buffer) {
    			req.write(options.body);
    			req.end();
    		} else if (typeof options.body === 'object' && options.body.pipe) {
    			options.body.pipe(req);
    		} else if (typeof options.body === 'object') {
    			req.write(options.body.toString());
    			req.end();
    		} else {
    			req.end();
    		}
    	});
    
    };
    
    /**
     * Redirect code matching
     *
     * @param   Number   code  Status code
     * @return  Boolean
     */
    Fetch.prototype.isRedirect = function(code) {
    	return code === 301 || code === 302 || code === 303 || code === 307 || code === 308;
    }
    
    // expose Promise
    Fetch.Promise = global.Promise;
    Fetch.Response = Response;
    Fetch.Headers = Headers;
    Fetch.Request = Request;
    
  provide("node-fetch", module.exports);
}(global));

// pakmanager:whatwg-fetch
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  (function(self) {
      'use strict';
    
      if (self.fetch) {
        return
      }
    
      var support = {
        searchParams: 'URLSearchParams' in self,
        iterable: 'Symbol' in self && 'iterator' in Symbol,
        blob: 'FileReader' in self && 'Blob' in self && (function() {
          try {
            new Blob()
            return true
          } catch(e) {
            return false
          }
        })(),
        formData: 'FormData' in self,
        arrayBuffer: 'ArrayBuffer' in self
      }
    
      if (support.arrayBuffer) {
        var viewClasses = [
          '[object Int8Array]',
          '[object Uint8Array]',
          '[object Uint8ClampedArray]',
          '[object Int16Array]',
          '[object Uint16Array]',
          '[object Int32Array]',
          '[object Uint32Array]',
          '[object Float32Array]',
          '[object Float64Array]'
        ]
    
        var isDataView = function(obj) {
          return obj && DataView.prototype.isPrototypeOf(obj)
        }
    
        var isArrayBufferView = ArrayBuffer.isView || function(obj) {
          return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1
        }
      }
    
      function normalizeName(name) {
        if (typeof name !== 'string') {
          name = String(name)
        }
        if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(name)) {
          throw new TypeError('Invalid character in header field name')
        }
        return name.toLowerCase()
      }
    
      function normalizeValue(value) {
        if (typeof value !== 'string') {
          value = String(value)
        }
        return value
      }
    
      // Build a destructive iterator for the value list
      function iteratorFor(items) {
        var iterator = {
          next: function() {
            var value = items.shift()
            return {done: value === undefined, value: value}
          }
        }
    
        if (support.iterable) {
          iterator[Symbol.iterator] = function() {
            return iterator
          }
        }
    
        return iterator
      }
    
      function Headers(headers) {
        this.map = {}
    
        if (headers instanceof Headers) {
          headers.forEach(function(value, name) {
            this.append(name, value)
          }, this)
        } else if (Array.isArray(headers)) {
          headers.forEach(function(header) {
            this.append(header[0], header[1])
          }, this)
        } else if (headers) {
          Object.getOwnPropertyNames(headers).forEach(function(name) {
            this.append(name, headers[name])
          }, this)
        }
      }
    
      Headers.prototype.append = function(name, value) {
        name = normalizeName(name)
        value = normalizeValue(value)
        var oldValue = this.map[name]
        this.map[name] = oldValue ? oldValue+','+value : value
      }
    
      Headers.prototype['delete'] = function(name) {
        delete this.map[normalizeName(name)]
      }
    
      Headers.prototype.get = function(name) {
        name = normalizeName(name)
        return this.has(name) ? this.map[name] : null
      }
    
      Headers.prototype.has = function(name) {
        return this.map.hasOwnProperty(normalizeName(name))
      }
    
      Headers.prototype.set = function(name, value) {
        this.map[normalizeName(name)] = normalizeValue(value)
      }
    
      Headers.prototype.forEach = function(callback, thisArg) {
        for (var name in this.map) {
          if (this.map.hasOwnProperty(name)) {
            callback.call(thisArg, this.map[name], name, this)
          }
        }
      }
    
      Headers.prototype.keys = function() {
        var items = []
        this.forEach(function(value, name) { items.push(name) })
        return iteratorFor(items)
      }
    
      Headers.prototype.values = function() {
        var items = []
        this.forEach(function(value) { items.push(value) })
        return iteratorFor(items)
      }
    
      Headers.prototype.entries = function() {
        var items = []
        this.forEach(function(value, name) { items.push([name, value]) })
        return iteratorFor(items)
      }
    
      if (support.iterable) {
        Headers.prototype[Symbol.iterator] = Headers.prototype.entries
      }
    
      function consumed(body) {
        if (body.bodyUsed) {
          return Promise.reject(new TypeError('Already read'))
        }
        body.bodyUsed = true
      }
    
      function fileReaderReady(reader) {
        return new Promise(function(resolve, reject) {
          reader.onload = function() {
            resolve(reader.result)
          }
          reader.onerror = function() {
            reject(reader.error)
          }
        })
      }
    
      function readBlobAsArrayBuffer(blob) {
        var reader = new FileReader()
        var promise = fileReaderReady(reader)
        reader.readAsArrayBuffer(blob)
        return promise
      }
    
      function readBlobAsText(blob) {
        var reader = new FileReader()
        var promise = fileReaderReady(reader)
        reader.readAsText(blob)
        return promise
      }
    
      function readArrayBufferAsText(buf) {
        var view = new Uint8Array(buf)
        var chars = new Array(view.length)
    
        for (var i = 0; i < view.length; i++) {
          chars[i] = String.fromCharCode(view[i])
        }
        return chars.join('')
      }
    
      function bufferClone(buf) {
        if (buf.slice) {
          return buf.slice(0)
        } else {
          var view = new Uint8Array(buf.byteLength)
          view.set(new Uint8Array(buf))
          return view.buffer
        }
      }
    
      function Body() {
        this.bodyUsed = false
    
        this._initBody = function(body) {
          this._bodyInit = body
          if (!body) {
            this._bodyText = ''
          } else if (typeof body === 'string') {
            this._bodyText = body
          } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
            this._bodyBlob = body
          } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
            this._bodyFormData = body
          } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
            this._bodyText = body.toString()
          } else if (support.arrayBuffer && support.blob && isDataView(body)) {
            this._bodyArrayBuffer = bufferClone(body.buffer)
            // IE 10-11 can't handle a DataView body.
            this._bodyInit = new Blob([this._bodyArrayBuffer])
          } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
            this._bodyArrayBuffer = bufferClone(body)
          } else {
            throw new Error('unsupported BodyInit type')
          }
    
          if (!this.headers.get('content-type')) {
            if (typeof body === 'string') {
              this.headers.set('content-type', 'text/plain;charset=UTF-8')
            } else if (this._bodyBlob && this._bodyBlob.type) {
              this.headers.set('content-type', this._bodyBlob.type)
            } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
              this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8')
            }
          }
        }
    
        if (support.blob) {
          this.blob = function() {
            var rejected = consumed(this)
            if (rejected) {
              return rejected
            }
    
            if (this._bodyBlob) {
              return Promise.resolve(this._bodyBlob)
            } else if (this._bodyArrayBuffer) {
              return Promise.resolve(new Blob([this._bodyArrayBuffer]))
            } else if (this._bodyFormData) {
              throw new Error('could not read FormData body as blob')
            } else {
              return Promise.resolve(new Blob([this._bodyText]))
            }
          }
    
          this.arrayBuffer = function() {
            if (this._bodyArrayBuffer) {
              return consumed(this) || Promise.resolve(this._bodyArrayBuffer)
            } else {
              return this.blob().then(readBlobAsArrayBuffer)
            }
          }
        }
    
        this.text = function() {
          var rejected = consumed(this)
          if (rejected) {
            return rejected
          }
    
          if (this._bodyBlob) {
            return readBlobAsText(this._bodyBlob)
          } else if (this._bodyArrayBuffer) {
            return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer))
          } else if (this._bodyFormData) {
            throw new Error('could not read FormData body as text')
          } else {
            return Promise.resolve(this._bodyText)
          }
        }
    
        if (support.formData) {
          this.formData = function() {
            return this.text().then(decode)
          }
        }
    
        this.json = function() {
          return this.text().then(JSON.parse)
        }
    
        return this
      }
    
      // HTTP methods whose capitalization should be normalized
      var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT']
    
      function normalizeMethod(method) {
        var upcased = method.toUpperCase()
        return (methods.indexOf(upcased) > -1) ? upcased : method
      }
    
      function Request(input, options) {
        options = options || {}
        var body = options.body
    
        if (input instanceof Request) {
          if (input.bodyUsed) {
            throw new TypeError('Already read')
          }
          this.url = input.url
          this.credentials = input.credentials
          if (!options.headers) {
            this.headers = new Headers(input.headers)
          }
          this.method = input.method
          this.mode = input.mode
          if (!body && input._bodyInit != null) {
            body = input._bodyInit
            input.bodyUsed = true
          }
        } else {
          this.url = String(input)
        }
    
        this.credentials = options.credentials || this.credentials || 'omit'
        if (options.headers || !this.headers) {
          this.headers = new Headers(options.headers)
        }
        this.method = normalizeMethod(options.method || this.method || 'GET')
        this.mode = options.mode || this.mode || null
        this.referrer = null
    
        if ((this.method === 'GET' || this.method === 'HEAD') && body) {
          throw new TypeError('Body not allowed for GET or HEAD requests')
        }
        this._initBody(body)
      }
    
      Request.prototype.clone = function() {
        return new Request(this, { body: this._bodyInit })
      }
    
      function decode(body) {
        var form = new FormData()
        body.trim().split('&').forEach(function(bytes) {
          if (bytes) {
            var split = bytes.split('=')
            var name = split.shift().replace(/\+/g, ' ')
            var value = split.join('=').replace(/\+/g, ' ')
            form.append(decodeURIComponent(name), decodeURIComponent(value))
          }
        })
        return form
      }
    
      function parseHeaders(rawHeaders) {
        var headers = new Headers()
        rawHeaders.split(/\r?\n/).forEach(function(line) {
          var parts = line.split(':')
          var key = parts.shift().trim()
          if (key) {
            var value = parts.join(':').trim()
            headers.append(key, value)
          }
        })
        return headers
      }
    
      Body.call(Request.prototype)
    
      function Response(bodyInit, options) {
        if (!options) {
          options = {}
        }
    
        this.type = 'default'
        this.status = 'status' in options ? options.status : 200
        this.ok = this.status >= 200 && this.status < 300
        this.statusText = 'statusText' in options ? options.statusText : 'OK'
        this.headers = new Headers(options.headers)
        this.url = options.url || ''
        this._initBody(bodyInit)
      }
    
      Body.call(Response.prototype)
    
      Response.prototype.clone = function() {
        return new Response(this._bodyInit, {
          status: this.status,
          statusText: this.statusText,
          headers: new Headers(this.headers),
          url: this.url
        })
      }
    
      Response.error = function() {
        var response = new Response(null, {status: 0, statusText: ''})
        response.type = 'error'
        return response
      }
    
      var redirectStatuses = [301, 302, 303, 307, 308]
    
      Response.redirect = function(url, status) {
        if (redirectStatuses.indexOf(status) === -1) {
          throw new RangeError('Invalid status code')
        }
    
        return new Response(null, {status: status, headers: {location: url}})
      }
    
      self.Headers = Headers
      self.Request = Request
      self.Response = Response
    
      self.fetch = function(input, init) {
        return new Promise(function(resolve, reject) {
          var request = new Request(input, init)
          var xhr = new XMLHttpRequest()
    
          xhr.onload = function() {
            var options = {
              status: xhr.status,
              statusText: xhr.statusText,
              headers: parseHeaders(xhr.getAllResponseHeaders() || '')
            }
            options.url = 'responseURL' in xhr ? xhr.responseURL : options.headers.get('X-Request-URL')
            var body = 'response' in xhr ? xhr.response : xhr.responseText
            resolve(new Response(body, options))
          }
    
          xhr.onerror = function() {
            reject(new TypeError('Network request failed'))
          }
    
          xhr.ontimeout = function() {
            reject(new TypeError('Network request failed'))
          }
    
          xhr.open(request.method, request.url, true)
    
          if (request.credentials === 'include') {
            xhr.withCredentials = true
          }
    
          if ('responseType' in xhr && support.blob) {
            xhr.responseType = 'blob'
          }
    
          request.headers.forEach(function(value, name) {
            xhr.setRequestHeader(name, value)
          })
    
          xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit)
        })
      }
      self.fetch.polyfill = true
    })(typeof self !== 'undefined' ? self : this);
    
  provide("whatwg-fetch", module.exports);
}(global));

// pakmanager:js-tokens
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // Copyright 2014, 2015, 2016, 2017 Simon Lydell
    // License: MIT. (See LICENSE.)
    
    Object.defineProperty(exports, "__esModule", {
      value: true
    })
    
    // This regex comes from regex.coffee, and is inserted here by generate-index.js
    // (run `npm run build`).
    exports.default = /((['"])(?:(?!\2|\\).|\\(?:\r\n|[\s\S]))*(\2)?|`(?:[^`\\$]|\\[\s\S]|\$(?!\{)|\$\{(?:[^{}]|\{[^}]*\}?)*\}?)*(`)?)|(\/\/.*)|(\/\*(?:[^*]|\*(?!\/))*(\*\/)?)|(\/(?!\*)(?:\[(?:(?![\]\\]).|\\.)*\]|(?![\/\]\\]).|\\.)+\/(?:(?!\s*(?:\b|[\u0080-\uFFFF$\\'"~({]|[+\-!](?!=)|\.?\d))|[gmiyu]{1,5}\b(?![\u0080-\uFFFF$\\]|\s*(?:[+\-*%&|^<>!=?({]|\/(?![\/*])))))|(0[xX][\da-fA-F]+|0[oO][0-7]+|0[bB][01]+|(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?)|((?!\d)(?:(?!\s)[$\w\u0080-\uFFFF]|\\u[\da-fA-F]{4}|\\u\{[\da-fA-F]+\})+)|(--|\+\+|&&|\|\||=>|\.{3}|(?:[+\-\/%&|^]|\*{1,2}|<{1,2}|>{1,3}|!=?|={1,2})=?|[?~.,:;[\](){}])|(\s+)|(^$|[\s\S])/g
    
    exports.matchToToken = function(match) {
      var token = {type: "invalid", value: match[0]}
           if (match[ 1]) token.type = "string" , token.closed = !!(match[3] || match[4])
      else if (match[ 5]) token.type = "comment"
      else if (match[ 6]) token.type = "comment", token.closed = !!match[7]
      else if (match[ 8]) token.type = "regex"
      else if (match[ 9]) token.type = "number"
      else if (match[10]) token.type = "name"
      else if (match[11]) token.type = "punctuator"
      else if (match[12]) token.type = "whitespace"
      return token
    }
    
  provide("js-tokens", module.exports);
}(global));

// pakmanager:asap/raw
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  "use strict";
    
    var domain; // The domain module is executed on demand
    var hasSetImmediate = typeof setImmediate === "function";
    
    // Use the fastest means possible to execute a task in its own turn, with
    // priority over other events including network IO events in Node.js.
    //
    // An exception thrown by a task will permanently interrupt the processing of
    // subsequent tasks. The higher level `asap` function ensures that if an
    // exception is thrown by a task, that the task queue will continue flushing as
    // soon as possible, but if you use `rawAsap` directly, you are responsible to
    // either ensure that no exceptions are thrown from your task, or to manually
    // call `rawAsap.requestFlush` if an exception is thrown.
    module.exports = rawAsap;
    function rawAsap(task) {
        if (!queue.length) {
            requestFlush();
            flushing = true;
        }
        // Avoids a function call
        queue[queue.length] = task;
    }
    
    var queue = [];
    // Once a flush has been requested, no further calls to `requestFlush` are
    // necessary until the next `flush` completes.
    var flushing = false;
    // The position of the next task to execute in the task queue. This is
    // preserved between calls to `flush` so that it can be resumed if
    // a task throws an exception.
    var index = 0;
    // If a task schedules additional tasks recursively, the task queue can grow
    // unbounded. To prevent memory excaustion, the task queue will periodically
    // truncate already-completed tasks.
    var capacity = 1024;
    
    // The flush function processes all tasks that have been scheduled with
    // `rawAsap` unless and until one of those tasks throws an exception.
    // If a task throws an exception, `flush` ensures that its state will remain
    // consistent and will resume where it left off when called again.
    // However, `flush` does not make any arrangements to be called again if an
    // exception is thrown.
    function flush() {
        while (index < queue.length) {
            var currentIndex = index;
            // Advance the index before calling the task. This ensures that we will
            // begin flushing on the next task the task throws an error.
            index = index + 1;
            queue[currentIndex].call();
            // Prevent leaking memory for long chains of recursive calls to `asap`.
            // If we call `asap` within tasks scheduled by `asap`, the queue will
            // grow, but to avoid an O(n) walk for every task we execute, we don't
            // shift tasks off the queue after they have been executed.
            // Instead, we periodically shift 1024 tasks off the queue.
            if (index > capacity) {
                // Manually shift all values starting at the index back to the
                // beginning of the queue.
                for (var scan = 0, newLength = queue.length - index; scan < newLength; scan++) {
                    queue[scan] = queue[scan + index];
                }
                queue.length -= index;
                index = 0;
            }
        }
        queue.length = 0;
        index = 0;
        flushing = false;
    }
    
    rawAsap.requestFlush = requestFlush;
    function requestFlush() {
        // Ensure flushing is not bound to any domain.
        // It is not sufficient to exit the domain, because domains exist on a stack.
        // To execute code outside of any domain, the following dance is necessary.
        var parentDomain = process.domain;
        if (parentDomain) {
            if (!domain) {
                // Lazy execute the domain module.
                // Only employed if the user elects to use domains.
                domain = require("domain");
            }
            domain.active = process.domain = null;
        }
    
        // `setImmediate` is slower that `process.nextTick`, but `process.nextTick`
        // cannot handle recursion.
        // `requestFlush` will only be called recursively from `asap.js`, to resume
        // flushing after an error is thrown into a domain.
        // Conveniently, `setImmediate` was introduced in the same version
        // `process.nextTick` started throwing recursion errors.
        if (flushing && hasSetImmediate) {
            setImmediate(flush);
        } else {
            process.nextTick(flush);
        }
    
        if (parentDomain) {
            domain.active = process.domain = parentDomain;
        }
    }
    
  provide("asap/raw", module.exports);
}(global));

// pakmanager:asap
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  "use strict";
    
    var rawAsap =  require('asap/raw');
    var freeTasks = [];
    
    /**
     * Calls a task as soon as possible after returning, in its own event, with
     * priority over IO events. An exception thrown in a task can be handled by
     * `process.on("uncaughtException") or `domain.on("error")`, but will otherwise
     * crash the process. If the error is handled, all subsequent tasks will
     * resume.
     *
     * @param {{call}} task A callable object, typically a function that takes no
     * arguments.
     */
    module.exports = asap;
    function asap(task) {
        var rawTask;
        if (freeTasks.length) {
            rawTask = freeTasks.pop();
        } else {
            rawTask = new RawTask();
        }
        rawTask.task = task;
        rawTask.domain = process.domain;
        rawAsap(rawTask);
    }
    
    function RawTask() {
        this.task = null;
        this.domain = null;
    }
    
    RawTask.prototype.call = function () {
        if (this.domain) {
            this.domain.enter();
        }
        var threw = true;
        try {
            this.task.call();
            threw = false;
            // If the task throws an exception (presumably) Node.js restores the
            // domain stack for the next event.
            if (this.domain) {
                this.domain.exit();
            }
        } finally {
            // We use try/finally and a threw flag to avoid messing up stack traces
            // when we catch and release errors.
            if (threw) {
                // In Node.js, uncaught exceptions are considered fatal errors.
                // Re-throw them to interrupt flushing!
                // Ensure that flushing continues if an uncaught exception is
                // suppressed listening process.on("uncaughtException") or
                // domain.on("error").
                rawAsap.requestFlush();
            }
            // If the task threw an error, we do not want to exit the domain here.
            // Exiting the domain would prevent the domain from catching the error.
            this.task = null;
            this.domain = null;
            freeTasks.push(this);
        }
    };
    
    
  provide("asap", module.exports);
}(global));

// pakmanager:core-js/shim
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  require('./modules/es5');
    require('./modules/es6.symbol');
    require('./modules/es6.object.assign');
    require('./modules/es6.object.is');
    require('./modules/es6.object.set-prototype-of');
    require('./modules/es6.object.to-string');
    require('./modules/es6.object.freeze');
    require('./modules/es6.object.seal');
    require('./modules/es6.object.prevent-extensions');
    require('./modules/es6.object.is-frozen');
    require('./modules/es6.object.is-sealed');
    require('./modules/es6.object.is-extensible');
    require('./modules/es6.object.get-own-property-descriptor');
    require('./modules/es6.object.get-prototype-of');
    require('./modules/es6.object.keys');
    require('./modules/es6.object.get-own-property-names');
    require('./modules/es6.function.name');
    require('./modules/es6.function.has-instance');
    require('./modules/es6.number.constructor');
    require('./modules/es6.number.epsilon');
    require('./modules/es6.number.is-finite');
    require('./modules/es6.number.is-integer');
    require('./modules/es6.number.is-nan');
    require('./modules/es6.number.is-safe-integer');
    require('./modules/es6.number.max-safe-integer');
    require('./modules/es6.number.min-safe-integer');
    require('./modules/es6.number.parse-float');
    require('./modules/es6.number.parse-int');
    require('./modules/es6.math.acosh');
    require('./modules/es6.math.asinh');
    require('./modules/es6.math.atanh');
    require('./modules/es6.math.cbrt');
    require('./modules/es6.math.clz32');
    require('./modules/es6.math.cosh');
    require('./modules/es6.math.expm1');
    require('./modules/es6.math.fround');
    require('./modules/es6.math.hypot');
    require('./modules/es6.math.imul');
    require('./modules/es6.math.log10');
    require('./modules/es6.math.log1p');
    require('./modules/es6.math.log2');
    require('./modules/es6.math.sign');
    require('./modules/es6.math.sinh');
    require('./modules/es6.math.tanh');
    require('./modules/es6.math.trunc');
    require('./modules/es6.string.from-code-point');
    require('./modules/es6.string.raw');
    require('./modules/es6.string.trim');
    require('./modules/es6.string.iterator');
    require('./modules/es6.string.code-point-at');
    require('./modules/es6.string.ends-with');
    require('./modules/es6.string.includes');
    require('./modules/es6.string.repeat');
    require('./modules/es6.string.starts-with');
    require('./modules/es6.array.from');
    require('./modules/es6.array.of');
    require('./modules/es6.array.iterator');
    require('./modules/es6.array.species');
    require('./modules/es6.array.copy-within');
    require('./modules/es6.array.fill');
    require('./modules/es6.array.find');
    require('./modules/es6.array.find-index');
    require('./modules/es6.regexp.constructor');
    require('./modules/es6.regexp.flags');
    require('./modules/es6.regexp.match');
    require('./modules/es6.regexp.replace');
    require('./modules/es6.regexp.search');
    require('./modules/es6.regexp.split');
    require('./modules/es6.promise');
    require('./modules/es6.map');
    require('./modules/es6.set');
    require('./modules/es6.weak-map');
    require('./modules/es6.weak-set');
    require('./modules/es6.reflect.apply');
    require('./modules/es6.reflect.construct');
    require('./modules/es6.reflect.define-property');
    require('./modules/es6.reflect.delete-property');
    require('./modules/es6.reflect.enumerate');
    require('./modules/es6.reflect.get');
    require('./modules/es6.reflect.get-own-property-descriptor');
    require('./modules/es6.reflect.get-prototype-of');
    require('./modules/es6.reflect.has');
    require('./modules/es6.reflect.is-extensible');
    require('./modules/es6.reflect.own-keys');
    require('./modules/es6.reflect.prevent-extensions');
    require('./modules/es6.reflect.set');
    require('./modules/es6.reflect.set-prototype-of');
    require('./modules/es7.array.includes');
    require('./modules/es7.string.at');
    require('./modules/es7.string.pad-left');
    require('./modules/es7.string.pad-right');
    require('./modules/es7.string.trim-left');
    require('./modules/es7.string.trim-right');
    require('./modules/es7.regexp.escape');
    require('./modules/es7.object.get-own-property-descriptors');
    require('./modules/es7.object.values');
    require('./modules/es7.object.entries');
    require('./modules/es7.map.to-json');
    require('./modules/es7.set.to-json');
    require('./modules/js.array.statics');
    require('./modules/web.timers');
    require('./modules/web.immediate');
    require('./modules/web.dom.iterable');
    module.exports = require('./modules/$.core');
  provide("core-js/shim", module.exports);
}(global));

// pakmanager:core-js
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
   require('core-js/shim');
    require('./modules/core.dict');
    require('./modules/core.get-iterator-method');
    require('./modules/core.get-iterator');
    require('./modules/core.is-iterable');
    require('./modules/core.delay');
    require('./modules/core.function.part');
    require('./modules/core.object.is-object');
    require('./modules/core.object.classof');
    require('./modules/core.object.define');
    require('./modules/core.object.make');
    require('./modules/core.number.iterator');
    require('./modules/core.string.escape-html');
    require('./modules/core.string.unescape-html');
    require('./modules/core.log');
    module.exports = require('./modules/$.core');
  provide("core-js", module.exports);
}(global));

// pakmanager:isomorphic-fetch
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  "use strict";
    
    var realFetch = require('node-fetch');
    module.exports = function(url, options) {
    	if (/^\/\//.test(url)) {
    		url = 'https:' + url;
    	}
    	return realFetch.call(this, url, options);
    };
    
    if (!global.fetch) {
    	global.fetch = module.exports;
    	global.Response = realFetch.Response;
    	global.Headers = realFetch.Headers;
    	global.Request = realFetch.Request;
    }
    
  provide("isomorphic-fetch", module.exports);
}(global));

// pakmanager:loose-envify
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    
    module.exports =   require('loose-envify')(process.env);
    
  provide("loose-envify", module.exports);
}(global));

// pakmanager:object-assign
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /*
    object-assign
    (c) Sindre Sorhus
    @license MIT
    */
    
    'use strict';
    /* eslint-disable no-unused-vars */
    var getOwnPropertySymbols = Object.getOwnPropertySymbols;
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    var propIsEnumerable = Object.prototype.propertyIsEnumerable;
    
    function toObject(val) {
    	if (val === null || val === undefined) {
    		throw new TypeError('Object.assign cannot be called with null or undefined');
    	}
    
    	return Object(val);
    }
    
    function shouldUseNative() {
    	try {
    		if (!Object.assign) {
    			return false;
    		}
    
    		// Detect buggy property enumeration order in older V8 versions.
    
    		// https://bugs.chromium.org/p/v8/issues/detail?id=4118
    		var test1 = new String('abc');  // eslint-disable-line no-new-wrappers
    		test1[5] = 'de';
    		if (Object.getOwnPropertyNames(test1)[0] === '5') {
    			return false;
    		}
    
    		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
    		var test2 = {};
    		for (var i = 0; i < 10; i++) {
    			test2['_' + String.fromCharCode(i)] = i;
    		}
    		var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
    			return test2[n];
    		});
    		if (order2.join('') !== '0123456789') {
    			return false;
    		}
    
    		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
    		var test3 = {};
    		'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
    			test3[letter] = letter;
    		});
    		if (Object.keys(Object.assign({}, test3)).join('') !==
    				'abcdefghijklmnopqrst') {
    			return false;
    		}
    
    		return true;
    	} catch (err) {
    		// We don't expect any of the above to throw, but better to be safe.
    		return false;
    	}
    }
    
    module.exports = shouldUseNative() ? Object.assign : function (target, source) {
    	var from;
    	var to = toObject(target);
    	var symbols;
    
    	for (var s = 1; s < arguments.length; s++) {
    		from = Object(arguments[s]);
    
    		for (var key in from) {
    			if (hasOwnProperty.call(from, key)) {
    				to[key] = from[key];
    			}
    		}
    
    		if (getOwnPropertySymbols) {
    			symbols = getOwnPropertySymbols(from);
    			for (var i = 0; i < symbols.length; i++) {
    				if (propIsEnumerable.call(from, symbols[i])) {
    					to[symbols[i]] = from[symbols[i]];
    				}
    			}
    		}
    	}
    
    	return to;
    };
    
  provide("object-assign", module.exports);
}(global));

// pakmanager:promise/lib
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    
    module.exports = require('./core.js');
    require('./done.js');
    require('./finally.js');
    require('./es6-extensions.js');
    require('./node-extensions.js');
    require('./synchronous.js');
    
  provide("promise/lib", module.exports);
}(global));

// pakmanager:promise
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    
    module.exports =  require('promise/lib')
    
  provide("promise", module.exports);
}(global));

// pakmanager:setimmediate
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  (function (global, undefined) {
        "use strict";
    
        if (global.setImmediate) {
            return;
        }
    
        var nextHandle = 1; // Spec says greater than zero
        var tasksByHandle = {};
        var currentlyRunningATask = false;
        var doc = global.document;
        var registerImmediate;
    
        function setImmediate(callback) {
          // Callback can either be a function or a string
          if (typeof callback !== "function") {
            callback = new Function("" + callback);
          }
          // Copy function arguments
          var args = new Array(arguments.length - 1);
          for (var i = 0; i < args.length; i++) {
              args[i] = arguments[i + 1];
          }
          // Store and register the task
          var task = { callback: callback, args: args };
          tasksByHandle[nextHandle] = task;
          registerImmediate(nextHandle);
          return nextHandle++;
        }
    
        function clearImmediate(handle) {
            delete tasksByHandle[handle];
        }
    
        function run(task) {
            var callback = task.callback;
            var args = task.args;
            switch (args.length) {
            case 0:
                callback();
                break;
            case 1:
                callback(args[0]);
                break;
            case 2:
                callback(args[0], args[1]);
                break;
            case 3:
                callback(args[0], args[1], args[2]);
                break;
            default:
                callback.apply(undefined, args);
                break;
            }
        }
    
        function runIfPresent(handle) {
            // From the spec: "Wait until any invocations of this algorithm started before this one have completed."
            // So if we're currently running a task, we'll need to delay this invocation.
            if (currentlyRunningATask) {
                // Delay by doing a setTimeout. setImmediate was tried instead, but in Firefox 7 it generated a
                // "too much recursion" error.
                setTimeout(runIfPresent, 0, handle);
            } else {
                var task = tasksByHandle[handle];
                if (task) {
                    currentlyRunningATask = true;
                    try {
                        run(task);
                    } finally {
                        clearImmediate(handle);
                        currentlyRunningATask = false;
                    }
                }
            }
        }
    
        function installNextTickImplementation() {
            registerImmediate = function(handle) {
                process.nextTick(function () { runIfPresent(handle); });
            };
        }
    
        function canUsePostMessage() {
            // The test against `importScripts` prevents this implementation from being installed inside a web worker,
            // where `global.postMessage` means something completely different and can't be used for this purpose.
            if (global.postMessage && !global.importScripts) {
                var postMessageIsAsynchronous = true;
                var oldOnMessage = global.onmessage;
                global.onmessage = function() {
                    postMessageIsAsynchronous = false;
                };
                global.postMessage("", "*");
                global.onmessage = oldOnMessage;
                return postMessageIsAsynchronous;
            }
        }
    
        function installPostMessageImplementation() {
            // Installs an event handler on `global` for the `message` event: see
            // * https://developer.mozilla.org/en/DOM/window.postMessage
            // * http://www.whatwg.org/specs/web-apps/current-work/multipage/comms.html#crossDocumentMessages
    
            var messagePrefix = "setImmediate$" + Math.random() + "$";
            var onGlobalMessage = function(event) {
                if (event.source === global &&
                    typeof event.data === "string" &&
                    event.data.indexOf(messagePrefix) === 0) {
                    runIfPresent(+event.data.slice(messagePrefix.length));
                }
            };
    
            if (global.addEventListener) {
                global.addEventListener("message", onGlobalMessage, false);
            } else {
                global.attachEvent("onmessage", onGlobalMessage);
            }
    
            registerImmediate = function(handle) {
                global.postMessage(messagePrefix + handle, "*");
            };
        }
    
        function installMessageChannelImplementation() {
            var channel = new MessageChannel();
            channel.port1.onmessage = function(event) {
                var handle = event.data;
                runIfPresent(handle);
            };
    
            registerImmediate = function(handle) {
                channel.port2.postMessage(handle);
            };
        }
    
        function installReadyStateChangeImplementation() {
            var html = doc.documentElement;
            registerImmediate = function(handle) {
                // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
                // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
                var script = doc.createElement("script");
                script.onreadystatechange = function () {
                    runIfPresent(handle);
                    script.onreadystatechange = null;
                    html.removeChild(script);
                    script = null;
                };
                html.appendChild(script);
            };
        }
    
        function installSetTimeoutImplementation() {
            registerImmediate = function(handle) {
                setTimeout(runIfPresent, 0, handle);
            };
        }
    
        // If supported, we should attach to the prototype of global, since that is where setTimeout et al. live.
        var attachTo = Object.getPrototypeOf && Object.getPrototypeOf(global);
        attachTo = attachTo && attachTo.setTimeout ? attachTo : global;
    
        // Don't get fooled by e.g. browserify environments.
        if ({}.toString.call(global.process) === "[object process]") {
            // For Node.js before 0.9
            installNextTickImplementation();
    
        } else if (canUsePostMessage()) {
            // For non-IE10 modern browsers
            installPostMessageImplementation();
    
        } else if (global.MessageChannel) {
            // For web workers, where supported
            installMessageChannelImplementation();
    
        } else if (doc && "onreadystatechange" in doc.createElement("script")) {
            // For IE 6–8
            installReadyStateChangeImplementation();
    
        } else {
            // For older browsers
            installSetTimeoutImplementation();
        }
    
        attachTo.setImmediate = setImmediate;
        attachTo.clearImmediate = clearImmediate;
    }(typeof self === "undefined" ? typeof global === "undefined" ? this : global : self));
    
  provide("setimmediate", module.exports);
}(global));

// pakmanager:fbjs
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright (c) 2013-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     */
    
    'use strict';
    
    throw new Error('The fbjs package should not be required without a full path.');
    
  provide("fbjs", module.exports);
}(global));

// pakmanager:prop-types/checkPropTypes
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright 2013-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     */
    
    'use strict';
    
    if (process.env.NODE_ENV !== 'production') {
      var invariant = require('fbjs/lib/invariant');
      var warning = require('fbjs/lib/warning');
      var ReactPropTypesSecret = require('./lib/ReactPropTypesSecret');
      var loggedTypeFailures = {};
    }
    
    /**
     * Assert that the values match with the type specs.
     * Error messages are memorized and will only be shown once.
     *
     * @param {object} typeSpecs Map of name to a ReactPropType
     * @param {object} values Runtime values that need to be type-checked
     * @param {string} location e.g. "prop", "context", "child context"
     * @param {string} componentName Name of the component for error messages.
     * @param {?Function} getStack Returns the component stack.
     * @private
     */
    function checkPropTypes(typeSpecs, values, location, componentName, getStack) {
      if (process.env.NODE_ENV !== 'production') {
        for (var typeSpecName in typeSpecs) {
          if (typeSpecs.hasOwnProperty(typeSpecName)) {
            var error;
            // Prop type validation may throw. In case they do, we don't want to
            // fail the render phase where it didn't fail before. So we log it.
            // After these have been cleaned up, we'll let them throw.
            try {
              // This is intentionally an invariant that gets caught. It's the same
              // behavior as without this statement except with a better message.
              invariant(typeof typeSpecs[typeSpecName] === 'function', '%s: %s type `%s` is invalid; it must be a function, usually from ' + 'React.PropTypes.', componentName || 'React class', location, typeSpecName);
              error = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, ReactPropTypesSecret);
            } catch (ex) {
              error = ex;
            }
            warning(!error || error instanceof Error, '%s: type specification of %s `%s` is invalid; the type checker ' + 'function must return `null` or an `Error` but returned a %s. ' + 'You may have forgotten to pass an argument to the type checker ' + 'creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and ' + 'shape all require an argument).', componentName || 'React class', location, typeSpecName, typeof error);
            if (error instanceof Error && !(error.message in loggedTypeFailures)) {
              // Only monitor this failure once because there tends to be a lot of the
              // same error.
              loggedTypeFailures[error.message] = true;
    
              var stack = getStack ? getStack() : '';
    
              warning(false, 'Failed %s type: %s%s', location, error.message, stack != null ? stack : '');
            }
          }
        }
      }
    }
    
    module.exports = checkPropTypes;
    
  provide("prop-types/checkPropTypes", module.exports);
}(global));

// pakmanager:prop-types/factoryWithTypeCheckers
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright 2013-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     */
    
    'use strict';
    
    var emptyFunction = require('fbjs/lib/emptyFunction');
    var invariant = require('fbjs/lib/invariant');
    var warning = require('fbjs/lib/warning');
    
    var ReactPropTypesSecret = require('./lib/ReactPropTypesSecret');
    var checkPropTypes =  require('prop-types/checkPropTypes');
    
    module.exports = function(isValidElement, throwOnDirectAccess) {
      /* global Symbol */
      var ITERATOR_SYMBOL = typeof Symbol === 'function' && Symbol.iterator;
      var FAUX_ITERATOR_SYMBOL = '@@iterator'; // Before Symbol spec.
    
      /**
       * Returns the iterator method function contained on the iterable object.
       *
       * Be sure to invoke the function with the iterable as context:
       *
       *     var iteratorFn = getIteratorFn(myIterable);
       *     if (iteratorFn) {
       *       var iterator = iteratorFn.call(myIterable);
       *       ...
       *     }
       *
       * @param {?object} maybeIterable
       * @return {?function}
       */
      function getIteratorFn(maybeIterable) {
        var iteratorFn = maybeIterable && (ITERATOR_SYMBOL && maybeIterable[ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL]);
        if (typeof iteratorFn === 'function') {
          return iteratorFn;
        }
      }
    
      /**
       * Collection of methods that allow declaration and validation of props that are
       * supplied to React components. Example usage:
       *
       *   var Props = require('ReactPropTypes');
       *   var MyArticle = React.createClass({
       *     propTypes: {
       *       // An optional string prop named "description".
       *       description: Props.string,
       *
       *       // A required enum prop named "category".
       *       category: Props.oneOf(['News','Photos']).isRequired,
       *
       *       // A prop named "dialog" that requires an instance of Dialog.
       *       dialog: Props.instanceOf(Dialog).isRequired
       *     },
       *     render: function() { ... }
       *   });
       *
       * A more formal specification of how these methods are used:
       *
       *   type := array|bool|func|object|number|string|oneOf([...])|instanceOf(...)
       *   decl := ReactPropTypes.{type}(.isRequired)?
       *
       * Each and every declaration produces a function with the same signature. This
       * allows the creation of custom validation functions. For example:
       *
       *  var MyLink = React.createClass({
       *    propTypes: {
       *      // An optional string or URI prop named "href".
       *      href: function(props, propName, componentName) {
       *        var propValue = props[propName];
       *        if (propValue != null && typeof propValue !== 'string' &&
       *            !(propValue instanceof URI)) {
       *          return new Error(
       *            'Expected a string or an URI for ' + propName + ' in ' +
       *            componentName
       *          );
       *        }
       *      }
       *    },
       *    render: function() {...}
       *  });
       *
       * @internal
       */
    
      var ANONYMOUS = '<<anonymous>>';
    
      // Important!
      // Keep this list in sync with production version in `./factoryWithThrowingShims.js`.
      var ReactPropTypes = {
        array: createPrimitiveTypeChecker('array'),
        bool: createPrimitiveTypeChecker('boolean'),
        func: createPrimitiveTypeChecker('function'),
        number: createPrimitiveTypeChecker('number'),
        object: createPrimitiveTypeChecker('object'),
        string: createPrimitiveTypeChecker('string'),
        symbol: createPrimitiveTypeChecker('symbol'),
    
        any: createAnyTypeChecker(),
        arrayOf: createArrayOfTypeChecker,
        element: createElementTypeChecker(),
        instanceOf: createInstanceTypeChecker,
        node: createNodeChecker(),
        objectOf: createObjectOfTypeChecker,
        oneOf: createEnumTypeChecker,
        oneOfType: createUnionTypeChecker,
        shape: createShapeTypeChecker
      };
    
      /**
       * inlined Object.is polyfill to avoid requiring consumers ship their own
       * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is
       */
      /*eslint-disable no-self-compare*/
      function is(x, y) {
        // SameValue algorithm
        if (x === y) {
          // Steps 1-5, 7-10
          // Steps 6.b-6.e: +0 != -0
          return x !== 0 || 1 / x === 1 / y;
        } else {
          // Step 6.a: NaN == NaN
          return x !== x && y !== y;
        }
      }
      /*eslint-enable no-self-compare*/
    
      /**
       * We use an Error-like object for backward compatibility as people may call
       * PropTypes directly and inspect their output. However, we don't use real
       * Errors anymore. We don't inspect their stack anyway, and creating them
       * is prohibitively expensive if they are created too often, such as what
       * happens in oneOfType() for any type before the one that matched.
       */
      function PropTypeError(message) {
        this.message = message;
        this.stack = '';
      }
      // Make `instanceof Error` still work for returned errors.
      PropTypeError.prototype = Error.prototype;
    
      function createChainableTypeChecker(validate) {
        if (process.env.NODE_ENV !== 'production') {
          var manualPropTypeCallCache = {};
          var manualPropTypeWarningCount = 0;
        }
        function checkType(isRequired, props, propName, componentName, location, propFullName, secret) {
          componentName = componentName || ANONYMOUS;
          propFullName = propFullName || propName;
    
          if (secret !== ReactPropTypesSecret) {
            if (throwOnDirectAccess) {
              // New behavior only for users of `prop-types` package
              invariant(
                false,
                'Calling PropTypes validators directly is not supported by the `prop-types` package. ' +
                'Use `PropTypes.checkPropTypes()` to call them. ' +
                'Read more at http://fb.me/use-check-prop-types'
              );
            } else if (process.env.NODE_ENV !== 'production' && typeof console !== 'undefined') {
              // Old behavior for people using React.PropTypes
              var cacheKey = componentName + ':' + propName;
              if (
                !manualPropTypeCallCache[cacheKey] &&
                // Avoid spamming the console because they are often not actionable except for lib authors
                manualPropTypeWarningCount < 3
              ) {
                warning(
                  false,
                  'You are manually calling a React.PropTypes validation ' +
                  'function for the `%s` prop on `%s`. This is deprecated ' +
                  'and will throw in the standalone `prop-types` package. ' +
                  'You may be seeing this warning due to a third-party PropTypes ' +
                  'library. See https://fb.me/react-warning-dont-call-proptypes ' + 'for details.',
                  propFullName,
                  componentName
                );
                manualPropTypeCallCache[cacheKey] = true;
                manualPropTypeWarningCount++;
              }
            }
          }
          if (props[propName] == null) {
            if (isRequired) {
              if (props[propName] === null) {
                return new PropTypeError('The ' + location + ' `' + propFullName + '` is marked as required ' + ('in `' + componentName + '`, but its value is `null`.'));
              }
              return new PropTypeError('The ' + location + ' `' + propFullName + '` is marked as required in ' + ('`' + componentName + '`, but its value is `undefined`.'));
            }
            return null;
          } else {
            return validate(props, propName, componentName, location, propFullName);
          }
        }
    
        var chainedCheckType = checkType.bind(null, false);
        chainedCheckType.isRequired = checkType.bind(null, true);
    
        return chainedCheckType;
      }
    
      function createPrimitiveTypeChecker(expectedType) {
        function validate(props, propName, componentName, location, propFullName, secret) {
          var propValue = props[propName];
          var propType = getPropType(propValue);
          if (propType !== expectedType) {
            // `propValue` being instance of, say, date/regexp, pass the 'object'
            // check, but we can offer a more precise error message here rather than
            // 'of type `object`'.
            var preciseType = getPreciseType(propValue);
    
            return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + preciseType + '` supplied to `' + componentName + '`, expected ') + ('`' + expectedType + '`.'));
          }
          return null;
        }
        return createChainableTypeChecker(validate);
      }
    
      function createAnyTypeChecker() {
        return createChainableTypeChecker(emptyFunction.thatReturnsNull);
      }
    
      function createArrayOfTypeChecker(typeChecker) {
        function validate(props, propName, componentName, location, propFullName) {
          if (typeof typeChecker !== 'function') {
            return new PropTypeError('Property `' + propFullName + '` of component `' + componentName + '` has invalid PropType notation inside arrayOf.');
          }
          var propValue = props[propName];
          if (!Array.isArray(propValue)) {
            var propType = getPropType(propValue);
            return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an array.'));
          }
          for (var i = 0; i < propValue.length; i++) {
            var error = typeChecker(propValue, i, componentName, location, propFullName + '[' + i + ']', ReactPropTypesSecret);
            if (error instanceof Error) {
              return error;
            }
          }
          return null;
        }
        return createChainableTypeChecker(validate);
      }
    
      function createElementTypeChecker() {
        function validate(props, propName, componentName, location, propFullName) {
          var propValue = props[propName];
          if (!isValidElement(propValue)) {
            var propType = getPropType(propValue);
            return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected a single ReactElement.'));
          }
          return null;
        }
        return createChainableTypeChecker(validate);
      }
    
      function createInstanceTypeChecker(expectedClass) {
        function validate(props, propName, componentName, location, propFullName) {
          if (!(props[propName] instanceof expectedClass)) {
            var expectedClassName = expectedClass.name || ANONYMOUS;
            var actualClassName = getClassName(props[propName]);
            return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + actualClassName + '` supplied to `' + componentName + '`, expected ') + ('instance of `' + expectedClassName + '`.'));
          }
          return null;
        }
        return createChainableTypeChecker(validate);
      }
    
      function createEnumTypeChecker(expectedValues) {
        if (!Array.isArray(expectedValues)) {
          process.env.NODE_ENV !== 'production' ? warning(false, 'Invalid argument supplied to oneOf, expected an instance of array.') : void 0;
          return emptyFunction.thatReturnsNull;
        }
    
        function validate(props, propName, componentName, location, propFullName) {
          var propValue = props[propName];
          for (var i = 0; i < expectedValues.length; i++) {
            if (is(propValue, expectedValues[i])) {
              return null;
            }
          }
    
          var valuesString = JSON.stringify(expectedValues);
          return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of value `' + propValue + '` ' + ('supplied to `' + componentName + '`, expected one of ' + valuesString + '.'));
        }
        return createChainableTypeChecker(validate);
      }
    
      function createObjectOfTypeChecker(typeChecker) {
        function validate(props, propName, componentName, location, propFullName) {
          if (typeof typeChecker !== 'function') {
            return new PropTypeError('Property `' + propFullName + '` of component `' + componentName + '` has invalid PropType notation inside objectOf.');
          }
          var propValue = props[propName];
          var propType = getPropType(propValue);
          if (propType !== 'object') {
            return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an object.'));
          }
          for (var key in propValue) {
            if (propValue.hasOwnProperty(key)) {
              var error = typeChecker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret);
              if (error instanceof Error) {
                return error;
              }
            }
          }
          return null;
        }
        return createChainableTypeChecker(validate);
      }
    
      function createUnionTypeChecker(arrayOfTypeCheckers) {
        if (!Array.isArray(arrayOfTypeCheckers)) {
          process.env.NODE_ENV !== 'production' ? warning(false, 'Invalid argument supplied to oneOfType, expected an instance of array.') : void 0;
          return emptyFunction.thatReturnsNull;
        }
    
        for (var i = 0; i < arrayOfTypeCheckers.length; i++) {
          var checker = arrayOfTypeCheckers[i];
          if (typeof checker !== 'function') {
            warning(
              false,
              'Invalid argument supplid to oneOfType. Expected an array of check functions, but ' +
              'received %s at index %s.',
              getPostfixForTypeWarning(checker),
              i
            );
            return emptyFunction.thatReturnsNull;
          }
        }
    
        function validate(props, propName, componentName, location, propFullName) {
          for (var i = 0; i < arrayOfTypeCheckers.length; i++) {
            var checker = arrayOfTypeCheckers[i];
            if (checker(props, propName, componentName, location, propFullName, ReactPropTypesSecret) == null) {
              return null;
            }
          }
    
          return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`.'));
        }
        return createChainableTypeChecker(validate);
      }
    
      function createNodeChecker() {
        function validate(props, propName, componentName, location, propFullName) {
          if (!isNode(props[propName])) {
            return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`, expected a ReactNode.'));
          }
          return null;
        }
        return createChainableTypeChecker(validate);
      }
    
      function createShapeTypeChecker(shapeTypes) {
        function validate(props, propName, componentName, location, propFullName) {
          var propValue = props[propName];
          var propType = getPropType(propValue);
          if (propType !== 'object') {
            return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type `' + propType + '` ' + ('supplied to `' + componentName + '`, expected `object`.'));
          }
          for (var key in shapeTypes) {
            var checker = shapeTypes[key];
            if (!checker) {
              continue;
            }
            var error = checker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret);
            if (error) {
              return error;
            }
          }
          return null;
        }
        return createChainableTypeChecker(validate);
      }
    
      function isNode(propValue) {
        switch (typeof propValue) {
          case 'number':
          case 'string':
          case 'undefined':
            return true;
          case 'boolean':
            return !propValue;
          case 'object':
            if (Array.isArray(propValue)) {
              return propValue.every(isNode);
            }
            if (propValue === null || isValidElement(propValue)) {
              return true;
            }
    
            var iteratorFn = getIteratorFn(propValue);
            if (iteratorFn) {
              var iterator = iteratorFn.call(propValue);
              var step;
              if (iteratorFn !== propValue.entries) {
                while (!(step = iterator.next()).done) {
                  if (!isNode(step.value)) {
                    return false;
                  }
                }
              } else {
                // Iterator will provide entry [k,v] tuples rather than values.
                while (!(step = iterator.next()).done) {
                  var entry = step.value;
                  if (entry) {
                    if (!isNode(entry[1])) {
                      return false;
                    }
                  }
                }
              }
            } else {
              return false;
            }
    
            return true;
          default:
            return false;
        }
      }
    
      function isSymbol(propType, propValue) {
        // Native Symbol.
        if (propType === 'symbol') {
          return true;
        }
    
        // 19.4.3.5 Symbol.prototype[@@toStringTag] === 'Symbol'
        if (propValue['@@toStringTag'] === 'Symbol') {
          return true;
        }
    
        // Fallback for non-spec compliant Symbols which are polyfilled.
        if (typeof Symbol === 'function' && propValue instanceof Symbol) {
          return true;
        }
    
        return false;
      }
    
      // Equivalent of `typeof` but with special handling for array and regexp.
      function getPropType(propValue) {
        var propType = typeof propValue;
        if (Array.isArray(propValue)) {
          return 'array';
        }
        if (propValue instanceof RegExp) {
          // Old webkits (at least until Android 4.0) return 'function' rather than
          // 'object' for typeof a RegExp. We'll normalize this here so that /bla/
          // passes PropTypes.object.
          return 'object';
        }
        if (isSymbol(propType, propValue)) {
          return 'symbol';
        }
        return propType;
      }
    
      // This handles more types than `getPropType`. Only used for error messages.
      // See `createPrimitiveTypeChecker`.
      function getPreciseType(propValue) {
        if (typeof propValue === 'undefined' || propValue === null) {
          return '' + propValue;
        }
        var propType = getPropType(propValue);
        if (propType === 'object') {
          if (propValue instanceof Date) {
            return 'date';
          } else if (propValue instanceof RegExp) {
            return 'regexp';
          }
        }
        return propType;
      }
    
      // Returns a string that is postfixed to a warning about an invalid type.
      // For example, "undefined" or "of type array"
      function getPostfixForTypeWarning(value) {
        var type = getPreciseType(value);
        switch (type) {
          case 'array':
          case 'object':
            return 'an ' + type;
          case 'boolean':
          case 'date':
          case 'regexp':
            return 'a ' + type;
          default:
            return type;
        }
      }
    
      // Returns class name of the object, if any.
      function getClassName(propValue) {
        if (!propValue.constructor || !propValue.constructor.name) {
          return ANONYMOUS;
        }
        return propValue.constructor.name;
      }
    
      ReactPropTypes.checkPropTypes = checkPropTypes;
      ReactPropTypes.PropTypes = ReactPropTypes;
    
      return ReactPropTypes;
    };
    
  provide("prop-types/factoryWithTypeCheckers", module.exports);
}(global));

// pakmanager:prop-types/factoryWithThrowingShims
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright 2013-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     */
    
    'use strict';
    
    var emptyFunction = require('fbjs/lib/emptyFunction');
    var invariant = require('fbjs/lib/invariant');
    var ReactPropTypesSecret = require('./lib/ReactPropTypesSecret');
    
    module.exports = function() {
      function shim(props, propName, componentName, location, propFullName, secret) {
        if (secret === ReactPropTypesSecret) {
          // It is still safe when called from React.
          return;
        }
        invariant(
          false,
          'Calling PropTypes validators directly is not supported by the `prop-types` package. ' +
          'Use PropTypes.checkPropTypes() to call them. ' +
          'Read more at http://fb.me/use-check-prop-types'
        );
      };
      shim.isRequired = shim;
      function getShim() {
        return shim;
      };
      // Important!
      // Keep this list in sync with production version in `./factoryWithTypeCheckers.js`.
      var ReactPropTypes = {
        array: shim,
        bool: shim,
        func: shim,
        number: shim,
        object: shim,
        string: shim,
        symbol: shim,
    
        any: shim,
        arrayOf: getShim,
        element: shim,
        instanceOf: getShim,
        node: shim,
        objectOf: getShim,
        oneOf: getShim,
        oneOfType: getShim,
        shape: getShim
      };
    
      ReactPropTypes.checkPropTypes = emptyFunction;
      ReactPropTypes.PropTypes = ReactPropTypes;
    
      return ReactPropTypes;
    };
    
  provide("prop-types/factoryWithThrowingShims", module.exports);
}(global));

// pakmanager:prop-types
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright 2013-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     */
    
    if (process.env.NODE_ENV !== 'production') {
      var REACT_ELEMENT_TYPE = (typeof Symbol === 'function' &&
        Symbol.for &&
        Symbol.for('react.element')) ||
        0xeac7;
    
      var isValidElement = function(object) {
        return typeof object === 'object' &&
          object !== null &&
          object.$$typeof === REACT_ELEMENT_TYPE;
      };
    
      // By explicitly using `prop-types` you are opting into new development behavior.
      // http://fb.me/prop-types-in-prod
      var throwOnDirectAccess = true;
      module.exports =  require('prop-types/factoryWithTypeCheckers')(isValidElement, throwOnDirectAccess);
    } else {
      // By explicitly using `prop-types` you are opting into new production behavior.
      // http://fb.me/prop-types-in-prod
      module.exports =  require('prop-types/factoryWithThrowingShims')();
    }
    
  provide("prop-types", module.exports);
}(global));

// pakmanager:react
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    
    module.exports = require('./lib/React');
    
  provide("react", module.exports);
}(global));

// pakmanager:react-dom
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    
    module.exports = require('./lib/ReactDOM');
    
  provide("react-dom", module.exports);
}(global));