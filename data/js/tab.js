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
            e.target.className = 'loading';
            self.port.emit('queueTorrent', {url: e.target.getAttribute('href'), hash: e.target.parentNode.getAttribute('id').replace('h-', '')});
        }
    });
}

if (window.location.pathname.match(/list.html/)) {
    self.port.emit('queuedTorrents');
    setInterval(function() {
        self.port.emit('queuedTorrents');
    }, 1 * 60 * 1000);

    document.getElementById('results').addEventListener('click', function(e) {
        e.preventDefault();
        if(e.target.className.match('remove')) {
            self.port.emit('removeTorrentFromQueue', {hash: e.target.parentNode.getAttribute('id').replace(/^h-/, '')});
        }
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

    for(var l = 0; l < list.length; l += 1) {
        rows += '<tr>';
        rows += '<td class="title"><a href="http://torrents.eu/' + list[l].hash + '" target="_blank">' + list[l].title + '</a></td>';
        rows += '<td class="size">' + list[l].size.replace(' ', '') + '</td>';
        rows += '<td class="seeds">' + list[l].seeds + '</td>';
        rows += '<td class="peers">' + list[l].peers + '</td>';
        rows += '<td class="download" id="h-' + list[l].hash + '"><a href="http://torcache.net/torrent/' + list[l].hash + '.torrent">Download!</a></td>';
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

self.port.on('queuedTorrentsList', function(list) {
    var results = document.getElementById('results');
    var res = results.querySelector('tbody');
    var rows = '';

    res.innerHTML = '';

    for(var l = 0; l < list.length; l += 1) {
        rows += '<tr>';
        rows += '<td class="title">' + list[l].name + '</td>';
        rows += '<td class="size">' + list[l].size_bytes + '</td>';
        rows += '<td class="seeds">' + list[l].bytes_done + '</td>';
        rows += '<td class="peers">' + list[l].added_at + '</td>';
        rows += '<td class="download">' + list[l].down_rate + '</td>';
        rows += '<td class="actions" id="h-' + list[l].hash + '"><a href="#" class="remove">Remove</a></td>';
        rows += '</tr>';
    }
    res.innerHTML += rows;

});

self.port.on('removedTorrent', function(response) {
    var row;
    if(!response.error && response.hash) {
        row = document.getElementById('h-' + response.hash).parentNode;
        row.className = 'hidden';
        setTimeout(function() {
            row.parentNode.removeChild(row);
        }, 1000);
    }
});
