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

const ConversationFetcher = require('./conversation_fetcher');

module.exports = new lang.Class({
    Name: 'DoctorPortal',

    _init: function() {
        this._fetchers = {};
    },

    getConversation: function(patientId) {
        if (this._fetchers[patientId])
            return this._fetchers[patientId];

        return this._fetchers[patientId] = new ConversationFetcher(patientId);
    },

    resolveDoctor: function(name) {
        return doctor.getByName(db, name);
    },

    syncPatient: function(omletId, patientInfo, records) {
        return db.transaction(function(db) {
            return patient.getOrCreate(db, omletId, patientInfo).then(function(id) {
                return patient.syncMedicalRecords(db, id, records).then(function() {
                    return id;
                });
            });
        });
    },

    insertMedicalRecord: function(id, record) {
        return db.transaction(function(db) {
            return patient.insertMedicalRecord(db, id, record);
        });
    },

    getPatient: function(omletId) {
        return patient.getExisting(db, omletId).then(function(row) {
            return row.id;
        });
    },

    ensurePatient: function(omletId, info) {
        return db.transaction(function(db) {
            return patient.getOrCreate(db, omletId, info);
        });
    },

    addPatientToDoctor: function(patientId, doctorId) {
        return db.transaction(function(db) {
            return doctor.ensurePatient(db, doctorId, patientId);
        });
    }
})
