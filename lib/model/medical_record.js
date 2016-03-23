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
    insertGender: function(patient, captureTime, collectTime, gender, chromosomes, other) {
        return db('medical_record').insert({
            patient_id: patient,
            capture_time: captureTime,
            collect_time: collectTime,
            record_type: 'gender',
        }).then(function(ids) {
            return db('gender_record').insert({
                id: ids[0],
                gender: gender,
                chromosomes: chromosomes,
                other_gender: other
            });
        });
    },

    getLastGender: function(patient) {
        return db('last_gender_record').select().where({ patient_id: patient }).orderBy('collect_time', 'desc').first();
    },

    insertWeight: function(patient, captureTime, collectTime, weight) {
        return db('medical_record').insert({
            patient_id: patient,
            capture_time: captureTime,
            collect_time: collectTime,
            record_type: 'weight',
        }).then(function(ids) {
            return db('weight_record').insert({
                id: ids[0],
                weight_kgs: weight
            });
        });
    },

    getLastWeight: function(patient) {
        return db('last_weight_record').select().where({ patient_id: patient }).orderBy('collect_time', 'desc').first();
    },

    insertHeight: function(patient, captureTime, collectTime, height) {
        return db('medical_record').insert({
            patient_id: patient,
            capture_time: captureTime,
            collect_time: collectTime,
            record_type: 'height',
        }).then(function(ids) {
            return db('height_record').insert({
                id: ids[0],
                height_cms: height
            });
        });
    },

    getLastHeight: function(patient) {
        return db('last_height_record').select().where({ patient_id: patient }).orderBy('collect_time', 'desc').first();
    },

    insertOther: function(patient, captureTime, collectTime, pictureUrl) {
        return db('medical_record').insert({
            patient_id: patient,
            capture_time: captureTime,
            collect_time: collectTime,
            record_type: 'other',
            picture_url: pictureUrl
        })
    }
}
