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

const ValueCategory = adt.data({
    YesNo: null,
    Number: null,
    RawString: null,
    Date: null,
    Gender: null,
    Unknown: null,
});

module.exports = SemanticAnalyzer = new lang.Class({
    Name: 'SemanticAnalyzer',

    _init: function(lambda) {
        this.root = lambda;

        this.isSpecial = false;
        this.isYes = false;
        this.isNo = false;
        this.isValue = false;
        this.isInsert = false;
    },

    run: function() {
        if (this.root.isAtom && this.root.name.startsWith('tt:root.special.')) {
            if (this.root.name === 'tt:root.special.yes')
                this.isYes = true;
            else if (this.root.name === 'tt:root.special.no')
                this.isNo = true;
            else
                this.isSpecial = true;
        } else if (this.root.isApply && this.root.left.isAtom &&
                   this.root.left.name === 'tt:root.token.value') {
            this.isValue = true;
            this.value = this.root.right;
            this.category = ValueCategory.Unknown;
            if (this.value.isNumber) {
                this.category = ValueCategory.Number;
            } else if (this.value.isString) {
                this.category = ValueCategory.RawString;
            } else if (this.value.isDate) {
                this.category = ValueCategory.Date;
            } else if (this.value.isAtom) {
                if (this.value.name.startsWith('tt:gender.')) {
                    this.category = ValueCategory.Gender;
                    this.value = this.value.name.substring('tt:gender.'.length,
                                                           this.value.name.length);
                }
            }
        } else if (this.root.isApply && this.root.left.isAtom &&
                   this.root.left.name === 'tt:root.command.insert') {
            this.isInsert = true;
            if (this.root.right.isAtom && this.root.right.name.startsWith('tt:inserttype.')) {
                this.type = this.root.right.name.substring('tt:inserttype.'.length,
                                                           this.root.right.name.length);
            } else {
                throw new Error('Invalid argument to tt:root.command.insert');
            }
        } else if (this.root.isLambda) {
            throw new Error('FIXME: unhandled top-level lambda');
        } else {
            throw new TypeError('Invalid top-level ' + this.root);
        }
    }
});
module.exports.ValueCategory = ValueCategory;
