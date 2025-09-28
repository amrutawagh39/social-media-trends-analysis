const express = require('express');
const { OpenAI } = require('openai');
const pg = require('pg');
require('dotenv').config();

const app = express();
app.use(express.json());

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Database connection
const pool = new pg.Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Generate synthetic trend data using OpenAI
async function generateTrendData(analysisParams) {
    const prompt = `
    Generate realistic social media trend data for a trend intelligence dashboard.
    
    Analysis Parameters:
    - Platforms: ${analysisParams.platforms.join(', ')}
    - Categories: ${analysisParams.categories.join(', ')}
    - Regions: ${analysisParams.regions.join(', ')}
    - Date Range: ${analysisParams.startDate} to ${analysisParams.endDate}
    
    Generate 15-20 realistic social media trends with the following structure for each trend:
    
    Trend Name: [Creative, realistic trend name]
    Platform: [One of the specified platforms]
    Category: [One of the specified categories]
    Region: [One of the specified regions]
    Velocity: [Number between 1000-50000]
    Virality Score: [Number between 1-100]
    Sentiment: [Positive: 50-80, Negative: 10-30, Neutral: 10-30] (should total 100)
    Emerging Topic: [true/false]
    Impact Level: [Low/Medium/High]
    Confidence Score: [Number between 70-95]
    AI Insights: [2-3 sentence insight about this trend]
    
    Format the response as a JSON array.
    `;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "You are a social media trend analyst. Generate realistic, diverse social media trend data in JSON format."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.8,
            max_tokens: 3000
        });

        const trendsData = JSON.parse(completion.choices[0].message.content);
        return trendsData;
    } catch (error) {
        console.error('Error generating trend data:', error);
        throw error;
    }
}

// Generate AI insights for dashboard
async function generateAIInsights(trendsData) {
    const prompt = `
    Based on the following social media trends data, generate 5-7 strategic insights for a business intelligence dashboard:
    
    ${JSON.stringify(trendsData, null, 2)}
    
    For each insight, provide:
    - Trend: The main trend this insight relates to
    - Insight: Strategic business insight (2-3 sentences)
    - Impact: Low/Medium/High
    - Confidence: Percentage (75-95%)
    
    Format as JSON array.
    `;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "You are a strategic business intelligence analyst. Provide actionable insights based on social media trends."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 2000
        });

        const insights = JSON.parse(completion.choices[0].message.content);
        return insights;
    } catch (error) {
        console.error('Error generating insights:', error);
        throw error;
    }
}

// API Routes
app.post('/api/analyze-trends', async (req, res) => {
    try {
        const { sessionName, startDate, endDate, platforms, categories, regions } = req.body;
        
        // Create analysis session
        const sessionResult = await pool.query(
            'INSERT INTO analysis_sessions (session_name, start_date, end_date, platforms, categories, regions) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [sessionName, startDate, endDate, platforms, categories, regions]
        );
        
        const session = sessionResult.rows[0];
        
        // Generate trend data
        const trendsData = await generateTrendData({
            platforms, categories, regions, startDate, endDate
        });
        
        // Store trends in database
        for (const trend of trendsData) {
            await pool.query(
                `INSERT INTO ai_generated_trends 
                (session_id, trend_name, trend_description, platform, category, region, 
                 velocity_count_per_hour, virality_score, sentiment_positive, sentiment_negative, 
                 sentiment_neutral, is_emerging_topic, impact_level, confidence_score, ai_insights) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
                [
                    session.id, trend.trendName, trend.trendDescription, trend.platform, 
                    trend.category, trend.region, trend.velocity, trend.viralityScore,
                    trend.sentiment.positive, trend.sentiment.negative, trend.sentiment.neutral,
                    trend.emergingTopic, trend.impactLevel, trend.confidenceScore, trend.aiInsights
                ]
            );
        }
        
        // Generate AI insights
        const insights = await generateAIInsights(trendsData);
        
        res.json({
            success: true,
            sessionId: session.id,
            trends: trendsData,
            insights: insights
        });
        
    } catch (error) {
        console.error('Error in trend analysis:', error);
        res.status(500).json({ error: 'Analysis failed' });
    }
});

app.get('/api/dashboard-data/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        // Get trends for this session
        const trendsResult = await pool.query(
            'SELECT * FROM ai_generated_trends WHERE session_id = $1 ORDER BY velocity_count_per_hour DESC',
            [sessionId]
        );
        
        const trends = trendsResult.rows;
        
        // Calculate dashboard metrics
        const totalVelocity = trends.reduce((sum, trend) => sum + trend.velocity_count_per_hour, 0);
        const avgVirality = trends.reduce((sum, trend) => sum + trend.virality_score, 0) / trends.length;
        const emergingTopics = trends.filter(trend => trend.is_emerging_topic).length;
        
        // Calculate sentiment ratio
        const avgPositive = trends.reduce((sum, trend) => sum + trend.sentiment_positive, 0) / trends.length;
        const avgNegative = trends.reduce((sum, trend) => sum + trend.sentiment_negative, 0) / trends.length;
        const avgNeutral = trends.reduce((sum, trend) => sum + trend.sentiment_neutral, 0) / trends.length;
        
        // Platform distribution
        const platformDistribution = trends.reduce((acc, trend) => {
            acc[trend.platform] = (acc[trend.platform] || 0) + 1;
            return acc;
        }, {});
        
        // Category distribution
        const categoryDistribution = trends.reduce((acc, trend) => {
            acc[trend.category] = (acc[trend.category] || 0) + 1;
            return acc;
        }, {});
        
        // Top trending content
        const topTrending = trends.slice(0, 10).map(trend => ({
            name: trend.trend_name,
            velocity: trend.velocity_count_per_hour,
            virality: trend.virality_score,
            growth: trend.virality_score - 50 // Simulated growth percentage
        }));
        
        res.json({
            metrics: {
                totalVelocity: Math.round(totalVelocity),
                avgVirality: Math.round(avgVirality * 100) / 100,
                sentimentRatio: {
                    positive: Math.round(avgPositive),
                    negative: Math.round(avgNegative),
                    neutral: Math.round(avgNeutral)
                },
                emergingTopics: emergingTopics
            },
            platformDistribution,
            categoryDistribution,
            topTrending,
            allTrends: trends
        });
        
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});