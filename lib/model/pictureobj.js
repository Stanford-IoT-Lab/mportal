// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Stanford MPortal
//
// Copyright 2016 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const Q = require('q');
const lang = require('lang');
const https = require('https');
const url = require('url');
const crypto = require('crypto');

function getAccessToken() {
    return platform.getSharedPreferences().get('dropbox')['access-token'];
}

// dropbox is anal about milliseconds...
function toDropboxIsoString() {
    function pad(number) {
        if (number < 10) {
            return '0' + number;
        }
        return number;
    }
    return this.getUTCFullYear() +
        '-' + pad(this.getUTCMonth() + 1) +
        '-' + pad(this.getUTCDate()) +
        'T' + pad(this.getUTCHours()) +
        ':' + pad(this.getUTCMinutes()) +
        ':' + pad(this.getUTCSeconds()) +
        'Z';
}

const PictureObject = new lang.Class({
    Name: 'PictureObject',

    _init: function(feedId, blobId) {
        this._feedId = feedId;
        this._blobId = blobId;
    },

    serialize: function() {
        return this._feedId + '/' + this._blobId;
    },

    _getPath: function() {
        return '/Apps/Omlet/data/' + this._feedId + '/files/' + this._blobId;
    },

    download: function() {
        var options = url.parse('https://content.dropboxapi.com/2/files/download');
        options.headers = {
            'Authorization': 'Bearer ' + getAccessToken(),
            'Dropbox-API-Arg': JSON.stringify({ path: this._getPath() })
        }
        options.method = 'POST';
        return Q.Promise(function(callback, errback) {
            var req = https.request(options, callback);
            req.on('error', errback);
            req.end();
        });
    },

    getSharedLink: function() {
        // Omlet by default will keep a public shared link to the file, so just read it out
        //
        var options = url.parse('https://api.dropboxapi.com/2/sharing/list_shared_links');
        console.log("Access token", getAccessToken());
        options.headers = {
            'Authorization': 'Bearer ' + getAccessToken(),
            'Content-Type': 'application/json'
        };
        options.method = 'POST';
        var expires = new Date;
        expires.setTime(expires.getTime() + 2 * 7 * 24 * 3600 * 1000); // 2 weeks from now
        var data = JSON.stringify({
            path: this._getPath(),
            direct_only: true,
        });
        return Q.Promise(function(callback, errback) {
            var req = https.request(options, function(res) {
                var buffer = '';
                res.on('data', function(data) {
                    buffer += data;
                });
                res.on('end', function() {
                    try {
                        var parsed = JSON.parse(buffer);
                        callback(parsed.links[0].url);
                    } catch(e) {
                        console.log('Error parsing server response');
                        console.log('Full response: ' + buffer);
                        errback(e);
                    }
                });
            });
            req.on('error', errback);
            req.end(data);
        });
    }
});
PictureObject.fromBlob = function(fullFeedId, blobHash, mimeType) {
    var extension;
    if (mimeType === 'image/jpeg')
        extension = 'jpg';
    else if (mimeType === 'image/png')
        extension = 'png';
    else
        extension = 'jpg';

    var md5 = crypto.createHash('md5');
    md5.update(fullFeedId, 'utf8');
    var feedHash = md5.digest('hex').substring(0, 16);

    var blobId = (new Buffer(blobHash, 'base64')).toString('hex');

    return new PictureObject(feedHash, blobId + '.' + extension);
}

PictureObject.fromSerialized = function(serialized) {
    var split = serialized.split('/');
    return new PictureObject(split[0], split[1]);
}

module.exports = PictureObject;
