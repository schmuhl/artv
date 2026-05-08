<?php
// load the configuration file, if available
$tv = ( isset($_GET['tv']) && is_numeric($_GET['tv']) ) ? $_GET['tv'] : null;
if ( $tv && file_exists("art/config-$tv.json") ) $configFile = "art/config-$tv.json";
else $configFile = 'art/config.json';

$config = null;
if ( file_exists($configFile) ) {
  $json = file_get_contents($configFile);
  if ( $json !== false ) {
    $config = json_decode($json);
    if ( json_last_error() !== JSON_ERROR_NONE ) {
      error_log("Configuration file is not valid JSON: $configFile ".json_last_error_msg());
    }
  } else {
    error_log("Failed to read config file: $configFile");
  }
  // process values
  //print_r($config);
  //$debug = $config->debug;
  $debug = ( isset($_GET['debug']) ) ? true : false;
  $cache = '/tmp/artv-cache';
  $cacheLength = 60*5;  // in seconds

  // set the timezone
  if (isset($config->timezone) && !empty($config->timezone)) {
    try {
        date_default_timezone_set($config->timezone);
    } catch (Exception $e) {
      //echo "Error setting timezone from config file. Using server's default.<br>";
      date_default_timezone_set(date_default_timezone_get());
    }
  } else {
      //echo "No 'timezone' specified in config.json. Using server's default.<br>";
      date_default_timezone_set(date_default_timezone_get());
  }
}

if (!$config) {
  http_response_code(500);
  error_log("Missing or invalid config file: $configFile");
  exit();
}



// ------------------------------ PULL FROM ICLOUD SHARED ALBUM
if ( isset($config->iCloud) && isset($config->iCloud->enabled) && $config->iCloud->enabled
     && isset($config->iCloud->url) && !empty($config->iCloud->url) ) {

    $files = [];
    // Extract the Token from the end of the URL (after the #)
    $albumId = explode('#', $config->iCloud->url)[1] ?? '';
    $cacheFile = $cache . '-iCloud-tv' . $tv . '.json';

    if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < $cacheLength)) {
      $cached = json_decode(file_get_contents($cacheFile), true);
      if (is_array($cached) && !empty($cached)) {
        $files = $cached;
      }
      if (is_array($cached)) {
        $files = $cached;
      }
    }

    if (empty($files)) {
        $files = fetchICloudAlbumList($albumId);
        if (!empty($files)) {
            file_put_contents($cacheFile, json_encode($files));
        }
    }

    if (!empty($files)) {
        $target = $files[array_rand($files)];
        if ($debug) {
            header('Content-type: application/json');
            echo json_encode(["tv" => $tv, "count" => count($files), "target" => $target]);
        } else {
            header("Location: $target", true, 302);
        }
        exit();
    } else {
        outputFile('arTV-error.jpg');
        exit();
    }
}

/**
 * Fetches the list of tokenized URLs from iCloud
 */
 function fetchICloudAlbumList($albumId) {

    $host = "p23-sharedstreams.icloud.com";

    $baseUrl = "https://{$host}/{$albumId}/sharedstreams";

    // Initial metadata request
    $response = callICloudApi(
        "{$baseUrl}/webstream",
        json_encode([
            "streamCtag" => null
        ])
    );

    $data = json_decode($response, true);

    // Handle Apple partition redirect
    if (isset($data['X-Apple-MMe-Host'])) {

        $host = $data['X-Apple-MMe-Host'];

        $baseUrl = "https://{$host}/{$albumId}/sharedstreams";

        $response = callICloudApi(
            "{$baseUrl}/webstream",
            json_encode([
                "streamCtag" => null
            ])
        );

        $data = json_decode($response, true);
    }

    if (
        !isset($data['photos']) ||
        !is_array($data['photos']) ||
        empty($data['photos'])
    ) {
        return [];
    }

    // Collect photo GUIDs (keep only real image photos if possible)
    $photoGuids = [];
    foreach ($data['photos'] as $photo) {
        if (
            !isset($photo['photoGuid']) ||
            !isset($photo['derivatives']) ||
            !is_array($photo['derivatives']) ||
            empty($photo['derivatives'])
        ) {
            continue;
        }
        $photoGuids[] = $photo['photoGuid'];
    }

    if (empty($photoGuids)) {
        return [];
    }

    // Request signed asset URLs
    $assetResponse = callICloudApi(
        "{$baseUrl}/webasseturls",
        json_encode([
            "photoGuids" => $photoGuids
        ])
    );

    $assetData = json_decode($assetResponse, true);

    if (
        !isset($assetData['items']) ||
        !is_array($assetData['items'])
    ) {
        return [];
    }

    $urls = [];

    foreach ($assetData['items'] as $guid => $item) {

      // look for derivatives first
      if (isset($item['derivatives']) && is_array($item['derivatives'])) {
        $best = null;
        $bestSize = 0;

        foreach ($item['derivatives'] as $size => $d) {
          if ((int)$size > $bestSize && isset($d['checksum'])) {
            $best = $d;
            $bestSize = (int)$size;
          }
        }

        if ($best && isset($item['url_location'])) {
          $urls[] =
            "https://" .
            $item['url_location'] .
            $best['checksum'];
          continue;
        }
      }

      // then, look for this kind of url
      if (isset($item['url_location'], $item['url_path'])) {
        $urls[] = "https://" . $item['url_location'] . $item['url_path'];
        continue;
      }

      // last, look for normal urls
      if (isset($item['url'])) {
        $urls[] = $item['url'];
      }

      // LAST RESORT (some responses embed full CDN info differently)
      if (isset($item['urls'][0])) {
          $urls[] = $item['urls'][0];
      }
    }
    return $urls;
  }

/**
 * Helper to handle the POST with headers that bypass Apple's 400/403 filters
 */
 function callICloudApi($url, $postData) {

     $ch = curl_init($url);

     curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
     curl_setopt($ch, CURLOPT_POST, true);
     curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);

     curl_setopt($ch, CURLOPT_HTTPHEADER, [
         'Content-Type: application/json',
         'Origin: https://www.icloud.com',
         'Referer: https://www.icloud.com/',
     ]);

     curl_setopt($ch, CURLOPT_USERAGENT,
         'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
     );

     $response = curl_exec($ch);

     curl_close($ch);

     return $response;
 }




// ------------------------------ PULL FROM GOOGLE DRIVE
if ( isset($config->GoogleDrive) && isset($config->GoogleDrive->enabled) && $config->GoogleDrive->enabled ) {
  require __DIR__ . '/googleDrive/vendor/autoload.php';

  // Ensure the service file exists
  if ( isset($config->GoogleDrive->serviceAccountFile) && is_file($config->GoogleDrive->serviceAccountFile) ) {
    $client = new Google_Client();
    $client->setApplicationName('Drive Downloader');
    $client->setAuthConfig($config->GoogleDrive->serviceAccountFile);
    $client->addScope(Google_Service_Drive::DRIVE_READONLY);
    $service = new Google_Service_Drive($client);
    try {
      $results = $service->files->listFiles([
          'q' => "'".$config->GoogleDrive->folderID."' in parents and ( mimeType contains 'image/' or mimeType contains 'video/' )", // Filter for images and videos
          'fields' => 'files(id, name, mimeType)',
      ]);
      $files = $results->getFiles();
      if ( $debug ) {  // show the list of eligible files instead
        header("HTTP/1.1 200 OK");
        header('Content-type: text/json');
        echo json_encode(array_values($files)); // Encode the file listing as JSON
        exit();
      }

      if ( count($files) > 0 ) {  // if we have more than one file
        //print_r($files); print_r(count($files)); die();
        $file = $files[rand(0,count($files)-1)];
        //print_r($file); die();
        $fileId = $file->id; //access id as an object property.
        $name = $file->getName();
        $mimeType = $file->getMimeType();

        try {  // get the file from Google Drive
          $response = $service->files->get($fileId, ['alt' => 'media']);
          if ($response->getStatusCode() == 200) {
            header("HTTP/1.1 200 OK");
            if (!empty($mimeType)) header('Content-type: ' . $mimeType);
              header('Content-Length: ' . $response->getHeaderLine('Content-Length')); // Get content length from response
              header('X-Image-Filename: ' . $name);
              header('Cache-Control: no-cache, no-store, must-revalidate');
              header('Pragma: no-cache');
              header('Expires: 0');
              fpassthru($response->getBody()->detach()); // Stream the response body directly to the output
              exit();
            } else {
              //header("HTTP/1.1 " . $response->getStatusCode());
              //echo json_encode(['error' => 'Failed to download file.', 'status_code' => $response->getStatusCode()]);
              //exit();
            }
        } catch (Google_Service_Exception $e) {
            error_log('Error downloading file: ' . $e->getMessage());
            //header("HTTP/1.1 500 Internal Server Error");
            //echo json_encode(['error' => 'Failed to download file.']);
            //exit();
        }
      } else {  // no files were in the google drive folder
        error_log("No files found in specified Google Drive.");
      }
    } catch (Exception $e) {  // exception fired on getting drive folder items
      error_log("Error getting items from Google Drive folder " . $e->getMessage());
    }
  } else {  // couldn't find service file
    error_log("Could not open Google Drive API service file.");
  }

  // Something went wrong. Show the error message instead.
  outputFile('arTV-error.jpg');
  exit();
}



// ------------------------------ PULL FROM LOCAL ART FOLDER
$files = array();
$directory = 'art';
if ( is_dir($directory) ) {  // get a list of media files from the art directory
  $files = getArt($directory);  // from the main folder, works for every day of the year
  $today = getdate();
  $files = array_merge($files,getArt('art/'.$today['mon']));  // monthly art
  $today = getArt('art/'.$today['mon'].'/'.$today['mon'].'-'.$today['mday']);  // daily art
  if ( count($today) > 0 ) $files = $today;
  // only look at image files
  $files2 = $files;
  $files = array();
  foreach ( $files2 as $file ) {
    $type = @mime_content_type($file);
    if ( !empty($type) && in_array(substr($type,0,5),array('image','video')) ) $files []= $file;
  }

  if ( $debug ) {  // if requested as a list, show the data
    header("HTTP/1.1 200 OK");
    header('Content-type: text/json');
    echo json_encode(array_values($files)); // Encode the file listing as JSON
    exit();
  }
} else {
  error_log("Could not find the download directory: $directory");
}

// return the contents of a random media
//print_r($files);
if ( count($files) > 0 ) $file = $files[array_rand($files,1)];
else $file = 'arTV-error.jpg';
outputFile($file);


// Look at a path and return all the images
function getArt ( $directory ) {
  //echo "\nLooking in $directory ...";
  if ( !is_dir($directory) ) return array();
  $files = scandir($directory); // Get file listing
  $temp = array();
  foreach ( $files as $file ) {
    if ( $file == '.DS_Store' || is_dir($directory.'/'.$file) || substr($file,0,2) == '._' ) continue;
    //if ( !is_array(getimagesize($directory.'/'.$file)) ) continue;
    //if ( filesize($directory.'/'.$file) < 100000 ) continue;
    $temp []= $directory.'/'.$file;
  }
  //echo " found ".count($temp)." files.";
  return $temp;
}





function outputFile ( $file ) {
  header("HTTP/1.1 200 OK");
  header('Content-type: '.mime_content_type($file));
  header('Content-Length: '.filesize($file));
  header('X-Image-Filename: '.$file);
  header('Cache-Control: no-cache, no-store, must-revalidate');
  header('Pragma: no-cache'); // For older browsers (HTTP 1.0)
  header('Expires: 0'); // For older browsers (HTTP 1.0)
  //echo file_get_contents($file);  // performance: must load entire file into memory. Not good.
  $handle = fopen($file, "rb");
  if ($handle === false ) {
    header("HTTP/1.1 500 Internal Server Error");
    echo "Error: Could not open file '$file'.";
    exit();
  }
  while (!feof($handle)) {
      $buffer = fread($handle, 8192); // Read in 8KB chunks (adjust as needed)
      if ($buffer !== false) {
          echo $buffer;
      } else {
          break;
      }
  }
  fclose($handle);
  exit();
}
