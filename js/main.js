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
var voltagesGlobal_NRZI = [];
function textToVoltages() {
    var textt = $('#text-input3').val();
    var values = [];
    for (var i=0; i < textt.length; i++) {
        values.push(textt.charCodeAt(i));
    }
    voltagesGlobal_NRZI = [];
    var value = "";
    for (var val in values) {
        val = values[val];
        var num = parseInt(val, 10);
        if (num > 0) {
            value += "0";
        }
        value += num.toString(2) + " ";
    }
    var voltages = [];
    var bits = value.split(" ");
    for (var byte in bits) {
        var bitArr = bits[byte].split("");
        var voltArr = [];
        for (var bit in bitArr) {
            if (parseInt(bitArr[bit]) > 0) {
                voltArr.push(.5);
                voltagesGlobal_NRZI.push(.5);
            } else {
                voltArr.push(.2);
                voltagesGlobal_NRZI.push(.2);
            }
        }
        if (voltArr.length > 0) {
            console.log("Pushed voltArr: " + voltArr);
            voltages.push(voltArr);
        }
    }
    graphNRZI();
    graphNRZICustom();
    $('#text-voltage').val(JSON.stringify(voltages));
}
function voltageToText() {
    var textt = $('#text-input4').val();
    var volts = JSON.parse(textt);
}
function graphNRZICustom() {
    var canvas = document.getElementById('NRZI-graph-custom');
    var ctx = document.getElementById('NRZI-graph-custom').getContext('2d');
    var clockSpacing = canvas.width / voltagesGlobal_NRZI.length;
    var count = 0;
    for (var voltInd in voltagesGlobal_NRZI) {
        ctx.moveTo(count + clockSpacing, 0);
        ctx.lineTo(count + clockSpacing, canvas.height);
        ctx.stroke();
        count = count + clockSpacing + clockSpacing;
    }
}
function graphNRZI() {
    var ctx = document.getElementById('NRZI-graph').getContext('2d');
    var labels_data = [];
    for (var i = 0; i < voltagesGlobal_NRZI.length; i++) {
        var volt = voltagesGlobal_NRZI[i];
        labels_data.push("Clock Pulse");
    }
    var myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels_data,
            datasets: [{
                label: 'NRZI voltages',
                data: voltagesGlobal_NRZI,
                /** /
                 backgroundColor: [
                 'rgba(255, 99, 132, 0.2)',
                 'rgba(54, 162, 235, 0.2)',
                 'rgba(255, 206, 86, 0.2)',
                 'rgba(75, 192, 192, 0.2)',
                 'rgba(153, 102, 255, 0.2)',
                 'rgba(255, 159, 64, 0.2)'
                 ],
                 borderColor: [
                 'rgba(255, 99, 132, 1)',
                 'rgba(54, 162, 235, 1)',
                 'rgba(255, 206, 86, 1)',
                 'rgba(75, 192, 192, 1)',
                 'rgba(153, 102, 255, 1)',
                 'rgba(255, 159, 64, 1)'
                 ],
                 /**/
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                yAxes: [{
                    ticks: {
                        beginAtZero: true,
                        min: 0.15,
                        max: 0.55,
                    }
                }]
            }
        }
    });
}