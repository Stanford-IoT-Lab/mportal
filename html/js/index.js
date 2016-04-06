(function() {
    function exitWithMsg(msg) {
        Omlet.exit({ type: 'text', data: { text: msg, hidden: true }});
    }
    function findChecked(elements) {
        var checked = null;
        elements.each(function(i, e) {
            if (e.checked)
                checked = e;
        });
        if (checked !== null)
            return checked.value;
        else
            return null;
    }

    $(function() {
        $('.insert-record-btn').on('click', function() {
            var self = $(this);
            exitWithMsg('(tt:root.command.insert tt:recordtype.' + self.attr('data-recordtype') + ')');
        });
        $('.share-with-btn').on('click', function() {
            var self = $(this);
            exitWithMsg('tt:root.command.share');
        });
        $('#cancer-stage-iv').change(function() {
            var self = $(this);
            if (self.prop('checked'))
                $('#cancer-substage-c').hide();
            else
                $('#cancer-substage-c').show();
        });
        $('#insert-diagnosis-btn').on('click', function() {
            var cancerType = $('#cancer-type').val();
            if (!$('#cancer-type')[0].checkValidity())
                return;
            var cancerStage = findChecked($('input[name="cancer-stage"]'));
            var cancerSubstage = findChecked($('input[name="cancer-substage"]'));
            if (cancerStage === null || cancerSubstage === null)
                return;
            exitWithMsg('((tt:root.command.insertimmediate tt:recordtype.diagnosis) '
                        + '(list (string "' + cancerType + '") (string "' + cancerStage
                        + '") (string "' + cancerSubstage + '")))');
        });
        $('#insert-labresults-btn').on('click', function() {
            var white_blood_cell_count = $('#white-blood-cell-count');
            var hematocrit = $('#hematocrit');
            var hemoglobin = $('#hemoglobin');
            var platelet_count = $('#platelet-count');
            if (!white_blood_cell_count[0].checkValidity() ||
                !hematocrit[0].checkValidity() ||
                !hemoglobin[0].checkValidity() ||
                !platelet_count[0].checkValidity())
                return;
            exitWithMsg('((tt:root.command.insertimmediate tt:recordtype.labresults) '
                        + '(list (number ' + white_blood_cell_count.val() + ') (number '
                        + hematocrit.val() + ') (number ' + hemoglobin.val() + ') '
                        + '(number ' + platelet_count.val() + ')))');
        });
    });
})();
