<?php
/**
 * M/S FOUR STAR CARGO — HOSTINGER LIVE MYSQL & DISK DATA PERSISTENCE SERVICE
 * Provides ultra-low latency real-time data persistence & SSE instant broadcast across all devices
 */
@ini_set('display_errors', '0');
error_reporting(0);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

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
    // Ensure _updated_at timestamp is recorded in ms precision
    if (empty($data['_updated_at'])) {
        $data['_updated_at'] = round(microtime(true) * 1000);
    }

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
    '_updated_at' => round(microtime(true) * 1000),
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
    header('Content-Type: application/json');
    $input = file_get_contents('php://input');
    if (!empty($input)) {
        $decoded = json_decode($input, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            $isReset = !empty($decoded['is_factory_reset']);
            
            if ($isReset) {
                if ($pdo) {
                    try {
                        @$pdo->exec("TRUNCATE TABLE `fsc_system_store`");
                    } catch (Throwable $t) {}
                }
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

            $finalDb['_updated_at'] = round(microtime(true) * 1000);
            writeServerDb($pdo, $filePaths, $finalDb);

            echo json_encode(['status' => 'success', 'message' => 'Hostinger DB synchronized', '_updated_at' => $finalDb['_updated_at']]);
            exit();
        }
    }
}

// 2. GET Mode: Fast Timestamp Check for sub-second polling (20-byte payload)
if (isset($_GET['mode']) && ($_GET['mode'] === 'ts' || $_GET['mode'] === 'timestamp_check')) {
    header('Content-Type: application/json');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    $currentDb = readCurrentServerDb($pdo, $filePaths);
    $ts = isset($currentDb['_updated_at']) ? (float)$currentDb['_updated_at'] : 0;
    echo json_encode(['_updated_at' => $ts]);
    exit();
}

// 3. GET Mode: Server-Sent Events (SSE) Stream for instant zero-delay broadcast
if (isset($_GET['stream']) || (isset($_GET['mode']) && $_GET['mode'] === 'sse')) {
    header('Content-Type: text/event-stream');
    header('Cache-Control: no-cache');
    header('Connection: keep-alive');
    header('X-Accel-Buffering: no');

    $clientLastTs = isset($_GET['last_ts']) ? (float)$_GET['last_ts'] : 0;
    $startTime = time();

    while (time() - $startTime < 25) {
        $currentDb = readCurrentServerDb($pdo, $filePaths);
        $serverTs = isset($currentDb['_updated_at']) ? (float)$currentDb['_updated_at'] : 0;

        if ($serverTs > $clientLastTs) {
            echo "data: " . json_encode($currentDb, JSON_UNESCAPED_UNICODE) . "\n\n";
            @ob_flush();
            @flush();
            exit();
        }
        usleep(150000); // 150ms sleep loop for ultra-low latency detection
    }

    echo "data: {\"status\":\"ping\",\"_updated_at\":{$clientLastTs}}\n\n";
    @ob_flush();
    @flush();
    exit();
}

// 4. Standard GET Request: Read full latest database state
header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');
$currentDb = readCurrentServerDb($pdo, $filePaths);
if (!$currentDb || !is_array($currentDb)) {
    writeServerDb($pdo, $filePaths, $seedDatabase);
    echo json_encode($seedDatabase, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit();
}

echo json_encode($currentDb, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
?>
