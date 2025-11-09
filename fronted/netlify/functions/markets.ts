import { Handler } from '@netlify/functions';
import { Market } from '../../types';

export const handler: Handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { httpMethod, path, queryStringParameters } = event;

    switch (httpMethod) {
      case 'GET':
        return await handleGetMarkets(queryStringParameters, headers);
      
      case 'POST':
        return await handleCreateMarket(JSON.parse(event.body || '{}'), headers);
      
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('Markets API error:', error);
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

async function handleGetMarkets(params: any, headers: any) {
  const { 
    category, 
    limit = '20', 
    trending = 'false',
    search = ''
  } = params || {};

  // Mock market data - replace with actual database queries
  const mockMarkets: Market[] = [
    {
      id: '1',
      title: 'Will Bitcoin reach $100,000 by the end of 2024?',
      description: 'Bitcoin price prediction for 2024 based on institutional adoption and market trends.',
      imageUrl: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=400',
      category: 'crypto',
      endDate: new Date('2024-12-31'),
      resolved: false,
      totalVolume: 125000,
      participants: 1234,
      probability: 0.65,
      upPercentage: 65,
      downPercentage: 35,
      creator: '0x1234567890123456789012345678901234567890',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date()
    },
    {
      id: '2',
      title: 'Will the Lakers win the NBA Championship 2024?',
      description: 'Los Angeles Lakers championship prediction for the 2023-24 NBA season.',
      imageUrl: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400',
      category: 'sports',
      endDate: new Date('2024-06-20'),
      resolved: false,
      totalVolume: 89000,
      participants: 892,
      probability: 0.32,
      upPercentage: 32,
      downPercentage: 68,
      creator: '0x2345678901234567890123456789012345678901',
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date()
    },
    {
      id: '3',
      title: 'Will AI replace 50% of jobs by 2030?',
      description: 'Prediction about the impact of artificial intelligence on employment in the next decade.',
      imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400',
      category: 'tech',
      endDate: new Date('2030-01-01'),
      resolved: false,
      totalVolume: 67000,
      participants: 567,
      probability: 0.78,
      upPercentage: 78,
      downPercentage: 22,
      creator: '0x3456789012345678901234567890123456789012',
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date()
    },
    {
      id: '4',
      title: 'Will Ethereum 2.0 staking reach 20M ETH by Q2 2024?',
      description: 'Ethereum staking milestone prediction based on current adoption trends.',
      imageUrl: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400',
      category: 'crypto',
      endDate: new Date('2024-06-30'),
      resolved: false,
      totalVolume: 156000,
      participants: 2341,
      probability: 0.55,
      upPercentage: 55,
      downPercentage: 45,
      creator: '0x4567890123456789012345678901234567890123',
      createdAt: new Date('2024-02-15'),
      updatedAt: new Date()
    },
    {
      id: '5',
      title: 'Will the US Fed cut interest rates in 2024?',
      description: 'Federal Reserve monetary policy prediction for 2024.',
      imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400',
      category: 'economy',
      endDate: new Date('2024-12-31'),
      resolved: false,
      totalVolume: 234000,
      participants: 3456,
      probability: 0.72,
      upPercentage: 72,
      downPercentage: 28,
      creator: '0x5678901234567890123456789012345678901234',
      createdAt: new Date('2024-01-30'),
      updatedAt: new Date()
    }
  ];

  let filteredMarkets = [...mockMarkets];

  // Filter by category
  if (category && category !== 'all') {
    filteredMarkets = filteredMarkets.filter(market => market.category === category);
  }

  // Filter by search term
  if (search) {
    const searchLower = search.toLowerCase();
    filteredMarkets = filteredMarkets.filter(market => 
      market.title.toLowerCase().includes(searchLower) ||
      market.description.toLowerCase().includes(searchLower)
    );
  }

  // Sort by trending (total volume) if requested
  if (trending === 'true') {
    filteredMarkets.sort((a, b) => b.totalVolume - a.totalVolume);
  } else {
    // Default sort by creation date (newest first)
    filteredMarkets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Limit results
  const limitNum = parseInt(limit);
  if (limitNum > 0) {
    filteredMarkets = filteredMarkets.slice(0, limitNum);
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      markets: filteredMarkets,
      total: filteredMarkets.length,
      params: {
        category,
        limit: limitNum,
        trending: trending === 'true',
        search
      },
      timestamp: new Date().toISOString()
    })
  };
}

async function handleCreateMarket(marketData: any, headers: any) {
  // Validate required fields
  const requiredFields = ['title', 'description', 'category', 'endDate'];
  const missingFields = requiredFields.filter(field => !marketData[field]);
  
  if (missingFields.length > 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        error: 'Missing required fields',
        missingFields
      })
    };
  }

  // Create new market (in real implementation, save to database)
  const newMarket: Market = {
    id: Date.now().toString(), // Generate proper ID in production
    title: marketData.title,
    description: marketData.description,
    imageUrl: marketData.imageUrl || '/images/placeholder.jpg',
    category: marketData.category,
    endDate: new Date(marketData.endDate),
    resolved: false,
    totalVolume: 0,
    participants: 0,
    probability: 0.5, // Default 50/50
    upPercentage: 50,
    downPercentage: 50,
    creator: marketData.creator || '0x0000000000000000000000000000000000000000',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  return {
    statusCode: 201,
    headers,
    body: JSON.stringify({
      market: newMarket,
      message: 'Market created successfully'
    })
  };
}