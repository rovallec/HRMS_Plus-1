<?php

// =========================================================
// HEADERS
// =========================================================

header('Content-Type: application/json');

header('Access-Control-Allow-Origin: *');

header('Access-Control-Allow-Methods: POST, OPTIONS');

header('Access-Control-Allow-Headers: Content-Type, Authorization');

// =========================================================
// PRE-FLIGHT
// =========================================================

try {
    
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {

    http_response_code(200);

    exit();

}

// =========================================================
// INPUT
// =========================================================

$input = json_decode(
    file_get_contents("php://input"),
    true
);

$brand =
    strtolower(
        trim(
            $input['brand'] ?? ''
        )
    );

$range =
    strtolower(
        trim(
            $input['range'] ?? 'this_week'
        )
    );

// =========================================================
// VALIDATION
// =========================================================

if (!$brand) {

    echo json_encode([

        'success' => false,

        'message' => 'Brand required'

    ]);

    exit();

}

// =========================================================
// BRAND MAP
// =========================================================

$brandMap = [

    'haggar' =>
        '01KP7FPAETZCHXVZ9TSZQ273CR',

    'colehaan' =>
        '01KP7FPAGD7P2MTYPKX9PYFVQN',

    'kimco' =>
        '01KP7FPAFKCBCYM07598S1TP0J',

    'marcjacobs' =>
        '01KP7FPAD255TRCBHHAKZAYB2K',
    
    'Berkshire'=>
        '01KP7FPAE03HSDZ9EB9M55B0YD'

];

$brandId =
    $brandMap[$brand] ?? null;

if (!$brandId) {

    echo json_encode([

        'success' => false,

        'message' => 'Invalid brand'

    ]);

    exit();

}

// =========================================================
// TODAY UTC
// =========================================================

$today =
    new DateTime(
        'now',
        new DateTimeZone('UTC')
    );

// =========================================================
// SAFE CURRENT WEEK START (MONDAY)
// =========================================================

$currentWeekStart =
    clone $today;

$currentWeekStart->setTimezone(
    new DateTimeZone('UTC')
);

$dayOfWeek =
    (int)$currentWeekStart->format('N');

$currentWeekStart->modify(
    '-' . ($dayOfWeek - 1) . ' days'
);

$currentWeekStart->setTime(
    0,
    0,
    0
);

// =========================================================
// HELPERS
// =========================================================

function buildWeekRange(
    DateTime $baseMonday,
    int $weeksBack
) {

    $start =
        clone $baseMonday;

    $start->modify(
        '-' . ($weeksBack * 7) . ' days'
    );

    $start->setTime(
        0,
        0,
        0
    );

    $end =
        clone $start;

    $end->modify('+6 days');

    $end->setTime(
        23,
        59,
        59
    );

    return [

        'start' => $start,

        'end' => $end

    ];

}

// =========================================================
// RANGE
// =========================================================

switch ($range) {

    // =====================================================
    // TODAY
    // =====================================================

    case 'today':

        $start =
            clone $today;

        $end =
            clone $today;

        $start->setTime(
            0,
            0,
            0
        );

        $end->setTime(
            23,
            59,
            59
        );

        break;

    // =====================================================
    // YESTERDAY
    // =====================================================

    case 'yesterday':

        $start =
            clone $today;

        $end =
            clone $today;

        $start->modify('-1 day');

        $end->modify('-1 day');

        $start->setTime(
            0,
            0,
            0
        );

        $end->setTime(
            23,
            59,
            59
        );

        break;

    // =====================================================
    // THIS WEEK
    // =====================================================

    case 'this_week':

        $start =
            clone $currentWeekStart;

        $end =
            clone $today;

        $end->setTime(
            23,
            59,
            59
        );

        break;

    // =====================================================
    // LAST WEEK
    // =====================================================

    case 'last_week':

        $week =
            buildWeekRange(
                $currentWeekStart,
                1
            );

        $start =
            $week['start'];

        $end =
            $week['end'];

        break;

    // =====================================================
    // TWO WEEKS AGO
    // =====================================================

    case 'two_weeks_ago':

        $week =
            buildWeekRange(
                $currentWeekStart,
                2
            );

        $start =
            $week['start'];

        $end =
            $week['end'];

        break;

    // =====================================================
    // THREE WEEKS AGO
    // =====================================================

    case 'three_weeks_ago':

        $week =
            buildWeekRange(
                $currentWeekStart,
                3
            );

        $start =
            $week['start'];

        $end =
            $week['end'];

        break;

    // =====================================================
    // FOUR WEEKS AGO
    // =====================================================

    case 'four_weeks_ago':

        $week =
            buildWeekRange(
                $currentWeekStart,
                4
            );

        $start =
            $week['start'];

        $end =
            $week['end'];

        break;

    // =====================================================
    // FIVE WEEKS AGO
    // =====================================================

    case 'five_weeks_ago':

        $week =
            buildWeekRange(
                $currentWeekStart,
                5
            );

        $start =
            $week['start'];

        $end =
            $week['end'];

        break;

    // =====================================================
    // DEFAULT
    // =====================================================

    default:

        $start =
            clone $currentWeekStart;

        $end =
            clone $today;

        $end->setTime(
            23,
            59,
            59
        );

        break;

}

// =========================================================
// UTC FORMAT
// =========================================================

$startUtc =
    $start->format('Y-m-d\TH:i:s\Z');

$endUtc =
    $end->format('Y-m-d\TH:i:s\Z');

// =========================================================
// AUTH
// =========================================================

$zendeskEmail =
    'infra.admin@nearsol.com';

$zendeskToken =
    'gpH8WfZRWelj2SXHne9VEewbH5YyIGPhvEe7bKtV';

$auth = base64_encode(
    "{$zendeskEmail}/token:{$zendeskToken}"
);

// =========================================================
// CHANNEL MAPS
// =========================================================

$phoneChannels = [

    'voice',
    'phone_call',
    'api',
    'outbound',
    'inbound_call'

];

$chatChannels = [

    'chat',
    'messaging',
    'native_messaging'

];

$emailChannels = [

    'email',
    'mail',
    'web'

];

// =========================================================
// STORAGE
// =========================================================

$allTickets = [];

// =========================================================
// EXECUTE QUERY
// =========================================================

function executeZendeskQuery(
    string $query,
    string $auth
) {

    $url =

        "https://cxperts-63539.zendesk.com/api/v2/search.json?query=" .

        urlencode($query);

    $results = [];

    while ($url) {

        $ch = curl_init();

        curl_setopt_array($ch, [

            CURLOPT_URL => $url,

            CURLOPT_RETURNTRANSFER => true,

            CURLOPT_CUSTOMREQUEST => 'GET',

            CURLOPT_HTTPHEADER => [

                "Authorization: Basic {$auth}",

                "Content-Type: application/json"

            ],

            CURLOPT_TIMEOUT => 60

        ]);

        $response =
            curl_exec($ch);

        $httpCode =
            curl_getinfo(
                $ch,
                CURLINFO_HTTP_CODE
            );

        $curlError =
            curl_error($ch);

        curl_close($ch);

        // =================================================
        // CURL ERROR
        // =================================================

        if ($curlError) {

            return [

                'success' => false,

                'message' =>
                    'Curl Error',

                'error' =>
                    $curlError

            ];

        }

        // =================================================
        // HTTP ERROR
        // =================================================

        if ($httpCode >= 400) {

            return [

                'success' => false,

                'message' =>
                    'Zendesk API Error',

                'httpCode' =>
                    $httpCode,

                'query' =>
                    $query,

                'response' =>
                    json_decode(
                        $response,
                        true
                    )

            ];

        }

        // =================================================
        // DECODE
        // =================================================

        $data =
            json_decode(
                $response,
                true
            );

        foreach (
            ($data['results'] ?? [])
            as $ticket
        ) {

            $results[] = $ticket;

        }

        // =================================================
        // NEXT PAGE
        // =================================================

        $url =
            $data['next_page']
            ?? null;

    }

    return [

        'success' => true,

        'results' => $results

    ];

}

// =========================================================
// BUILD QUERY
// =========================================================

function buildQuery(
    string $startUtc,
    string $endUtc,
    string $brandId,
    array $channels
) {

    $channelQuery = '';

    foreach ($channels as $channel) {

        $channelQuery .=
            "via:{$channel} ";

    }

    return

        "type:ticket " .

        "created>={$startUtc} " .

        "created<={$endUtc} " .

        "custom_field_48599291116059:{$brandId} " .

        trim($channelQuery);

}

// =========================================================
// QUERIES
// =========================================================

$queries = [

    'phone' => buildQuery(
        $startUtc,
        $endUtc,
        $brandId,
        $phoneChannels
    ),

    'chat' => buildQuery(
        $startUtc,
        $endUtc,
        $brandId,
        $chatChannels
    ),

    'email' => buildQuery(
        $startUtc,
        $endUtc,
        $brandId,
        $emailChannels
    )

];

// =========================================================
// EXECUTE
// =========================================================

foreach (
    $queries as $channel => $query
) {

    $response =
        executeZendeskQuery(
            $query,
            $auth
        );

    if (
        !$response['success']
    ) {

        echo json_encode(
            $response
        );

        exit();

    }

    foreach (
        $response['results']
        as $ticket
    ) {

        $allTickets[] = [

            'id' =>
                $ticket['id'] ?? null,

            'subject' =>
                $ticket['subject'] ?? '',

            'status' =>
                $ticket['status'] ?? '',

            'priority' =>
                $ticket['priority'] ?? '',

            'channel' =>
                $channel,

            'raw_channel' =>

                $ticket['via']['channel']
                ?? '',

            'created_at' =>
                $ticket['created_at'] ?? '',

            'updated_at' =>
                $ticket['updated_at'] ?? '',

            'requester_id' =>
                $ticket['requester_id'] ?? null,

            'assignee_id' =>
                $ticket['assignee_id'] ?? null,

            'zendesk_url' =>

                "https://cxperts-63539.zendesk.com/agent/tickets/" .

                ($ticket['id'] ?? '')

        ];

    }

}

// =========================================================
// FINAL RESPONSE
// =========================================================

echo json_encode([
    'queries' => $queries,

    'success' => true,

    'range' => $range,

    'dateRange' => [

        'startUtc' =>
            $startUtc,

        'endUtc' =>
            $endUtc

    ],

    'queries' => $queries,

    'count' =>
        count($allTickets),

    'tickets' =>
        $allTickets

]);
} catch (\Throwable $th) {
echo json_encode([
    'queries' => $th->getMessage(),

    'success' => false,

    'range' => $range,

    'dateRange' => [

        'startUtc' =>
            $startUtc,

        'endUtc' =>
            $endUtc

    ],

    'queries' => $queries,

]);
}
