(function() {
    function exitWithMsg(msg) {
        Omlet.exit({ type: 'text', data: { text: msg, hidden: true }});
    }

    $(function() {
        $('.insert-record-btn').on('click', function() {
            var self = $(this);
            exitWithMsg('(tt:root.command.insert tt:recordtype.' + self.attr('data-recordtype') + ')');
        });
    });
})();
