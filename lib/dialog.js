// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
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
                if (this.manager.patient.isValid)
                    this.reply("Hi, " + this.manager.patient.nick_name);
                else
                    this.reply("Hello! You have not told me your name yet");
                break;
            case 'tt:root.special.debug':
                this.reply("This is a " + this.__name__);
                if (this.expecting === null)
                    this.reply("I'm not expecting anything");
                else
                    this.reply("I'm expecting a " + this.expecting);
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
                   (!analyzer.isValue || !analyzer.category.equals(this.expecting))) {
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
        else if (analyzer.isInsert && analyzer.type === 'weight')
            return this.switchTo(new InsertWeightDialog(), analyzer);
        else if (analyzer.isInsert && analyzer.type === 'height')
            return this.switchTo(new InsertHeightDialog(), analyzer);
        else if (analyzer.isInsert && analyzer.type === 'generic')
            return this.switchTo(new InsertGenericDialog(), analyzer);
        else
            return false;
    }
});

const InsertGenericDialog = new lang.Class({
    Name: 'InsertGenericDialog',
    Extends: Dialog,

    _init: function() {
        this.parent();
        this.url = null;
        this.time = null;
    },

    handlePicture: function(url) {
        if (this.expecting === ValueCategory.Picture)
            this.url = url;
        else
            return this.unexpected();

        return this._continue();
    },

    handle: function(analyzer) {
        if (this.handleGeneric(analyzer))
            return true;

        if (this.expecting === ValueCategory.Date)
            this.time = analyzer.value;

        return this._continue();
    },

    _continue: function() {
        if (this.url === null) {
            return this.ask(ValueCategory.Picture, "Take a picture of the record now");
        } else if (this.time === null) {
            return this.ask(ValueCategory.Date, "When did you obtain it?");
        } else {
            this.manager.patient.insertOther(this.url, this.time).then(function() {
                this.reply("Ok, I added a new record.");
                this.switchToDefault();
            }.bind(this));
            return true;
        }
    }
});

const InsertWeightDialog = new lang.Class({
    Name: 'InsertWeightDialog',
    Extends: Dialog,

    _init: function() {
        this.parent();
        this.weight = null;
        this.time = null;
    },

    handle: function(analyzer) {
        if (this.handleGeneric(analyzer))
            return true;

        if (this.expecting === ValueCategory.Date)
            this.time = analyzer.value;
        else if (this.expecting !== null)
            this.weight = analyzer.value;

        return this._continue();
    },

    _continue: function() {
        if (this.weight === null) {
            return this.ask(ValueCategory.Measure('kg'), "What is your weight?");
        } else if (this.time === null) {
            return this.ask(ValueCategory.Date, "When did you measure it?");
        } else {
            this.manager.patient.insertWeight(this.weight, this.time).then(function() {
                this.reply("Ok, I added a new weight record with value " + this.weight + " kgs.");
                this.switchToDefault();
            }.bind(this));
            return true;
        }
    }
});

const InsertHeightDialog = new lang.Class({
    Name: 'InsertHeightDialog',
    Extends: Dialog,

    _init: function() {
        this.parent();
        this.height = null;
        this.time = null;
    },

    handle: function(analyzer) {
        if (this.handleGeneric(analyzer))
            return true;

        if (this.expecting === ValueCategory.Date)
            this.time = analyzer.value;
        else if (this.expecting !== null)
            this.height = analyzer.value;

        return this._continue();
    },

    _continue: function() {
        if (this.height === null) {
            return this.ask(ValueCategory.Measure('m'), "What is your height?");
        } else if (this.time === null) {
            return this.ask(ValueCategory.Date, "When did you measure it?");
        } else {
            this.manager.patient.insertHeight(this.height * 100, this.time).then(function() {
                this.reply("Ok, I added a new height record with value " + this.height * 100 + " cms.");
                this.switchToDefault();
            }.bind(this));
            return true;
        }
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
        if (this.manager.patient.isValid)
            return false;

        this.ask(ValueCategory.YesNo, "Can I call you " + this.manager.user.name + "?");
        return true;
    },

    _checkDOB: function() {
        if (this.dobOk)
            return false;

        this.dobOk = true;
        var dob = this.manager.patient.date_of_birth;
        if (dob !== null) {
            return false;
        }

        this.ask(ValueCategory.Date, "When were you born?");
        this.reply("(You can say no at any time and I will stop asking you questions)");
        return true;
    },

    _checkGender: function() {
        if (this.genderOk)
            return false;

        this.manager.patient.getInfo().then(function(info) {
            console.log('info', info);
            if (info.gender !== null) {
                this.genderOk = true;
                this._continue();
            } else {
                this.ask(ValueCategory.Gender, "Are you male or female?");
            }
        }.bind(this));
        return true;
    },

    _handleNameResponse: function(word) {
        if (word.isYes) {
            this.name = this.manager.user.name;
            this.manager.patient.store({ full_name: this.name,
                                         nick_name: this.name })
                .then(function() {
                    this.reply("Hi " + this.name + ", nice to meet you.");
                    this._continue();
                }.bind(this));
            this.expecting = null;
            return true;
        } else {
            return this.ask(ValueCategory.RawString, "Ok, what's your name then?");
        }
    },

    start: function() {
        var initialized = this.manager.patient.isValid;
        if (initialized) {
            this.switchToDefault();
            return;
        }

        setTimeout(function() {
            this.reply("Hello! My name is Stanford HealthBot, and I'm your medical assistant.");

            this._continue();
        }.bind(this), 1000);
    },

    handleRaw: function(command) {
        if (this.expecting === ValueCategory.RawString) {
            if (this.name === null) {
                this.name = command;
                this.manager.patient.store({ full_name: this.manager.user.name,
                                             nick_name: this.name })
                    .then(function() {
                        this.reply("Hi " + this.name + ", nice to meet you.");
                        this._continue();
                    }.bind(this));
                return true;
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
            this.manager.patient.changeDOB(command.value).then(function () {
                this._continue();
            }.bind(this));
            return true;
        }

        if (this.expecting === ValueCategory.Gender) {
            this.manager.patient.insertGender(command.value).then(function () {
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

module.exports = {
    InitializationDialog: InitializationDialog
};