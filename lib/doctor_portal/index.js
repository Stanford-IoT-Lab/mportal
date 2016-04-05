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

module.exports = new lang.Class({
    Name: 'DoctorPortal',

    _init: function() {
    },

    resolveDoctor: function(name) {
        return doctor.getByName(name);
    },

    syncPatient: function(omletId, patientInfo, records) {
        return db.transaction(function() {
            return patient.getOrCreate(omletId, patientInfo).then(function(id) {
                return patient.syncMedicalRecords(id, records).then(function() {
                    return id;
                });
            });
        });
    },

    addPatientToDoctor: function(patientId, doctorId) {
        return doctor.ensurePatient(doctorId, patientId);
    }
})
