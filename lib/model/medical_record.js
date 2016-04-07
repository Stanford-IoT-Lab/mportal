// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Stanford MPortal
//
// Copyright 2016 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

module.exports = {
    getWeightRecords: function(db, patientId) {
        return db('medical_record').select('*').innerJoin('weight_record', 'weight_record.id', 'medical_record.id')
            .where({ 'medical_record.record_type': 'weight', patient_id: patientId })
            .orderBy('medical_record.capture_time', 'asc');
    },

    getHeightRecords: function(db, patientId) {
        return db('medical_record').select('*').innerJoin('height_record', 'height_record.id', 'medical_record.id')
            .where({ 'medical_record.record_type': 'height', patient_id: patientId })
            .orderBy('medical_record.capture_time', 'asc');
    },

    getDiagnosisRecords: function(db, patientId) {
        return db('medical_record').select('*').innerJoin('diagnosis_record', 'diagnosis_record.id', 'medical_record.id')
            .where({ 'medical_record.record_type': 'diagnosis', patient_id: patientId })
            .orderBy('medical_record.capture_time', 'asc');
    },

    getBodyTemperatureRecords: function(db, patientId) {
        return db('medical_record').select('*').innerJoin('body_temperature_record', 'body_temperature_record.id', 'medical_record.id')
            .where({ 'medical_record.record_type': 'body_temperature', patient_id: patientId })
            .orderBy('medical_record.capture_time', 'asc');
    },

    getHeartRateRecords: function(db, patientId) {
        return db('medical_record').select('*').innerJoin('heart_rate_record', 'heart_rate_record.id', 'medical_record.id')
            .where({ 'medical_record.record_type': 'heart_rate', patient_id: patientId })
            .orderBy('medical_record.capture_time', 'asc');
    },

    getBloodPressureRecords: function(db, patientId) {
        return db('medical_record').select('*').innerJoin('blood_pressure_record', 'blood_pressure_record.id', 'medical_record.id')
            .where({ 'medical_record.record_type': 'blood_pressure', patient_id: patientId })
            .orderBy('medical_record.capture_time', 'asc');
    },

    getLabResultsRecords: function(db, patientId) {
        return db('medical_record').select('*').innerJoin('labresults_record', 'labresults_record.id', 'medical_record.id')
            .where({ 'medical_record.record_type': 'labresults', patient_id: patientId })
            .orderBy('medical_record.capture_time', 'asc');
    },

    getOldWeight: function(db, patientId, when) {
        return db('medical_record').select('*').innerJoin('weight_record', 'weight_record.id', 'medical_record.id')
            .where({ 'medical_record.record_type': 'weight', patient_id: patientId })
            .andWhere('medical_record.capture_time', '<=', when)
            .orderBy('medical_record.capture_time', 'desc').limit(1).first();
    },

    getOldHeight: function(db, patientId, when) {
        return db('medical_record').select('*').innerJoin('height_record', 'height_record.id', 'medical_record.id')
            .where({ 'medical_record.record_type': 'height', patient_id: patientId })
            .andWhere('medical_record.capture_time', '<=', when)
            .orderBy('medical_record.capture_time', 'desc').limit(1).first();
    },

    getOldDiagnosis: function(db, patientId, when) {
        return db('medical_record').select('*').innerJoin('diagnosis_record', 'diagnosis_record.id', 'medical_record.id')
            .where({ 'medical_record.record_type': 'diagnosis', patient_id: patientId })
            .andWhere('medical_record.capture_time', '<=', when)
            .orderBy('medical_record.capture_time', 'desc').limit(1).first();
    },

    getOldBodyTemperature: function(db, patientId, when) {
        return db('medical_record').select('*').innerJoin('body_temperature_record', 'body_temperature_record.id', 'medical_record.id')
            .where({ 'medical_record.record_type': 'body_temperature', patient_id: patientId })
            .andWhere('medical_record.capture_time', '<=', when)
            .orderBy('medical_record.capture_time', 'desc').limit(1).first();
    },

    getOldHeartRate: function(db, patientId, when) {
        return db('medical_record').select('*').innerJoin('heart_rate_record', 'heart_rate_record.id', 'medical_record.id')
            .where({ 'medical_record.record_type': 'heart_rate', patient_id: patientId })
            .orderBy('medical_record.capture_time', 'desc').limit(1).first();
    },

    getOldBloodPressure: function(db, patientId, when) {
        return db('medical_record').select('*').innerJoin('blood_pressure_record', 'blood_pressure_record.id', 'medical_record.id')
            .where({ 'medical_record.record_type': 'blood_pressure', patient_id: patientId })
            .andWhere('medical_record.capture_time', '<=', when)
            .orderBy('medical_record.capture_time', 'desc').limit(1).first();
    },

    getOldLabResults: function(db, patientId, when) {
        return db('medical_record').select('*').innerJoin('labresults_record', 'labresults_record.id', 'medical_record.id')
            .where({ 'medical_record.record_type': 'labresults', patient_id: patientId })
            .andWhere('medical_record.capture_time', '<=', when)
            .orderBy('medical_record.capture_time', 'desc').limit(1).first();
    },

    getOtherRecords: function(db, patientId) {
        var sql = db('medical_record').select('*').where({ patient_id: patientId })
            .andWhere('record_type', 'not in', ['weight', 'height', 'gender', 'diagnosis',
                                                'body_temperature', 'heart_rate', 'blood_pressure', 'labresults'])
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
        return db('last_gender_record').select().where({ patient_id: patient }).orderBy('collect_time', 'desc').first();
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
        return db('last_weight_record').select().where({ patient_id: patient }).orderBy('collect_time', 'desc').first();
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
        return db('last_height_record').select().where({ patient_id: patient }).orderBy('collect_time', 'desc').first();
    },

    insertOther: function(db, patient, type, captureTime, collectTime, description, pictureUrl) {
        return db('medical_record').insert({
            patient_id: patient,
            capture_time: captureTime,
            collect_time: collectTime,
            record_type: type,
            description: description,
            picture_url: pictureUrl
        })
    },

    getLastDiagnosis: function(db, patient) {
        return db('last_diagnosis_record').select().where({ patient_id: patient }).orderBy('collect_time', 'desc').first();
    },

    insertDiagnosis: function(db, patient, captureTime, collectTime, cancer_type, stage, substage) {
        return db('medical_record').insert({
            patient_id: patient,
            capture_time: captureTime,
            collect_time: collectTime,
            record_type: 'diagnosis',
        }).then(function(ids) {
            return db('diagnosis_record').insert({
                id: ids[0],
                cancer_type: cancer_type,
                stage: stage,
                substage: substage,
            });
        });
    },

    getLastBodyTemperature: function(db, patient) {
        return db('last_body_temperature_record').select().where({ patient_id: patient }).orderBy('collect_time', 'desc').first();
    },

    insertBodyTemperature: function(db, patient, captureTime, collectTime, temp) {
        return db('medical_record').insert({
            patient_id: patient,
            capture_time: captureTime,
            collect_time: collectTime,
            record_type: 'body_temperature',
        }).then(function(ids) {
            return db('body_temperature_record').insert({
                id: ids[0],
                temp_C: temp,
            });
        });
    },

    getLastHeartRate: function(db, patient) {
        return db('last_heart_rate_record').select().where({ patient_id: patient }).orderBy('collect_time', 'desc').first();
    },

    insertHeartRate: function(db, patient, captureTime, collectTime, heart_rate) {
        return db('medical_record').insert({
            patient_id: patient,
            capture_time: captureTime,
            collect_time: collectTime,
            record_type: 'heart_rate',
        }).then(function(ids) {
            return db('heart_rate_record').insert({
                id: ids[0],
                heart_rate_bpm: heart_rate,
            });
        });
    },

    getLastBloodPressure: function(db, patient) {
        return db('last_blood_pressure_record').select().where({ patient_id: patient }).orderBy('collect_time', 'desc').first();
    },

    insertBloodPressure: function(db, patient, captureTime, collectTime, blood_pressure) {
        return db('medical_record').insert({
            patient_id: patient,
            capture_time: captureTime,
            collect_time: collectTime,
            record_type: 'blood_pressure',
        }).then(function(ids) {
            return db('blood_pressure_record').insert({
                id: ids[0],
                blood_pressure_mmHg: blood_pressure,
            });
        });
    },

    getLastLabResults: function(db, patient) {
        return db('last_labresults_record').select().where({ patient_id: patient }).orderBy('collect_time', 'desc').first();
    },

    insertLabResults: function(db, patient, captureTime, collectTime, white_blood_cell_count, hematocrit_percent, hemoglobin, platelet_count) {
        return db('medical_record').insert({
            patient_id: patient,
            capture_time: captureTime,
            collect_time: collectTime,
            record_type: 'labresults',
        }).then(function(ids) {
            return db('labresults_record').insert({
                id: ids[0],
                white_blood_cell_count: white_blood_cell_count,
                hematocrit_percent: hematocrit_percent,
                hemoglobin: hemoglobin,
                platelet_count: platelet_count
            });
        });
    },
}
