CREATE DATABASE readings;

USE readings;

CREATE TABLE todmordon(
   id INT NOT NULL AUTO_INCREMENT, 
   PRIMARY KEY(id),
   sensor_name VARCHAR(30), 
   reading_time DATETIME DEFAULT NULL,
   reading_value VARCHAR(30)
)
