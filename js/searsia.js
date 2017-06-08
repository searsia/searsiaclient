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
 * Searsia Client v1.0.0 spaghetti code:
 *   Set the value of API_TEMPLATE before to your Searsia Server.
 *
 *   The web page should call getResources(params) 
 *   (using parameters from: searsiaUrlParameters())
 *   see: search.html
 *   Syntax checked with: jslint --eqeq --regexp --todo searsia.js
 */

/* jshint esversion: 5 */
/*global $, window, document, alert, jQuery, localStorage, Bloodhound*/

"use strict";

var API_TEMPLATE = '';


var AGG       = 1;   // 1=Aggregate results, 0=only boring links
var pending   = 0;   // Number of search engines that are answering a query
var nrResults = 0;   // Total number of results returned 
var lang      = document.getElementsByTagName('html')[0].getAttribute('lang');    // used for language-dependent texts

var logClickDataUrl = 0; // url to log click data, undefined or 0 to disable click logging
var sendSessionIdentifier = 0; // do not send anonymous session id with each click
var suggestionsOn = 1; // Enables suggestions, if they are provided via the API template's server.

var searsiaStore = {

    hits: [],
    length: 0,
    query: '',
    ranking: [],

    push: function (hit) {
        var i = this.length;
        this.hits.push(hit);
        this.length += 1;
        while (i > 0 && hit.score > this.hits[i - 1].score) { // Order by score
            this.hits[i] = this.hits[i - 1];
            this.hits[i - 1] = hit;
            i -= 1;
        }
    },

    addHits: function (hits, start, end) {
        var i;
        for (i = start; i <= end; i += 1) {
            this.hits.push(hits[i]);
        }
        this.length += end - start;
    },

    shift: function () {
        var hit = this.hits.shift();
        this.length -= 1;
        return hit;
    },

    setQuery: function (query) {
        this.query = query;
    },

    getQuery: function () {
        return this.query;
    },

    addToRanking: function (resourceId, rank) {
        this.ranking[rank - 1] = resourceId;
    },

    removeFromRanking: function (rank) {
        this.ranking[rank - 1] = "";
    },

    getRanking: function (rank) {
        if (rank > 0 && rank < this.ranking.length) {
            return this.ranking.splice(0, rank);
        }
        return this.ranking;
    },

    clear: function () {
        this.length = 0;
        this.hits = [];
        this.query = '';
        this.ranking = [];
    }

};


function clearLocalStorage() {
    try {
        window.localStorage.clear();
    } catch (ignore) { }
}


function setLocalStorage(field, value) {
    if (value != null) {
        try {
            window.localStorage['searsia-' + field] = value;
        } catch (ignore) { }
    }
}


function deleteLocalStorage(field) {
    try {
        window.localStorage['searsia-' + field] = null;
    } catch (ignore) { }
}


function getLocalStorage(field) {
    var value;
    try {
        value = window.localStorage['searsia-' + field];
    } catch (ignore) { }
    return value;
}


function supportsHtml5Storage() {
    try {
        return window.hasOwnProperty('localStorage') && window.localStorage !== null;
    } catch (e) {
        return false;
    }
}


function localSetResource(resource) {
    var id = getLocalStorage('id');
    if (id != null) {
        try {
            window.localStorage[id + '/' + resource.id] = JSON.stringify(resource);
        } catch (ignore) { }
    }
}


function localGetResource(rid) {
    var id = getLocalStorage('id');
    if (id == null) {
        return null;
    }
    try {
        return JSON.parse(window.localStorage[id + '/' + rid]);
    } catch (e) {
        return null;
    }
}


function localExistsResource(rid) {
    var id = getLocalStorage('id');
    if (id == null) {
        return false;
    }
    try {
        return window.localStorage.hasOwnProperty(id + '/' + rid);
    } catch (e) {
        return false;
    }
}


function localDeleteResource(rid) {
    var id = getLocalStorage('id');
    if (id != null) {
        try {
            delete window.localStorage[id + '/' + rid];
        } catch (ignore) { }
    }
}


function localAllResoureIds() {
    var i,
        key,
        list = [],
        id = getLocalStorage('id');
    if (id == null) {
        return [];
    }
    try {
        for (i = 0; i < localStorage.length; i += 1) {
            key  = window.localStorage.key(i);
            if (key.indexOf(id) === 0) {
                key = key.substr(id.length + 1, key.length - id.length - 1);
                list.push(key);
            }
        }
        return list;
    } catch (e) {
        return [];
    }
}


function getSuggestions(data) {
    var response = data[1];
    if (response.length > 7) { response = response.slice(0, 7); } // work around results 'limit' option
    return response;
}


function initSuggestion(suggesttemplate) {
    var typeAhead;
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
        });
        $("#searsia-input").typeahead(
            {minLength: 1, highlight: true, hint: false},
            {name: 'searsia-autocomplete', source: typeAhead, limit: 20 }
        ).on(
            'typeahead:selected',
            function (e) { e.target.form.submit(); }
        );
    }
}


function storeMother(data) {
    if (data.resource != null && data.resource.id != null) {
        setLocalStorage('id', data.resource.id);
        data.resource.type = 'mother';
        localSetResource(data.resource);
    }
}


function placeBanner(data) {
    var banner = null;
    if (data.resource != null && data.resource.banner != null) {
        banner = data.resource.banner;
        setLocalStorage('banner', banner);
    } else {
        banner = getLocalStorage('banner');
    }
    if (banner != null && $('#searsia-banner').length) {
        $('#searsia-banner').html('<img src="' + banner + '" alt="" />');
        $("#searsia-banner").fadeIn();
    }
}


function placeQuery(query) {
    var i, title = document.title;
    i = title.indexOf(':');
    if (i != -1) {
        title = title.substring(0, i);
    }
    document.title = title + ': ' + query;
}


function placeName(data) {
    var name = null;
    if (data.resource != null) {
        name = data.resource.name;
        setLocalStorage('name', name);
    } else {
        name = getLocalStorage('name');
    }
    if (name != null) {
        $('head title').html(name + ' - Search');
    }
}


function placeIcon(data) {
    var icon = null;
    if (data.resource != null) {
        icon = data.resource.favicon;
        setLocalStorage('icon', icon);
    } else {
        icon = getLocalStorage('icon');
    }
    if (icon != null) {
        $('#favicon').attr('href', icon);
        $('div.searsia-icon img').attr('src', icon);
    }
}


function initClient() {
    var originalTemplate = getLocalStorage('originaltemplate');
    if (API_TEMPLATE !== originalTemplate) {
        clearLocalStorage();
        setLocalStorage('originaltemplate', API_TEMPLATE);
    } else {
        placeBanner({ });
        placeIcon({ });
        placeName({ });
        $("#searsia-input").focus();
    }
}


function placeSuggestions(data) {
    var suggesttemplate = null;
    if (data.resource != null) {
        suggesttemplate = data.resource.suggesttemplate;
        setLocalStorage('suggesttemplate', suggesttemplate);
    } else {
        suggesttemplate = getLocalStorage('suggesttemplate');
    }
    if (suggesttemplate != null) {
        initSuggestion(suggesttemplate);
    }
}


function getHost(url) {
    var match = url.match(/:\/\/(www\.)?(.[^\/:]+)/);
    if (match == null) {
        return null;
    }
    return match[2];
}


function searsiaUrlParameters() {
    var i, values,
        params = { q: "", r: "" },
        paramString = window.location.search.substring(1),
        parts = paramString.split("&");
    for (i = 0; i < parts.length; i += 1) {
        values = parts[i].split("=");
        if (values[0] === 'q') {
            params.q = values[1];
            params.q = params.q.replace(/%3C.*?%3E/g, '');
            params.q = params.q.replace(/%3C|%3E/g, '');
            params.q = params.q.replace(/^\++|\++$/g, ''); // no leading and trailing spaces 
        } else if (values[0] === 'r') {
            params.r = values[1];
        } else if (values[0] === 'e') { // extra
            params.e = values[1];
        }
    }
    return params;
}


function searsiaCleanSheet() {
    searsiaStore.clear();
    $('#searsia-alert-top').empty();
    $('#searsia-results-1').empty();
    $('#searsia-results-2').empty();
    $('#searsia-results-3').empty();
    $('#searsia-results-4').empty();
    $('#searsia-alert-bottom').empty();
}


function searsiaError(text) {
    $('#searsia-alert-bottom').html(text);
}


function noHTMLattribute(text) {
    text = text.replace(/&/g, '&amp;');
    text = text.replace(/\"/g, '&#34;');
    return text;
}


function noHTMLelement(text) {
    text = text.replace(/</g, '&lt;');
    text = text.replace(/>/g, '&gt;');
    text = text.replace(/&/g, '&amp;');
    return text;
}


function printableQuery(query) {
    query = query.replace(/\+/g, ' ');
    query = decodeURIComponent(query);
    return noHTMLelement(query);
}


function formQuery(query) {
    query = printableQuery(query);
    query = query.replace(/&amp;/g, '&');
    return query;
}


function encodedQuery(text) {
    text = encodeURIComponent(text);
    text = text.replace(/%20/g, '+');
    return text;
}


function fillForm(query) {
    $('#searsia-input').val(formQuery(query));
}


function fillUrlTemplate(template, query, resourceId) {
    var last, myId;
    if (resourceId) {
        myId = getLocalStorage('id');
        last = template.lastIndexOf(myId);
        if (last >= 0) {
            template = template.substring(0, last) + resourceId + template.substring(last + myId.length, template.length);
        }
    }
    template = template.replace(/\{q\??\}/g, query);
    return template.replace(/\{[A-Za-z]+\?\}/g, '');  // remove all optional
}


function restrict(someText, size) { // size must be > 3
    var i;
    if (someText != null && someText.length > size) {
        i = someText.lastIndexOf(" ", size);
        if (i == -1) { i = size - 3; }
        someText = someText.substr(0, i) + ' ...';
    }
    return someText;
}


function restrictStart(someText, start, size) { // size must be > 3
    var i, j,
        prefix = "",
        postfix = "";
    if (someText != null && someText.length > size) {
        if (start < 0) { start = 0; }
        if (start > 2) {
            i = someText.indexOf(" ", start - 1);
            if (i == -1) { i = start; } else { i += 1; }
            prefix = "... ";
        } else {
            i = 0;
        }
        if (start + size < someText.length) {
            j = someText.lastIndexOf(" ", start + size);
            if (j == -1) { j = start + size - 3; }
            postfix = ' ...';
        } else {
            j = start + size;
        }
        someText = prefix + someText.substr(i, j - i) + postfix;

    }
    return someText;
}


function highlightTerms(someText, query) {
    var i, re, terms, max;
    query = query.toLowerCase().replace(/[^0-9a-z]/g, '+');
    terms = query.split(/\++/); // This might not work for all character encodings
    max = terms.length;
    if (max > 10) { max = 10; }
    for (i = 0; i < max; i += 1) {
        if (terms[i].length > 0 && terms[i] !== 'b') { // do not match '<b>' again
            if (terms[i].length < 3) {
                terms[i] = '\\b' + terms[i] + '\\b';
            }
            try {
                re = new RegExp('(' + terms[i] + ')', "gi");
                someText = someText.replace(re, '<b>$1</b>');
            } catch (ignore) { }
        }
    }
    return someText;
}


function normalizeText(text) {
    return text.toLowerCase().replace(new RegExp('[^a-z0-9]+', 'g'), ' ').replace(new RegExp('^ +| +$', 'g'), '');
}


function scoreText(text, queryTerms) {
    var i, j, len,
        textTerms,
        score = 0.0;
    textTerms = normalizeText(text).split(/ +/);
    for (i = 0; i < queryTerms.length; i += 1) { // TODO: Really? Nested loop??
        len = textTerms.length;
        if (len > 1000) { len = 1000; } // Only check first 1000 words
        j = 0;
        while (j < len) {
            if (queryTerms[i] === textTerms[j]) {
                score += 1.0;
                j = len; // one occurrence per query term
            }
            j += 1;
        }
    }
    return score;
}


function scoreHit(hit, i, query) {
    var score = 0,
        text,
        queryTerms;
    query = normalizeText(printableQuery(query));
    queryTerms = query.split(/ +/); // TODO: This might not work for all character encodings
    if (hit.description != null) {
        text = hit.title + ' ' + hit.description;
    } else {
        text = hit.title;
    }
    if (text != null) {
        if (text.length > 300) { text = text.substring(0, 300); }
        score = scoreText(text, queryTerms);
    }
    return score - (i / 10);
}


function addToHits(hits, hit) {
    var i, newIndex = hits.length,
        TOP = 100;
    if (newIndex < TOP || hit.score > hits[TOP - 1].score) {
        if (newIndex < TOP) { newIndex += 1; }
        i = newIndex - 1;
        while (i > 0 && hits[i - 1].score < hit.score) {
            hits[i] = hits[i - 1];
            i -= 1;
        }
        hits[i] = hit;
    }
}


function matchingSnippets(hits, queryTerms) { // TODO for queries length > 2
    var i, j, k, description, first, second;
    for (i = 0; i < hits.length; i += 1) {
        first = -1;
        second = -1;
        if (queryTerms.length < 2) { first = 0; } // Take first part of description for query length 1
        if (hits[i].description != null) {
            description = hits[i].description.toLowerCase();
            j = 0;
            while (j < queryTerms.length) {
                if (first == -1) {
                    first = description.indexOf(queryTerms[j]);
                } else if (second == -1) {
                    k = first - 120;
                    if (k < 0) { k = 0; }
                    second = description.indexOf(queryTerms[j], k);
                    if (second == -1) {
                        second = description.indexOf(queryTerms[j]);
                    }
                }
                j += 1;
            }
            if (first == -1) { first = 0; }
            if (second == -1) { second = 0; }
            if (first > second) {
                k = first;
                first = second;
                second = k;
            }
            if (second - first < 120) {
                description = restrictStart(hits[i].description, first - 40, 192);
            } else {
                description =  restrictStart(hits[i].description, first - 40, 92);
                description += restrictStart(hits[i].description, second - 40, 92);
            }
            hits[i].description = description;
        }
    }
}


/**
 *  Reranks hits, and select those that match the query
 *  only used if mother has "rerank"
 */
function scoreAllHits(data, query) {
    var queryTerms, queryLen, hit, score, tscore,
        newHits = [],
        nrOfTopHits = 0,
        i = 0;
    query = normalizeText(printableQuery(query));
    queryTerms = query.split(/ +/).sort(function (a, b) {return b.length - a.length; }); // TODO: Split might not work for all character encodings
    queryLen = queryTerms.length;
    newHits = [];
    while (i < data.hits.length) {
        hit = data.hits[i];
        score = 0;
        tscore = 0;
        if (hit.title != null) {
            tscore = scoreText(hit.title, queryTerms);
        }
        if (tscore == 0 && hit.url != null) {
            tscore = scoreText(hit.url, queryTerms) / 1.1;
        }
        if (tscore < queryLen && hit.description != null) {
            score = scoreText(hit.description, queryTerms);
        }
        if (tscore * 1.1 > score) { // title boost
            score = tscore * 1.1;
        } else {
            score += tscore / 10;
        }
        if (score > 0) {
            if (score >= queryLen) { nrOfTopHits += 1; }
            hit.score = score;
            addToHits(newHits, hit);
        }
        if (nrOfTopHits >= 100) { break; }
        i += 1;
    }
    matchingSnippets(newHits, queryTerms);
    data.hits = newHits;
}

/**
 * creates the onclick function for click log data, which can be inserted
 * in the html of href elements. This does not create an onclick element
 * if logClickDataUrl is not specified in the global parameters
 * @param rank
 * @param kind
 * @returns {*}
 */
function createOnClickElementforClickThrough(rank, kind) {
    if (logClickDataUrl) {
        return ' onclick="logClick(this, \'' + rank + '\', \'' + kind + '\')" ';
    }
    return '';
}


function htmlFullResult(query, hit, rank) {
    var result = '',
        title  = hit.title,
        descr  = hit.description,
        url    = hit.url,
        image  = hit.image;
    title = restrict(title, 80);
    result += '<h4><a ' + createOnClickElementforClickThrough(rank, 'html_result_full')
        + 'href="' + url + '">' + highlightTerms(title, query) + '</a>';
    if (hit.favicon != null) {
        result += '<img src="' + hit.favicon + '" alt="">';
    }
    result += '</h4>';
    if (image != null) {
        result += '<a ' + createOnClickElementforClickThrough(rank, 'html_result_full')
            + 'href="' + url + '"><img src="' + image + '" /></a>';
    }
    result += '<p>';
    if (descr == null) { descr = hit.title; }
    if (descr != null) {
        result += highlightTerms(restrict(descr, 200), query);
    } else {
        result += '&#151;';
    }
    result += '<br><a ' + createOnClickElementforClickThrough(rank, 'html_result_full')
        + 'href="' + url + '">' + highlightTerms(restrict(decodeURIComponent(url), 90), query) + '</a></p>';
    return result;
}

/**
 * Returns suggestions like 'related searches' and 'did you mean'
 * @param resource
 * @param hit
 * @param rank
 * @returns {string}
 */
function htmlSuggestionResult(resource, hit, rank) {
    var result = '',
        title  = hit.title,
        url    = hit.url;
    title = restrict(title, 80);
    result += '<h4>' + resource.name;
    result += ' <a ' + createOnClickElementforClickThrough(rank, 'suggested_result')
        + 'href="' + url + '"><b>' + title + '</b></a></h4>';
    return result;
}


function moreResultsText() {
    var result = "More results &gt;&gt;";
    if (lang === "nl") {
        result = "Meer resultaten &gt;&gt;";
    } else if (lang === "de") {
        result =  "Mehr Ergebnisse &gt;&gt;";
    } else if (lang === "fr") {
        result = "Plus de résultats &gt;&gt;";
    }
    return result;
}


function noMoreResultsText() {
    var result = "No more results.";
    if (lang === "nl") {
        result = "Geen andere resultaten.";
    } else if (lang === "de") {
        result =  "Keine Ergebnisse mehr.";
    } else if (lang === "fr") {
        result = "Pas plus de résultats.";
    }
    return result;
}


function noResultsText() {
    var result = "No results.";
    if (lang === "nl") {
        result = "Geen resultaten.";
    } else if (lang === "de") {
        result =  "Keine Ergebnisse.";
    } else if (lang === "fr") {
        result = "Pas de résultats.";
    }
    return result;
}


function moreResults(event) {
    var i, hit, maxi, query,
        result = '';
    event.preventDefault();
    maxi = searsiaStore.length;
    query = searsiaStore.getQuery();
    if (maxi > 8) { maxi = 8; }
    for (i = 0; i < maxi; i += 1) {
        hit = searsiaStore.shift();
        result += '<div class="search-result">';
        //TODO add ranking for this result (?)
        result += htmlFullResult(query, hit, -1);
        result += '</div>';
    }
    $('#searsia-results-4').append(result); // there are three divs for results, 1=top, 2=subtop, 3=rest, 4=more
    if (searsiaStore.length <= 0) {
        $('#searsia-alert-bottom').html(noMoreResultsText());
    }
}


function checkEmpty() {
    if (nrResults === 0) {
        $('#searsia-alert-bottom').html(noResultsText());
    } else if (searsiaStore.length <= 0) {
        $('#searsia-alert-bottom').html(noMoreResultsText());
    } else {
        $('#searsia-alert-bottom').html('<a href="#more" id="more-results">' + moreResultsText() + '</a>');
        $('#more-results').on('click', function (event) { moreResults(event); });
    }
}


function resultsError(rid, err) {
    var r;
    console.log('WARNING: ' + rid + ' (' + err + ')');
    pending -= 1; // global 
    if (pending <= 0) {
        checkEmpty();
    }
    r = localGetResource(rid);
    if (r != null) {
        r.error = err;
        localSetResource(r);
    }
}


function correctUrl(absUrl, relUrl) {
    if (relUrl.match(/^https?:\/\//) || relUrl.match(/^\/\//)) {
        return relUrl;
    }
    if (absUrl == null) {
        return null;
    }
    if (relUrl.match(/^\//)) {
        return absUrl.replace(/([a-z])\/.*$/, '$1') + relUrl;
    }
    return absUrl.replace(/\/[^\/]+$/, '/') + relUrl;
}


/* 
 * This function is a mutable data type brain cracker:
 * That is we purposely change the values of data and
 * resource here...
 */
function inferMissingData(data, query) {
    var i, hit, resource, rhost,
        typeImages = true,
        typeSmall = true,
        typeFull = false,
        typeTitleOnly = true,
        typeAdvertisement = false,
        count = data.hits.length - 1;

    resource = data.resource;
    if (resource.urltemplate != null) {
        rhost = getHost(resource.urltemplate);
    }
    for (i = count; i >= 0; i -= 1) {
        hit = data.hits[i];
        if (hit.title == null) {  // everything *must* have a title
            hit.title = 'title';
            console.log("Warning: result without title");
        } else {
            hit.title = noHTMLelement(hit.title);
        }
        hit.score = scoreHit(hit, i, query); // TODO: more costly now!
        if (hit.url == null) {
            if (resource.urltemplate != null) {
                hit.url = fillUrlTemplate(resource.urltemplate, encodedQuery(hit.title), '');
            } else {
                hit.url = fillUrlTemplate('?q={q}', encodedQuery(hit.title), '');
            }
        } else {
            hit.url = correctUrl(resource.urltemplate, hit.url); //TODO: what if urltemplate is null?
            if (rhost == null || rhost !== getHost(hit.url)) {
                typeFull = true;
            }
            hit.url = noHTMLelement(hit.url);
        }
        if (hit.description != null) {
            hit.description = noHTMLelement(hit.description);
            typeTitleOnly = false;
        }
        if (hit.image != null) {
            hit.image = noHTMLattribute(correctUrl(resource.urltemplate, hit.image));
            typeTitleOnly = false;
        }
        if (hit.favicon == null && resource.favicon != null) {
            hit.favicon = resource.favicon;
        }
        if (hit.favicon != null) {
            hit.favicon = noHTMLattribute(hit.favicon);
        }
        if (hit.tags == null || hit.tags.indexOf('small') === -1) {
            typeSmall = false;
        }
        if (hit.tags == null || hit.tags.indexOf('image') === -1) {
            typeImages = false;
        }
        if (hit.tags != null && hit.tags.indexOf('advertisement') !== -1) {
            typeAdvertisement = true;
        }
        if (i < count && data.hits[i + 1].score > hit.score) {
            data.hits[i] = data.hits[i + 1]; // bubbling the best scoring hit up
            data.hits[i + 1] = hit;
        }
    }
    if (typeAdvertisement) {
        resource.type = 'advertisement'; // TODO: resourc with mix of ads & web
    } else if (typeImages) {
        resource.type = 'images';
    } else if (typeSmall || typeTitleOnly) {
        resource.type = 'small';
    } else if (typeFull) {
        resource.type = 'full';
    } else {
        resource.type = 'web';
    }
}


/*
 * Returns html sub result, properly length-restricted
 * max length 220 characters, restricting the size of the
 * title and description. Title at least 80 characters.
 */
function htmlSubResultWeb(query, hit, rank) {
    var title  = hit.title,
        descr  = hit.description,
        url    = hit.url,
        image  = hit.image,
        result = '',
        tLength = 0,
        dLength = 0;
    tLength = title.length;
    if (descr != null) {
        dLength = descr.length;
    }
    if (tLength + dLength > 220) {
        tLength = 220 - dLength;
        if (tLength < 80) { tLength = 80; }
        title = restrict(title, tLength);
        tLength = title.length;
    }
    if (tLength + dLength > 220) {
        dLength = 220 - tLength;
    }
    result += '<div class="sub-result">';
    if (image != null) {
        result += '<a ' + createOnClickElementforClickThrough(rank, 'subresult_html_web')
            + 'href="' + url + '"><img src="' + image + '"/></a>';
    }
    result += '<p><a ' + createOnClickElementforClickThrough(rank, 'subresult_html_web')
        + 'href="' + url + '">' + highlightTerms(title, query) + '</a> ';
    if (tLength < 40 && dLength < 40) {
        result += '<br>';
    }
    if (descr != null) {
        result += highlightTerms(restrict(descr, dLength), query);
    }
    result += '</p></div>';
    return result;
}


function htmlSubResultWebFull(query, hit, rank) { // duplicate code with htmlSubResultWeb()
    var title  = hit.title,
        descr  = hit.description,
        url    = hit.url,
        image  = hit.image,
        maxsnip = 220,
        result = '';
    title = restrict(title, 80);
    maxsnip -= title.length;
    result += '<div class="sub-result">';
    if (image != null) {
        result += '<a ' + createOnClickElementforClickThrough(rank, 'subresult_web_full')
            + 'href="' + url + '"><img src="' + image + '"/></a>';
    }
    result += '<div class="descr"><a ' + createOnClickElementforClickThrough(rank, 'subresult_web_full')
        + 'href="' + url + '">' + highlightTerms(title, query) + '</a> ';
    if (descr != null) {
        result += highlightTerms(restrict(descr, maxsnip), query);
    }
    result += '</div>';
    if (url != null) {
        result += '<div class="url"><a ' + createOnClickElementforClickThrough(rank, 'subresult_web_full')
            + 'href="' + url + '">' + highlightTerms(decodeURIComponent(url), query) + '</a></div>';
    }
    result += '</div>';
    return result;
}


function htmlSubResultSmall(query, hit, rank) {
    var title  = hit.title,
        descr  = hit.description,
        url    = hit.url,
        maxsnip = 120,
        result = '';
    title = restrict(title, 80);
    maxsnip -= title.length;
    result += '<div class="sub-result-small">';
    result += '<p><a ' + createOnClickElementforClickThrough(rank, 'subresult_html_small')
        + 'href="' + url + '">' + highlightTerms(title, query) + '</a> ';
    if (descr != null && maxsnip > 40) {
        result += highlightTerms(restrict(descr, maxsnip), query);
    }
    result += '</p></div>';
    return result;
}


function htmlSubResultImage(hit, rank) {
    var title  = hit.title,
        url    = hit.url,
        image  = hit.image,
        result = '';
    title = restrict(title, 80);
    result += '<a ' + createOnClickElementforClickThrough(rank, 'subresult_image')
        + 'href="' + url + '"><img class="sub-image" src="' + image + '" alt="[image]" title="' + title + '"/></a>\n';
    return result;
}


function addToStore(data, begin, end) {
    var i, hits, resource;
    hits = data.hits;
    resource = data.resource;
    for (i = begin; i < end; i += 1) {
        if (hits[i].description == null) {
            if (resource.summary != null) {
                hits[i].description = resource.summary;
            } else {
                hits[i].description = resource.name;
            }
        }
        searsiaStore.push(hits[i]); // global store
    }
}


function htmlSubResults(query, data, rank) {
    var i, maxr,
        MAXX = 4,
        result = '<div>',
        count = data.hits.length,
        resource = data.resource;
    if (resource.type === 'images') {
        MAXX = 7;
    }
    if (count > MAXX) { count = MAXX; }
    for (i = 0; i < count; i += 1) {
        if (resource.type === 'small') {
            result += htmlSubResultSmall(query, data.hits[i], rank);
        } else if (resource.type === 'images') {
            result += htmlSubResultImage(data.hits[i], rank);
        } else if (resource.type === 'full') {
            result += htmlSubResultWebFull(query, data.hits[i], rank);
        } else {
            result += htmlSubResultWeb(query, data.hits[i], rank);
        }
    }
    result += '</div>';
    maxr = data.hits.length;
    if (maxr > 15) { maxr = 15; } // no more than 15 per resource
    addToStore(data, count, maxr);
    return result;
}


function htmlResource(query, resource, printQuery, rank) {
    var url, title,
        result = '<h4>';
    if (resource.urltemplate != null) {
        title = resource.name;
        if (printQuery && resource.urltemplate.indexOf('{q}') > -1) {
            title += ' - ' + printableQuery(query);
            url = fillUrlTemplate(resource.urltemplate, query, '');
        } else {
            url = fillUrlTemplate(resource.urltemplate, '', '');
        }
        result += '<a ' + createOnClickElementforClickThrough(rank, 'html_resource_header')
            + 'href="' + url + '">';
        title = restrict(title, 80);
        result += highlightTerms(title, query) + '</a>';
        if (resource.favicon != null) {
            result += '<img src="' + resource.favicon + '" alt="">';
        }
    } else {
        console.log("Warning, no template: " + resource.name);
        result += highlightTerms(resource.name, query);
    }
    result += '</h4><p>';
    if (resource.summary != null) {
        result += highlightTerms(restrict(resource.summary, 90), query) + '<br>';
    }
    if (url != null) {
        result += '<a ' + createOnClickElementforClickThrough(rank, 'html_resource_header')
            + 'href="' + url + '">' + highlightTerms(restrict(decodeURIComponent(url), 90), query) + '</a>';
    }
    result += '</p>';
    return result;
}


function printSingleResult(query, hit, rank) {
    var result, where = rank;
    result = '<div class="search-result">';
    result += htmlFullResult(query, hit, rank);
    result += '</div>';
    if (where < 1) { where = 1; }
    if (where > 4) { where = 4; }
    $('#searsia-results-' + where).append(result);
}


function printAggregatedResults(query, data, rank, printQuery) {
    var result = '',
        count = data.hits.length,
        resource = data.resource;
    if (count > 0) {
        result += '<div class="search-result">';
        if (count === 1) {
            if (data.hits[0].tags != null && data.hits[0].tags.indexOf('suggestion') !== -1) {
                result += htmlSuggestionResult(resource, data.hits[0], rank);
            } else {
                result += htmlFullResult(query, data.hits[0], rank);
            }
        } else {
            result += htmlResource(query, resource, printQuery, rank);
            result += htmlSubResults(query, data, rank);
        }
        result += '</div>';
        if (rank < 1) { rank = 1; }
        if (rank === 4) { rank = 3; }
        if (rank > 4) { rank = 4; }
        $('#searsia-results-' + rank).append(result); // there are four divs for results, 1=top, 2=subtop, 3=rest, 4=more.
    } else {
        //Remove this resource from the ranking because it is not shown to the user
        searsiaStore.removeFromRanking(rank);
    }
}


function printAdvertisements(query, data, rank) {
    var i, j, filled, result = '',
        count = data.hits.length;
    if (count > 0) {
        if (rank < 4) {
            count = 1;
        } else {
            if (count > 3) { count = 3; }
            filled = 0;
            for (j = 1; j < 4; j += 1) {
                if (!$('#searsia-results-' + j).is(':empty')) {
                    filled += 1;
                }
            }
            if (count > filled) {
                count = filled;
                if (count === 0) {
                    count = 1;
                }
            }
        }
        result += '<div class="panel panel-default"><div class="panel-heading">advertisements';
        if (data.resource != null && data.resource.name != null) {
            result += ' by ' + data.resource.name;
        }
        result += ' </div><div class="panel-body">';
        for (i = 0; i < count; i += 1) {
            result += '<div class="search-result">';
            result += htmlFullResult(query, data.hits[i], rank);
            result += '</div>';
        }
        result += '</div>';
        if (rank < 1) { rank = 1; }
        if (rank < 4) {
            $('#searsia-results-' + rank).append(result);
        } else if ($('#searsia-sidebar-1').is(':empty')) {
            $('#searsia-sidebar-1').append(result);
        } else {
            $('#searsia-sidebar-2').append(result);
        }
    } else {
        //Remove this resource from the ranking because it is not shown to the user
        searsiaStore.removeFromRanking(rank);
    }
}


function printNormalResults(query, data, rank) {
    var result, i, where,
        MAXX = 4,
        count = data.hits.length;
    if (count > MAXX) { count = MAXX; }
    for (i = 0; i < count; i += 1) {
        result = '<div class="search-result">';
        result += htmlFullResult(query, data.hits[i], rank);
        result += '</div>';
        where = rank + i;
        if (where < 1) { where = 1; }
        if (where === 4) { where = 3; }
        if (where > 4) { where = 4; }
        $('#searsia-results-' + where).append(result); // there are four divs for results, 1=top, 2=subtop, 3=rest, 4=more.
    }
    return count;
}


function printResults(query, data, rank, olddata) {
    var nrDisplayed,
        printQuery = true,
        count = data.hits.length; // TODO: also includes 'rid'-only results from searsia engines
    if (data.resource != null && data.resource.apitemplate != null) {
        localSetResource(data.resource);
    }
    if (count === 0) {
        data = olddata;
        printQuery = false;
        count = data.hits.length;
    }
    if (count > 0) {
        inferMissingData(data, query);
        $('#searsia-alert-bottom').html('');
        if (count > 15) { count = 15; } // no more than 15 per resource
        nrResults += count; // global
        if (data.resource != null && data.resource.type != null && data.resource.type === 'advertisement') {
            printAdvertisements(query, data, rank);
        } else if (AGG === 0 || data.resource.name == null) {
            nrDisplayed = printNormalResults(query, data, rank);
            addToStore(data, nrDisplayed, count);
        } else {
            printAggregatedResults(query, data, rank, printQuery); // TODO: addToStore now happens deep inside printAggregatedResults...
        }
    }
    pending -= 1; // global
    if (pending <= 0) {
        checkEmpty();
    }
}


function getResults(query, rid, rank, olddata) {
    /*jslint unparam: true*/
    $.ajax({
        url: fillUrlTemplate(API_TEMPLATE, query, rid),
        success: function (data) { printResults(query, data, rank, olddata); },
        error: function (xhr, options, err) {
            if (xhr.status == 410) {
                deleteLocalStorage(rid);
            } else {
                printResults(query, olddata, rank, olddata);
            }
            resultsError(rid, err);
        },
        timeout: 12000,
        dataType: 'json'
    });
    /*jslint unparam: false*/
}


function queryResources(query, data) {
    var rid, hits, olddata,
        i = 0,
        rank = 1,
        done = [];
    storeMother(data);
    placeIcon(data);
    if (data.resource != null && data.resource.rerank != null) {
        scoreAllHits(data, query);
    }
    hits = data.hits;
    while (i < hits.length) {
        rid = hits[i].rid;
        searsiaStore.addToRanking(rid, rank); // store the ranking of this resource
        if (rid == null) { // a result that is not from another resource
            if (data.resource != null && data.resource.urltemplate != null) {
                hits[i].url = correctUrl(data.resource.urltemplate, hits[i].url);
            }
            printSingleResult(query, hits[i], rank);
            nrResults += 1; // global
            rank += 1;
        } else if (done[rid] !== 1) {
            olddata = { hits: [] };
            if (localExistsResource(rid)) {
                olddata.resource = localGetResource(rid);
                while (i < hits.length && hits[i].rid === rid) {
                    if (hits[i].title != null && hits[i].title != "" && // too many exceptions?
                            (hits[i].url != null || olddata.resource.urltemplate != null) &&
                            (hits[i].foundBefore == null || Date.now() - new Date(hits[i].foundBefore).getTime() < 1209600000)) { // 1209600000 is 2 weeks in ms
                        olddata.hits.push(hits[i]);
                    }
                    i += 1;
                }
                i -= 1;  // otherwise we miss one
            } else {
                olddata.resource = { id: rid }; // TODO: get it?
            }
            if (olddata.hits.length > 0 && rank < 4) {
                $('#searsia-results-' + rank).append(" "); // We know this will be filled (for checks in printAdvertisements)
            }
            getResults(query, rid, rank, olddata);
            pending += 1; // global
            done[rid] = 1;
            rank += 1;
        }
        i += 1;
    }
    if (pending < 1) {
        checkEmpty();
    }
    placeSuggestions(data);
}

/**
 *  fill Template, allowing for instance "!duckduckgo test"
 *  where 'duckduckgo' is the resource identifier
 *  returns url, changes params.q
 *  TODOOOO: @bang only works from main page
 *           bangs do not work when resource not in localStorage
 */
function fillTemplateCheckBangs(template, params) {
    var query = params.q,
        bangQuery = "",
        bangRid = "",
        bangUrl = null,
        resource,
        i,
        terms;
    terms = query.split(/\++/); // This might not work for all char encodings
    for (i = 0; i < terms.length; i += 1) {
        if (terms[i].startsWith('%21') || terms[i].startsWith('%40')) {
            bangRid = terms[i].substring(3, terms[i].length).toLowerCase();
            resource = localGetResource(bangRid);
            if (resource) {
                if (terms[i].startsWith('%21')) {
                    bangUrl = resource.urltemplate;
                }
            } else {
                bangRid = '';
            }
        } else {
            if (bangQuery) { bangQuery += "+"; }
            bangQuery += terms[i];
        }
    }
    if (bangUrl) {
        bangUrl = fillUrlTemplate(bangUrl, bangQuery, '');
        window.location.replace(bangUrl);
        return fillUrlTemplate(template, '', '');
    }
    if (bangRid) {
        params.q = bangQuery;
    }
    return fillUrlTemplate(template, params.q, bangRid);
}


function getResources(params) {
    /*jslint unparam: true*/
    var url;
    if (params.q.length > 150) {
        searsiaError('Query too long.');
        return;
    }
    url = fillTemplateCheckBangs(API_TEMPLATE, params);
    searsiaStore.setQuery(params.q);
    $.ajax({
        url: url,
        success: function (data) { queryResources(params.q, data); },
        error: function (xhr, options, error) { searsiaError('Temporarily out of order. Please try again later.'); },
        timeout: 10000,
        dataType: 'json'
    });
    $('#searsia-alert-bottom').html('<img src="images/progress.gif" alt="searching...">');
    /*jslint unparam: false*/
}


function getResourceInfo(rid) {
    $.ajax({
        url: fillUrlTemplate(API_TEMPLATE, '', rid),
        timeout: 10000,
        dataType: 'json'
    }).done(function (data) {
        localSetResource(data.resource);
    });
}


// get the 15 most important resources
function storeResources(data) {
    var rid,
        i = 0,
        j = 0,
        hits = data.hits;
    if (hits != null) {
        while (i < hits.length && j < 15) {
            rid = hits[i].rid;
            if (rid != null && !localExistsResource(rid)) {
                getResourceInfo(rid);
                j += 1;
            }
            i += 1;
        }
    }
}


function initSearsiaClient(data) {
    storeMother(data);
    placeBanner(data);
    placeIcon(data);
    placeName(data);
    placeSuggestions(data);
    storeResources(data);
    $("#searsia-input").focus();
}


/**
 * set cookie value
 * @param cname name of the cookie
 * @param cvalue value of the cookie
 * @param exdays days before the cookie expires
 */
function setCookie(cname, cvalue, exdays) {
    var d = new Date(),
        expires;
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    expires = "expires=" + d.toUTCString();
    document.cookie = cname + "=" + cvalue + "; " + expires;
}


/**
 * get a cookie value
 * @param cname the name of the cookie
 * @returns {*}
 */
function getCookie(cname) {
    var name = cname + "=",
        ca = document.cookie.split(';'),
        i,
        c;
    for (i = 0; i < ca.length; i += 1) {
        c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}


/*jslint bitwise: true*/
/**
 * Generates a random identifier compliant with the uuid(v4) spec.
 * The randomness of this number is based on Math.random(), which might not
 * be a guaranteed RNG.
 * @returns {string} the uuid string
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,
        function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
}
/*jslint bitwise: false*/


/**
 * Returns an anonymous identifier for the user session, creates a session
 * if a session does not exist This session identifier is generated and
 * stored client-side. This is nog a server-side session.
 */
function getOrSetSessionIdentifier() {
    var sessionId = getCookie('sessionId');
    if (!sessionId) {
        sessionId = generateUUID();
        setCookie('sessionId', sessionId, 1);
    }
    return sessionId;
}


/**
 * converts a standard url to a url suitable for clicklogging
 * Does not convert if click through data is disabled
 * This can be done by replacing the contents of the logClickDataUrl
 * variable with 0 or undefined
 */
function convertUrlForClickThroughData(url, rank, kind) {
    if (logClickDataUrl) {
        //replace &amp; with normal & for encoding the uri component
        url = url.replace(/&amp;/g, "&");
        url = encodeURIComponent(url);
        url = logClickDataUrl + '?url=' + url;

        url += '&query=' + searsiaStore.getQuery();

        if (rank) {
            url += '&rank=' + rank;
            url += '&ordering=' + searsiaStore.getRanking(rank).toString();
        }
        if (kind) {
            url += '&kind=' + kind;
        }
        if (sendSessionIdentifier) {
            url += '&sessionId=' + getOrSetSessionIdentifier();
        }
    }
    return url;
}


/**
 * This function is used although editors might show it as unused, this
 * function is only called from generated html. This functions logs the
 * click data and continues normal forwarding operations for the user.
 * @param element the element that is clicked on
 * @param rank the rank of the clicked element
 * @param kind the kind of link that is clicked on
 */
function logClick(element, rank, kind) {
    var url;
    if (logClickDataUrl) {
        //TODO make post call
        if (element != null) {
            url = $(element).attr('href');
        } else {
            url = 'query';
        }
        $.ajax({
            type: "GET",
            url: convertUrlForClickThroughData(url, rank, kind)
        });
    }
}


function connectToServer() {
    /*jslint unparam: true*/
    $.ajax({
        url: fillUrlTemplate(API_TEMPLATE, '', ''),
        success: function (data) { initSearsiaClient(data); },
        error: function (xhr, options, error) {
            if (API_TEMPLATE) {
                searsiaError('Temporarily no connection possible. Please try again later.');
            } else {
                searsiaError('If you see this then searsiaclient needs to be configured. Please set the value of API_TEMPLATE in searsia.js.');
            }
        },
        timeout: 10000,
        dataType: 'json'
    });
    /*jslint unparam: false*/
}

