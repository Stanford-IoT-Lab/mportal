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
const omclient = require('omclient').client;

const Sempre = require('./semprewrapper');
const Conversation = require('./conversation');
const Messaging = require('./messaging');

const API_KEY = '00109b1ea59d9f46d571834870f0168b5ed20005871d8752ff';
const API_SECRET = 'bccb852856c462e748193d6211c730199d62adcf0ba963416fcc715a2db4d76f';

const OmletStateStorage = new lang.Class({
    Name: 'OmletStateStorage',

    _init: function() {
        this._prefs = platform.getSharedPreferences();
        this._storage = this._prefs.get('assistant');
        if (this._storage === undefined)
            this._prefs.set('assistant', this._storage = {});
    },

    key: function(idx) {
        return Object.keys(this._storage)[idx];
    },
    getItem: function(key) {
        return this._storage[key];
    },
    setItem: function(key, value) {
        this._storage[key] = value;
        this._prefs.changed();
    },
    removeItem: function(key) {
        delete this._storage[key];
        this._prefs.changed();
    },
    clear: function() {
        this._storage = {};
        this._prefs.changed();
    }
});

var storage_ = null;
var instance_ = null;

function makeOmletClient(sync) {
    var client = new omclient.Client({ instance: 'assistant',
                                       storage: storage_,
                                       sync: sync,
                                       apiKey: { Id: API_KEY, Secret: API_SECRET } });
    client.longdanMessageConsumer.DEBUG = false;
    return client;
}

module.exports = new lang.Class({
    Name: 'OmletDispatcher',

    _init: function() {
        instance_ = this;

        this._conversations = {};
        this._sempre = new Sempre(false);

        this._feedAddedListener = this._onFeedAdded.bind(this);
        this._feedChangedListener = this._onFeedChanged.bind(this);
        this._feedRemovedListener = this._onFeedRemoved.bind(this);

        this._client = null;
        this._prefs = platform.getSharedPreferences();
        if (this._prefs.get('assistant') === undefined) {
            throw new Error('You must configure the Omlet account for MPortal');
            return;
        }
        this.init();
    },

    get isAvailable() {
        return this._client !== null;
    },

    init: function() {
        storage_ = new OmletStateStorage();
        this._client = makeOmletClient(true);
    },

    _makeConversation: function(feedId) {
        var feed = this._messaging.getFeed(feedId);
        return feed.open().then(function() {
            var members = feed.getMembers();
            if (members.length < 2) {
                console.log('Ignored feed ' + feedId);
                return;
            }
            if (members.length >= 3) {
                console.log('Rejected feed ' + feedId);
                return feed.sendText("MPortal cannot be added to a group chat");
            }

            var conv = new Conversation(this._client, this._sempre, feed, members[1]);
            this._conversations[feedId] = conv;
            conv.start();
        }.bind(this));
    },

    _onFeedAdded: function(feedId) {
        this._makeConversation(feedId).done();
    },

    _onFeedChanged: function(feedId) {
        if (this._conversations[feedId])
            return;
        this._makeConversation(feedId).done();
    },

    _onFeedRemoved: function(feedId) {
        var conv = this._conversations[feedId];
        delete this._conversations[feedId];
        if (conv)
            conv.stop().done();
    },

    start: function() {
        if (!this._client)
            return;

        this._client.enable();
        this._sempre.start();
        this._messaging = new Messaging(this._client);
        return this._messaging.start().then(function() {
            return this._messaging.getFeedList();
        }.bind(this)).then(function(feeds) {
            this._messaging.on('feed-added', this._feedAddedListener);
            this._messaging.on('feed-changed', this._feedChangedListener);
            this._messaging.on('feed-removed', this._feedRemovedListener);
            return Q.all(feeds.map(function(f) {
                return this._makeConversation(f);
            }, this));
        }.bind(this));
    },

    stop: function() {
        if (!this._client)
            return Q();
        this._client.disable();
        this._sempre.stop();

        this._messaging.removeListener('feed-added', this._feedAddedListener);
        this._messaging.removeListener('feed-removed', this._feedRemovedListener);

        for (var feedId in this._conversations) {
            this._conversations[feedId].stop().done();
        }

        return Q();
    },
})
