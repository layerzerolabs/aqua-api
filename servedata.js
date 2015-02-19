/* jshint node: true */
/* global require, console, __dirname */

'use strict';

var express = require('express'),
  bodyParser = require('body-parser'),
  dataAccess = require('./dataAccess'),
  models = require('./models'),  
  swaggerValidator = require('swagger-model-validator'),
  settings = require('./client-settings.js'),
  queryString = require('qs');
   
var app = express();
var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
};


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(allowCrossDomain);
var swagger = require('swagger-node-express').createNew(app);
swaggerValidator(swagger);

var checkApiKey = function(request, response, next) {
  var keySent = request.query.api_key;
  if (keySent !== settings.apiKey) {
    response.status(401);
    response.send({'success': false, 'error': 'Incorrect/Missing API Key'});
  } 
  return next(); 
};

var handleError = function(err, response) {
  console.log(err.message);
  response.status(400);
  response.send(err);  
};

var getReadings = function(params, response) {
    var validation = swagger.validateParams(getAll.spec, params, true);
    if (!validation.valid) {
      return response.send(validation.GetFormattedErrors());
    }
    dataAccess.getReadings(params, function (err, results){
      if (err){
        handleError(err, response);
      } else {
        response.status(200);
        response.send(results);
      }
    });
};

var getCategories = {
  'spec': {
    'description' : 'Get data categories',
    'path' : '/todmorden/categories/',
    'notes' : 'Returns categories of data, i.e. sensor names and message types.',
    'summary' : 'Get categories',
    'method': 'GET',
    'nickname' : 'getCategories'
  },
  action:  function (request, response) { 
    dataAccess.getCategories(function (err, results){
      if (err){
        handleError(err, response);
      } else {
        response.status(200);
        response.send(results);
      }
    });
  }
};

var infoAboutGettingData = 
  'Parameter dates are accepted in local time, data is returned in UTC.' +
  'An optional limit is accepted and returns the most recent records.' +
  'Data is measured for some sensors every second, and for others every 10 minutes,' +
  'But it is only recorded on change, apart from at 00.05, when all data is recorded.';

var getAll = {
  'spec': {
    'description' : 'Get all data',
    'path' : '/todmorden/all/',
    'notes' : 
      'Returns all data from all sensors and all messages.' + infoAboutGettingData,
    'summary' : 'Get all data',
    'method': 'GET',
    'parameters' : [{
    'paramType': 'query',
    'name': 'from',
    'required': false,
    'type': 'string',
    'description': 'Start date - YYYY-MM-DD',
    'format': 'date',
  }, {
    'paramType': 'query',
    'name': 'to',
    'required': false,
    'type': 'string',
    'description': 'End date - YYYY-MM-DD',
    'format': 'date', 
  }, {
    'paramType': 'query',
    'name':  'limit',
    'required': false,
    'type': 'integer',
    'description': 'How many records to return (blank = all)', 
  }],
  'type' : 'array',
  'items': {
    $ref: 'Reading'
  },
  'errorResponses' : [
    swagger.errors.invalid('from'), 
    swagger.errors.invalid('to'),
  ],
    'nickname' : 'getAll'
  },
  action:  function (request, response) { 
    var params = queryString.parse(request.query);
    return getReadings(params, response);
  }
};

var getByCategory = {
  'spec': {
    'description' : 'Get data from single category',
    'path' : '/todmorden',
    'notes' : 
      'Returns data from specified category (sensor or message type)' + infoAboutGettingData,
    'method': 'GET',
    'parameters' : [{
      name: 'category',
      description: 'Category (sensor or message)',
      type: 'string',
      required: true,
      enum: [ 
        'Air Temperature',
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
        'Valve Mode' 
      ],
      defaultValue: undefined,
      paramType: 'query'
    },{
      'paramType': 'query',
      'name': 'from',
      'required': false,
      'type': 'string',
      'description': 'Start date - YYYY-MM-DD',
      'format': 'date',
    }, {
      'paramType': 'query',
      'name': 'to',
      'required': false,
      'type': 'string',
      'description': 'End date - YYYY-MM-DD',
      'format': 'date', 
    }, {
      'paramType': 'query',
      'name':  'limit',
      'required': false,
      'type': 'integer',
      'description': 'How many records to return (blank = all)', 
    }],
    'type' : 'array',
    'items': {
      $ref: 'Reading'
    },
    'errorResponses' : [
      swagger.errors.invalid('from'), 
      swagger.errors.invalid('to'),
    ],
    'nickname' : 'getByCategory'
  },
  action:  function (request, response) { 
    var params = queryString.parse(request.query);  
    return getReadings(params, response);
  }
};

var postReading = {
  'spec': {
    'description' : 'Post a reading in a single category',
	  'path' : '/todmorden',
	  'notes' : 
      'Records data in specified category (sensor or message type).' +
      'Date must be in ISO format',
    'method': 'POST',
    'parameters' : [{
      'paramType': 'form',
      'name': 'sensor_name',
      'required': true,
      'type': 'string',
      'description': 'Category, for example name of sensor or "system" etc'
     }, {
      'paramType': 'form',
      'name': 'reading_time',
      'required': true,
      'type': 'string',
      'format': 'date-time',
      'description': 'When the reading was taken. Dates without times default to midnight'
     }, {
      'paramType': 'form',
      'name': 'reading_value',
      'required': true,
      'type': 'string',
      'description': 'The reading value (without units) or message content'
     }],
    'errorResponses' : [
      swagger.errors.invalid('date'), 
    ],
    'nickname' : 'postReading'
  },
  action:  function (request, response) { 
    checkApiKey(request, response, function() {
      var validation = swagger.validateModel('Reading', request.body);
      if (!validation.valid) {
        return response.send(validation.GetFormattedErrors());
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
    });
  }
};

swagger.addModels(models)
  .addGet(getCategories)
  .addGet(getAll)
  .addGet(getByCategory)
  .addPost(postReading);
swagger.configure(settings.baseUrl + ':' + settings.port, '0.1');
app.use(express.static(__dirname + '/node_modules/swagger-node-express/swagger-ui/'));
app.listen(settings.port);
console.log('Aqua API Server running on '+settings.port);
