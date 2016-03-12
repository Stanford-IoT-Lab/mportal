// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Stanford MPortal
//
// Copyright 2015-2016 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const Q = require('q');
const fs = require('fs');
const os = require('os');

const prefs = require('./lib/prefs');
const graphics = require('./lib/graphics');

var _writabledir = null;
var _cachedir = null;
var _prefs = null;

function safeMkdirSync(dir) {
    try {
        fs.mkdirSync(dir);
    } catch(e) {
        if (e.code !== 'EEXIST')
            throw e;
    }
}

// Most of this code is compat code to run engine modules from the main cloud process
// and so it is stubbed out. But this also helps with relocation and dynamic paths
// Look in instance/platform.js for the actual cloud platform code
module.exports = {
    // Initialize the platform code
    init: function() {
        _writabledir = process.cwd();
        _cachedir = _writabledir + '/cache';
        safeMkdirSync(_cachedir);

        _prefs = new prefs.FilePreferences(_writabledir + '/prefs.db');
        return Q();
    },

    hasCapability: function(cap) {
        switch(cap) {
        case 'graphics-api':
            return true;

        default:
            return false;
        }
    },

    getCapability: function(cap) {
        switch(cap) {
        case 'graphics-api':
            return graphics;

        default:
            return null;
        }
    },

    getSharedPreferences: function() {
        return _prefs;
    },

    getRoot: function() {
        return process.cwd();
    },

    getWritableDir: function() {
        return _writabledir;
    },

    getCacheDir: function() {
        return _cachedir;
    },

    getTmpDir: function() {
        return os.tmpdir();
    },

    exit: function() {
        return process.exit();
    },

    // Return a server/port URL that can be used to refer to this
    // installation. This is primarily used for OAuth redirects, and
    // so must match what the upstream services accept.
    getOrigin: function() {
        // Xor these comments for testing
        return 'http://127.0.0.1:8001';
        //return 'https://mportal.stanford.edu';
    },
};
