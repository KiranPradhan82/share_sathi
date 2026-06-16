import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchNepseData } from '@/lib/nepse';
import { generateGainersLosers } from '@/lib/nepse-stocks';
import { generateAllImagesAsBase64 } from '@/lib/image-generator';

export async function POST() {
  try {
    // Step 1: Get or fetch NEPSE data
    const today = new Date().toISOString().split('T')[0];
    let marketData = await db.marketData.findUnique({ where: { tradingDate: today } });

    if (!marketData) {
      // Try to get the latest data
      marketData = await db.marketData.findFirst({ orderBy: { tradingDate: 'desc' } });
    }

    if (!marketData) {
      // Fetch new data
      const nepseData = await fetchNepseData();
      marketData = await db.marketData.create({
        data: {
          tradingDate: nepseData.tradingDate,
          nepseIndex: nepseData.nepseIndex,
          change: nepseData.change,
          changePercentage: nepseData.changePercentage,
          turnover: nepseData.turnover,
          volume: nepseData.volume,
          trades: nepseData.trades,
          gainers: nepseData.gainers,
          losers: nepseData.losers,
          unchanged: nepseData.unchanged,
          rawData: nepseData.rawData,
          status: 'completed',
        },
      });
    }

    // Step 2: Get mock gainers/losers stock data
    const { gainers, losers } = generateGainersLosers();

    // Step 3: Convert market data to NepseData format
    const nepseDataForImages = {
      tradingDate: marketData.tradingDate,
      nepseIndex: marketData.nepseIndex,
      change: marketData.change,
      changePercentage: marketData.changePercentage,
      turnover: marketData.turnover,
      volume: marketData.volume,
      trades: marketData.trades,
      gainers: marketData.gainers,
      losers: marketData.losers,
      unchanged: marketData.unchanged,
      rawData: marketData.rawData,
    };

    // Step 4: Generate all 3 images as base64
    const result = await generateAllImagesAsBase64(nepseDataForImages, gainers, losers);

    return NextResponse.json({
      success: true,
      images: {
        marketSummary: `data:image/png;base64,${result.marketSummary}`,
        topGainers: `data:image/png;base64,${result.topGainers}`,
        topLosers: `data:image/png;base64,${result.topLosers}`,
      },
      data: result.data,
      marketData: {
        tradingDate: marketData.tradingDate,
        nepseIndex: marketData.nepseIndex,
        change: marketData.change,
        changePercentage: marketData.changePercentage,
        turnover: marketData.turnover,
        volume: marketData.volume,
        trades: marketData.trades,
        gainers: marketData.gainers,
        losers: marketData.losers,
        unchanged: marketData.unchanged,
      },
    });
  } catch (error) {
    console.error('Error generating images:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate images',
      },
      { status: 500 },
    );
  }
}
