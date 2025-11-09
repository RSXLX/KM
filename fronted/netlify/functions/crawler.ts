import { Handler } from '@netlify/functions';
import { ContentCrawler } from '../../lib/crawler/ContentCrawler';
import { ContentMapper } from '../../lib/crawler/ContentMapper';

export const handler: Handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { category = 'crypto', action = 'crawl' } = event.queryStringParameters || {};

    const crawler = new ContentCrawler();
    const mapper = new ContentMapper();

    switch (action) {
      case 'crawl':
        // Crawl content for the specified category
        const content = await crawler.crawlContentByCategory(category);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            category,
            content,
            count: content.length,
            timestamp: new Date().toISOString()
          })
        };

      case 'suggest':
        // Crawl content and generate market suggestions
        const crawledContent = await crawler.crawlContentByCategory(category);
        const suggestions = await mapper.mapContentToMarkets(crawledContent);
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            category,
            suggestions,
            count: suggestions.length,
            timestamp: new Date().toISOString()
          })
        };

      case 'categories':
        // Return available categories
        const categories = ['crypto', 'sports', 'politics', 'economy', 'gaming', 'culture', 'tech'];
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            categories,
            count: categories.length
          })
        };

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: 'Invalid action. Use: crawl, suggest, or categories' 
          })
        };
    }

  } catch (error) {
    console.error('Crawler function error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};