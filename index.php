<?php
/**
 * M/S FOUR STAR CARGO — HOSTINGER PRODUCTION ENTRY POINT
 * Serves compiled dist/index.html with strict HTTP/2 protocol headers
 */

$distIndex = __DIR__ . '/dist/index.html';
if (file_exists($distIndex)) {
    $content = file_get_contents($distIndex);
    header('Content-Type: text/html; charset=utf-8');
    header('Content-Length: ' . strlen($content));
    header('Cache-Control: no-cache, no-store, must-revalidate');
    echo $content;
    exit();
}

$rootIndex = __DIR__ . '/index.html';
if (file_exists($rootIndex)) {
    $content = file_get_contents($rootIndex);
    header('Content-Type: text/html; charset=utf-8');
    header('Content-Length: ' . strlen($content));
    header('Cache-Control: no-cache, no-store, must-revalidate');
    echo $content;
    exit();
}

header("HTTP/1.1 503 Service Unavailable");
echo "Application is updating...";
?>
