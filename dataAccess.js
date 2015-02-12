var mysql = require('mysql');
 var dbsettings = require('./dbconf.js');
 
var pool = mysql.createPool({
         host     : dbsettings.host,
         user     : dbsettings.user,
         password : dbsettings.password,
         database : dbsettings.database
});


// parses what is returned from db
function parseResult(rows) {
    var data = [];
    if (rows && rows !== []) {
        for (var i = 0; i < rows.length; i++ ) {
            data.push({
                'category': rows[i].sensor_name,
                'time': rows[i].reading_time ? rows[i].reading_time.toString() : '',
                'value': rows[i].reading_value,
            });
        } 
    }
    return data;
}

function buildSelect(options) {
    var sql = 'select sensor_name, reading_time, reading_value from todmorden where 1 ';
    if (options.category) {
        sql += ' and sensor_name  = "' +options.category+ '"';
    }
    if (options.from) {
        sql += ' and reading_time >= "'+options.from+'"';
    }
    if (options.to) {
        sql += ' and reading_time <= "'+options.to+'"';
    }
    sql +=' order by reading_time desc ';
    if (options.limit) {
        sql +='  limit '+options.limit;
    }
    return sql;
}

function parseCategories(rows) {
    var names = [];
    for (var i = 0; i < rows.length; i++ ) {
        names.push("'"+rows[i].sensor_name+"'");
    }
    return names.join();
}

module.exports.createReading = function(reading, callback) {
    pool.query('insert into todmorden set ?', reading, callback);
};

module.exports.getCategories = function(callback) {
    var sql = 'select distinct sensor_name from todmorden';
    pool.query(sql, function(err, result) {
      if (err) {
         callback(err);      
      } else {
         var categories = [];
         result.forEach(function(row) {
            categories.push(row.sensor_name);
         });
         callback(null, categories);
      }
    });
};

module.exports.getReadings = function(options, callback) {
    var sql = buildSelect(options);
    pool.query(sql, function(err, result) {
      if (err) {
         callback(err);      
      } else {
         callback(null, parseResult(result));
      }
    });
};
