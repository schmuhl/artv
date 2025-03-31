<?php

// get the art
$files = getArt('art');  // from the main folder, works for every day of the year
$today = getdate();
$files = array_merge($files,getArt('art/'.$today['mon']));  // monthly art
$today = getArt('art/'.$today['mon'].'/'.$today['mon'].'-'.$today['mday']);  // daily art
if ( count($today) > 0 ) $files = $today;
if ( isset($_GET['debug']) ) {
  print_r($files);
  exit();
}


// if requested as an image, return the contents of a random image instead of a list of files
if ( isset($_GET['image']) ) {
  //print_r($files);
  if ( count($files) > 0 ) $file = $files[array_rand($files)];
  else $file = 'artv.jpg';
  header("HTTP/1.1 200 OK");
  header('Content-type: '.mime_content_type($file));
  header('Content-Length: '.filesize($file));
  header('X-Image-Filename: '.$file);
  header('Cache-Control: no-cache, no-store, must-revalidate');
  header('Pragma: no-cache'); // For older browsers (HTTP 1.0)
  header('Expires: 0'); // For older browsers (HTTP 1.0)
  echo file_get_contents($file);
  exit();
}



// show the data
header("HTTP/1.1 200 OK");
header('Content-type: text/json');
echo json_encode(array_values($files)); // Encode the file listing as JSON
exit();



// Look at a path and return all the images
function getArt ( $directory ) {
  //echo "\nLooking in $directory ...";
  if ( !is_dir($directory) ) return array();
  $files = scandir($directory); // Get file listing
  $temp = array();
  foreach ( $files as $file ) {
    if ( $file == '.DS_Store' || is_dir($directory.'/'.$file) || substr($file,0,2) == '._' ) continue;
    if ( !is_array(getimagesize($directory.'/'.$file)) ) continue;
    if ( filesize($directory.'/'.$file) < 100000 ) continue;
    $temp []= $directory.'/'.$file;
  }
  //echo " found ".count($temp)." files.";
  return $temp;
}
