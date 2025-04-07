var art = [];
var timer;
var rotationSpeed = 60;  // <<== change this to however long you want to show each image, in minutes
var rotationInterval;
var imageFit = 'contain';
var debug = false;
var showClock = false;
var clockInterval;


function loadConfiguration ( path ) {
  // attempt to load configuration from a file
  fetch('art/config.json')
    .then(response => {
      if (!response.ok) {
        if (debug) console.log('Configuration: Additional configuration not available in "'+path+'".');
      }
      return response.json();
    })
    .then(data => {
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          switch (key) {
            case 'debug':
            case 'showClock':
            case 'rotationSpeed':
            case 'imageFit':
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
      if ( imageFit!='contain' && imageFit!='cover' ) imageFit = 'contain'; // default is contain
      if ( debug ) $('DIV.pane').addClass('debug');  // debug
    })
    .catch(error => {
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

  const mediaUrl = 'api.php?image&cachebuster='+Date.now().toString();
  $.ajax({
    url: mediaUrl,
    method: 'GET',
    xhrFields: {
      responseType: 'blob' // Get the data as a Blob directly
    },
    success: function(data, status, xhr) {
      if (status === 'success') {
        const contentType = xhr.getResponseHeader('Content-Type');
        //console.log("Successfully pulled the media: "+contentType);

        //console.log("showing "+on); // remove
        $('DIV#'+on).css('z-index',1);  // put this in back
        $('DIV#'+off).css('z-index',2);

        if ( contentType && contentType.startsWith('image/') ) {
          $('DIV#'+on).html('<img class="'+imageFit+'" src="'+URL.createObjectURL(data)+'" />');
          $('DIV#'+on+' IMG').on('load',function() {
            //console.log('image loaded for '+on);
            $('DIV#'+on).fadeIn(fadeTime); // show this, behind
            $('DIV#'+on).addClass('active');
            $('DIV#'+off).fadeOut(fadeTime); // hide other, from front
            setTimeout(function(){ $('DIV#'+off+' VIDEO').trigger('pause'); },fadeTime); // stop playing the video, if present
            $('DIV#'+off).removeClass('active');
          });
        } else if ( contentType && contentType.startsWith('video/') ) {
          $('DIV#'+on).html('<video muted loop src="'+URL.createObjectURL(data)+'"></video>');
          $('DIV#'+on+' VIDEO').on('loadeddata',function() {
            //console.log('video loaded for '+on);
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
      console.error("Error fetching data:", status, error);
    }
  });


  /**
  @todo You've ruined the snow! How can I tell if the image should have snow??
  */
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
}


loadConfiguration('art/config.json');


// when the document is loaded
$(document).ready(function() {

  // start the rotation
  $('DIV#one IMG').fadeIn(2000);
  setTimeout(function (){
    rotate();
    rotationInterval = setInterval(rotate,rotationSpeed*60*1000);

    // show and update the clock
    if ( showClock ) {
      setTimeout(function(){ $("DIV#clock").fadeIn(1000); },400);
      clockInterval = setInterval(clockUpdate,30000);
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
