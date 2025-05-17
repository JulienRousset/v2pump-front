import { HttpClient } from '@angular/common/http';
import { Component, Input, OnDestroy, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { Subject } from 'rxjs';
import { filter, takeUntil, throttleTime } from 'rxjs/operators';
import { WebsocketApiService } from 'src/app/websocketapi.service';

declare const TradingView: any;

@Component({
  selector: 'app-tradingview',
  templateUrl: './tradingview.component.html',
  styleUrls: ['./tradingview.component.scss']
})
export class TradingViewComponent implements OnInit, OnDestroy {
  @Input() coinId: any;
  @Input() token: any; // Le token est maintenant reçu comme input du parent

  private widget: any;
  public tradingViewLoaded: boolean = false;
  private destroy$ = new Subject<void>();
  private realtimeCallback: any;
  private updateCurveSubject = new Subject<void>();
  private isUpdating = false;
  private updateQueued = false;
  private readonly THROTTLE_DELAY = 5000;
  private button1: any;
  private button2: any;
  private button3: any;
  public selectedCurrency = 'USD';
  public selectedType = 'mcap';
  public loading = true;
  private lastBar: any;
  public initialized = false;
  private isAnimating = false;
  private lastAnimationTime = 0;
  private lastDirection?: boolean; // undefined au début, puis true pour up, false pour down
  private readonly ANIMATION_COOLDOWN = 1000;
  private readonly BLINK_DURATION = 50;
  private readonly BLINK_PAUSE = 50;


  resolutionChart: any = {
    1: "1_MINUTE",
    5: "5_MINUTE",
    15: "15_MINUTE",
    30: "30_MINUTE",
    60: "1_HOUR"
  }

  constructor(
    private http: HttpClient,
    private websocketService: WebsocketApiService,
  ) {
    this.updateCurveSubject.pipe(
      throttleTime(this.THROTTLE_DELAY, undefined, { leading: true, trailing: false })
    ).subscribe(() => {
      this.processUpdate();
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['token'] && changes['token'].currentValue && !this.initialized) {
      this.initialized = true;
      this.initializeComponent();
    }
  }

  private async initializeComponent() {
    await this.waitForTradingView();
    await this.initializeChart();
    this.loading = false;
  }

  ngOnInit() {}

  private waitForTradingView(): Promise<void> {
    return new Promise((resolve) => {
      const checkTradingView = () => {
        if (typeof TradingView !== 'undefined') {
          this.tradingViewLoaded = true;
          resolve();
        } else {
          setTimeout(checkTradingView, 100);
        }
      };
      checkTradingView();
    });
  }

  private async initializeChart(): Promise<void> {
    try {
      this.initTradingView();
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du graphique:', error);
    }
  }

  private formatValue(value: number) {
    if (this.selectedType === 'mcap') {
      if (value >= 1e9) {
        return (value / 1e9).toFixed(2) + 'B';
      } else if (value >= 1e6) {
        return (value / 1e6).toFixed(2) + 'M';
      } else if (value >= 1e3) {
        return (value / 1e3).toFixed(2) + 'K';
      }
      return value.toFixed(2);
    }

    return value.toFixed(9);
  }

  private initTradingView(): void {
    const symbol = this.token?.name || 'Token';

    this.widget = new TradingView.widget({
      debug: false,
      symbol: symbol,
      interval: "1",
      container: 'tradingview_chart',
      library_path: '/assets/charting_library/',
      time_frames: [
        { text: "1D", resolution: "1", description: "1 Day" },
        { text: "5D", resolution: "5", description: "5 Days" },
        { text: "1M", resolution: "30", description: "1 Month" },
        { text: "3M", resolution: "60", description: "3 Months" },
      ],
      theme: 'dark',
      enabled_features: ['two_character_bar_marks_labels'],
      disabled_features: ["header_symbol_search", "header_compare", "display_market_status", "countdown", "use_localstorage_for_settings", "popup_hints", "vert_touch_drag_scroll", "header_saveload"],
      custom_css_url: "/assets/chart.css",
      custom_formatters: {
        priceFormatterFactory: () => ({
          format: (price: number) => {
            return this.formatValue(price);
          }
        })
      },
      datafeed: {
        onReady: (callback: any) => {
          setTimeout(() => callback({
            supports_marks: 0,
          }), 0);
        },
        searchSymbols: async (userInput: string, exchange: string, symbolType: string, onResult: any) => { },
        resolveSymbol: async (symbolName: string, onSymbolResolvedCallback: any, onResolveErrorCallback: any) => {
          onSymbolResolvedCallback({
            name: symbolName,
            ticker: symbolName,
            description: `${symbolName}`,
            type: 'crypto',
            session: '24x7',
            timezone: 'Etc/UTC',
            exchange: 'v2pump',
            minmov: 1,
            pricescale: 1e10,
            has_intraday: true,
            has_marks: false,
            data_status: 'endofday',
            has_empty_bars: false,
          });
        },

        getBars: async (
          symbolInfo: any,
          resolution: any,
          periodParams: any,
          onHistoryCallback: any,
          onErrorCallback: any
        ) => {
          try {
            const timeFrom = periodParams.from;
            const timeTo = periodParams.to;
            if (resolution == '1' || resolution == '3' || resolution == '5' || resolution == '15' || resolution == '30' || resolution == '45' || resolution == '60') {
              resolution = resolution + 'm'
            }
            const url = `http://127.0.0.1:3000/coin/chart?mint=${this.coinId}&interval=${resolution}&from=${timeFrom}&to=${timeTo}&selectedtype=${this.selectedType}`;

            const response = await this.http.get<any>(url).toPromise();

            if (response.success && response.data) {
              // Filtrer les chandeliers avec volume = 0
              const filteredData = response.data.filter((candle: any) => candle.v >= 0);
              
              const bars = filteredData.map((candle: any) => ({
                time: candle.unixTime * 1000, // Convertir en millisecondes
                open: this.selectedCurrency == 'USD' && this.selectedType == 'mcap' ? candle.o * this.token.supply : candle.o,
                high: this.selectedCurrency == 'USD' && this.selectedType == 'mcap' ? candle.h * this.token.supply : candle.h,
                low: this.selectedCurrency == 'USD' && this.selectedType == 'mcap' ? candle.l * this.token.supply : candle.l,
                close: this.selectedCurrency == 'USD' && this.selectedType == 'mcap' ? candle.c * this.token.supply : candle.c,
                volume: candle.v
              }));

              if (filteredData.length > 0 && !this.lastBar) {
                const lastCandle = filteredData[filteredData.length - 1];
                this.lastBar = {
                  time: lastCandle.unixTime * 1000,
                  open: this.selectedCurrency == 'USD' && this.selectedType == 'mcap' ? lastCandle.o * this.token.supply : lastCandle.o,
                  high: this.selectedCurrency == 'USD' && this.selectedType == 'mcap' ? lastCandle.h * this.token.supply : lastCandle.h,
                  low: this.selectedCurrency == 'USD' && this.selectedType == 'mcap' ? lastCandle.l * this.token.supply : lastCandle.l,
                  close: this.selectedCurrency == 'USD' && this.selectedType == 'mcap' ? lastCandle.c * this.token.supply : lastCandle.c,
                  volume: lastCandle.v
                };
              }

              const meta = {
                noData: bars.length === 0,
                nextTime: bars.length > 0 ? bars[bars.length - 1].time : undefined
              };

              this.loading = false;
              onHistoryCallback(bars, meta);
            } else {
              throw new Error('Invalid API response');
            }
          } catch (error) {
            console.error('Erreur dans getBars:', error);
            onErrorCallback(error);
          }
        },
        subscribeBars: (
          symbolInfo: any,
          resolution: any,
          onRealtimeCallback: any,
          subscriberUID: any
        ) => {
          this.realtimeCallback = onRealtimeCallback;
        },
        unsubscribeBars: (subscriberUID: any) => { }
      }
    });

    this.widget.headerReady().then(() => {
      this.button2 = this.widget.createButton();
      this.button3 = this.widget.createButton();
      this.updateButtonText();
      this.button2.addEventListener('click', (event: MouseEvent) => {
        const clickX = event.offsetX;
        const buttonWidth = this.button2.offsetWidth;
        this.selectedType = clickX < buttonWidth / 2 ? 'price' : 'mcap';
        this.updateButtonText();
        this.updateChartDisplay();
      });
    });
  }

  private updateButtonText(): void {
    this.button2.innerHTML = `
      <span style="color: ${this.selectedType === 'price' ? '#49de80' : '#808080'}">Price</span>
      /
      <span style="color: ${this.selectedType === 'mcap' ? '#49de80' : '#808080'}">Mcap</span>
    `;
    this.button3.innerHTML = `v2pump.fun`;
  }

  async updateChartDisplay() {
    try {
      this.lastBar = null;
      const interval = String(this.widget.symbolInterval());
      const resolution = interval.split(',')[1] || "1";
      this.widget.chart().resetData();
      const symbolDescription = `PUMP_TOKEN (${this.selectedCurrency}) (${this.selectedType})`;
      await this.widget.chart().setSymbol(symbolDescription, resolution);
    } catch (error) {
      console.error('Error updating chart display:', error);
    }
  }

  updateChartData(newTrade: any) {
    if (this.loading) {
      return;
    }
    
    if (newTrade.vBase <= 0) {
      return;
    }
    
    const intervalString = this.widget.symbolInterval();
    let periodInSeconds: number;

    // Définir la période en secondes
    switch (intervalString) {
      case '1': periodInSeconds = 60; break;
      case '5': periodInSeconds = 300; break;
      case '15': periodInSeconds = 900; break;
      case '30': periodInSeconds = 1800; break;
      case '60': periodInSeconds = 3600; break;
      default: periodInSeconds = 60;
    }

    const tradeTimestamp = Math.floor(Number(newTrade.unixTime));
    const tradePeriodStart = Math.floor(tradeTimestamp / periodInSeconds) * periodInSeconds;

    if (!tradeTimestamp || tradeTimestamp <= 0) {
      console.error('Timestamp invalide:', tradeTimestamp);
      return;
    }

    const calculateValue = (price: number) => {
      return this.selectedCurrency === 'USD' && this.selectedType === 'mcap'
        ? price * this.token.supply
        : price;
    };

    const value = calculateValue(newTrade.c);

    // Vérification de la validité de la valeur
    if (isNaN(value) || value <= 0) {
      console.error('Valeur invalide:', value);
      return;
    }

    const lastCandle = this.lastBar;

    if (lastCandle) {
      const isUp = value > lastCandle.close;
      this.showArrow(tradeTimestamp, isUp);
    }

    if (!lastCandle) {
      const newBar = {
        time: tradePeriodStart * 1000, 
        open: value,
        high: value,
        low: value,
        close: value,
        volume: newTrade.vBase
      };
      this.lastBar = newBar;
      if (this.realtimeCallback) {
        this.realtimeCallback(newBar);
      }
      return;
    }

    if (tradePeriodStart * 1000 <= lastCandle.time) {
      if (tradePeriodStart * 1000 === lastCandle.time) {
        lastCandle.high = Math.max(lastCandle.high, value);
        lastCandle.low = Math.min(lastCandle.low, value);
        lastCandle.close = value;
        lastCandle.volume += newTrade.vBase;
        if (this.realtimeCallback) {
          this.realtimeCallback(lastCandle);
        }
      }
      return;
    }
    const newBar = {
      time: tradePeriodStart * 1000,
      open: lastCandle.close,
      high: value,
      low: value,
      close: value,
      volume: newTrade.vBase
    };

    this.lastBar = newBar;
    if (this.realtimeCallback) {
      this.realtimeCallback(newBar);
    }
  }

  private async processUpdate() {
    if (this.isUpdating) {
      this.updateQueued = true;
      return;
    }

    this.isUpdating = true;
    try {
    } catch (error) {
      console.error('Error updating components:', error);
    } finally {
      this.isUpdating = false;

      if (this.updateQueued) {
        this.updateQueued = false;
        setTimeout(() => {
          this.processUpdate();
        }, this.THROTTLE_DELAY);
      }
    }
  }

  private async showArrow(time: number, isUp: boolean) {
    const now = Date.now();
    let shapes: any[] = [];

    if (this.isAnimating && isUp === this.lastDirection) {
      return;
    }

    if (isUp === this.lastDirection &&
      (now - this.lastAnimationTime) < this.ANIMATION_COOLDOWN) {
      return;
    }

    try {
      this.isAnimating = true;
      this.lastAnimationTime = now;
      this.lastDirection = isUp;

      if (this.widget && this.widget.chart()) {
        for (let i = 0; i < 5; i++) {
          const shape = this.widget.chart().createShape(
            {
              channel: isUp ? "low" : "high",
              time: time
            },
            {
              shape: isUp ? "arrow_up" : "arrow_down",
              overrides: {
                arrowColor: isUp ? "yellow" : "yellow"
              },
              zOrder: "top"
            }
          );

          shapes.push(shape); // Stocker la référence de la flèche

          await new Promise(resolve => setTimeout(resolve, this.BLINK_DURATION));

          if (shape) {
            this.widget.chart().removeEntity(shape);
          }

          await new Promise(resolve => setTimeout(resolve, this.BLINK_PAUSE));
        }
      }
    } catch (error) {
      console.error('Error in showArrow:', error);
      // Suppression de toutes les flèches en cas d'erreur
      shapes.forEach(shape => {
        if (shape && this.widget && this.widget.chart()) {
          try {
            this.widget.chart().removeEntity(shape);
          } catch (e) {
            console.error('Error removing shape:', e);
          }
        }
      });
    } finally {
      this.isAnimating = false;
    }
  }

  ngOnDestroy() {
    try {
      if (this.widget) {
        this.widget.remove();
        this.widget = null;
      }

      if (this.websocketService) {
        this.websocketService.disconnect();
      }

      this.destroy$.next();
      this.destroy$.complete();

      this.realtimeCallback = null;
      this.lastBar = null;
      this.tradingViewLoaded = false;
      this.loading = true;

      if (this.button1) {
        this.button1.remove();
        this.button1 = null;
      }
      if (this.button2) {
        this.button2.remove();
        this.button2 = null;
      }
      if (this.button3) {
        this.button3.remove();
        this.button3 = null;
      }
    } catch (error) {
      console.error('Erreur lors du nettoyage dans ngOnDestroy:', error);
    }
  }
}
