'use strict'

const _Promise = require('bluebird');
const _Request = _Promise.promisifyAll(require('request'));
const _uuid = require('uuid/v4');

const BASE_URL = 'https://api.cognitive.microsofttranslator.com/'

var translation = function(region, apiKey) { 
    this.region = region;
    this.apiKey = apiKey;
}

translation.prototype.translate = function(language, text) {
    var params = {};

    let options = {
        method: 'POST',
        baseUrl: BASE_URL,
        url: 'translate',

        qs: {
          'api-version': '3.0',
          'to': language,
          'textType': 'html'
        },

        headers: {

          'Ocp-Apim-Subscription-Key': this.apiKey,
          "Ocp-Apim-Subscription-Region": this.region,
          'Content-type': 'application/json',
          'X-ClientTraceId': _uuid().toString()

        },
        body: [{
              'text': text
        }],

        json: true,
        
    };

    return _Request.postAsync(options);

};
translation.prototype.translate = function(language, text) {
  var params = {};

  let options = {
      method: 'POST',
      baseUrl: BASE_URL,
      url: 'translate',

      qs: {
        'api-version': '3.0',
        'to': language,
        'textType': 'html'
      },

      headers: {

        'Ocp-Apim-Subscription-Key': this.apiKey,
        "Ocp-Apim-Subscription-Region": this.region,
        'Content-type': 'application/json',
        'X-ClientTraceId': _uuid().toString()

      },
      body: [{
            'text': text
      }],

      json: true,
      
  };

  return _Request.postAsync(options);

};

module.exports = translation;