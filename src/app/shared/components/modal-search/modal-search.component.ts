import { Component, Input, Output, EventEmitter, OnInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Router } from '@angular/router';

interface Token {
  name: string;
  symbol: string;
  mc: number;
  logoURI: string;
  description: string;
  reply_count: number;
  creator: string;
  king_of_the_hill_timestamp: string;
  decimals: number;
  mint: any,
  supply: number;
  extensions: {
    description: string;
    telegram: string;
    twitter: string;
    website: string;
  };
  source: string;
}

@Component({
  selector: 'ngx-modal-search',
  templateUrl: './modal-search.component.html',
  styleUrls: ['./modal-search.component.scss']
})
export class ModalSearchComponent implements OnInit {
  @Input() set isOpen(value: boolean) {
    this._isOpen = value;
    if (!value) {
      setTimeout(() => {
        this.isOpenChange.emit(this._isOpen);
      }, 300);
    } else {
      this.isOpenChange.emit(this._isOpen);
      setTimeout(() => {
        this.searchInput.nativeElement.focus();
      });
      this.resetSearch();
      this.searchCoins(this.msg);
    }
  }
  get isOpen(): boolean {
    return this._isOpen;
  }
  @Output() isOpenChange = new EventEmitter<boolean>();
  @Input() msg: any;
  @ViewChild('searchInput') searchInput!: ElementRef;

  public coins: Token[] = [];
  private _isOpen: boolean = false;
  private searchSubject = new Subject<string>();
  public searchTerm: string = '';
  public loading: boolean = false;
  public error: string | null = null;
  public noResults: boolean = false;

  private offset: number = 0;
  private limit: number = 50;
  public hasMore: boolean = true;
  public isLoadingMore: boolean = false;

  constructor(private router: Router, private http: HttpClient) {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      this.resetSearch();
      this.searchCoins(searchTerm);
    });
  }

  ngOnInit() {
    this.searchCoins('');
  }

  resetSearch() {
    this.coins = [];
    this.offset = 0;
    this.hasMore = true;
    this.error = null;
    this.noResults = false;
  }

  onSearchChange(event: any) {
    const searchTerm = event;
    this.searchSubject.next(searchTerm);
  }

  private formatResponse(response: any): Token {
    return {
      name: response.name || '',
      symbol: response.symbol || '',
      mc: response.usd_market_cap || 0,
      logoURI: response.image_uri?.replace(/cf-ipfs\.com/g, 'ipfs.io') || '',
      description: response.description || '',
      reply_count: response.reply_count || 0,
      mint: response.mint || 0,
      creator: response.creator || '',
      king_of_the_hill_timestamp: response.king_of_the_hill_timestamp || '',
      decimals: 6,
      supply: 1000000000,
      extensions: {
        description: response.description || '',
        telegram: response.telegram || '',
        twitter: response.twitter || '',
        website: response.website || ''
      },
      source: response.complete ? 'raydium' : 'pump'
    };
  }

  private searchCoins(searchTerm: string) {
    if (this.loading) return;
    
    this.loading = true;
    this.error = null;
    
    const baseUrl = 'https://souctnjaypcptqpeeuhh.supabase.co/functions/v1/pumpfun/coins';
    const url = `${baseUrl}?offset=${this.offset}&limit=${this.limit}&sort=market_cap&order=DESC&includeNsfw=false&searchTerm=${searchTerm}`;

    this.http.get<any[]>(url).subscribe({
      next: (response: any[]) => {
        const formattedCoins = response.map(coin => this.formatResponse(coin));

        this.coins = [...this.coins, ...formattedCoins];
        this.hasMore = response.length === this.limit;
        this.noResults = this.coins.length === 0;
        this.loading = false;
        this.offset += response.length;
      },
      error: (error: HttpErrorResponse) => {
        this.error = 'Une erreur est survenue lors de la recherche. Veuillez réessayer.';
        this.loading = false;
      }
    });
  }

  reloadCurrentRoute(url: any) {
    const currentUrl = this.router.url;
    this.router.navigateByUrl('/', {skipLocationChange: true}).then(() => {
      this.router.navigate([url]);
    });
    this.isOpen = false;
  }
  

  onScroll() {
    if (!this.hasMore || this.loading) return;
    this.searchCoins(this.msg);
  }

  closeModal() {
    this.isOpen = false;
  }
}
