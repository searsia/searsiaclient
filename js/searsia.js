/*
 * Copyright 2017 Searsia
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Searsia Library v1.2.0:
 *
 *   The web page should first call searsia.initClient(template) and then
 *   searsia.searchFederated(params, callback), see: exampleclient.js
 *   Syntax checked with: standard (https://standardjs.com)
 */

'use strict'

var searsia = (function () {
  var SEARSIAVERSION = 'v1.2.0'
  var globalId = null
  var globalApiTemplate = null
  var globalMother = null
  var globalPending = 0 // Number of search engines that are answering a query

  /* replace JQuery $.ajax() */

  function searsiaAjax (ajaxObject) {
    var data, response, message
    var request = new window.XMLHttpRequest()
    var url = ajaxObject.url
    var success = ajaxObject.success
    var error = ajaxObject.error
    var timeout = ajaxObject.timeout
    var dataType = ajaxObject.dataType
    if (!url) {
      error(null, null, 'No url')
    } else {
      request.open('GET', url, true)
      request.onload = function () {
        if (request.status === 200) {
          response = request.responseText
          if (response) {
            if (dataType && dataType === 'json') {
              try {
                data = JSON.parse(response)
              } catch (e) {
                error(request, null, e.message)
                return
              }
            }
            success(data)
          } else {
            error(request, null, request.statusText)
          }
        } else { // We reached our target server, but it returned an error
          message = request.statusText
          if (!message) {
            message = 'Not available'
          }
          error(request, null, message)
        }
      }
      request.onerror = function () { // There was a connection error of some sort
        error(request, null, 'Connection error')
      }
      request.ontimeout = function () { // There was a time out
        error(request, null, 'Time out')
      }
      request.timeout = timeout
      request.send()
    }
  }

  /* Basic local storage functions */

  function clearLocalStorage () {
    try {
      window.localStorage.clear()
    } catch (ignore) { }
  }

  function setLocalStorage (field, value) {
    if (value != null) {
      try {
        window.localStorage['searsia-' + field] = value
      } catch (ignore) { }
    }
  }

  function deleteLocalStorage (field) {
    try {
      window.localStorage['searsia-' + field] = null
    } catch (ignore) { }
  }

  function getLocalStorage (field) {
    var value = null
    try {
      value = window.localStorage['searsia-' + field]
    } catch (ignore) { }
    return value
  }

  function existsLocalStorage (field) {
    var value = false
    try {
      value = window.localStorage.hasOwnProperty('searsia-' + field)
    } catch (ignore) { }
    return value
  }

  /* Special storage functions -- fallback to local variables */

  function setMother (motherObject) {
    globalMother = motherObject // global
    setLocalStorage('mother', JSON.stringify(motherObject))
    if (motherObject.id != null) {
      globalId = motherObject.id // global
    } else {
      globalId = 'searsia'
    }
    setLocalStorage('id', globalId)
  }

  function getMother () {
    var motherJson
    if (globalMother != null) { // global
      return globalMother
    }
    motherJson = getLocalStorage('mother')
    if (motherJson) {
      return JSON.parse(motherJson)
    }
    return null
  }

  function setApiTemplate (template) {
    globalApiTemplate = template // global
    setLocalStorage('apitemplate', template)
  }

  function getApiTemplate () {
    if (globalApiTemplate != null) { // global
      return globalApiTemplate
    }
    return getLocalStorage('apitemplate')
  }

  /* there is no setId(), instead: see setMother() */
  function getId () {
    if (globalId != null) {
      return globalId
    } else {
      return getLocalStorage('id')
    }
  }

  function setLocalResource (resource) {
    var id = getId()
    if (id != null) {
      setLocalStorage(id + '/' + resource.id, JSON.stringify(resource))
    }
  }

  function getLocalResource (rid) {
    var json
    var id = getId()
    if (id == null) {
      return null
    }
    json = getLocalStorage(id + '/' + rid)
    if (json) {
      return JSON.parse(json)
    }
    return null
  }

  function existsLocalResource (rid) {
    var id = getId()
    if (id == null) {
      return false
    }
    return existsLocalStorage(id + '/' + rid)
  }

  function deleteLocalResource (rid) {
    var id = getId()
    if (id != null) {
      deleteLocalStorage(id + '/' + rid)
    }
  }

  /* Template: only works on Searsia Server templates */
  function fillUrlTemplate (template, query, page, resourceId, resulttype) {
    var start, end, ext
    var json = '.json'
    if (resourceId) {
      start = template.lastIndexOf('/')
      end = template.indexOf('?')
      if (start > 4 && end > start) {
        if (template.substring(start + 1, end).indexOf(json) !== -1) {
          ext = json
        } else {
          ext = ''
        }
        template = template.substring(0, start + 1) + resourceId + ext + template.substring(end, template.length)
      }
    }
    if (page == null) {
      page = 1
    }
    if (resulttype == null) {
      resulttype = ''
    }
    template = template.replace(/\{q\??\}/g, query)
    template = template.replace(/\{searchTerms\??\}/g, query)
    template = template.replace(/\{startPage\??\}/, page)
    template = template.replace(/\{resultType\??\}/, resulttype)
    return template.replace(/\{[A-Za-z]+\?\}/g, '') // remove all optional
  }

  function scoreHit (hit, i, query, prior) {
    var text, queryTerms
    var score = 0
    if (!prior) { prior = 0.0 }
    query = normalizeText(printableQuery(query))
    queryTerms = query.split(/ +/) // TODO: This might not work for all character encodings
    if (hit.description != null) {
      text = hit.title + ' ' + hit.description
    } else {
      text = hit.title
    }
    if (text != null) {
      if (text.length > 300) { text = text.substring(0, 300) }
      score = scoreText(text, queryTerms)
    }
    score += prior - (i / 10)
    if (score < 0) {
      score = 0
    }
    return score
  }

  function addToHits (hits, hit) {
    var i
    var newIndex = hits.length
    var TOP = 100
    if (newIndex < TOP || hit.score > hits[TOP - 1].score) {
      if (newIndex < TOP) { newIndex += 1 }
      i = newIndex - 1
      while (i > 0 && hits[i - 1].score < hit.score) {
        hits[i] = hits[i - 1]
        i -= 1
      }
      hits[i] = hit
    }
  }

  function normalizeText (text) {
    return text.toLowerCase().replace(new RegExp('[^a-z0-9]+', 'g'), ' ').replace(new RegExp('^ +| +$', 'g'), '')
  }

  function noHTMLattribute (text) {
    text = text.replace(/&/g, '&amp;')
    text = text.replace(/"/g, '&#34;')
    return text
  }

  function noHTMLelement (text) {
    text = text.replace(/</g, '&lt;')
    text = text.replace(/>/g, '&gt;')
    text = text.replace(/&/g, '&amp;')
    return text
  }

  function scoreText (text, queryTerms) {
    var i, j, len
    var textTerms
    var score = 0.0
    textTerms = normalizeText(text).split(/ +/)
    for (i = 0; i < queryTerms.length; i += 1) { // TODO: Really? Nested loop??
      len = textTerms.length
      if (len > 1000) { len = 1000 } // Only check first 1000 words
      j = 0
      while (j < len) {
        if (queryTerms[i] === textTerms[j]) {
          score += 1.0
          j = len // one occurrence per query term
        }
        j += 1
      }
    }
    return score
  }

  function restrictStart (someText, start, size) { // size must be > 3
    var i, j
    var prefix = ''
    var postfix = ''
    if (someText != null && someText.length > size) {
      if (start < 0) { start = 0 }
      if (start > 2) {
        i = someText.indexOf(' ', start - 1)
        if (i === -1) { i = start } else { i += 1 }
        prefix = '... '
      } else {
        i = 0
      }
      if (start + size < someText.length) {
        j = someText.lastIndexOf(' ', start + size)
        if (j === -1) { j = start + size - 3 }
        postfix = ' ...'
      } else {
        j = start + size
      }
      someText = prefix + someText.substr(i, j - i) + postfix
    }
    return someText
  }

  function matchingSnippets (hits, queryTerms) { // TODO for queries length > 2
    var i, j, k, description, first, second
    for (i = 0; i < hits.length; i += 1) {
      first = -1
      second = -1
      if (queryTerms.length < 2) { first = 0 } // Take first part of description for query length 1
      if (hits[i].description != null) {
        description = hits[i].description.toLowerCase()
        j = 0
        while (j < queryTerms.length) {
          if (first === -1) {
            first = description.indexOf(queryTerms[j])
          } else if (second === -1) {
            k = first - 120
            if (k < 0) { k = 0 }
            second = description.indexOf(queryTerms[j], k)
            if (second === -1) {
              second = description.indexOf(queryTerms[j])
            }
          }
          j += 1
        }
        if (first === -1) { first = 0 }
        if (second === -1) { second = 0 }
        if (first > second) {
          k = first
          first = second
          second = k
        }
        if (second - first < 120) {
          description = restrictStart(hits[i].description, first - 40, 192)
        } else {
          description = restrictStart(hits[i].description, first - 40, 92)
          description += restrictStart(hits[i].description, second - 40, 92)
        }
        hits[i].description = description
      }
    }
  }

  /**
   *  Computes maxscore of hits
   *  If rerank === true: rerank and select those that match the query
   *  Used if mother has "rerank"
   */
  function scoreAllHits (data, query, rerank) {
    var queryTerms, queryLen, hit, score, maxscore, tscore
    var newHits = []
    var nrOfTopHits = 0
    var i = 0
    query = normalizeText(printableQuery(query))
    queryTerms = query.split(/ +/).sort(function (a, b) { return b.length - a.length }) // TODO: Split might not work for all character encodings
    queryLen = queryTerms.length
    newHits = []
    maxscore = 0
    while (i < data.hits.length) {
      hit = data.hits[i]
      score = 0
      tscore = 0
      if (hit.title != null) {
        tscore = scoreText(hit.title, queryTerms)
      }
      if (tscore === 0 && hit.url != null) {
        tscore = scoreText(hit.url, queryTerms) / 1.1
      }
      if (tscore < queryLen && hit.description != null) {
        score = scoreText(hit.description, queryTerms)
      }
      if (tscore * 1.1 > score) { // title boost
        score = tscore * 1.1
      } else {
        score += tscore / 10
      }
      if (score > 0) {
        if (score >= queryLen) { nrOfTopHits += 1 }
        hit.score = score
        addToHits(newHits, hit) // TODO: only if rerank?
        if (score > maxscore) { maxscore = score }
      }
      if (nrOfTopHits >= 100) { break }
      i += 1
    }
    if (rerank) {
      matchingSnippets(newHits, queryTerms)
      data.hits = newHits
    }
    return maxscore
  }

  function correctUrl (absUrl, relUrl) {
    if (relUrl.match(/^https?:\/\//) || relUrl.match(/^\/\//)) {
      return relUrl
    }
    if (absUrl == null) {
      return null
    }
    if (relUrl.match(/^\//)) {
      return absUrl.replace(/([a-z])\/.*$/, '$1') + relUrl
    }
    return absUrl.replace(/\/[^/]+$/, '/') + relUrl
  }

  function getHost (url) {
    if (!url) {
      return null
    }
    var match = url.match(/:\/\/(www\.)?(.[^/:]+)/)
    if (match == null) {
      return null
    }
    return match[2]
  }

  function urlParameters () {
    var i, values
    var params = { q: '', r: '', p: '', t: '' }
    var paramString = window.location.search.substring(1)
    var parts = paramString.split('&')
    for (i = 0; i < parts.length; i += 1) {
      values = parts[i].split('=')
      if (values[0] === 'q') {
        params.q = values[1]
        params.q = params.q.replace(/%3C.*?%3E/g, '') // no HTML
        params.q = params.q.replace(/%3C|%3E/g, '')
        params.q = params.q.replace(/^\++|\++$/g, '') // no leading and trailing spaces
      } else if (values[0] === 'r') {
        params.r = values[1]
      } else if (values[0] === 'p') {
        params.p = values[1]
      } else if (values[0] === 't') {
        params.t = values[1]
      }
    }
    return params
  }

  /* takes a url parameter query and returns a human readable query */
  function printableQuery (query) {
    query = query.replace(/\+/g, ' ')
    query = decodeURIComponent(query)
    return noHTMLelement(query)
  }

  /* takes a url parameter query and returns a query for an HTML form */
  function formQuery (query) {
    query = printableQuery(query)
    query = query.replace(/&amp;/g, '&')
    return query
  }

  /* takes a human readable query and turns it into an urlencoded query */
  function encodedQuery (text) {
    text = encodeURIComponent(text)
    text = text.replace(/%20/g, '+')
    return text
  }

  /*
   * This function is a mutable data type brain cracker:
   * That is, we purposely change the values of data and
   * resource here...
   */
  function inferMissingData (data, query, resulttype, rank) {
    var i, hit, resource, rhost
    var typeImages = true
    var typeSmall = true
    var typeFull = false
    var typeTitleOnly = true
    var count = data.hits.length - 1
    var prior = null

    resource = data.resource
    prior = Number(resource.prior)
    if (isNaN(prior) || prior == null) { prior = 0.0 }

    if (resource.urltemplate != null) {
      rhost = getHost(resource.urltemplate)
    }
    for (i = count; i >= 0; i -= 1) {
      hit = data.hits[i]
      if (hit.title == null) { // everything *must* have a title
        hit.title = 'Title'
        console.log('WARNING: result without title')
      } else {
        hit.title = noHTMLelement(hit.title)
      }
      hit.score = scoreHit(hit, i, query, (prior / rank)) // TODO: more costly now!
      if (hit.url == null) {
        if (resource.urltemplate != null) {
          hit.url = fillUrlTemplate(resource.urltemplate, encodedQuery(hit.title), 1, '', resulttype)
        } else {
          hit.url = fillUrlTemplate('?q={searchTerms}&t={resultType?}', encodedQuery(hit.title), null, null, resulttype)
        }
      } else {
        if (resource.urltemplate) {
          hit.url = correctUrl(resource.urltemplate, hit.url)
        } else {
          hit.url = correctUrl(resource.apitemplate, hit.url)
        }
        if (rhost == null || rhost !== getHost(hit.url)) {
          typeFull = true
        }
        hit.url = noHTMLelement(hit.url)
      }
      if (hit.description != null) {
        hit.description = noHTMLelement(hit.description)
        typeTitleOnly = false
      }
      if (hit.image != null) {
        hit.image = noHTMLattribute(correctUrl(resource.urltemplate, hit.image))
        typeTitleOnly = false
      }
      if (hit.favicon == null && resource.favicon != null) {
        hit.favicon = resource.favicon
      }
      if (hit.favicon != null) {
        hit.favicon = noHTMLattribute(hit.favicon)
      }
      if (hit.tags == null || hit.tags.indexOf('small') === -1) {
        typeSmall = false
      }
      if (hit.tags == null || hit.tags.indexOf('image') === -1) {
        typeImages = false
      }
      if (i < count && data.hits[i + 1].score > hit.score) {
        data.hits[i] = data.hits[i + 1] // bubbling the best scoring hit up
        data.hits[i + 1] = hit
      }
    }
    if (typeImages) {
      resource.type = 'images'
    } else if (typeSmall || typeTitleOnly) {
      resource.type = 'small'
    } else if (typeFull) {
      resource.type = 'full'
    } else {
      resource.type = 'web'
    }
  }

  function checkEmpty (callbackSearch) {
    if (globalPending === 0) {
      callbackSearch({ 'searsia': SEARSIAVERSION, 'status': 'done' })
    }
  }

  function returnResults (query, resulttype, data, rank, olddata, callbackSearch) {
    var newscore, oldscore
    var liveResults = true
    var count = 0
    if (data.resource && data.resource.apitemplate) { // TODO: why apitemplate necessary?
      setLocalResource(data.resource)
    }
    if (data.hits && data.hits.length) {
      count = data.hits.length // TODO: also includes 'rid'-only results from searsia engines
      newscore = scoreAllHits(data, query, false)
      oldscore = scoreAllHits(olddata, query, true)
    }
    if (count === 0 || oldscore - 0.5 > newscore) { // use old data if olddata is clearly better
      data = olddata
      liveResults = false
      count = data.hits.length
    }
    if (count > 0) {
      inferMissingData(data, query, resulttype, rank)
      callbackSearch({
        'searsia': SEARSIAVERSION,
        'status': 'hits',
        'resource': data.resource,
        'hits': data.hits,
        'rank': rank,
        'query': query,
        'live': liveResults })
    }
  }

  function getResults (query, resulttype, rid, rank, olddata, callbackSearch) {
    var template = getApiTemplate()
    if (template == null) {
      callbackSearch({
        'searsia': SEARSIAVERSION,
        'status': 'error',
        'resource': { 'id': rid },
        'message': 'No API template found.' })
    } else {
      globalPending += 1 // global
      searsiaAjax({
        url: fillUrlTemplate(template, query, 1, rid, resulttype),
        success: function (data) {
          returnResults(query, resulttype, data, rank, olddata, callbackSearch)
          globalPending -= 1 // global
          checkEmpty(callbackSearch)
        },
        error: function (xhr, options, err) {
          if (xhr.status === 410) {
            deleteLocalResource(rid)
          } else {
            returnResults(query, resulttype, olddata, rank, olddata, callbackSearch)
          }
          console.log('WARNING: ' + rid + ' unavailable.')
          globalPending -= 1 // global
          checkEmpty(callbackSearch)
        },
        timeout: 12000,
        dataType: 'json'
      })
    }
  }

  function queryResources (query, resulttype, data, callbackSearch) {
    var rid, hits, olddata
    var i = 0
    var rank = 1
    var done = []
    var resource = data.resource
    if (resource != null) {
      setMother(resource)
      if (resource.rerank != null) {
        scoreAllHits(data, query, true)
      }
    } else {
      resource = getMother()
    }
    callbackSearch({ 'searsia': SEARSIAVERSION, 'status': 'start', 'resource': resource })
    hits = data.hits
    globalPending = 0 // global
    if (hits == null || hits.length === 0) {
      callbackSearch({ 'searsia': SEARSIAVERSION, 'status': 'done' })
      return
    }
    while (i < hits.length) {
      rid = hits[i].rid
      if (rid == null) { // a result that is not from another resource
        if (data.resource != null && data.resource.urltemplate != null) {
          hits[i].url = correctUrl(data.resource.urltemplate, hits[i].url)
        }
        callbackSearch({
          'searsia': SEARSIAVERSION,
          'hits': [ hits[i] ],
          'query': query,
          'status': 'hits',
          'rank': rank })
        rank += 1
      } else if (done[rid] !== 1) {
        olddata = { hits: [] }
        if (existsLocalResource(rid)) {
          olddata.resource = getLocalResource(rid)
          while (i < hits.length && hits[i].rid === rid) {
            if (hits[i].title != null && hits[i].title !== '' && // too many exceptions?
                            (hits[i].url != null || olddata.resource.urltemplate != null) &&
                            (hits[i].foundBefore == null || Date.now() - new Date(hits[i].foundBefore).getTime() < 1209600000)) { // 1209600000 is 2 weeks in ms
              olddata.hits.push(hits[i])
            }
            i += 1
          }
          i -= 1 // otherwise we miss one
        } else {
          olddata.resource = { id: rid } // TODO: get it?
        }
        getResults(query, resulttype, rid, rank, olddata, callbackSearch)
        done[rid] = 1
        rank += 1
      }
      i += 1
    }
  }

  function searchFederated (params, callbackSearch) {
    var url, query, page
    var resulttype = null
    var template = getApiTemplate()
    if (template == null) {
      callbackSearch({ 'status': 'error', 'error': 'First initialize with searsia.initClient(apiTemplate)' })
      return
    }
    if (params.q == null || params.q === '') {
      callbackSearch({ 'status': 'error', 'error': 'No query.' })
      return
    }
    if (params.q.length > 150) {
      callbackSearch({ 'status': 'error', 'error': 'Query too long.' })
      return
    }
    query = params.q
    if (params.p == null) {
      page = 1
    } else {
      page = params.p
    }
    if (params.t) {
      resulttype = params.t
    }
    url = fillUrlTemplate(template, query, page, null, resulttype)
    searsiaAjax({
      url: url,
      success: function (data) { queryResources(query, resulttype, data, callbackSearch) },
      error: function (xhr, options, error) {
        console.log('ERROR: ' + error)
        callbackSearch({ 'status': 'error', 'error': 'Temporarily out of order. Please try again later.' })
      },
      timeout: 10000,
      dataType: 'json'
    })
  }

  /* connect to mother and return definition */
  function connectToServer (callbackConnect) {
    var template = getApiTemplate()
    if (template == null) {
      callbackConnect({ 'status': 'error', 'error': 'If you see this then searsiaclient needs to be initialized with searsia.initClient(apiTemplate)' })
    } else {
      searsiaAjax({
        url: fillUrlTemplate(template, '', '', null, null),
        success: function (data) {
          if (data.resource != null) {
            data.status = 'connect'
            setMother(data.resource)
          }
          callbackConnect(data)
        },
        error: function (xhr, options, error) {
          console.log('ERROR: ' + error)
          callbackConnect({ 'status': 'error', 'error': error })
        },
        timeout: 10000,
        dataType: 'json'
      })
    }
  }

  /* sets the apiTemplate. If not new, return mother from storage */
  function initClient (template) {
    var originalTemplate = getApiTemplate()
    var motherObject = null
    if (template !== originalTemplate) {
      clearLocalStorage()
      setApiTemplate(template)
    } else {
      motherObject = getMother()
    }
    if (motherObject) {
      return { 'resource': motherObject }
    } else {
      return null
    }
  }

  return {
    urlParameters: function () {
      return urlParameters()
    },
    printableQuery: function (query) {
      return printableQuery(query)
    },
    formQuery: function (query) {
      return formQuery(query)
    },
    encodedQuery: function (query) {
      return encodedQuery(query)
    },
    correctUrl: function (absUrl, relUrl) {
      return correctUrl(absUrl, relUrl)
    },
    fillUrlTemplate: function (template, query, page, resourceId, resultType) {
      return fillUrlTemplate(template, query, page, resourceId, resultType)
    },
    initClient: function (template) {
      return initClient(template)
    },
    connectToServer: function (callbackConnect) {
      connectToServer(callbackConnect)
    },
    searchFederated: function (params, callbackSearch) {
      searchFederated(params, callbackSearch)
    }
  }
})()
