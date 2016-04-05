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

const PictureObject = require('./model/pictureobj');

const DoctorPortal = require('./doctor_portal');

function flatten(aoa) {
    var out = [];
    aoa.forEach(function(a) {
        a.forEach(function(x) {
            out.push(x);
        });
    });
    return out;
}

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
        }.bind(this));
    },

    withTransaction: function(transaction) {
        return db.transaction(transaction);
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
        return model.getInfo(this._row.id);
    },

    exportRecords: function() {
        var sinceTime = new Date;
        sinceTime.setTime(sinceTime.getTime() - 2 * 3600 * 24 * 7 * 1000); // 2 weeks
        var patientId = this._row.id;
        return Q.all([medical_record.getWeightRecords(patientId, sinceTime).then(function(records) {
            return records.map(function(r) { return ({ type: r.record_type, weight: r.weight_kgs, collect_time: r.collect_time }); });
        }), medical_record.getHeightRecords(patientId, sinceTime).then(function(records) {
            return records.map(function(r) { return ({ type: r.record_type, height: r.height_cms, collect_time: r.collect_time }); });
        }), medical_record.getOtherRecords(patientId, sinceTime).then(function(records) {
            return Q.all(records.map(function(r) {
                var pictObj = PictureObject.fromSerialized(r.picture_url);
                return pictObj.getSharedLink().then(function(url) {
                    console.log('Got shared link ' + url + ' for ' + pictObj.serialize());
                    return ({ type: r.record_type, picture_url: url, collect_time: r.collect_time });
                });
            }));
        })]).then(function(arrayOfArrays) {
            return flatten(arrayOfArrays);
        });
    },

    store: function(data) {
        data.omlet_account = this._user.account;
        if (!data.date_of_birth)
            data.date_of_birth = null;
        return this.withTransaction(function() {
            return model.insert(data);
        }).then(function(id) {
            data.id = id;
            this._row = data;
        }.bind(this));
    },

    changeDOB: function(dob) {
        return this.withTransaction(function() {
            return model.changeDOB(this._row.id, dob);
        }.bind(this)).then(function() {
            this._row.date_of_birth = dob;
        }.bind(this));
    },

    insertWeight: function(weight, time) {
        var now = new Date;
        if (time === undefined)
            time = now;
        return this.withTransaction(function() {
            return medical_record.insertWeight(this._row.id, now, time, weight);
        }.bind(this));
    },

    getLastWeight: function() {
        return medical_record.getLastWeight(this._row.id);
    },

    insertHeight: function(height, time) {
        var now = new Date;
        if (time === undefined)
            time = now;
        return this.withTransaction(function() {
            return medical_record.insertHeight(this._row.id, now, time, height);
        }.bind(this));
    },

    getLastHeight: function() {
        return medical_record.getLastHeight(this._row.id);
    },

    insertGender: function(gender, time) {
        var now = new Date;
        var chromosomes = {
            'male': 'xy',
            'female': 'xx'
        }
        if (time === undefined)
            time = now;
        return this.withTransaction(function() {
            return medical_record.insertGender(this._row.id, now, time,
                                               gender, chromosomes[gender], null);
        }.bind(this));
    },

    getLastGender: function() {
        return medical_record.getLastGender(this._row.id);
    },

    insertOther: function(obj, time) {
        var now = new Date;
        return this.withTransaction(function() {
            return medical_record.insertOther(this._row.id, now, time, obj.serialize());
        }.bind(this));
    },
})

module.exports = new lang.Class({
    Name: 'Conversation',

    _init: function(client, sempre, feed, user) {
        this._client = client;
        this._sempre = sempre;
        this._doctorPortal = new DoctorPortal();
        this._feed = feed;
        this._user = user;
        this._patient = new Patient(user);
        this._onMessageListener = this._onMessage.bind(this);

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
        return this._feed.open().then(function() {
            return this._patient.init(this._user.account);
        }.bind(this)).then(function() {
            this.setDialog(new Dialog.InitializationDialog());
        }.bind(this));
    },

    stop: function() {
        this._feed.removeListener('incoming-message', this._onMessageListener);
        return this._feed.close();
    }
})
