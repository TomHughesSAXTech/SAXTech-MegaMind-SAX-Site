// Token metrics bootstrap overrides
// Ensures sessions are captured for charting, adds concise console logs, and wraps chart lifecycle safely.

(function(){
  function log(){ try { console.log.apply(console, ['[TokenMetrics]'].concat(Array.from(arguments))); } catch(e) {} }

  window.addEventListener('load', function(){
    // Capture sessions input to analyzer
    const __origAnalyze = window.analyzeTokenUsage;
    if (typeof __origAnalyze === 'function') {
      window.analyzeTokenUsage = function(sessions){
        try { if (Array.isArray(sessions)) { window.lastSessionsForMetrics = sessions; log('analyzeTokenUsage sessions:', sessions.length); } } catch(e) {}
        return __origAnalyze.apply(this, arguments);
      };
    }

    // Wrap refresh to log and ensure destruction before re-render
    const __origRefresh = window.refreshTokenUsage;
    if (typeof __origRefresh === 'function') {
      window.refreshTokenUsage = async function(){
        log('refreshTokenUsage invoked');
        try { if (window.tokenUsageChart && typeof window.tokenUsageChart.destroy === 'function') { window.tokenUsageChart.destroy(); window.tokenUsageChart = null; log('destroyed existing chart'); } } catch(e) {}
        const res = await __origRefresh.apply(this, arguments);
        try { log('lastSessionsForMetrics size:', Array.isArray(window.lastSessionsForMetrics) ? window.lastSessionsForMetrics.length : 0); } catch(e) {}
        return res;
      };
    }

    // Guard initialize to destroy pre-existing instance
    const __origInit = window.initializeTokenUsageChart;
    if (typeof __origInit === 'function') {
      window.initializeTokenUsageChart = function(){
        try { if (window.Chart && Chart.getChart) { const inst = Chart.getChart('tokenUsageChart'); if (inst) inst.destroy(); } } catch(e) {}
        try { if (window.tokenUsageChart && typeof window.tokenUsageChart.destroy === 'function') { window.tokenUsageChart.destroy(); } } catch(e) {}
        window.tokenUsageChart = null;
        return __origInit.apply(this, arguments);
      };
    }
  });
})();