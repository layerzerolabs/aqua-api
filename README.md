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
If this is development mode then you can additionally add the devuser

```bash
mysql> source PATH_TO_AQUA-API/setup/devuser.sql
```

### Application Code 

```
$ npm install
```

## test 

```
$ npm test
```


