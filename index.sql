-- Simplified schema using OpenAI for data generation
CREATE TABLE analysis_sessions (
    id SERIAL PRIMARY KEY,
    session_name VARCHAR(255),
    start_date DATE,
    end_date DATE,
    platforms TEXT[], -- Array of platforms to analyze
    categories TEXT[], -- Array of categories to analyze
    regions TEXT[], -- Array of regions to analyze
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_generated_trends (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES analysis_sessions(id),
    trend_name VARCHAR(255) NOT NULL,
    trend_description TEXT,
    platform VARCHAR(100),
    category VARCHAR(100),
    region VARCHAR(100),
    velocity_count_per_hour INTEGER,
    virality_score DECIMAL(5,2),
    sentiment_positive DECIMAL(5,2),
    sentiment_negative DECIMAL(5,2),
    sentiment_neutral DECIMAL(5,2),
    is_emerging_topic BOOLEAN DEFAULT false,
    confidence_score DECIMAL(5,2),
    impact_level VARCHAR(20),
    ai_insights TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE trend_metrics_history (
    id SERIAL PRIMARY KEY,
    trend_id INTEGER REFERENCES ai_generated_trends(id),
    metric_type VARCHAR(50), -- 'velocity', 'sentiment', 'virality'
    metric_value DECIMAL(10,2),
    recorded_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);