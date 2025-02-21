import { animate, query, stagger, state, style, transition, trigger } from '@angular/animations';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SolanaService } from '@shared/services/solana.service';
import { Subject, Subscription } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { NotificationService } from 'src/app/notification.service';
import { SocketIoTransactionService } from 'src/app/socket-io-transaction.service';
import { WebsocketApiService } from 'src/app/websocketapi.service';
declare const TradingView: any;

@Component({
  selector: 'app-chart',
  templateUrl: './chart.component.html',
  styleUrls: ['./chart.component.scss'],
  animations: [
    trigger('fadeInOutChart', [
      state('void', style({
        opacity: 0,
        display: 'none'
      })),
      state('*', style({
        opacity: 1,
        display: 'block'
      })),
      transition('void => *', [
        style({ display: 'block', opacity: 0 }),
        animate('300ms ease-out')
      ]),
      transition('* => void', [
        animate('300ms ease-out', style({ opacity: 0 }))
      ])
    ]),
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-out', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0 }))
      ])
    ]),
    trigger('fadeInAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-20px)' }),
        animate('0.5s ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
    trigger('listAnimation', [
      transition(':enter', [
        query(
          ':enter',
          [
            style({ opacity: 0, transform: 'translateY(10px)' }),
            stagger(50, [
              animate(
                '0.3s ease-in',
                style({ opacity: 1, transform: 'translateY(0)' })
              ),
            ]),
          ],
          { optional: true }
        ),
      ]),
    ]),
    trigger('itemAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.9)' }),
        animate('0.2s ease-out', style({ opacity: 1, transform: 'scale(1)' })),
      ])
    ]),
  ],
})
export class ChartComponent implements OnInit {
  private widget: any;
  private chartData: any[] = [];
  private tradingViewLoaded: boolean = false;
  public transactions: any = [];
  private messageSubscriptions: Subscription[] = [];
  public isConnected: boolean = false;
  private realtimeCallback: any;
  private updateCurveSubject = new Subject<void>();
  public stateCurve: any
  private isUpdating = false;
  private updateQueued = false;
  private readonly THROTTLE_DELAY = 5000;
  public button1: any;
  public button2: any;
  public button3: any;
  public selectedCurrency = 'USD';
  public selectedType = 'mcap';
  public coinId: any;
  public storedMarks: any = [];
  public token: any;
  public loading = true;
  private currentPage: { [key: string]: number } = {}; // Objet pour stocker la page par résolution
  resolutionApe = {
    ONE_SECOND: "1_SECOND",
    FIFTEEN_SECOND: "15_SECOND",
    THIRTY_SECOND: "30_SECOND",
    ONE_MINUTE: "1_MINUTE",
    THREE_MINUTE: "3_MINUTE",
    FIVE_MINUTE: "5_MINUTE",
    FIFTEEN_MINUTE: "15_MINUTE",
    THIRTY_MINUTE: "30_MINUTE",
    ONE_HOUR: "1_HOUR",
    TWO_HOUR: "2_HOUR",
    FOUR_HOUR: "4_HOUR",
    EIGHT_HOUR: "8_HOUR",
    TWELVE_HOUR: "12_HOUR",
    ONE_DAY: "1_DAY",
    ONE_WEEK: "1_WEEK",
    ONE_MONTH: "1_MONTH"
  }
  resolutionChart: any = {
    1: this.resolutionApe.ONE_MINUTE,
    5: this.resolutionApe.FIVE_MINUTE,
  }
  lastBar: any;
  lastBars: any;
  state: any;
  constructor(
    private notificationService: NotificationService,
    private route: ActivatedRoute,
    public solanaService: SolanaService,
    private http: HttpClient,
    public wsService: SocketIoTransactionService,
    private websocketService: WebsocketApiService,
  ) {
    this.updateCurveSubject.pipe(
      throttleTime(this.THROTTLE_DELAY, undefined, { leading: true, trailing: false })
    ).subscribe(() => {
      this.processUpdate();
    });
  }

  async checkCurve(mintAddress: string): Promise<void> {
    try {
      const response = await fetch('https://v2pump.serveo.net/coin/bonding?mint=' + mintAddress, {
        method: 'get'
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error)
      }

      console.log(result.data);
      this.stateCurve = result.data;


      if (this.token.source == 'https://pump.fun' && this.stateCurve.complete) {
        if (this.hasRaydiumSource(this.transactions)) {
          this.token.source = 'raydium';
        }
      }
    } catch (error) {
      console.error('Error checking curve progress:', error)
      throw error
    }
  }

  private async processUpdate() {
    if (this.token.source == 'raydium') {
      return
    }
    // Si déjà en cours de mise à jour, on marque qu'une mise à jour est en attente
    if (this.isUpdating) {
      this.updateQueued = true;
      return;
    }

    try {
      this.isUpdating = true;
      console.log('Début de la mise à jour:', new Date().toISOString());
      await this.checkCurve(this.coinId);
    } catch (error) {
      console.error('Error updating components:', error);
    } finally {
      this.isUpdating = false;
      console.log('Fin de la mise à jour:', new Date().toISOString());

      // Si une mise à jour a été demandée pendant l'exécution
      if (this.updateQueued) {
        this.updateQueued = false;
        // Attend le délai complet avant de traiter la prochaine mise à jour
        setTimeout(() => {
          this.processUpdate();
        }, this.THROTTLE_DELAY);
      }
    }
  }



  async ngOnInit() {
    window.scrollTo(0, 0);
    this.coinId = this.route.snapshot.paramMap.get('id') || '';
    await this.waitForTradingView();
    await this.loadToken();
    await this.initializeChart();
    await this.loadTransactions();
    await this.initializeWebsocket(this.coinId);


    this.loading = false;
  }


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

  private calculateCandlesCount(from: Date, to: Date, resolution: string): number {
    const timeSpanMs = to.getTime() - from.getTime();
    let resolutionMs: number;

    if (resolution === '1S') {
      resolutionMs = 1000;
    } else if (resolution === '1') {
      resolutionMs = 60 * 1000;
    } else {
      resolutionMs = parseInt(resolution) * 60 * 1000;
    }

    const requiredCandles = Math.ceil(timeSpanMs / resolutionMs);
    return Math.min(329, requiredCandles);
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

    return value.toFixed(9)

  }

  private isAnimating = false;
  private lastAnimationTime = 0;
  private lastDirection?: boolean; // undefined au début, puis true pour up, false pour down
  private readonly ANIMATION_COOLDOWN = 1000;
  private readonly BLINK_DURATION = 50;
  private readonly BLINK_PAUSE = 50;

  private async showArrow(time: number, isUp: boolean) {
    const now = Date.now();
    let shapes: any[] = []; // Tableau pour stocker les références des flèches

    if (this.isAnimating && isUp === this.lastDirection) {
        console.log('Animation skipped - same direction already running');
        return;
    }

    if (isUp === this.lastDirection &&
        (now - this.lastAnimationTime) < this.ANIMATION_COOLDOWN) {
        console.log('Animation skipped - too soon for same direction');
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

  formatSmallNumber(number: number): string {
    if (number === 0) return '0';

    // Convertir le nombre en string
    let numStr = number.toString();

    // Si ce n'est pas un nombre décimal, retourner tel quel
    if (!numStr.includes('.')) return numStr;

    // Séparer la partie entière et décimale
    let [wholePart, decimalPart] = numStr.split('.');

    // Compter le nombre de zéros consécutifs après la décimale
    let zeroCount = 0;
    for (let char of decimalPart) {
      if (char === '0') {
        zeroCount++;
      } else {
        break;
      }
    }

    // Si il y a des zéros consécutifs, les remplacer par "0ₓ" où x est le nombre de zéros
    if (zeroCount > 0) {
      let significantPart = decimalPart.slice(zeroCount);
      return `${wholePart}.0₃${significantPart}`;
    }

    // Si pas de zéros consécutifs, retourner le format original
    return numStr;
  }

  private initTradingView(): void {
    const symbol = this.token.name;

    this.widget = new TradingView.widget({
      debug: false,
      symbol: symbol,
      interval: "1",
      supported_resolutions: ['1', '5', '15', '30', '60'],
      container: 'tradingview_chart',
      library_path: '/assets/charting_library/',
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
            supported_resolutions: Object.keys(this.resolutionChart),
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
            has_daily: true,
            has_weekly_and_monthly: false,
            has_marks: false,  // Important: indiquer que le symbol supporte les marks
            supported_resolutions: Object.keys(this.resolutionChart),
            data_status: 'endofday',
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

            // Convertir la résolution TradingView en format Birdeye
            const resolutionMap: { [key: string]: string } = {
              '1': '1',
              '5': '5',
              '15': '15',
              '30': '30',
              '60': '60',
              // Ajouter d'autres mappings si nécessaire
            };

            const birdeyeResolution = resolutionMap[resolution] || '15';
            const quoteAdresse = this.selectedCurrency == 'USD' ? 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' : 'So11111111111111111111111111111111111111112'

            const url = `https://public-api.birdeye.so/defi/ohlcv/base_quote?quote_address=${quoteAdresse}&base_address=${this.coinId}&type=${birdeyeResolution}m&time_from=${timeFrom}&time_to=${timeTo}&selectedtype=${this.selectedType}`;

            const response = await this.http.get<any>(url, {
              headers: {
                'X-API-KEY': '284cb2f4efb844baa3e62251721a8ed2'
              }
            }).toPromise();

            if (response.success && response.data.items) {
              const bars = response.data.items.map((candle: any) => ({
                time: candle.unixTime * 1000, // Convertir en millisecondes
                open: this.selectedCurrency == 'USD' && this.selectedType == 'mcap' ? candle.o * this.token.supply : candle.o,
                high: this.selectedCurrency == 'USD' && this.selectedType == 'mcap' ? candle.h * this.token.supply : candle.h,
                low: this.selectedCurrency == 'USD' && this.selectedType == 'mcap' ? candle.l * this.token.supply : candle.l,
                close: this.selectedCurrency == 'USD' && this.selectedType == 'mcap' ? candle.c * this.token.supply : candle.c,
                volume: candle.vBase // ou vQuote selon ce que tu veux afficher
              }));

              if (response.data.items.length > 0 && !this.lastBar) {
                this.lastBar = {
                  time: response.data.items[response.data.items.length - 1].unixTime * 1000, // Convertir en millisecondes
                  open: this.selectedCurrency == 'USD' && this.selectedType == 'mcap' ? response.data.items[response.data.items.length - 1].o * this.token.supply : response.data.items[response.data.items.length - 1].o,
                  high: this.selectedCurrency == 'USD' && this.selectedType == 'mcap' ? response.data.items[response.data.items.length - 1].h * this.token.supply : response.data.items[response.data.items.length - 1].h,
                  low: this.selectedCurrency == 'USD' && this.selectedType == 'mcap' ? response.data.items[response.data.items.length - 1].l * this.token.supply : response.data.items[response.data.items.length - 1].l,
                  close: this.selectedCurrency == 'USD' && this.selectedType == 'mcap' ? response.data.items[response.data.items.length - 1].c * this.token.supply : response.data.items[response.data.items.length - 1].c,
                  volume: response.data.items[response.data.items.length - 1].vBase // ou vQuote selon ce que tu veux afficher
                }
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
        unsubscribeBars: (subscriberUID: any) => { },
        getMarks: (symbolInfo: any, startDate: number, endDate: number, onDataCallback: any) => {
          const marks = this.storedMarks || []; // storedMarks sera un tableau pour stocker nos marks

          const newMark = {
            id: Date.now(), // ID unique
            time: Date.now(),
            color: 'transparent', // Set the color to transparent
            text: '<div style="background: #f0f0f0; border: 1px solid #ccc; padding: 5px;">Custom Mark</div>', // Your custom HTML content
            label: 'test',
            labelFontColor: 'yellow',
            minSize: 30,
            shape: 'arrowUp', // You can use different shapes like arrowUp
          };

          this.storedMarks.push(newMark);

          // Forcer la mise à jour des marks
          if (this.widget.chart()) {
            this.widget.chart().refreshMarks();
          }
          onDataCallback(marks);
        },
      }
    });

    this.widget.headerReady().then(() => {
      this.button1 = this.widget.createButton();
      this.button2 = this.widget.createButton();
      this.button3 = this.widget.createButton();

      this.updateButtonText();

      this.button1.addEventListener('click', (event: MouseEvent) => {
        const clickX = event.offsetX;
        const buttonWidth = this.button1.offsetWidth;
        this.selectedCurrency = clickX < buttonWidth / 2 ? 'USD' : 'SOL';
        this.updateButtonText();
        this.updateChartDisplay();
      });

      this.button2.addEventListener('click', (event: MouseEvent) => {
        console.log('click')
        const clickX = event.offsetX;
        const buttonWidth = this.button2.offsetWidth;
        this.selectedType = clickX < buttonWidth / 2 ? 'price' : 'mcap';
        this.updateButtonText();
        this.updateChartDisplay();
      });
    });
  }

  hasRaydiumSource(items: any): boolean {
    let valide = false;

    for (let index = 0; index < items.length; index++) {
      const element = items[index];
      if (element.source == 'raydium') {
        valide = true;
        break;
      }
    }

    return valide;
  }

  private updateButtonText(): void {
    this.button1.innerHTML = `
      <span style="color: ${this.selectedCurrency === 'USD' ? '#49de80' : '#808080'}">USD</span>
      /
      <span style="color: ${this.selectedCurrency === 'SOL' ? '#49de80' : '#808080'}">SOL</span>
    `;
    this.button2.innerHTML = `
      <span style="color: ${this.selectedType === 'price' ? '#49de80' : '#808080'}">Price</span>
      /
      <span style="color: ${this.selectedType === 'mcap' ? '#49de80' : '#808080'}">Mcap</span>
    `;
    this.button3.innerHTML = `v2pump.fun`;
  }

  async updateChartDisplay() {
    try {
      this.cleanMessage();
      this.lastBar = null;
      const interval = String(this.widget.symbolInterval());
      const resolution = interval.split(',')[1] || '1';
      this.widget.chart().resetData();
      const symbolDescription = `PUMP_TOKEN (${this.selectedCurrency}) (${this.selectedType})`;
      await this.widget.chart().setSymbol(symbolDescription, resolution);
      console.log(`Chart refreshed with ${this.selectedCurrency} prices`);
    } catch (error) {
      console.error('Error updating chart display:', error);
    }
  }

  private updateChartData(newTrade: any) {
    if (this.loading) {
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

    // S'assurer que le timestamp est en secondes
    const tradeTimestamp = Math.floor(Number(newTrade.unixTime));
    const tradePeriodStart = Math.floor(tradeTimestamp / periodInSeconds) * periodInSeconds;

    // Vérification de la validité du timestamp
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


    // Si pas de dernier chandelier, créer le premier
    if (!lastCandle) {
      const newBar = {
        time: tradePeriodStart * 1000, // Convertir en millisecondes
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

    // Vérification que le nouveau trade n'est pas antérieur au dernier chandelier
    if (tradePeriodStart * 1000 <= lastCandle.time) {
      // Mise à jour du chandelier existant si le trade est dans la même période
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
    // Créer un nouveau chandelier
    const newBar = {
      time: tradePeriodStart * 1000,
      open: lastCandle.close,
      high: value,
      low: value,
      close: value,
      volume: newTrade.vBase
    };

    // Mettre à jour le dernier chandelier
    this.lastBar = newBar;
    if (this.realtimeCallback) {
      this.realtimeCallback(newBar);
    }

    console.log('Mise à jour du graphique:', {
      interval: intervalString,
      timestamp: new Date(tradePeriodStart * 1000),
      value: value,
      newBar: newBar
    });
  }

  private async loadTransactions(): Promise<void> {
    try {
      const url = 'https://public-api.birdeye.so/defi/txs/token?address=' + this.coinId + '&offset=0&limit=50&tx_type=swap&sort_type=desc';
      const response: any = await this.http.get<any[]>(url, {
        headers: {
          'X-API-KEY': '284cb2f4efb844baa3e62251721a8ed2'
        }
      }).toPromise();
      if (response) {
        this.transactions = this.formatTransactions(response.data);
        console.log(this.transactions);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des transactions:', error);
    }
  }

  private async loadToken(): Promise<boolean> {
    try {
      const url = 'https://v2pump.serveo.net/coin/coin?mint=' + this.coinId;
      const response: any = await this.http.get<any[]>(url).toPromise();

      if (response?.data) {
        // Préserver les données existantes de BirdEye tout en ajoutant/mettant à jour avec PumpFun
        this.token = {
          ...this.token, // Garde les données existantes de BirdEye
          id: response.data.id, // Id du token
          name: response.data.name,
          symbol: response.data.symbol,
          mc: this.token?.mc ?? response.data.usd_market_cap,
          logoURI: this.token?.logoURI ?? response.data.image_uri,
          description: response.data.description,
          reply_count: response.data.reply_count,
          creator: response.data.creator,
          king_of_the_hill_timestamp: response.data.king_of_the_hill_timestamp,
          decimals: this.token?.decimals ?? 6,
          supply: this.token?.tokenTotalSupply ?? 1000000000,
          extensions: {
            description: this.token?.extensions?.description ?? response.data.description,
            telegram: this.token?.extensions?.telegram ?? response.data.telegram,
            twitter: this.token?.extensions?.twitter ?? response.data.twitter,
            website: this.token?.extensions?.website ?? response.data.website
          },
          source: response.data.source
        };

        if(this.token.source == 'https://pump.fun'){
          this.stateCurve = {
            bonding_curve: response.data.bonding_curve || null,
            associated_bonding_curve: response.data.associated_bonding_curve || null,
            tokenTotalSupply: response.data.tokenTotalSupply || null,
            virtualTokenReserves: response.data.virtualTokenReserves || null,
            virtualSolReserves: response.data.virtualSolReserves || null,
            realTokenReserves: response.data.realTokenReserves || null,
            realSolReserves: response.data.realSolReserves || null,
            solPrice: response.data.solPrice || null,
            complete: response.data.complete
          }
        
          if (this.stateCurve.complete && this.token.source == 'https://pump.fun') {
            if (this.hasRaydiumSource(this.transactions)) {
              this.token.source = 'raydium';
            }
          }
        }

        if (this.token.logoURI) {
          this.token.logoURI = this.token.logoURI.replace(/cf-ipfs\.com/g, 'ipfs.io');
        }

        console.log(this.token)
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erreur PumpFun API:', error);
      return false;
    }
  }

  onScrollIndexChange(event: any) {
    if (event.endIndex === this.transactions.length - 1) {
      // Charger plus de données si nécessaire
      // this.loadMoreTransactions();
    }
  }

  getRowHeight(item: any): number {
    return 40;
  }

  private formatSol(lamports: number): string {
    return (lamports / 1e9).toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' SOL';
  }

  private formatTokenAmount(amount: number) {
    return (amount / 1e6);
  }

  oneSolPriceByMarketCap(usd: number, sol: number) {
    const conversionRate = usd / sol;
    const usdAmount = 1 * conversionRate;
    return usdAmount;
  }

  getFormattedTransactions(items: any): any[] {
    return items.map((trade: any, index: number) => ({
      ...trade,
      formattedSolAmount: this.formatSol(trade.sol_amount),
      formattedTokenAmount: this.formatTokenAmount(trade.token_amount),
      type: trade.is_buy ? 'Buy' : 'Sell',
      rowColor: index % 2 === 0 ? true : null, // Alternance simple des couleurs
    }));
  }

  formatTransactions(data: any) {
    return data.items.map((item: any) => {
      // Calculer la valeur en USD (en utilisant le prix SOL comme approximation)
      const solAmount = item.quote.uiAmount;
      const solPrice = item.quote.nearestPrice;
      const usdValue = solAmount * solPrice;

      // Créer l'objet formaté
      return {
        owner: item.owner,
        source: item.source,
        solAmount: item.side == 'buy' ? item.from.uiAmount.toFixed(2) : item.to.uiAmount.toFixed(2), // SOL amount
        tokenAmount: item.side == 'buy' ? item.to.uiAmount.toFixed(2) : item.from.uiAmount.toFixed(2), // SOL amount
        usdValue: usdValue.toFixed(2), // Valeur en USD avec 2 décimales
        txHash: item.txHash,
        type: item.side.toUpperCase(), // BUY ou SELL
        date: item.blockUnixTime // Convertir le timestamp en date lisible
      };
    });
  }

  formatTransaction(transaction: any) {
    // Calculer la valeur en USD en utilisant volumeUSD directement
    return {
      owner: transaction.owner,
      source: transaction.source,
      solAmount: transaction.side == 'buy' ? transaction.from.uiAmount.toFixed(2) : transaction.to.uiAmount.toFixed(2), // SOL amount
      tokenAmount: transaction.side == 'buy' ? transaction.to.uiAmount.toFixed(2) : transaction.from.uiAmount.toFixed(2), // SOL amount
      usdValue: transaction?.volumeUSD?.toFixed(2) || null, // USD value
      txHash: transaction.txHash,
      type: transaction.side.toUpperCase(),
      date: transaction.blockUnixTime // Timestamp en secondes
    };
  }

  transactionToOHLC(tx: any) {
    // Arrondir le timestamp à la minute la plus proche
    const timestamp = Math.floor(tx.blockUnixTime / 60) * 60;

    // Calculer le prix en SOL (pricePair est déjà en SOL)
    const solPrice = tx.pricePair;

    return {
      o: solPrice,
      h: solPrice,
      l: solPrice,
      c: solPrice,
      unixTime: timestamp, // Timestamp en secondes, arrondi à la minute
      vBase: tx.to.uiAmount, // Volume en tokens
      vQuote: tx.from.uiAmount // Volume en SOL
    };
  }

  transactionToOHLCusd(tx: any) {
    // Arrondir le timestamp à la minute la plus proche
    const timestamp = Math.floor(tx.blockUnixTime / 60) * 60;

    return {
      o: tx.tokenPrice,
      h: tx.tokenPrice,
      l: tx.tokenPrice,
      c: tx.tokenPrice,
      unixTime: timestamp, // Timestamp en secondes, arrondi à la minute
      vBase: tx.to.uiAmount,
      vQuote: tx.volumeUSD
    };
  }

  async initializeWebsocket(sub: any) {
    try {
      await this.websocketService.connect();


      this.websocketService.getMessages().subscribe(
        data => {
          if (data.type == 'WELCOME') {
            this.websocketService.subscribeTxData(this.coinId);
          } else if (data.type == 'TXS_DATA') {
            if (data.data && data.data.side == 'sell' || data.data && data.data.side == 'buy') {
              if (data.data.tokenPrice) {
                this.token.mc = data.data.tokenPrice * this.token.supply
              }
              if (this.selectedCurrency == 'USD') {
                const tradeData = this.transactionToOHLCusd(data.data);
                console.log(tradeData);
                this.transactions.unshift(this.formatTransaction(data.data));
                this.updateChartData(tradeData);
                if(this.token.source == 'https://pump.fun'){
                  this.updateCurveSubject.next(); 
                }
              } else {
                const tradeData = this.transactionToOHLC(data.data);
                console.log(tradeData);
                this.transactions.unshift(this.formatTransaction(data.data));
                if(this.token.source == 'https://pump.fun'){
                  this.updateCurveSubject.next(); 
                } 
                this.updateChartData(tradeData);
              }
            }
          }
        },
        error => {
          console.error('Erreur de réception:', error);
        }
      );

      this.websocketService.getConnectionStatus().subscribe(
        status => {
          console.log('État de la connexion:', status);
        }
      );

    } catch (error) {
      console.error('Erreur lors de l\'initialisation:', error);
    }
  }

  private cleanMessage() {
    try {
      if (this.messageSubscriptions && this.messageSubscriptions.length > 0) {
        this.messageSubscriptions.forEach(subscription => {
          if (subscription && typeof subscription.unsubscribe === 'function') {
            subscription.unsubscribe();
          }
        });
        this.messageSubscriptions = [];
      }
    } catch (error) {
      console.error('Erreur lors du nettoyage des subscriptions:', error);
    }
  }


  ngOnDestroy() {
    try {
      // 2. Nettoyage des marks du graphique

      console.log('on desktroy')
      this.clearMarks();

      // 3. Fermeture du widget TradingView
      if (this.widget) {
        this.widget.remove();
        this.widget = null;
      }

      // 4. Nettoyage des subscriptions de messages
      this.cleanMessage();

      // 5. Déconnexion du WebSocket

      this.websocketService.disconnect();


      // 6. Nettoyage des callbacks TradingView
      if (this.realtimeCallback) {
        this.realtimeCallback = null;
      }

      // 7. Réinitialisation des variables
      this.lastBar = null;
      this.lastBars = null;
      this.tradingViewLoaded = false;
      this.transactions = [];
      this.isConnected = false;
      this.loading = true;
      this.token = null;

      // 8. Suppression des événements des boutons
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

      // 9. Réinitialisation des pages courantes
      this.currentPage = {};

    } catch (error) {
      console.error('Erreur lors du nettoyage dans ngOnDestroy:', error);
    }
  }

  // Amélioration de la fonction cleanMessage pour plus de robustesse
  // Amélioration de la fonction clearMarks
  private clearMarks() {
    try {
      this.storedMarks = [];
      if (this.widget && this.widget.chart && typeof this.widget.chart === 'function') {
        const chart = this.widget.chart();
        if (chart && typeof chart.refreshMarks === 'function') {
          chart.refreshMarks();
        }
      }
    } catch (error) {
      console.error('Erreur lors du nettoyage des marks:', error);
    }
  }
}

