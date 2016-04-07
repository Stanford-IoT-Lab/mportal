// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Stanford MPortal
//
// Copyright 2016 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const lang = require('lang');
const db = require('./db');
const doctor = require('./doctor');
const patient = require('./patient');
const events = require('events');
const conversations = require('./conversation');

module.exports = new lang.Class({
    Name: 'ConversationFetcher',
    Extends: events.EventEmitter,

    _init: function(patientId) {
        events.EventEmitter.call(this);

        this.patientId = patientId;
        this.state = platform.getSharedPreferences();
    },

    start: function() {
        console.log('Starting conversation fetcher for patient ' + this.patientId);
        this.interval = setInterval(this._onTick.bind(this), 10000);
        this._onTick();
    },

    stop: function() {
        clearInterval(this.interval);
        this.interval = null;
    },

    _onTick: function() {
        var lastSeen = this.state.get('last-seen-' + this.patientId);
        if (lastSeen === undefined)
            lastSeen = null;
        console.log('Checking for messages for patient ' + this.patientId + ' after ' + lastSeen);

        conversations.getByPatient(db, this.patientId, lastSeen).then(function(rows) {
            var maxId = undefined;
            console.log('Found ' + rows.length + ' messages for patient ' + this.patientId);
            rows.forEach(function(row) {
                maxId = row.id;
                this.emit('message', [row.text, row.full_name, row.affiliation]);
            }, this);
            if (maxId !== undefined)
                this.state.set('last-seen-' + this.patientId, maxId);
        }.bind(this)).done();
    }
});
