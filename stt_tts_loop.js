/**
  Simple loop back STT and TTS
*/

/************************************************************************
* Step #1: Configuring your Bluemix Credentials
************************************************************************
In this step, the audio sample (pipe) is sent to "Watson Speech to Text" to transcribe.
The service converts the audio to text and saves the returned text in "textStream"
*/

var watson = require('watson-developer-cloud');
var config = require('./config');  // gets our username and passwords from the config.js files
var speech_to_text = watson.speech_to_text({
  username: config.STTUsername,
  password: config.STTPassword,
  version: config.version,
  //customization_id: config.STTCustomizationid    // comment out this line if you are not using any customized language model
});

var fs = require('fs');


var text_to_speech = watson.text_to_speech({
  username: config.TTSUsername,
  password: config.TTSPassword,
  version: 'v1'
});

var AudioContext = require('web-audio-api').AudioContext
context = new AudioContext
//var _ = require('underscore');



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

/*********************************************************************
* Step #4: Parsing the Text
*********************************************************************
In this step, we parse the text to look for commands such as "ON" or "OFF".
You can say any variations of "lights on", "turn the lights on", "turn on the lights", etc.
You would be able to create your own customized command, such as "good night" to turn the lights off.
What you need to do is to go to parseText function and modify the text.
*/



/*********************************************************************
* Step #4: Parsing the Text and create a response
*********************************************************************
In this step, we parse the text to look for attention word and send that sentence
to watson conversation to get appropriate response. You can change it to something else if needed.
Once the attention word is detected,the text is sent to Watson conversation for processing. The response is generated by Watson Conversation and is sent back to the module.
*/

textStream.on('data', function(str) {
  console.log(' ===== Speech to Text ===== : ' + str); // print the text once received
  speak(str)
});


textStream.on('error', function(err) {
  console.log(' === Watson Speech to Text : An Error has occurred ===== \nYou may have exceeded your payload quota.') ; // handle errors
  console.log(err + "\n Press <ctrl>+C to exit.") ;
});


/*********************************************************************
* Step #6: Convert Text to Speech and Play
*********************************************************************
*/

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
