// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Stanford MPortal
//
// Copyright 2016 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

module.exports = {
    getByAccount: function(db, account) {
        return db('patient').select().where({ omlet_account: account });
    },

    get: function(db, id) {
        return db('patient').select().where({ id: id }).first();
    },

    getInfo: function(db, id) {
        return db('patient_info').select().where({ id: id }).first();
    },

    insert: function(db, data) {
        return db('patient').insert({
            omlet_account: data.omlet_account,
            full_name: data.full_name,
            nick_name: data.nick_name,
        }).then(function(ids) { return ids[0]; });
    },

    changeDOB: function(db, id, dob) {
        return db('patient').update({
            date_of_birth: dob
        }).where({ id: id });
    },

    changeNickName: function(db, id, nickName) {
        return db('patient').update({
            nick_name: nickName
        }).where({ id: id });
    },

    changeSync: function(db, id, sync) {
        return db('patient').update({
            sync_enabled: sync,
        }).where({ id: id });
    }
}
