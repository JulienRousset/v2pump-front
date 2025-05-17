import { Component, Input, OnDestroy, OnInit, Output, EventEmitter } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { WebsocketApiService } from 'src/app/websocketapi.service';
import { SocketIoTransactionService } from 'src/app/socket-io-transaction.service';
import { animate, query, stagger, state, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-transaction',
  templateUrl: './transaction.component.html',
  styleUrls: ['./transaction.component.scss'],
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
export class TransactionComponent implements OnInit, OnDestroy {
  @Input() coinId: string = '';
  @Input() token: any;
  @Input() selectedCurrency: string = 'USD';
  @Output() priceUpdate = new EventEmitter<any>();
  @Output() chartUpdate = new EventEmitter<any>();

  public transactions: any = [];
  private destroy$ = new Subject<void>();
  loading: boolean = true;
  error: boolean = false;

  constructor(
    private http: HttpClient,
    public wsService: SocketIoTransactionService,
    private websocketService: WebsocketApiService,
  ) { }

  ngOnInit() {
    this.loadTransactions();
    this.initializeWebsocket(this.coinId);
  }

   async loadTransactions(): Promise<void> {
    try {
      this.loading = true;
      this.error = false;
      
      const url = 'http://127.0.0.1:3000/coin/transaction?mint=' + this.coinId + '&offset=0&limit=50&tx_type=swap&sort_type=desc';
      const response: any = await this.http.get<any[]>(url, {
        headers: {
          'X-API-KEY': '284cb2f4efb844baa3e62251721a8ed2'
        }
      }).toPromise();
      if (response) {
        this.transactions = this.formatTransactions(response.data);
        this.loading = false;
        this.error = false;
        
      } else {
        this.loading = false;
        this.error = true;
        
      }
    } catch (error) {
      this.loading = false;
      this.error = true;
      
      console.error('Erreur lors du chargement des transactions:', error);
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

  // Ajoutez cette méthode à votre classe TransactionComponent
  private maintainTransactionLimit(maxTransactions: number = 50): void {
    // Si le nombre de transactions dépasse la limite, on supprime les plus anciennes
    if (this.transactions.length > maxTransactions) {
      this.transactions = this.transactions.slice(0, maxTransactions);
    }
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

  async initializeWebsocket(sub: any) {
    try {
      // Connexion au WebSocket avec attente
      await this.websocketService.connect();
      // Regarder l'état de la connexion et réagir aux changements
      this.websocketService.getConnectionStatus()
        .pipe(takeUntil(this.destroy$))
        .subscribe(status => {
          if (status) {
            if (!this.websocketService.isWatchingToken(this.coinId)) {
              this.websocketService.watchToken(this.coinId);
            }
          } else {
            console.log('WebSocket disconnected');
          }
        });

      // S'abonner dès maintenant au token
      this.websocketService.watchToken(this.coinId);

      // S'abonner aux messages
      this.websocketService.getMessages()
        .pipe(
          takeUntil(this.destroy$),
          // Ajouter un filtre pour vérifier que les données concernent notre token
          filter((message: any) => {
            // "t" est le format compact pour tokenAddress dans votre backend
            return message && (message.t === this.coinId || (message.data && message.data.token === this.coinId));
          })
        )
        .subscribe({
          next: (messageData) => {
            try {
              // Normaliser la structure des données
              let data;

              // Format compact du backend: { t: tokenAddress, d: data }
              if (messageData.t && messageData.d) {
                data = {
                  type: 'TXS_DATA',
                  data: messageData.d
                };
              }
              // Format standard avec type et données
              else if (messageData.type && messageData.data) {
                data = messageData;
              }
              // Autres formats possibles
              else {
                data = {
                  type: 'TXS_DATA',
                  data: messageData
                };
              }

              // Traitement selon le type
              switch (data.type) {
                case 'WELCOME':
                  break;

                case 'TXS_DATA':
                  if (!data.data) {
                    return;
                  }

                  const txData = data.data.data;

                  if (txData.side === 'sell' || txData.side === 'buy') {
                    if (txData.tokenPrice) {
                      this.priceUpdate.emit({
                        price: txData.tokenPrice,
                        marketCap: txData.tokenPrice * this.token.supply
                      });
                    }

                    if (this.selectedCurrency === 'USD') {
                      const tradeData = this.transactionToOHLCusd(txData);

                      this.transactions.unshift(this.formatTransaction(txData));
                      this.maintainTransactionLimit();

                      this.chartUpdate.emit(tradeData);

                    } else {
                      const tradeData = this.transactionToOHLC(txData);

                      this.transactions.unshift(this.formatTransaction(txData));
                      this.maintainTransactionLimit(); // Ajoutez cette ligne

                      this.chartUpdate.emit(tradeData);
                    }
                  } else {
                    console.log('Transaction without buy/sell side:', txData);
                  }
                  break;

                default:
                  console.log('Unhandled message type:', data.type);
                  break;
              }
            } catch (error) {
              console.error('Error processing WebSocket message:', error);
              console.error('Problematic message:', messageData);
            }
          },
          error: (error) => {
            console.error('WebSocket subscription error:', error);
            setTimeout(() => {
              console.log('Attempting to reconnect after error...');
              this.initializeWebsocket(sub);
            }, 5000);
          },
          complete: () => {
            console.log('WebSocket subscription completed');
          }
        });


    } catch (error) {
      console.error('WebSocket initialization failed:', error);
      setTimeout(() => {
        this.initializeWebsocket(sub);
      }, 5000);
    }
  }

  ngOnDestroy() {
    this.websocketService.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
