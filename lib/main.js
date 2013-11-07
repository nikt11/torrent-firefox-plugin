var rootnodeTorrentManager = {
    APIURL: 'http://web3.rootnode.net:14031/api/1.0',
    init: function init() {
        var {Cc, Ci} = require('chrome');

        this.addOnSdk = {};
        this.chrome = {};

        this.addOnSdk.self =  require('self');
        this.addOnSdk.tabs =  require('tabs');
        this.addOnSdk.pageMod = require('sdk/page-mod').PageMod;
        this.addOnSdk.url = require('sdk/net/url');
        this.addOnSdk.XHR = require('sdk/net/xhr');
        this.addOnSdk.base64 = require('sdk/base64');
        this.chrome.mediator = Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator);
        this.chrome.parser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser);

        this.initExtension();
    },
    initExtension: function initXUL() {
        var _this = this;
        exports.main = function exportsMain(options, callbacks) {
            _this.addToolbarButton.call(_this);
        };

        exports.onUnload = function exportsOnUnload(reason) {
            _this.removeToolbarButton.call(_this);
        };

        this.addOnSdk.pageMod({
            include: /^resource:\/\/.*\/rootnode-torrent-manager\/.*/,
            contentScriptFile: _this.addOnSdk.self.data.url('js/tab.js'),
            onAttach: function(worker) {
                worker.port.on('getTorrents', function(query) {
                    _this.getTorrentsOnPage.call(_this, query, 1, function(torrents, more) {
                        var _torrents = torrents;
                        more = more === undefined ? false : more;
                        if (more) {
                            _this.getTorrentsOnPage.call(_this, query, 2, function(torrents, more) {
                                worker.port.emit('torrentsList', _torrents.concat(torrents));
                            });
                        } else {
                            worker.port.emit('torrentsList', torrents);
                        }
                    });
                });

                worker.port.on('queueTorrent', function(data) {
                    var xhr = new (_this.addOnSdk.XHR.XMLHttpRequest)();
                    xhr.open('GET', data.url, true);
                    xhr.overrideMimeType("text/plain; charset=x-user-defined");
                    xhr.onreadystatechange = function() {
                        var xhrup;
                        if (xhr.readyState == 4) {
                            if(xhr.response.match(/^<\!DOCTYPE html>/)) {
                                worker.port.emit('queueResult', {hash: data.hash, success: false});
                            } else {
                                xhrup = new (_this.addOnSdk.XHR.XMLHttpRequest)();
                                xhrup.open('POST', _this.APIURL + '/torrent/add');
                                xhrup.setRequestHeader('Content-Type', 'application/octet-stream');
                                // TODO: implement auth in settings
                                xhrup.setRequestHeader('Authorization', 'Basic ' + _this.addOnSdk.base64.encode('666:dupa.8'));
                                xhrup.onreadystatechange = function() {
                                    // TODO - check repsonse from API if everything is okay.
                                    if(true) {
                                        // API okey
                                        worker.port.emit('queueResult', {hash: data.hash, success: true});
                                    } else {
                                        // API error
                                        worker.port.emit('queueResult', {hash: data.hash, success: false});
                                    }

                                };
                                xhrup.send(xhr.response);
                            }
                        }
                    };
                    xhr.send(null);
                });
            }
        });
    },
    getTorrentsOnPage: function getTorrentsOnPage(query, page, callback) {
        var _this = this;
        page = (page === undefined || parseInt(page, 10) < 2) ? '' : '&p=' + page;
        callback = callback === undefined ? function() {} : callback;
        this.addOnSdk.url.readURI('http://torrentz.eu/search?f=' + query + page).then(function (resp) {
            var doc = _this.chrome.parser.parseFromString(resp, 'text/html');
            var a, items, torrents = [], torrent;
            items = doc.querySelectorAll('.results dl');
            more = !!doc.querySelectorAll('.results > p');
            for(var i = 0; i < items.length; i += 1) {
                a = items[i].querySelector('dt a');
                if(a) {
                    torrent = {};
                    torrent.title = a.innerHTML.replace(/<[^>]+>/g, '');
                    torrent.hash = a.getAttribute('href').replace('/', '');
                    torrent.date = items[i].querySelector('.a span').getAttribute('title');
                    torrent.size = items[i].querySelector('.s').innerHTML;
                    torrent.seeds = parseInt(items[i].querySelector('.u').innerHTML.replace(/[^0-9]+/g, ''), 10);
                    torrent.peers = parseInt(items[i].querySelector('.d').innerHTML.replace(/[^0-9]+/g, ''), 10);
                    torrents.push(torrent);
                }
            }
            callback(torrents, more);
        });
    },

    // Toolbar Buttons
    addToolbarButton: function addToolbarButton() {
    // this document is an XUL document
        var document = this.chrome.mediator.getMostRecentWindow('navigator:browser').document;
        var navBar = document.getElementById('nav-bar');
        var btn = document.createElement('toolbarbutton');
        var _this = this;

        if (!navBar) {
            return;
        }
        btn.setAttribute('id', 'rootnode-torrent-manager-toolbar-button');
        btn.setAttribute('type', 'button');
        btn.setAttribute('class', 'toolbarbutton-1');
        btn.setAttribute('image', this.addOnSdk.self.data.url('img/logo.png'));
        btn.setAttribute('orient', 'horizontal');
        btn.setAttribute('label', 'RTM');

        btn.addEventListener('click', function() {
            _this.addOnSdk.tabs.open(_this.addOnSdk.self.data.url("manager.html"));
        }, false);

        navBar.appendChild(btn);
    },
    removeToolbarButton: function removeToolbarButton() {
        var document = this.chrome.mediator.getMostRecentWindow('navigator:browser').document,
            navBar = document.getElementById('nav-bar'),
            btn = document.getElementById('mybutton-id');

        if (navBar && btn) {
            navBar.removeChild(btn);
        }
    }
};

rootnodeTorrentManager.init();

