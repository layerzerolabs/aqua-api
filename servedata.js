var express = require('express')
 , url = require("url")
 , bodyParser = require("body-parser")
 , swagger = require("swagger-node-express")
 , dataAccess = require('./dataAccess')
 , models = require('./models')
 , SwaggerValidator = require('swagger-model-validator')
 , validator = new SwaggerValidator(swagger)
 , settings = require('./client-settings.js')
 , queryString = require('qs');
   

var app = express();
var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', "*");
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
};

// Settings file is shared between this app and the swagger ui
// so this serves it publicly
app.get('/client-settings.js', function(req, res){
     res.sendfile('./client-settings.js');
});

app.use(bodyParser.json());
app.use(allowCrossDomain);

// Couple the application to the Swagger module.
swagger.setAppHandler(app);

var getReadings = function(request, response) {
    var options = queryString.parse(request.query);
    console.log('options are', options, 'ok');
    dataAccess.getReadings(options, function (err, results){
      if (err){
        console.log('Can\'t get reading: '+err.message);
        response.status(400);
        response.send(err);
      } else {
        response.status(200);
        response.send(results);
      }
    });
};

var getAll = {
   'spec': {
         "description" : "Get all data",
         "path" : "/todmorden/all/",
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
		    "description": "Start date - YYYY-MM-DD",
		    "format": "date",
         }, {
	        "paramType": "query",
		    "name": "to",
		    "required": false,
		    "type": "string",
		    "description": "End date - YYYY-MM-DD",
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
        return getReadings(request, response);
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
			       'Humidity',
                               'pH',
			       'pHmV',
                               'Digital Water Level',
                               'Water Pump Current',
                               'Air Pump 1 Current',
                               'Air Pump 2 Current',
                               'Light_Voltage',
                               'Humidity_Voltage',
                               'pH_Voltage',
                               'system',
                               'Valve Messages',
			       'Valve Mode' ],
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
        return getReadings(request, response);
    }
};

var postReading = {
	'spec': {
        "description" : "Post a reading in a single category",
	"path" : "/todmorden",
	"notes" : "Records data in specified category (sensor or message type).\
 Date is accepted in local time.",
        "method": "POST",
        "parameters" : [{
	        "paramType": "body",
		    "name": "reading",
		    "required": true,
		    "type": "Reading",
		    "description": "Reading"
         }],
	    "errorResponses" : [
		    swagger.errors.invalid('date'), 
	    ],
     
	    "nickname" : "postReading"
	},
    action:  function (request, response) { 
        var validation = swagger.validateModel('Reading', request.body);
        if (!validation.valid) {
            return response.send(validation);
        }
        dataAccess.createReading(request.body, function (err){
          if (err){
            console.log('Can\'t create reading: '+err.message);
            response.status(400);
            response.send(err);
          } else {
            response.status(201);
            response.send({success: true});
          }
        });
    }
};

swagger.addModels(models)
  .addGet(getAll)
  .addGet(getByCategory)
  .addPost(postReading);
swagger.configure(settings.base_url + ':' + settings.port, "0.1");
app.use(express.static(__dirname + '/node_modules/swagger-node-express/swagger-ui/'));
app.listen(settings.port);
console.log("Aqua API Server running on "+settings.port);
