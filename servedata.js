var express = require('express')
 , url = require("url")
 , bodyParser = require("body-parser")
 , swagger = require("swagger-node-express")
 , cql = require('node-cassandra-cql')
 , url = require('url')
 , param = require("./node_modules/swagger-node-express/lib/paramTypes.js");

var settingsFile = './settings.js';
try {
    var settings = require(settingsFile);
} catch(err) {
    if (err.code == 'MODULE_NOT_FOUND') {
        console.log("Unable to load settings file "+settingsFile);
    } else {
        console.log(err);
    }
    process.exit();
}
var app = express();
var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', "*");
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
};
app.use(bodyParser.json());
app.use(allowCrossDomain);

// Couple the application to the Swagger module.
swagger.setAppHandler(app);

swagger.addModels({
	"Reading":{
  		"id":"Reading",
  		"required": ["sensor_name", "reading_time", "reading_value"],
        "properties": {
			"sensor_name": {
		  		"type": "string",
		  		"description": "Source of the message (e.g. 'Water Temperature', or 'system' if it is a system message)",
			}, "reading_time": {
				"type": "dateTime",
				"description": "Date and time the message was created"
			}, "reading_value": {
				"type": "string",
				"description": "Content of the message (e.g. '22.6' or 'Reset triggered')"
			},
		},
	},	
});

var client = new cql.Client({
    hosts: ['localhost'],
    keyspace: 'aquaponics'
});

var getAll = {
	'spec': {
        "description" : "Get all data",
	    "path" : "/todmorden/all",
	    "notes" : "Returns all data",
	    "summary" : "Get all data",
         "method": "GET",
	    "parameters" : [{
	        "paramType": "query",
		    "name": "from",
		    "required": false,
		    "type": "string",
		    "description": "Start date",
		    "format": "date",
         }, {
	        "paramType": "query",
		    "name": "to",
		    "required": false,
		    "type": "string",
		    "description": "End date",
		    "format": "date", 
         }, {
	        "paramType": "query",
		    "name":  "limit",
		    "required": false,
		    "type": "integer",
		    "description": "How many records to return (blank = all)", 
         }],
        "type" : "array",
        "items": {
          $ref: "Reading"
        },
	    "errorResponses" : [
		    swagger.errors.invalid('from'), 
		    swagger.errors.invalid('to'),
	    ],
     
	    "nickname" : "getAll"
	},
    action:  function (request, response) { 
        var params = parseRequest(request); 
        // get sensor names
        var cql_names = "select distinct sensor_name from todmorden";
        client.execute(cql_names, function(err, result) {
            if (err) {
	            throw swagger.errors.notFound('sensor names');        
            } else {
                var sensor_names = parseSensorNames(result);
	            getAndSendData(sensor_names, params, response);
            }
        });
	}	
};

var getByCategory = {
	'spec': {
        "description" : "Get data from single category",
	    "path" : "/todmorden",
	    "notes" : "Returns data from specified category",
	    "summary" : "Get data from single category",
        "method": "GET",
	    "parameters" : [
            param.query("category", "Category", "string", true, [
                "Air Pump 1 Current",
                "Water Pump Current",
                "pHradio",
                "Valve Messages",
            ])
        ,{
	        "paramType": "query",
		    "name": "from",
		    "required": false,
		    "type": "string",
		    "description": "Start date",
		    "format": "date",
         }, {
	        "paramType": "query",
		    "name": "to",
		    "required": false,
		    "type": "string",
		    "description": "End date",
		    "format": "date", 
         }, {
	        "paramType": "query",
		    "name":  "limit",
		    "required": false,
		    "type": "integer",
		    "description": "How many records to return (blank = all)", 
         }],
        "type" : "array",
        "items": {
          $ref: "Reading"
        },
	    "errorResponses" : [
		    swagger.errors.invalid('from'), 
		    swagger.errors.invalid('to'),
	    ],
     
	    "nickname" : "getByCategory"
	},
    action:  function (request, response) { 
        var sensor_name = url.parse(request.url,true).query["category"];
        var params = parseRequest(request); 
        var sensor_names = "'"+sensor_name+"'";
        getAndSendData(sensor_names, params, response);
	}	
};


function parseRequest(request) {
	var url_parts = url.parse(request.url, true);
	var qs = url_parts.query;
	return {
        'range': getTimeRange(qs),
        'limit': qs.limit,  
    }
}

function getAndSendData(sensor_names, params, response) {
    var cql = buildCQL(sensor_names, params.range, params.limit);
    client.execute(cql, function(err, result) {
        if (err) {
            throw swagger.errors.notFound('readings');        
        } else {
            response.send(parseResult(result));
        }
    });
}

// parses what is returned from cassandra
function parseResult(result) {
    var data = [];
    var rows = result.rows;
    for (var i = 0; i < rows.length; i++ ) {
        data.push({
            'category': rows[i].sensor_name,
            'time': rows[i].reading_time,
            'value': rows[i].reading_value,
        });
    }
    return data;
}

function buildCQL(sensor_names, range, limit) {
    var cql = "select sensor_name, reading_time, reading_value from todmorden where sensor_name in ("+sensor_names+")";
    if (range) {
        cql += " and reading_time >= '"+range.from+"' and reading_time <= '"+range.to+"'";
    }
    cql +=" order by reading_time desc ";
    if (limit) {
        cql +=" limit "+limit;
    }
    cql += " ALLOW FILTERING"; 
    return cql;
}

function parseSensorNames(sensor_names_result) {
    var names = [];
    var rows = sensor_names_result.rows;
    for (var i = 0; i < rows.length; i++ ) {
        names.push("'"+rows[i].sensor_name+"'");
    }
    return names.join();
};

function getTimeRange(qs) {
	if (typeof qs.from === 'undefined' 
           || typeof qs.to === 'undefined') {
		return false;	
	}
	var from_array = qs.from.split('/');	
	var to_array = qs.to.split('/');
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
swagger.addGet(getAll);
swagger.addGet(getByCategory);
swagger.configure(settings.base_url + ':' + settings.port, "0.1");
app.use(express.static(__dirname + '/node_modules/swagger-node-express/swagger-ui/'));
app.listen(settings.port);
console.log("Aqua API Server running on "+setting.port);
