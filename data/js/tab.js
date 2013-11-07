document.getElementById('search').addEventListener('submit', function(e) {
    var query = document.getElementById('q');
    e.preventDefault();
    query.setAttribute('readonly', 'readonly');
    query.className = 'loading';
    self.port.emit('getTorrents', query.value);
});

document.getElementById('results').addEventListener('click', function(e) {
    e.preventDefault();
    if(e.target.parentNode.className == 'download') {
        e.target.className = 'loading';
        self.port.emit('queueTorrent', {url: e.target.getAttribute('href'), hash: e.target.parentNode.getAttribute('id').replace('h-', '')});
    }
});

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
            item.innerHTML = '<span class="error">Failed!</span>';
        }
    }
});
