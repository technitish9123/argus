# Core Finance Concepts & Terms (with Formulas)

This document summarizes the key financial concepts, terms, and formulas used in Argus agent strategies.

---

## 📈 Price Series & OHLCV
- **OHLCV**: Open, High, Low, Close, Volume. Standard format for time series market data.

---

## 📊 Moving Average (MA)
- **Simple Moving Average (SMA):**
  
  $$
  \text{SMA}_t = \frac{1}{N} \sum_{i=0}^{N-1} x_{t-i}
  $$
  Where $N$ is the window length, $x$ is the price series.

- **Exponential Moving Average (EMA):**
  
  $$
  \text{EMA}_t = k \cdot x_t + (1 - k) \cdot \text{EMA}_{t-1} \\
  k = \frac{2}{N+1}
  $$

---

## 📉 Relative Strength Index (RSI)
- **RSI Formula:**
  
  $$
  \text{RSI}_t = 100 - \frac{100}{1 + RS} \\
  RS = \frac{\text{Avg Gain}}{\text{Avg Loss}}
  $$
  Where Avg Gain/Loss are averages over $N$ periods.

---

## 📊 MACD (Moving Average Convergence Divergence)
- **MACD Line:**
  
  $$
  \text{MACD}_t = \text{EMA}_{\text{fast}}(x_t) - \text{EMA}_{\text{slow}}(x_t)
  $$
- **Signal Line:**
  
  $$
  \text{Signal}_t = \text{EMA}_{\text{signal}}(\text{MACD}_t)
  $$
- **Histogram:**
  
  $$
  \text{Hist}_t = \text{MACD}_t - \text{Signal}_t
  $$

---

## 📈 True Range (TR) & Average True Range (ATR)
- **True Range:**
  
  $$
  \text{TR}_t = \max\left(\begin{array}{l}
    \text{High}_t - \text{Low}_t, \\
    |\text{High}_t - \text{Close}_{t-1}|, \\
    |\text{Low}_t - \text{Close}_{t-1}|
  \end{array}\right)
  $$
- **ATR:**
  
  $$
  \text{ATR}_t = \text{EMA}_N(\text{TR}_t)
  $$

---

## 📈 Z-Score (Mean Reversion)
- **Z-Score:**
  
  $$
  z_t = \frac{x_t - \mu_t}{\sigma_t}
  $$
  Where $\mu_t$ is the rolling mean, $\sigma_t$ is the rolling standard deviation.

---

## 📈 Volatility (Annualized)
- **EWMA Volatility:**
  
  $$
  \text{Var}_t = k \cdot r_t^2 + (1-k) \cdot \text{Var}_{t-1} \\
  \text{AnnVol}_t = \sqrt{\text{Var}_t} \cdot \sqrt{252}
  $$
  Where $r_t$ is the log return, $k = 2/(N+1)$, 252 = trading days/year.

---

## 🏷️ Key Terms
- **Signal:** Output of a strategy, typically -1 (sell), 0 (hold), 1 (buy).
- **Position Sizer:** Function that determines how much to buy/sell.
- **Breakout:** When price exceeds a previous high/low.
- **Ensemble:** Combining multiple signals (majority vote).
- **Volatility Filter:** Disables trading when volatility is too high/low.
- **Mean Reversion:** Betting price will return to its average.
- **Trend Following:** Betting price will continue in its current direction.

---

*For more details, see the code in `backend/src/services/signal_stategy.ts`.*
