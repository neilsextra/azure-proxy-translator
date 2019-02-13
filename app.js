
/**
 * Azure Porxy Translator
 * 
 * Author: Neil Brittliff
 * 
 */

var express = require('express');
var http = require('http');
var path = require('path');
var request = require('request');
var url = require('url');
const jsdom = require("jsdom");
const translation = require('./translation');
const { JSDOM } = jsdom;

var app = express();
var favicon = require('serve-favicon');
var methodOverride = require('method-override');
var bodyParser = require('body-parser');
var logger = require('morgan');
var errorHandler = require('errorhandler')

app.use(favicon(path.join(__dirname, 'public','icons','favicon.ico'))); 

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.use(logger('dev'));
app.use(methodOverride());
app.use(express.json());    

if (process.env.NODE_ENV === 'development') {
   app.use(errorhandler())
}

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use("/modules", express.static(path.join(__dirname, 'node_modules')));

if (process.env.NODE_ENV === 'development') {
  app.use(errorhandler())
}

function logMessage(message) {
  
  console.log(new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '') + '[INFO] ' + message);
  
}

function logError(message) {
  
  console.log(new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '') + ' [ERROR] ' + message);
  
}

var config = require('./config.json');
var keys = {};

// Get the Key - this file should never be checked in and may not be preset
try {
   keys = require('./keys.json');
} catch (e) { 
}

var cognitiveKey =  process.env.KEY || keys.cognitiveKey;
var translationUrl =  process.env.TRANSLATION_URL || config.translationUrl;
var cognitiveRegion =  process.env.COGNITIVE_REGION || config.cognitiveRegion;
var originalLanguage =  process.env.ORIGINAL_LANGUAGE || keys.originalLanguage;

/**
 * It all starts here ...
 */
app.get('/', function(req, res, next) {
  res.sendFile('index.html', {
    root: path.join(__dirname, 'public','views')
  });
});

app.get('/([a-z]{2})', function(req, res, next) {
  var language = req.url.replace("/", "");

  logMessage('Language: ' + language);
  logMessage('Retreving URL: ' + translationUrl);

  var translator = new translation(cognitiveRegion, cognitiveKey);

    request({uri: translationUrl}, function(err, response, body) {

    if (err) {
      res.end(err);
    }

    if (err && response.statusCode !== 200) {
      console.log('Request error');
      res.end(err);
      return;
    }
    
    if (language == originalLanguage) {
      res.end(body);
      return;
    }

    translatePage(translator, language, body).then(function(result) {
      res.end(result);
    });

  });

  app.get('/*', function(req, res, next) {
     
    request({uri: `${translationUrl}${req.url}`}, function(err, response, body) {
      processResponse(req, res, body);
    });

  });

  app.post('/*', function(req, res, next) {
    request({uri: `${translationUrl}${req.url}`}, function(err, response, body) {
      processResponse(req, res, body);
    });
  });

});

http.createServer(app).listen(app.get('port'), function() {
  console.log('Express server listening on port: \'' + app.get('port') +'\'');
});

function processResponse(req, res, body) {
  var parsedUrl = url.parse(req.url);

  request({uri: `${translationUrl}${req.url}`,
          encoding: null}, function(err, response, body) {  
    
    if (err) {
      console.log(err);
      res.statusCode(500).end(err);
    }

    if (parsedUrl.pathname.includes('.png')) {
       res.writeHead(200, {'Content-Type': 'image/png' });
      res.end(body, 'binary');
    } if (parsedUrl.pathname.includes('.gif')) {
      res.writeHead(200, {'Content-Type': 'image/gif' });
      res.end(body, 'binary');
    } if (parsedUrl.pathname.includes('.jpeg')) {
      res.writeHead(200, {'Content-Type': 'image/jpeg' });
      res.end(body, 'binary');
    } else {
      res.end(body);
    }

  });
  
}

async function translatePage(translator, language, body) {
  const dom = new JSDOM(body, {});

  var paragraphs = dom.window.document.querySelectorAll("p");

  for (var p in paragraphs) {
    console.log(paragraphs[p].innerHTML);
    
    if (paragraphs[p].innerHTML) {
      var result = await translateText(translator, language, paragraphs[p].innerHTML);
      console.log(JSON.stringify(result));

      paragraphs[p].innerHTML = result.body[0].translations[0].text;

    }

  }

  return dom.window.document.documentElement.outerHTML;

}

function translateText(translator, language, text) {
  return new Promise(resolve => {
    translator.translate(language,text).then(function(result) {
      resolve(result);
    });  
  });

}