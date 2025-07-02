# 데이터베이스 최적화 설정

## Supabase 테이블 생성 및 인덱스 설정

다음 SQL을 Supabase SQL Editor에서 실행하여 최적화된 테이블과 인덱스를 생성하세요.

### 1. 프로필 테이블

```sql
-- 프로필 테이블 생성
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nickname TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS 정책 설정
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" 
  ON profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
  ON profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- 인덱스 생성
CREATE INDEX idx_profiles_created_at ON profiles(created_at);
```

### 2. 사용자 미션 테이블

```sql
-- 사용자 미션 테이블 생성
CREATE TABLE user_missions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('physical', 'emotional', 'social', 'spiritual')),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  sticker TEXT NOT NULL,
  is_custom BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS 정책 설정
ALTER TABLE user_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own missions" 
  ON user_missions FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own missions" 
  ON user_missions FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own missions" 
  ON user_missions FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own missions" 
  ON user_missions FOR DELETE 
  USING (auth.uid() = user_id);

-- 성능 최적화 인덱스
CREATE INDEX idx_user_missions_user_id ON user_missions(user_id);
CREATE INDEX idx_user_missions_category ON user_missions(category);
CREATE INDEX idx_user_missions_frequency ON user_missions(frequency);
CREATE INDEX idx_user_missions_created_at ON user_missions(created_at);
CREATE INDEX idx_user_missions_user_category ON user_missions(user_id, category);
```

### 3. 미션 완료 테이블

```sql
-- 미션 완료 테이블 생성
CREATE TABLE mission_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  mission_id UUID REFERENCES user_missions(id) ON DELETE CASCADE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, mission_id, DATE(completed_at))
);

-- RLS 정책 설정
ALTER TABLE mission_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own completions" 
  ON mission_completions FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own completions" 
  ON mission_completions FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own completions" 
  ON mission_completions FOR DELETE 
  USING (auth.uid() = user_id);

-- 성능 최적화 인덱스
CREATE INDEX idx_mission_completions_user_id ON mission_completions(user_id);
CREATE INDEX idx_mission_completions_mission_id ON mission_completions(mission_id);
CREATE INDEX idx_mission_completions_completed_at ON mission_completions(completed_at);
CREATE INDEX idx_mission_completions_user_date ON mission_completions(user_id, DATE(completed_at));
CREATE INDEX idx_mission_completions_user_mission ON mission_completions(user_id, mission_id);
```

### 4. 실시간 업데이트 설정

```sql
-- 실시간 업데이트를 위한 Publication 생성
-- Supabase Dashboard의 Database > Publications에서 설정하거나 아래 SQL 사용

-- user_missions 테이블 실시간 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE user_missions;

-- mission_completions 테이블 실시간 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE mission_completions;
```

### 5. 성능 최적화 함수 (선택사항)

```sql
-- 사용자의 오늘 완료율을 빠르게 계산하는 함수
CREATE OR REPLACE FUNCTION get_user_daily_progress(user_uuid UUID, target_date DATE DEFAULT CURRENT_DATE)
RETURNS JSON AS $$
DECLARE
  total_missions INTEGER;
  completed_missions INTEGER;
  progress_percentage INTEGER;
BEGIN
  -- 전체 미션 수
  SELECT COUNT(*) INTO total_missions
  FROM user_missions 
  WHERE user_id = user_uuid;
  
  -- 오늘 완료한 미션 수
  SELECT COUNT(*) INTO completed_missions
  FROM mission_completions mc
  JOIN user_missions um ON mc.mission_id = um.id
  WHERE mc.user_id = user_uuid 
    AND DATE(mc.completed_at) = target_date;
  
  -- 진행률 계산
  IF total_missions > 0 THEN
    progress_percentage := ROUND((completed_missions::FLOAT / total_missions::FLOAT) * 100);
  ELSE
    progress_percentage := 0;
  END IF;
  
  RETURN json_build_object(
    'total_missions', total_missions,
    'completed_missions', completed_missions,
    'progress_percentage', progress_percentage
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 데이터베이스 모니터링

### 쿼리 성능 모니터링

Supabase Dashboard의 Database > Query Performance에서 느린 쿼리를 모니터링하세요.

### 인덱스 사용량 확인

```sql
-- 인덱스 사용량 확인
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### 테이블 크기 모니터링

```sql
-- 테이블 크기 확인
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.'||tablename) DESC;
```

## 백업 및 복구

1. Supabase Dashboard의 Settings > Database에서 자동 백업 설정
2. 중요한 변경 전 수동 백업 실행
3. 정기적인 데이터 내보내기 스케줄링

## 보안 설정

1. RLS(Row Level Security) 정책이 모든 테이블에 적용되었는지 확인
2. API 키 로테이션 주기적 실행
3. 사용자 권한 최소화 원칙 적용 