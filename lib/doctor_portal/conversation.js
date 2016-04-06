// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Stanford MPortal
//
// Copyright 2016 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

module.exports = {
    getByPatient: function(db, patientId, after) {
        var sql = db('mhealth_conversation').select('*').leftJoin('mhealth_doctor', 'doctor_id', 'mhealth_doctor.id')
            .where({ patient_id: patientId, 'private': false }).orderBy('timestamp', 'asc');
        if (after !== null)
            return sql.andWhere('timestamp', '>', after);
        else
            return sql;
    }
}
