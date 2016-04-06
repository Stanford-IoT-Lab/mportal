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
const events = require('events');

const Dialog = require('./dialog');
const LambdaForm = require('./lambda');
const SemanticAnalyzer = require('./semantic');

const PictureObject = require('./model/pictureobj');

function flatten(aoa) {
    var out = [];
    aoa.forEach(function(a) {
        a.forEach(function(x) {
            out.push(x);
        });
    });
    return out;
}

module.exports = new lang.Class({
    Name: 'Conversation',

    _init: function(client, sempre, feed, user, patient, doctorPortal) {
        this._client = client;
        this._sempre = sempre;
        this._feed = feed;
        this._user = user;
        this._patient = patient;
        this._doctorPortal = doctorPortal;
        this._onMessageListener = this._onMessage.bind(this);
        this._onDoctorMessageListener = this.notify.bind(this);
        this._notifyQueue = [];

        console.log('Initializing conversation on feed ' + feed.feedId + ' with user ' + user.account);

        this._raw = false;
    },

    get user() {
        return this._user;
    },

    get patient() {
        return this._patient;
    },

    get doctorPortal() {
        return this._doctorPortal;
    },

    notify: function(data) {
        if (!this._dialog.notify(data))
            this._notifyQueue.push(data);
    },

    _flushNotify: function() {
        var queue = this._notifyQueue;
        this._notifyQueue = [];
        queue.forEach(function(data) {
            this.notify(data);
        }, this);
    },

    setDialog: function(dlg) {
        this._dialog = dlg;
        dlg.manager = this;
        dlg.start();
        this._flushNotify();
    },

    setRaw: function(raw) {
        this._raw = raw;
    },

    handlePicture: function(url) {
        console.log('Received picture ' + url);

        return Q.try(function() {
            return this._dialog.handlePicture(url);
        }.bind(this)).then(function(handled) {
            if (!handled)
                this._dialog.unexpected();
        }.bind(this)).catch(function(e) {
            console.error('Failed to process assistant picture: ' + e.message);
            console.error(e.stack);
            this._dialog.failReset();
        }.bind(this));
    },

    handleCommand: function(command) {
        console.log('Received command ' + command);

        return Q.try(function() {
            if (this._raw)
                return this._dialog.handleRaw(command);

            return this._sempre.sendUtterance(this._feed.feedId, command).then(function(analyzed) {
                console.log('Analyzed message into ' + analyzed);

                var parser = new LambdaForm.Parser(analyzed);
                var parsed = parser.parse();
                console.log('Parsed and normalized into ' + parsed);
                var analyzer = new SemanticAnalyzer(parsed);
                analyzer.run();
                return this._dialog.handle(analyzer);
            }.bind(this));
        }.bind(this)).then(function(handled) {
            if (!handled)
                this._dialog.fail();
        }.bind(this)).catch(function(e) {
            console.error('Failed to process command: ' + e.message);
            console.error(e.stack);
            this._dialog.failReset();
        }.bind(this));
    },

    handleUI: function(ui) {
        return Q.try(function() {
            console.log('Received preparsed command ' + ui);
            var parser = new LambdaForm.Parser(ui);
            var parsed = parser.parse();
            var analyzer = new SemanticAnalyzer(parsed);
            analyzer.run();

            return this._dialog.handle(analyzer);
        }.bind(this)).then(function(handled) {
            if (!handled)
                this._dialog.fail();
        }.bind(this)).catch(function(e) {
            console.error('Failed to process command: ' + e.message);
            console.error(e.stack);
            this._dialog.failReset();
        }.bind(this));
    },

    sendReply: function(msg) {
        return this._feed.sendText(msg);
    },

    sendPicture: function(url) {
        return this._feed.sendPicture(msg);
    },

    sendRDL: function(rdl) {
        return this._feed.sendRaw(rdl);
    },

    _onMessage: function(msg) {
        if (msg.type === 'text') {
            if (msg.hidden)
                this.handleUI(msg.text).done();
            else
                this.handleCommand(msg.text).done();
        } else if (msg.type === 'picture') {
            this.handlePicture(PictureObject.fromBlob(this._feed.feedId, msg.fullSizeHash));
        }
    },

    start: function() {
        this._feed.on('incoming-message', this._onMessageListener);
        this._patient.on('message', this._onDoctorMessageListener);
        return this._feed.open().then(function() {
            return this._patient.init(this._user.account);
        }.bind(this)).then(function() {
            this.setDialog(new Dialog.InitializationDialog());
        }.bind(this));
    },

    stop: function() {
        this._feed.removeListener('incoming-message', this._onMessageListener);
        this._patient.removeListener('message', this._onDoctorMessageListener);
        return this._feed.close();
    }
})
