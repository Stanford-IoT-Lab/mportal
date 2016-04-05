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

const db = require('./model/db');
const model = require('./model/patient');
const medical_record = require('./model/medical_record');

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

model.exports = new lang.Class({
    Name: 'Patient',

    _init: function(user, doctorPortal) {
        this._user = user;
        this._doctorPortal = doctorPortal;
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

    get sync_enabled() {
        return this._row.sync_enabled;
    },

    getInfo: function() {
        return model.getInfo(this._row.id);
    },

    _enableSync: function() {
        return model.changeSync(this._row.id, true).then(function() {
            this._row.sync_enabled = true;
        }.bind(this));
    },

    ensureSync: function() {
        if (this.sync_enabled)
            return this._doctorPortal.getPatient(this._user.account);

        return this.exportRecords().then(function(records) {
            return this.getInfo().tap(function(patientInfo) {
                return this._doctorPortal.syncPatient(this._user.account, patientInfo, records);
            }.bind(this)).tap(function() {
                return this._enableSync();
            }.bind(this));
        }.bind(this));
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
            return medical_record.insertWeight(this._row.id, now, time, weight).then(function() {
                if (this.sync_enabled) {
                    return this._doctorPortal.getPatient(this._user.account).then(function(syncId) {
                        return this._doctorPortal.insertMedicalRecord({ type: 'weight', weight: weight, collect_time: time });
                    }.bind(this));
                }
            }.bind(this));
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
            return medical_record.insertHeight(this._row.id, now, time, height).then(function() {
                if (this.sync_enabled) {
                    return this._doctorPortal.getPatient(this._user.account).then(function(syncId) {
                        return this._doctorPortal.insertMedicalRecord({ type: 'height', height: height, collect_time: time });
                    }.bind(this));
                }
            }.bind(this));
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
                                               gender, chromosomes[gender], null).then(function() {
                if (this.sync_enabled) {
                    return this.getInfo().then(function(info) {
                        return this._doctorPortal.ensurePatient(this._user.account, info);
                    }.bind(this));
                }
            });
        }.bind(this));
    },

    getLastGender: function() {
        return medical_record.getLastGender(this._row.id);
    },

    insertOther: function(obj, time) {
        var now = new Date;
        if (time === undefined)
            time = now;
        return this.withTransaction(function() {
            return medical_record.insertOther(this._row.id, now, time, obj.serialize()).then(function() {
                if (this.sync_enabled) {
                    return this._doctorPortal.getPatient(this._user.account).then(function(syncId) {
                        return obj.getSharedLink().then(function(url) {
                            return this._doctorPortal.insertMedicalRecord({ type: 'other', picture_url: height, collect_time: time });
                        }.bind(this));
                    }.bind(this));
                }
            }.bind(this));
        }.bind(this));
    },
})
