import React, { useState } from 'react';
import ERCOTHourlyPatterns from './components/ERCOTHourlyPatterns';
import ERCOTAbsolutePrices from './components/ERCOTAbsolutePrices';
import './styles.css';

function App() {
  const [activeView, setActiveView] = useState('hourly');
  
  return (
    <div className="App">
      <header className="App-header">
        <h1>ERCOT Ancillary Services Price Analysis</h1>
        <div className="view-selector">
          <button 
            className={activeView === 'hourly' ? 'active' : ''}
            onClick={() => setActiveView('hourly')}
          >
            Hourly Patterns
          </button>
          <button 
            className={activeView === 'absolute' ? 'active' : ''}
            onClick={() => setActiveView('absolute')}
          >
            Maximum Prices
          </button>
        </div>
      </header>
      
      <main>
        {activeView === 'hourly' && <ERCOTHourlyPatterns />}
        {activeView === 'absolute' && <ERCOTAbsolutePrices />}
      </main>
      
      <footer>
        <p>ERCOT Ancillary Services Market Analysis</p>
      </footer>
    </div>
  );
}

export default App;