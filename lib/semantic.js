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
const adt = require('adt');

const LambdaForm = require('./lambda');

const ValueCategory = adt.data({
    YesNo: null,
    Number: null,
    Measure: { unit: adt.only(String) },
    RawString: null,
    Date: null,
    Gender: null,
    Unknown: null,
    Picture: null,
});

function valueToCategoryAndValue(value) {
    if (value.isList) {
        var mapped = value.value.map(valueToCategoryAndValue);
        return [mapped.map(function(x) { return x[0]; }), mapped.map(function(x) { return x[1]; })];
    } else if (value.isMeasure) {
        return [ValueCategory.Measure(value.unit), value.value];
    } else if (value.isNumber) {
        return [ValueCategory.Number, value.value];
    } else if (value.isString) {
        return [ValueCategory.RawString, value.value];
    } else if (value.isDate) {
        return [ValueCategory.Date, value.value];
    } else if (value.isAtom) {
        if (value.name.startsWith('tt:gender.')) {
            return [ValueCategory.Gender, value.name.substring('tt:gender.'.length,
                                                               value.name.length)];
        }
    }

    return [ValueCategory.Unknown, null];
}

module.exports = new lang.Class({
    Name: 'SemanticAnalyzer',

    _init: function(lambda) {
        this.root = lambda;

        this.isSpecial = false;
        this.isYes = false;
        this.isNo = false;
        this.isValue = false;
        this.isInsert = false;
        this.isAsk = false;
        this.isAskWhen = false;
        this.isShare = false;
    },

    _handleValue: function(value) {
        var mapped = valueToCategoryAndValue(value);
        this.category = mapped[0];
        this.value = mapped[1];
    },

    run: function() {
        if (this.root.isAtom && this.root.name.startsWith('tt:root.special.')) {
            if (this.root.name === 'tt:root.special.yes')
                this.isYes = true;
            else if (this.root.name === 'tt:root.special.no')
                this.isNo = true;
            else
                this.isSpecial = true;
        } else if (this.root.isAtom && this.root.name === 'tt:root.command.share') {
            this.isShare = true;
            this.withDoctor = null;
        } else if (this.root.isApply && this.root.left.isAtom &&
                   this.root.left.name === 'tt:root.token.value') {
            this.isValue = true;
            this._handleValue(this.root.right);
        } else if (this.root.isApply && this.root.left.isAtom &&
                   this.root.left.name === 'tt:root.command.insert') {
            this.isInsert = true;
            this.value = null;
            this.category = null;
            this.date = null;
            if (this.root.right.isAtom && this.root.right.name.startsWith('tt:recordtype.')) {
                this.type = this.root.right.name.substring('tt:recordtype.'.length,
                                                           this.root.right.name.length);
            } else {
                throw new Error('Invalid argument to tt:root.command.insert');
            }
        } else if (this.root.isApply && this.root.left.isApply && this.root.left.left.isAtom &&
                   this.root.left.left.name === 'tt:root.command.insertimmediate') {
            this.isInsert = true;
            if (this.root.left.right.isAtom && this.root.left.right.name.startsWith('tt:recordtype.')) {
                this.type = this.root.left.right.name.substring('tt:recordtype.'.length,
                                                                this.root.left.right.name.length);
            } else {
                throw new Error('Invalid argument to tt:root.command.insertimmediate');
            }
            this._handleValue(this.root.right);
            this.date = null;
        } else if (this.root.isApply && this.root.left.isApply && this.root.left.left.isApply &&
                   this.root.left.left.left.isAtom && this.root.left.left.left.name === 'tt:root.command.insertimmediate') {
            this.isInsert = true;
            if (this.root.left.left.right.isAtom && this.root.left.left.right.name.startsWith('tt:recordtype.')) {
                this.type = this.root.left.left.right.name.substring('tt:recordtype.'.length,
                                                                     this.root.left.left.right.name.length);
            } else {
                throw new Error('Invalid argument to tt:root.command.insertimmediate');
            }
            this._handleValue(this.root.left.right);
            if (!this.root.right.isDate)
                throw new Error('Invalid argument to tt:root.command.insertimmediate');
            this.date = this.root.right.value;
        } else if (this.root.isApply && this.root.left.isAtom &&
                   this.root.left.name === 'tt:root.command.ask') {
            this.isAsk = true;
            if (this.root.right.isAtom && this.root.right.name.startsWith('tt:recordtype.')) {
                this.type = this.root.right.name.substring('tt:recordtype.'.length,
                                                           this.root.right.name.length);
            } else {
                throw new Error('Invalid argument to tt:root.command.ask');
            }
            this.when = null;
        } else if (this.root.isApply && this.root.left.isApply && this.root.left.left.isAtom &&
                   this.root.left.left.name === 'tt:root.command.ask') {
            this.isAsk = true;
            if (this.root.left.right.isAtom && this.root.left.right.name.startsWith('tt:recordtype.')) {
                this.type = this.root.left.right.name.substring('tt:recordtype.'.length,
                                                                this.root.left.right.name.length);
            } else {
                throw new Error('Invalid argument to tt:root.command.ask');
            }
            if (!this.root.right.isDate)
                throw new Error('Invalid argument to tt:root.command.ask');
            this.when = this.root.right.value;
        } else if (this.root.isApply && this.root.left.isAtom &&
                   this.root.left.name === 'tt:root.command.askwhen') {
            this.isAskWhen = true;
            if (this.root.right.isAtom && this.root.right.name.startsWith('tt:recordtype.')) {
                this.type = this.root.right.name.substring('tt:recordtype.'.length,
                                                           this.root.right.name.length);
            } else {
                throw new Error('Invalid argument to tt:root.command.askwhen');
            }
        } else if (this.root.isApply && this.root.left.isAtom &&
                   this.root.left.name === 'tt:root.command.share') {
            this.isShare = true;
            if (this.root.right.isString) {
                this.withDoctor = this.root.right.value;
            } else {
                throw new Error('Invalid argument to tt:root.command.share');
            }
        } else if (this.root.isLambda) {
            throw new Error('FIXME: unhandled top-level lambda');
        } else {
            throw new TypeError('Invalid top-level ' + this.root);
        }
    }
});
module.exports.ValueCategory = ValueCategory;
