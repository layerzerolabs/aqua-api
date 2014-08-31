# aqua-api

REST api for aquaponics data

## install 

### Database 

Install mysql 
Run the database script

```bash
$ mysql
mysql> source PATH_TO_AQUA-API/setup/createdb.sql
```
If this is development mode then you can additionally add the devuser.

```bash
mysql> source PATH_TO_AQUA-API/setup/devuser.sql
```

Any changes you make to the database config in those scripts must also be changed in dbconf.js.

### Application Code 

```
$ npm install
```

Edit client-settings.js with your web address and port

## test 

```
$ npm test
```
Tests use the database config from dbconf.js

