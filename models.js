module.exports.models = {
   "Reading":{
      "id":"Reading",
      "required": ["sensor_name", "reading_time", "reading_value"],
      "properties": {
         "sensor_name": {
            "type": "string",
            "description": "Source of the message (e.g. 'Water Temperature', or 'system' if it is a system message)",
         }, 
         "reading_time": {
            "type": "string",
            "format": "date-time",
            "description": "Date and time the message was created"
         }, 
         "reading_value": {
            "type": "string",
            "description": "Content of the message (e.g. '22.6' or 'Reset triggered')"
         }
      }
   }
};

