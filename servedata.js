var express = require('express')
 , url = require("url")
 , bodyParser = require("body-parser")
 , swagger = require("swagger-node-express")
 , mysql = require('mysql')
 , url = require('url')

var settingsFile = './settings.js';
var dbFile = './dbconf.js';

//Doesn't require throw anyway?
try {
    var settings = require(settingsFile);
    var dbsettings = require(dbFile);
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

app.get('/settings.js', function(req, res){
     res.sendfile('./client-settings.js');
});

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
         }, 
         "reading_time": {
            "type": "dateTime",
            "description": "Date and time the message was created"
         }, 
         "reading_value": {
            "type": "string",
            "description": "Content of the message (e.g. '22.6' or 'Reset triggered')"
         },
      },
   },
});
var connection = mysql.createConnection({
         host     : dbsettings.host,
         user     : dbsettings.user,
         password : dbsettings.password,
         database : dbsettings.database
});

var getAll = {
   'spec': {
         "description" : "Get all data",
         "path" : "/todmorden/all",
         "notes" : "Returns all data from all sensors and all messages.\
 Parameter dates are accepted in local time, data is returned in UTC.\
 An optional limit is accepted and returns the most recent records.\
 Data is measured for some sensors every second, and for others every 10 minutes.\
 However data is only recorded on change, apart from at 00.05, when all data is recorded.",
         "summary" : "Get all data",
         "method": "GET",
         "parameters" : [{
	        "paramType": "query",
		    "name": "from",
		    "required": false,
		    "type": "string",
		    "description": "Start date - DD/MM/YYYY",
		    "format": "date",
         }, {
	        "paramType": "query",
		    "name": "to",
		    "required": false,
		    "type": "string",
		    "description": "End date - DD/MM/YYYY",
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
        var sql_names = "select distinct sensor_name from todmorden";
        try {
            connection.query(sql_names, function(err, rows, fields) {
            if (err) {
               throw swagger.errors.notFound('sensor names');        
            } else {
               var sensor_names = parseSensorNames(rows);
               getAndSendData(sensor_names, params, response);
            }
         });
         } catch(e) {
            console.log('Error in sensor names query: '+e.message);
            response.send('Error - see API log');
        }
    }
};

var getByCategory = {
	'spec': {
        "description" : "Get data from single category",
	"path" : "/todmorden",
	"notes" : "Returns data from specified category (sensor or message type)\
 Parameter dates are accepted in local time, data is returned in UTC.\
 An optional limit is accepted and returns the most recent records.\
 Data is measured for some sensors every second, and for others every 10 minutes.\
 However data is only recorded on change, apart from at 00.05, when all data is recorded.",
        "method": "GET",
        "parameters" : [
            
            { name: 'category',
               description: 'Category (sensor or message)',
               type: 'string',
               required: true,
                       enum: 
                             [ 'Air Temperature',
                               'Water Temperature',
                               'Light',
                                      'pH',
                                           'Digital Water Level',
                                                'Water Pump Current',
                                                     'Air Pump 1 Current',
                                                          'Air Pump 2 Current',
                                                               'Light_Voltage',
                                                                    'pH_Voltage',
                                                                         'system',
                                                                              'Valve Messages' ],
                                                                                defaultValue: undefined,
                                                                                  paramType: 'query' }

           
        ,{
	        "paramType": "query",
		    "name": "from",
		    "required": false,
		    "type": "string",
		    "description": "Start date - DD/MM/YYYY",
		    "format": "date",
         }, {
	        "paramType": "query",
		    "name": "to",
		    "required": false,
		    "type": "string",
		    "description": "End date - DD/MM/YYYY",
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
    console.log('getAndSend: ' + cql);
    try {
      connection.query(cql, function(err, rows, fields) {
      if (err) {
         throw swagger.errors.notFound('readings');        
      } else {
         response.send(parseResult(rows));
      }
      });
    } catch (e) {
         console.log('Error in function getAndSendData: '+e.message);	
         response.send('Error - see API log');
    }
}

// parses what is returned from cassandra
function parseResult(rows) {
    var data = [];
    
    for (var i = 0; i < rows.length; i++ ) {
        data.push({
            'category': rows[i][1],
            'time': rows[i][2],
            'value': rows[i][3],
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

    console.log("SQL " + cql);
    //cql += " ALLOW FILTERING"; 
    return cql;
}

function parseSensorNames(rows) {
    var names = [];
    //var rows = sensor_names_result.rows;
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
console.log("Aqua API Server running on "+settings.port);
