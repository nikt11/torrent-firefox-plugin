self.port.emit('validateAuth', false);

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
    document.getElementById('search').addEventListener('submit', function(e) {
        e.preventDefault();
        invokeQuery();
    });

    document.getElementById('results').addEventListener('click', function(e) {
        e.preventDefault();
        if(e.target.parentNode.className == 'download') {
            e.target.className = 'button loading';
            self.port.emit('queueTorrent', {url: e.target.getAttribute('href'), hash: e.target.parentNode.getAttribute('id').replace('h-', '')});
        }
    });
}

if (window.location.pathname.match(/list.html/)) {
    var resizeBars = function() {
        Array.prototype.slice.call(document.querySelectorAll('.pbar .bar .text')).forEach(function(bar) {bar.style.width = bar.parentNode.parentNode.offsetWidth + 'px'; });
    };

    self.port.emit('queuedTorrents');
    setInterval(function() {
        self.port.emit('queuedTorrents');
    }, 1 * 60 * 1000);

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

    document.getElementById('auth').addEventListener('submit', function(e) {
        e.preventDefault();
        document.getElementById('submit-auth').className = 'button loading';
        document.getElementById('auth').className = '';
        self.port.emit('validateAuth', {
            login: document.getElementById('login').value,
            password: document.getElementById('password').value
        });
    });
}

if (window.location.pathname.match(/view.html/)) {
    setInterval(function() {
        console.log('x', window.frameElement, 'y');
    }, 1000);
}

self.port.on('torrentsList', function(list) {
    var query = document.getElementById('q');
    var search = document.getElementById('search');
    var results = document.getElementById('results');
    var res = results.querySelector('tbody');
    var rows = '';
    query.removeAttribute('readonly');
    query.className = '';
    search.className = 'results';
    results.className = 'visible';

    res.innerHTML = '';

    if (list.length === 0) {
        rows += '<tr class="noitems"><td colspan="5">No results found for this query.<br>Maybe <a href="#" onclick="window.location.href = \'manager.html\'">Try another one</a>?</td></tr>';
    }

    for(var l = 0; l < list.length; l += 1) {
        rows += '<tr>';
        rows += '<td class="title"><a href="http://torrents.eu/' + list[l].hash + '" target="_blank">' + list[l].title + '</a></td>';
        rows += '<td class="size">' + list[l].size.replace(' ', '') + '</td>';
        rows += '<td class="seeds">' + list[l].seeds + '</td>';
        rows += '<td class="peers">' + list[l].peers + '</td>';
        rows += '<td class="download" id="h-' + list[l].hash + '"><a href="http://torcache.net/torrent/' + list[l].hash + '.torrent" class="button">Download!</a></td>';
        rows += '</tr>';
    }
    res.innerHTML += rows;
});

self.port.on('queueResult', function(result) {
    var item = document.getElementById('h-' + result.hash);
    if(item) {
        if(result.success) {
            item.innerHTML = '<span>Queued!</span>';
        } else {
            item.innerHTML = '<span class="error">Failed!&nbsp;<abbr title="' + result.message + '">?</abbr></span>';
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

    res.innerHTML = '';

    if (list.length === 0) {
        rows += '<tr class="noitems"><td colspan="3">No queued torrents at the moment.<br>Maybe, <a href="manager.html">try another query</a>?</td></tr>';
    }

    for(var l = 0; l < list.length; l += 1) {
        bytes_done = normalize(list[l].bytes_done);
        size_bytes = normalize(list[l].size_bytes);
        down_rate = normalize(list[l].down_rate);
        added_at = new Date(Date.parse(list[l].added_at.replace(' ', 'T'))).toGMTString().replace(/([0-9]) ([0-9])/, '$1<br>$2');
        rows += '<tr class="pbar"><td colspan="3"><div class="progress">' + bytes_done + ' / ' + size_bytes + ' (' + down_rate + '/s)<div class="bar" style="width: ' + (list[l].bytes_done / list[l].size_bytes * 100) + '%"><div class="text">' + bytes_done + ' / ' + size_bytes + ' (' + down_rate + '/s)</div></div></div></td></tr>';
        rows += '<tr>';
        rows += '<td class="title">' + list[l].name + '</td>';
        rows += '<td class="peers">' + added_at + '</td>';
        rows += '<td class="actions" id="h-' + list[l].hash + '"><a href="#" class="download' + (list[l].bytes_done !== list[l].size_bytes ? ' disabled' : '') + '"><i class="fa fa-download"></i></a> <a href="#" class="remove"><i class="fa fa-times"></i></a></td>';
        rows += '</tr>';
    }
    res.innerHTML += rows;
    resizeBars();
});

self.port.on('removedTorrent', function(response) {
    var row;
    if(!response.error && response.hash) {
        row = document.getElementById('h-' + response.hash).parentNode;
        row.className = 'hidden';
        row.previousSibling.className = 'pbar hidden';
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
