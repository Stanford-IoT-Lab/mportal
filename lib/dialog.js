// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2016 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details

const Q = require('q');
const lang = require('lang');
const events = require('events');
const adt = require('adt');

const LambdaForm = require('./lambda');
const ValueCategory = require('./semantic').ValueCategory;

const Dialog = new lang.Class({
    Name: 'Dialog',

    _init: function() {
        this.expecting = null;
        this.question = null;
        this.subdialog = null;
    },

    start: function() {
    },

    ask: function(expected, question) {
        this.question = question;
        this.expect(expected);
        return this.reply(question);
    },

    expect: function(category) {
        this.expecting = category;
        this.manager.setRaw(category === ValueCategory.RawString);
    },

    switchTo: function(dlg, command) {
        this.manager.setRaw(false);
        this.manager.setDialog(dlg);
        if (command)
            return dlg.handle(command);
        else
            return true;
    },

    switchToDefault: function() {
        return this.switchTo(new DefaultDialog());
    },

    push: function(dlg, command) {
        this.manager.setRaw(false);
        this.subdialog = dlg;
        dlg.manager = this.manager;
        if (command)
            return dlg.handle(command);
        else
            return true;
    },

    reply: function(msg) {
        this.manager.sendReply(msg);
        return true;
    },

    handleGeneric: function(analyzer) {
        if (this.subdialog !== null) {
            if (this.subdialog.handle(analyzer))
                return true;
        }

        if (analyzer.isSpecial) {
            switch(analyzer.root.name) {
            case 'tt:root.special.failed':
                return false;
            case 'tt:root.special.hello':
                if (this.patient.isValid)
                    this.reply("Hi, " + this.patient.nick_name);
                else
                    this.reply("Hello! You have not told me your name yet");
                break;
            case 'tt:root.special.debug':
                this.reply("This is a " + this.__name__);
                if (this.expecting === null)
                    this.reply("I'm not expecting anything");
                else
                    this.reply("I'm expecting a " + categoryName(this.expecting));
                break;
            case 'tt:root.special.help':
                this.reply("Sure! How can I help you?");
                this.reply("If you're unsure what to say, I understand commands of the form \"insert something record\", and I'll guide you through the procedure.");
                if (this.expecting !== null) {
                    if (this.expecting === ValueCategory.YesNo) {
                        this.reply("At this time, just a yes or no will be fine though.");
                    } else if (this.question !== null) {
                        this.reply(this.question);
                    }
                }
                break;
            case 'tt:root.special.thankyou':
                this.reply("At your service.");
                break;
            case 'tt:root.special.sorry':
                this.reply("No need to be sorry.");
                this.reply("Unless you're Canadian. Then I won't stop you.");
                break;
            case 'tt:root.special.cool':
                this.reply("I know, right?");
                break;
            case 'tt:root.special.nevermind':
                this.reset();
                break;
            }
            return true;
        }

        if (this.expecting === ValueCategory.YesNo) {
            if (analyzer.isYes || analyzer.isNo)
                return false;

            return this.reply("Just answer yes or no.");
        } else if (this.expecting !== null &&
                   (!analyzer.isValue || analyzer.category !== this.expecting)) {
            if (analyzer.isYes)
                return this.reply("Yes what?");
            else if (analyzer.isNo)
                return this.reset();

            return this.unexpected();
        }

        return false;
    },

    handlePicture: function(url) {
        if (this.subdialog !== null)
            return this.subdialog.handlePicture(url);

        // let all pictures through by default
        return false;
    },

    handleRaw: function(raw) {
        if (this.subdialog !== null)
            return this.subdialog.handleRaw(raw);

        this.reply("I'm a little confused, sorry. What where we talking about?");
        this.switchToDefault();
        return true;
    },

    handle: function(command) {
        if (this.handleGeneric(command))
            return true;

        this.reply("I'm a little confused, sorry. What where we talking about?");
        this.switchToDefault();
        return true;
    },

    reset: function() {
        this.reply("Ok forget it");
        this.switchToDefault();
        return true;
    },

    done: function() {
        this.reply("Consider it done");
        this.switchToDefault();
        return true;
    },

    unexpected: function() {
        return this.reply("That's not what I asked");
    },

    fail: function() {
        this.reply("Sorry, I did not understand that. Can you rephrase it?");
        return true;
    },

    // faild and lose context
    failReset: function() {
        this.fail();
        this.switchToDefault();
        return true;
    },
});

const DefaultDialog = new lang.Class({
    Name: 'DefaultDialog',
    Extends: Dialog,

    handle: function(analyzer) {
        if (this.handleGeneric(analyzer))
            return true;

        if (analyzer.isYes)
            return this.reply("I agree, but to what?");
        else if (analyzer.isNo)
            return this.reply("No way!");
        else
            return false;
    }
});

const InitializationDialog = new lang.Class({
    Name: 'InitializationDialog',
    Extends: Dialog,

    _init: function() {
        this.parent();

        this.name = null;
        this.dobOk = false;
        this.genderOk = false;
    },

    _checkName: function() {
        if (this.patient.isValid)
            return true;

        this.ask(ValueCategory.YesNo, "Can I call you " + this.user.name + "?");
        return true;
    },

    _checkDOB: function() {
        if (this.dobOk)
            return false;

        var dob = this.patient.date_of_birth;
        if (dob !== null) {
            this.dobOk = true;
            return false;
        }

        this.ask(ValueCategory.Date, "When were you born?");
        this.reply("(You can say no at any time and I will stop asking you questions)");
        return true;
    },

    _checkGender: function() {
        if (this.genderOk)
            return false;

        this.patient.getInfo().then(function(info) {
            if (info.gender !== null) {
                this.genderOk = true;
                this._continue();
            } else {
                this.ask(ValueCategory.Gender, "Are you male or female?");
            }
        });
        return true;
    },

    _handleNameResponse: function(word) {
        if (word.isYes) {
            this.name = this.user.name;
            this.patient.store({ full_name: this.name,
                                 nick_name: this.name });
            this.reply("Hi " + this.name + ", nice to meet you.");
            this.expecting = null;
            return false;
        } else {
            return this.ask(ValueCategory.RawString, "Ok, what's your name then?");
        }
    },

    start: function() {
        var initialized = this.patient !== null;
        if (initialized)

        setTimeout(function() {
            this.reply("Hello! My name is Stanford HealthBot, and I'm your medical assistant.");

            this._continue();
        }.bind(this), 1000);
    },

    handleRaw: function(command) {
        if (this.expecting === ValueCategory.RawString) {
            if (this.name === null) {
                this.name = command;
                this.patient.store({ full_name: this.user.name,
                                     nick_name: this.name });
                this.reply("Hi " + this.name + ", nice to meet you.");
                return this._continue();
            }
        }

        return this.parent(command);
    },

    handle: function(command) {
        if (this.handleGeneric(command))
            return true;

        if (this.expecting === ValueCategory.YesNo) {
            if (this.name === null) {
                if (this._handleNameResponse(command))
                    return true;
            }
        }

        if (this.expecting === ValueCategory.Date) {
            this.patient.changeDOB(command.value.value).then(function () {
                this._continue();
            }.bind(this));
            return true;
        }

        if (this.expecting === ValueCategory.Gender) {
            this.patient.insertGender(command.value.value).then(function () {
                this._continue();
            }.bind(this));
            return true;
        }

        return this._continue();
    },

    _continue: function() {
        if (this._checkName())
            return true;

        if (this._checkDOB())
            return true;

        if (this._checkGender())
            return true;

        this.reply("Ok, now I'm ready to help you.");
        this.switchToDefault();
        return true;
    },
});
