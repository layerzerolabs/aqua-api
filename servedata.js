var express = require('express');
var cql = require('node-cassandra-cql');
var app = express();
var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', "*");
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
};

app.use(allowCrossDomain);

var client = new cql.Client({
    hosts: ['localhost'],
    keyspace: 'aquaponics'
});

app.get("/todmorden", function (request, response) {
		var range = getTimeRange(request);
    var cql = "select sensor_name, reading_time, reading_value from todmorden where reading_time >= '"+range.from+"' and reading_time <= '"+range.to+"' ALLOW FILTERING";
    client.execute(cql, function(err, result){
        if (err) {
            response.send(err);
        } else {
            response.send(result);
        }
    });
});

app.get("/todmorden/:arg0", function (request, response) {
		var range = getTimeRange(request);
    var cql = "select * from todmorden where sensor_name = ? and reading_time >= '"+range.from+"' and reading_time <= '"+range.to+"' ALLOW FILTERING";
    client.execute(cql, [request.params.arg0], function(err, result){
        if (err) {
            response.send(err);
        } else {
            response.send(result);
        }
    });
});

function getTimeRange(request) {
	var url = require('url');
	var url_parts = url.parse(request.url, true);
	var from_array = url_parts.query.from.split('/');	
	var to_array = url_parts.query.to.split('/');
	var from;
	var to;
	if (from_array.length !== 3) {
		from = "2014-06-26";
	} else {
		from = from_array[2]+'-'+from_array[1]+'-'+from_array[0];
	}	
	if (to_array.length !== 3) {
	        to = nextDayString(new Date());
	} else {
		to = nextDayString(new Date(to_array[2]+'-'+to_array[1]+'-'+to_array[0]));
	}
	return {
		'from': from,
		'to': to,
  	};
};

// Used for adding a day to the "to" date so that
// the range ends at the end of that day.
// Takes date object, returns a string Y-M-D
function nextDayString(date_obj) {
	date_obj.setDate(date_obj.getDate() + 1);
	return date_obj.getFullYear()+'-'+(date_obj.getMonth() + 1)+'-'+date_obj.getDate();
}

app.listen(8003);
console.log("Aqua API Server running on 8003");
