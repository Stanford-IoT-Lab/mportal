// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Stanford MPortal
//
// Copyright 2016 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details

const Q = require('q');

const platform = require('./platform');
const OmletDispatcher = require('./omletdispatcher');

function main() {
    platform.init().then(function() {

    }).finally(function() {
        console.log('Cleaning up...');
        platform.exit();
    });
}
