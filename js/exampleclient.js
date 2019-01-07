/*
 * Copyright 2019 Searsia
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
 * Searsia Client v2.0.0:
 *
 *   The web page should first call searsia.initClient(template) and then
 *   searsia.searchFederated(params, callback), see: search.html
 *   Syntax checked with: standard (https://standardjs.com)
 */

/* global $, Bloodhound, searsia */

'use strict'

var API_TEMPLATE = 'https://drsheetmusic.com/searsia/index.json?q={searchTerms}&page={startPage?}' // set your API template here
// var API_TEMPLATE = 'https://search.utwente.nl/searsia/index?q={searchTerms}&page={startPage?}'
var suggestionsOn = true
var logClickDataUrl = 0 // url to log click data, undefined or 0 to disable click logging
var proxyURL = 0 // url to proxy images
var proxyHOST = getHost(proxyURL)

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

function printMessage (html) {
  $('#searsia-alert-bottom').html(html)
}

function fillForm (formQuery) {
  $('#searsia-input').val(formQuery)
}

function cleanSheet () {
  $('#searsia-alert-top').empty()
  $('#searsia-results-1').empty()
  $('#searsia-results-2').empty()
  $('#searsia-results-3').empty()
  $('#searsia-results-4').empty()
  $('#searsia-alert-bottom').empty()
}

function getSuggestions (data) {
  var response = data[1]
  if (response.length > 7) { response = response.slice(0, 7) } // work around results 'limit' option
  return response
}

function initSuggestion (suggesttemplate) {
  var typeAhead
  if (suggestionsOn && typeof Bloodhound !== 'undefined') {
    typeAhead = new Bloodhound({
      datumTokenizer: Bloodhound.tokenizers.whitespace,
      queryTokenizer: Bloodhound.tokenizers.whitespace,
      remote: {
        url: suggesttemplate,
        wildcard: '{q}',
        rateLimitWait: 200,
        rateLimitBy: 'debounce',
        cache: true,
        filter: getSuggestions
      }
    })
    $('#searsia-input').typeahead(
      { minLength: 1, highlight: true, hint: false },
      { name: 'searsia-autocomplete', source: typeAhead, limit: 20 }
    ).on(
      'typeahead:selected',
      function (e) { e.target.form.submit() }
    )
  }
}

function proxyUrl (url) {
  if (proxyURL && url.indexOf(proxyHOST) === -1) {
    url = proxyURL.replace(/\{u\}/g, encodeURIComponent(url.replace(/&amp;/g, '&')))
  }
  return url
}

function initUI (searsiaObject) {
  var resource, icon, banner, name, suggesttemplate
  if (searsiaObject && searsiaObject.resource) {
    resource = searsiaObject.resource
    icon = resource.favicon
    banner = resource.banner
    name = resource.name
    suggesttemplate = resource.suggesttemplate
    if (icon) {
      $('#favicon').attr('href', icon)
      $('div.searsia-icon img').attr('src', icon)
    }
    if (name) {
      $('head title').html(name + ' - Search')
    }
    if (banner && $('#searsia-banner').length) {
      $('#searsia-banner').html('<img src="' + banner + '" alt="" />') // TODO: proxyUrl(banner)
      $('#searsia-banner').fadeIn()
    }
    if (suggesttemplate) {
      initSuggestion(suggesttemplate)
    }
  }
}

function restrict (someText, size) { // size must be > 3
  var i
  if (someText != null && someText.length > size) {
    i = someText.lastIndexOf(' ', size)
    if (i === -1) { i = size - 3 }
    someText = someText.substr(0, i) + ' ...'
  }
  return someText
}

function highlightTerms (someText, query) {
  var i, re, terms, max
  query = query.toLowerCase().replace(/[^0-9a-z]/g, '+')
  terms = query.split(/\++/) // This might not work for all character encodings
  max = terms.length
  if (max > 10) { max = 10 }
  for (i = 0; i < max; i += 1) {
    if (terms[i].length > 0 && terms[i] !== 'b') { // do not match '<b>' again
      if (terms[i].length < 3) {
        terms[i] = '\\b' + terms[i] + '\\b'
      }
      try {
        re = new RegExp('(' + terms[i] + ')', 'gi')
        someText = someText.replace(re, '<b>$1</b>')
      } catch (ignore) { }
    }
  }
  return someText
}

/**
 * creates the onclick function for click log data, which can be inserted
 * in the html of href elements. This does not create an onclick element
 * if logClickDataUrl is not specified in the global parameters
 * @param rank
 * @param kind
 * @returns {*}
 */
function createOnClickElementforClickThrough (rank, kind) {
  if (logClickDataUrl) {
    return ' onclick="logClick(this, \'' + rank + '\', \'' + kind + '\')" ' // REMOVED: logClick()
  }
  return ''
}

function htmlFullResult (query, hit, rank) {
  var result = ''
  var title = hit.title
  var descr = hit.description
  var url = hit.url
  var image = hit.image
  title = restrict(title, 80)
  result += '<h4><a ' + createOnClickElementforClickThrough(rank, 'html_result_full') +
        'href="' + url + '">' + highlightTerms(title, query) + '</a>'
  if (hit.favicon != null) {
    result += '<img src="' + proxyUrl(hit.favicon) + '" alt="" onerror="this.style=\'display:none\'">'
  }
  result += '</h4>'
  if (image != null) {
    result += '<a ' + createOnClickElementforClickThrough(rank, 'html_result_full') +
            'href="' + url + '"><img src="' + proxyUrl(image) + '" /></a>'
  }
  result += '<p>'
  if (descr == null) { descr = hit.title }
  if (descr != null) {
    result += highlightTerms(restrict(descr, 200), query)
  } else {
    result += '&#151;'
  }
  result += '<br><a ' + createOnClickElementforClickThrough(rank, 'html_result_full') +
        'href="' + url + '">' + highlightTerms(restrict(decodeURIComponent(url), 90), query) + '</a></p>'
  return result
}

/**
 * Returns suggestions like 'related searches' and 'did you mean'
 * @param resource
 * @param hit
 * @param rank
 * @returns {string}
 */
function htmlSuggestionResult (resource, hit, rank) {
  var result = ''
  var title = hit.title
  var url = hit.url
  title = restrict(title, 80)
  result += '<h4>' + resource.name
  result += ' <a ' + createOnClickElementforClickThrough(rank, 'suggested_result') +
        'href="' + url + '"><b>' + title + '</b></a></h4>'
  return result
}

/*
 * Returns html sub result, properly length-restricted
 * max length 220 characters, restricting the size of the
 * title and description. Title at least 80 characters.
 */
function htmlSubResultWeb (query, hit, rank) {
  var title = hit.title
  var descr = hit.description
  var url = hit.url
  var image = hit.image
  var result = ''
  var tLength = 0
  var dLength = 0
  tLength = title.length
  if (descr != null) {
    dLength = descr.length
  }
  if (tLength + dLength > 220) {
    tLength = 220 - dLength
    if (tLength < 80) { tLength = 80 }
    title = restrict(title, tLength)
    tLength = title.length
  }
  if (tLength + dLength > 220) {
    dLength = 220 - tLength
  }
  result += '<div class="sub-result">'
  if (image != null) {
    result += '<a ' + createOnClickElementforClickThrough(rank, 'subresult_html_web') +
            'href="' + url + '"><img src="' + proxyUrl(image) + '"/></a>'
  }
  result += '<p><a ' + createOnClickElementforClickThrough(rank, 'subresult_html_web') +
        'href="' + url + '">' + highlightTerms(title, query) + '</a> '
  if (tLength < 40 && dLength < 40) {
    result += '<br>'
  }
  if (descr != null) {
    result += highlightTerms(restrict(descr, dLength), query)
  }
  result += '</p></div>'
  return result
}

function htmlSubResultWebFull (query, hit, rank) { // duplicate code with htmlSubResultWeb()
  var title = hit.title
  var descr = hit.description
  var url = hit.url
  var image = hit.image
  var maxsnip = 220
  var result = ''
  title = restrict(title, 80)
  maxsnip -= title.length
  result += '<div class="sub-result">'
  if (image != null) {
    result += '<a ' + createOnClickElementforClickThrough(rank, 'subresult_web_full') +
            'href="' + url + '"><img src="' + proxyUrl(image) + '"/></a>'
  }
  result += '<div class="descr"><a ' + createOnClickElementforClickThrough(rank, 'subresult_web_full') +
        'href="' + url + '">' + highlightTerms(title, query) + '</a> '
  if (descr != null) {
    result += highlightTerms(restrict(descr, maxsnip), query)
  }
  result += '</div>'
  if (url != null) {
    result += '<div class="url"><a ' + createOnClickElementforClickThrough(rank, 'subresult_web_full') +
            'href="' + url + '">' + highlightTerms(decodeURIComponent(url), query) + '</a></div>'
  }
  result += '</div>'
  return result
}

function htmlSubResultSmall (query, hit, rank) {
  var title = hit.title
  var descr = hit.description
  var url = hit.url
  var maxsnip = 120
  var result = ''
  title = restrict(title, 80)
  maxsnip -= title.length
  result += '<div class="sub-result-small">'
  result += '<p><a ' + createOnClickElementforClickThrough(rank, 'subresult_html_small') +
        'href="' + url + '">' + highlightTerms(title, query) + '</a> '
  if (descr != null && maxsnip > 40) {
    result += highlightTerms(restrict(descr, maxsnip), query)
  }
  result += '</p></div>'
  return result
}

function htmlSubResultImage (hit, rank) {
  var title = hit.title
  var url = hit.url
  var image = hit.image
  var result = ''
  title = restrict(title, 80)
  result += '<a ' + createOnClickElementforClickThrough(rank, 'subresult_image') +
        'href="' + url + '"><img class="sub-image" src="' + proxyUrl(image) + '" alt="[image]" title="' + title + '"/></a>\n'
  return result
}

function htmlSubResults (searsiaObject) {
  var i
  var query = searsiaObject.query
  var rank = searsiaObject.rank
  var hits = searsiaObject.hits
  var resource = searsiaObject.resource
  var MAXX = 4
  var result = '<div>'
  var count = hits.length
  if (resource.type === 'images') {
    MAXX = 7
  }
  if (count > MAXX) { count = MAXX }
  for (i = 0; i < count; i += 1) {
    if (resource.type === 'small') {
      result += htmlSubResultSmall(query, hits[i], rank)
    } else if (resource.type === 'images') {
      result += htmlSubResultImage(hits[i], rank)
    } else if (resource.type === 'full') {
      result += htmlSubResultWebFull(query, hits[i], rank)
    } else {
      result += htmlSubResultWeb(query, hits[i], rank)
    }
  }
  result += '</div>'
  return result
}

function htmlResource (query, resource, printQuery, rank) {
  var url, title
  var result = '<h4>'
  if (resource.urltemplate != null) {
    title = resource.name
    if (printQuery && (resource.urltemplate.indexOf('{q}') > -1 || resource.urltemplate.indexOf('{searchTerms}') > -1)) {
      title += ' - ' + searsia.printableQuery(query)
      url = searsia.fillUrlTemplate(resource.urltemplate, query, '')
    } else {
      url = searsia.fillUrlTemplate(resource.urltemplate, '', '')
    }
    result += '<a ' + createOnClickElementforClickThrough(rank, 'html_resource_header') +
            'href="' + url + '">'
    title = restrict(title, 80)
    result += highlightTerms(title, query) + '</a>'
    if (resource.favicon != null) {
      result += '<img src="' + proxyUrl(resource.favicon) + '" alt="" onerror="this.style=\'display:none\'">'
    }
  } else {
    result += highlightTerms(resource.name, query)
  }
  result += '</h4><p>'
  if (resource.summary != null) {
    result += highlightTerms(restrict(resource.summary, 90), query) + '<br>'
  }
  if (url != null) {
    result += '<a ' + createOnClickElementforClickThrough(rank, 'html_resource_header') +
            'href="' + url + '">' + highlightTerms(restrict(decodeURIComponent(url), 90), query) + '</a>'
  }
  result += '</p>'
  return result
}

function printSingleResult (query, hit, rank) {
  var result
  var where = rank
  result = '<div class="search-result">'
  result += htmlFullResult(query, hit, rank)
  result += '</div>'
  if (where < 1) { where = 1 }
  if (where > 4) { where = 4 }
  $('#searsia-results-' + where).append(result)
}

function printAggregatedResults (searsiaObject) {
  var resource = searsiaObject.resource
  var query = searsiaObject.query
  var rank = searsiaObject.rank
  var hits = searsiaObject.hits
  var printQuery = true // TODO
  var result = ''
  var count = hits.length
  if (count > 0) {
    result += '<div class="search-result">'
    if (count === 1) {
      if (hits[0].tags != null && hits[0].tags.indexOf('suggestion') !== -1) {
        result += htmlSuggestionResult(resource, hits[0], rank)
      } else {
        result += htmlFullResult(query, hits[0], rank)
      }
    } else {
      result += htmlResource(query, resource, printQuery, rank)
      result += htmlSubResults(searsiaObject)
    }
    result += '</div>'
    if (rank < 1) { rank = 1 }
    if (rank === 4) { rank = 3 }
    if (rank > 4) { rank = 4 }
    $('#searsia-results-' + rank).append(result) // there are four divs for results, 1=top, 2=subtop, 3=rest, 4=more.
  }
}

function printResults (searsiaObject) {
  var status = searsiaObject.status
  if (status) {
    if (status === 'start') {
      // TODO
    } else if (status === 'hits') {
      printAggregatedResults(searsiaObject)
    } else if (status === 'done') {
      printMessage('done')
    }
  }
}

$(document).ready(function () {
  if (API_TEMPLATE == null || API_TEMPLATE === '') {
    printMessage('If you see this then searsiaclient needs to be configured. Please set the value of API_TEMPLATE in exampleclient.js.')
  } else {
    var res = searsia.initClient(API_TEMPLATE)
    initUI(res) // init with old data, if available
    if ($('#searsia-banner').length) { // this is the home page
      searsia.connectToServer(initUI) // init: update interface with new data
    } else {
      var params = searsia.urlParameters()
      if (params.q && params.q !== '') {
        fillForm(searsia.formQuery(params.q))
        document.title += ': ' + searsia.printableQuery(params.q)
        searsia.searchFederated(params, printResults)
      } else {
        window.location.replace('index.html')
      }
    }
  }
})