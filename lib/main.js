var rootnodeTorrentManager = {
    CONTENTSURL: 'https://torrent.rootnode.net/get',
    APIURL: 'https://torrent.rootnode.net/api/1.0',
    STATUS_MAP: {
        401: 'Access denied',
        402: 'Payment required',
        403: 'Account blocked'
    },
    ENDPOINTS: {
        index: {
            path: '/torrents',
            method: 'GET'
        },
        create: {
            path: '/torrent',
            method: 'POST'
        },
        remove: {
            path: '/torrent/:hash',
            method: 'DELETE'
        },
        list: {
            path: '/',
            method: 'GET'
        },
        register: {
            path: '/user/register',
            method: 'POST'
        },
        user: {
            path: '/user',
            method: 'GET'
        }
    },
    init: function init() {
        var {Cc, Ci} = require('chrome');

        this.addOnSdk = {};
        this.chrome = {};

        this.addOnSdk.self =  require('sdk/self');
        this.addOnSdk.tabs =  require('sdk/tabs');
        this.addOnSdk.pageMod = require('sdk/page-mod').PageMod;
        this.addOnSdk.url = require('sdk/net/url');
        this.addOnSdk.XHR = require('sdk/net/xhr');
        this.addOnSdk.base64 = require('sdk/base64');
        this.addOnSdk.storage = require("sdk/simple-storage").storage;
        this.chrome.mediator = Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator);
        this.chrome.parser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser);
        this.chrome.converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Ci.nsIScriptableUnicodeConverter);
        this.chrome.converter.charset = 'utf-16';

        this.openedTabs = [];
        this.isRTMTabOpened = false;

        this.initExtension();
    },
    initExtension: function initXUL() {
        var _this = this;
        exports.main = function exportsMain(options, callbacks) {
            if(options.loadReason !== 'startup') {
                _this.removeToolbarButton.call(_this);
            }
            _this.addToolbarButton.call(_this);
        };

        exports.onUnload = function exportsOnUnload(reason) {
            _this.removeToolbarButton.call(_this);
        };

        this.addOnSdk.tabs.on('open', function (tab) {
            _this.openedTabs.push(tab);
        });

        this.addOnSdk.tabs.on('close', function (tab) {
            _this.openedTabs.forEach(function(oTab) {
                if(oTab.id === tab.id) {
                    _this.isRTMTabOpened = false;
                }
                _this.openedTabs = [];
            });
        });

        this.addOnSdk.pageMod({
            include: /^resource:\/\/.*\/rootnode-torrent-manager\/.*/,
            contentScriptFile: _this.addOnSdk.self.data.url('js/tab.js'),
            onAttach: function(worker) {
                _this.worker = worker;
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
                    _this.sendAjaxRequest.call(_this, {
                        url: data.url,
                        responseType: 'blob',
                        error: function(response) {
                            worker.port.emit('queueResult', {hash: data.hash, success: false, message: response.response.error});
                        },
                        success: function(response) {
                            if(response.response.type !== 'application/octet-stream') {
                               worker.port.emit('queueResult', {hash: data.hash, success: false, message: 'Cannot get file from torcache.net'});
                            } else {
                                _this.sendAPIRequest.call(_this, {
                                    type: 'create',
                                    data: response.response,
                                    success: function(response) {
                                        worker.port.emit('queueResult', {hash: data.hash, success: true, message: '', authenticated: response.authenticated});
                                    },
                                    error: function(response) {
                                        worker.port.emit('queueResult', {hash: data.hash, success: false, message: response.response.error, authenticated: response.authenticated});
                                    }
                                });
                            }
                        }
                    });
                });

                worker.port.on('queuedTorrents', function() {
                    _this.sendAPIRequest.call(_this, {
                        type: 'index',
                        success: function(response) {
                            worker.port.emit('queuedTorrentsList', response);
                        },
                        error: function(response) {
                            worker.port.emit('queuedTorrentsList', response);
                        }
                    });
                });

                worker.port.on('removeTorrentFromQueue', function(data) {
                    _this.sendAPIRequest.call(_this, {
                        type: 'remove',
                        params: {
                            hash: data.hash
                        },
                        success: function(response) {
                            response.hash = data.hash;
                            worker.port.emit('removedTorrent', response);
                        },
                        error: function(response) {
                            response.hash = data.hash;
                            worker.port.emit('removedTorrent', response);
                        }
                    });
                });

                worker.port.on('validateAuth', function(data) {
                    var initialCheck = data === false;
                    _this.validateAuth.call(_this, {
                        data: data,
                        success: function(response) {
                            worker.port.emit('authenticated', {success: true, message: ''});
                        },
                        error: function(response) {
                            worker.port.emit('authenticated', {success: false, message: _this.STATUS_MAP[response.statusCode], initialCheck: initialCheck});
                        }
                    });
                });

                worker.port.on('getTorrentContents', function(data) {
                    var url = _this.CONTENTSURL + data.path;

                    _this.sendAjaxRequest({
                        url: url,
                        responseType: 'text',
                        success: function(response) {
                            worker.port.emit('torrentContents', response);
                        }
                    });
                });

                worker.port.on('invalidateAuth', function() {
                    _this.invalidateAuth.call(_this);
                    worker.port.emit('unauthenticated');
                });

                worker.port.on('getAuthData', function() {
                    worker.port.emit('authData', _this.getAuthData.call(_this));
                });

                worker.port.on('registerUser', function(data) {
                    var k, q = [];
                    for(k in data) {
                        if(data.hasOwnProperty(k)) {
                            q.push(k + '=' + data[k]);
                        }
                    }
                    _this.sendAPIRequest({
                        type: 'register',
                        contentType: 'application/x-www-form-urlencoded',
                        data: q.join('&'),
                        success: function(response) {
                            worker.port.emit('userRegistered', response.response);
                        },
                        error: function(response) {
                            worker.port.emit('userRegistered', response.response);
                        }
                    });
                });

                worker.port.on('getInviteCodes', function() {
                    _this.sendAPIRequest({
                        type: 'user',
                        success: function(response) {
                            worker.port.emit('listInvites', response.response.invites);
                        },
                        error: function(response) {
                            worker.port.emit('listInvites', []);
                        }
                    });
                });

                worker.port.on('getUserData', function() {
                    _this.sendAPIRequest({
                        type: 'user',
                        success: function(response) {
                            worker.port.emit('userData', response.response);
                        },
                        error: function(response) {
                            worker.port.emit('userData', response.response);
                        }
                    });
                });
            }
        });
    },
    validateAuth: function(options) {
        var defaultOptions = {
            data: this.getAuthData(),
            success: function() {},
            error: function() {}
        };
        this.mergeData(defaultOptions, options);

        this.setAuthData.call(this, options.data);
        this.sendAPIRequest.call(this, {
            type: 'index',
            success: options.success,
            error: options.error
        });
    },
    invalidateAuth: function() {
        this.setAuthData.call(this, false);
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
                    try {
                        torrent = {};
                        torrent.title = a.innerHTML.replace(/<[^>]+>/g, '');
                        torrent.hash = a.getAttribute('href').replace('/', '');
                        torrent.date = items[i].querySelector('.a span').getAttribute('title');
                        torrent.size = items[i].querySelector('.s').innerHTML;
                        torrent.seeds = parseInt(items[i].querySelector('.u').innerHTML.replace(/[^0-9]+/g, ''), 10);
                        torrent.peers = parseInt(items[i].querySelector('.d').innerHTML.replace(/[^0-9]+/g, ''), 10);
                        torrent.added_at = items[i].querySelector('.a span').innerHTML.replace(' ', '&nbsp;');
                        torrents.push(torrent);
                    } catch(e) {}
                }
            }
            callback(torrents, more);
        });
    },
    sendAjaxRequest: function (options) {
        var defaultOptions = {
            method: 'GET',
            url: '/',
            data: null,
            responseType: 'JSON',
            headers: {},
            success: function() {},
            error: function() {}
        };
        var xhr = new (this.addOnSdk.XHR.XMLHttpRequest)();
        options = this.mergeData(defaultOptions, options);
        xhr.open(options.method, options.url, true);
        xhr.responseType = options.responseType;
        for (var h in options.headers) {
            if (options.headers.hasOwnProperty(h)) {
                xhr.setRequestHeader(h, options.headers[h]);
            }
        }
        xhr.onload = function() {
            if (xhr.readyState == 4) {
                if(xhr.response) {
                    options.authenticated = !(xhr.status >= 400);
                    options.statusCode = xhr.status;
                    xhr.response.statusCode = xhr.status;
                    options.success({response: xhr.response, authenticated: options.authenticated, statusCode: options.statusCode});
                } else {
                    options.error({error: 'Internal error', statusCode: xhr.status});
                }
            }
        };
        xhr.send(options.data);
    },
    sendAPIRequest: function(options) {
        var defaultOptions = {
            type: 'create',
            data: null,
            params: null,
            contentType: 'application/octet-stream',
            error: function() {},
            success: function() {}
        };

        var path = this.ENDPOINTS[options.type].path;
        options = this.mergeData(defaultOptions, options);

        if (options.params) {
            for (var d in options.params) {
                if (options.params.hasOwnProperty(d)) {
                    path = path.replace(':' + d, options.params[d]);
                }
            }
        }

        this.sendAjaxRequest.call(this, {
            method: this.ENDPOINTS[options.type].method,
            url: this.APIURL + path,
            data: options.data,
            responseType: 'json',
            headers: {
                'Content-Type': options.contentType,
                // TODO: implement authentication
                'Authorization': 'Basic ' + this.getHttpAuthData.call(this)
            },
            error: options.error,
            success: function(response) {
                if (response.response.error) {
                    options.error(response);
                } else {
                    options.success(response);
                }
            }
        });
    },
    mergeData: function(defaultData, targetData) {
        for (var d in defaultData) {
            if (defaultData.hasOwnProperty(d) && !targetData[d]) {
                targetData[d] = defaultData[d];
            }
        }
        return targetData;
    },
    getAuthData: function() {
        var authData = this.addOnSdk.storage.authData || {login: '', password: ''};
        return authData;
    },
    setAuthData: function(authData) {
        if (!this.addOnSdk.storage.authData) {
            this.addOnSdk.storage.authData = {};
        }
        this.addOnSdk.storage.authData.login = authData.login;
        this.addOnSdk.storage.authData.password = authData.password;
    },
    getHttpAuthData: function() {
        var authData = this.getAuthData();
        return this.addOnSdk.base64.encode(authData.login + ':' + authData.password);
    },

    // Toolbar Buttons
    addToolbarButton: function addToolbarButton() {
    // this document is an XUL document
        var document = this.chrome.mediator.getMostRecentWindow('navigator:browser').document;
        var navBar = document.getElementById('nav-bar');
        var btn = document.createElement('toolbarbutton');
        var menupopup = document.createElement('menupopup');
        var menuSearch = document.createElement('menuitem');
        var menuList = document.createElement('menuitem');
        var menuAccount = document.createElement('menuitem');
        var menuInvites = document.createElement('menuitem');
        var _this = this;

        var openTab = function(path) {
            _this.openedTabs.forEach(function(tab) {
                if(tab.url.match(/^resource:.*rootnode-torrent-manager/)) {
                    _this.isRTMTabOpened = true;
                    tab.activate();
                    tab.url = tab.url.replace(/[^\/]+\.html.*$/, path);
                }
            });

            if (!_this.isRTMTabOpened) {
               _this.addOnSdk.tabs.open(_this.addOnSdk.self.data.url(path));
            }
        };

        if (!navBar) {
            return;
        }

        btn.setAttribute('id', 'rootnode-torrent-manager-toolbar-button');
        btn.setAttribute('type', 'menu-button');
        btn.setAttribute('class', 'toolbarbutton-1');
        btn.setAttribute('image', this.addOnSdk.self.data.url('img/16.png'));
        btn.setAttribute('orient', 'horizontal');
        btn.setAttribute('label', 'RTM');

        menupopup.setAttribute('id', 'rootnode-torrent-manager-menu-popup');

        menuSearch.setAttribute('id', 'rootnode-torrent-manager-menu-search');
        menuSearch.setAttribute('label', 'Search');

        menuList.setAttribute('id', 'rootnode-torrent-manager-menu-list');
        menuList.setAttribute('label', 'Queue');

        menuAccount.setAttribute('id', 'rootnode-torrent-manager-menu-account');
        menuAccount.setAttribute('label', 'Account');

        menuInvites.setAttribute('id', 'rootnode-torrent-manager-menu-invites');
        menuInvites.setAttribute('label', 'Invites');

        menupopup.appendChild(menuSearch);
        menupopup.appendChild(menuList);
        menupopup.appendChild(menuAccount);
        menupopup.appendChild(menuInvites);
        btn.appendChild(menupopup);

        btn.addEventListener('command', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (_this.isRTMTabOpened) {
                openTab('manager.html');
            } else {
                openTab('auth.html');
            }
        }, false);

        menuSearch.addEventListener('command', function(e) {
            e.preventDefault();
            e.stopPropagation();
            openTab('manager.html');
        }, false);

        menuList.addEventListener('command', function(e) {
            e.preventDefault();
            e.stopPropagation();
            openTab('list.html');
        }, false);

        menuInvites.addEventListener('command', function(e) {
            e.preventDefault();
            e.stopPropagation();
            openTab('invites.html');
        }, false);

        menuAccount.addEventListener('command', function(e) {
            e.preventDefault();
            e.stopPropagation();
            openTab('profile.html');
        }, false);

        navBar.appendChild(btn);

    },
    removeToolbarButton: function removeToolbarButton() {
        var document = this.chrome.mediator.getMostRecentWindow('navigator:browser').document,
            navBar = document.getElementById('nav-bar'),
            btn = document.getElementById('rootnode-torrent-manager-toolbar-button');

        if (navBar && btn) {
            navBar.removeChild(btn);
        }
    }
};

rootnodeTorrentManager.init();

