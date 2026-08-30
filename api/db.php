<?php
/**
 * M/S FOUR STAR CARGO — HOSTINGER LIVE MYSQL & DISK DATA PERSISTENCE SERVICE
 * Provides 100% real-time data persistence across all browsers and devices using Hostinger MySQL & disk backup
 */
@ini_set('display_errors', '0');
error_reporting(0);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Optional config file include
if (file_exists(__DIR__ . '/config.php')) {
    @include_once __DIR__ . '/config.php';
}

// 1. Hostinger MySQL Database Connection Configuration
$dbHost = defined('FSC_DB_HOST') ? FSC_DB_HOST : (getenv('DB_HOST') ?: 'localhost');
$dbUser = defined('FSC_DB_USER') ? FSC_DB_USER : (getenv('DB_USER') ?: '');
$dbPass = defined('FSC_DB_PASS') ? FSC_DB_PASS : (getenv('DB_PASSWORD') ?: '');
$dbName = defined('FSC_DB_NAME') ? FSC_DB_NAME : (getenv('DB_NAME') ?: '');

$pdo = null;
if (!empty($dbUser) && !empty($dbName)) {
    try {
        $pdo = new PDO("mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4", $dbUser, $dbPass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_SILENT,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
        
        // Auto-create persistent KV table if not exists
        @$pdo->exec("CREATE TABLE IF NOT EXISTS `fsc_system_store` (
            `key_name` VARCHAR(64) NOT NULL PRIMARY KEY,
            `data_json` LONGTEXT NOT NULL,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    } catch (Throwable $t) {
        $pdo = null;
    }
}

// Multi-location file storage fallback
$filePaths = [
    __DIR__ . '/db.json',
    __DIR__ . '/../database/db.json',
    sys_get_temp_dir() . '/fsc_vps_db.json'
];

function readCurrentServerDb($pdo, $filePaths) {
    // Try MySQL first
    if ($pdo) {
        try {
            $stmt = $pdo->query("SELECT `key_name`, `data_json` FROM `fsc_system_store`");
            if ($stmt) {
                $rows = $stmt->fetchAll();
                if (!empty($rows)) {
                    $db = [];
                    foreach ($rows as $r) {
                        $db[$r['key_name']] = json_decode($r['data_json'], true);
                    }
                    return $db;
                }
            }
        } catch (Throwable $t) {}
    }

    // Fallback to disk files
    foreach ($filePaths as $path) {
        if (file_exists($path)) {
            $raw = @file_get_contents($path);
            if (!empty($raw)) {
                $decoded = json_decode($raw, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                    return $decoded;
                }
            }
        }
    }
    return null;
}

function writeServerDb($pdo, $filePaths, $data) {
    // Write to MySQL first
    if ($pdo) {
        try {
            $stmt = $pdo->prepare("INSERT INTO `fsc_system_store` (`key_name`, `data_json`) VALUES (:key_name, :data_json) ON DUPLICATE KEY UPDATE `data_json` = VALUES(`data_json`)");
            if ($stmt) {
                foreach ($data as $key => $val) {
                    $stmt->execute([
                        ':key_name' => $key,
                        ':data_json' => json_encode($val, JSON_UNESCAPED_UNICODE)
                    ]);
                }
            }
        } catch (Throwable $t) {}
    }

    // Write to file disk backup
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    foreach ($filePaths as $path) {
        $dir = dirname($path);
        if (!file_exists($dir)) {
            @mkdir($dir, 0777, true);
        }
        @file_put_contents($path, $json);
    }
}

// Seed initial system structure if database is completely fresh
$seedDatabase = [
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
    'fsc_vps_warehouses' => [
        [
            'id' => 'wh-china',
            'name' => 'চীন (গুয়াংজু হাব) CN',
            'code' => 'CAN',
            'country' => 'China',
            'city' => 'Guangzhou',
            'address' => 'Building A4, Baiyun Freight Center, Guangzhou',
            'manager_name' => 'তানভীর আহমেদ (Tanvir Ahmed)',
            'phone' => '+86 138 0013 8000',
            'email' => 'china@fourstarcargo.com',
            'is_final_destination' => false
        ],
        [
            'id' => 'wh-bd',
            'name' => 'বাংলাদেশ (ঢাকা সেন্ট্রাল হাব) BD',
            'code' => 'DAC-01',
            'country' => 'Bangladesh',
            'city' => 'Dhaka',
            'address' => 'House 12, Road 4, Sector 3, Uttara, Dhaka-1230',
            'manager_name' => 'রফিকুল ইসলাম (Rafiqul Islam)',
            'phone' => '+880 1819-445566',
            'email' => 'bd@fourstarcargo.com',
            'is_final_destination' => true
        ]
    ],
    'fsc_vps_cartons' => [],
    'fsc_vps_proposals' => [],
    'fsc_vps_customers' => [],
    'fsc_vps_ledger' => [],
    'fsc_vps_audit' => [],
    'fsc_vps_expenses' => [],
    'fsc_vps_crm_customers' => []
];

// 1. POST Request: Save updated database state to Hostinger MySQL & disk
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    if (!empty($input)) {
        $decoded = json_decode($input, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            // Check if Factory System Reset is requested
            $isReset = !empty($decoded['is_factory_reset']);
            
            if ($isReset) {
                // Completely purge MySQL table if connected
                if ($pdo) {
                    try {
                        @$pdo->exec("TRUNCATE TABLE `fsc_system_store`");
                    } catch (Throwable $t) {}
                }
                
                // Clear disk files
                foreach ($filePaths as $path) {
                    if (file_exists($path)) {
                        @unlink($path);
                    }
                }
                
                $finalDb = $seedDatabase;
                foreach ($decoded as $key => $val) {
                    if ($key !== 'is_factory_reset') {
                        $finalDb[$key] = $val;
                    }
                }
            } else {
                $existing = readCurrentServerDb($pdo, $filePaths);
                if (!is_array($existing)) {
                    $existing = $seedDatabase;
                }
                
                $finalDb = $existing;
                foreach ($decoded as $key => $val) {
                    $finalDb[$key] = $val;
                }
            }

            writeServerDb($pdo, $filePaths, $finalDb);
            echo json_encode(['status' => 'success', 'message' => 'Hostinger DB synchronized', 'is_factory_reset' => $isReset]);
            exit();
        }
    }
}

// 2. GET Request: Read latest database state from Hostinger MySQL / disk
$currentDb = readCurrentServerDb($pdo, $filePaths);
if (!$currentDb || !is_array($currentDb)) {
    writeServerDb($pdo, $filePaths, $seedDatabase);
    echo json_encode($seedDatabase, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit();
}

echo json_encode($currentDb, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
?>
