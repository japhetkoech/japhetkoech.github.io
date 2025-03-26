import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const ERCOTAbsolutePrices = () => {
  const [data, setData] = useState(null);
  const [currentMonth, setCurrentMonth] = useState('january');
  const [currentService, setCurrentService] = useState('all');
  
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
        
        // Process data
        const processedData = {
          april: processMonthData(aprilData, 'April'),
          august: processMonthData(augustData, 'August'),
          january: processMonthData(januaryData, 'January')
        };
        
        setData(processedData);
      } catch (error) {
        console.error('Error processing data:', error);
      }
    };
    
    fetchData();
  }, []);
  
  // Process data for a single month
  const processMonthData = (rawData, monthLabel) => {
    const services = ['RRS', 'REGUP', 'NSPIN', 'REGDN', 'ECRS'];
    
    // Initialize hourly data structure with max and avg values
    const hourlyData = [];
    for (let hour = 1; hour <= 24; hour++) {
      const hourObj = { hour };
      
      services.forEach(service => {
        hourObj[`${service}_max`] = 0;
        hourObj[`${service}_avg`] = 0;
        hourObj[`${service}_date`] = '';
      });
      
      hourlyData.push(hourObj);
    }
    
    // Group data by hour and service
    const grouped = {};
    services.forEach(service => {
      grouped[service] = {};
      for (let hour = 1; hour <= 24; hour++) {
        grouped[service][hour] = {
          prices: [],
          dates: []
        };
      }
    });
    
    // Process each row
    rawData.forEach(row => {
      if (services.includes(row.AncillaryType)) {
        const hour = parseInt(row.HourEnding.split(':')[0]);
        if (hour >= 1 && hour <= 24) {
          grouped[row.AncillaryType][hour].prices.push(row.MCPC);
          grouped[row.AncillaryType][hour].dates.push(row.DeliveryDate);
        }
      }
    });
    
    // Calculate max and avg values for each hour and service
    services.forEach(service => {
      for (let hour = 1; hour <= 24; hour++) {
        const prices = grouped[service][hour].prices;
        const dates = grouped[service][hour].dates;
        
        if (prices.length > 0) {
          // Find max price and its date
          const maxPrice = Math.max(...prices);
          const maxIndex = prices.indexOf(maxPrice);
          const maxDate = dates[maxIndex];
          
          // Calculate average
          const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
          
          // Update hourly data
          hourlyData[hour - 1][`${service}_max`] = maxPrice;
          hourlyData[hour - 1][`${service}_avg`] = avgPrice;
          hourlyData[hour - 1][`${service}_date`] = maxDate;
        }
      }
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
  
  // Format tooltip content
  const formatTooltip = (value, name, props) => {
    if (name.endsWith('_max')) {
      const service = name.split('_')[0];
      const date = props.payload[`${service}_date`];
      return [`$${value.toFixed(2)}/MWh on ${date}`, `Max ${service}`];
    } else if (name.endsWith('_avg')) {
      const service = name.split('_')[0];
      return [`$${value.toFixed(2)}/MWh`, `Avg ${service}`];
    }
    return [value, name];
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
      <h1 className="section-title">ERCOT Ancillary Services - Price Analysis</h1>
      
      {/* Controls */}
      <div className="control-container">
        <div className="control-group">
          <label className="control-label">Month:</label>
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
        
        <div className="control-group">
          <label className="control-label">Service:</label>
          <select 
            value={currentService}
            onChange={(e) => setCurrentService(e.target.value)}
            className="control-select"
          >
            <option value="all">All Services</option>
            <option value="RRS">RRS (Responsive Reserve)</option>
            <option value="REGUP">REGUP (Regulation Up)</option>
            <option value="NSPIN">NSPIN (Non-Spinning Reserve)</option>
            <option value="REGDN">REGDN (Regulation Down)</option>
            <option value="ECRS">ECRS (ERCOT Contingency Reserve)</option>
          </select>
        </div>
      </div>
      
      {/* Maximum vs Average Comparison Chart */}
      <div className="chart-container">
        <h2 className="chart-title">{getMonthLabel(currentMonth)} - Maximum vs. Average Prices by Hour</h2>
        <p className="chart-note">
          This chart compares the absolute maximum prices (bars/solid lines) to the average prices (dashed lines) for each hour of the day.
          The maximum price represents the highest price recorded for that hour during the month.
        </p>
        
        <div className="chart">
          <ResponsiveContainer width="100%" height={400}>
            {currentService === 'all' ? (
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
                <YAxis label={{ value: 'Price ($/MWh)', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={formatTooltip} />
                <Legend />
                
                {/* RRS lines */}
                <Line type="monotone" name="RRS (Max)" dataKey="RRS_max" stroke="#8884d8" strokeWidth={2} />
                <Line type="monotone" name="RRS (Avg)" dataKey="RRS_avg" stroke="#8884d8" strokeDasharray="4 4" strokeWidth={1} />
                
                {/* REGUP lines */}
                <Line type="monotone" name="REGUP (Max)" dataKey="REGUP_max" stroke="#82ca9d" strokeWidth={2} />
                <Line type="monotone" name="REGUP (Avg)" dataKey="REGUP_avg" stroke="#82ca9d" strokeDasharray="4 4" strokeWidth={1} />
                
                {/* NSPIN lines */}
                <Line type="monotone" name="NSPIN (Max)" dataKey="NSPIN_max" stroke="#ffc658" strokeWidth={2} />
                <Line type="monotone" name="NSPIN (Avg)" dataKey="NSPIN_avg" stroke="#ffc658" strokeDasharray="4 4" strokeWidth={1} />
                
                {/* REGDN lines */}
                <Line type="monotone" name="REGDN (Max)" dataKey="REGDN_max" stroke="#ff8042" strokeWidth={2} />
                <Line type="monotone" name="REGDN (Avg)" dataKey="REGDN_avg" stroke="#ff8042" strokeDasharray="4 4" strokeWidth={1} />
                
                {/* ECRS lines */}
                <Line type="monotone" name="ECRS (Max)" dataKey="ECRS_max" stroke="#ff0000" strokeWidth={2} />
                <Line type="monotone" name="ECRS (Avg)" dataKey="ECRS_avg" stroke="#ff0000" strokeDasharray="4 4" strokeWidth={1} />
              </LineChart>
            ) : (
              <BarChart
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
                <YAxis label={{ value: 'Price ($/MWh)', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={formatTooltip} />
                <Legend />
                <Bar name={`${currentService} (Max Price)`} dataKey={`${currentService}_max`} fill="#8884d8" />
                <Line name={`${currentService} (Avg Price)`} dataKey={`${currentService}_avg`} stroke="#ff0000" strokeWidth={2} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Highest Prices Table */}
      <div className="table-container">
        <h2 className="section-title">Top 5 Highest Prices - {getMonthLabel(currentMonth)}</h2>
        
        <table className="data-table">
          <thead>
            <tr>
              <th>Service</th>
              <th>Hour</th>
              <th>Date</th>
              <th>Price ($/MWh)</th>
              <th>Monthly Avg ($/MWh)</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              // Collect all hourly max prices
              const allPrices = [];
              
              data[currentMonth].forEach(hourData => {
                ['RRS', 'REGUP', 'NSPIN', 'REGDN', 'ECRS'].forEach(service => {
                  if (hourData[`${service}_max`] > 0) {
                    allPrices.push({
                      service,
                      hour: hourData.hour,
                      price: hourData[`${service}_max`],
                      date: hourData[`${service}_date`]
                    });
                  }
                });
              });
              
              // Calculate monthly average for each service
              const monthlyAvgs = {};
              ['RRS', 'REGUP', 'NSPIN', 'REGDN', 'ECRS'].forEach(service => {
                const prices = data[currentMonth].map(hour => hour[`${service}_avg`]);
                monthlyAvgs[service] = prices.reduce((sum, price) => sum + price, 0) / prices.length;
              });