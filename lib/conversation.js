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

const db = require('./model/db');
const model = require('./model/patient');
const medical_record = require('./model/medical_record');

const Patient = new lang.Class({
    Name: 'Patient',

    _init: function(user) {
        this._user = user;
        this._row = null;
    },

    init: function(account) {
        return model.getByAccount(this._user.account).then(function(patients) {
            if (patients.length > 0)
                this._row = patients[0];
            else
                this._row = null;
        });
    },

    get isValid() {
        return this._row !== null;
    },

    get nick_name() {
        return this._row.nick_name;
    },

    get date_of_birth() {
        return this._row.date_of_birth;
    },

    getInfo: function() {
        return patient.getInfo(this._row.id);
    },

    store: function(data) {
        data.omlet_account = this._user.account;
        return db.transaction(function() {
            return patient.insert(data);
        }).then(function(id) {
            data.id = id;
            this._row = data;
        }.bind(this));
    },

    changeDOB: function(dob) {
        return db.transaction(function() {
            return patient.changeDOB(this._row.id, data);
        }.bind(this)).then(function() {
            this._row.date_of_birth = dob;
        }.bind(this));
    },

    insertWeight: function(weight) {
        var now = new Date;
        return db.transaction(function() {
            return medical_record.insertWeight(this._row.id, now, now, weight);
        }.bind(this));
    },

    insertHeight: function(height) {
        var now = new Date;
        return db.transaction(function() {
            return medical_record.insertHeight(this._row.id, now, now, height);
        }.bind(this));
    },

    insertGender: function(gender) {
        var now = new Date;
        var chromosomes = {
            'male': 'xy',
            'female': 'xx'
        }
        return db.transaction(function() {
            return medical_record.insertGender(this._row.id, now, now,
                                               gender, chromosomes[gender], null);
        }.bind(this));
    },
})

module.exports = new lang.Class({
    Name: 'Conversation',

    _init: function(sempre, feed, user) {
        this._sempre = sempre;
        this._feed = feed;
        this._user = user;
        this._patient = new Patient(user);
        this._onMessageListener = this._onMessage.bind(this);


        this._raw = false;
    },

    get user() {
        return this._user;
    },

    get patient() {
        return this._patient;
    },

    setDialog: function(dlg) {
        this._dialog = dlg;
        dlg.manager = this;
        dlg.start();
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
                handled = this.emit('picture', url);

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

    sendReply: function(msg) {
        return this._feed.sendText(msg);
    },

    sendPicture: function(url) {
        return this._feed.sendPicture(msg);
    },

    _onMessage: function(msg) {
        if (msg.type === 'text') {
            if (msg.hidden) // hidden messages are used by ThingTalk feed-shared keywords, ignore them
                return;
            this.handleCommand(msg.text).done();
        } else if (msg.type === 'picture') {
            var blob = this._client.blob;

            setTimeout(function() {
                blob.getDownloadLinkForHash(msg.fullSizeHash, function(error, url) {
                    if (error) {
                        console.log('failed to get download link for picture', error);
                        return;
                    }

                    this.handlePicture(url).done();
                }.bind(this));
            }.bind(this), 5000);
        }
    },

    start: function() {
        this._feed.on('incoming-message', this._onMessageListener);
        return this._feed.open().then(function() {
            this._patient.init(this._user.account);
        }).then(function() {
            this.setDialog(new Dialog.InitializationDialog());
        });
    },

    stop: function() {
        this._feed.removeListener('incoming-message', this._onMessageListener);
        return this._feed.close();
    }
})
