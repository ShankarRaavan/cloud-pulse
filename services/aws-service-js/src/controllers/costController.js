const costService = require('../services/costService');

// Simple in-memory cache with 4-hour TTL to reduce AWS API costs
const cache = new Map();
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

function getCacheKey(type, period, region, accessKey) {
    return `${type}:${period}:${region}:${accessKey.substring(0, 10)}`;
}

function getFromCache(key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`✅ Cache HIT for ${key} (saved AWS API call)`);
        return cached.data;
    }
    if (cached) {
        cache.delete(key); // Remove expired entry
    }
    return null;
}

function setCache(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
    console.log(`💾 Cached ${key} for 4 hours`);
}

const getCostSummary = async (req, res) => {
    try {
        const { period, region, aws_access_key_id, aws_secret_access_key, aws_default_region } = req.body;
        const cacheKey = getCacheKey('summary', period, region, aws_access_key_id);
        
        // Check cache first
        const cached = getFromCache(cacheKey);
        if (cached) {
            return res.json(cached);
        }
        
        // Fetch from AWS and cache
        const summary = await costService.getCostSummary(period, aws_access_key_id, aws_secret_access_key, region, aws_default_region);
        setCache(cacheKey, summary);
        res.json(summary);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getCostByService = async (req, res) => {
    try {
        const { period, region, aws_access_key_id, aws_secret_access_key, aws_default_region } = req.body;
        const cacheKey = getCacheKey('byService', period, region, aws_access_key_id);
        
        // Check cache first
        const cached = getFromCache(cacheKey);
        if (cached) {
            return res.json(cached);
        }
        
        // Fetch from AWS and cache
        const costData = await costService.getCostByService(period, aws_access_key_id, aws_secret_access_key, region, aws_default_region);
        setCache(cacheKey, costData);
        res.json(costData);
    } catch (error) {
        res.status(500).json({ message: error.message, items: [] });
    }
};

const getCostHistory = async (req, res) => {
    try {
        const { period, region, aws_access_key_id, aws_secret_access_key, aws_default_region } = req.body;
        const cacheKey = getCacheKey('history', period, region, aws_access_key_id);
        
        // Check cache first
        const cached = getFromCache(cacheKey);
        if (cached) {
            return res.json(cached);
        }
        
        // Fetch from AWS and cache
        const costData = await costService.getCostHistory(period, aws_access_key_id, aws_secret_access_key, region, aws_default_region);
        setCache(cacheKey, costData);
        res.json(costData);
    } catch (error) {
        res.status(500).json({ message: error.message, dates: [], byService: {} });
    }
};

const getCostByRegion = async (req, res) => {
    try {
        const { period, region, aws_access_key_id, aws_secret_access_key, aws_default_region } = req.body;
        const cacheKey = getCacheKey('byRegion', period, region, aws_access_key_id);
        
        // Check cache first
        const cached = getFromCache(cacheKey);
        if (cached) {
            return res.json(cached);
        }
        
        // Fetch from AWS and cache
        const costData = await costService.getCostByRegion(period, aws_access_key_id, aws_secret_access_key, region, aws_default_region);
        setCache(cacheKey, costData);
        res.json(costData);
    } catch (error) {
        res.status(500).json({ message: error.message, items: [] });
    }
};

module.exports = {
    getCostSummary,
    getCostByService,
    getCostHistory,
    getCostByRegion,
};
