var art = [];  // no longer used
var timer;
var rotationSpeed = 60;  // default rotation speed, in minutes
var rotationInterval;
var imageFit = 'contain';  // default image fit (contain shows entire image, cover fills the screen)
var debug = false;
var showClock = false;  // default for clock visibility
var blanking = false;  // default for blanking (turning off overnight)
var clockInterval;


loadConfiguration('art/config.json');


// when the document is loaded
$(document).ready(function() {
  // start the rotation and clock
  $('DIV#one IMG').fadeIn(2000);  // show the splash
  setTimeout(function (){   // start the rotation after a bit of splash
    rotate();
    rotationInterval = setInterval(rotate,rotationSpeed*60*1000);
    if ( showClock ) {  // show and update the clock
      setTimeout(function(){ $("DIV#clock").fadeIn(1000); },400);  // fade the clock in after the splash
      clockUpdate();
      clockInterval = setInterval(clockUpdate,20000);  // update the clock every so often
    }
  },4000);


  // change the rotation on mouse click
  $(document).click(function(event) {
    rotate(1);
  });

  // Handle hotkeys
  $(document).keyup(function(event) {
    if ( event.which == 16 ) { // shift
      // do nothing, likely just a force-refresh on the browser
    } else if ( event.which == 68 ) { // Toggle debug "d"
      console.log("Toggling the display of debug information.");
      if ( debug ) {
        debug = false;
        $('DIV.pane').removeClass('debug');
      } else {
        debug = true;
        $('DIV.pane').addClass('debug');
      }
    } else if ( event.which == 80 ) {  // Toggle showing the preview "p"
      console.log("Toggling the display of the preview image.");
      if ( $("IMG#preload").hasClass("show") ) $("IMG#preload").removeClass("show");
      else $("IMG#preload").addClass("show");
    } else if ( event.which == 67 ) {  // Toggle showing the clock "c"
      console.log("Toggling the display of the clock.");
      if ( $('DIV#clock').is(':visible') ) {
        $('DIV#clock').hide();
        clearInterval(clockInterval);
      } else {
        $('DIV#clock').show();
        clockInterval = setInterval(clockUpdate,30000);
      }
    } else if ( event.which == 70 ) {  // Toggle showing the image fit "f"
      if ( imageFit == 'cover' ) {
        imageFit = 'contain';
        $('DIV.pane IMG').removeClass('cover');
        $('DIV.pane IMG').addClass(imageFit);
      } else {
        imageFit = 'cover';
        $('DIV.pane IMG').removeClass('contain');
        $('DIV.pane IMG').addClass(imageFit);
      }
      console.log('Toggling the image fit to: '+imageFit);
    } else {
      if (debug) console.log("An unrecognized key was pressed: "+event.which);
      rotate(1);
    }
  });

});





function loadConfiguration ( path ) {
  // attempt to load configuration from a file
  fetch('art/config.json')
    .then(response => {
      if (!response.ok) {
        if (debug) console.log('Configuration: Additional configuration not available in "'+path+'".');
      }
      return response.json();
    })
    .then(data => {  // process the json for global config variables
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          switch (key) {
            case 'debug':
            case 'showClock':
            case 'rotationSpeed':
            case 'imageFit':
            case 'blanking':
            case 'GoogleDrive':
              window[key]=data[key];
              if (debug) console.log("Configuration: "+key+" set to "+data[key]);
              break;
            default:
              if (debug) console.warn(`Configuration: Unrecognized '${key}' value found in configuration file and ignored.`);
              break;
          }
        }
      }
      // special configuration processing
      if ( imageFit!='contain' && imageFit!='cover' ) imageFit = 'contain'; // default is contain
      if ( debug ) $('DIV.pane').addClass('debug');  // debug
      if ( blanking != false ) {  // start and end times were provided for blanking
        if ( blanking.hasOwnProperty('start') && blanking.start !== null && blanking.start !== ""
          && blanking.hasOwnProperty('end') && blanking.end !== null && blanking.end !== "" ) {
          //console.log(blanking);
          blanking.start = stringToTime(blanking.start);
          blanking.end = stringToTime(blanking.end);
          if ( blanking.start > blanking.end ) { // start today, end tomorrow
            blanking.end.setDate(blanking.end.getDate() + 1);
          }
          //console.log(blanking);
        } else {
          console.warn('Configuration: Blanking start and end times not provided.');
        }
      }
    })
    .catch(error => {  // oop, something went wrong reading and processing the config?
      console.warn('Configuration: Could not load configuration from "'+path+'".');
    });
}


function rotate ( fadeTime = 1000 ) {
  if ( !Number.isFinite(fadeTime) ) fadeTime = 1000;

  // toggle which one is new
  var on='one';
  var off='two';
  if ( $('DIV#one').hasClass('active') ) {
    on = 'two';
    off = 'one';
  }

  // get the media to show next
  const mediaUrl = 'api.php?cachebuster='+Date.now().toString();
  $.ajax({
    url: mediaUrl,
    method: 'GET',
    xhrFields: {
      responseType: 'blob' // Get the data as a Blob directly
    },
    success: function(data, status, xhr) {
      if (status === 'success') {
        const contentType = xhr.getResponseHeader('Content-Type');
        if ( debug ) console.log("Successfully pulled the media: "+contentType);

        if ( debug ) console.log("showing "+on); // remove
        $('DIV#'+on).css('z-index',1);  // put this in back
        $('DIV#'+off).css('z-index',2);

        if ( contentType && contentType.startsWith('image/') ) {  // handle an image
          $('DIV#'+on).html('<img class="'+imageFit+'" src="'+URL.createObjectURL(data)+'" />');
          $('DIV#'+on+' IMG').on('load',function() {
            if ( debug ) console.log('image loaded for '+on);
            $('DIV#'+on).fadeIn(fadeTime); // show this, behind
            $('DIV#'+on).addClass('active');
            $('DIV#'+off).fadeOut(fadeTime); // hide other, from front
            setTimeout(function(){ $('DIV#'+off+' VIDEO').trigger('pause'); },fadeTime); // stop playing the video, if present
            $('DIV#'+off).removeClass('active');
          });
        } else if ( contentType && contentType.startsWith('video/') ) {  // handle a video
          $('DIV#'+on).html('<video muted loop src="'+URL.createObjectURL(data)+'"></video>');
          $('DIV#'+on+' VIDEO').on('loadeddata',function() {
            if ( debug ) console.log('video loaded for '+on);
            $('DIV#'+on).fadeIn(fadeTime); // show this, behind
            $('DIV#'+on).addClass('active');
            $('DIV#'+off).fadeOut(fadeTime);
            setTimeout(function(){ $('DIV#'+off+' VIDEO').trigger('pause'); },fadeTime); // stop playing the video, if present
            $('DIV#'+off).removeClass('active');
            $('DIV#'+on+' VIDEO').trigger('play');  // play this video
          });
        } else {
          console.warn("Could not determine media type or unsupported format: "+contentType);
        }
      } else {
        console.error("Error fetching data:", xhr.status, xhr.statusText);
      }
    },
    error: function(xhr, status, error) {
      console.error("ERROR fetching data:", status, error);
    }
  });

  /**
  @todo You've ruined the snow! How can I tell if the image should have snow??
  */
}


function stringToTime ( string ) {
  var timeRegex = /^(\d{1,2}):(\d{2})\s?(am|pm)$/i;
  var match = timeRegex.exec(string.trim());
  if (match) {
    var hours = parseInt(match[1], 10);
    var minutes = parseInt(match[2], 10);
    var ampm = match[3].toLowerCase();
    if (isNaN(hours) || isNaN(minutes) || hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
      console.warn(`Time string "${string}" has invalid hour or minute values: .`);
      return null;
    }
  } else {
    console.warn(`Time string "${string}" is not in the expected "h:mm am/pm" format.`);
    return null;
  }
  // Adjust hours for 24-hour format
  if (ampm === 'pm' && hours !== 12) {
    hours += 12;
  } else if (ampm === 'am' && hours === 12) {
    hours = 0;
  }
  var givenTime = new Date();
  givenTime.setHours(hours, minutes, 0, 0);
  return givenTime;
}


function clockUpdate () {
  // Update the clock with the latest time
  const now = new Date();
  let hours = now.getHours();
  let minutes = now.getMinutes();
  minutes = minutes < 10 ? '0'+minutes : minutes;
  let seconds = now.getSeconds();
  seconds = seconds < 10 ? '0'+seconds : seconds;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  $("DIV#clock").html(hours+':'+minutes+'<span class="ampm">'+ampm+'</span>');

  // Check to see if we should be blanking
  if ( blanking !== false && now >= blanking.start && now < blanking.end ) { // it's time to blank now
    if ( debug ) console.log("Blanking starts now.");
    clearInterval(rotationInterval);  // stop the rotation timer
    clearInterval(clockInterval);
    $('DIV#clock').fadeOut(2000);  // hide the panes and clock
    $('DIV.pane').stop(true, true).fadeOut(2000);
    setTimeout(function(){ $('DIV.pane').html(' '); },2001);
    const timeDifference = blanking.end.getTime() - now.getTime() + 1000;  // how long are we blank?
    setTimeout(function(){  // reload the page when the blanking is done.
      if ( debug ) console.log("Blanking ends now.");
      window.location.reload(true);
    },Math.max(0,timeDifference));
    if (debug ) console.log("Coming back from blank in "+timeDifference+' or at '+blanking.end);
  }
}
