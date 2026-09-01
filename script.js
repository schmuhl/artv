var screenid = null;
var rotationSpeed = 60;
var rotationInterval = null;
var imageFit = 'contain';
var debug = false;
var showClock = false;
var blanking = false;
var isBlanked = false;
var clockInterval = null;
var configuredTimezone = null;
var isRotating = false;
var mediaRequest = null;

// Some older TV browsers do not expose console methods unless a debugger is open.
if (!window.console) window.console = {};
if (!window.console.log) window.console.log = function () {};
if (!window.console.warn) window.console.warn = function () {};
if (!window.console.error) window.console.error = function () {};

document.addEventListener('DOMContentLoaded', function () {
  loadConfiguration(startApp);
});

function startApp() {
  var paneOne = document.getElementById('one');
  var clock = document.getElementById('clock');

  addClass(paneOne, 'active');

  setTimeout(function () {
    rotate();
    rotationInterval = setInterval(rotate, rotationSpeed * 60 * 1000);

    if (showClock) {
      clock.style.display = 'block';
      clock.style.opacity = '0';
      setTimeout(function () {
        clock.style.opacity = '1';
      }, 100);
    }

    if (showClock || blanking) {
      clockUpdate();
      clockInterval = setInterval(clockUpdate, 20000);
    }
  }, 4000);

  document.addEventListener('click', rotate);
  document.addEventListener('keyup', handleKeyUp);
}

function handleKeyUp(event) {
  var panes;
  var i;
  var image;
  var isVisible;

  if (event.key === 'd' || event.keyCode === 68) {
    debug = !debug;
    panes = document.querySelectorAll('.pane');
    for (i = 0; i < panes.length; i += 1) {
      toggleClass(panes[i], 'debug', debug);
    }
    console.log('Toggling debug to ' + debug);
  } else if (event.key === 'c' || event.keyCode === 67) {
    isVisible = document.getElementById('clock').style.display !== 'none';
    document.getElementById('clock').style.display = isVisible ? 'none' : 'block';
    console.log('Toggling clock to ' + !isVisible);
  } else if (event.key === 'f' || event.keyCode === 70) {
    imageFit = imageFit === 'cover' ? 'contain' : 'cover';
    panes = document.querySelectorAll('.pane');
    for (i = 0; i < panes.length; i += 1) {
      panes[i].setAttribute('data-fit', imageFit);
      image = panes[i].querySelector('img.media');
      if (image) image.className = 'media ' + imageFit;
    }
    console.log('Toggling image fit to ' + imageFit);
  }
}

function loadConfiguration(done) {
  var request = new XMLHttpRequest();
  var finished = false;

  screenid = getQueryParameter('screen');

  function finish() {
    if (finished) return;
    finished = true;
    done();
  }

  request.open('GET', 'art/config.json?cb=' + new Date().getTime(), true);
  request.timeout = 10000;
  request.onreadystatechange = function () {
    var data;
    if (request.readyState !== 4) return;

    if (request.status >= 200 && request.status < 300) {
      try {
        data = JSON.parse(request.responseText);
        applyConfiguration(data);
        console.log('Configuration successfully loaded.');
      } catch (error) {
        console.warn('Using default config due to error:', error);
      }
    }
    finish();
  };
  request.onerror = finish;
  request.ontimeout = finish;

  try {
    request.send();
  } catch (error) {
    console.warn('Using default config due to error:', error);
    finish();
  }
}

function applyConfiguration(data) {
  var screenKey = 'Screen' + screenid;
  var overrides;
  var key;

  if (screenid && data[screenKey]) {
    console.log('Applying configuration for screen ' + screenid);
    overrides = data[screenKey];
    for (key in overrides) {
      if (Object.prototype.hasOwnProperty.call(overrides, key)) data[key] = overrides[key];
    }
  }

  if (typeof data.debug !== 'undefined') debug = data.debug;
  if (typeof data.showClock !== 'undefined') showClock = data.showClock;
  if (typeof data.rotationSpeed !== 'undefined') rotationSpeed = Number(data.rotationSpeed);
  if (typeof data.imageFit !== 'undefined') imageFit = data.imageFit;
  if (typeof data.blanking !== 'undefined') blanking = data.blanking;
  if (typeof data.timezone !== 'undefined') configuredTimezone = data.timezone;

  if (!isFinite(rotationSpeed) || rotationSpeed <= 0) rotationSpeed = 60;
  if (imageFit !== 'contain' && imageFit !== 'cover') imageFit = 'contain';

  if (blanking && blanking.start && blanking.end) {
    blanking.start = stringToMinutes(blanking.start);
    blanking.end = stringToMinutes(blanking.end);
    if (blanking.start === null || blanking.end === null) blanking = false;
  }
}

function rotate() {
  var offPane;
  var onPane;
  var mediaUrl;
  var request;

  if (isBlanked || isRotating) return;
  isRotating = true;

  offPane = document.querySelector('.pane.active');
  if (!offPane) offPane = document.getElementById('one');
  onPane = document.getElementById(offPane.id === 'one' ? 'two' : 'one');

  mediaUrl = 'api.php?screen=' + encodeURIComponent(screenid || '') + '&cb=' + new Date().getTime();
  request = new XMLHttpRequest();
  mediaRequest = request;
  request.open('GET', mediaUrl, true);
  request.timeout = 30000;

  try {
    request.responseType = 'blob';
  } catch (error) {
    finishRotationError('This browser does not support binary media responses.');
    return;
  }

  request.onload = function () {
    var contentType;
    var blobUrl;

    if (request.status < 200 || request.status >= 300) {
      finishRotationError('Media request failed with HTTP ' + request.status);
      return;
    }

    contentType = (request.getResponseHeader('Content-Type') || '').split(';')[0].toLowerCase();
    if (contentType.indexOf('image/') !== 0 && contentType.indexOf('video/') !== 0) {
      finishRotationError('Unsupported media type: ' + (contentType || 'missing Content-Type'));
      return;
    }

    if (isBlanked) {
      isRotating = false;
      mediaRequest = null;
      return;
    }

    blobUrl = createBlobUrl(request.response);
    if (!blobUrl) {
      finishRotationError('This browser cannot create a media URL.');
      return;
    }

    clearPane(onPane);
    onPane.setAttribute('data-blob-url', blobUrl);

    if (contentType.indexOf('image/') === 0) prepareImage(onPane, offPane, blobUrl);
    else prepareVideo(onPane, offPane, blobUrl);
  };

  request.onerror = function () {
    finishRotationError('Media request failed.');
  };
  request.ontimeout = function () {
    finishRotationError('Media request timed out.');
  };
  request.onabort = function () {
    isRotating = false;
    mediaRequest = null;
  };

  try {
    request.send();
  } catch (error) {
    finishRotationError(error.message || 'Media request failed.');
  }
}

function prepareImage(onPane, offPane, blobUrl) {
  var backdrop = document.createElement('img');
  var image = document.createElement('img');

  onPane.setAttribute('data-fit', imageFit);
  backdrop.className = 'backdrop';
  backdrop.alt = '';
  backdrop.src = blobUrl;

  image.className = 'media ' + imageFit;
  image.alt = '';
  image.onload = function () {
    performSwap(onPane, offPane);
  };
  image.onerror = function () {
    handleMediaError(onPane, blobUrl, 'Image failed to decode.');
  };
  image.src = blobUrl;

  onPane.appendChild(backdrop);
  onPane.appendChild(image);
}

function prepareVideo(onPane, offPane, blobUrl) {
  var video = document.createElement('video');

  onPane.setAttribute('data-fit', 'contain');
  video.muted = true;
  video.loop = true;
  video.setAttribute('playsinline', '');
  video.onloadeddata = function () {
    try {
      video.play();
    } catch (error) {
      console.warn('Video autoplay failed:', error);
    }
    performSwap(onPane, offPane);
  };
  video.onerror = function () {
    handleMediaError(onPane, blobUrl, 'Video failed to decode.');
  };
  video.src = blobUrl;
  onPane.appendChild(video);
}

function performSwap(onPane, offPane) {
  onPane.style.visibility = 'visible';
  addClass(onPane, 'active');
  removeClass(offPane, 'active');
  isRotating = false;
  mediaRequest = null;

  setTimeout(function () {
    if (!hasClass(offPane, 'active')) clearPane(offPane);
  }, 2200);
}

function handleMediaError(pane, blobUrl, message) {
  if (pane.getAttribute('data-blob-url') === blobUrl) clearPane(pane);
  finishRotationError(message);
}

function finishRotationError(message) {
  isRotating = false;
  mediaRequest = null;
  console.error('Rotate failed: ' + message);
}

function clearPane(pane) {
  var blobUrl = pane.getAttribute('data-blob-url');
  var video = pane.querySelector('video');

  if (video) {
    try {
      video.pause();
    } catch (error) {
      // Ignore browsers that cannot pause an unloaded video.
    }
  }

  while (pane.firstChild) pane.removeChild(pane.firstChild);
  pane.removeAttribute('data-fit');
  pane.removeAttribute('data-blob-url');
  if (blobUrl) revokeBlobUrl(blobUrl);
}

function createBlobUrl(blob) {
  var urlApi = window.URL || window.webkitURL;
  return urlApi && urlApi.createObjectURL ? urlApi.createObjectURL(blob) : null;
}

function revokeBlobUrl(blobUrl) {
  var urlApi = window.URL || window.webkitURL;
  if (urlApi && urlApi.revokeObjectURL) urlApi.revokeObjectURL(blobUrl);
}

function stringToMinutes(value) {
  var match = /^(\d{1,2}):(\d{2})\s?(am|pm)$/i.exec(String(value).replace(/^\s+|\s+$/g, ''));
  var hours;
  var minutes;
  var ampm;

  if (!match) {
    console.warn('Time string "' + value + '" is not in the expected "h:mm am/pm" format.');
    return null;
  }

  hours = parseInt(match[1], 10);
  minutes = parseInt(match[2], 10);
  ampm = match[3].toLowerCase();
  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
  if (ampm === 'pm' && hours !== 12) hours += 12;
  if (ampm === 'am' && hours === 12) hours = 0;
  return (hours * 60) + minutes;
}

function clockUpdate() {
  var now = new Date();
  var clock = document.getElementById('clock');
  var time = getTimeParts(now);
  var displayHours = time.hours % 12 || 12;
  var ampm = time.hours >= 12 ? 'PM' : 'AM';
  var currentMinutes;
  var overnight;
  var shouldBlank;
  var panes;
  var i;

  clock.innerHTML = displayHours + ':' + padTwo(time.minutes) + '<span class="ampm">' + ampm + '</span>';

  if (!blanking) return;

  currentMinutes = (time.hours * 60) + time.minutes;
  overnight = blanking.start > blanking.end;
  shouldBlank = overnight
    ? currentMinutes >= blanking.start || currentMinutes < blanking.end
    : currentMinutes >= blanking.start && currentMinutes < blanking.end;

  if (shouldBlank && !isBlanked) {
    addClass(document.body, 'blanked');
    isBlanked = true;
    if (mediaRequest) mediaRequest.abort();
    panes = document.querySelectorAll('.pane');
    for (i = 0; i < panes.length; i += 1) clearPane(panes[i]);
    console.log('Entering blanking mode.');
  } else if (!shouldBlank && isBlanked) {
    removeClass(document.body, 'blanked');
    isBlanked = false;
    console.log('Exiting blanking mode: resuming.');
    rotate();
  }
}

function getTimeParts(date) {
  var formatter;
  var formatted;
  var match;
  var hours;

  if (configuredTimezone && window.Intl && Intl.DateTimeFormat) {
    try {
      formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: configuredTimezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      formatted = formatter.format(date);
      match = /(\d{1,2}):(\d{2})/.exec(formatted);
      if (match) {
        hours = parseInt(match[1], 10) % 24;
        return { hours: hours, minutes: parseInt(match[2], 10) };
      }
    } catch (error) {
      console.warn('Invalid or unsupported timezone "' + configuredTimezone + '"; using TV timezone.');
      configuredTimezone = null;
    }
  }

  return { hours: date.getHours(), minutes: date.getMinutes() };
}

function getQueryParameter(name) {
  var query = window.location.search.substring(1).split('&');
  var i;
  var pair;
  for (i = 0; i < query.length; i += 1) {
    pair = query[i].split('=');
    if (decodeURIComponent(pair[0] || '') === name) {
      return decodeURIComponent((pair[1] || '').replace(/\+/g, ' '));
    }
  }
  return null;
}

function padTwo(value) {
  return value < 10 ? '0' + value : String(value);
}

function hasClass(element, className) {
  return new RegExp('(^|\\s)' + className + '(\\s|$)').test(element.className);
}

function addClass(element, className) {
  if (!hasClass(element, className)) element.className += (element.className ? ' ' : '') + className;
}

function removeClass(element, className) {
  var expression = new RegExp('(^|\\s)' + className + '(?=\\s|$)', 'g');
  element.className = element.className.replace(expression, ' ').replace(/^\s+|\s+$/g, '').replace(/\s+/g, ' ');
}

function toggleClass(element, className, enabled) {
  if (enabled) addClass(element, className);
  else removeClass(element, className);
}
