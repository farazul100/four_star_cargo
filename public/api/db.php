<?php
/**
 * M/S FOUR STAR CARGO — HOSTINGER LIVE DATA SYNC SERVICE
 * Provides 100% real-time data persistence across browsers, incognito windows, and mobile devices
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$dbDir = __DIR__ . '/../../database';
if (!file_exists($dbDir) && !@mkdir($dbDir, 0777, true)) {
    $dbDir = __DIR__ . '/data';
    if (!file_exists($dbDir)) {
        @mkdir($dbDir, 0777, true);
    }
}
$dataFile = $dbDir . '/db.json';

// 1. POST Request: Save updated database state to Hostinger disk
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    if (!empty($input)) {
        $decoded = json_decode($input, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            // Read existing file to preserve keys if partial update
            $existing = [];
            if (file_exists($dataFile)) {
                $rawExisting = @file_get_contents($dataFile);
                $existing = json_decode($rawExisting, true) ?: [];
            }

            // Preserve gemini_api_key if existing has key but incoming payload has empty key
            $existingApiKey = '';
            if (!empty($existing['gemini_api_key'])) {
                $existingApiKey = $existing['gemini_api_key'];
            } else if (!empty($existing['settings']['gemini_api_key'])) {
                $existingApiKey = $existing['settings']['gemini_api_key'];
            } else if (!empty($existing['fsc_vps_settings']['gemini_api_key'])) {
                $existingApiKey = $existing['fsc_vps_settings']['gemini_api_key'];
            }
            
            $merged = array_merge($existing, $decoded);

            if (!empty($existingApiKey)) {
                if (empty($merged['gemini_api_key'])) {
                    $merged['gemini_api_key'] = $existingApiKey;
                }
                if (!isset($merged['settings']) || !is_array($merged['settings'])) {
                    $merged['settings'] = [];
                }
                if (empty($merged['settings']['gemini_api_key'])) {
                    $merged['settings']['gemini_api_key'] = $existingApiKey;
                }
                if (!isset($merged['fsc_vps_settings']) || !is_array($merged['fsc_vps_settings'])) {
                    $merged['fsc_vps_settings'] = [];
                }
                if (empty($merged['fsc_vps_settings']['gemini_api_key'])) {
                    $merged['fsc_vps_settings']['gemini_api_key'] = $existingApiKey;
                }
            }

            @file_put_contents($dataFile, json_encode($merged, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            echo json_encode(['status' => 'success', 'message' => 'Hostinger DB synchronized']);
            exit();
        }
    }
}

// 2. GET Request: Read latest database state from Hostinger disk
if (file_exists($dataFile)) {
    $content = @file_get_contents($dataFile);
    if (!empty($content)) {
        echo $content;
        exit();
    }
}

// Default fallback empty database
echo json_encode([
    'fsc_vps_users' => [
        [
            'id' => 'usr-admin-master',
            'name' => 'সুপার এডমিন (Super Admin)',
            'email' => 'superadmin@cargo.com',
            'password' => 'Cargo@2026',
            'role' => 'super_admin',
            'status' => 'active',
            'created_at' => '2026-01-01T00:00:00Z'
        ]
    ],
    'fsc_vps_warehouses' => [],
    'fsc_vps_cartons' => [],
    'fsc_vps_proposals' => [],
    'fsc_vps_customers' => [],
    'fsc_vps_ledger' => [],
    'fsc_vps_audit' => [],
    'fsc_vps_expenses' => [],
    'fsc_vps_crm_customers' => [],
    'settings' => [
        'gemini_api_key' => ''
    ],
    'fsc_vps_settings' => [
        'gemini_api_key' => ''
    ],
    'gemini_api_key' => ''
]);
?>
