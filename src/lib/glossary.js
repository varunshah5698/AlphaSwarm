// Plain-English definitions shown on hover over dotted terms across the terminal.
export const GLOSSARY = {
  sharpe: 'Return earned per unit of risk. Above 1 is good, above 2 is strong — and here it is already net of costs.',
  'max dd': 'Worst peak-to-trough loss the factor suffered, in percent. Smaller magnitude is better.',
  drawdown: 'Peak-to-trough decline from the equity curve\'s high point, in percent.',
  'win rate': 'Share of trades that closed profitable, after costs and slippage are deducted.',
  'ann. vol': 'Annualized volatility — how widely the equity curve swings around its trend.',
  trades: 'Number of position changes the factor made across the backtest window.',
  costs: 'Fee charged on every position change, in basis points (1 bps = 0.01%).',
  slippage: 'Extra cost modeling the gap between the signal price and the real fill, in bps.',
  'next-bar': 'Signals execute on the following bar, so a factor can never peek at the future it predicts.',
  'out-of-sample': 'Evaluation on data the factor was never tuned on — the honesty test.',
  alpha: 'Return explained by the factor itself rather than by the market moving.',
  equity: 'Cumulative growth of $1 following the factor, with costs already deducted.',
  judge: 'The review agent that blocks leakage, look-ahead and over-complex factors before they count.',
  'buy & hold': 'Baseline of simply holding the market the whole window — what the alpha must beat.',
};
