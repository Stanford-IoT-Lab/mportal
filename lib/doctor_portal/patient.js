// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Stanford MPortal
//
// Copyright 2016 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

function flatten(aoa) {
    var out = [];
    aoa.forEach(function(a) {
        a.forEach(function(x) {
            out.push(x);
        });
    });
    return out;
}


module.exports = {
    getOrCreate: function(db, omletId, patientInfo) {
        return db('mhealth_patient').select('id').where({ username: omletId }).then(function(rows) {
            if (rows.length > 0) {
                return db('mhealth_patient').update({ gender: patientInfo.gender,
                                                      dob: patientInfo.date_of_birth,
                                                      full_name: patientInfo.full_name })
                    .where({ id: rows[0].id }).then(function() {
                        return rows[0].id;
                    });
            } else {
                return db('mhealth_patient').insert({ username: omletId,
                                                      gender: patientInfo.gender,
                                                      dob: patientInfo.date_of_birth,
                                                      full_name: patientInfo.full_name })
                    .then(function(ids) {
                        return ids[0];
                    });
            }
        });
    },

    getExisting: function(db, omletId) {
        return db('mhealth_patient').select('id').where({ username: omletId }).first();
    },

    _mapRecord: function(patientId, record) {
        if (record.record_type === 'height')
            return [{ patient_id: patientId, type: record.record_type,
                      height: record.height_cms,
                      timestamp: record.collect_time }];
        else if (record.record_type === 'weight')
            return [{ patient_id: patientId, type: record.record_type,
                      weight: record.weight_kgs,
                      timestamp: record.collect_time }];
        else if (record.record_type === 'diagnosis')
            return [{ patient_id: patientId, type: record.record_type,
                      diagnosis: record.cancer_type + ' cancer',
                      timestamp: record.collect_time },
                    { patient_id: patientId, type: 'stage',
                      stage: record.stage,
                      timestamp: record.collect_time },
                    { patient_id: patientId, type: 'substage',
                      substage: record.substage,
                      timestamp: record.collect_time }];
        else if (record.record_type === 'body_temperature')
            return [{ patient_id: patientId, type: 'temperature',
                      temperature: record.temp_C,
                      timestamp: record.collect_time }];
        else if (record.record_type === 'heart_rate')
            return [{ patient_id: patientId, type: record.record_type,
                      heart_rate: record.heart_rate_bpm,
                      timestamp: record.collect_time }];
        else if (record.record_type === 'blood_pressure')
            return [{ patient_id: patientId, type: record.record_type,
                      blood_pressure: record.blood_pressure_mmHg,
                      timestamp: record.collect_time }];
        else if (record.record_type === 'labresults')
            return [{ patient_id: patientId, type: 'wbc',
                      wbc: record.white_blood_cell_count,
                      timestamp: record.collect_time },
                    { patient_id: patientId, type: 'hematocrit',
                      hematocrit: record.hematocrit_percent,
                      timestamp: record.collect_time },
                    { patient_id: patientId, type: 'hemoglobin',
                      hemoglobin: record.hemoglobin,
                      timestamp: record.collect_time },
                    { patient_id: patientId, type: 'platelet',
                      platelet: record.platelet_count,
                      timestamp: record.collect_time }];
        else if (record.record_type !== 'gender') // ignore gender records
            return [{ patient_id: patientId, type: record.record_type, picture: record.picture_url, timestamp: record.collect_time }];
        else
            return [];
    },

    syncMedicalRecords: function(db, patientId, records) {
        return db('mhealth_medicalrecord').where({ patient_id: patientId }).del().then(function() {
            return db('mhealth_medicalrecord').insert(flatten(records.map(function(record) {
                return this._mapRecord(patientId, record);
            }, this)));
        }.bind(this));
    },

    insertMedicalRecord: function(db, patientId, record) {
        return db('mhealth_medicalrecord').insert(this._mapRecord(patientId, record));
    }
}
