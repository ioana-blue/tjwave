/**
  Simple loop back STT and TTS
*/

/************************************************************************
* Step #1: Configuring your Bluemix Credentials
************************************************************************
In this step, the audio sample (pipe) is sent to "Watson Speech to Text" to transcribe.
The service converts the audio to text and saves the returned text in "textStream"
*/

var watson = require('watson-developer-cloud')
var config = require('./config')  // gets username and passwords from the config.js files
var credentials = config.credentials

var speech_to_text = watson.speech_to_text({
    username: credentials.speech_to_text.username,
    password: credentials.speech_to_text.password,
    version: credentials.version
});

var text_to_speech = watson.text_to_speech({
    username: credentials.text_to_speech.username,
    password: credentials.text_to_speech.password,
    version: credentials.version
});


/**
 * OW stuff
 */
var openwhisk = require('openwhisk')
var owOptions = {apihost: credentials.openwhisk.apihost, api_key: credentials.openwhisk.apikey}
var ow = openwhisk(owOptions)

var fs = require('fs')


var AudioContext = require('web-audio-api').AudioContext
context = new AudioContext
var exec = require('child_process').exec


/************************************************************************
* Step #2: Configuring the Microphone
************************************************************************
In this step, we configure your microphone to collect the audio samples as you talk.
See https://www.npmjs.com/package/mic for more information on
microphone input events e.g on error, startcomplete, pause, stopcomplete etc.
*/

// Initiate Microphone Instance to Get audio samples
var mic = require('mic');
var micInstance = mic({ 'rate': '44100', 'channels': '2', 'debug': false, 'exitOnSilence': 6 });
var micInputStream = micInstance.getAudioStream();

micInputStream.on('data', function(data) {
  //console.log("Received Input Stream: " + data.length);
});

micInputStream.on('error', function(err) {
  console.log("Error in Input Stream: " + err);
});

micInputStream.on('silence', function() {
	// console.log("total silence")
  // detect silence.
});
micInstance.start();
//exec('aplay output.wav')
console.log("TJ is listening, you may speak now.");

/************************************************************************
* Step #3: Converting your Speech Commands to Text
************************************************************************
In this step, the audio sample is sent (piped) to "Watson Speech to Text" to transcribe.
The service converts the audio to text and saves the returned text in "textStream"
*/

var recognizeparams = {
  content_type: 'audio/l16; rate=44100; channels=2',
  interim_results: true,
  smart_formatting: true
  //  model: 'en-US_BroadbandModel'  // Specify your language model here
};


textStream = micInputStream.pipe(speech_to_text.createRecognizeStream(recognizeparams));

textStream.setEncoding('utf8');


textStream.on('data', function(str) {
  console.log(' ===== Speech to Text ===== : ' + str); // print the text once received
  // call OW 
  ow.actions.invoke({actionName: '/_/whiskbot-conversation/tjbot-convo', blocking: true, params: {event: {text: str}}}).then(invokeResponse => { 
      	var textstring = invokeResponse.response.result.text;
      	console.log(textstring)

         /*********************************************************************
          Step #5: Speak out the response
          *********************************************************************
          In this step, we text is sent out to Watsons Text to Speech service and result is piped to wave file.
          Wave files are then played using alsa (native audio) tool.
         */
       speakAplay(textstring)
  })
})


textStream.on('error', function(err) {
  console.log(' === Watson Speech to Text : An Error has occurred ===== \nYou may have exceeded your payload quota.') ; // handle errors
    console.log(err)
    console.log("\n Press <ctrl>+C to exit.") ;
});


/*********************************************************************
* Step #6: Convert Text to Speech and Play
*********************************************************************
*/

function speakAplay(textstring) {
        console.log('Speaking ' + textstring)
        micInstance.pause(); // pause the microphone while playing
        var params = {
           text: textstring,
	   accept: 'audio/wav'
        }

        var cmd = '/usr/bin/aplay output.wav'
        text_to_speech.synthesize(params).pipe(fs.createWriteStream('output.wav')).on('close', function() {
	    isspeaking = true
	    exec(cmd, function (error, stdout, stderr) {
	        if (error !== null) {
	  	    console.log('exec error: ' + error + ' ' + error.code);
	        }
		micInstance.resume()
		isspeaking = false
	    })
        })

}


var Sound = require('node-aplay');
var soundobject ;
var isspeaking = false ;

// play 

var child_process = require("child_process")
var audioFile = 'output.wav'



function speak(textstring){

  if (!isspeaking) {
    console.log('Speaking ' + textstring)
    micInstance.pause(); // pause the microphone while playing
    var params = {
      text: textstring,
      voice: config.voice,
      accept: 'audio/wav'
    };
    text_to_speech.synthesize(params).pipe(fs.createWriteStream(audioFile)).on('close', function() {
	isspeaking = true ;
	if (config.testbed === 'laptop') {
	    var player = child_process.spawn("ffplay", [ audioFile, '-nodisp', '-autoexit'])
	    player.on('close', function(code) {
		console.log('Done with music playback! with code', code);
      	      	micInstance.resume();
      	      	isspeaking = false ;
      	  	});
	} else {
	    // remains to be seen and tested
	    soundobject = new Sound(audioFile);
	    soundobject.play();
	    soundobject.on('complete', function () {
		console.log('Done with playback! for ' + textstring);
		micInstance.resume();
		isspeaking = false ;
	    });
	}
    });
  }
}


// ---- Stop PWM before exit
process.on('SIGINT', function () {
  process.nextTick(function () { process.exit(0); });
});
