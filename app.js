
/**
 * Azure Porxy Translator
 * 
 * Author: Neil Brittliff
 * 
 */

const express = require('express');
const http = require('http');
const path = require('path');
const request = require('request');
const url = require('url');
const jsdom = require("jsdom");
const zlib = require('zlib');
const translation = require('./translation');
var Buffer = require('buffer').Buffer;
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
var originalLanguage =  process.env.ORIGINAL_LANGUAGE || config.originalLanguage;

/**
 * It all starts here ...
 */
app.get('/', function(req, res, next) {
  res.sendFile('index.html', {
    root: path.join(__dirname, 'public','views')
  });

});

app.get('/sv-SE', function(req, res, next) {
  processRequest(req, res);
});

app.get('/zh-Hans', function(req, res, next) {
  processRequest(req, res);
});

app.get('/([a-z]{2})', function(req, res, next) {
  processRequest(req, res);
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
      return;
    }
  //  console.log(`Pathname: ${parsedUrl.pathname}`);

    if (parsedUrl.pathname.includes('.png')) {
       res.writeHead(200, {'Content-Type': 'image/png' });
       res.end(body, 'binary');
    } if (parsedUrl.pathname.includes('.gif')) {
        res.writeHead(200, {'Content-Type': 'image/gif' });
        res.end(body, 'binary');
      } if (parsedUrl.pathname.includes('.jpeg')) {
        res.writeHead(200, {'Content-Type': 'image/jpeg' });
        res.end(body, 'binary');
    } if (parsedUrl.pathname.includes('.axd')) {
        console.log('Path: ' + parsedUrl.pathname);
        var input = new Buffer(body);
        zlib.gunzip(input, function (error, result) {
          res.writeHead(200, {'Content-Type': 'text/javascript' });
          res.end(result);
          
        });
    } else {
      res.end(body);
    }

  });
  
}

function processRequest(req, res) {
  var language = req.url.replace("/", "");

  logMessage(`Language: ${language}`);
  logMessage(`Retreving URL: ${translationUrl}`);

  var translator = new translation(cognitiveRegion, cognitiveKey);

  request({uri: translationUrl}, function(err, response, body) {

      if (err) {
        res.end(err);
        return;
      }

      if (err && response.statusCode !== 200) {
        console.log(`Request error: ${err}`);
        res.end(err);
        return;
      }
      
      console.log(`Language: ${originalLanguage} -> ${language}`)
      if (language == originalLanguage) {
        res.end(body);
        return;
      }

      translatePage(translator, language, body).then(function(result) {
        res.end(result);
      });

    });

}

async function translatePage(translator, language, body) {
  const dom = new JSDOM(body, {});

  var paragraphs = dom.window.document.querySelectorAll("p");
      
  for (var p in paragraphs) {
      
      if (paragraphs[p].innerHTML) {
      var result = await translateText(translator, language, paragraphs[p].innerHTML);
  
      paragraphs[p].innerHTML = result.body[0].translations[0].text;

      }

  }

  var anchors = dom.window.document.querySelectorAll("a");
  
  var lines = [];

  for (var a in anchors) {

    if (anchors[a].textContent) {
      lines.push(anchors[a].textContent); 
    }

  }
  
  var translations = [];
  var candidates = [];
   
  for (var line in lines) {
    candidates.push(lines[line]);

    if (line % 99 == 0 && line != 0) {
      var result = await translateBody(translator, language, candidates);
      
      for (var r in result.body) {
        var translation = result.body[r].translations[0].text;

        translations.push(translation);
      
      }

      console.log('Translation Size: ' + translations.length);
      candidates = [];
 
    }

  }

  console.log('Candidate Size: ' + candidates.length);

  if (candidates.length != 0) {
    var result = await translateBody(translator, language, candidates);
        
    for (var r in result.body) {
      var translation = result.body[r].translations[0].text;

      translations.push(translation);
    
    }
  
  }

  var translation = 0;

  for (var a in anchors) {
    
    if (anchors[a].textContent) {
      anchors[a].textContent = translations[translation];

      translation += 1;
      
    }
    
  }

  return dom.window.document.documentElement.outerHTML;

}

function translateText(translator, language, text) {
  return new Promise(resolve => {
    translator.translateText(language, text).then(function(result) {
      resolve(result);
    });  
  });
}

function translateBody(translator, language, body) {
  return new Promise(resolve => {
    translator.translateBody(language, body).then(function(result) {
      resolve(result);
    });  
  });
}