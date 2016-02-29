/*
 * Copyright 2016 Searsia
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
 * Searsia Client v1.2 spaghetti code:
 *   The web page should call getResources(params) 
 *   (using parameters from: searsiaUrlParameters())
 *   see: search.html
 *   Syntax checked with: jslint --eqeq --regexp --todo searsia.js
 */

/*global $, window, document, alert, jQuery, localStorage*/

"use strict";

var API_TEMPLATE = 'http://search.utwente.nl/searsia/search?q={q?}&r={r?}';
//var API_TEMPLATE = 'http://localhost:16842/searsia/search?q={q?}&r={r?}';


var AGG       = 1;   // 1=Aggregate results, 0=only boring links
var pending   = 0;   // Number of search engines that are answering a query
var nrResults = 0;   // Total number of results returned 
var page      = 1;   // search result page
var lang      = document.getElementsByTagName('html')[0].getAttribute('lang');    // used for language-dependent texts

var store = {

    hits: [],
    length: 0,
    query: '',

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
    }

};


function fromMetaStore(field, value) {
    if (value != null) {
        try {
            window.localStorage['searsia-' + field] = value;
        } catch (ignore) { }
    } else {
        try {
            value = window.localStorage['searsia-' + field];
        } catch (ignore) { }
    }
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
    var id = fromMetaStore('id', null);
    if (id != null) {
        try {
            window.localStorage[id + '/' + resource.id] = JSON.stringify(resource);
        } catch (ignore) { }
    }
}


function localGetResource(rid) {
    var id = fromMetaStore('id', null);
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
    var id = fromMetaStore('id', null);
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
    var id = fromMetaStore('id', null);
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
        id = fromMetaStore('id', null);
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


function storeMother(data) {
    if (data.resource != null && data.resource.id != null) {
        fromMetaStore('id', data.resource.id);
        data.resource.type = 'mother';
        localSetResource(data.resource);
    }
}


function placeBanner(data) {
    var banner = null;
    if (data.resource != null) {
        banner = data.resource.banner;
    }
    banner = fromMetaStore('banner', banner);
    if (banner != null && $('#searsia-banner').length) {
        $('#searsia-banner').html('<img src="' + banner + '" alt="" />');
    }
}


function placeName(data) {
    var name = null;
    if (data.resource != null) {
        name = data.resource.name;
    }
    name = fromMetaStore('name', name);
    if (name != null) {
        $('head title').html(name + ' - Search');
    }
}


function placeIcon(data) {
    var icon = null;
    if (data.resource != null) {
        icon = data.resource.favicon;
    }
    icon = fromMetaStore('icon', icon);
    if (icon != null) {
        $('#favicon').attr('href', icon);
        $('div.searsia-icon img').attr('src', icon);
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
            params.q = params.q.replace(/^\++|\++$/g, ''); // no leading and trailing spaces 
        } else if (values[0] === 'r') {
            params.r = values[1];
        }
    }
    return params;
}


function searsiaError(text) {
    $('#searsia-alert-bottom').html(text);
}


function printableQuery(query) {
    query = query.replace(/\+/g, ' ');
    return decodeURIComponent(query);
}


function encodedQuery(text) {
    text = encodeURIComponent(text);
    text = text.replace(/%20/g, '+');
    return text;
}


function fillForm(query) {
    $('#searsia-form').find('input').attr('value', printableQuery(query));
}


function fillUrlTemplate(template, query, resource) {
    template = template.replace(/\{q\??\}/, query);
    template = template.replace(/\{r\??\}/, resource);
    return template.replace(/\{[A-Za-z]+\?\}/, '');  // remove all optional
}


function restrict(someText, size) { // size must be > 3
    if (someText != null && someText.length > size) {
        someText = someText.substr(0, size - 3) + '...';
    }
    return someText;
}


function highlightTerms(someText, query) {
    var i, re,
        terms = query.split(/\++/); // This might not work for all character encodings
    for (i = 0; i < terms.length; i += 1) {
        if (terms[i].length < 3) {
            terms[i] = '\\b' + terms[i] + '\\b';
        }
        try {
            re = new RegExp('(' + terms[i] + ')', "gi");
            someText = someText.replace(re, '<b>$1</b>');
        } catch (ignore) { }
    }
    return someText;
}


function normalizeText(text) {
    return text.toLowerCase().replace(new RegExp('[^a-z0-9]', 'g'), ' ');
}


function scoreText(text, query) {
    var i, j, len,
        queryTerms,
        textTerms,
        score = 0.0;
    query = normalizeText(printableQuery(query));
    queryTerms = query.split(/ +/); // TODO: This might not work for all character encodings
    textTerms = normalizeText(text).split(/ +/);
    for (i = 0; i < queryTerms.length; i += 1) { // TODO: Really? Nested loop??
        len = textTerms.length;
        if (len > 45) { len = 45; } // Only check first 45 words
        for (j = 0; j < len; j += 1) {
            if (queryTerms[i] === textTerms[j]) {
                score += 1.0;
                break; // one occurrence per query term
            }
        }
    }
    return score;
}


function scoreHit(hit, i, query) {
    var score = 0,
        text;
    if (hit.description != null) {
        text = hit.title + ' ' + hit.description;
    } else {
        text = hit.title;
    }
    if (text != null) {
        score = scoreText(text, query);
    }
    return score - (i / 10);
}


function htmlFullResult(query, hit) {
    var result = '',
        title  = hit.title,
        descr  = hit.description,
        url    = hit.url,
        image  = hit.image;
    title = restrict(title, 80);
    result += '<h4><a href="' + url + '">' + highlightTerms(title, query) + '</a>';
    if (hit.favicon != null) {
        result += '<img src="' + hit.favicon + '" alt="">';
    }
    result += '</h4>';
    if (image != null) {
        result += '<a href="' + url + '"><img src="' + image + '" /></a>';
    }
    result += '<p>';
    if (descr == null) { descr = hit.title; }
    if (descr != null) {
        result += highlightTerms(restrict(descr, 200), query);
    } else {
        result += '&#151;';
    }
    result += '<br><a href="' + url + '">' + highlightTerms(restrict(url, 90), query) + '</a></p>';
    return result;
}


function htmlSuggestionResult(resource, hit) {
    var result = '',
        title  = hit.title,
        url    = hit.url;
    title = restrict(title, 80);
    result += '<h4>' + resource.name;
    result += ' <a href="' + url + '"><b>' + title + '</b></a></h4>';
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
    maxi = store.length;
    query = store.getQuery();
    if (maxi > 8) { maxi = 8; }
    for (i = 0; i < maxi; i += 1) {
        hit = store.shift();
        result += '<div class="search-result">';
        result += htmlFullResult(query, hit);
        result += '</div>';
    }
    $('#searsia-results-4').append(result); // there are three divs for results, 1=top, 2=subtop, 3=rest, 4=more
    if (store.length <= 0) {
        $('#searsia-alert-bottom').html(noMoreResultsText());
    }
    // $wh.fireLayoutChangeEvent(document.getElementById("searsiasearch"));
}


function checkEmpty() {
    if (nrResults === 0) {
        $('#searsia-alert-bottom').html(noResultsText());
    } else if (store.length <= 0) {
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
        count = data.hits.length - 1;

    resource = data.resource;
    if (resource.urltemplate != null) {
        rhost = getHost(resource.urltemplate);
        if (resource.favicon == null) {
            resource.favicon = correctUrl(resource.urltemplate, '/favicon.ico');
        }
    }
    for (i = count; i >= 0; i -= 1) {
        hit = data.hits[i];
        if (hit.title == null) {  // everything *must* have a title
            console.log("Warning: result without title");
        }
        hit.score = scoreHit(hit, i, query);
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
        }
        if (hit.image != null) {
            hit.image = correctUrl(resource.urltemplate, hit.image);
        }
        if (hit.favicon == null && resource.favicon != null) {
            hit.favicon = resource.favicon;
        }
        if (hit.tags == null || hit.tags.indexOf('small') === -1) {
            typeSmall = false;
        }
        if (hit.tags == null || hit.tags.indexOf('image') === -1) {
            typeImages = false;
        }
        if (i < count && data.hits[i + 1].score > hit.score) {
            data.hits[i] = data.hits[i + 1]; // bubbling the best scoring hit up
            data.hits[i + 1] = hit;
        }
    }
    if (typeSmall) {
        resource.type = 'small';
    } else if (typeImages) {
        resource.type = 'images';
    } else if (typeFull) {
        resource.type = 'full';
    } else {
        resource.type = 'web';
    }
}


function htmlSubResultWeb(query, hit) {
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
        result += '<a href="' + url + '"><img src="' + image + '"/></a>';
    }
    result += '<p><a href="' + url + '">' + highlightTerms(title, query) + '</a> ';
    if (descr != null) {
        result += highlightTerms(restrict(descr, maxsnip), query);
    }
    result += '</p></div>';
    return result;
}


function htmlSubResultWebFull(query, hit) { // duplicate code with htmlSubResultWeb()
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
        result += '<a href="' + url + '"><img src="' + image + '"/></a>';
    }
    result += '<div class="descr"><a href="' + url + '">' + highlightTerms(title, query) + '</a> ';
    if (descr != null) {
        result += highlightTerms(restrict(descr, maxsnip), query);
    }
    result += '</div>';
    if (url != null) {
        result += '<div class="url"><a href="' + url + '">' + highlightTerms(url, query) + '</a></div>';
    }
    result += '</div>';
    return result;
}


function htmlSubResultSmall(query, hit) {
    var title  = hit.title,
        descr  = hit.description,
        url    = hit.url,
        maxsnip = 120,
        result = '';
    title = restrict(title, 80);
    maxsnip -= title.length;
    result += '<div class="sub-result-small">';
    result += '<p><a href="' + url + '">' + highlightTerms(title, query) + '</a> ';
    if (descr != null && maxsnip > 40) {
        result += highlightTerms(restrict(descr, maxsnip), query);
    }
    result += '</p></div>';
    return result;
}


function htmlSubResultImage(hit) {
    var title  = hit.title,
        url    = hit.url,
        image  = hit.image,
        result = '';
    title = restrict(title, 80);
    result += '<a href="' + url + '"><img class="sub-image" src="' + image + '" alt="[image]" title="' + title + '"/></a>\n';
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
        store.push(hits[i]); // global store
    }
}


function htmlSubResults(query, data) {
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
            result += htmlSubResultSmall(query, data.hits[i]);
        } else if (resource.type === 'images') {
            result += htmlSubResultImage(data.hits[i]);
        } else if (resource.type === 'full') {
            result += htmlSubResultWebFull(query, data.hits[i]);
        } else {
            result += htmlSubResultWeb(query, data.hits[i]);
        }
    }
    result += '</div>';
    maxr = data.hits.length;
    if (maxr > 15) { maxr = 15; } // no more than 15 per resource
    addToStore(data, count, maxr);
    return result;
}


function htmlResource(query, resource) {
    var url, title,
        result = '<h4>';
    if (resource.urltemplate != null) {
        url = fillUrlTemplate(resource.urltemplate, query, '');
        result += '<a href="' + url + '">';
        title = resource.name;
        if (resource.urltemplate.indexOf('{q}') > -1) {
            title += ' - ' + printableQuery(query);
        }
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
        result += '<a href="' + url + '">' + highlightTerms(restrict(url, 90), query) + '</a>';
    }
    result += '</p>';
    return result;
}


function printSingleResult(query, hit, where) {
    var result;
    result = '<div class="search-result">';
    result += htmlFullResult(query, hit);
    result += '</div>';
    if (where < 1) { where = 1; }
    if (where > 4) { where = 4; }
    $('#searsia-results-' + where).append(result);
}


function printAggregatedResults(query, data, rank) {
    var result = '',
        count = data.hits.length,
        resource = data.resource;
    if (count > 0) {
        result += '<div class="search-result">';
        if (count === 1) {
            if (data.hits[0].tags != null && data.hits[0].tags.indexOf('suggestion') !== -1) {
                result += htmlSuggestionResult(resource, data.hits[0]);
            } else {
                result += htmlFullResult(query, data.hits[0]);
            }
        } else {
            result += htmlResource(query, resource);
            result += htmlSubResults(query, data);
        }
        result += '</div>';
        if (rank < 1) { rank = 1; }
        if (rank > 4) { rank = 4; }
        $('#searsia-results-' + rank).append(result); // there are four divs for results, 1=top, 2=subtop, 3=rest, 4=more.
    }
}


function printNormalResults(query, data, rank) {
    var result, i, where,
        MAXX = 4,
        count = data.hits.length;
    if (count > MAXX) { count = MAXX; }
    for (i = 0; i < count; i += 1) {
        result = '<div class="search-result">';
        result += htmlFullResult(query, data.hits[i]);
        result += '</div>';
        where = rank + i;
        if (where < 1) { where = 1; }
        if (where > 4) { where = 4; }
        $('#searsia-results-' + where).append(result); // there are four divs for results, 1=top, 2=subtop, 3=rest, 4=more.
    }
    return count;
}


function printResults(query, data, rank, olddata) {
    var nrDisplayed,
        count = data.hits.length; // TODO: also includes 'rid'-only results from searsia engines
    if (data.resource != null && data.resource.apitemplate != null) {
        localSetResource(data.resource);
    }
    if (count > 0) {
        inferMissingData(data, query);
        $('#searsia-alert-bottom').html('');
        if (count > 15) { count = 15; } // no more than 15 per resource
        nrResults += count; // global
        if (AGG === 0 || data.resource.name == null) {
            nrDisplayed = printNormalResults(query, data, rank);
            addToStore(data, nrDisplayed, count);
        } else {
            printAggregatedResults(query, data, rank); // TODO: addToStore now happens deep inside printAggregatedResults...
        }
    } else {
        inferMissingData(olddata, query);
        printAggregatedResults(query, olddata, rank);
    }
    pending -= 1; // global
    if (pending <= 0) {
        checkEmpty();
    }
    // $wh.fireLayoutChangeEvent(document.getElementById("searsiasearch"));
}


function getResults(query, rid, rank, olddata) {
    /*jslint unparam: true*/
    $.ajax({
        url: fillUrlTemplate(API_TEMPLATE, query, rid),
        success: function (data) { printResults(query, data, rank, olddata); },
        error: function (xhr, options, err) {
            printResults(query, olddata, rank, olddata);
            resultsError(rid, err);
        },
        timout: 12000,
        dataType: 'json'
    });
    /*jslint unparam: false*/
}


function queryResources(query, data) {
    var rid, hits, olddata, oldquery,
        i = 0,
        rank = 1,
        done = [];
    storeMother(data);
    placeIcon(data);
    store.setQuery(query);
    hits = data.hits;
    while (i < hits.length) {
        rid = hits[i].rid;
        if (rid == null) { // a result that is not from another resource
            if (data.resource == null || data.resource.rerank == null || scoreHit(hits[i], 0, query) > 0.0) { // TODO: real rearanking
                printSingleResult(query, hits[i], rank);
                nrResults += 1; // global
                rank += 1;
            }
        } else if (done[rid] !== 1) {
            oldquery = hits[i].query;
            olddata = { hits: [] };
            if (localExistsResource(rid)) {
                olddata.resource = localGetResource(rid);
                while (i < hits.length && hits[i].rid === rid) {
                    if (hits[i].title != null && hits[i].title != "" && // too many exceptions?
                            (hits[i].url != null || olddata.resource.urltemplate != null)) {
                        olddata.hits.push(hits[i]);
                    }
                    i += 1;
                }
                i -= 1;  // otherwise we miss one
            } else {
                olddata.resource = { id: rid }; // TODO: get it?
            }
            if (oldquery === query && localExistsResource(rid) && olddata.hits.length > 0) {  // a 'cached' result.
                printResults(query, olddata, rank, olddata);
            } else {                         // some result, but not the best
                getResults(query, rid, rank, olddata);
                pending += 1; // global
            }
            done[rid] = 1;
            rank += 1;
        }
        i += 1;
    }
    if (pending < 1) {
        checkEmpty();
    }
    // $wh.fireLayoutChangeEvent(document.getElementById("searchresults"));
}


function getResources(params) {
    /*jslint unparam: true*/
    $.ajax({
        url: fillUrlTemplate(API_TEMPLATE, params.q, ''),
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
    storeResources(data);
}


function connectToServer() {
    /*jslint unparam: true*/
    $.ajax({
        url: fillUrlTemplate(API_TEMPLATE, '', ''),
        success: function (data) { initSearsiaClient(data); },
        error: function (xhr, options, error) { searsiaError('Cannot connect to search server.'); },
        timeout: 10000,
        dataType: 'json'
    });
    /*jslint unparam: false*/
}

