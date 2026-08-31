var screenid, rotationSpeed = 60, rotationInterval, imageFit = 'contain', debug = false;
var showClock = false, blanking = false, isBlanked = false, clockInterval;
var configuredTimezone, isRotating = false;


// Wait for the DOM to be ready before starting
document.addEventListener('DOMContentLoaded', () => {
    startApp();
});


async function startApp() {
    await loadConfiguration();

    const paneOne = document.getElementById('one');
    const clock = document.getElementById('clock');

    // Initial Splash
    paneOne.classList.add('active');

    setTimeout(() => {
      rotate();
      rotationInterval = setInterval(rotate, rotationSpeed * 60 * 1000);

      if (showClock) {
        clock.style.display = 'block';
        clock.style.opacity = '0';
        setTimeout(() => clock.style.opacity = '1', 100);
      }

      if (showClock || blanking) {
        clockUpdate();
        clockInterval = setInterval(clockUpdate, 20000);
      }
    }, 4000);

    // Click to rotate
    document.addEventListener('click', () => rotate());

    // Hotkeys (Simplified Native version)
    document.addEventListener('keyup', (e) => {
      const panes = document.querySelectorAll('.pane');
      if (e.key === 'd') {
        debug = !debug;
        console.log("Toggling debug to "+debug);
        panes.forEach(p => p.classList.toggle('debug', debug));
      } else if (e.key === 'c') {
        const isVisible = clock.style.display !== 'none';
        clock.style.display = isVisible ? 'none' : 'block';
        console.log("Toggling clock to "+!isVisible);
      } else if (e.key === 'f') {
        imageFit = (imageFit === 'cover') ? 'contain' : 'cover';
        document.querySelectorAll('.pane').forEach(pane => {
            pane.dataset.fit = imageFit;
            const img = pane.querySelector('img.media');
            if (img) img.className = `media ${imageFit}`;
        });
        console.log("Toggling image fit to "+imageFit);
      }
    });
}


async function loadConfiguration() {
  var path = 'art/config.json';
  const urlParams = new URLSearchParams(window.location.search);
  screenid = urlParams.get('screen');
  const screenKey = "Screen" + screenid;

  try {
    const response = await fetch(path);
    if (!response.ok) return; // Use defaults if file missing

    let data = await response.json();

    // look for configuration overrides for this screen
    if ( screenid && data[screenKey]) {
      console.log(`Applying configuration for screen ${screenid}`);
      data = { ...data, ...data[screenKey] };
    }

    // Map data to global variables
    if (data.debug !== undefined) debug = data.debug;
    if (data.showClock !== undefined) showClock = data.showClock;
    if (data.rotationSpeed !== undefined) rotationSpeed = data.rotationSpeed;
    if (data.imageFit !== undefined) imageFit = data.imageFit;
    if (data.blanking !== undefined) blanking = data.blanking;
    if (data.timezone !== undefined) configuredTimezone = data.timezone;

    if (imageFit !== 'contain' && imageFit !== 'cover') imageFit = 'contain';

    // Process blanking times if they exist
    if (blanking && blanking.start && blanking.end) {
      blanking.start = stringToMinutes(blanking.start);
      blanking.end = stringToMinutes(blanking.end);
      if (blanking.start === null || blanking.end === null) blanking = false;
    }

    console.log("Configuration successfully loaded.");
  } catch (e) {
    console.warn("Using default config due to error:", e);
  }
}


async function rotate() {
  if (isBlanked || isRotating) return;
  isRotating = true;
  // 1. Find the active pane, with a fallback to 'one' if none is active yet
  let offPane = document.querySelector('.pane.active');

  // If somehow no pane is active, default to #one so the script doesn't crash
  if (!offPane) {
    offPane = document.getElementById('one');
  }

  const onPane = document.getElementById(offPane.id === 'one' ? 'two' : 'one');

  const mediaUrl = `api.php?screen=${screenid}&cb=${Date.now()}`;

  let blobUrl;
  try {
    const response = await fetch(mediaUrl);
    if (!response.ok) throw new Error(`Media request failed with HTTP ${response.status}`);

    const contentType = (response.headers.get('Content-Type') || '').split(';', 1)[0].toLowerCase();
    if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
      throw new Error(`Unsupported media type: ${contentType || 'missing Content-Type'}`);
    }

    const blob = await response.blob();
    if (isBlanked) {
      isRotating = false;
      return;
    }
    blobUrl = URL.createObjectURL(blob);
    clearPane(onPane);
    onPane.dataset.blobUrl = blobUrl;

    if (contentType.startsWith('image/')) {
      onPane.dataset.fit = imageFit;
      const backdrop = document.createElement('img');
      backdrop.className = 'backdrop';
      backdrop.alt = '';
      backdrop.src = blobUrl;

      const image = document.createElement('img');
      image.className = `media ${imageFit}`;
      image.alt = '';
      image.onload = () => performSwap(onPane, offPane);
      image.onerror = () => handleMediaError(onPane, blobUrl, new Error('Image failed to decode'));
      image.src = blobUrl;
      onPane.append(backdrop, image);
    } else if (contentType.startsWith('video/')) {
      onPane.dataset.fit = 'contain';
      const video = document.createElement('video');
      video.muted = true;
      video.loop = true;
      video.src = blobUrl;
      video.onloadeddata = () => {
        video.play().catch(err => console.warn('Video autoplay failed', err));
        performSwap(onPane, offPane);
      };
      video.onerror = () => handleMediaError(onPane, blobUrl, new Error('Video failed to decode'));
      onPane.append(video);
    }
  } catch (err) {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    isRotating = false;
    console.error("Rotate failed", err);
  }
}

function performSwap(on, off) {
    // Make sure new pane starts visible to the browser
    on.style.visibility = 'visible';

    // Trigger crossfade immediately
    on.classList.add('active');
    off.classList.remove('active');
    isRotating = false;

    // Cleanup old pane after fade completes
    setTimeout(() => {
        if (!off.classList.contains('active')) {
            clearPane(off);
        }
    }, 2200);
}

function handleMediaError(pane, blobUrl, error) {
  if (pane.dataset.blobUrl === blobUrl) clearPane(pane);
  isRotating = false;
  console.error('Rotate failed', error);
}

function clearPane(pane) {
  const blobUrl = pane.dataset.blobUrl;
  pane.replaceChildren();
  delete pane.dataset.fit;
  delete pane.dataset.blobUrl;
  if (blobUrl) URL.revokeObjectURL(blobUrl);
}


function stringToMinutes ( string ) {
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
  return (hours * 60) + minutes;
}


function clockUpdate() {
  const now = new Date();
  const clock = document.getElementById('clock');

  let parts;
  try {
    parts = clockParts(now, configuredTimezone);
  } catch (error) {
    console.warn(`Invalid timezone "${configuredTimezone}"; using the device timezone.`, error);
    configuredTimezone = undefined;
    parts = clockParts(now);
  }

  const value = type => parts.find(part => part.type === type)?.value || '';
  const hours = value('hour');
  const minutes = value('minute');
  const ampm = value('dayPeriod');
  clock.innerHTML = `${hours}:${minutes}<span class="ampm">${ampm}</span>`;

  if (blanking) {
    const currentMinutes = timeInConfiguredTimezone(now);
    const overnight = blanking.start > blanking.end;
    const shouldBlank = overnight
      ? currentMinutes >= blanking.start || currentMinutes < blanking.end
      : currentMinutes >= blanking.start && currentMinutes < blanking.end;

    if (shouldBlank) {
      if (!document.body.classList.contains('blanked')) document.body.classList.add('blanked');
      document.querySelectorAll('.pane').forEach(clearPane);
      console.log("Entering blanking mode.");
      isBlanked = true;
    } else if (document.body.classList.contains('blanked')) {
      document.body.classList.remove('blanked');
      console.log("Exiting blanking mode: resuming.");
      isBlanked = false;
      rotate(); // Immediately fetch new content
    }
  }

}

function clockParts(date, timeZone) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric', minute: '2-digit', hour12: true
  }).formatToParts(date);
}

function timeInConfiguredTimezone(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: configuredTimezone,
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  const value = type => Number(parts.find(part => part.type === type)?.value || 0);
  return (value('hour') * 60) + value('minute');
}


async function fileExists(filename) {
  try {
    const response = await fetch(filename, { method: 'HEAD' });
    return response.ok; // Returns true if status is 200-299
  } catch (error) {
    return false; // Network error or file doesn't exist
  }
}
