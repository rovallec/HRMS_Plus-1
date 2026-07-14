<?php
require_once __DIR__ . '/../config/api_header.php';
require_once __DIR__ . '/../config/db.php';

function respond($data, int $status = 200): void { http_response_code($status); echo json_encode($data, JSON_UNESCAPED_UNICODE); exit; }
function body(): array { return json_decode(file_get_contents('php://input'), true) ?: $_POST; }
function userId(): string { return trim($_SERVER['HTTP_X_TA_USER'] ?? ''); }
function username(): string { return trim($_SERVER['HTTP_X_TA_USERNAME'] ?? ''); }
function boolValue($value): bool { return filter_var($value, FILTER_VALIDATE_BOOLEAN); }
function isTaAdmin(PDO $pdo): bool { $id=userId(); if ($id==='') return false; $stmt=$pdo->prepare('SELECT idRole FROM users WHERE idusers=? LIMIT 1'); $stmt->execute([$id]); return (int)$stmt->fetchColumn()===6; }
function requireTaAdmin(PDO $pdo): void { if (userId()==='') respond(['error'=>'Authentication required.'],401); if (!isTaAdmin($pdo)) respond(['error'=>'TA administration requires role 6.'],403); }

try {
    $pdo = (new Database())->connect();
    $pdo->exec("CREATE TABLE IF NOT EXISTS ta_forms (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(120) NOT NULL UNIQUE,
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        layout ENUM('single','sections','steps') NOT NULL DEFAULT 'single',
        is_public TINYINT(1) NOT NULL DEFAULT 1,
        require_auth TINYINT(1) NOT NULL DEFAULT 0,
        allow_geolocation TINYINT(1) NOT NULL DEFAULT 0,
        restrict_countries TINYINT(1) NOT NULL DEFAULT 0,
        allowed_countries_json JSON NULL,
        available_until DATETIME NULL,
        time_limit_minutes INT UNSIGNED NULL,
        max_attempts INT UNSIGNED NULL,
        status ENUM('draft','published','closed') NOT NULL DEFAULT 'draft',
        fields_json JSON NOT NULL,
        section_settings_json JSON NULL,
        question_groups_json JSON NULL,
        created_by VARCHAR(100) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ta_forms_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $columnCheck = $pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ta_forms' AND COLUMN_NAME='section_settings_json'")->fetchColumn();
    if (!(int)$columnCheck) $pdo->exec("ALTER TABLE ta_forms ADD COLUMN section_settings_json JSON NULL AFTER fields_json");
    $groupColumnCheck = $pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ta_forms' AND COLUMN_NAME='question_groups_json'")->fetchColumn();
    if (!(int)$groupColumnCheck) $pdo->exec("ALTER TABLE ta_forms ADD COLUMN question_groups_json JSON NULL AFTER section_settings_json");
    $countryColumnCheck = $pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ta_forms' AND COLUMN_NAME='restrict_countries'")->fetchColumn();
    if (!(int)$countryColumnCheck) $pdo->exec("ALTER TABLE ta_forms ADD COLUMN restrict_countries TINYINT(1) NOT NULL DEFAULT 0 AFTER allow_geolocation, ADD COLUMN allowed_countries_json JSON NULL AFTER restrict_countries");
    $pdo->exec("CREATE TABLE IF NOT EXISTS ta_submissions (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        form_id INT UNSIGNED NOT NULL,
        respondent_id VARCHAR(100) NULL,
        respondent_name VARCHAR(190) NULL,
        respondent_key VARCHAR(190) NOT NULL,
        answers_json JSON NOT NULL,
        latitude DECIMAL(10,7) NULL,
        longitude DECIMAL(10,7) NULL,
        country_code CHAR(2) NULL,
        elapsed_seconds INT UNSIGNED NULL,
        submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ta_submission_form (form_id),
        INDEX idx_ta_attempts (form_id, respondent_key),
        CONSTRAINT fk_ta_submission_form FOREIGN KEY (form_id) REFERENCES ta_forms(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $submissionCountryCheck = $pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ta_submissions' AND COLUMN_NAME='country_code'")->fetchColumn();
    if (!(int)$submissionCountryCheck) $pdo->exec("ALTER TABLE ta_submissions ADD COLUMN country_code CHAR(2) NULL AFTER longitude");

    $mapForm = function(array $row): array {
        return ['id'=>(int)$row['id'], 'slug'=>$row['slug'], 'title'=>$row['title'], 'description'=>$row['description'] ?? '',
            'layout'=>$row['layout'], 'isPublic'=>(bool)$row['is_public'], 'requireAuth'=>(bool)$row['require_auth'],
            'allowGeolocation'=>(bool)$row['allow_geolocation'], 'availableUntil'=>$row['available_until'] ? date('Y-m-d\TH:i', strtotime($row['available_until'])) : null,
            'restrictCountries'=>(bool)($row['restrict_countries'] ?? false), 'allowedCountries'=>json_decode($row['allowed_countries_json'] ?? '[]', true) ?: [],
            'timeLimitMinutes'=>$row['time_limit_minutes'] !== null ? (int)$row['time_limit_minutes'] : null,
            'maxAttempts'=>$row['max_attempts'] !== null ? (int)$row['max_attempts'] : null, 'status'=>$row['status'],
            'fields'=>json_decode($row['fields_json'], true) ?: [], 'questionGroups'=>json_decode($row['question_groups_json'] ?? '[]', true) ?: [], 'createdAt'=>$row['created_at']];
    };

    if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['slug'])) {
        $stmt = $pdo->prepare('SELECT * FROM ta_forms WHERE slug=? LIMIT 1'); $stmt->execute([$_GET['slug']]); $row = $stmt->fetch();
        if (!$row) respond(['error'=>'Form not found.'], 404);
        $loggedIn = userId() !== '';
        if ($row['status'] !== 'published' && !isTaAdmin($pdo)) respond(['error'=>'This form is not published.'], 403);
        if (!$row['is_public'] && !$loggedIn) respond(['error'=>'This form is private. Sign in to view it.'], 401);
        if ($row['available_until'] && strtotime($row['available_until']) < time()) respond(['error'=>'This form is closed.'], 410);
        $key = userId() ?: ($_SERVER['REMOTE_ADDR'] ?? 'anonymous');
        $count = $pdo->prepare('SELECT COUNT(*) FROM ta_submissions WHERE form_id=? AND respondent_key=?'); $count->execute([$row['id'], $key]);
        respond(['data'=>$mapForm($row), 'attemptsUsed'=>(int)$count->fetchColumn()]);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['submissions'])) {
        requireTaAdmin($pdo);
        $sql = 'SELECT * FROM ta_submissions'; $params=[];
        if (!empty($_GET['formId'])) { $sql .= ' WHERE form_id=?'; $params[]=(int)$_GET['formId']; }
        $sql .= ' ORDER BY submitted_at DESC'; $stmt=$pdo->prepare($sql); $stmt->execute($params);
        $rows=array_map(fn($r)=>['id'=>(int)$r['id'],'formId'=>(int)$r['form_id'],'submittedAt'=>$r['submitted_at'],'respondent'=>$r['respondent_name'] ?: 'Anonymous','answers'=>json_decode($r['answers_json'],true)?:[],'latitude'=>$r['latitude'] !== null?(float)$r['latitude']:null,'longitude'=>$r['longitude'] !== null?(float)$r['longitude']:null,'elapsedSeconds'=>(int)$r['elapsed_seconds']],$stmt->fetchAll());
        respond(['data'=>$rows]);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        requireTaAdmin($pdo);
        $rows=$pdo->query('SELECT * FROM ta_forms ORDER BY updated_at DESC')->fetchAll(); respond(['data'=>array_map($mapForm,$rows)]);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        requireTaAdmin($pdo);
        $stmt=$pdo->prepare('DELETE FROM ta_forms WHERE id=?'); $stmt->execute([(int)($_GET['id']??0)]); respond(['ok'=>true]);
    }

    $data=body();
    if (($data['action']??'') === 'saveForm') {
        requireTaAdmin($pdo);
        $f=$data['form']??[]; if (empty($f['title'])||empty($f['slug'])||empty($f['fields'])) respond(['error'=>'Title, URL, and questions are required.'],422);
        $values=[$f['slug'],$f['title'],$f['description']??'',in_array($f['layout']??'', ['single','sections','steps'])?$f['layout']:'single',boolValue($f['isPublic']??false)?1:0,boolValue($f['requireAuth']??false)?1:0,boolValue($f['allowGeolocation']??false)?1:0,boolValue($f['restrictCountries']??false)?1:0,json_encode($f['allowedCountries']??[]),!empty($f['availableUntil'])?date('Y-m-d H:i:s',strtotime($f['availableUntil'])):null,!empty($f['timeLimitMinutes'])?(int)$f['timeLimitMinutes']:null,!empty($f['maxAttempts'])?(int)$f['maxAttempts']:null,in_array($f['status']??'', ['draft','published','closed'])?$f['status']:'draft',json_encode($f['fields'],JSON_UNESCAPED_UNICODE),json_encode($f['questionGroups']??[],JSON_UNESCAPED_UNICODE),userId()];
        if (!empty($f['id'])) { $stmt=$pdo->prepare('UPDATE ta_forms SET slug=?,title=?,description=?,layout=?,is_public=?,require_auth=?,allow_geolocation=?,restrict_countries=?,allowed_countries_json=?,available_until=?,time_limit_minutes=?,max_attempts=?,status=?,fields_json=?,question_groups_json=? WHERE id=?'); $stmt->execute(array_merge(array_slice($values,0,15),[(int)$f['id']])); $id=(int)$f['id']; }
        else { $stmt=$pdo->prepare('INSERT INTO ta_forms (slug,title,description,layout,is_public,require_auth,allow_geolocation,restrict_countries,allowed_countries_json,available_until,time_limit_minutes,max_attempts,status,fields_json,question_groups_json,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'); $stmt->execute($values); $id=(int)$pdo->lastInsertId(); }
        $stmt=$pdo->prepare('SELECT * FROM ta_forms WHERE id=?');$stmt->execute([$id]);respond(['data'=>$mapForm($stmt->fetch())]);
    }

    if (($data['action']??'') === 'submit') {
        $id=(int)($data['formId']??0);$stmt=$pdo->prepare('SELECT * FROM ta_forms WHERE id=?');$stmt->execute([$id]);$form=$stmt->fetch();
        if (!$form||$form['status']!=='published') respond(['error'=>'This form is not accepting submissions.'],403);
        if ($form['require_auth'] && userId()==='') respond(['error'=>'You must sign in.'],401);
        if ($form['available_until']&&strtotime($form['available_until'])<time()) respond(['error'=>'This form is closed.'],410);
        $key=userId()?:($_SERVER['REMOTE_ADDR']??'anonymous');$count=$pdo->prepare('SELECT COUNT(*) FROM ta_submissions WHERE form_id=? AND respondent_key=?');$count->execute([$id,$key]);
        if ($form['max_attempts']!==null&&(int)$count->fetchColumn()>=(int)$form['max_attempts']) respond(['error'=>'You have reached the maximum number of attempts.'],429);
        $started=strtotime($data['startedAt']??'');$elapsed=$started?max(0,time()-$started):null;if ($form['time_limit_minutes']&&$elapsed>((int)$form['time_limit_minutes']*60+30)) respond(['error'=>'The time allowed to complete this form has expired.'],408);
        $location=json_decode($data['location']??'{}',true)?:[];$countryCode=strtoupper(trim($location['countryCode']??''));$allowedCountries=json_decode($form['allowed_countries_json']??'[]',true)?:[];
        if (!empty($form['restrict_countries'])&&(!$countryCode||!in_array($countryCode,$allowedCountries,true))) respond(['error'=>'This form is not available in your country.'],403);
        $answers=json_decode($data['answers']??'{}',true)?:[];$fields=json_decode($form['fields_json'],true)?:[];$displayed=json_decode($data['displayedFieldIds']??'[]',true)?:[];
        foreach($fields as $field){$fid=$field['id'];if(in_array($fid,$displayed,true)&&!empty($field['required'])&&empty($answers[$fid])&&!isset($_FILES['file_'.$fid]))respond(['error'=>'Missing required field: '.$field['label']],422);if(isset($_FILES['file_'.$fid])){$file=$_FILES['file_'.$fid];$allowed=$field['type']==='pdf'?['application/pdf']:['image/jpeg','image/png','image/gif','image/webp'];$mime=(new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);if(!in_array($mime,$allowed,true)||$file['size']>10*1024*1024)respond(['error'=>'Invalid file or file larger than 10 MB: '.$field['label']],422);$dir=__DIR__.'/../uploads/ta/'.$id;if(!is_dir($dir))mkdir($dir,0750,true);$name=bin2hex(random_bytes(12)).'.'.pathinfo($file['name'],PATHINFO_EXTENSION);if(!move_uploaded_file($file['tmp_name'],$dir.'/'.$name))respond(['error'=>'The attachment could not be saved.'],500);$answers[$fid]='uploads/ta/'.$id.'/'.$name;}}
        $insert=$pdo->prepare('INSERT INTO ta_submissions (form_id,respondent_id,respondent_name,respondent_key,answers_json,latitude,longitude,country_code,elapsed_seconds) VALUES (?,?,?,?,?,?,?,?,?)');$insert->execute([$id,userId()?:null,username()?:null,$key,json_encode($answers,JSON_UNESCAPED_UNICODE),$location['latitude']??null,$location['longitude']??null,$countryCode?:null,$elapsed]);respond(['ok'=>true,'id'=>(int)$pdo->lastInsertId()],201);
    }
    respond(['error'=>'Unsupported action.'],400);
} catch (PDOException $e) { error_log('TA database error: '.$e->getMessage()); respond(['error'=>$e->getCode()==='23000'?'The form URL already exists.':'Database error.'],500); }
catch (Throwable $e) { respond(['error'=>$e->getMessage()],500); }
