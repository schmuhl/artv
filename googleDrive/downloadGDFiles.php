<?php

/**

sudo apt update
sudo apt upgrade -y
sudo apt install curl php-cli php-mbstring zip unzip -y
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer

cd /var/www/html/artv
mkdir googleDrive
cd googleDrive
composer init
composer require google/apiclient:^2.0

touch downloadGDFiles.php
chmod +x downloadGDFiles.php

crontab -e
Add something like this:     0 * * * * php /path/to/your/drive_downloader/download_drive_files.php


## Set Up Google Cloud Project and Enable the Drive API
Create a Google Cloud Project:
  Go to the Google Cloud Console (console.cloud.google.com).
  Create a new project.
Enable the Google Drive API:
  In your project, search for "Google Drive API" in the API Library.
  Enable the API.
Create Service Account and Download Credentials:
  In the Google Cloud Console, go to "IAM & Admin" -> "Service Accounts."
  Create a new service account.
  Grant the service account the "Viewer" role on the Google Drive folder.
  Create a JSON key for the service account and download it. This file contains your credentials.
Share your Google Drive folder with the Service Account:
  In your Google Drive folder, add the email address of the service account as a viewer. (e.g. google-drive-downloader@artv-452806.iam.gserviceaccount.com)

*/


//require __DIR__ . '/vendor/autoload.php';
require __DIR__ . '/vendor/autoload.php';

// Replace with your service account key file path, folder ID, and download directory
$SERVICE_ACCOUNT_FILE = './artv-452806-160279c8ff53.json'; /** @todo MOVE THIS TO SAFE PLACE! */
$FOLDER_ID = '1OMAP-oylVamd7B53P1SqP6Wggq9CbfC-';
//$DOWNLOAD_DIR = '/var/www/html/artv/art/';
$DOWNLOAD_DIR = '/Applications/MAMP/htdocs/artv/art/';

$client = new Google_Client();
$client->setApplicationName('Drive Downloader');
$client->setAuthConfig($SERVICE_ACCOUNT_FILE);
$client->addScope(Google_Service_Drive::DRIVE_READONLY);

$service = new Google_Service_Drive($client);

$results = $service->files->listFiles([
    'q' => "'$FOLDER_ID' in parents",
    'fields' => 'files(name, webContentLink)',
]);

$files = $results->getFiles();

if (empty($files)) {
    echo "No files found.\n";
} else {
    if (!is_dir($DOWNLOAD_DIR)) {
        mkdir($DOWNLOAD_DIR, 0755, true);
    }

    foreach ($files as $file) {
        $name = $file->getName();
        $downloadUrl = $file->getWebContentLink();

        if ($downloadUrl) {
            echo "Downloading $name...\n";
            $fileContent = file_get_contents($downloadUrl);

            if ($fileContent !== false) {
                file_put_contents($DOWNLOAD_DIR . '/' . $name, $fileContent);
                echo "$name downloaded successfully.\n";

                if (chmod($DOWNLOAD_DIR . '/' . $name, 0764)) {
                  echo "Permissions changed successfully.\n";
                } else {
                  echo "Failed to change permissions.\n";
                }

            } else {
                echo "Error downloading $name.\n";
            }
        } else {
            echo "Skipping $name: No download URL found.\n";
        }
    }
}
?>
