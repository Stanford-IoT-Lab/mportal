// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Stanford MPortal
//
// Copyright 2016 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

require('./lib/polyfill');

const Q = require('q');

const OmletDispatcher = require('./lib/omletdispatcher');

function main() {
    global.platform = require('./platform');
    var dispatcher;

    function onsignal() {
        console.log('Cleaning up...');
        dispatcher.stop().then(function() {
            platform.exit();
        });
    }
    process.on('SIGINT', onsignal);
    process.on('SIGTERM', onsignal);

    platform.init().then(function() {
        console.log('Platform initialized');
        dispatcher = new OmletDispatcher(process.argv[2] === '--flush-only');
        return dispatcher.start();
    }).catch(function(e) {
        console.error('Caught early exception: ' + e.message);
        console.error(e.stack);
        platform.exit();
    });
}

main();
