function runJS() {
    var textt = $('#text-input').val();
    var values = "";
    for (var i=0; i < textt.length; i++) {
        values += textt.charCodeAt(i) + " ";
    }
    $('#text-ascii').val(values);
}

function textToBinary() {
    var textt = $('#text-input2').val();
    var values = [];
    for (var i=0; i < textt.length; i++) {
        values.push(textt.charCodeAt(i));
    }
    var value = "";
    for (var val in values) {
        val = values[val];
        var num = parseInt(val, 10)
        if (num > 0) {
            value += "0";
        }
        value += num.toString(2) + " ";
    }
    $('#text-binary').val(value);
}