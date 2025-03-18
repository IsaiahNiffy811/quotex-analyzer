const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

// Create output directory if it doesn't exist
const outputDir = path.join(__dirname, 'analysis_results');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function analyzeTradingPlatform() {
  console.log('Starting analysis of Quotex trading platform...');
  
  const browser = await puppeteer.launch({
    headless: false, // We'll use headed mode to see what's happening
    defaultViewport: null, // Use default viewport size
    args: ['--start-maximized'] // Start with maximized window
  });

  try {
    const page = await browser.newPage();
    
    // Enable request interception (useful for analyzing API calls)
    await page.setRequestInterception(true);
    
    // Collect API requests to understand how data is fetched
    const apiRequests = [];
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/') || url.includes('/ws/')) {
        apiRequests.push({
          url,
          method: request.method(),
          headers: request.headers(),
          postData: request.postData()
        });
      }
      request.continue();
    });
    
    // Navigate to Quotex demo trading platform
    console.log('Navigating to Quotex demo trading platform...');
    await page.goto('https://qxbroker.com/en/demo-trade', { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    // Wait for the page to load completely
    await page.waitForTimeout(5000);
    
    // Take a screenshot of the full page
    console.log('Taking a screenshot of the platform...');
    await page.screenshot({
      path: path.join(outputDir, 'platform_overview.png'),
      fullPage: true
    });
    
    // Analyze the chart area
    console.log('Analyzing chart components...');
    const chartSelectors = await page.evaluate(() => {
      // Look for chart elements based on common patterns in trading platforms
      const selectors = {};
      
      // Check for canvas elements (likely used for charts)
      const canvases = Array.from(document.querySelectorAll('canvas'));
      selectors.chartCanvases = canvases.map(canvas => {
        const rect = canvas.getBoundingClientRect();
        return {
          id: canvas.id,
          width: canvas.width,
          height: canvas.height,
          position: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height
          }
        };
      });
      
      // Find timeframe selector elements
      const timeframeSelectors = Array.from(document.querySelectorAll('select, button')).filter(el => {
        const text = el.textContent.toLowerCase();
        return text.includes('minute') || text.includes('hour') || text.includes('day') || 
               text.includes('1m') || text.includes('5m') || text.includes('15m') || 
               text.includes('30m') || text.includes('1h');
      });
      
      selectors.timeframeElements = timeframeSelectors.map(el => {
        return {
          tagName: el.tagName,
          id: el.id,
          class: el.className,
          text: el.textContent.trim()
        };
      });
      
      // Find indicator controls
      const indicatorElements = Array.from(document.querySelectorAll('button, div')).filter(el => {
        const text = el.textContent.toLowerCase();
        return text.includes('indicator') || text.includes('bollinger') || 
               text.includes('macd') || text.includes('rsi') || text.includes('sma') || 
               text.includes('ema');
      });
      
      selectors.indicatorElements = indicatorElements.map(el => {
        return {
          tagName: el.tagName,
          id: el.id,
          class: el.className,
          text: el.textContent.trim()
        };
      });
      
      // Extract colors used in the platform
      const computedStyles = window.getComputedStyle(document.body);
      const backgroundColor = computedStyles.backgroundColor;
      
      // Find all elements with explicit background-color
      const colorElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const style = window.getComputedStyle(el);
        return style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)';
      });
      
      const colorMap = {};
      colorElements.forEach(el => {
        const style = window.getComputedStyle(el);
        const bgColor = style.backgroundColor;
        if (!colorMap[bgColor]) {
          colorMap[bgColor] = 0;
        }
        colorMap[bgColor]++;
      });
      
      selectors.colors = {
        backgroundColor,
        colorMap: Object.entries(colorMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10) // Get top 10 most used colors
      };
      
      return selectors;
    });
    
    // Analyze the trading interface components
    console.log('Analyzing trading interface components...');
    const tradingInterface = await page.evaluate(() => {
      const components = {};
      
      // Find asset selector
      components.assetSelector = Array.from(document.querySelectorAll('select, button, div')).filter(el => {
        const text = el.textContent.toLowerCase();
        return text.includes('asset') || text.includes('symbol') || text.includes('eur/usd') || 
               text.includes('btc') || text.includes('currency');
      }).map(el => ({
        tagName: el.tagName,
        id: el.id,
        class: el.className,
        text: el.textContent.trim()
      }));
      
      // Find trade amount input
      components.amountInput = Array.from(document.querySelectorAll('input, button, div')).filter(el => {
        const text = el.textContent.toLowerCase();
        const placeholder = el.placeholder ? el.placeholder.toLowerCase() : '';
        return text.includes('amount') || text.includes('investment') || 
               placeholder.includes('amount') || placeholder.includes('investment');
      }).map(el => ({
        tagName: el.tagName,
        id: el.id,
        class: el.className,
        text: el.textContent.trim(),
        placeholder: el.placeholder
      }));
      
      // Find buy/sell buttons
      components.actionButtons = Array.from(document.querySelectorAll('button, div')).filter(el => {
        const text = el.textContent.toLowerCase();
        return text.includes('buy') || text.includes('sell') || 
               text.includes('up') || text.includes('down') || 
               text.includes('call') || text.includes('put');
      }).map(el => ({
        tagName: el.tagName,
        id: el.id,
        class: el.className,
        text: el.textContent.trim(),
        bgColor: window.getComputedStyle(el).backgroundColor,
        color: window.getComputedStyle(el).color
      }));
      
      // Find expiration time selector
      components.expirationSelector = Array.from(document.querySelectorAll('select, button, div')).filter(el => {
        const text = el.textContent.toLowerCase();
        return text.includes('expiration') || text.includes('expiry') || 
               text.includes('duration') || text.includes('time');
      }).map(el => ({
        tagName: el.tagName,
        id: el.id,
        class: el.className,
        text: el.textContent.trim()
      }));
      
      return components;
    });
    
    // Find WebSocket connections if any
    const wsConnections = await page.evaluate(() => {
      return Object.keys(window).filter(key => key.includes('socket') || key.includes('ws')); 
    });
    
    // Save analysis results to files
    fs.writeFileSync(
      path.join(outputDir, 'chart_components.json'), 
      JSON.stringify(chartSelectors, null, 2)
    );
    
    fs.writeFileSync(
      path.join(outputDir, 'trading_interface.json'), 
      JSON.stringify(tradingInterface, null, 2)
    );
    
    fs.writeFileSync(
      path.join(outputDir, 'api_requests.json'), 
      JSON.stringify(apiRequests, null, 2)
    );
    
    fs.writeFileSync(
      path.join(outputDir, 'websocket_connections.json'), 
      JSON.stringify(wsConnections, null, 2)
    );
    
    // Take screenshots of specific components if they were found
    if (chartSelectors.chartCanvases.length > 0) {
      const chartCanvas = chartSelectors.chartCanvases[0];
      await page.screenshot({
        path: path.join(outputDir, 'chart_component.png'),
        clip: {
          x: chartCanvas.position.left,
          y: chartCanvas.position.top,
          width: chartCanvas.position.width,
          height: chartCanvas.position.height
        }
      });
    }
    
    if (tradingInterface.actionButtons.length > 0) {
      // Find relevant elements by class or tag if IDs aren't available
      for (const button of tradingInterface.actionButtons) {
        let selector;
        if (button.id) {
          selector = `#${button.id}`;
        } else if (button.class) {
          selector = `.${button.class.split(' ').join('.')}`;
        } else {
          continue;
        }
        
        try {
          const el = await page.$(selector);
          if (el) {
            await el.screenshot({
              path: path.join(outputDir, `action_button_${button.text.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`)
            });
          }
        } catch (e) {
          console.log(`Couldn't screenshot button with selector ${selector}`);
        }
      }
    }
    
    console.log('Analysis complete. Results saved to the analysis_results directory.');
    
  } catch (error) {
    console.error('Error during analysis:', error);
    // Save error information
    fs.writeFileSync(
      path.join(outputDir, 'error.txt'),
      `Error during analysis: ${error.message}\n${error.stack}`
    );
  } finally {
    // Wait a bit before closing to see the page
    await page.waitForTimeout(10000);
    await browser.close();
  }
}

analyzeTradingPlatform().catch(console.error);