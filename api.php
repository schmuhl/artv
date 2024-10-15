<?php

// get the art
$files = getArt('art');  // from the main folder, works for every day of the year
$today = getdate();
$files = array_merge($files,getArt('art/'.$today['mon']));  // monthly art
$files = array_merge($files,getArt('art/'.$today['mon'].'/'.$today['mday']));  // daily art
//print_r($files);

// show the data
header("HTTP/1.1 200 OK");
header('Content-type: text/json');
echo json_encode(array_values($files)); // Encode the file listing as JSON
exit();




function getArt ( $directory ) {
  //echo "\nLooking in $directory ...";
  if ( !is_dir($directory) ) return array();
  $files = scandir($directory); // Get file listing
  $temp = array();
  foreach ( $files as $file ) {
    if ( $file == '.DS_Store' || is_dir($directory.'/'.$file) || substr($file,0,2) == '._' ) continue;
    $temp []= $file;
  }
  //echo " found ".count($temp)." files.";
  return $temp;
}
