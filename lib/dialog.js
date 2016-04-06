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

function arrayEquals(a, b) {
    if (a.length !== b.length)
        return false;

    return a.every(function(e, i) {
        return categoryEquals(e, b[i]);
    });
}

function categoryEquals(a, b) {
    if (Array.isArray(a) && Array.isArray(b))
        return arrayEquals(a, b);
    if (Array.isArray(a) !== Array.isArray(b))
        return false;
    return a.equals(b);
}

const Dialog = new lang.Class({
    Name: 'Dialog',

    _init: function() {
        this.expecting = null;
        this.question = null;
        this.subdialog = null;
    },

    start: function() {
    },

    notify: function() {
        return false;
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

    replyRDL: function(rdl) {
        this.manager.sendRDL(rdl);
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
                   (!analyzer.isValue || !categoryEquals(analyzer.category, this.expecting))) {
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

    notify: function(data) {
        var text = data[0];
        var fullName = data[1];
        var affiliation = data[2];

        this.reply('Message from Dr. ' + fullName + ': ' + text);
        return true;
    },

    handle: function(analyzer) {
        if (this.handleGeneric(analyzer))
            return true;

        if (analyzer.isYes)
            return this.reply("I agree, but to what?");
        else if (analyzer.isNo)
            return this.reply("No way!");
        else if (analyzer.isInsert && (analyzer.type === 'weight' ||
                                       analyzer.type === 'height' ||
                                       analyzer.type === 'diagnosis' ||
                                       analyzer.type === 'body_temperature' ||
                                       analyzer.type === 'heart_rate' ||
                                       analyzer.type === 'blood_pressure' ||
                                       analyzer.type === 'labresults'))
            return this.switchTo(new InsertValueDialog(analyzer.type), analyzer);
        else if (analyzer.isInsert && (analyzer.type === 'other' ||
                                       analyzer.type === 'xray' ||
                                       analyzer.type === 'catscan'))
            return this.switchTo(new InsertGenericDialog(analyzer.type), analyzer);
        else if (analyzer.isAsk && (analyzer.type === 'weight' ||
                                    analyzer.type === 'height' ||
                                    analyzer.type === 'gender'))
            return this.switchTo(new AskInfoDialog(), analyzer);
        else if (analyzer.isAsk && (analyzer.type === 'diagnosis' ||
                                    analyzer.type === 'body_temperature' ||
                                    analyzer.type === 'heart_rate' ||
                                    analyzer.type === 'blood_pressure' ||
                                    analyzer.type === 'labresults'))
            return this.switchTo(new AskDialog(), analyzer);
        else if (analyzer.isAskWhen)
            return this.switchTo(new AskWhenDialog(), analyzer);
        else if (analyzer.isShare)
            return this.switchTo(new ShareDialog(), analyzer);
        else
            return false;
    }
});

const AskInfoDialog = new lang.Class({
    Name: 'AskDialog',
    Extends: Dialog,

    handle: function(analyzer) {
        if (this.handleGeneric(analyzer))
            return true;

        this.manager.patient.getInfo().then(function(info) {
            if (analyzer.type === 'weight')
                this.reply(info.weight + ' kgs');
            else if (analyzer.type === 'height')
                this.reply(info.height + ' cms');
            else if (analyzer.type === 'gender')
                this.reply(info.gender);
            this.switchToDefault();
        }.bind(this)).done();
        return true;
    }
});

const AskDialog = new lang.Class({
    Name: 'AskDialog',
    Extends: Dialog,

    _getData: function(analyzer) {
        if (analyzer.type === 'diagnosis')
            return this.manager.patient.getLastDiagnosis();
        else if (analyzer.type === 'body_temperature')
            return this.manager.patient.getLastBodyTemperature();
        else if (analyzer.type === 'heart_rate')
            return this.manager.patient.getLastHeartRate();
        else if (analyzer.type === 'blood_pressure')
            return this.manager.patient.getLastBloodPressure();
        else if (analyzer.type === 'labresults')
            return this.manager.patient.getLastLabResults();
        else
            throw new TypeError();
    },

    handle: function(analyzer) {
        if (this.handleGeneric(analyzer))
            return true;

        this._getData(analyzer).then(function(info) {
            if (!info) {
                this.reply("You don't have a record of this type.");
                this.switchToDefault();
                return;
            }
            if (analyzer.type === 'diagnosis')
                this.reply(info.cancer_type + ' cancer, stage ' + (info.substage !== null ? (info.stage + ' ' + info.substage) : info.stage));
            else if (analyzer.type === 'body_temperature')
                this.reply(info.temp_C + ' ℃');
            else if (analyzer.type === 'heart_rate')
                this.reply(info.heart_rate_bpm + ' bpm');
            else if (analyzer.type === 'blood_pressure')
                this.reply(info.blood_pressure_mmHg + ' mmHg');
            else if (analyzer.type === 'labresults') {
                this.reply('White blood cell count: ' + info.white_blood_cell_count + ' K/uL');
                this.reply('Hematocrit: ' + info.hematocrit_percent + '%');
                this.reply('Hemoglobin: ' + info.hemoglobin + ' g/dL');
                this.reply('Platelet count: ' + info.platelet_count + ' K/uL');
            }
            this.switchToDefault();
        }.bind(this)).done();
        return true;
    }
});

const AskWhenDialog = new lang.Class({
    Name: 'AskDialog',
    Extends: Dialog,

    _getData: function(analyzer) {
        if (analyzer.type === 'weight')
            return this.manager.patient.getLastWeight();
        else if (analyzer.type === 'height')
            return this.manager.patient.getLastHeight();
        else if (analyzer.type === 'gender')
            return this.manager.patient.getLastGender();
        else if (analyzer.type === 'diagnosis')
            return this.manager.patient.getLastDiagnosis();
        else if (analyzer.type === 'body_temperature')
            return this.manager.patient.getLastBodyTemperature();
        else if (analyzer.type === 'heart_rate')
            return this.manager.patient.getLastHeartRate();
        else if (analyzer.type === 'blood_pressure')
            return this.manager.patient.getLastBloodPressure();
        else if (analyzer.type === 'labresults')
            return this.manager.patient.getLastLabResults();
        else
            throw new TypeError();
    },

    handle: function(analyzer) {
        if (this.handleGeneric(analyzer))
            return true;

        this._getData(analyzer).then(function(info) {
            this.reply(String(info.collect_time));
            this.switchToDefault();
        }.bind(this)).done();
        return true;
    }
});

const ShareDialog = new lang.Class({
    Name: 'ShareDialog',
    Extends: Dialog,

    _init: function() {
        this.parent();
        this.withDoctor = null;
        this.resolvingDoctors = null;
        this.doctorId = null;
        this.doctorName = null;
        this.confirmed = false;
    },

    handleRaw: function(raw) {
        if (this.expecting === ValueCategory.RawString)
            this.withDoctor = raw;
        else
            return this.unexpected();

        return this._continue();
    },

    handle: function(analyzer) {
        if (this.handleGeneric(analyzer))
            return true;

        if (analyzer.isShare)
            this.withDoctor = analyzer.withDoctor;

        if (this.expecting === ValueCategory.Number &&
            Math.floor(analyzer.value) >= 0 &&
            Math.floor(analyzer.value) < this.resolvingDoctors.length) {
            var doctor = this.resolvingDoctors[Math.floor(analyzer.value)];
            this.doctorId = doctor.id;
            this.doctorName = doctor.full_name;
        }

        if (this.expecting === ValueCategory.YesNo) {
            if (analyzer.isNo)
                return this.reset();
            this.confirmed = analyzer.isYes;
        }

        return this._continue();
    },

    _execute: function() {
        return this.manager.patient.ensureSync().then(function(syncId) {
            return this.manager.doctorPortal.addPatientToDoctor(syncId, this.doctorId);
        }.bind(this)).then(function() {
            return this.done();
        }.bind(this));
    },

    _continue: function() {
        if (this.withDoctor === null)
            return this.ask(ValueCategory.RawString, "Who do you want to share your data with?");

        if (this.doctorId === null && this.resolvingDoctors === null) {
            this.manager.doctorPortal.resolveDoctor(this.withDoctor).then(function(doctors) {
                if (doctors.length === 0) {
                    this.reply("There is no doctor with this name.");
                    this.withDoctor = null;
                    this.ask(ValueCategory.RawString, "Who do you want to share your data with?");
                    return;
                }
                if (doctors.length === 1) {
                    this.doctorId = doctors[0].id;
                    this.doctorName = doctors[0].full_name;
                    this._continue();
                    return;
                }

                this.resolvingDoctors = doctors;
                this.ask(ValueCategory.Number, 'Multiple doctors match your name. Which one do you mean?');
                this.reply('(Click on the name to choose one)');
                doctors.forEach(function(d, i) {
                    var lambdaForm = '(tt:root.token.value (number ' + i + '))';
                    var url = 'https://web.stanford.edu/~gcampagn/mportal/echo.html#' + encodeURIComponent(lambdaForm);
                    this.replyRDL({ type: 'rdl', noun: 'doctor',
                                    displayTitle: d.full_name,
                                    displayText: "Affiliated with " + d.affiliation,
                                    callback: url,
                                    webCallback: url });
                }, this);
            }.bind(this)).done();
            return true;
        }

        if (!this.confirmed)
            return this.ask(ValueCategory.YesNo, "Ok, do you confirm sharing your data with " + this.doctorName + "?");

        return this._execute();
    }
});

const InsertGenericDialog = new lang.Class({
    Name: 'InsertGenericDialog',
    Extends: Dialog,

    _init: function(kind) {
        this.parent();
        this.kind = kind;
        this.obj = null;
        this.time = null;
    },

    handlePicture: function(obj) {
        if (this.expecting === ValueCategory.Picture)
            this.obj = obj;
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
        if (this.obj === null) {
            return this.ask(ValueCategory.Picture, "Take a picture of the record now");
        } else if (this.time === null) {
            return this.ask(ValueCategory.Date, "When did you obtain it?");
        } else {
            this.manager.patient.insertOther(this.obj, this.kind, this.time).then(function() {
                this.reply("Ok, I added a new record.");
                this.switchToDefault();
            }.bind(this)).done();
            return true;
        }
    }
});

const InsertValueDialog = new lang.Class({
    Name: 'InsertValueDialog',
    Extends: Dialog,

    _init: function(kind) {
        this.parent();
        this.kind = kind;
        this.value = null;
        this.time = null;
    },

    _askValue: function() {
        if (this.kind === 'weight')
            return this.ask(ValueCategory.Measure('kg'), "What is your weight?");
        else if (this.kind === 'height')
            return this.ask(ValueCategory.Measure('m'), "What is your height?");
        else if (this.kind === 'body_temperature')
            return this.ask(ValueCategory.Measure('C'), "What is your temperature?");
        else if (this.kind === 'heart_rate')
            return this.ask(ValueCategory.Measure('bpm'), "What is your heart rate?");
        else if (this.kind === 'blood_pressure')
            return this.ask(ValueCategory.Measure('mmHg'), "What is your blood pressure?");
        else if (this.kind === 'labresults') {
            this.replyRDL({ type: 'rdl', noun: 'form',
                            displayTitle: "Lab Results",
                            displayText: "Use this form to upload your lab results",
                            callback: 'https://web.stanford.edu/~gcampagn/mportal/#labresults',
                            webCallback: 'https://web.stanford.edu/~gcampagn/mportal/#labresults' });
            this.switchToDefault();
            return true;
        } else if (this.kind === 'diagnosis') {
            this.replyRDL({ type: 'rdl', noun: 'form',
                            displayTitle: "Diagnosis",
                            displayText: "Use this form to upload your diagnosis",
                            callback: 'https://web.stanford.edu/~gcampagn/mportal/#diagnosis',
                            webCallback: 'https://web.stanford.edu/~gcampagn/mportal/#diagnosis' });
            this.switchToDefault();
            return true;
        } else
            throw new TypeError();
    },

    _checkOk: function(analyzer) {
        if (this.kind === 'weight')
            return categoryEquals(analyzer.category, ValueCategory.Measure('kg'));
        else if (this.kind === 'height')
            return categoryEquals(analyzer.category, ValueCategory.Measure('m'));
        else if (this.kind === 'body_temperature')
            return categoryEquals(analyzer.category, ValueCategory.Measure('C'));
        else if (this.kind === 'heart_rate')
            return categoryEquals(analyzer.category, ValueCategory.Measure('bpm'));
        else if (this.kind === 'blood_pressure')
            return categoryEquals(analyzer.category, ValueCategory.Measure('mmHg'));
        else if (this.kind === 'diagnosis')
            return categoryEquals(analyzer.category, [ValueCategory.RawString, ValueCategory.RawString, ValueCategory.RawString]);
        else if (this.kind === 'labresults')
            return categoryEquals(analyzer.category, [ValueCategory.Number, ValueCategory.Number, ValueCategory.Number, ValueCategory.Number]);
        else
            return false;
    },

    handle: function(analyzer) {
        if (this.handleGeneric(analyzer))
            return true;

        if (this.expecting === ValueCategory.Date) {
            this.time = analyzer.value;
        } else if (this.expecting !== null) {
            this.value = analyzer.value;
        } else if (analyzer.category !== null) {
            if (!this._checkOk(analyzer))
                return this.fail();
            this.value = analyzer.value;
        }

        return this._continue();
    },

    _complete: function() {
        if (this.kind === 'weight') {
            return this.manager.patient.insertWeight(this.value, this.time).then(function() {
                this.reply("Ok, I added a new weight record with value " + this.value + " kgs.");
            }.bind(this));
        } else if (this.kind === 'height') {
            return this.manager.patient.insertHeight(this.value * 100, this.time).then(function() {
                this.reply("Ok, I added a new height record with value " + this.value * 100 + " cms.");
            }.bind(this));
        } else if (this.kind === 'diagnosis') {
            return this.manager.patient.insertDiagnosis(this.value[0], this.value[1], this.value[2], this.time).then(function() {
                this.reply("Ok, I added a new diagnosis record.");
            }.bind(this));
        } else if (this.kind === 'body_temperature') {
            return this.manager.patient.insertBodyTemperature(this.value, this.time).then(function() {
                this.reply("Ok, I added a new body temperature record with value " + this.value + " C.");
            }.bind(this));
        } else if (this.kind === 'heart_rate') {
            return this.manager.patient.insertHeartRate(this.value, this.time).then(function() {
                this.reply("Ok, I added a new heart rate record with value " + this.value + " bpm.");
            }.bind(this));
        } else if (this.kind === 'blood_pressure') {
            return this.manager.patient.insertBloodPressure(this.value, this.time).then(function() {
                this.reply("Ok, I added a new blood pressure record with value " + this.value + " mmHg.");
            }.bind(this));
        } else if (this.kind === 'labresults') {
            return this.manager.patient.insertLabResults(this.value[0], this.value[1], this.value[2], this.value[3], this.time).then(function() {
                this.reply("Ok, I added the new lab results.");
            }.bind(this));
        } else {
            throw new TypeError();
        }
    },

    _continue: function() {
        if (this.value === null) {
            return this._askValue()
        } else if (this.time === null) {
            if (this.kind === 'diagnosis' || this.kind === 'labresults')
                return this.ask(ValueCategory.Date, "When did you obtain it?");
            else
                return this.ask(ValueCategory.Date, "When did you measure it?");
        } else {
            this._complete().then(function() {
                this.switchToDefault();
            }.bind(this)).done();
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
        this.replyRDL({ type: 'rdl', noun: 'app',
                        displayTitle: "Stanford MPortal",
                        displayText: "Use this app to upload your records",
                        callback: 'https://web.stanford.edu/~gcampagn/mportal/',
                        webCallback: 'https://web.stanford.edu/~gcampagn/mportal/' });
        this.switchToDefault();
        return true;
    },
});

module.exports = {
    InitializationDialog: InitializationDialog
};
