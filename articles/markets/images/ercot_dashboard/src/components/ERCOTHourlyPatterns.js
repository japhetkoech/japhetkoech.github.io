import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const ERCOTHourlyPatterns = () => {
  const [data, setData] = useState(null);
  const [currentMonth, setCurrentMonth] = useState('january');
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Read all three CSV files
        const aprilResponse = await fetch(`${process.env.PUBLIC_URL}/ercot_data_202404.csv`);
        const augustResponse = await fetch(`${process.env.PUBLIC_URL}/ercot_data_202408.csv`);
        const januaryResponse = await fetch(`${process.env.PUBLIC_URL}/ercot_data_202501.csv`);
        
        const aprilRaw = await aprilResponse.text();
        const augustRaw = await augustResponse.text();
        const januaryRaw = await januaryResponse.text();
        
        // Parse CSV files
        import Papa from 'papaparse';
        
        const parseOptions = {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true
        };
        
        const aprilData = Papa.parse(aprilRaw, parseOptions).data;
        const augustData = Papa.parse(augustRaw, parseOptions).data;
        const januaryData = Papa.parse(januaryRaw, parseOptions).data;
        
        // Process hourly data
        const processedData = {
          april: processHourlyData(aprilData),
          august: processHourlyData(augustData),
          january: processHourlyData(januaryData)
        };
        
        setData(processedData);
      } catch (error) {
        console.error('Error processing data:', error);
      }
    };
    
    fetchData();
  }, []);
  
  // Process hourly data
  const processHourlyData = (rawData) => {
    const ancillaryTypes = ['RRS', 'REGUP', 'NSPIN', 'REGDN', 'ECRS'];
    const hourlyData = [];
    
    // Get unique dates to calculate the number of days
    const uniqueDates = new Set();
    rawData.forEach(row => {
      uniqueDates.add(row.DeliveryDate);
    });
    const daysInMonth = uniqueDates.size;
    
    // Initialize array with 24 hours
    for (let hour = 1; hour <= 24; hour++) {
      hourlyData.push({
        hour,
        RRS: 0,
        REGUP: 0,
        NSPIN: 0,
        REGDN: 0,
        ECRS: 0,
        counts: {
          RRS: 0,
          REGUP: 0,
          NSPIN: 0,
          REGDN: 0,
          ECRS: 0
        },
        maxPrices: {
          RRS: { price: 0, date: '' },
          REGUP: { price: 0, date: '' },
          NSPIN: { price: 0, date: '' },
          REGDN: { price: 0, date: '' },
          ECRS: { price: 0, date: '' }
        }
      });
    }
    
    // Process data for each hour
    rawData.forEach(row => {
      const hourNumber = parseInt(row.HourEnding.split(':')[0]);
      if (hourNumber >= 1 && hourNumber <= 24 && ancillaryTypes.includes(row.AncillaryType)) {
        const hourIndex = hourNumber - 1; // Array is 0-indexed
        hourlyData[hourIndex][row.AncillaryType] += row.MCPC;
        hourlyData[hourIndex].counts[row.AncillaryType]++;
        
        // Track max price for each service and hour
        if (row.MCPC > hourlyData[hourIndex].maxPrices[row.AncillaryType].price) {
          hourlyData[hourIndex].maxPrices[row.AncillaryType] = {
            price: row.MCPC,
            date: row.DeliveryDate
          };
        }
      }
    });
    
    // Calculate averages
    hourlyData.forEach(hourData => {
      ancillaryTypes.forEach(type => {
        if (hourData.counts[type] > 0) {
          hourData[type] = hourData[type] / hourData.counts[type];
        }
      });
      
      // We need to keep the maxPrices object but can remove the counts
      delete hourData.counts;
    });
    
    return hourlyData;
  };

  // Get month label for display
  const getMonthLabel = (key) => {
    const labels = {
      january: 'January (Winter)',
      april: 'April (Shoulder Month)',
      august: 'August (Summer)'
    };
    return labels[key] || key;
  };
  
  // Process outliers for selected month
  const getOutliers = (monthKey) => {
    if (!data || !data[monthKey]) return [];
    
    const rawData = data[monthKey];
    const ancillaryTypes = ['RRS', 'REGUP', 'NSPIN', 'REGDN', 'ECRS'];
    
    // Collect data by service type
    const serviceData = {};
    ancillaryTypes.forEach(type => {
      serviceData[type] = rawData.map(hour => hour[type]);
    });
    
    // Calculate statistics for outlier detection
    const stats = {};
    ancillaryTypes.forEach(type => {
      const values = serviceData[type];
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      
      const squaredDiffs = values.map(value => Math.pow(value - avg, 2));
      const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
      const stdDev = Math.sqrt(variance);
      
      stats[type] = {
        avg,
        stdDev,
        threshold: avg + 3 * stdDev
      };
    });
    
    // Identify outliers
    const outliers = [];
    rawData.forEach((hourData, index) => {
      const hour = index + 1;
      
      ancillaryTypes.forEach(type => {
        if (hourData[type] > stats[type].threshold) {
          outliers.push({
            hour,
            service: type,
            price: hourData[type],
            threshold: stats[type].threshold
          });
        }
      });
    });
    
    // Sort by price descending
    return outliers.sort((a, b) => b.price - a.price).slice(0, 5);
  };
  
  if (!data) {
    return (
      <div className="loading-container">
        <p className="loading-text">Loading data...</p>
      </div>
    );
  }
  
  return (
    <div className="ercot-container">
      <h1 className="section-title">ERCOT Hourly Ancillary Services Price Patterns</h1>
      
      {/* Month selector */}
      <div className="control-container">
        <label className="control-label">Select Month:</label>
        <select 
          value={currentMonth}
          onChange={(e) => setCurrentMonth(e.target.value)}
          className="control-select"
        >
          <option value="january">January (Winter)</option>
          <option value="april">April (Shoulder Month)</option>
          <option value="august">August (Summer)</option>
        </select>
      </div>
      
      {/* Hourly chart */}
      <div className="chart-container">
        <h2 className="chart-title">{getMonthLabel(currentMonth)} - Hourly Average Price Patterns</h2>
        <p className="chart-note"><strong>Note:</strong> This chart shows the <em>average prices</em> for each hour across all days in the month.</p>
        <div className="chart">
          <ResponsiveContainer width="100%" height={400}>
            <LineChart
              data={data[currentMonth]}
              margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="hour" 
                type="number" 
                domain={[1, 24]}
                ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]} 
                label={{ value: 'Hour of Day', position: 'insideBottom', offset: 0 }}
              />
              <YAxis label={{ value: 'Average Price ($/MWh)', angle: -90, position: 'insideLeft' }} />
              <Tooltip formatter={(value) => [`$${value.toFixed(2)}/MWh`, 'Avg Price']} />
              <Legend />
              <Line type="monotone" dataKey="RRS" stroke="#8884d8" dot={{ strokeWidth: 2 }} activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="REGUP" stroke="#82ca9d" dot={{ strokeWidth: 2 }} />
              <Line type="monotone" dataKey="NSPIN" stroke="#ffc658" dot={{ strokeWidth: 2 }} />
              <Line type="monotone" dataKey="REGDN" stroke="#ff8042" dot={{ strokeWidth: 2 }} />
              <Line type="monotone" dataKey="ECRS" stroke="#ff0000" dot={{ strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Price Analysis Section */}
      <div className="analysis-container">
        <h2 className="section-title">Price Analysis - {getMonthLabel(currentMonth)}</h2>
        
        <div className="grid-layout">
          {/* Statistical Outliers */}
          <div className="grid-item">
            <h3 className="subsection-title">Statistical Outliers (> 3 Std Dev)</h3>
            <p className="description">Events that exceed 3 standard deviations from the mean</p>
            
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hour</th>
                  <th>Service</th>
                  <th>Price ($/MWh)</th>
                  <th>Threshold ($/MWh)</th>
                </tr>
              </thead>
              <tbody>
                {getOutliers(currentMonth).map((outlier, index) => (
                  <tr key={index}>
                    <td>{outlier.hour}:00</td>
                    <td>{outlier.service}</td>
                    <td>${outlier.price.toFixed(2)}</td>
                    <td>${outlier.threshold.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Absolute Highest Prices */}
          <div className="grid-item">
            <h3 className="subsection-title">Absolute Highest Prices</h3>
            <p className="description">Highest recorded prices regardless of statistical distribution</p>
            
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hour</th>
                  <th>Service</th>
                  <th>Max Price ($/MWh)</th>
                  <th>Month Avg ($/MWh)</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Find absolute highest prices by checking the maxPrices properties
                  const ancillaryTypes = ['RRS', 'REGUP', 'NSPIN', 'REGDN', 'ECRS'];
                  const allPrices = [];
                  
                  data[currentMonth].forEach((hourData, index) => {
                    const hour = index + 1;
                    ancillaryTypes.forEach(service => {
                        if (hourData.maxPrices && hourData.maxPrices[service]) {
                          allPrices.push({
                            hour,
                            service,
                            price: hourData.maxPrices[service].price,
                            date: hourData.maxPrices[service].date,
                            // Average for this service across all hours
                            avg: data[currentMonth].reduce((sum, h) => sum + h[service], 0) / 24
                          });
                        }
                      });
                    });
                    
                    // Sort by price descending and take top 5
                    return allPrices
                      .sort((a, b) => b.price - a.price)
                      .slice(0, 5)
                      .map((price, index) => (
                        <tr key={index}>
                          <td>{price.hour}:00</td>
                          <td>{price.service}</td>
                          <td>${price.price.toFixed(2)}</td>
                          <td>${price.avg.toFixed(2)}</td>
                        </tr>
                      ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        <div className="insights-container">
          <h3 className="subsection-title">Key Observations:</h3>
          <ul className="insights-list">
            <li>January shows distinct morning peaks around hours 8-9</li>
            <li>April and August show more pronounced evening peaks around hours 19-21</li>
            <li>All months show relatively low and stable prices during overnight hours (1-6)</li>
            <li>ECRS typically commands the highest prices across all months</li>
            <li>REGDN (Regulation Down) shows unique patterns compared to other services</li>
          </ul>
        </div>
      </div>
    );
  };
  
  export default ERCOTHourlyPatterns;