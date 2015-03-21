@ECHO OFF

IF EXIST sites-scanner.PublishSettings (
	tools\WAWSDeploy\WAWSDeploy.exe dev sites-scanner.PublishSettings
) ELSE ( ECHO The file 'sites-scanner.PublishSettings' including credentials does not exists!
PAUSE )