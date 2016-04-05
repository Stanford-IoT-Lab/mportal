// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Stanford MPortal
//
// Copyright 2016 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

module.exports = {
    getWeightRecords: function(db, patientId, sinceTime) {
        return db('medical_record').select('*').innerJoin('weight_record', 'weight_record.id', 'medical_record.id')
            .where('medical_record.capture_time', '>=', sinceTime).andWhere({ 'medical_record.record_type': 'weight', patient_id: patientId })
            .orderBy('medical_record.capture_time', 'asc');
    },

    getHeightRecords: function(db, patientId, sinceTime) {
        return db('medical_record').select('*').innerJoin('height_record', 'height_record.id', 'medical_record.id')
            .where('medical_record.capture_time', '>=', sinceTime).andWhere({ 'medical_record.record_type': 'height', patient_id: patientId })
            .orderBy('medical_record.capture_time', 'asc');
    },

    getOtherRecords: function(db, patientId, sinceTime) {
        var sql = db('medical_record').select('*').where('capture_time', '>=', sinceTime).andWhere({ patient_id: patientId })
            .andWhere('record_type', 'not in', ['weight', 'height', 'gender'])
            .orderBy('capture_time', 'asc');
        console.log(sql.toString());
        return sql;
    },

    insertGender: function(db, patient, captureTime, collectTime, gender, chromosomes, other) {
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

    getLastGender: function(db, patient) {
        return db('last_gender_record').select().where({ patient_id: patient }).orderBy('capture_time', 'desc').first();
    },

    insertWeight: function(db, patient, captureTime, collectTime, weight) {
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

    getLastWeight: function(db, patient) {
        return db('last_weight_record').select().where({ patient_id: patient }).orderBy('capture_time', 'desc').first();
    },

    insertHeight: function(db, patient, captureTime, collectTime, height) {
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

    getLastHeight: function(db, patient) {
        return db('last_height_record').select().where({ patient_id: patient }).orderBy('capture_time', 'desc').first();
    },

    insertOther: function(db, patient, captureTime, collectTime, pictureUrl) {
        return db('medical_record').insert({
            patient_id: patient,
            capture_time: captureTime,
            collect_time: collectTime,
            record_type: 'other',
            picture_url: pictureUrl
        })
    }
}
