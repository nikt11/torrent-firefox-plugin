//self.port.emit('validateAuth', false);

var CONTENTSURL = 'https://torrent.rootnode.net/get';
var REFRESH_INTERVAL = 15;

var invokeQuery = function(value) {
    var query = document.getElementById('q');
    value = value === undefined ? query.value : value;
    query.value = decodeURIComponent(value);
    query.setAttribute('readonly', 'readonly');
    query.className = 'loading';
    self.port.emit('getTorrents', query.value);
    window.location.hash = encodeURIComponent(query.value);
};

if (window.location.pathname.match(/manager.html/) && window.location.hash) {
    invokeQuery(window.location.hash.replace(/^#/, ''));
}

// TODO: cleanup

if (window.location.pathname.match(/manager.html/)) {
    self.port.emit('validateAuth', function(response) {
        if(!response.authenticated) {
            window.location.href = 'auth.html';
            return;
        }
    });

    document.getElementById('search').addEventListener('submit', function(e) {
        e.preventDefault();
        invokeQuery();
    });

    document.getElementById('results').addEventListener('click', function(e) {
        if(e.target.parentNode.className == 'download' && e.target.className != 'error' && e.target.className != 'info') {
            e.preventDefault();
            e.target.className = 'button loading';
            self.port.emit('queueTorrent', {url: e.target.getAttribute('href'), hash: e.target.parentNode.getAttribute('id').replace('h-', '')});
        }
    });

    document.getElementById('search').addEventListener('transitionend', function(e) {
        console.log(e);
        if(e.target.className.match(/result/)) {
            e.target.className += ' complete';
        }
    }, false);
}

if (window.location.pathname.match(/list.html/)) {
    var resizeBars = function() {
        Array.prototype.slice.call(document.getElementById('results').querySelectorAll('.progress .text')).forEach(function(p) {
            p.style.width = p.parentNode.parentNode.offsetWidth.toString() + 'px';
        });
    };

    document.body.parentNode.className = 'page-loading';

    self.port.emit('queuedTorrents');
    setInterval(function() {
        self.port.emit('queuedTorrents');
    }, 1 * REFRESH_INTERVAL * 1000);

    document.getElementById('results').addEventListener('click', function(e) {
        if(!e.target.parentNode.className.match('disabled')) {
            if(e.target.parentNode.className.match('remove')) {
                e.preventDefault();
                self.port.emit('removeTorrentFromQueue', {hash: e.target.parentNode.parentNode.getAttribute('id').replace(/^h-/, '')});
            }
        }
    });

    window.addEventListener('resize', resizeBars);
}

if (window.location.pathname.match(/auth.html/)) {
    document.body.parentNode.className = 'page-loading';
    self.port.emit('validateAuth', false);

    document.getElementById('auth').addEventListener('submit', function(e) {
        var submitButton = document.getElementById('submit-auth');
        e.preventDefault();
        submitButton.className += ' loading';
        document.getElementById('auth').className = '';
        if(submitButton.className.match(/register/)) {
            self.port.emit('registerUser', {
                name: document.getElementById('login').value,
                mail: document.getElementById('email').value,
                invite_key: document.getElementById('invitekey').value
            });
        } else {
            self.port.emit('validateAuth', {
                login: document.getElementById('login').value,
                password: document.getElementById('password').value
            });
        }
    });

    document.getElementById('link-register').addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('link-signin').style.display = 'inline';
        document.getElementById('link-register').style.display = 'none';
        document.getElementById('register').className = 'form-group';
        document.getElementById('signin').className = 'form-group invisble';
        document.getElementById('password').setAttribute('tabindex', '99');
        document.getElementById('submit-auth').textContent = 'Register';
        document.getElementById('submit-auth').className = 'button register';
    });

    document.getElementById('link-signin').addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('link-register').style.display = 'inline';
        document.getElementById('link-signin').style.display = 'none';
        document.getElementById('password').setAttribute('tabindex', '2');
        document.getElementById('signin').className = 'form-group';
        document.getElementById('register').className = 'form-group invisble';
        document.getElementById('submit-auth').textContent = 'Login';
        document.getElementById('submit-auth').className = 'button signin';
    });
}

if (window.location.pathname.match(/view.html/)) {
    var path = window.location.search.replace(/^\?/, '/');

    self.port.emit('getTorrentContents', {path: path});
}

if (window.location.pathname.match(/invites.html/)) {
    document.body.parentNode.className = 'page-loading';
    self.port.emit('getInviteCodes');
}

if (window.location.pathname.match(/profile.html/)) {
    document.body.parentNode.className = 'page-loading';
    self.port.emit('getUserData');
}

self.port.on('userRegistered', function(data) {
    if(data.error) {
        document.getElementById('auth').className = 'shake';
        document.getElementById('submit-auth').className = 'button register';
        document.getElementById('login-error').style.display = 'block';
        document.getElementById('login-error').className = '';
        document.getElementById('login-error-message').innerHTML = data.error;
    } else {
        document.getElementById('login-error').style.display = 'block';
        document.getElementById('login-error-message').innerHTML = 'Your password is <b>' + data.password + '</b>';
        document.getElementById('login-error').className = 'valid';
        document.getElementById('link-register').style.display = 'inline';
        document.getElementById('link-signin').style.display = 'none';
        document.getElementById('password').setAttribute('tabindex', '2');
        document.getElementById('signin').className = 'form-group';
        document.getElementById('register').className = 'form-group invisble';
        document.getElementById('submit-auth').textContent = 'Login';
        document.getElementById('submit-auth').className = 'button signin';
    }
});

self.port.on('userData', function(userData) {
    var results = document.getElementById('results');
    var res = results.querySelector('tbody');
    var rows = '';
    var payments = userData.payments;

    res.innerHTML = '';

    document.getElementById('userDataName').textContent = userData.name;
    document.getElementById('userDataEmail').textContent = userData.mail;
    document.getElementById('userDataExpires').textContent = userData.expires_at;

    if (payments.length === 0) {
        rows += '<tr class="noitems"><td colspan="4">No payments.</td></tr>';
    }

    for(var p = 0; p < payments.length; p += 1) {
        rows += '<tr>';
        rows += '<td class="title">' + payments[p].paid_at + '</td>';
        rows += '<td class="size">' + payments[p].price + '&nbsp;' + payments[p].currency + '</td>';
        rows += '<td class="size">' + payments[p].last_expires_at + '</td>';
        rows += '<td class="size">' + payments[p].next_expires_at + '</td>';
        rows += '</tr>';
    }
    res.innerHTML += rows;
    document.body.parentNode.className = '';
});

self.port.on('listInvites', function(invites) {
    var results = document.getElementById('results');
    var res = results.querySelector('tbody');
    var rows = '';

    res.innerHTML = '';

    if (invites.length === 0) {
        rows += '<tr class="noitems"><td colspan="2">No invite codes available at the moment.</td></tr>';
    }

    for(var i = 0; i < invites.length; i += 1) {
        rows += '<tr class="expired' + (invites[i].is_expired === '1' ? '' : ' not') + '">';
        rows += '<td class="title">' + invites[i].invite_key + '</td>';
        rows += '<td class="size">' + (invites[i].mail ? invites[i].mail : '') + '</td>';
        rows += '</tr>';
    }
    res.innerHTML += rows;
    document.body.parentNode.className = '';
});

self.port.on('torrentContents', function(response) {
    var div = document.createElement('div');
    var browser = document.getElementById('browser');
    var list = document.createElement('ul');
    var li;

    html = response.response;

    div.innerHTML = html;

    li = document.createElement('li');
    li.innerHTML = '<i class="fa fa-share"></i> Share link: <a href="' + CONTENTSURL + window.location.search.replace(/\/.*/, '').replace('?', '/') + '">' + CONTENTSURL + window.location.search.replace(/\/.*/, '').replace('?', '/') + '</a>';
    li.className = 'share';
    if(html.authenticated) {
        list.appendChild(li);
    }

    li = document.createElement('li');
    li.innerHTML = '<a href="list.html"><i class="fa fa-list"></i> Back to List</a>';
    list.appendChild(li);

    console.log(response);
    if(!response.authenticated) {
        li = document.createElement('li');
        li.className = 'noitems';

        switch(response.statusCode) {
            case 410:
                li.innerHTML = 'Resource has expired.';
                break;
            case 403:
                li.innerHTML = 'Resource has been blocked.';
                break;
            default:
                li.innerHTML = 'Resource is temporary unavailable.';
        }

        list.appendChild(li);
        browser.appendChild(list);
        return;
    }

    Array.prototype.slice.call(div.querySelectorAll('tbody tr')).forEach(function(row) {
        var link = row.querySelector('td a');
        var size = row.querySelector('tr td:first-child + td').innerHTML;
        var li = document.createElement('li');
        li.className = 'ohi hobar';
        var href = link.getAttribute('href');

        if (href.slice(-1) == '/') {
            typeClass = 'fa-folder';
        } else {
            switch (href.toLowerCase().match(/[^\.]*$/)[0]) {
                case '7z':
                case 'ace':
                case 'arj':
                case 'bz2':
                case 'gz':
                case 'lha':
                case 'rar':
                case 'tar':
                case 'uha':
                case 'xz':
                case 'z':
                case 'zoo':
                case 'zip':
                    typeClass = 'fa-archive';
                    break;
                case 'iso':
                case 'nrg':
                case 'img':
                case 'cdi':
                case 'cue':
                case 'ccd':
                    typeClass = 'fa-save';
                    break;
                case 'doc':
                case 'docm':
                case 'docx':
                case 'gdoc':
                case 'htm':
                case 'html':
                case 'lwp':
                case 'mcw':
                case 'odm':
                case 'odt':
                case 'ott':
                case 'omm':
                case 'pages':
                case 'pdf':
                case 'rtf':
                case 'sdw':
                case 'stw':
                case 'sxw':
                case 'tex':
                case 'info':
                case 'txt':
                case 'wri':
                case 'xhtml':
                case 'xml':
                case 'xps':
                    typeClass = 'fa-file-text-o';
                    break;
                case 'azw':
                case 'epub':
                case 'mobi':
                    typeClass = 'fa-book';
                    break;
                case 'abf':
                case 'afm':
                case 'bdf':
                case 'bmf':
                case 'eot':
                case 'fnt':
                case 'fon':
                case 'mgf':
                case 'otf':
                case 'pcf':
                case 'pfa':
                case 'pfb':
                case 'pfm':
                case 'afm':
                case 'fond':
                case 'sfd':
                case 'snf':
                case 'tdf':
                case 'tfm':
                case 'ttf':
                case 'ttc':
                case 'woff':
                    typeClass = 'fa-font';
                    break;
                case 'art':
                case 'ai':
                case 'bmp':
                case 'gif':
                case 'ico':
                case 'jpeg':
                case 'jpg':
                case 'jp2':
                case 'pcx':
                case 'png':
                case 'psd':
                case 'raw':
                case 'svg':
                case 'tga':
                case 'tif':
                case 'tiff':
                case 'wmf':
                case 'xcf':
                    typeClass = 'fa-picture-o';
                    break;
                case 'bat':
                case 'cmd':
                case 'com':
                case 'exe':
                case 'msi':
                    typeClass = 'fa-windows';
                    break;
                case 'aac':
                case 'asx':
                case 'flac':
                case 'm3u':
                case 'm4a':
                case 'mid':
                case 'mod':
                case 'mp2':
                case 'mp3':
                case 'ogg':
                case 'pls':
                case 'sng':
                case 'wav':
                case 'wma':
                    typeClass = 'fa-music';
                    break;
                case '123':
                case 'csv':
                case 'gsheet':
                case 'gnumeric':
                case 'ods':
                case 'ots':
                case 'qpw':
                case 'sdc':
                case 'stc':
                case 'sxc':
                case 'wk1':
                case 'wk3':
                case 'wk4':
                case 'wks':
                case 'wq1':
                case 'xlk':
                case 'xls':
                case 'xlsb':
                case 'xlsm':
                case 'xlsx':
                case 'xlr':
                case 'xlt':
                case 'xltm':
                case 'xlw':
                    typeClass = 'fa-table';
                    break;
                case 'aaf':
                case '3gp':
                case 'asf':
                case 'avchd':
                case 'avi':
                case 'cam':
                case 'flv':
                case 'm1v':
                case 'm2v':
                case 'm4v':
                case 'mkv':
                case 'mov':
                case 'mp4':
                case 'mpe':
                case 'mpeg':
                case 'mpg':
                case 'ogv':
                case 'rm':
                case 'swf':
                case 'wmv':
                    typeClass = 'fa-film';
                    break;
                default:
                    typeClass = 'fa-file-o';
                    break;
            }
        }

        var append = true;
        var isFile = false;
        if (href.match(/^\.\./)) {
            if (window.location.search.match(/\?[^\/]+\/*$/)) {
                append = false;
            }
            href = window.location.search.replace(/[^\/]+\/?$/, '');
        } else {
            if (href.match(/\/$/)) {
                // folder
                href = window.location.search + '/' + href;
            } else {
                // file
                href = CONTENTSURL + (window.location.search.replace(/^\?/, '/') + '/' + href).replace(/\/\//g, '/');
                isFile = true;
            }
        }

        if (append) {
            link.setAttribute('href', href);
            link.className = 'filename';
            link.innerHTML = '<i class="fa ' + typeClass + '"></i>' + link.innerHTML;
            li.appendChild(link);
            li.innerHTML += size;
            if (isFile) {
                li.innerHTML += ' <a class="right" href="' + href + '?download=1" download><i class="fa fa-download"></i></a>';
            }
            if (typeClass == 'fa-film' || typeClass == 'fa-music') {
                li.innerHTML += ' <a class="right" href="data:application/x-mpegur;base64,' + btoa("#EXTM3U\n" + href) + '" download="' + href.replace(/.*\//, '').replace(/\.[^\.]*$/, '') + '.m3u"><i class="fa fa-play-circle"></i></a>';
            }
            list.appendChild(li);
        }
    });

    browser.appendChild(list);

});

self.port.on('torrentsList', function(list) {
    var query = document.getElementById('q');
    var search = document.getElementById('search');
    var results = document.getElementById('results');
    var res = results.querySelector('tbody');
    var rows = '';
    query.removeAttribute('readonly');
    query.className = '';
    search.className = search.className.match(/complete/) ? 'results complete' : 'results';
    results.className = 'visible';
    document.body.parentNode.className = '';

    res.innerHTML = '';

    if (list.length === 0) {
        rows += '<tr class="noitems"><td colspan="5">No results found for this query.<br>Maybe <a href="#" onclick="window.location.href = \'manager.html\'">Try another one</a>?</td></tr>';
    }

    for(var l = 0; l < list.length; l += 1) {
        rows += '<tr>';
        rows += '<td class="title"><a href="http://torrentz.eu/' + list[l].hash + '" target="_blank">' + list[l].title + '</a></td>';
        rows += '<td class="size">' + list[l].size.replace(' ', '') + '</td>';
        rows += '<td class="size"><span class="seeds">' + list[l].seeds + '</span>&nbsp;/&nbsp;<span class="peers">' + list[l].peers + '</span></td>';
        rows += '<td class="size">' + list[l].added_at + '</td>';
        rows += '<td class="download" id="h-' + list[l].hash + '"><a href="http://torcache.net/torrent/' + list[l].hash + '.torrent" class="button">Download</a></td>';
        rows += '</tr>';
    }
    res.innerHTML += rows;
});

self.port.on('queueResult', function(result) {
    var item = document.getElementById('h-' + result.hash);
    if(item) {
        if(result.success) {
            item.innerHTML = '<span class="info">Queued</span>';
        } else {
            item.innerHTML = '<span class="error"><abbr title="' + result.message + '" style="font-weight: bold;">Failed</abbr></span>';
        }
    }
});

var normalize = function(bytes) {
    var normalized = bytes;
    var prefixes = ['', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
    var p = 0;
    while (normalized > 1024) {
        p += 1;
        normalized = Math.round(normalized / 1024 * 10) / 10;
    }

    return normalized + prefixes[p] + 'B';
};

self.port.on('queuedTorrentsList', function(list) {
    var results = document.getElementById('results');
    var res = results.querySelector('tbody');
    var rows = '';
    var bytes_done;
    var size_bytes;
    var eta, eta_h = 0, eta_m = 0;
    if (!list.authenticated) {
        window.location.href = 'auth.html';
        return;
    }
    list = list.response;

    document.body.parentNode.className = '';

    res.innerHTML = '';

    if (list.length === 0) {
        rows += '<tr class="noitems"><td colspan="3">No queued torrents at the moment.<br>Maybe, <a href="manager.html">try another query</a>?</td></tr>';
    }


    for(var l = 0; l < list.length; l += 1) {
        bytes_done = normalize(list[l].bytes_done);
        size_bytes = normalize(list[l].size_bytes);
        down_rate = normalize(list[l].down_rate);
        eta = parseInt((list[l].size_bytes - list[l].bytes_done) / (list[l].down_rate < 1 ? 1 : list[l].down_rate), 10);

        if (eta > 3600) {
            eta_h = parseInt(eta / 3600, 10);
            eta = eta % 3600;
        }
        if (eta > 60) {
            eta_m = parseInt(eta / 60, 10);
            eta = eta % 60;
        }

        eta = (eta_h > 0 ? eta_h + 'h ' : '') + (eta_m > 0 ? eta_m + 'm ' : '') + (isNaN(eta) ? 0 : eta) + 's';


        added_at = new Date(Date.parse(list[l].added_at.replace(' ', 'T'))).toGMTString().replace(/([0-9]) ([0-9])/, '$1<br>$2');
        rows += '<tr>';
        rows += '<td class="title"><a href="view.html?' + list[l].url_hash + '" class="download' + (list[l].bytes_done !== list[l].size_bytes ? ' disabled' : '') + '">' + list[l].name + '</a> <span style="display: block; font-size: 12px;"><a href="http://torrentz.eu/' + list[l].hash + '" target="_blank">hash:&nbsp;' + list[l].hash + '</a></span></td>';

        if (list[l].bytes_done == list[l].size_bytes) {
            rows += '<td class="bar"><div class="progress">' + bytes_done + ' / ' + size_bytes + ' (' + down_rate + '/s)<div class="bar" style="width: ' + (list[l].bytes_done / list[l].size_bytes * 100) + '%"><div class="text">' + bytes_done + ' / ' + size_bytes + ' (complete)</div></div></div></td>';
        } else {
            rows += '<td class="bar"><div class="progress">' + bytes_done + ' / ' + size_bytes + ' (' + down_rate + '/s' + (list[l].down_rate > 0 ? ', ' + eta + ' remaining' : '') + ')<div class="bar" style="width: ' + (list[l].bytes_done / list[l].size_bytes * 100) + '%"><div class="text">' + bytes_done + ' / ' + size_bytes + ' (' + down_rate + '/s' + (list[l].down_rate > 0 ? ', ' + eta + ' remaining' : '') + ')</div></div></div></td>';
        }

        //rows += '<td class="size" style="font-size: 12px;">' + added_at + '</td>';
        rows += '<td class="actions" id="h-' + list[l].hash + '"><a href="#" class="remove"><i class="fa fa-times"></i></a></td>';
        rows += '</tr>';
        /*if (list[l].bytes_done == list[l].size_bytes) {
            rows += '<tr class="pbar"><td colspan="4"><div class="progress">' + bytes_done + ' / ' + size_bytes + ' (' + down_rate + '/s)<div class="bar" style="width: ' + (list[l].bytes_done / list[l].size_bytes * 100) + '%"><div class="text">' + bytes_done + ' / ' + size_bytes + ' (complete)</div></div></div></td></tr>';
        } else {
            rows += '<tr class="pbar"><td colspan="4"><div class="progress">' + bytes_done + ' / ' + size_bytes + ' (' + down_rate + '/s' + (list[l].down_rate > 0 ? ', ' + eta + ' remaining' : '') + ')<div class="bar" style="width: ' + (list[l].bytes_done / list[l].size_bytes * 100) + '%"><div class="text">' + bytes_done + ' / ' + size_bytes + ' (' + down_rate + '/s' + (list[l].down_rate > 0 ? ', ' + eta + ' remaining' : '') + ')</div></div></div></td></tr>';
        }*/
    }
    res.innerHTML += rows;
    resizeBars();
});

self.port.on('removedTorrent', function(response) {
    var row;
    if(!response.error && response.hash) {
        row = document.getElementById('h-' + response.hash).parentNode;
        row.className = 'hidden';
        setTimeout(function() {
            self.port.emit('queuedTorrents');
        }, 1000);
    }
});

self.port.on('authenticated', function(response) {
    if(window.location.pathname.match(/auth.html/)) {
        if(response.success) {
            window.location.href = 'manager.html';
        } else {
            if (!response.initialCheck) {
                document.getElementById('auth').className = 'shake';
                document.getElementById('submit-auth').className = 'button';
                document.getElementById('login-error').style.display = 'block';
                document.getElementById('login-error').className = '';
                document.getElementById('login-error-message').innerHTML = response.message;
            }
        }
    } else {
        if(!response.success) {
            window.location.href = 'auth.html';
        }
    }

    document.body.parentNode.className = '';
});

self.port.on('unauthenticated', function() {
    window.location.href = 'auth.html';
});

self.port.on('authData', function(response) {
    if(response && document.getElementById('username')) {
        document.getElementById('username').textContent = response.login;
    }
});

/* Global event observers */

if(document.getElementById('signout')) {
    document.getElementById('signout').addEventListener('click', function(e) {
        e.preventDefault();
        document.body.parentNode.className = 'page-loading';
        self.port.emit('invalidateAuth');
    });
}

self.port.emit('getAuthData');
