import {
  Component,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';
import { WebsocketService } from 'src/app/websocket.service';
import { SocketIoService } from 'src/app/socket-io.service';
import { animate, query, stagger, style, transition, trigger } from '@angular/animations';
import { TrendingCoinService } from 'src/app/trending-coin.service';

interface Coin {
  id: Number;
  name: string;
  creator: string;
  marketCap: number;
  mint: number;
  ticker: string;
  king: string;
  ray: string;
  replies: number;
  description: string;
  timestamp: string;
  image: string;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  animations: [
    trigger('fadeInAnimation', [
      // Animation lors de l'ajout d'un élément
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-20px)' }), // Départ invisible et légèrement décalé vers le haut
        animate('0.5s ease-out', style({ opacity: 1, transform: 'translateY(0)' })), // Transition fluide à l'état visible
      ]),
    ]),
    // Animation pour toute la liste 
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

    // Animation pour les éléments individuels
    trigger('itemAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.9)' }),
        animate('0.2s ease-out', style({ opacity: 1, transform: 'scale(1)' })),
      ])
    ]),
  ], 
})
export class HomeComponent implements OnInit, OnDestroy {
  coins: Coin[] = [];
  currentSort: string = 'featured'; // Par défaut, "featured"
  currentLabelSort: string = 'Featured 🔥'; // Par défaut, "featured"

  loading: boolean = true;
  includeNsfw: boolean = false;
  isDropdownOpen = false;
  lastCoin: any;
  searchQuery: any = "";
  newTrades: any = [];
  private messageSubscriptions: Subscription[] = [];

  readonly BASE_URL = 'https://souctnjaypcptqpeeuhh.supabase.co/functions/v1/pumpfun/coins';
  readonly LIMIT = 50;
  private timeoutRef: any = null; // Pour stocker la référence du setTimeout

  sortOptions = [
    { value: 'featured', label: 'Featured 🔥' },
    { value: 'created_timestamp', label: 'Newest' },
    { value: 'last_reply', label: 'Recent Activity' },
    { value: 'last_trade_timestamp', label: 'Recent Trades' },
    { value: 'market_cap', label: 'Market Cap' }
  ];

  private subscriptions: Subscription[] = [];
  public isConnected: boolean = false;
  public animate = true;
  public disableAnimate = false;
  // Ajoute ces propriétés
  pageSize = 50; // Nombre d'éléments par page
  currentPage = 1; // Page actuelle
  totalPages = 30; // Nombre total de pages
  displayedCoins: Coin[] = []; // Les coins affichés sur la page actuelle
  private trendingInterval: any;
  originalResponse = [];
  trending = "";
  constructor(
    private http: HttpClient,
    private wsService: WebsocketService,
    private socketService: SocketIoService,
    private trendingCoinService: TrendingCoinService // Ajoutez cette ligne

  ) { }

  ngOnInit() {
    this.loadCoins();
    this.handleConnectionsBasedOnSort(); // Initialise la logique au démarrage
  }


  selectTrending(e: any){
    if(this.trending == e.word){
      this.trending = ""
      this.loadCoins();
      this.handleConnectionsBasedOnSort(); // Gère les connexions en fonction du tri

    } else {
      this.trending = e.word;
      this.cancelTimeout();
      this.disconnectAllServices();
      this.loadCoins();
    }
  }
  ngOnDestroy() {
    this.disconnectAllServices();
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.deactivateMessageSubscriptions();
    this.cancelTimeout();
  }

  trackByFn(index: number, item: any): number {
    return item.id; // Supposons que chaque élément a une clé unique
  }
  /**
   * Charger les données des coins
   */
  loadCoins() {
    this.loading = true;
    this.cancelTimeout();
    const offset = (this.currentPage - 1) * this.pageSize;
    let url: string;

    if (this.searchQuery) {
      url = `${this.BASE_URL}?offset=${offset}&limit=${this.pageSize}&sort=market_cap&order=DESC&includeNsfw=${this.includeNsfw}&searchTerm=${this.searchQuery}`;
    } else if(this.trending){
      url = `${this.BASE_URL}?includeNsfw=${this.includeNsfw}&meta=${this.trending}`;

    } else {
      if (this.currentSort === 'featured') {
        url = `${this.BASE_URL}/for-you?offset=${offset}&limit=${this.pageSize}&includeNsfw=${this.includeNsfw}`;
      } else {
        url = `${this.BASE_URL}?offset=${offset}&limit=${this.pageSize}&sort=${this.currentSort}&order=DESC&includeNsfw=${this.includeNsfw}`;
      }
    }

    this.http.get<any>(url).subscribe({
      next: (response) => {
        this.originalResponse = response
        this.coins = response.map((coin: any) => ({
          id: coin.for_you_id, // Ajoutez cet ID pour le système de trending
          name: coin.name,
          creator: coin.creator,
          marketCap: coin.usd_market_cap,
          replies: coin.reply_count,
          ticker: coin.symbol,
          mint: coin.mint,
          description: coin.description,
          timestamp: coin.created_timestamp,
          ray: coin.complete,
          king: coin.king_of_the_hill_timestamp,
          image: coin?.image_uri?.replace(/cf-ipfs\.com/g, 'ipfs.io')
        }));

        if (this.currentSort === 'featured') {
          this.startTrendingUpdates();
        }

        this.updateDisplayedCoins();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading coins:', error);
        this.loading = false;
      }
    });
  }

  private startTrendingUpdates() {
    // Arrêter l'intervalle existant s'il y en a un
    if (this.trendingInterval) {
      clearInterval(this.trendingInterval);
    }
  }

  clearSearch(){
    this.searchQuery = '';
    this.loadCoins();
    if(!this.trending){
      this.handleConnectionsBasedOnSort();
    }
  }

  changePage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadCoins();
      if (this.currentPage == 1 && this.searchQuery == "" && this.trending  == "") {
        this.handleConnectionsBasedOnSort(); // Gère les connexions en fonction du tri
      } else {
        this.disconnectAllServices();
      }
    }
  }


  updateDisplayedCoins() {
    this.displayedCoins = [...this.coins];
  }

  getPages(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  // Pour créer une pagination avec ellipsis (...)
  getPaginationRange(): (number | string)[] {
    const range: (number | string)[] = [];
    const showEllipsis = this.totalPages > 7;

    if (!showEllipsis) {
      return Array.from({ length: this.totalPages }, (_, i) => i + 1);
    }

    // Toujours montrer la première page
    range.push(1);

    if (this.currentPage > 3) {
      range.push('...');
    }

    // Pages autour de la page courante
    for (let i = Math.max(2, this.currentPage - 1); i <= Math.min(this.totalPages - 1, this.currentPage + 1); i++) {
      range.push(i);
    }

    if (this.currentPage < this.totalPages - 2) {
      range.push('...');
    }

    // Toujours montrer la dernière page
    range.push(this.totalPages);

    return range;
  }


  /**
   * Gère les connexions (abonne ou déconnecte) selon le `currentSort`.
   */

  handleConnectionsBasedOnSort() {
    this.disconnectAllServices();
    this.deactivateMessageSubscriptions();

    // Connexion au service approprié selon le tri
    switch (this.currentSort) {
      case 'created_timestamp':
        this.initializeWebsocket('newCoinCreated.prod 1');
        break;
      case 'last_reply':
        this.initializeWebsocket('newReplyCreated.*.prod 1');
        break;
      case 'last_trade_timestamp':
      case 'featured':
        this.initializeSocketIo();
        break;
      default:
        // Aucune connexion nécessaire pour les autres types de tri
        break;
    }
  }


  /**
   * Change le tri (sort) et recharge les données
   */
  changeSort(sort: any) {
    this.currentSort = sort.value;
    this.currentLabelSort = sort.label;
    this.loadCoins();
    if (this.currentPage == 1 && this.searchQuery  == "" && this.trending  == "") {
      this.handleConnectionsBasedOnSort(); // Gère les connexions en fonction du tri
    } else {
      this.disconnectAllServices();
    }
  }

  toggleNsfw() {
    this.includeNsfw = !this.includeNsfw;
    this.loadCoins(); // Recharge les données avec le NSFW activé/désactivé
  }

  initializeWebsocket(sub: any) {
    this.wsService.connect(sub);
    console.log('[WebsocketService] Connected.');

    const messageSubscription = this.wsService.messages$.subscribe(message => {
      if (!this.animate || this.disableAnimate) {
        return
      }

      if (this.currentSort == 'last_reply' && message && message.data) {
        const parse = JSON.parse(message.data);
        message.data = parse.coin;
      }

      if (message && message.data) {
        // Vérification des doublons
        if (this.coins.length > 0) {
          const lastCoin = this.coins[0];
          if (lastCoin.timestamp === message.data.created_timestamp && message.data.name == lastCoin.name) {
            console.warn('Duplicated message detected, skipping...');
            return;
          }
        }

        this.coins = [
          {
            id: Date.now(),
            name: message.data.name,
            creator: message.data.creator,
            marketCap: message.data.usd_market_cap,
            replies: message.data.reply_count,
            ticker: message.data.symbol,
            mint: message.data.mint,
            ray: message.data.complete,
            king: message.data.king_of_the_hill_timestamp,
            description: message.data.description,
            timestamp: message.data.created_timestamp,
            image: message.data.image_uri.replace(/cf-ipfs\.com/g, 'ipfs.io')
          },
          ...this.coins.slice(0, 49) // Prend les 49 premiers éléments existants
        ];
      }
    });

    const statusSubscription = this.wsService.connectionStatus$.subscribe(status => {
      this.isConnected = status;
      console.log('[WebsocketService] Connection status:', status);
    });

    this.messageSubscriptions.push(messageSubscription, statusSubscription);
  }


  initializeSocketIo() {
      this.socketService.connect();  
      const randomDelay = Math.floor(Math.random() * 1301) + 500;

      // Créer un interval de 2 secondes pour traiter les newTrades
      const processingInterval = interval(randomDelay).subscribe(() => {
        if (this.currentSort === 'featured' && this.newTrades.length > 0 && this.animate && !this.disableAnimate) {
          const array3 = this.originalResponse.concat(this.newTrades);
          let coin: any = this.trendingCoinService.createNewSelection(array3, 1);
          
          this.coins = [
            {
              id: Date.now(),
              name: coin[0].name,
              creator: coin[0].creator,
              marketCap: coin[0].usd_market_cap,
              replies: coin[0].reply_count,
              description: coin[0].description,
              ticker: coin[0].symbol,
              mint: coin[0].mint,
              ray: coin[0].complete,
              king: coin[0].king_of_the_hill_timestamp,
              timestamp: coin[0].created_timestamp,
              image: coin[0].image_uri.replace(/cf-ipfs\.com/g, 'ipfs.io')
            },
            ...this.coins.slice(0, 49)
          ];
          this.newTrades = []; // Vider newTrades après traitement
        }
      });
  
      const messageSubscription = this.socketService.messages$.subscribe(message => {
        if (message && message.data && message.data[0]) {
          // Vérification des doublons
          if (this.coins.length > 0) {
            const lastCoin = this.coins[0];
            if (lastCoin.timestamp === message.data[0].created_timestamp && message.data[0].name == lastCoin.name) {
              console.warn('Duplicated message detected, skipping...');
              return;
            }
          }
  
          if (!this.animate || this.disableAnimate) {
            return;
          }
  
          if (this.currentSort === 'featured') {
            // Ajouter simplement au newTrades
            this.newTrades = [
              message.data[0],
              ...this.newTrades.slice(0, 149)
            ];
          } else {
            // Traitement immédiat pour les autres cas
            this.coins = [
              {
                id: Date.now(),
                name: message.data[0].name,
                creator: message.data[0].creator,
                marketCap: message.data[0].usd_market_cap,
                replies: message.data[0].reply_count,
                description: message.data[0].description,
                timestamp: message.data[0].created_timestamp,
                ticker: message.data[0].symbol,
                mint: message.data[0].mint,
                ray: message.data[0].complete,
                king: message.data[0].king_of_the_hill_timestamp,
                image: message.data[0].image_uri.replace(/cf-ipfs\.com/g, 'ipfs.io')
              },
              ...this.coins.slice(0, 49)
            ];
          }
        }
      });
  
      if (this.coins.length > 50) {
        this.coins = this.coins.slice(0, 50);
      }
  
      const statusSubscription = this.socketService.connectionStatus$.subscribe(status => {
        this.isConnected = status;
        console.log('[SocketIoService] Connection status:', status);
      });
  
      // Ajouter l'interval aux subscriptions
      this.messageSubscriptions.push(messageSubscription, statusSubscription, processingInterval);
  }
  


  /**
   * Déconnecte tous les services pour libérer les ressources.
   */
  disconnectAllServices() {
    this.wsService.disconnect();
    this.socketService.disconnect();
    this.deactivateMessageSubscriptions();
    this.isConnected = false;
  }

  cancelTimeout() {
    if (this.timeoutRef) {
      clearTimeout(this.timeoutRef);
      this.timeoutRef = null;
    }
  }

  private deactivateMessageSubscriptions() {
    if (this.messageSubscriptions.length > 0) {
      this.messageSubscriptions.forEach(sub => {
        try {
          if (sub && !sub.closed) {
            sub.unsubscribe();
          }
        } catch (error) {
          console.error('Error unsubscribing:', error);
        }
      });
      this.messageSubscriptions = [];
    }
  }
}
