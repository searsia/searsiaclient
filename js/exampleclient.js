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
var suggestionsOn = true

function printMessage (text) {
  $('#searsia-alert-bottom').text(text)
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

function initUI (searsiaObject) {
  var resource, icon, banner, name, suggesttemplate
  if (searsiaObject.resource) {
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

$(document).ready(function () {
  if (API_TEMPLATE == null || API_TEMPLATE === '') {
    printMessage('If you see this then searsiaclient needs to be configured. Please set the value of API_TEMPLATE in exampleclient.js.')
  } else {
    var res = searsia.initClient(API_TEMPLATE)
    initUI(res) // init with old data, if available
    if ($('#searsia-banner').length) { // this is the home page
      searsia.connectToServer(initUI) // init: update interface with new data
    } else {
      var params = searsiaUrlParameters()
      if (params.q && params.q !== '') {
        fillForm(formQuery(params.q))
        document.title += ': ' + printableQuery(params.q)
        searsia.searchFederated(params, printResults)
      } else {
        window.location.replace('index.html')
      }
    }
  }
})
