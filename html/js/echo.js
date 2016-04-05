Omlet.ready(function() {
    var hash = decodeURIComponent(document.location.hash.substring(1));
    Omlet.exit({ type: 'text', data: { text: hash, hidden: true }});
})
