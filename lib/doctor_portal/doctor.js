// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Stanford MPortal
//
// Copyright 2016 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const db = require('./db');

module.exports = {
    getByName: function(name) {
        return db('mhealth_doctor').select(['id', 'full_name', 'affiliation']).where({ full_name: name });
    },

    ensurePatient: function(doctor, patient) {
        return db.raw('replace into mhealth_patient_doctors(patient_id, doctor_id) values(?,?)', [patient, doctor]);
    }
}
