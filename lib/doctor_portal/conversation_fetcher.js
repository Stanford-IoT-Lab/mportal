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

    start: function(patientId) {
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

        conversations.getByPatient(db, this.patientId, lastSeen).then(function(rows) {
            var maxTime;
            rows.forEach(function(row) {
                maxTime = row.timestamp;
                this.emit('message', [row.text, row.full_name, row.affiliation]);
            }, this);
            if (maxTime !== undefined)
                this.state.set('last-seen-' + this.patientId, maxTime);
        }.bind(this)).done();
    }
});
