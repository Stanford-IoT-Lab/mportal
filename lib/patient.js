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

module.exports = new lang.Class({
    Name: 'Patient',
    Extends: events.EventEmitter,

    _init: function(user, doctorPortal) {
        events.EventEmitter.call(this);

        this._user = user;
        this._doctorPortal = doctorPortal;
        this._fetcher = null;
        this._row = null;
    },

    init: function(account) {
        return model.getByAccount(db, this._user.account).then(function(patients) {
            if (patients.length > 0)
                this._row = patients[0];
            else
                this._row = null;

            return this._maybeStartConvFetcher();
        }.bind(this));
    },

    _maybeStartConvFetcher: function() {
        if (this._row === null)
            return;
        if (!this._row.sync_enabled)
            return;
        if (this._fetcher !== null)
            return;

        return this._doctorPortal.getPatient(this._user.account).then(function(patientId) {
            this._fetcher = this._doctorPortal.getConversation(patientId);
            this._fetcher.on('message', function(data) {
                this.emit('message', data);
            }.bind(this));
            return this._fetcher.start();
        }.bind(this));
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
        return model.getInfo(db, this._row.id);
    },

    _enableSync: function(db) {
        return model.changeSync(db, this._row.id, true).then(function() {
            this._row.sync_enabled = true;
        }.bind(this));
    },

    ensureSync: function() {
        return db.transaction(function(db) {
            if (this.sync_enabled) {
                return this._doctorPortal.getPatient(this._user.account);
            }

            return this._exportRecords(db).then(function(records) {
                return model.getInfo(db, this._row.id).then(function(patientInfo) {
                    return this._doctorPortal.syncPatient(this._user.account, patientInfo, records);
                }.bind(this)).tap(function() {
                    return this._enableSync(db);
                }.bind(this));
            }.bind(this));
        }.bind(this)).tap(function() {
            return this._maybeStartConvFetcher();
        });
    },

    _exportRecords: function(db) {
        var sinceTime = new Date;
        sinceTime.setTime(sinceTime.getTime() - 2 * 3600 * 24 * 7 * 1000); // 2 weeks
        var patientId = this._row.id;
        return Q.all([medical_record.getWeightRecords(db, patientId, sinceTime).then(function(records) {
            return records.map(function(r) { return ({ type: r.record_type, weight: r.weight_kgs, collect_time: r.collect_time }); });
        }), medical_record.getHeightRecords(db, patientId, sinceTime).then(function(records) {
            return records.map(function(r) { return ({ type: r.record_type, height: r.height_cms, collect_time: r.collect_time }); });
        }), medical_record.getOtherRecords(db, patientId, sinceTime).then(function(records) {
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
        return db.transaction(function() {
            return model.insert(db, data);
        }).then(function(id) {
            data.id = id;
            this._row = data;

            return this._maybeStartConvFetcher();
        }.bind(this));
    },

    changeDOB: function(dob) {
        return db.transaction(function(db) {
            return model.changeDOB(db, this._row.id, dob);
        }.bind(this)).then(function() {
            this._row.date_of_birth = dob;
        }.bind(this));
    },

    insertWeight: function(weight, time) {
        var now = new Date;
        if (time === undefined)
            time = now;
        return db.transaction(function(db) {
            return medical_record.insertWeight(db, this._row.id, now, time, weight).then(function() {
                if (this.sync_enabled) {
                    return this._doctorPortal.getPatient(this._user.account).then(function(syncId) {
                        return this._doctorPortal.insertMedicalRecord(syncId, { type: 'weight', weight: weight, collect_time: time });
                    }.bind(this));
                }
            }.bind(this));
        }.bind(this));
    },

    getLastWeight: function() {
        return medical_record.getLastWeight(db, this._row.id);
    },

    insertHeight: function(height, time) {
        var now = new Date;
        if (time === undefined)
            time = now;
        return db.transaction(function(db) {
            return medical_record.insertHeight(db, this._row.id, now, time, height).then(function() {
                if (this.sync_enabled) {
                    return this._doctorPortal.getPatient(this._user.account).then(function(syncId) {
                        return this._doctorPortal.insertMedicalRecord(syncId, { type: 'height', height: height, collect_time: time });
                    }.bind(this));
                }
            }.bind(this));
        }.bind(this));
    },

    getLastHeight: function() {
        return medical_record.getLastHeight(db, this._row.id);
    },

    insertGender: function(gender, time) {
        var now = new Date;
        var chromosomes = {
            'male': 'xy',
            'female': 'xx'
        }
        if (time === undefined)
            time = now;
        return db.transaction(function(db) {
            return medical_record.insertGender(db, this._row.id, now, time,
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
        return medical_record.getLastGender(db, this._row.id);
    },

    insertDiagnosis: function(cancer_type, stage, substage, time) {
        var now = new Date;
        if (time === undefined)
            time = now;
        return db.transaction(function(db) {
            return medical_record.insertDiagnosis(db, this._row.id, now, time,
                                                  cancer_type, stage, substage).then(function() {
                if (this.sync_enabled) {
                    return this._doctorPortal.getPatient(this._user.account).then(function(syncId) {
                        return this._doctorPortal.insertMedicalRecord(syncId, { type: 'diagnosis',
                                                                                cancer_type: cancer_type,
                                                                                stage: stage,
                                                                                substage: substage,
                                                                                collect_time: time });
                    }.bind(this));
                }
            });
        }.bind(this));
    },

    getLastDiagnosis: function() {
        return medical_record.getLastDiagnosis(db, this._row.id);
    },

    insertBodyTemperature: function(body_temperature, time) {
        var now = new Date;
        if (time === undefined)
            time = now;
        return db.transaction(function(db) {
            return medical_record.insertBodyTemperature(db, this._row.id, now, time,
                                                        body_temperature).then(function() {
                if (this.sync_enabled) {
                    return this._doctorPortal.getPatient(this._user.account).then(function(syncId) {
                        return this._doctorPortal.insertMedicalRecord(syncId, { type: 'body_temperature',
                                                                                temp: body_temperature,
                                                                                collect_time: time });
                    }.bind(this));
                }
            });
        }.bind(this));
    },

    getLastBodyTemperature: function() {
        return medical_record.getLastBodyTemperature(db, this._row.id);
    },

    insertHeartRate: function(heart_rate_bpm, time) {
        var now = new Date;
        if (time === undefined)
            time = now;
        return db.transaction(function(db) {
            return medical_record.insertHeartRate(db, this._row.id, now, time,
                                                  heart_rate_bpm).then(function() {
                if (this.sync_enabled) {
                    return this._doctorPortal.getPatient(this._user.account).then(function(syncId) {
                        return this._doctorPortal.insertMedicalRecord(syncId, { type: 'heart_rate',
                                                                                heart_rate: heart_rate_bpm,
                                                                                collect_time: time });
                    }.bind(this));
                }
            });
        }.bind(this));
    },

    getLastHeartRate: function() {
        return medical_record.getLastHeartRate(db, this._row.id);
    },

    insertBloodPressure: function(blood_pressure_mmHg, time) {
        var now = new Date;
        if (time === undefined)
            time = now;
        return db.transaction(function(db) {
            return medical_record.insertBloodPressure(db, this._row.id, now, time,
                                                      blood_pressure_mmHg).then(function() {
                if (this.sync_enabled) {
                    return this._doctorPortal.getPatient(this._user.account).then(function(syncId) {
                        return this._doctorPortal.insertMedicalRecord(syncId, { type: 'blood_pressure',
                                                                                blood_pressure: blood_pressure_mmHg,
                                                                                collect_time: time });
                    }.bind(this));
                }
            });
        }.bind(this));
    },

    getLastBloodPressure: function() {
        return medical_record.getLastBloodPressure(db, this._row.id);
    },

    insertLabResults: function(white_blood_cell_count, hematocrit_percent, hemoglobin, platelet_count, time) {
        var now = new Date;
        if (time === undefined)
            time = now;
        return db.transaction(function(db) {
            return medical_record.insertLabResults(db, this._row.id, now, time,
                                                   white_blood_cell_count, hematocrit_percent,
                                                   hemoglobin, platelet_count).then(function() {
                if (this.sync_enabled) {
                    return this._doctorPortal.getPatient(this._user.account).then(function(syncId) {
                        return this._doctorPortal.insertMedicalRecord(syncId, { type: 'labresults',
                                                                                white_blood_cell_count: white_blood_cell_count,
                                                                                hematocrit_percent: hematocrit_percent,
                                                                                hemoglobin: hemoglobin,
                                                                                platelet_count: platelet_count,
                                                                                collect_time: time });
                    }.bind(this));
                }
            });
        }.bind(this));
    },

    getLastLabResults: function() {
        return medical_record.getLastLabResults(db, this._row.id);
    },

    insertOther: function(obj, time) {
        var now = new Date;
        if (time === undefined)
            time = now;
        return db.transaction(function(db) {
            return medical_record.insertOther(db, this._row.id, now, time, obj.serialize()).then(function() {
                if (this.sync_enabled) {
                    return this._doctorPortal.getPatient(this._user.account).then(function(syncId) {
                        return obj.getSharedLink().then(function(url) {
                            return this._doctorPortal.insertMedicalRecord(syncId, { type: 'other', picture_url: url, collect_time: time });
                        }.bind(this));
                    }.bind(this));
                }
            }.bind(this));
        }.bind(this));
    },
})
